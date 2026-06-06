"""
Health Data Receiver with Heart Rate Alarm System
==================================================
- Receives data from HC Webhook via ngrok
- Triggers alarm when heart rate goes abnormal (too low OR too high)
- Same alarm system as drowsiness detection:
    winsound beep on computer + MacroDroid phone alarm (continuous re-trigger)
- Driver identity loaded automatically from drowsiness_login.json
  (the same session created by web_login.py — no separate login needed)
- Sends alert to Django backend → saves to DB → emails admin
"""

from flask import Flask, request, jsonify, render_template_string
from datetime import datetime
import json
import os
import threading
import time
import winsound
import requests
from session_manager import get_active_driver

app = Flask(__name__)
received_data = []

# ============================================================================
# STEP 1 — LOAD DRIVER IDENTITY FROM web_login.py SESSION
# ============================================================================
# web_login.py saves driver info to 'drowsiness_login.json' when the driver
# logs in for drowsiness detection. We read that same file here so the driver
# only needs to login once for both systems.

CONFIG_FILE = 'drowsiness_login.json'

def load_driver_from_session():
    """
    Read driver info saved by web_login.py.
    Returns a dict with driver details, or exits with a helpful message
    if the driver has not logged in yet.
    """
    if not os.path.exists(CONFIG_FILE):
        print("\n" + "=" * 70)
        print("❌  ERROR: Driver session not found!")
        print("=" * 70)
        print(f"\n   Config file '{CONFIG_FILE}' does not exist.")
        print("\n   You must log in using the drowsiness detection login first:")
        print("\n   ➤  STEP 1: Run the login interface")
        print("              python web_login.py")
        print("\n   ➤  STEP 2: Open browser → http://localhost:5000")
        print("\n   ➤  STEP 3: Enter driver credentials & select schedule")
        print("\n   ➤  STEP 4: Run this script again")
        print("\n" + "=" * 70 + "\n")
        exit(1)

    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
    except Exception as e:
        print(f"\n❌  Failed to read {CONFIG_FILE}: {e}")
        exit(1)

    # Check driver is actually logged in
    if not config.get('logged_in', False):
        print("\n" + "=" * 70)
        print("❌  ERROR: Driver is not logged in!")
        print("=" * 70)
        print(f"\n   Found '{CONFIG_FILE}' but 'logged_in' is False.")
        print("\n   Please complete the login process:")
        print("\n   ➤  Run: python web_login.py")
        print("   ➤  Open: http://localhost:5000")
        print("   ➤  Login and select a schedule, then run this script again.")
        print("\n" + "=" * 70 + "\n")
        exit(1)

    # Validate required fields
    driver_id   = config.get('driver_id')
    driver_name = config.get('driver_name')
    django_url  = config.get('django_url', 'http://127.0.0.1:8000')

    if not driver_id:
        print("\n⚠️  WARNING: driver_id not found in session config.")
        print("   Alerts will be saved without a driver link.")

    return {
        'driver_id':           driver_id,
        'driver_name':         driver_name,
        'driver_username':     config.get('driver_username'),
        'django_url':          django_url,
        'active_schedule_id':  config.get('active_schedule_id'),
        'active_schedule_name': config.get('active_schedule_name'),
        'macrodroid_start':    config.get('macrodroid_start_webhook',
                                   'https://trigger.macrodroid.com/468a0479-a635-41ae-8271-1f994889e127/alarm_start'),
        'macrodroid_stop':     config.get('macrodroid_stop_webhook',
                                   'https://trigger.macrodroid.com/468a0479-a635-41ae-8271-1f994889e127/alarm_stop'),
        'login_time':          config.get('login_time'),
    }


# Load session at startup — exits with a clear message if not logged in
SESSION = load_driver_from_session()

# ============================================================================
# CONFIGURATION  (auto-filled from session — no manual editing needed)
# ============================================================================

DJANGO_URL  = SESSION['django_url']
DRIVER_ID   = SESSION['driver_id']
DRIVER_NAME = SESSION['driver_name']

# Optional: set a matching secret in Django settings.py as HEART_RATE_ALERT_TOKEN
HEART_RATE_ALERT_TOKEN = ''

HR_LOW_THRESHOLD  = 50   # BPM below this triggers LOW alarm
HR_HIGH_THRESHOLD = 70   # BPM above this triggers HIGH alarm
ALERT_COOLDOWN    = 60    # Seconds between alerts (prevent spam)

MACRODROID_START_WEBHOOK       = SESSION['macrodroid_start']
MACRODROID_STOP_WEBHOOK        = SESSION['macrodroid_stop']
PHONE_ALARM_RETRIGGER_INTERVAL = 2   # Re-trigger phone alarm every 2 seconds
BUZZER_STATE_FILE = 'buzzer_state.json'
# ============================================================================
# STARTUP BANNER — show loaded driver info
# ============================================================================

print("\n" + "=" * 70)
print("✅  DRIVER SESSION LOADED FROM web_login.py")
print("=" * 70)
print(f"   Driver Name    : {DRIVER_NAME}")
print(f"   Driver ID      : {DRIVER_ID}")
print(f"   Username       : {SESSION['driver_username']}")
print(f"   Schedule       : {SESSION['active_schedule_name']} (ID: {SESSION['active_schedule_id']})")
print(f"   Django URL     : {DJANGO_URL}")
print(f"   Login Time     : {SESSION['login_time']}")
print(f"   HR Thresholds  : LOW < {HR_LOW_THRESHOLD} BPM  |  HIGH > {HR_HIGH_THRESHOLD} BPM")
print("=" * 70 + "\n")

# ============================================================================
# GLOBAL STATE
# ============================================================================
def set_buzzer_alert(active: bool):
    """Write heart rate alert state to buzzer_state.json."""
    state = {}
    if os.path.exists(BUZZER_STATE_FILE):
        try:
            with open(BUZZER_STATE_FILE, 'r') as f:
                state = json.load(f)
        except Exception:
            state = {}
    state['heart_rate'] = active
    try:
        with open(BUZZER_STATE_FILE, 'w') as f:
            json.dump(state, f)
    except Exception as e:
        print(f"  ⚠  Could not write buzzer state: {e}")
alarm_on           = False
phone_alarm_active = False
phone_alarm_thread = None
last_alert_time    = None
total_alerts       = 0


# ============================================================================
# COMPUTER ALARM  (winsound beep)
# ============================================================================

def play_alarm():
    global alarm_on
    while alarm_on:
        try:
            winsound.Beep(1000, 200)
            time.sleep(0.3)
        except:
            print("🔊 ALARM!")
            time.sleep(0.5)


def start_alarm():
    global alarm_on
    if not alarm_on:
        alarm_on = True
        threading.Thread(target=play_alarm, daemon=True).start()


def stop_alarm():
    global alarm_on
    alarm_on = False


# ============================================================================
# PHONE ALARM  (MacroDroid continuous re-trigger)
# ============================================================================

def keep_phone_alarm_active():
    global phone_alarm_active
    trigger_count = 0
    while phone_alarm_active:
        try:
            response = requests.get(MACRODROID_START_WEBHOOK, timeout=10)
            if response.status_code == 200:
                trigger_count += 1
                if trigger_count == 1:
                    print("📱 Phone alarm started")
                elif trigger_count % 5 == 0:
                    print(f"🔁 Phone alarm continuing... (trigger #{trigger_count})")
            else:
                print(f"⚠️  Phone alarm trigger failed: {response.status_code}")
        except Exception as e:
            print(f"⚠️  Phone alarm error: {e}")
        time.sleep(PHONE_ALARM_RETRIGGER_INTERVAL)
    print(f"✅ Phone alarm loop stopped (total triggers: {trigger_count})")


def trigger_phone_alarm_start():
    global phone_alarm_active, phone_alarm_thread
    if phone_alarm_active:
        return True
    print("\n" + "=" * 70)
    print("📱 STARTING CONTINUOUS PHONE ALARM")
    print("=" * 70)
    phone_alarm_active = True
    phone_alarm_thread = threading.Thread(target=keep_phone_alarm_active, daemon=True)
    phone_alarm_thread.start()
    return True


def trigger_phone_alarm_stop():
    global phone_alarm_active
    if not phone_alarm_active:
        return True
    phone_alarm_active = False
    time.sleep(0.5)
    try:
        response = requests.get(MACRODROID_STOP_WEBHOOK, timeout=2)
        if response.status_code == 200:
            print("✅ Phone alarm stopped successfully")
    except Exception as e:
        print(f"⚠️  STOP webhook error: {e}")
    return True


def trigger_all_alarms():
    global alarm_on
    print("\n" + "🚨" * 35)
    print(f"HEART RATE EMERGENCY — DRIVER: {DRIVER_NAME}")
    print("TRIGGERING ALL ALARMS")
    print("🚨" * 35 + "\n")
    if not alarm_on:
        start_alarm()
        print("✅ Computer alarm started (beeping)")
    if not phone_alarm_active:
        trigger_phone_alarm_start()
    set_buzzer_alert(True)


def stop_all_alarms():
    stop_alarm()
    print("✅ Computer alarm stopped")
    trigger_phone_alarm_stop()
    set_buzzer_alert(False)

# ============================================================================
# SEND ALERT TO DJANGO BACKEND
# ============================================================================

def send_alert_to_django(heart_rate, alert_type):
    """
    POST the alert to Django.
    Django saves it to the HeartRateAlert model and emails all admins.
    driver_id is taken from the web_login.py session automatically.
    """
    url = f"{DJANGO_URL}/api/heart-monitor/alert/"

   # Live driver lookup — never uses stale startup value
    active_driver = get_active_driver()
    if active_driver is None:
        print("⚠️  Alert suppressed — no driver logged in.")
        return

    payload = {
        "heart_rate":      heart_rate,
        "alert_type":      alert_type,       # "HIGH" or "LOW"
        "threshold_low":   HR_LOW_THRESHOLD,
        "threshold_high":  HR_HIGH_THRESHOLD,
        "driver_id":       active_driver['driver_id'],
    } 

    # Attach optional security token
    if HEART_RATE_ALERT_TOKEN:
        payload["token"] = HEART_RATE_ALERT_TOKEN

    print("\n" + "=" * 70)
    print("📡 SENDING ALERT TO DJANGO BACKEND...")
    print("=" * 70)
    print(f"   Driver     : {DRIVER_NAME} (ID: {DRIVER_ID})")
    print(f"   Heart Rate : {heart_rate} BPM  [{alert_type}]")
    print(f"   Django URL : {url}")

    try:
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code == 201:
            data = response.json()
            print(f"   ✅ Saved to Django!  Alert ID : {data.get('alert_id')}")
            print(f"   📧 Email sent to admin       : {data.get('email_sent')}")
        else:
            print(f"   ⚠️  Django returned {response.status_code}: {response.text}")
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Cannot reach Django at {DJANGO_URL}")
        print(f"      Make sure Django server is running!")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print("=" * 70 + "\n")


# ============================================================================
# HEART RATE ALARM CHECK
# ============================================================================

def check_heart_rate_alarm(heart_rate, bpm_list):
    """
    Called on every incoming HC Webhook sync.
    - Normal BPM  → stop alarms if running
    - Abnormal BPM → trigger alarms + notify Django (with cooldown)
    """
    global last_alert_time, total_alerts

    if heart_rate == 0:
        return

    is_low  = heart_rate < HR_LOW_THRESHOLD
    is_high = heart_rate > HR_HIGH_THRESHOLD

    if not (is_low or is_high):
        if alarm_on or phone_alarm_active:
            print(f"\n✅ Heart rate back to NORMAL ({heart_rate} BPM) — stopping alarms")
            stop_all_alarms()
        return

    # Abnormal — check cooldown
    current_time = time.time()
    if last_alert_time is not None and (current_time - last_alert_time) < ALERT_COOLDOWN:
        remaining = int(ALERT_COOLDOWN - (current_time - last_alert_time))
        print(f"⏳ Cooldown active — next alert in {remaining}s")
        return

    # Fire!
    total_alerts   += 1
    last_alert_time = current_time
    alert_type      = "LOW" if is_low else "HIGH"
    alert_emoji     = "❄️" if is_low else "🔥"

    print("\n" + "🚨" * 35)
    print(f"HEART RATE ALERT #{total_alerts}  —  Driver: {DRIVER_NAME}")
    print("🚨" * 35)
    print(f"  Type       : {alert_type} {alert_emoji}")
    print(f"  BPM        : {heart_rate}")
    print(f"  Thresholds : LOW < {HR_LOW_THRESHOLD}  |  HIGH > {HR_HIGH_THRESHOLD}")
    print(f"  Time       : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if len(bpm_list) > 1:
        print(f"  Readings   : {[h['bpm'] for h in bpm_list]}")
    print("🚨" * 35 + "\n")

    from session_manager import get_active_driver
    if get_active_driver() is None:
        print("⚠️  No driver logged in — alarm and alert suppressed.")
        return

    # Trigger alarms in background (non-blocking)
    threading.Thread(target=trigger_all_alarms, daemon=True).start()

    # Notify Django in background (non-blocking)
    threading.Thread(
        target=send_alert_to_django,
        args=(heart_rate, alert_type),
        daemon=True
    ).start()


# ============================================================================
# DASHBOARD HTML
# ============================================================================

HTML_PAGE = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Heart Rate Monitor — {{ driver_name }}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #f0f4f8; color: #1e293b; }

  .alarm-banner {
    background: linear-gradient(135deg, #dc2626, #991b1b);
    color: white; padding: 16px 24px;
    display: {% if alarm_active %}flex{% else %}none{% endif %};
    align-items: center; gap: 12px;
    font-size: 18px; font-weight: 700;
    animation: pulse 1s infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.7} }

  header {
    background: linear-gradient(135deg, #1e293b, #334155);
    color: white; padding: 20px 30px;
    display: flex; justify-content: space-between; align-items: center;
  }
  header h1 { font-size: 22px; }
  header .meta { font-size: 13px; opacity: .7; margin-top: 4px; }

  .driver-badge {
    background: rgba(255,255,255,.15);
    border: 1px solid rgba(255,255,255,.3);
    border-radius: 8px; padding: 10px 16px;
    font-size: 13px; text-align: right;
  }
  .driver-badge .name { font-size: 16px; font-weight: 700; }

  .stats-row {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
    padding: 20px 30px;
  }
  .stat-card {
    background: white; border-radius: 12px; padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,.08); text-align: center;
  }
  .stat-card .number { font-size: 40px; font-weight: 900; }
  .stat-card .label  { font-size: 13px; color: #64748b; margin-top: 4px; }
  .normal { color: #16a34a; }
  .danger { color: #dc2626; }
  .info   { color: #2563eb; }
  .warn   { color: #d97706; }

  .readings { padding: 0 30px 30px; }
  .readings h2 { font-size: 18px; margin-bottom: 12px; }
  .reading-card {
    background: white; border-radius: 10px; padding: 16px 20px;
    margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,.06);
    display: flex; align-items: center; gap: 20px;
  }
  .reading-card.abnormal { border-left: 4px solid #dc2626; }
  .reading-card.normal   { border-left: 4px solid #16a34a; }
  .bpm-val { font-size: 28px; font-weight: 900; min-width: 90px; }
  .reading-meta { font-size: 13px; color: #64748b; }
  .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .badge-red   { background: #fee2e2; color: #dc2626; }
  .badge-blue  { background: #dbeafe; color: #1d4ed8; }
  .badge-green { background: #dcfce7; color: #15803d; }
  .stop-btn {
    background: white; color: #dc2626; border: none;
    padding: 8px 18px; border-radius: 8px; cursor: pointer;
    font-size: 13px; font-weight: 700; margin-left: auto;
  }
</style>
</head>
<body>

{% if alarm_active %}
<div class="alarm-banner">
  🚨 ALARM ACTIVE — {{ alarm_message }}
  <button class="stop-btn" onclick="stopAlarm()">STOP ALARM</button>
</div>
{% endif %}

<header>
  <div>
    <h1>❤️ Heart Rate Monitor</h1>
    <div class="meta">Live data from HC Webhook · Auto-refreshes every 5s</div>
  </div>
  <div class="driver-badge">
    <div class="name">🧑‍✈️ {{ driver_name }}</div>
    <div style="opacity:.8; margin-top:2px;">{{ schedule_name }}</div>
    <div style="opacity:.6; font-size:11px; margin-top:2px;">Last update: {{ last_time }}</div>
  </div>
</header>

<div class="stats-row">
  <div class="stat-card">
    <div class="number {{ 'danger' if alarm_active else 'normal' }}">{{ latest_hr }}</div>
    <div class="label">Current BPM</div>
  </div>
  <div class="stat-card">
    <div class="number info">{{ count }}</div>
    <div class="label">Total Syncs</div>
  </div>
  <div class="stat-card">
    <div class="number warn">{{ total_alerts }}</div>
    <div class="label">Alerts Fired</div>
  </div>
  <div class="stat-card">
    <div class="number">{{ latest_steps }}</div>
    <div class="label">Steps</div>
  </div>
</div>

<div class="readings">
  <h2>📋 Recent Readings</h2>
  {% for r in readings %}
  {% set is_abnormal = (r.heart_rate < hr_low or r.heart_rate > hr_high) %}
  <div class="reading-card {{ 'abnormal' if is_abnormal else 'normal' }}">
    <div class="bpm-val {{ 'danger' if r.heart_rate > hr_high else 'info' if r.heart_rate < hr_low else 'normal' }}">
      {{ r.heart_rate | int }} BPM
    </div>
    <div style="flex:1;">
      <div class="reading-meta">
        🕐 {{ r.time }}
        {% if r.spo2 %}&nbsp;|&nbsp;🩸 SpO₂ {{ r.spo2 }}%{% endif %}
        &nbsp;|&nbsp;👟 {{ r.steps }} steps
      </div>
    </div>
    {% if r.heart_rate > hr_high %}
      <span class="badge badge-red">🔥 HIGH</span>
    {% elif r.heart_rate < hr_low %}
      <span class="badge badge-blue">❄️ LOW</span>
    {% else %}
      <span class="badge badge-green">✓ NORMAL</span>
    {% endif %}
  </div>
  {% else %}
  <p style="color:#94a3b8; text-align:center; padding:40px;">
    ⏳ Waiting for data from HC Webhook…
  </p>
  {% endfor %}
</div>

<script>
setTimeout(() => location.reload(), 5000);

function stopAlarm() {
  fetch('/stop_alarm', { method: 'POST' })
    .then(r => r.json())
    .then(() => location.reload());
}
</script>
</body>
</html>
"""


# ============================================================================
# FLASK ROUTES
# ============================================================================

@app.route('/health', methods=['POST'])
def receive_health():
    try:
        data = request.json if request.is_json else request.form.to_dict()

        print("\n" + "=" * 50)
        print(f"📥 DATA RECEIVED at {datetime.now().strftime('%H:%M:%S')}")
        print(f"   Driver: {DRIVER_NAME} (ID: {DRIVER_ID})")
        print("=" * 50)
        print(json.dumps(data, indent=2))

        # ── Heart rate ──────────────────────────────────────────────────────
        heart_rate  = 0
        hr_data     = (data.get('heart_rate') or data.get('heartRate')
                       or data.get('bpm') or data.get('value'))
        hr_raw_list = []

        if isinstance(hr_data, list) and len(hr_data) > 0:
            latest     = hr_data[-1]
            heart_rate = (latest.get('bpm') or latest.get('heart_rate')
                          or latest.get('value') or 0)
            total_readings = len(hr_data)
            for h in hr_data:
                t = h.get('time', '')
                try:
                    t = datetime.fromisoformat(t.replace('Z', '+00:00')).strftime('%H:%M')
                except:
                    pass
                hr_raw_list.append({'bpm': h.get('bpm', 0), 'time': t})
        elif isinstance(hr_data, (int, float)):
            heart_rate     = hr_data
            total_readings = 1
        else:
            total_readings = 0

        # ── SpO2 ────────────────────────────────────────────────────────────
        spo2      = None
        spo2_data = (data.get('spo2') or data.get('oxygen_saturation') or data.get('SpO2'))
        if isinstance(spo2_data, list) and len(spo2_data) > 0:
            spo2 = (spo2_data[-1].get('percentage') or spo2_data[-1].get('value')
                    or spo2_data[-1].get('spo2'))
        elif isinstance(spo2_data, (int, float)):
            spo2 = spo2_data

        # ── Steps ───────────────────────────────────────────────────────────
        steps      = 0
        steps_data = data.get('steps')
        if isinstance(steps_data, list) and len(steps_data) > 0:
            steps = steps_data[-1].get('count') or 0
        elif isinstance(steps_data, (int, float)):
            steps = steps_data

        # ── Store reading ───────────────────────────────────────────────────
        reading = {
            'heart_rate':     float(heart_rate),
            'spo2':           float(spo2) if spo2 else None,
            'steps':          int(steps),
            'total_readings': total_readings,
            'time':           datetime.now().strftime('%H:%M:%S'),
            'raw':            json.dumps(data, indent=2),
            'hr_raw_list':    hr_raw_list,
        }
        received_data.insert(0, reading)
        if len(received_data) > 50:
            received_data.pop()

        print(f"❤️  Heart Rate : {heart_rate} BPM")
        print(f"👟  Steps      : {steps}")
        if spo2:
            print(f"🩸  SpO₂       : {spo2}%")

        # ── Alarm + Django alert check ──────────────────────────────────────
        check_heart_rate_alarm(int(heart_rate), hr_raw_list)

        return jsonify({'status': 'received', 'heart_rate': heart_rate}), 200

    except Exception as e:
        import traceback
        print(f"❌ Error: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400


@app.route('/')
def dashboard():
    latest_hr    = int(received_data[0]['heart_rate']) if received_data else '--'
    last_time    = received_data[0]['time']            if received_data else '--'
    latest_steps = f"{received_data[0]['steps']:,}"   if received_data else '--'

    alarm_active  = alarm_on or phone_alarm_active
    alarm_message = ''
    if received_data:
        bpm = int(received_data[0]['heart_rate'])
        if bpm < HR_LOW_THRESHOLD:
            alarm_message = f"Heart rate too LOW: {bpm} BPM (threshold: {HR_LOW_THRESHOLD})"
        elif bpm > HR_HIGH_THRESHOLD:
            alarm_message = f"Heart rate too HIGH: {bpm} BPM (threshold: {HR_HIGH_THRESHOLD})"

    return render_template_string(
        HTML_PAGE,
        readings       = received_data,
        count          = len(received_data),
        latest_hr      = latest_hr,
        latest_steps   = latest_steps,
        last_time      = last_time,
        driver_name    = DRIVER_NAME or 'Unknown Driver',
        schedule_name  = SESSION['active_schedule_name'] or 'No schedule',
        alarm_active   = alarm_active,
        alarm_message  = alarm_message,
        total_alerts   = total_alerts,
        hr_low         = HR_LOW_THRESHOLD,
        hr_high        = HR_HIGH_THRESHOLD,
    )


@app.route('/ping')
def ping():
    return jsonify({
        'status':            'running',
        'driver':            DRIVER_NAME,
        'driver_id':         DRIVER_ID,
        'readings_received': len(received_data),
        'alarm_active':      alarm_on or phone_alarm_active,
        'total_alerts':      total_alerts,
    })


@app.route('/stop_alarm', methods=['POST'])
def manual_stop_alarm():
    stop_all_alarms()
    return jsonify({'status': 'alarms stopped'})


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == '__main__':
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
    except:
        local_ip = '127.0.0.1'
    finally:
        s.close()

    print("=" * 55)
    print("  🏥 HEALTH MONITOR — ALARM + DJANGO INTEGRATION")
    print("=" * 55)
    print(f"\n  👤 Driver          : {DRIVER_NAME}")
    print(f"  🪪  Driver ID       : {DRIVER_ID}")
    print(f"  📅 Schedule        : {SESSION['active_schedule_name']}")
    print(f"\n  ❤️  Alarm Thresholds:")
    print(f"      LOW  ALARM : below {HR_LOW_THRESHOLD} BPM")
    print(f"      HIGH ALARM : above {HR_HIGH_THRESHOLD} BPM")
    print(f"      Cooldown   : {ALERT_COOLDOWN} seconds")
    print(f"\n  📡 Django Backend  : {DJANGO_URL}")
    print(f"\n  🌐 Dashboard: http://localhost:9000")
    print(f"\n  ⏳ Waiting for data from HC Webhook...")
    print("=" * 55 + "\n")

    app.run(host='0.0.0.0', port=9000, debug=False)