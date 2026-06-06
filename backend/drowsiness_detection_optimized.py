import cv2
import mediapipe as mp
import numpy as np
import time
import threading
import winsound  # For Windows alarm
import os
import requests
from datetime import datetime
import json
from web_login import DrowsinessLoginManager
from session_manager import get_active_driver

# ============================================================================
# CONFIGURATION - UPDATE THESE SETTINGS
# ============================================================================

login_manager = DrowsinessLoginManager()

# Check if driver is logged in
if not login_manager.is_logged_in():
    print("\n" + "⚠️ " * 35)
    print("ERROR: NOT LOGGED IN!")
    print("⚠️ " * 35)
    print("\n🔐 You need to login first:")
    print("\n   STEP 1: Run the login interface")
    print("   ───────────────────────────────────────")
    print("   python drowsiness_web_login.py")
    print("\n   STEP 2: Open browser: http://localhost:5000")
    print("\n   STEP 3: Enter your driver credentials")
    print("\n   STEP 4: Select your active schedule")
    print("\n   STEP 5: Run this script again")
    print("\n" + "=" * 70 + "\n")
    exit(1)

# Load configuration from login session
config = login_manager.config

# ===== DJANGO BACKEND SETTINGS (Auto-loaded) =====
DJANGO_URL = config.get('django_url', 'http://127.0.0.1:8000')
DRIVER_USERNAME = config.get('driver_username')
DRIVER_PASSWORD = config.get('driver_password')
ACTIVE_SCHEDULE_ID = config.get('active_schedule_id')

# ===== IP WEBCAM SETTINGS (Auto-loaded) =====
CAMERA_SOURCE = config.get('camera_source', 'http://192.168.1.100:8080/video')

# ===== DETECTION SETTINGS =====
EAR_THRESHOLD = 0.25      # Will be overridden by calibration
DROWSY_TIME = 3           # Seconds of closed eyes before alert
ALERT_COOLDOWN = 60       # Seconds between alerts (prevent spam)

# ===== PERCLOS SETTINGS =====
PERCLOS_WINDOW = 60       # Number of frames to look back
PERCLOS_THRESHOLD = 0.15  # If eyes closed >15% of window → drowsy

# ===== BLINK RATE SETTINGS =====
BLINK_RATE_WINDOW = 60    # Seconds to measure blink rate over

# ===== PHONE ALARM SETTINGS (Auto-loaded) =====
PHONE_ALARM_RETRIGGER_INTERVAL = 2
MACRODROID_START_WEBHOOK = config.get(
    'macrodroid_start_webhook',
    'https://trigger.macrodroid.com/468a0479-a635-41ae-8271-1f994889e127/alarm_start'
)
MACRODROID_STOP_WEBHOOK = config.get(
    'macrodroid_stop_webhook',
    'https://trigger.macrodroid.com/468a0479-a635-41ae-8271-1f994889e127/alarm_stop'
)
BUZZER_STATE_FILE = 'buzzer_state.json'

# ===== PERFORMANCE SETTINGS =====
FRAME_SKIP = 2
VIDEO_WIDTH = 640
VIDEO_HEIGHT = 480

# Display loaded configuration
print("\n" + "=" * 70)
print("✅ CONFIGURATION LOADED FROM LOGIN SESSION")
print("=" * 70)
print(f"Driver Name:      {config.get('driver_name')}")
print(f"Driver ID:        {config.get('driver_id')}")
print(f"Username:         {DRIVER_USERNAME}")
print(f"Password:         {'*' * len(DRIVER_PASSWORD)}")
if ACTIVE_SCHEDULE_ID:
    print(f"Schedule:         {config.get('active_schedule_name')} (ID: {ACTIVE_SCHEDULE_ID})")
else:
    print(f"Schedule:         No schedule selected")
print(f"Camera Source:    {CAMERA_SOURCE}")
print(f"Login Time:       {config.get('login_time', 'Unknown')}")
print("=" * 70 + "\n")


# ============================================================================
# GLOBAL STATE
# ============================================================================

def set_buzzer_alert(active: bool):
    """Write drowsiness alert state to buzzer_state.json."""
    state = {}
    if os.path.exists(BUZZER_STATE_FILE):
        try:
            with open(BUZZER_STATE_FILE, 'r') as f:
                state = json.load(f)
        except Exception:
            state = {}
    state['drowsiness'] = active
    try:
        with open(BUZZER_STATE_FILE, 'w') as f:
            json.dump(state, f)
    except Exception as e:
        print(f"  ⚠  Could not write buzzer state: {e}")


alarm_on = False
last_alert_time = None
frame_count = 0
session_cookies = None
driver_id = None
is_logged_in = False
current_session_id = None
session_alert_count = 0

# Phone alarm state
phone_alarm_active = False
phone_alarm_thread = None


# ============================================================================
# DJANGO AUTHENTICATION
# ============================================================================

def login_to_django():
    global session_cookies, driver_id, is_logged_in

    try:
        print("\n" + "=" * 70)
        print("🔐 Connecting to Django Backend...")
        print("=" * 70)

        csrf_url = f"{DJANGO_URL}/api/accounts/csrf/"
        csrf_response = requests.get(csrf_url, timeout=5)
        csrf_token = csrf_response.cookies.get('csrftoken')

        if not csrf_token:
            print("❌ Could not get CSRF token from Django")
            return False

        login_url = f"{DJANGO_URL}/api/accounts/login/"
        login_data = {'username': DRIVER_USERNAME, 'password': DRIVER_PASSWORD}
        headers = {'X-CSRFToken': csrf_token, 'Content-Type': 'application/json'}

        login_response = requests.post(
            login_url,
            json=login_data,
            headers=headers,
            cookies={'csrftoken': csrf_token},
            timeout=10
        )

        if login_response.status_code == 200:
            response_data = login_response.json()
            driver_id = response_data.get('user', {}).get('id')
            session_cookies = login_response.cookies
            is_logged_in = True
            print(f"✅ Login Successful!")
            print(f"   Driver: {response_data.get('user', {}).get('name')}")
            print(f"   User Type: {response_data.get('user', {}).get('user_type')}")
            print(f"   Driver ID: {driver_id}")
            print("=" * 70 + "\n")
            return True
        else:
            print(f"❌ Login Failed! Status: {login_response.status_code}")
            print(f"   Response: {login_response.text}")
            print("=" * 70 + "\n")
            return False

    except requests.exceptions.ConnectionError:
        print("❌ Cannot Connect to Django Server!")
        print(f"   URL: {DJANGO_URL}")
        print("=" * 70 + "\n")
        return False
    except Exception as e:
        print(f"❌ Login Error: {e}")
        print("=" * 70 + "\n")
        return False


# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

def start_monitoring_session():
    global session_cookies, driver_id, is_logged_in, current_session_id, session_alert_count

    if not is_logged_in:
        print("⚠️  Not logged in to Django!")
        return None

    try:
        print("\n" + "=" * 70)
        print("🎬 Starting Monitoring Session...")
        print("=" * 70)

        session_url = f"{DJANGO_URL}/api/drowsiness/sessions/start/"
        data = {'driver_id': driver_id}
        if ACTIVE_SCHEDULE_ID:
            data['schedule_id'] = ACTIVE_SCHEDULE_ID

        csrf_token = session_cookies.get('csrftoken')
        headers = {'X-CSRFToken': csrf_token, 'Content-Type': 'application/json'}

        response = requests.post(
            session_url, json=data, headers=headers,
            cookies=session_cookies, timeout=10
        )

        if response.status_code == 201:
            result = response.json()
            current_session_id = result.get('session_id')
            session_alert_count = 0
            print(f"✅ Session Started Successfully!")
            print(f"   Session ID: {current_session_id}")
            print(f"   Started At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 70 + "\n")
            return current_session_id
        else:
            print(f"❌ Failed to Start Session: {response.status_code}")
            print(f"   Response: {response.text}")
            print("=" * 70 + "\n")
            return None

    except Exception as e:
        print(f"❌ Session Start Error: {e}")
        print("=" * 70 + "\n")
        return None


def end_monitoring_session():
    global session_cookies, current_session_id, is_logged_in, session_alert_count

    if not is_logged_in or not current_session_id:
        return

    try:
        print("\n" + "=" * 70)
        print("🛑 Ending Monitoring Session...")
        print("=" * 70)

        session_url = f"{DJANGO_URL}/api/drowsiness/sessions/{current_session_id}/end/"
        csrf_token = session_cookies.get('csrftoken')
        headers = {'X-CSRFToken': csrf_token}

        response = requests.post(
            session_url, headers=headers,
            cookies=session_cookies, timeout=10
        )

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Session Ended Successfully!")
            print(f"   Session ID: {current_session_id}")
            print(f"   Duration: {result.get('duration_minutes')} minutes")
            print(f"   Total Alerts: {result.get('total_alerts', session_alert_count)}")
            if result.get('avg_ear'):
                print(f"   Average EAR: {result.get('avg_ear'):.3f}")
            if result.get('min_ear'):
                print(f"   Minimum EAR: {result.get('min_ear'):.3f}")
            print(f"   Ended At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 70 + "\n")
        else:
            print(f"⚠️  Failed to End Session: {response.status_code}")
            print("=" * 70 + "\n")

    except Exception as e:
        print(f"⚠️  Session End Error: {e}")
        print("=" * 70 + "\n")


# ============================================================================
# ALERT MANAGEMENT
# ============================================================================

def send_alert_to_django(ear_value, closure_duration, image_path):
    global session_cookies, driver_id, is_logged_in, session_alert_count

    if not is_logged_in:
        print("⚠️  Not logged in to Django!")
        return False

    try:
        print("\n" + "=" * 70)
        print("📤 Sending Alert to Django Backend...")
        print("=" * 70)

        alert_url = f"{DJANGO_URL}/api/drowsiness/alerts/create/"

        active_driver = get_active_driver()
        if active_driver is None:
            print("⚠️  Alert suppressed — no driver logged in.")
            return False

        data = {
            'driver_id': active_driver['driver_id'],
            'eye_closure_duration': round(closure_duration, 2),
            'ear_value': round(ear_value, 3),
        }
        if ACTIVE_SCHEDULE_ID:
            data['schedule_id'] = ACTIVE_SCHEDULE_ID

        csrf_token = session_cookies.get('csrftoken')
        headers = {'X-CSRFToken': csrf_token}

        files = {}
        if image_path and os.path.exists(image_path):
            try:
                files['snapshot'] = open(image_path, 'rb')
            except Exception as e:
                print(f"⚠️  Could not open image: {e}")

        response = requests.post(
            alert_url, data=data, files=files,
            headers=headers, cookies=session_cookies, timeout=15
        )

        if 'snapshot' in files:
            files['snapshot'].close()

        if response.status_code == 201:
            result = response.json()
            print(f"✅ ALERT SENT SUCCESSFULLY!")
            print(f"   Alert ID:      {result.get('alert_id')}")
            print(f"   Severity:      {result.get('severity')}")
            print(f"   Email Sent:    {'✅ Yes' if result.get('email_sent') else '❌ No'}")
            print(f"   Session Alerts:{session_alert_count}")
            print(f"   Timestamp:     {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 70 + "\n")
            return True
        else:
            print(f"❌ Alert Failed: {response.status_code}")
            print(f"   Response: {response.text}")
            print("=" * 70 + "\n")
            return False

    except Exception as e:
        print(f"❌ Error Sending Alert: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 70 + "\n")
        return False


# ============================================================================
# ALARM FUNCTIONS (COMPUTER)
# ============================================================================

def start_alarm():
    global alarm_on
    if not alarm_on:
        alarm_on = True
        threading.Thread(target=play_alarm, daemon=True).start()


def play_alarm():
    global alarm_on
    while alarm_on:
        try:
            winsound.Beep(1000, 200)
            time.sleep(0.3)
        except Exception:
            print("🔊 ALARM!")
            time.sleep(0.5)


def stop_alarm():
    global alarm_on
    alarm_on = False


# ============================================================================
# PHONE ALARM FUNCTIONS (MACRODROID)
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
    print(f"   Re-trigger interval: {PHONE_ALARM_RETRIGGER_INTERVAL} seconds")
    print(f"   Webhook: {MACRODROID_START_WEBHOOK}")
    print("=" * 70 + "\n")

    phone_alarm_active = True
    phone_alarm_thread = threading.Thread(target=keep_phone_alarm_active, daemon=True)
    phone_alarm_thread.start()
    return True


def trigger_phone_alarm_stop():
    global phone_alarm_active

    if not phone_alarm_active:
        return True

    print("\n" + "=" * 70)
    print("📱 STOPPING CONTINUOUS PHONE ALARM")
    print("=" * 70)

    phone_alarm_active = False
    time.sleep(0.5)

    try:
        response = requests.get(MACRODROID_STOP_WEBHOOK, timeout=2)
        if response.status_code == 200:
            print("✅ Phone alarm stopped successfully")
            print("   🔇 Sound stopped | 💡 Torch OFF")
            print("=" * 70 + "\n")
            return True
        else:
            print(f"⚠️  STOP webhook failed: {response.status_code}")
            print("=" * 70 + "\n")
            return False
    except Exception as e:
        print(f"⚠️  STOP webhook error: {e}")
        print("=" * 70 + "\n")
        return False


def trigger_all_alarms():
    global alarm_on
    print("\n" + "🚨" * 35)
    print("EMERGENCY: TRIGGERING ALL ALARMS")
    print("🚨" * 35 + "\n")

    if not alarm_on:
        start_alarm()
        print("✅ Computer alarm started (beeping)")

    if not phone_alarm_active:
        trigger_phone_alarm_start()

    print("\n" + "🚨" * 35)
    print("ALL ALARMS ACTIVATED!")
    print("🚨" * 35 + "\n")
    set_buzzer_alert(True)


def stop_all_alarms():
    stop_alarm()
    print("✅ Computer alarm stopped")
    trigger_phone_alarm_stop()
    set_buzzer_alert(False)


# ============================================================================
# EYE ASPECT RATIO (EAR) CALCULATION
# ============================================================================

def eye_aspect_ratio(eye_points):
    """
    EAR = (|p1-p5| + |p2-p4|) / (2 * |p0-p3|)

         p1    p2
    p0             p3
         p5    p4
    """
    A = np.linalg.norm(eye_points[1] - eye_points[5])
    B = np.linalg.norm(eye_points[2] - eye_points[4])
    C = np.linalg.norm(eye_points[0] - eye_points[3])
    return (A + B) / (2.0 * C)


# ============================================================================
# MEDIAPIPE LANDMARKS
# ============================================================================

LEFT_EYE  = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]


# ============================================================================
# MACRODROID TEST FUNCTION
# ============================================================================

def test_macrodroid_connection():
    print("\n" + "=" * 70)
    print("🔌 TESTING MACRODROID PHONE ALARM CONNECTION")
    print("=" * 70)

    print("\n1️⃣  Testing START webhook...")
    print(f"   URL: {MACRODROID_START_WEBHOOK}")
    try:
        response = requests.get(MACRODROID_START_WEBHOOK, timeout=5)
        if response.status_code == 200:
            print("   ✅ START WEBHOOK SUCCESSFUL!")
        else:
            print(f"   ⚠️  WARNING: Status code {response.status_code}")
    except Exception as e:
        print(f"   ❌ START WEBHOOK FAILED: {e}")

    print("\n   Waiting 3 seconds...")
    time.sleep(3)

    print("\n   Testing START webhook again (simulating continuous alarm)...")
    try:
        response = requests.get(MACRODROID_START_WEBHOOK, timeout=5)
        if response.status_code == 200:
            print("   ✅ Second trigger successful")
    except Exception:
        pass

    print("\n   Waiting 2 seconds before testing STOP...")
    time.sleep(2)

    print("\n2️⃣  Testing STOP webhook...")
    print(f"   URL: {MACRODROID_STOP_WEBHOOK}")
    try:
        response = requests.get(MACRODROID_STOP_WEBHOOK, timeout=5)
        if response.status_code == 200:
            print("   ✅ STOP WEBHOOK SUCCESSFUL!")
        else:
            print(f"   ⚠️  WARNING: Status code {response.status_code}")
    except Exception as e:
        print(f"   ❌ STOP WEBHOOK FAILED: {e}")

    print("\n" + "=" * 70)
    print("📝 TEST COMPLETE — Press Enter to start drowsiness detection...")
    input()
    return True


# ============================================================================
# EAR CALIBRATION
# ============================================================================

def calibrate_ear_threshold(cap, face_mesh):
    """
    Measure the driver's open-eye EAR for 3 seconds and set
    the detection threshold to 75% of their personal average.
    Returns the calibrated threshold.
    """
    global EAR_THRESHOLD

    print("\n" + "=" * 70)
    print("🔧 EAR CALIBRATION")
    print("=" * 70)
    print("Keep your eyes OPEN and look at the camera for 3 seconds...")
    print("=" * 70)

    ear_samples = []
    calibration_start = time.time()

    while time.time() - calibration_start < 3:
        ret, frame = cap.read()
        if not ret:
            continue

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb_frame)

        if results.multi_face_landmarks:
            landmarks = results.multi_face_landmarks[0]
            h, w, _ = frame.shape

            left_eye = [
                (int(landmarks.landmark[i].x * w),
                 int(landmarks.landmark[i].y * h))
                for i in LEFT_EYE
            ]
            right_eye = [
                (int(landmarks.landmark[i].x * w),
                 int(landmarks.landmark[i].y * h))
                for i in RIGHT_EYE
            ]

            left_ear  = eye_aspect_ratio(np.array(left_eye))
            right_ear = eye_aspect_ratio(np.array(right_eye))
            ear_samples.append((left_ear + right_ear) / 2.0)

        # Countdown overlay
        remaining = 3 - int(time.time() - calibration_start)
        cv2.putText(frame, f"Calibrating... {remaining}s",
                    (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 2)
        cv2.imshow("Drowsiness Detection", frame)
        cv2.waitKey(1)

    if ear_samples:
        avg_open_ear = np.mean(ear_samples)
        EAR_THRESHOLD = avg_open_ear * 0.75
        print(f"✅ Calibration complete!")
        print(f"   Open-eye EAR average : {avg_open_ear:.3f}")
        print(f"   Detection threshold  : {EAR_THRESHOLD:.3f} (75% of open-eye)")
    else:
        print(f"⚠️  Calibration failed — using default threshold: {EAR_THRESHOLD}")

    print("=" * 70 + "\n")
    return EAR_THRESHOLD


# ============================================================================
# MAIN DETECTION LOOP
# ============================================================================

def main():
    global alarm_on, last_alert_time, frame_count, current_session_id, session_alert_count, EAR_THRESHOLD

    print("\n" + "🚗 " * 35)
    print("DROWSINESS DETECTION SYSTEM")
    print("With Django Backend | Session Management | Continuous Phone Alarm")
    print("PERCLOS + Blink Rate + Head Nod Detection")
    print("🚗 " * 35 + "\n")

    print(f"Camera Source:      {CAMERA_SOURCE}")
    print(f"Resolution:         {VIDEO_WIDTH}x{VIDEO_HEIGHT}")
    print(f"EAR Threshold:      {EAR_THRESHOLD} (will be calibrated)")
    print(f"Drowsy Time:        {DROWSY_TIME} seconds")
    print(f"PERCLOS Window:     {PERCLOS_WINDOW} frames")
    print(f"PERCLOS Threshold:  {PERCLOS_THRESHOLD}")
    print(f"Django Backend:     {DJANGO_URL}")
    if ACTIVE_SCHEDULE_ID:
        print(f"Active Schedule ID: {ACTIVE_SCHEDULE_ID}")
    print(f"Phone Alarm Interval: {PHONE_ALARM_RETRIGGER_INTERVAL} seconds")
    print("\n" + "=" * 70 + "\n")

    # Test MacroDroid
    test_macrodroid_connection()

    # -------------------------------------------------------------------------
    # STEP 1: Connect to Django
    # -------------------------------------------------------------------------
    print("STEP 1: Connecting to Django Backend...\n" + "=" * 70)
    django_connected = login_to_django()

    if django_connected:
        print("✅ Django Backend Connected!")
    else:
        print("⚠️  Django Backend Not Connected — running in OFFLINE MODE")
        response = input("   Continue anyway? (y/n): ")
        if response.lower() != 'y':
            print("\n   Exiting...")
            return

    # -------------------------------------------------------------------------
    # STEP 1.5: Start Monitoring Session
    # -------------------------------------------------------------------------
    if django_connected:
        start_monitoring_session()

    # -------------------------------------------------------------------------
    # STEP 2: Initialize MediaPipe
    # -------------------------------------------------------------------------
    print("\nSTEP 2: Initializing Detection System...")
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    print("   ✅ MediaPipe Face Mesh initialized")

    # -------------------------------------------------------------------------
    # STEP 3: Open Camera
    # -------------------------------------------------------------------------
    print(f"\nSTEP 3: Opening camera: {CAMERA_SOURCE}")
    cap = cv2.VideoCapture(CAMERA_SOURCE)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, VIDEO_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, VIDEO_HEIGHT)

    if not cap.isOpened():
        print("❌ ERROR: Could not open camera!")
        print("   Check IP Webcam app is running and CAMERA_SOURCE is correct.")
        return

    print("   ✅ Camera opened successfully!")

    # -------------------------------------------------------------------------
    # STEP 4: Calibrate EAR threshold
    # -------------------------------------------------------------------------
    EAR_THRESHOLD = calibrate_ear_threshold(cap, face_mesh)

    os.makedirs("drowsiness_snapshots", exist_ok=True)

    print("\n" + "=" * 70)
    print("✅ SYSTEM READY — Press ESC to exit")
    print("=" * 70 + "\n")

    # =========================================================================
    # DETECTION LOOP STATE
    # =========================================================================
    eye_close_start   = None
    alarm_triggered   = False

    # PERCLOS
    ear_history = []

    # Blink rate
    last_eye_state    = "open"
    blink_timestamps  = []

    # FPS
    fps_start_time    = time.time()
    fps_frame_count   = 0
    current_fps       = 0

    # =========================================================================
    # MAIN LOOP
    # =========================================================================
    while True:
        ret, frame = cap.read()

        if not ret:
            print("❌ Failed to read frame from camera")
            break

        frame_count += 1
        if frame_count % FRAME_SKIP != 0:
            continue

        # FPS tracking
        fps_frame_count += 1
        if fps_frame_count >= 30:
            current_fps   = fps_frame_count / (time.time() - fps_start_time)
            fps_start_time = time.time()
            fps_frame_count = 0

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results   = face_mesh.process(rgb_frame)

        h, w, _   = frame.shape
        emergency = False
        current_ear = 0.0
        perclos     = 0.0
        closure_duration = 0.0

        # ---------------------------------------------------------------------
        # FACE DETECTED
        # ---------------------------------------------------------------------
        if results.multi_face_landmarks:
            landmarks = results.multi_face_landmarks[0]

            # — Extract eye coordinates —
            left_eye  = []
            right_eye = []

            for idx in LEFT_EYE:
                x = int(landmarks.landmark[idx].x * w)
                y = int(landmarks.landmark[idx].y * h)
                left_eye.append((x, y))
                cv2.circle(frame, (x, y), 2, (0, 255, 0), -1)

            for idx in RIGHT_EYE:
                x = int(landmarks.landmark[idx].x * w)
                y = int(landmarks.landmark[idx].y * h)
                right_eye.append((x, y))
                cv2.circle(frame, (x, y), 2, (0, 255, 0), -1)

            # — Calculate EAR —
            left_ear    = eye_aspect_ratio(np.array(left_eye))
            right_ear   = eye_aspect_ratio(np.array(right_eye))
            current_ear = (left_ear + right_ear) / 2.0

            # — PERCLOS (rolling window) —
            ear_history.append(current_ear < EAR_THRESHOLD)
            if len(ear_history) > PERCLOS_WINDOW:
                ear_history.pop(0)
            perclos = sum(ear_history) / len(ear_history) if ear_history else 0.0

            # — Blink rate —
            current_eye_state = "closed" if current_ear < EAR_THRESHOLD else "open"
            if last_eye_state == "open" and current_eye_state == "closed":
                blink_timestamps.append(time.time())
            last_eye_state = current_eye_state
            blink_timestamps = [t for t in blink_timestamps
                                 if time.time() - t < BLINK_RATE_WINDOW]
            blink_rate = len(blink_timestamps)

            # — Head nod detection —
            nose_tip  = landmarks.landmark[1]
            chin      = landmarks.landmark[152]
            forehead  = landmarks.landmark[10]
            face_height = chin.y - forehead.y
            nose_ratio  = ((nose_tip.y - forehead.y) / face_height
                           if face_height > 0 else 0.5)
            head_nodding = nose_ratio > 0.70

            # — Eye closure timer —
            if current_ear < EAR_THRESHOLD:
                if eye_close_start is None:
                    eye_close_start = time.time()
                closure_duration = time.time() - eye_close_start   # Every frame

                # Trigger emergency if time-based OR PERCLOS threshold exceeded
                perclos_ready = len(ear_history) >= PERCLOS_WINDOW
                if closure_duration >= DROWSY_TIME or (perclos_ready and perclos > PERCLOS_THRESHOLD):
                    emergency = True
            else:
                # Eyes open — reset everything for next episode
                if eye_close_start is not None:
                    print(f"✓ Eyes reopened after {time.time() - eye_close_start:.1f}s")
                    eye_close_start = None
                    closure_duration = 0.0
                    ear_history.clear()       # ← ADDED
                    blink_timestamps.clear()  # ← ADDED
                    if alarm_on or phone_alarm_active:
                        stop_all_alarms()
                    alarm_triggered = False

            # — Drowsiness UI overlay —
            if emergency and get_active_driver() is not None:
                overlay = frame.copy()
                cv2.rectangle(overlay, (0, 0), (w, 120), (0, 0, 255), -1)
                frame = cv2.addWeighted(overlay, 0.4, frame, 0.6, 0)

                text      = "DROWSINESS DETECTED!"
                text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1.2, 3)[0]
                cv2.putText(frame, text,
                            ((w - text_size[0]) // 2, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 3)

                dur_text = f"Eyes Closed: {closure_duration:.1f}s  |  PERCLOS: {perclos:.2f}"
                dur_size = cv2.getTextSize(dur_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
                cv2.putText(frame, dur_text,
                            ((w - dur_size[0]) // 2, 100),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

            # — Head nod warning —
            if head_nodding and not emergency:
                cv2.putText(frame, " HEAD NOD DETECTED",
                            (10, 70), cv2.FONT_HERSHEY_SIMPLEX,
                            0.8, (0, 165, 255), 2)

            # — Abnormal blink rate warning —
            if blink_rate < 10 or blink_rate > 30:
                blink_color = (0, 165, 255)
                cv2.putText(frame,
                            f" BLINK RATE: {blink_rate}/min",
                            (10, 100 if not head_nodding else 130),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, blink_color, 2)

        # ---------------------------------------------------------------------
        # FACE NOT DETECTED — reset to be safe
        # ---------------------------------------------------------------------
        else:
            if eye_close_start is not None:
                print("⚠️  Face lost — resetting eye timer")
                eye_close_start = None
            ear_history.clear()       # ← ADDED
            blink_timestamps.clear()  # ← ADDED
            if alarm_on or phone_alarm_active:
                stop_all_alarms()
            alarm_triggered = False
            cv2.putText(frame, "NO FACE DETECTED",
                        (10, 70), cv2.FONT_HERSHEY_SIMPLEX,
                        0.8, (0, 165, 255), 2)

        # ---------------------------------------------------------------------
        # HUD — metrics
        # ---------------------------------------------------------------------
        cv2.putText(frame, f"EAR: {current_ear:.3f}",
                    (w - 180, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(frame, f"PERCLOS: {perclos:.2f}",
                    (w - 180, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
        cv2.putText(frame, f"FPS: {current_fps:.1f}",
                    (w - 180, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        status_color = (0, 0, 255) if emergency else (0, 255, 0)
        status_text  = "ALERT" if emergency else "NORMAL"
        cv2.rectangle(frame, (10, 10), (130, 40), status_color, -1)
        cv2.putText(frame, status_text,
                    (15, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        # ---------------------------------------------------------------------
        # HANDLE DROWSINESS EMERGENCY
        # ---------------------------------------------------------------------
        # ====================================================================
# HANDLE DROWSINESS EMERGENCY
# ====================================================================
        if emergency:
            active_driver = get_active_driver()

            if active_driver is None:
                if alarm_on or phone_alarm_active:
                    stop_all_alarms()
                alarm_triggered = False
            else:
                # Trigger alarms ONCE per drowsy episode
                if not alarm_triggered:
                    trigger_all_alarms()
                    alarm_triggered = True

                    # Send alert ONCE per drowsy episode (not on cooldown loop)
                    session_alert_count += 1
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    image_filename = f"drowsiness_snapshots/alert_{timestamp}.jpg"
                    cv2.imwrite(image_filename, frame)

                    print("\n" + "🚨 " * 35)
                    print("DROWSINESS ALERT TRIGGERED!")
                    print("🚨 " * 35)
                    print(f"Time:             {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                    print(f"EAR Value:        {current_ear:.3f}")
                    print(f"Closure Duration: {closure_duration:.1f} seconds")
                    print(f"PERCLOS:          {perclos:.2f}")
                    print(f"Snapshot:         {image_filename}")
                    print(f"Session Alerts:   {session_alert_count}")

                    if is_logged_in:
                        threading.Thread(
                            target=send_alert_to_django,
                            args=(current_ear, closure_duration, image_filename),
                            daemon=True
                        ).start()
                    else:
                        print("⚠️  Offline mode — alert saved locally only")
                        print("=" * 70 + "\n")

                    last_alert_time = time.time()

        # ---------------------------------------------------------------------
        # DISPLAY
        # ---------------------------------------------------------------------
        cv2.imshow("Drowsiness Detection", frame)
        if cv2.waitKey(1) & 0xFF == 27:   # ESC
            print("\n👋 Exiting...")
            break

    # =========================================================================
    # CLEANUP
    # =========================================================================
    print("\n🧹 Cleaning up...")
    if is_logged_in and current_session_id:
        end_monitoring_session()
    stop_all_alarms()
    cap.release()
    cv2.destroyAllWindows()
    face_mesh.close()
    print("✅ Cleanup complete!")
    print(f"\nSession Summary: {session_alert_count} alert(s) detected")
    print("=" * 70 + "\n")


# ============================================================================
# ENTRY POINT
# ============================================================================
if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  System interrupted by user")
        if is_logged_in and current_session_id:
            end_monitoring_session()
        stop_all_alarms()
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        import traceback
        traceback.print_exc()
        if is_logged_in and current_session_id:
            end_monitoring_session()
        stop_all_alarms()