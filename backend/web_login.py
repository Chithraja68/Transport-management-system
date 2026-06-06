# ==============================================================================
# DRIVER SAFETY DETECTION SYSTEM — UNIFIED LOGIN
# ==============================================================================
# Single login grants access to ALL safety monitors:
#   • Drowsiness Detection (drowsiness_detection_optimized.py)
#   • Heart Rate Monitor   (heart_monitor.py)
#   • Alcohol Monitor      (alcohol_monitor.py)
#
# All three monitors read from ONE config file: drowsiness_login.json
# Run this once → log in once → start any/all monitors.
# ==============================================================================

import json
import os
import requests
import socket
import threading
from flask import Flask, render_template_string, request, jsonify
from datetime import datetime
from config import THRESHOLD

# ==============================================================================
# CAMERA DETECTION UTILITIES
# ==============================================================================

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "127.0.0.1"

def get_network_prefix():
    local_ip = get_local_ip()
    parts = local_ip.split('.')
    return '.'.join(parts[:3]) + '.'

def scan_for_cameras(network_prefix):
    cameras = []
    threads = []

    def check_ip(ip):
        try:
            url = f"http://{ip}:8080/video"
            resp = requests.get(url, timeout=0.5)
            if resp.status_code == 200:
                cameras.append({'url': url, 'ip': ip, 'name': f"Camera at {ip}"})
        except Exception:
            pass

    for i in range(1, 255):
        ip = network_prefix + str(i)
        t = threading.Thread(target=check_ip, args=(ip,))
        t.daemon = True
        t.start()
        threads.append(t)
    for t in threads:
        t.join()
    return cameras


# ==============================================================================
# UNIFIED LOGIN MANAGER
# Saves session to drowsiness_login.json — read by ALL three monitors
# ==============================================================================

class DrowsinessLoginManager:
    """
    Unified login manager for all safety monitors.
    Saves session to drowsiness_login.json which is read by:
      - drowsiness_detection_optimized.py
      - heart_monitor.py
      - alcohol_monitor.py
    """

    def __init__(self, config_file='drowsiness_login.json'):
        self.config_file = config_file
        self.config      = self.load_config()
        self.django_url  = self.config.get('django_url', 'http://127.0.0.1:8000')
        # Auto-reset stale/incomplete login on every startup
        if not self.config.get('logged_in'):
            camera_history = self.config.get('camera_history', [])
            django_url     = self.config.get('django_url', 'http://127.0.0.1:8000')
            self.config    = self.get_default_config()
            self.config['camera_history'] = camera_history
            self.config['django_url']     = django_url
            self.save_config(self.config)
    def load_config(self):
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    return json.load(f)
            except Exception:
                return self.get_default_config()
        return self.get_default_config()

    def get_default_config(self):
        return {
            'django_url':           'http://127.0.0.1:8000',
            'driver_username':      None,
            'driver_password':      None,
            'driver_id':            None,
            'driver_name':          None,
            'active_schedule_id':   None,
            'active_schedule_name': None,
            'camera_source':        'http://192.168.1.100:8080/video',
            'camera_history':       [],
            'macrodroid_start_webhook': 'https://trigger.macrodroid.com/468a0479-a635-41ae-8271-1f994889e127/alarm_start',
            'macrodroid_stop_webhook':  'https://trigger.macrodroid.com/468a0479-a635-41ae-8271-1f994889e127/alarm_stop',
            'logged_in':  False,
            'login_time': None,
        }

    def save_config(self, config):
        with open(self.config_file, 'w') as f:
            json.dump(config, f, indent=4)
        self.config = config

    def add_camera_to_history(self, camera_url):
        history = self.config.get('camera_history', [])
        history = [c for c in history if c['url'] != camera_url]
        history.insert(0, {'url': camera_url, 'last_used': datetime.now().isoformat()})
        self.config['camera_history'] = history[:5]
        self.save_config(self.config)

    def verify_login(self, username, password):
        try:
            csrf_resp  = requests.get(f"{self.django_url}/api/accounts/csrf/", timeout=5)
            csrf_token = csrf_resp.cookies.get('csrftoken')
            if not csrf_token:
                return False, "Could not get CSRF token from Django", []

            login_resp = requests.post(
                f"{self.django_url}/api/accounts/login/",
                json={'username': username, 'password': password},
                headers={'X-CSRFToken': csrf_token, 'Content-Type': 'application/json'},
                cookies={'csrftoken': csrf_token},
                timeout=10,
            )
            if login_resp.status_code != 200:
                return False, f"Login failed: {login_resp.text}", []

            response_data = login_resp.json()
            driver_data   = response_data.get('user', {})

            if driver_data.get('user_type') != 'DRIVER':
                return False, "User is not a driver", []

            schedules = self.get_driver_schedules(driver_data.get('id'), csrf_token, login_resp.cookies)
            return True, driver_data, schedules

        except requests.exceptions.ConnectionError:
            return False, f"Cannot connect to Django server at {self.django_url}", []
        except Exception as e:
            return False, str(e), []

    def get_driver_schedules(self, driver_id, csrf_token, cookies):
        try:
            today = datetime.now().strftime('%Y-%m-%d')
            resp  = requests.get(
                f"{self.django_url}/api/transport/schedules/",
                headers={'X-CSRFToken': csrf_token},
                cookies=cookies,
                timeout=10,
            )
            if resp.status_code != 200:
                return []

            all_schedules = resp.json()
            print(f"\n{('='*70)}")
            print("FETCHING SCHEDULES FROM DATABASE")
            print(f"Driver ID: {driver_id}  |  Today: {today}")
            print(f"Total schedules in DB: {len(all_schedules)}")

            driver_schedules = []
            for schedule in all_schedules:
                # Extract driver ID from all possible field structures
                schedule_driver_id = None
                for field in ['driver_id', 'driver', 'assigned_driver', 'driver_details',
                               'driverId', 'driverID', 'user_id', 'user']:
                    if field in schedule:
                        value = schedule.get(field)
                        if isinstance(value, dict):
                            schedule_driver_id = value.get('id') or value.get('user_id') or value.get('pk')
                        else:
                            schedule_driver_id = value
                        if schedule_driver_id is not None:
                            break

                if schedule_driver_id is None:
                    continue

                # Type-safe comparison (string AND integer)
                try:
                    is_match = (str(schedule_driver_id) == str(driver_id) or
                                int(str(schedule_driver_id)) == int(str(driver_id)))
                except Exception:
                    is_match = str(schedule_driver_id) == str(driver_id)

                schedule_date = schedule.get('schedule_date') or schedule.get('date', '')

                if is_match and schedule_date == today:
                    route_name = schedule.get('route_name', 'Unknown Route')
                    if 'route_details' in schedule and isinstance(schedule['route_details'], dict):
                        route_name = schedule['route_details'].get('route_name', route_name)

                    vehicle_number = schedule.get('vehicle_number', 'Unknown Vehicle')
                    if 'vehicle_details' in schedule and isinstance(schedule['vehicle_details'], dict):
                        vehicle_number = schedule['vehicle_details'].get('vehicle_number', vehicle_number)

                    driver_schedules.append({
                        'id':             schedule.get('id'),
                        'route_name':     route_name,
                        'vehicle_number': vehicle_number,
                        'departure_time': schedule.get('departure_time', 'N/A'),
                        'date':           schedule_date,
                    })

            print(f"RESULT: Found {len(driver_schedules)} schedule(s) for today")
            print('='*70 + '\n')
            return driver_schedules

        except Exception as e:
            print(f"Error getting schedules: {e}")
            import traceback
            traceback.print_exc()
            return []

    def save_login_session(self, username, password, driver_data,
                           schedule_id=None, schedule_name=None, camera_source=None):
        self.config.update({
            'driver_username':      username,
            'driver_password':      password,
            'driver_id':            driver_data.get('id'),
            'driver_name':          driver_data.get('name'),
            'active_schedule_id':   schedule_id,
            'active_schedule_name': schedule_name,
            'camera_source':        camera_source,
            'logged_in':            True,
            'login_time':           datetime.now().isoformat(),
        })
        if camera_source:
            self.add_camera_to_history(camera_source)
        self.save_config(self.config)
        self._write_current_driver(driver_data)

    def update_camera_only(self, camera_url):
        self.config['camera_source'] = camera_url
        self.add_camera_to_history(camera_url)
        self.save_config(self.config)

    def logout(self):
        camera_history = self.config.get('camera_history', [])
        self.config = self.get_default_config()
        self.config['camera_history'] = camera_history
        self.save_config(self.config)
        self._clear_current_driver() 
    
    def _write_current_driver(self, driver_data):
        import secrets
        session = {
            'logged_in':      True,
            'driver_id':      driver_data.get('id'),
            'driver_name':    driver_data.get('name'),
            'driver_username': driver_data.get('username'),
            'session_token':  secrets.token_hex(16),  # lets monitors detect re-login
            'login_time':     datetime.now().isoformat(),
        }
        with open('current_driver.json', 'w') as f:
            json.dump(session, f, indent=2)
    
    def _clear_current_driver(self):
        cleared = {
            'logged_in':     False,
            'driver_id':     None,
            'driver_name':   None,
            'session_token': None,
            'logout_time':   datetime.now().isoformat(),
        }
        with open('current_driver.json', 'w') as f:
            json.dump(cleared, f, indent=2)

    def is_logged_in(self):
        return self.config.get('logged_in', False)


# ==============================================================================
# WEB LOGIN INTERFACE
# ==============================================================================

def create_login_interface():

    app          = Flask(__name__)
    login_manager = DrowsinessLoginManager()

    HTML_TEMPLATE = r'''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Driver Safety Detection System</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
            max-width: 620px;
            width: 100%;
            max-height: 92vh;
            overflow-y: auto;
        }

        .header { text-align:center; margin-bottom:24px; }
        .icon {
            width:80px; height:80px;
            background: linear-gradient(135deg,#667eea 0%,#764ba2 100%);
            border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            margin:0 auto 14px;
            font-size:38px;
        }
        .header h1 { color:#333; font-size:26px; margin-bottom:6px; }
        .header p  { color:#666; font-size:14px; }

        /* monitors badge strip */
        .monitors-strip {
            display:flex; justify-content:center;
            gap:10px; margin-bottom:24px; flex-wrap:wrap;
        }
        .monitor-badge {
            display:flex; align-items:center; gap:6px;
            padding:7px 14px; border-radius:20px;
            font-size:13px; font-weight:600; border:2px solid;
        }
        .badge-drowsiness { background:#e0e7ff; color:#4338ca; border-color:#818cf8; }
        .badge-heart      { background:#fee2e2; color:#be123c; border-color:#f87171; }
        .badge-alcohol    { background:#fef3c7; color:#92400e; border-color:#fbbf24; }

        .form-group { margin-bottom:20px; }
        label { display:block; color:#333; font-weight:600; margin-bottom:8px; font-size:14px; }
        input, select {
            width:100%; padding:12px 15px;
            border:2px solid #e0e0e0; border-radius:8px;
            font-size:14px; transition:all 0.3s;
        }
        input:focus, select:focus {
            outline:none; border-color:#667eea;
            box-shadow:0 0 0 3px rgba(102,126,234,0.1);
        }

        button {
            width:100%; padding:14px; border:none;
            border-radius:8px; font-size:16px; font-weight:600;
            cursor:pointer; transition:all 0.3s; margin-top:10px;
        }
        .btn-primary {
            background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
            color:white;
        }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 5px 15px rgba(102,126,234,0.4); }
        .btn-secondary { background:#f0f0f0; color:#333; }
        .btn-secondary:hover { background:#e0e0e0; }
        .btn-danger { background:#ff4757; color:white; }
        .btn-danger:hover { background:#ee5a6f; }

        .status-message {
            padding:15px; border-radius:8px;
            margin-bottom:20px; display:none;
        }
        .status-message.success {
            background:#d4edda; color:#155724;
            border:1px solid #c3e6cb; display:block;
        }
        .status-message.error {
            background:#f8d7da; color:#721c24;
            border:1px solid #f5c6cb; display:block;
        }
        .status-message.info {
            background:#d1ecf1; color:#0c5460;
            border:1px solid #bee5eb; display:block;
        }

        .info-box {
            background:#f8f9fa; padding:15px;
            border-radius:8px; margin-bottom:20px;
        }
        .info-box h3 { color:#333; font-size:16px; margin-bottom:10px; }
        .info-item {
            display:flex; justify-content:space-between;
            padding:8px 0; border-bottom:1px solid #e0e0e0;
        }
        .info-item:last-child { border-bottom:none; }
        .info-label { color:#666; font-size:13px; }
        .info-value { color:#333; font-weight:600; font-size:13px; }

        .camera-box {
            background:#e8f5e9; padding:12px;
            border-radius:8px; margin-bottom:10px;
            border-left:4px solid #4caf50;
            cursor:pointer; transition:all 0.3s;
        }
        .camera-box:hover { background:#c8e6c9; transform:translateX(5px); }
        .camera-box h4 { color:#2e7d32; font-size:14px; margin-bottom:5px; }
        .camera-box p  { color:#666; font-size:12px; margin:3px 0; }

        .schedule-box {
            background:#e3f2fd; padding:12px;
            border-radius:8px; margin-bottom:10px;
            border-left:4px solid #2196f3;
        }
        .schedule-box h4 { color:#1976d2; font-size:14px; margin-bottom:5px; }
        .schedule-box p  { color:#666; font-size:12px; margin:3px 0; }

        .hidden { display:none; }

        .scanning { text-align:center; padding:20px; }
        .spinner {
            border:4px solid #f3f3f3; border-top:4px solid #667eea;
            border-radius:50%; width:40px; height:40px;
            animation:spin 1s linear infinite; margin:0 auto 15px;
        }
        @keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }

        .change-camera-btn { background:#ffa726; color:white; font-size:14px; padding:10px; }
        .change-camera-btn:hover { background:#fb8c00; }

        /* run-cards */
        .run-cards { display:grid; grid-template-columns:1fr; gap:10px; margin:14px 0; }
        .run-card {
            border-radius:10px; padding:14px 16px;
            border-left:4px solid; font-size:13px;
        }
        .run-card-title { font-weight:700; font-size:14px; margin-bottom:4px; }
        .run-card code {
            display:inline-block;
            background:rgba(0,0,0,0.08);
            padding:3px 8px; border-radius:4px;
            font-family:monospace; font-size:12px;
        }
        .card-drowsiness { background:#eef2ff; border-color:#6366f1; color:#3730a3; }
        .card-heart      { background:#fff1f2; border-color:#f43f5e; color:#9f1239; }
        .card-alcohol    { background:#fffbeb; border-color:#f59e0b; color:#78350f; }

        #alcoholTestScreen {
        text-align: center;
            padding: 20px;
        }

        .sensor-ring {
            width: 150px;
            height: 150px;
            border-radius: 50%;
            border: 5px solid gray;
            margin: 20px auto;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 30px;
        }

        .pass { border-color: green; }
        .fail { border-color: red; }
        .scanning { border-color: blue; }
    </style>
</head>
<body>
<div class="container">

    <div class="header">
        <div class="icon">&#x1F697;</div>
        <h1>Driver Safety Detection System</h1>
        <p>Login once &mdash; all safety monitors activate automatically</p>
    </div>

    <div class="monitors-strip">
        <span class="monitor-badge badge-drowsiness">&#x1F634; Drowsiness</span>
        <span class="monitor-badge badge-heart">&#x2764;&#xFE0F; Heart Rate</span>
        <span class="monitor-badge badge-alcohol">&#x1F37A; Alcohol</span>
    </div>

    <div id="statusMessage" class="status-message"></div>

    <!-- LOGIN FORM -->
    <div id="loginForm" class="{{ 'hidden' if logged_in else '' }}">
        <form id="driverLoginForm">
            <div class="form-group">
                <label for="username">&#x1F464; Driver Username</label>
                <input type="text" id="username" name="username" required
                       placeholder="Enter your username">
            </div>
            <div class="form-group">
                <label for="password">&#x1F512; Password</label>
                <input type="password" id="password" name="password" required
                       placeholder="Enter your password">
            </div>
            <div class="form-group">
                <label>&#x1F4F9; Camera Source (for Drowsiness Detection)</label>
                <div style="text-align:center;">
                    <button type="button" onclick="showManualEntry()" class="btn-secondary">
                        &#x270D;&#xFE0F; Enter the camera URL
                    </button>
                </div>
                <!-- Camera History -->
                <div id="cameraHistory" class="{{ 'hidden' if not camera_history else '' }}">
                    <p style="color:#666;font-size:13px;margin:10px 0 8px;">Recently Used:</p>
                    {% for cam in camera_history %}
                    <div class="camera-box" onclick="selectCamera('{{ cam.url }}')">
                        <h4>&#x1F4F9; {{ cam.url[:40] }}...</h4>
                        <p>Last used: {{ cam.last_used[:16] }}</p>
                    </div>
                    {% endfor %}
                </div>
                <!-- Manual Entry -->
                <div id="manualEntry" class="hidden">
                    <select id="camera_type" onchange="updateCameraInput()">
                        <option value="custom">Custom URL</option>
                        <option value="ipwebcam" selected>IP Webcam (Port 8080)</option>
                        <option value="local">Local Webcam (0)</option>
                    </select>
                    <input type="text" id="camera_source" name="camera_source"
                           value="http://192.168.1.100:8080/video"
                           style="margin-top:10px;" required>
                </div>
                <div id="scanResults" class="hidden"></div>
            </div>
            <button type="submit" class="btn-primary">
                &#x1F510; Login 
            </button>
        </form>
    </div>
    <div id="alcoholTestScreen" class="hidden">

        <h2>Alcohol Test</h2>
        <p>Please blow into the sensor</p>

        <div id="sensorRing" class="sensor-ring">
            <span id="sensorValue">0</span>
        </div>

        <p id="statusText">Ready</p>

        <button onclick="startAlcoholTest()">Start Test</button>

    </div>
    <!-- SCHEDULE SELECTION -->
    <div id="scheduleSelection" class="hidden">
        <div class="info-box">
            <h3>&#x2705; Login Successful!</h3>
            <div class="info-item">
                <span class="info-label">Driver:</span>
                <span class="info-value" id="driverName"></span>
            </div>
            <div class="info-item">
                <span class="info-label">Camera:</span>
                <span class="info-value" id="selectedCamera"></span>
            </div>
        </div>
        <h3 style="color:#333;margin-bottom:15px;">&#x1F4C5; Your Active Schedules Today:</h3>
        <div id="schedulesList"></div>
        
        <button onclick="logout()" class="btn-danger" style="margin-top:10px;">
            &#x1F6AA; Logout
        </button>
    </div>

    <!-- READY SCREEN -->
    <div id="readyScreen" class="{{ '' if logged_in else 'hidden' }}">
        {% if logged_in %}
        <div class="info-box">
            <h3>&#x1F3AF; All Monitors Ready!</h3>
            <div class="info-item">
                <span class="info-label">Driver:</span>
                <span class="info-value">{{ driver_name }}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Schedule:</span>
                <span class="info-value">{{ schedule_name or 'No Schedule' }}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Camera:</span>
                <span class="info-value">{{ camera_source[:40] }}...</span>
            </div>
            <div class="info-item">
                <span class="info-label">Status:</span>
                <span class="info-value" style="color:#16a34a;">&#x1F7E2; Logged In &mdash; All monitors unlocked</span>
            </div>
        </div>

        <button onclick="changeCameraOnly()" class="change-camera-btn">
            &#x1F4F9; Camera IP Changed? Update Here
        </button>

        <div style="margin:16px 0 8px;">
            <p style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;">
                &#x1F4CB; Run any monitor in a new terminal:
            </p>
            <div class="run-cards">
                <div class="run-card card-drowsiness">
                    <div class="run-card-title">&#x1F634; Drowsiness Detection</div>
                    <p>Close this window, press Ctrl+C, then run:</p>
                    <code>python drowsiness_detection_optimized.py</code>
                </div>
                <div class="run-card card-heart">
                    <div class="run-card-title">&#x2764;&#xFE0F; Heart Rate Monitor</div>
                    <p>In a new terminal run:</p>
                    <code>python heart_monitor.py</code>
                </div>
                <div class="run-card card-alcohol">
                    <div class="run-card-title">&#x1F37A; Alcohol Monitor</div>
                    <p>In a new terminal run:</p>
                    <code>python alcohol_monitor.py --port COM3</code>
                </div>
            </div>
        </div>

        <button onclick="logout()" class="btn-danger">
            &#x1F6AA; Full Logout &amp; Re-Login
        </button>
        {% endif %}
    </div>

    <!-- CAMERA UPDATE FORM -->
    <div id="cameraUpdateForm" class="hidden">
        <div class="info-box">
            <h3>&#x1F4F9; Update Camera Only</h3>
            <p style="color:#666;font-size:13px;margin-top:5px;">
                Driver and schedule stay the same. Only camera URL will change.
            </p>
        </div>
        <div style="text-align:center;">
            <button type="button" onclick="showManualUpdate()" class="btn-secondary">
                &#x270D;&#xFE0F; Enter the camera URL
            </button>
        </div>
        <div id="updateManualEntry" class="hidden">
            <input type="text" id="new_camera_url" placeholder="Enter new camera URL"
                   style="margin-bottom:10px;">
            <button onclick="saveNewCamera()" class="btn-primary">&#x1F4BE; Save New Camera</button>
        </div>
        <div id="updateScanResults" class="hidden"></div>
        <button onclick="cancelCameraUpdate()" class="btn-secondary" style="margin-top:10px;">
            &#x274C; Cancel
        </button>
    </div>

</div>

<script>
    let currentCameraSource = '';
    let tempLoginData = null;

    function showMessage(message, type) {
        const msgDiv = document.getElementById('statusMessage');
        msgDiv.textContent = message;
        msgDiv.className = 'status-message ' + type;
        setTimeout(() => { msgDiv.className = 'status-message'; }, 5000);
    }

    function updateCameraInput() {
        const type  = document.getElementById('camera_type').value;
        const input = document.getElementById('camera_source');
        if (type === 'ipwebcam') {
            const currentIP = input.value.match(/\d+\.\d+\.\d+\.\d+/);
            const ip = currentIP ? currentIP[0] : '192.168.1.100';
            input.value = 'http://' + ip + ':8080/video';
        } else if (type === 'local') {
            input.value = '0';
        }
    }

    function showManualEntry() {
        document.getElementById('manualEntry').classList.remove('hidden');
        document.getElementById('scanResults').classList.add('hidden');
        document.getElementById('cameraHistory').classList.add('hidden');
    }

    function selectCamera(url) {
        currentCameraSource = url;
        document.getElementById('camera_source').value = url;
        document.getElementById('manualEntry').classList.remove('hidden');
        showMessage('Camera selected: ' + url, 'success');
    }

    document.getElementById('driverLoginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username      = document.getElementById('username').value;
        const password      = document.getElementById('password').value;
        const camera_source = currentCameraSource || document.getElementById('camera_source').value;

        if (!camera_source) {
            showMessage('Please select or enter a camera source', 'error');
            return;
        }
        showMessage('Logging in and detecting schedules...', 'info');

        fetch('/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: username, password: password, camera_source: camera_source})
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                tempLoginData = data;
                document.getElementById('loginForm').classList.add('hidden');
                document.getElementById('alcoholTestScreen').classList.remove('hidden');
                document.getElementById('driverName').textContent = data.driver_name;
                document.getElementById('selectedCamera').textContent =
                    camera_source.substring(0, 40) + '...';

                var list = document.getElementById('schedulesList');
                list.innerHTML = '';
                if (data.schedules.length === 0) {
                    list.innerHTML = '<p style="color:#666;text-align:center;">No active schedules found for today</p>';
                } else {
                    data.schedules.forEach(function(schedule) {
                        var box = document.createElement('div');
                        box.className = 'schedule-box';
                        box.innerHTML =
                            '<h4>' + schedule.route_name + '</h4>' +
                            '<p>Vehicle: ' + schedule.vehicle_number + '</p>' +
                            '<p>Departure: ' + schedule.departure_time + '</p>' +
                            '<button onclick="selectSchedule(' + schedule.id + ', \'' + schedule.route_name + '\')" ' +
                            'class="btn-primary" style="margin-top:8px;font-size:13px;padding:8px;">' +
                            'Start with this schedule</button>';
                        list.appendChild(box);
                    });
                }
                showMessage('Login successful! Start a test to select the schedule.', 'success');
            } else {
                showMessage(data.message, 'error');
            }
        })
        .catch(function(err) { showMessage('Error: ' + err, 'error'); });
    });

    function selectSchedule(scheduleId, scheduleName) {
        fetch('/select_schedule', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({schedule_id: scheduleId, schedule_name: scheduleName})
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) location.reload();
            else showMessage(data.message, 'error');
        });
    }

    function selectNoSchedule() {
        fetch('/select_schedule', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({schedule_id: null, schedule_name: 'No Schedule'})
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) location.reload();
            else showMessage(data.message, 'error');
        });
    }

    function changeCameraOnly() {
        document.getElementById('readyScreen').classList.add('hidden');
        document.getElementById('cameraUpdateForm').classList.remove('hidden');
    }

    function cancelCameraUpdate() {
        document.getElementById('cameraUpdateForm').classList.add('hidden');
        document.getElementById('readyScreen').classList.remove('hidden');
    }

    function showManualUpdate() {
        document.getElementById('updateManualEntry').classList.remove('hidden');
        document.getElementById('updateScanResults').classList.add('hidden');
    }

    function updateToCamera(url) {
        fetch('/update_camera', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({camera_url: url})
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                showMessage('Camera updated!', 'success');
                setTimeout(function() { location.reload(); }, 1000);
            } else {
                showMessage(data.message, 'error');
            }
        });
    }

    function saveNewCamera() {
        var newUrl = document.getElementById('new_camera_url').value;
        if (!newUrl) { showMessage('Please enter a camera URL', 'error'); return; }
        updateToCamera(newUrl);
    }

    function logout() {
        if (confirm('Logout and clear all settings? All monitors will stop working.')) {
            fetch('/logout', {method: 'POST'}).then(function() { location.reload(); });
        }
    }

    function startAlcoholTest() {
        document.getElementById('statusText').textContent = "Checking sensor...";

        fetch('/alcohol_sensor_status')
        .then(res => res.json())
        .then(data => {

            // ❌ MONITOR NOT RUNNING
            if (!data.ready) {
                document.getElementById('statusText').textContent = data.message;
                document.getElementById('sensorRing').className = "sensor-ring fail";
                return;
            }

            // ✅ SENSOR OK → start test
            document.getElementById('statusText').textContent = "Blow into sensor...";

            setTimeout(() => {
                fetch('/alcohol_sensor_status')
                .then(res => res.json())
                .then(data => {

                    let value = data.sensor_value;
                    document.getElementById('sensorValue').textContent = value;
                    if (data.alcohol_detected) {

                        document.getElementById('statusText').textContent = "❌ Alcohol Detected";
                        document.getElementById('sensorRing').className = "sensor-ring fail";

                        // ✅ SEND TO BACKEND (VERY IMPORTANT)
                        fetch('/check_alcohol', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                alcohol_detected: true,
                                sensor_value: value,
                                alert_context: 'LOGIN'
                            })
                        })
                        .then(res => res.json())
                        .then(resp => {
                            alert(resp.message);
                        });
                    }
                    else {

                        document.getElementById('statusText').textContent = "✅ Safe";
                        document.getElementById('sensorRing').className = "sensor-ring pass";

                        // ✅ SEND SAFE STATUS ALSO
                        fetch('/check_alcohol', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                alcohol_detected: false,
                                sensor_value: value
                            })
                        });

                        setTimeout(() => {
                            document.getElementById('alcoholTestScreen').classList.add('hidden');
                            document.getElementById('scheduleSelection').classList.remove('hidden');
                        }, 2000);
                    }
                });
            }, 2000);
        });
    }
</script>
</body>
</html>
    '''

    @app.route('/')
    def index():
        cfg = login_manager.config
        return render_template_string(
            HTML_TEMPLATE,
            logged_in     = cfg.get('logged_in', False),
            driver_name   = cfg.get('driver_name', ''),
            schedule_name = cfg.get('active_schedule_name', ''),
            camera_source = cfg.get('camera_source', ''),
            camera_history= cfg.get('camera_history', []),
        )

    @app.route('/scan_cameras', methods=['POST'])
    def scan_cameras():
        try:
            cameras = scan_for_cameras(get_network_prefix())
            return jsonify({'success': True, 'cameras': cameras})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})

    @app.route('/login', methods=['POST'])
    def login():
        try:
            data          = request.get_json()
            username      = data.get('username')
            password      = data.get('password')
            camera_source = data.get('camera_source')

            success, result, schedules = login_manager.verify_login(username, password)
            print("DEBUG RESULT:", result)
            if success:
                temp_config = login_manager.config.copy()
                temp_config.update({
                    'driver_username': username,
                    'driver_password': password,
                    'driver_id':       result.get('id'),
                    'driver_name':     result.get('name'),
                    'camera_source':   camera_source,
                    'pending_schedules': schedules,
                    'driver_auth_token': result.get('token', ''),
                    'logged_in':       False,
                })
                login_manager.save_config(temp_config)
                
                login_manager._write_current_driver({'id': result.get('id'), 'name': result.get('name'), 'username': username})
                return jsonify({
                    'success':     True,
                    'driver_name': result.get('name'),
                    'schedules':   schedules,
                })
            else:
                return jsonify({'success': False, 'message': result})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)})

    @app.route('/select_schedule', methods=['POST'])
    def select_schedule():
        try:
            data          = request.get_json()
            schedule_id   = data.get('schedule_id')
            schedule_name = data.get('schedule_name')

            cfg = login_manager.config
            cfg['active_schedule_id']   = schedule_id
            cfg['active_schedule_name'] = schedule_name
            cfg['logged_in']            = True
            cfg['login_time']           = datetime.now().isoformat()
            login_manager.save_config(cfg)
            login_manager._write_current_driver({
                'id':       cfg.get('driver_id'),
                'name':     cfg.get('driver_name'),
                'username': cfg.get('driver_username'),
            })
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)})

    @app.route('/update_camera', methods=['POST'])
    def update_camera():
        try:
            data       = request.get_json()
            camera_url = data.get('camera_url')
            login_manager.update_camera_only(camera_url)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)})

    @app.route('/logout', methods=['POST'])
    def logout():
        login_manager.logout()
        return jsonify({'success': True})
    
    @app.route('/check_alcohol', methods=['POST'])
    def check_alcohol():
        """
        Called by the frontend after the sensor reading completes.
        Expects JSON: { "alcohol_detected": true/false, "sensor_value": 0.12 }
        
        - If alcohol_detected == False  → allow the driver to proceed to schedule selection
        - If alcohol_detected == True   → cancel the driver's schedule via Django API
                                          and send admin notification
        """
        try:
            import requests as req_lib

            data             = request.get_json()
            alcohol_detected = data.get('alcohol_detected', False)
            sensor_value     = data.get('sensor_value', 0.0)
            alert_context    = data.get('alert_context', 'LOGIN') 
            cfg         = login_manager.config
            driver_name = cfg.get('driver_name', 'Unknown Driver')
            driver_id   = cfg.get('driver_id')
            django_base = cfg.get('django_api_base') or cfg.get('django_url', 'http://127.0.0.1:8000') + '/api'
            

            if not alcohol_detected:
                # ✅ Driver is sober — allow to proceed
                return jsonify({
                    'success':  True,
                    'allowed':  True,
                    'message':  'Alcohol test passed. You may proceed.',
                })

            # ❌ Alcohol detected — take action
            print(f"\n{'='*60}")
            print(f"🚨 ALCOHOL DETECTED — Driver: {driver_name} (ID: {driver_id})")
            print(f"   Sensor value: {sensor_value}")
            print(f"{'='*60}\n")

            headers = {
                'Content-Type':  'application/json',
                
            }

            # 1) Cancel schedule via Django REST API
            cancel_errors = []
            if alert_context == 'LOGIN':
                pending_schedules = cfg.get('pending_schedules', [])
                for sched in pending_schedules:
                    sched_id = sched.get('id')
                    if not sched_id:
                        continue
                    try:
                        cancel_url = f"{django_base}/transport/schedules/{sched_id}/cancel/"
                        resp = req_lib.post(
                            cancel_url,
                            json={'reason': f'Driver {driver_name} failed alcohol test (value={sensor_value})'},
                            headers=headers,
                            timeout=10,
                        )
                        if resp.status_code not in (200, 201, 204):
                            cancel_errors.append(f"Schedule {sched_id}: {resp.text}")
                    except Exception as ce:
                        cancel_errors.append(str(ce))
                    

                # 2) Send admin notification via Django REST API
                # 2) Send alert to SAME Django alcohol API (like alcohol_monitor.py)

                try:
                    alert_url = f"{django_base}/alcohol/alert/"

                    alert_payload = {
                        'sensor_value': sensor_value,
                        'threshold': THRESHOLD,   # same as your THRESHOLD
                        'driver_id': driver_id,
                        'alert_context': alert_context,   # ✅ VERY IMPORTANT
                    }

                    req_lib.post(alert_url, json=alert_payload, headers=headers, timeout=10)

                except Exception as e:
                    print(f"Warning: could not send alert: {e}")

            # 3) Clear the partial login from config so nothing leaks
            if alert_context == 'LOGIN':
                login_manager.logout()
                message = (
                    'Alcohol detected! You are NOT allowed to drive. '
                    'Your schedule has been cancelled and the admin has been notified.'
                )
            else:
                message = 'Alcohol detected during driving! Admin has been notified.'

            return jsonify({
                'success':       True,
                'allowed':       False,
                'cancel_errors': cancel_errors,
                'message':       message,
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(e)})


    @app.route('/alcohol_sensor_status', methods=['GET'])
    def alcohol_sensor_status():
        import json, os, time

        ALCOHOL_STATUS_FILE = os.path.join(
            os.path.dirname(__file__), 'alcohol_sensor_status.json'
        )

        try:
            # ❌ File not found → monitor not running
            if not os.path.exists(ALCOHOL_STATUS_FILE):
                return jsonify({
                    'ready': False,
                    'message': '❌ Alcohol monitor not running! Start alcohol_monitor.py'
                })

            with open(ALCOHOL_STATUS_FILE, 'r') as f:
                status = json.load(f)

            # ❌ File exists but stale → monitor stopped
            last_time = status.get('timestamp')
            if last_time:
                last_time = time.mktime(time.strptime(last_time[:19], "%Y-%m-%dT%H:%M:%S"))
                if time.time() - last_time > 5:
                    return jsonify({
                        'ready': False,
                        'message': '❌ Alcohol monitor stopped! Restart it'
                    })

            # ✅ Everything OK
            return jsonify(status)

        except Exception as e:
            return jsonify({
                'ready': False,
                'message': f'Error reading sensor: {str(e)}'
            })
    return app


# ==============================================================================
# ENTRY POINT
# ==============================================================================

def launch_login_interface():
    print("\n" + "=" * 65)
    print("  DRIVER SAFETY DETECTION SYSTEM — UNIFIED LOGIN")
    print("=" * 65)
    print("\n  One login activates ALL safety monitors:")
    print("    Drowsiness Detection  ->  drowsiness_detection_optimized.py")
    print("    Heart Rate Monitor    ->  heart_monitor.py")
    print("    Alcohol Monitor       ->  alcohol_monitor.py")
    print("\n  All monitors read from: drowsiness_login.json")
    print("\n  Open browser: http://localhost:5000")
    print("=" * 65 + "\n")

    app = create_login_interface()
    app.run(debug=True, host='0.0.0.0', port=5000)


if __name__ == '__main__':
    launch_login_interface()