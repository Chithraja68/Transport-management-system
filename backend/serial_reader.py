"""
serial_reader.py  (v2 — with integrated buzzer control)
========================================================
Central serial reader for the ESP32 (alcohol_gps_buzzer.ino).

Responsibilities:
  1. Reads ALL sensor lines from ESP32 → writes to sensor_data.json
  2. Watches buzzer_state.json (written by all 3 monitors)
  3. Sends BUZZER:ON / BUZZER:OFF commands back to ESP32 over the same port

This is the ONLY script that opens the serial port.
All other monitors read/write JSON files only.

Architecture:
    ┌──────────────────────────────────────────────────────────┐
    │  ESP32 (alcohol_gps_buzzer.ino)                          │
    │   • Sends:  ALCOHOL VALUE:xxx / LATITUDE:x,LONGITUDE:x   │
    │   • Reads:  BUZZER:ON  /  BUZZER:OFF                     │
    └────────────────────┬─────────────────────────────────────┘
                         │ USB Serial (single port)
                         ▼
                  serial_reader.py  ◄──── buzzer_state.json
                    │                      (written by monitors)
                    ▼
              sensor_data.json
                    │
                    ├── alcohol_monitor.py
                    ├── gps_monitor.py
                    ├── drowsiness_detection_optimized.py
                    └── heart_monitor.py

Requirements:
    pip install pyserial

Usage:
    python serial_reader.py --port COM3
    python serial_reader.py --port /dev/ttyUSB0
    python serial_reader.py          # auto-detect

Run this FIRST before all other monitors.
"""

import serial
import serial.tools.list_ports
import argparse
import time
import json
import os
import sys

# ==============================================================================
# CONFIGURATION
# ==============================================================================

SHARED_FILE       = 'sensor_data.json'
BUZZER_STATE_FILE = 'buzzer_state.json'

BAUD_RATE         = 115200
WRITE_EVERY       = 0.2    # seconds — how often to flush sensor_data.json
BUZZER_CHECK      = 0.3    # seconds — how often to check buzzer_state.json

# ==============================================================================
# CONSOLE COLOURS
# ==============================================================================

GREEN  = "\033[92m"
CYAN   = "\033[96m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# ==============================================================================
# PORT HELPERS
# ==============================================================================

def find_arduino_port():
    for p in serial.tools.list_ports.comports():
        desc = (p.description or '').lower()
        if any(kw in desc for kw in ['arduino', 'ch340', 'cp210', 'ftdi', 'usb serial']):
            return p.device
    ports = serial.tools.list_ports.comports()
    return ports[0].device if ports else None

# ==============================================================================
# SHARED FILE WRITER  (sensor data → monitors)
# ==============================================================================

def write_shared(data: dict):
    try:
        with open(SHARED_FILE, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        print(f"  ⚠  Could not write {SHARED_FILE}: {e}")


def init_shared_file():
    data = {
        'alcohol_value':     None,
        'alcohol_timestamp': None,
        'latitude':          None,
        'longitude':         None,
        'satellites':        None,
        'gps_timestamp':     None,
        'warmup_done':       False,
        'reader_alive':      True,
        'reader_started':    time.time(),
    }
    write_shared(data)
    return data

# ==============================================================================
# BUZZER STATE READER  (monitors → this script)
# ==============================================================================

BUZZER_SOURCES = ('alcohol', 'drowsiness', 'heart_rate')

def read_buzzer_state() -> dict:
    try:
        with open(BUZZER_STATE_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {}


def any_alert_active(state: dict) -> bool:
    return any(state.get(src, False) for src in BUZZER_SOURCES)


def get_active_alerts(state: dict) -> list:
    return [src for src in BUZZER_SOURCES if state.get(src, False)]

# ==============================================================================
# LINE PARSERS
# ==============================================================================

def parse_alcohol(line: str):
    """ALCOHOL VALUE:1234  →  int or None"""
    if line.startswith("ALCOHOL VALUE:"):
        try:
            return int(line.split(":")[1].strip())
        except (ValueError, IndexError):
            pass
    return None


def parse_gps(line: str):
    """
    Handles multiple GPS line formats from ESP32:
    Format 1: LATITUDE:x,LONGITUDE:x,SATELLITE:x  (all on one line)
    Format 2: LATITUDE:x,LONGITUDE:x              (no satellite)
    Format 3: GPS:x,x,x                           (compact format)
    """
    line = line.strip()

    # Format 1 & 2: LATITUDE:x,LONGITUDE:x,SATELLITE:x
    if 'LATITUDE:' in line and 'LONGITUDE:' in line:
        try:
            parts = line.split(',')
            lat  = None
            lng  = None
            sats = 0
            for part in parts:
                part = part.strip()
                if part.startswith('LATITUDE:'):
                    lat = float(part.split(':')[1])
                elif part.startswith('LONGITUDE:'):
                    lng = float(part.split(':')[1])
                elif part.startswith('SATELLITE:'):
                    sats = int(part.split(':')[1])
            if lat is not None and lng is not None:
                return {
                    'latitude':   lat,
                    'longitude':  lng,
                    'satellites': sats,
                }
        except (ValueError, IndexError):
            pass

    return None

# ==============================================================================
# MAIN LOOP
# ==============================================================================

def run(port: str):
    print(f"\n{'='*62}")
    print(f"  📡 Serial Reader  +  🔊 Buzzer Controller")
    print(f"  Port        : {port}")
    print(f"  Sensor file : {SHARED_FILE}")
    print(f"  Buzzer file : {BUZZER_STATE_FILE}")
    print(f"{'='*62}")
    print(f"\n  Startup order:")
    print(f"    1. python serial_reader.py               ← this")
    print(f"    2. python alcohol_monitor.py")
    print(f"    3. python gps_monitor.py")
    print(f"    4. python drowsiness_detection_optimized.py")
    print(f"    5. python heart_monitor.py\n")

    shared          = init_shared_file()
    start_time = time.time()
    last_write      = 0
    last_buzzer_chk = 0
    buzzer_on       = False    # last command sent to ESP32

    while True:
        try:
            with serial.Serial(port, BAUD_RATE, timeout=2) as ser:
                print(f"  {GREEN}✅  Connected to {port}{RESET}\n")

                while True:
                    now = time.time()

                    # ── Read incoming serial line from ESP32 ──────────────
                    raw = ser.readline().decode('utf-8', errors='ignore').strip()

                    if raw:
                        if "Warming up" in raw or "Warmup remaining" in raw:
                            print(f"  {YELLOW}[ESP32] {raw}{RESET}")
                            shared['warmup_done'] = False

                        elif "MQ3 Ready" in raw:
                            print(f"  {GREEN}[ESP32] {raw}{RESET}")
                            shared['warmup_done'] = True

                        elif "WARNING" in raw:
                            print(f"  {YELLOW}[ESP32] {raw}{RESET}")

                        else:
                            alcohol = parse_alcohol(raw)
                            if alcohol is not None:
                                shared['alcohol_value']     = alcohol
                                shared['alcohol_timestamp'] = now
                                print(
                                    f"  {CYAN}🍺 ALCOHOL{RESET} "
                                    f"{BOLD}{alcohol:4d}{RESET}  "
                                    f"{'🔊' if buzzer_on else '  '}",
                                    end='\r'
                                )
                            else:
                                gps = parse_gps(raw)
                                if gps:
                                    shared['latitude']      = gps['latitude']
                                    shared['longitude']     = gps['longitude']
                                    shared['satellites']    = gps['satellites']
                                    shared['gps_timestamp'] = now
                                    print(
                                        f"  {GREEN}📍 GPS{RESET} "
                                        f"Lat:{gps['latitude']:.6f} "
                                        f"Lng:{gps['longitude']:.6f} "
                                        f"Sats:{gps['satellites']}  ",
                                        end='\r'
                                    )
                                else:
                                    print(f"  [ESP32] {raw}")

                    # ── Flush sensor_data.json ────────────────────────────
                    shared['reader_alive'] = True
                    if not shared.get('warmup_done', False):
                        if time.time() - start_time > 60:
                            shared['warmup_done'] = True
                            print(f"\n{GREEN}✅ Warmup complete (auto) — MQ3 ready{RESET}")

                    if now - last_write >= WRITE_EVERY:
                        write_shared(shared)
                        last_write = now

                    # ── Check buzzer_state.json, send command to ESP32 ────
                    if now - last_buzzer_chk >= BUZZER_CHECK:
                        last_buzzer_chk = now
                        bstate  = read_buzzer_state()
                        should  = any_alert_active(bstate)
                        alerts  = get_active_alerts(bstate)

                        if should and not buzzer_on:
                            ser.write(b"BUZZER:ON\n")
                            buzzer_on = True
                            print(
                                f"\n  {RED}{BOLD}🔊 BUZZER ON{RESET}"
                                f"  ← active alerts: {', '.join(alerts)}"
                            )

                        elif not should and buzzer_on:
                            ser.write(b"BUZZER:OFF\n")
                            buzzer_on = False
                            print(f"\n  {GREEN}🔇 Buzzer OFF — all alerts cleared.{RESET}")

        except serial.SerialException as e:
            print(f"\n  ⚠  Serial error: {e}")
            print("  Retrying in 5 seconds...")
            shared['reader_alive'] = False
            write_shared(shared)
            time.sleep(5)

        except KeyboardInterrupt:
            print("\n\n  Stopped by user.")
            # Best-effort buzzer off before exit
            try:
                with serial.Serial(port, BAUD_RATE, timeout=2) as ser:
                    ser.write(b"BUZZER:OFF\n")
            except Exception:
                pass
            shared['reader_alive'] = False
            write_shared(shared)
            sys.exit(0)

# ==============================================================================
# ENTRY POINT
# ==============================================================================

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='ESP32 Serial Reader + Buzzer Controller')
    parser.add_argument('--port', default=None,
                        help='Serial port (e.g. COM3). Auto-detected if omitted.')
    args = parser.parse_args()

    port = args.port
    if not port:
        port = find_arduino_port()
        if not port:
            print("❌  No serial port found. Plug in the ESP32 or use --port.")
            sys.exit(1)
        print(f"  Auto-detected port: {port}")

    run(port)