"""
alcohol_monitor.py  (v2 — reads from sensor_data.json)
=======================================================
NO LONGER opens the serial port directly.
Reads alcohol values from sensor_data.json written by serial_reader.py.

Start order:
    1. python serial_reader.py --port COM6    ← opens serial port
    2. python alcohol_monitor.py              ← reads sensor_data.json
    3. python gps_monitor.py                  ← reads sensor_data.json

When alcohol is detected (CONFIRM_COUNT consecutive readings ≥ THRESHOLD):
    • Plays laptop beep alarm
    • Triggers phone alarm via Macrodroid webhook
    • POSTs alert to Django  →  /api/alcohol/alert/
    • Writes buzzer state to buzzer_state.json (serial_reader.py activates buzzer)
"""

import time
import sys
import json
import os
import threading
import requests
from datetime import datetime
from config import THRESHOLD
from session_manager import get_active_driver
# ==============================================================================
# LOAD DRIVER SESSION
# ==============================================================================

CONFIG_FILE       = 'drowsiness_login.json'
SHARED_FILE       = 'sensor_data.json'
BUZZER_STATE_FILE = 'buzzer_state.json'

ALCOHOL_STATUS_FILE = os.path.join(os.path.dirname(__file__), 'alcohol_sensor_status.json')

def write_sensor_status(sensor_value):
    status = {
        'ready': True,
        'sensor_value': round(sensor_value, 4),
        'alcohol_detected': sensor_value >= THRESHOLD,  # ✅ USE SAME THRESHOLD
        'timestamp': datetime.now().isoformat(),
    }
    with open(ALCOHOL_STATUS_FILE, 'w') as f:
        json.dump(status, f)
def load_driver_from_session():
    if not os.path.exists(CONFIG_FILE):
        print("\n" + "=" * 70)
        print("❌  ERROR: Driver session not found!")
        print("=" * 70)
        print(f"\n   Config file '{CONFIG_FILE}' does not exist.")
        print("\n   ➤  STEP 1: python web_login.py")
        print("   ➤  STEP 2: Open browser → http://localhost:5000")
        print("   ➤  STEP 3: Enter driver credentials & select schedule")
        print("   ➤  STEP 4: Run this script again")
        print("\n" + "=" * 70 + "\n")
        sys.exit(1)

    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
    except Exception as e:
        print(f"\n❌  Failed to read {CONFIG_FILE}: {e}")
        sys.exit(1)

    if not config.get("driver_id"):
        print("\n" + "=" * 70)
        print("❌ Login required (driver not found)")
        print("=" * 70)
        print(f"\n   Found '{CONFIG_FILE}' but 'logged_in' is False.")
        print("\n   ➤  Run: python web_login.py")
        print("   ➤  Open: http://localhost:5000")
        print("   ➤  Login and select a schedule, then run this script again.")
        print("\n" + "=" * 70 + "\n")
        sys.exit(1)

    return config
config    = load_driver_from_session()
driver_id = config.get('driver_id')




# ==============================================================================
# CONFIGURATION
# ==============================================================================

DJANGO_URL         = config.get('django_url', 'http://127.0.0.1:8000')
DRIVER_USERNAME    = config.get('driver_username')
DRIVER_PASSWORD    = config.get('driver_password')
ACTIVE_SCHEDULE_ID = config.get('active_schedule_id')
ALERT_ENDPOINT     = f"{DJANGO_URL}/api/alcohol/alert/"


CONFIRM_COUNT = 3
COOLDOWN_SEC  = 30
POLL_INTERVAL = 0.3
STALE_TIMEOUT = 5.0

MACRODROID_START_WEBHOOK = config.get(
    'macrodroid_start_webhook',
    'https://trigger.macrodroid.com/468a0479-a635-41ae-8271-1f994889e127/alarm_start'
)
MACRODROID_STOP_WEBHOOK = config.get(
    'macrodroid_stop_webhook',
    'https://trigger.macrodroid.com/468a0479-a635-41ae-8271-1f994889e127/alarm_stop'
)

print("\n" + "=" * 65)
print("✅  DRIVER SESSION LOADED — Alcohol Monitor")
print("=" * 65)
print(f"Driver Name  : {config.get('driver_name')}")
print(f"Driver ID    : {driver_id}")
print(f"Username     : {DRIVER_USERNAME}")
print(f"Schedule     : {config.get('active_schedule_name') or 'No schedule selected'}")
print(f"Django URL   : {DJANGO_URL}")
print(f"Login Time   : {config.get('login_time')}")
print(f"Threshold    : {THRESHOLD}")
print(f"Reads from   : {SHARED_FILE}  (written by serial_reader.py)")
print("=" * 65 + "\n")

# ==============================================================================
# BUZZER HELPER
# ==============================================================================

def set_buzzer_alert(active: bool):
    """Write alcohol alert state to buzzer_state.json."""
    state = {}
    if os.path.exists(BUZZER_STATE_FILE):
        try:
            with open(BUZZER_STATE_FILE, 'r') as f:
                state = json.load(f)
        except Exception:
            state = {}
    state['alcohol'] = active
    try:
        with open(BUZZER_STATE_FILE, 'w') as f:
            json.dump(state, f)
    except Exception as e:
        print(f"  ⚠  Could not write buzzer state: {e}")

# ==============================================================================
# SHARED FILE READER
# ==============================================================================

def read_shared():
    try:
        with open(SHARED_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None

# ==============================================================================
# PHONE ALARM
# ==============================================================================

phone_alarm_active = False
phone_alarm_thread = None

def _phone_alarm_loop():
    global phone_alarm_active
    while phone_alarm_active:
        try:
            requests.get(MACRODROID_START_WEBHOOK, timeout=3)
        except Exception:
            pass
        time.sleep(2)

def start_phone_alarm():
    global phone_alarm_active, phone_alarm_thread
    if phone_alarm_active:
        return
    phone_alarm_active = True
    phone_alarm_thread = threading.Thread(target=_phone_alarm_loop, daemon=True)
    phone_alarm_thread.start()
    print("📱 Phone alarm started")

def stop_phone_alarm():
    global phone_alarm_active
    phone_alarm_active = False
    try:
        requests.get(MACRODROID_STOP_WEBHOOK, timeout=3)
        print("📱 Phone alarm stopped")
    except Exception:
        pass

# ==============================================================================
# LAPTOP BEEP
# ==============================================================================

def beep():
    if sys.platform == "win32":
        import winsound
        winsound.Beep(1000, 400)
    else:
        sys.stdout.write("\a")
        sys.stdout.flush()

class BeepThread(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self._active = threading.Event()
        self._stop   = threading.Event()

    def run(self):
        while not self._stop.is_set():
            if self._active.is_set():
                beep()
                time.sleep(0.7)
            else:
                time.sleep(0.1)

    def start_alarm(self): self._active.set()
    def stop_alarm(self):  self._active.clear()
    def shutdown(self):    self._stop.set()

def trigger_all_alarms(bt):
    bt.start_alarm()
    start_phone_alarm()
    set_buzzer_alert(True)

def stop_all_alarms(bt):
    bt.stop_alarm()
    stop_phone_alarm()
    set_buzzer_alert(False)

# ==============================================================================
# DJANGO ALERT POST
# ==============================================================================

def post_alert_to_django(sensor_value: int, alert_context: str, lat=None, lng=None):
    """
    Posts alert only if a driver is currently logged in.
    Reads driver_id fresh every call — never uses a cached value.
    """
    driver = get_active_driver()

    if driver is None:
        print("\n⚠️  No driver logged in — alert suppressed.")
        return

    payload = {
        'sensor_value':  sensor_value,
        'threshold':     THRESHOLD,
        'driver_id':     driver['driver_id'],   # live lookup, never stale
        'alert_context': alert_context,          # LOGIN or DRIVING
    }
    if lat is not None:
        payload['latitude']  = lat
        payload['longitude'] = lng

    try:
        resp = requests.post(ALERT_ENDPOINT, json=payload, timeout=5)
        if resp.status_code == 201:
            data = resp.json()
            print(f"\n✅ Alert saved — ID: {data.get('alert_id')} | Email: {data.get('email_sent')}")
        else:
            print(f"\n⚠️  Django returned {resp.status_code}: {resp.text[:200]}")
    except requests.exceptions.ConnectionError:
        print("\n⚠️  Cannot reach Django. Is it running?")
    except Exception as e:
        print(f"\n⚠️  Error posting alert: {e}")

def _get_alert_context():
    """
    LOGIN  → driver is in the login phase (logged_in but no schedule active yet)
    DRIVING → driver has an active schedule
    """
    if not os.path.exists('drowsiness_login.json'):
        return 'DRIVING'
    try:
        with open('drowsiness_login.json', 'r') as f:
            cfg = json.load(f)
        return 'LOGIN' if not cfg.get('active_schedule_id') else 'DRIVING'
    except Exception:
        return 'DRIVING'
# ==============================================================================
# CONSOLE COLOURS
# ==============================================================================

RED   = "\033[91m"
GREEN = "\033[92m"
BOLD  = "\033[1m"
RESET = "\033[0m"

ALARM_BANNER = f"""
{RED}{BOLD}
╔══════════════════════════════════════════════════════════╗
║   🍺  ALCOHOL DETECTED — DRIVER UNFIT TO DRIVE  🍺       ║
║         Alert sent to admin dashboard + email!           ║
╚══════════════════════════════════════════════════════════╝
{RESET}"""

CLEAR_BANNER = f"{GREEN}{BOLD}✅  Clear — No alcohol detected.{RESET}"

# ==============================================================================
# MAIN LOOP
# ==============================================================================

def run():
    print(f"\n{'='*60}")
    print(f"  🍺 Alcohol Monitor  (reads from {SHARED_FILE})")
    print(f"  Threshold  : {THRESHOLD}")
    print(f"  Confirm    : {CONFIRM_COUNT} consecutive readings")
    print(f"  Django     : {ALERT_ENDPOINT}")
    print(f"  Driver     : {config.get('driver_name')} (ID: {driver_id or 'not linked'})")
    print(f"{'='*60}\n")

    # Wait for serial_reader.py to create the shared file
    print("  ⏳ Waiting for serial_reader.py to start...", end='', flush=True)
    while not os.path.exists(SHARED_FILE):
        time.sleep(0.5)
        print(".", end='', flush=True)
    print(f"\n  {GREEN}✅  sensor_data.json found!{RESET}\n")

    beep_thread = BeepThread()
    beep_thread.start()

    consecutive    = 0
    alarm_active   = False
    last_post_time = 0
    last_value     = None

    while True:
        try:
            data = read_shared()

            if data is None:
                print("\r  ⚠  sensor_data.json unreadable — is serial_reader.py running?  ", end='', flush=True)
                time.sleep(1)
                continue

            if not data.get('reader_alive', False):
                print("\r  ⚠  serial_reader.py stopped! Please restart it.                 ", end='', flush=True)
                stop_all_alarms(beep_thread)
                alarm_active = False
                consecutive  = 0
                time.sleep(2)
                continue

            if not data.get('warmup_done', True):
                print("\r  🔥 MQ3 warming up... please wait 60 seconds.                    ", end='', flush=True)
                time.sleep(1)
                continue

            value = data.get('alcohol_value')
            ts    = data.get('alcohol_timestamp')
            lat   = data.get('latitude')
            lng   = data.get('longitude')

            if value is None or ts is None:
                print("\r  ⏳ Waiting for alcohol sensor data...                            ", end='', flush=True)
                time.sleep(0.5)
                continue

            if time.time() - ts > STALE_TIMEOUT:
                print("\r  ⚠  Alcohol data stale — ESP32 may be disconnected.              ", end='', flush=True)
                time.sleep(1)
                continue

            if value == last_value:
                time.sleep(POLL_INTERVAL)
                continue
            last_value = value
            write_sensor_status(value)
            detected = value >= THRESHOLD
            consecutive = consecutive + 1 if detected else 0

            bar_fill = min(int(value / 4095 * 30), 30)
            bar      = '█' * bar_fill + '░' * (30 - bar_fill)
            color    = RED if detected else GREEN
            label    = '⚠  DETECTED' if detected else '✓  NORMAL  '
            print(
                f"\r  Value: {BOLD}{value:4d}{RESET}  "
                f"[{color}{bar}{RESET}]  "
                f"{color}{label}{RESET}  "
                f"(consec: {consecutive}/{CONFIRM_COUNT})",
                end='', flush=True
            )

            should_alarm = consecutive >= CONFIRM_COUNT

            if should_alarm and not alarm_active:
                alarm_active = True
                trigger_all_alarms(beep_thread)
                print(ALARM_BANNER)
                now = time.time()
                if now - last_post_time > COOLDOWN_SEC:
                    last_post_time = now
                    ctx = _get_alert_context()
                    threading.Thread(
                        target=post_alert_to_django,
                        args=(value,ctx, lat, lng),
                        daemon=True
                    ).start()

            elif not should_alarm and alarm_active:
                alarm_active = False
                stop_all_alarms(beep_thread)
                print(f"\n\n  {CLEAR_BANNER}\n")

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            print("\n\n  Stopped by user.")
            stop_all_alarms(beep_thread)
            beep_thread.shutdown()
            sys.exit(0)

# ==============================================================================
# ENTRY POINT
# ==============================================================================

if __name__ == '__main__':
    run()