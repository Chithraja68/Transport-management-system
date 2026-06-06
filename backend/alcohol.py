"""
alcohol_alarm.py
================
Reads MQ3 alcohol sensor values from Arduino over Serial
and triggers an alarm (audio beep + console alert) when alcohol is detected.

Requirements:
    pip install pyserial

Usage:
    python alcohol_alarm.py                        # auto-detect port
    python alcohol_alarm.py --port COM3            # Windows
    python alcohol_alarm.py --port /dev/ttyUSB0    # Linux
    python alcohol_alarm.py --port /dev/cu.usbmodem14101  # Mac

    Optional flags:
    --threshold 1500   (default: 1500, range 0-4095 on ESP32)
    --confirm  3       (default: 3 consecutive detections before alarm)
"""

import serial
import serial.tools.list_ports
import argparse
import time
import sys
import os
import threading

# ──────────────────────────────────────────────
#  CONFIG  (can also be changed via CLI flags)
# ──────────────────────────────────────────────
DEFAULT_BAUD        = 115200
DEFAULT_THRESHOLD   = 300   # sensor value above this = alcohol detected
DEFAULT_CONFIRM     = 3      # consecutive detections needed before alarm rings
BEEP_INTERVAL_SEC   = 0.6    # how often the beep repeats while alarm is active
# ──────────────────────────────────────────────


# ── Cross-platform beep ────────────────────────────────────────────────────────
def beep():
    """Play a short beep — works on Windows, Linux, and Mac."""
    if sys.platform == "win32":
        import winsound
        winsound.Beep(1000, 400)          # 1000 Hz, 400 ms
    else:
        # Use 'paplay' (Linux) or 'afplay' (Mac) if available, else print bell
        if os.system("which paplay > /dev/null 2>&1") == 0:
            os.system("paplay /usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga &")
        elif os.system("which afplay > /dev/null 2>&1") == 0:
            os.system("afplay /System/Library/Sounds/Sosumi.aiff &")
        else:
            sys.stdout.write("\a")        # terminal bell as fallback
            sys.stdout.flush()


# ── Auto-detect Arduino port ──────────────────────────────────────────────────
def find_arduino_port():
    """Scan available ports and return the most likely Arduino port."""
    ports = serial.tools.list_ports.comports()
    for p in ports:
        desc = (p.description or "").lower()
        if any(kw in desc for kw in ["arduino", "ch340", "cp210", "ftdi", "usb serial"]):
            return p.device
    # Fallback: return first available port
    if ports:
        return ports[0].device
    return None


# ── Parse the serial line from Arduino ───────────────────────────────────────
def parse_value(line: str):
    """
    Arduino sends:  'Alcohol Sensor Value: 1234'
    Returns the integer value, or None if parsing fails.
    """
    try:
        parts = line.strip().split(":")
        if len(parts) == 2:
            return int(parts[1].strip())
    except (ValueError, IndexError):
        pass
    return None


# ── Alarm thread (runs beep in background so serial reading isn't blocked) ────
class AlarmThread(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self._active = threading.Event()
        self._stop   = threading.Event()

    def run(self):
        while not self._stop.is_set():
            if self._active.is_set():
                beep()
                time.sleep(BEEP_INTERVAL_SEC)
            else:
                time.sleep(0.1)

    def start_alarm(self):
        self._active.set()

    def stop_alarm(self):
        self._active.clear()

    def shutdown(self):
        self._stop.set()


# ── Visual helpers ────────────────────────────────────────────────────────────
RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

ALARM_BANNER = f"""
{RED}{BOLD}
╔══════════════════════════════════════════════════════╗
║   🚨  ALCOHOL DETECTED — DRIVER UNFIT TO DRIVE  🚨   ║
║         Please stop the vehicle immediately!         ║
╚══════════════════════════════════════════════════════╝
{RESET}"""

CLEAR_BANNER = f"{GREEN}{BOLD}✅  All clear — No alcohol detected.{RESET}"


# ── Main loop ─────────────────────────────────────────────────────────────────
def run(port: str, threshold: int, confirm_count: int):
    print(f"\n{'='*56}")
    print(f"  🍺 Alcohol Detection Monitor")
    print(f"  Port      : {port}")
    print(f"  Baud rate : {DEFAULT_BAUD}")
    print(f"  Threshold : {threshold}  (0–4095)")
    print(f"  Confirm   : {confirm_count} consecutive readings before alarm")
    print(f"{'='*56}\n")
    print("  Waiting for Arduino...\n")

    alarm_thread = AlarmThread()
    alarm_thread.start()

    consecutive_detections = 0
    alarm_active = False

    while True:
        try:
            with serial.Serial(port, DEFAULT_BAUD, timeout=2) as ser:
                print(f"  {GREEN}Connected to {port}{RESET}\n")

                while True:
                    raw = ser.readline().decode("utf-8", errors="ignore").strip()
                    if not raw:
                        continue

                    value = parse_value(raw)

                    if value is None:
                        # Non-data line (startup message etc.) — just print it
                        print(f"  [Arduino] {raw}")
                        continue

                    detected = value >= threshold

                    # ── Update consecutive counter ──
                    if detected:
                        consecutive_detections += 1
                    else:
                        consecutive_detections = 0

                    # ── Decide alarm state ──
                    should_alarm = consecutive_detections >= confirm_count

                    # ── Console status line ──
                    bar_filled = min(int(value / 4095 * 30), 30)
                    bar = "█" * bar_filled + "░" * (30 - bar_filled)
                    status_color = RED if detected else GREEN
                    status_word  = "⚠  DETECTED" if detected else "✓  NORMAL  "
                    print(
                        f"\r  Value: {BOLD}{value:4d}{RESET}  "
                        f"[{status_color}{bar}{RESET}]  "
                        f"{status_color}{status_word}{RESET}  "
                        f"(consec: {consecutive_detections}/{confirm_count})",
                        end="", flush=True
                    )

                    # ── Trigger / clear alarm ──
                    if should_alarm and not alarm_active:
                        alarm_active = True
                        alarm_thread.start_alarm()
                        print(ALARM_BANNER)

                    elif not should_alarm and alarm_active:
                        alarm_active = False
                        alarm_thread.stop_alarm()
                        print(f"\n\n  {CLEAR_BANNER}\n")

        except serial.SerialException as e:
            print(f"\n  {YELLOW}⚠  Serial error: {e}{RESET}")
            print(f"  Retrying in 5 seconds...")
            alarm_thread.stop_alarm()
            alarm_active = False
            consecutive_detections = 0
            time.sleep(5)

        except KeyboardInterrupt:
            print(f"\n\n  Stopped by user.")
            alarm_thread.stop_alarm()
            alarm_thread.shutdown()
            sys.exit(0)


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MQ3 Alcohol Sensor Alarm")
    parser.add_argument("--port",      type=str, default=None,
                        help="Serial port (e.g. COM3 or /dev/ttyUSB0). Auto-detected if omitted.")
    parser.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD,
                        help=f"Sensor value above which alcohol is detected (default: {DEFAULT_THRESHOLD})")
    parser.add_argument("--confirm",   type=int, default=DEFAULT_CONFIRM,
                        help=f"Consecutive detections before alarm triggers (default: {DEFAULT_CONFIRM})")
    args = parser.parse_args()

    port = args.port
    if not port:
        port = find_arduino_port()
        if not port:
            print("❌  No serial port found. Plug in the Arduino or specify --port manually.")
            sys.exit(1)
        print(f"  Auto-detected port: {port}")

    run(port, args.threshold, args.confirm)