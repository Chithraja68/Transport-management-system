"""
gps_monitor.py  (v2 — reads from sensor_data.json)
===================================================
NO LONGER opens the serial port directly.
Reads GPS values from sensor_data.json written by serial_reader.py.

Start order:
    1. python serial_reader.py --port COM6    ← opens serial port
    2. python alcohol_monitor.py              ← reads sensor_data.json
    3. python gps_monitor.py                  ← reads sensor_data.json (this file)

What this script does:
    • Reads LATITUDE/LONGITUDE from sensor_data.json
    • Skips zero-coordinate readings (no GPS fix yet)
    • Detects indoor / weak signal (< 4 satellites)
    • POSTs location to Django → /api/transport/gps/update/  every 5s
    • Prints a live dashboard of coordinates + satellite count
"""

import time
import sys
import json
import os
import requests
from session_manager import get_active_driver

# ==============================================================================
# LOAD DRIVER SESSION
# ==============================================================================

CONFIG_FILE = 'drowsiness_login.json'
SHARED_FILE = 'sensor_data.json'

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

    if not config.get('logged_in', False):
        print("\n" + "=" * 70)
        print("❌  ERROR: Driver is not logged in!")
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

DJANGO_URL          = config.get('django_url', 'http://127.0.0.1:8000')
ACTIVE_SCHEDULE_ID  = config.get('active_schedule_id')
DRIVER_USERNAME     = config.get('driver_username')
DRIVER_PASSWORD     = config.get('driver_password')
GPS_UPDATE_ENDPOINT = f"{DJANGO_URL}/api/transport/gps/update/"

UPDATE_INTERVAL_SEC         = 5
POLL_INTERVAL               = 1.0
STALE_TIMEOUT               = 10.0
MIN_SATELLITES_FOR_RELIABLE = 4
STALE_FIX_THRESHOLD         = 10

# ==============================================================================
# CONSOLE COLOURS  (defined before any print that uses them)
# ==============================================================================

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# ==============================================================================
# DJANGO AUTH TOKEN
# ==============================================================================

AUTH_TOKEN = None

def get_auth_token():
    """Login to Django REST API and get the auth token."""
    global AUTH_TOKEN
    login_url = f"{DJANGO_URL}/api/accounts/login/"
    try:
        resp = requests.post(login_url, json={
            'username': DRIVER_USERNAME,
            'password': DRIVER_PASSWORD,
        }, timeout=5)

        if resp.status_code == 200:
            data  = resp.json()
            token = (data.get('token') or
                     data.get('access') or
                     data.get('access_token') or
                     data.get('key'))
            if token:
                AUTH_TOKEN = token
                print(f"  {GREEN}✅  Django auth token obtained.{RESET}")
                return True
            else:
                print(f"  ⚠️  Login OK but no token found: {data}")
                return False
        else:
            print(f"  ⚠️  Django login failed {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"  ⚠️  Could not reach Django for login: {e}")
        return False

# ==============================================================================
# STARTUP PRINT + LOGIN
# ==============================================================================

print("\n" + "=" * 65)
print("✅  DRIVER SESSION LOADED — GPS Monitor")
print("=" * 65)
print(f"Driver Name     : {config.get('driver_name')}")
print(f"Driver ID       : {driver_id}")
print(f"Username        : {DRIVER_USERNAME}")
print(f"Schedule ID     : {ACTIVE_SCHEDULE_ID or 'No schedule selected'}")
print(f"Schedule Name   : {config.get('active_schedule_name') or 'None'}")
print(f"Django URL      : {DJANGO_URL}")
print(f"GPS Endpoint    : {GPS_UPDATE_ENDPOINT}")
print(f"Update Interval : every {UPDATE_INTERVAL_SEC} s")
print(f"Login Time      : {config.get('login_time')}")
print(f"Reads from      : {SHARED_FILE}  (written by serial_reader.py)")
print("=" * 65 + "\n")

print("  🔐 Logging into Django API...")
get_auth_token()

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
# INDOOR / POOR-SIGNAL DETECTION
# ==============================================================================

def classify_signal(lat, lng, satellites, prev_lat, prev_lng, stale_count):
    if lat == 0.0 and lng == 0.0:
        return False, "No GPS fix (0,0 coordinates)", "❌ NO FIX"

    if satellites < MIN_SATELLITES_FOR_RELIABLE:
        label  = f"⚠️  INDOOR / WEAK ({satellites} sat)"
        reason = (f"Only {satellites} satellite(s) visible "
                  f"(need ≥ {MIN_SATELLITES_FOR_RELIABLE}). "
                  f"You may be indoors or near a building.")
        return False, reason, label

    if (prev_lat is not None and
            lat == prev_lat and lng == prev_lng and
            stale_count >= STALE_FIX_THRESHOLD):
        label  = f"⚠️  STALE FIX ({stale_count} same readings)"
        reason = (f"Coordinates unchanged for {stale_count} readings. "
                  f"Fix may be frozen — possibly indoors.")
        return False, reason, label

    quality = ("🟢 EXCELLENT" if satellites >= 8 else
               "🟡 GOOD"      if satellites >= 6 else
               "🟠 FAIR")
    return True, "Outdoor fix", quality

# ==============================================================================
# DJANGO GPS POST
# ==============================================================================

def post_gps_to_django(lat, lng, satellites):
    if not ACTIVE_SCHEDULE_ID:
        return False

    payload = {
        'schedule_id':    ACTIVE_SCHEDULE_ID,
        'latitude':       round(lat, 6),
        'longitude':      round(lng, 6),
        'speed':          0.0,
        'heading':        0.0,
        'accuracy':       10,
        'is_moving':      False,
        'battery_level':  100,
        'is_gps_enabled': True,
        'device_type':    'GPS_HARDWARE',
    }
    active_driver = get_active_driver()
    if active_driver:
        payload['driver_id'] = active_driver['driver_id']

    try:
        headers = {}
        if AUTH_TOKEN:
            headers['Authorization'] = f'Token {AUTH_TOKEN}'

        resp = requests.post(GPS_UPDATE_ENDPOINT, json=payload,
                             headers=headers, timeout=5)

        # Token expired — re-login and retry once
        if resp.status_code in (401, 403):
            print("\n  🔄 Token expired, re-logging in...")
            if get_auth_token():
                headers['Authorization'] = f'Token {AUTH_TOKEN}'
                resp = requests.post(GPS_UPDATE_ENDPOINT, json=payload,
                                     headers=headers, timeout=5)

        if resp.status_code in (200, 201):
            return True
        else:
            print(f"\n  ⚠️  Django GPS returned {resp.status_code}: {resp.text[:150]}")
            return False

    except requests.exceptions.ConnectionError:
        print("\n  ⚠️  Cannot reach Django GPS endpoint. Is Django running?")
        return False
    except Exception as e:
        print(f"\n  ⚠️  GPS post error: {e}")
        return False

# ==============================================================================
# MAIN LOOP
# ==============================================================================

def run():
    print(f"\n{'='*60}")
    print(f"  🛰️  GPS Monitor  (reads from {SHARED_FILE})")
    print(f"  Schedule ID   : {ACTIVE_SCHEDULE_ID or '⚠️  None — updates will be skipped'}")
    print(f"  Django        : {GPS_UPDATE_ENDPOINT}")
    print(f"  Driver        : {config.get('driver_name')} (ID: {driver_id or 'not linked'})")
    print(f"  Update every  : {UPDATE_INTERVAL_SEC} s")
    print(f"{'='*60}\n")

    if not ACTIVE_SCHEDULE_ID:
        print(f"  {YELLOW}⚠️  WARNING: No active schedule — GPS will display but NOT post to Django.{RESET}\n")

    # Wait for serial_reader.py to create sensor_data.json
    print("  ⏳ Waiting for serial_reader.py to start...", end='', flush=True)
    while not os.path.exists(SHARED_FILE):
        time.sleep(0.5)
        print(".", end='', flush=True)
    print(f"\n  {GREEN}✅  sensor_data.json found!{RESET}\n")

    last_post_time  = 0
    last_lat        = None
    last_lng        = None
    stale_count     = 0
    fix_count       = 0
    no_fix_count    = 0
    indoor_count    = 0
    total_posts     = 0
    failed_posts    = 0
    last_was_indoor = False

    while True:
        try:
            try:
                with open(CONFIG_FILE, 'r') as f:
                    current_session = json.load(f)
                if not current_session.get('logged_in', False):
                    print(f"\n\n  {RED}🔴  Driver logged out — GPS updates stopped.{RESET}")
                    print(f"  Run: python web_login.py to log in again.\n")
                    sys.exit(0)
            except (FileNotFoundError, json.JSONDecodeError):
                print(f"\n\n  {RED}🔴  Session file missing or unreadable — stopping GPS.{RESET}\n")
                sys.exit(1)
            data = read_shared()

            # ── serial_reader.py not running ──────────────────────────
            if data is None:
                print("\r  ⚠  sensor_data.json unreadable — is serial_reader.py running?  ", end='', flush=True)
                time.sleep(1)
                continue

            if not data.get('reader_alive', False):
                print("\r  ⚠  serial_reader.py stopped! Please restart it.                 ", end='', flush=True)
                time.sleep(2)
                continue

            lat  = data.get('latitude')
            lng  = data.get('longitude')
            sats = data.get('satellites', 0)
            ts   = data.get('gps_timestamp')

            if lat is None or ts is None:
                print("\r  ⏳ Waiting for GPS data...                                       ", end='', flush=True)
                time.sleep(1)
                continue

            if time.time() - ts > STALE_TIMEOUT:
                print("\r  ⚠  GPS data stale — ESP32 may be disconnected.                  ", end='', flush=True)
                time.sleep(1)
                continue

            # ── Stale coordinate tracking ─────────────────────────────
            if lat == last_lat and lng == last_lng and lat != 0.0:
                stale_count += 1
            else:
                stale_count = 0

            is_reliable, reason, quality_label = classify_signal(
                lat, lng, sats, last_lat, last_lng, stale_count
            )

            # ── No fix (0,0) ──────────────────────────────────────────
            if lat == 0.0 and lng == 0.0:
                no_fix_count += 1
                if no_fix_count == 1 or no_fix_count % 10 == 0:
                    print(
                        f"\r  📡 Waiting for GPS fix...  "
                        f"Satellites: {sats}  "
                        f"(attempt {no_fix_count})          ",
                        end='', flush=True
                    )
                last_was_indoor = False
                time.sleep(POLL_INTERVAL)
                continue

            # ── Unreliable fix (indoor / stale) ───────────────────────
            if not is_reliable:
                indoor_count += 1
                no_fix_count  = 0

                if not last_was_indoor or indoor_count % 5 == 0:
                    print(f"\n\n  {YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}")
                    print(f"  {YELLOW}{BOLD}⚠️  GPS UNRELIABLE — NOT POSTING TO DJANGO{RESET}")
                    print(f"  {YELLOW}Reason : {reason}{RESET}")
                    print(f"  {YELLOW}Signal : {quality_label}{RESET}")
                    print(f"  {YELLOW}Tip    : Move outdoors or near a window.{RESET}")
                    print(f"  {YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}\n")

                print(
                    f"\r  {YELLOW}Lat: {lat:11.6f}  "
                    f"Lng: {lng:11.6f}  "
                    f"Sats: {sats:2d}  "
                    f"{quality_label}  [skipped]{RESET}          ",
                    end='', flush=True
                )

                last_was_indoor = True
                last_lat = lat
                last_lng = lng
                time.sleep(POLL_INTERVAL)
                continue

            # ── Reliable outdoor fix ───────────────────────────────────
            no_fix_count  = 0
            indoor_count  = 0
            fix_count    += 1

            if last_was_indoor:
                print(f"\n\n  {GREEN}✅  GPS signal recovered — outdoor fix.{RESET}\n")
            last_was_indoor = False
            last_lat = lat
            last_lng = lng

            now         = time.time()
            should_post = (now - last_post_time) >= UPDATE_INTERVAL_SEC

            if should_post and ACTIVE_SCHEDULE_ID:
                ok = post_gps_to_django(lat, lng, sats)
                last_post_time = now
                total_posts   += 1
                if not ok:
                    failed_posts += 1

            post_status = (
                f"{GREEN}✓ posted{RESET}"     if (should_post and ACTIVE_SCHEDULE_ID) else
                f"{YELLOW}no schedule{RESET}" if not ACTIVE_SCHEDULE_ID else
                "queued"
            )

            print(
                f"\r  🛰️  Lat: {BOLD}{lat:11.6f}{RESET}  "
                f"Lng: {BOLD}{lng:11.6f}{RESET}  "
                f"Sats: {sats:2d}  "
                f"{quality_label}  "
                f"Fix#: {fix_count:5d}  "
                f"Posts: {total_posts}  "
                f"[{post_status}]   ",
                end='', flush=True
            )

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            print("\n\n  Stopped by user.")
            if last_lat:
                print(f"  Last known position : {last_lat:.6f}, {last_lng:.6f}")
            print(f"  Total GPS fixes     : {fix_count}")
            print(f"  Total posts         : {total_posts}  (failed: {failed_posts})")
            sys.exit(0)

# ==============================================================================
# ENTRY POINT
# ==============================================================================

if __name__ == '__main__':
    run()