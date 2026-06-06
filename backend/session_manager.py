# session_manager.py
# Shared helper for all monitors to read the active driver session safely.

import json
import os
import time

SESSION_FILE = 'current_driver.json'   # written by web_login.py
_LOCK_FILE   = SESSION_FILE + '.lock'
_LOCK_TIMEOUT = 2.0  # seconds


def _acquire_lock():
    deadline = time.time() + _LOCK_TIMEOUT
    while time.time() < deadline:
        try:
            fd = os.open(_LOCK_FILE, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.close(fd)
            return True
        except FileExistsError:
            time.sleep(0.05)
    return False  # timed out — proceed anyway (best-effort)


def _release_lock():
    try:
        os.remove(_LOCK_FILE)
    except FileNotFoundError:
        pass


def get_active_driver():
    """
    Returns dict with driver info if a driver is currently logged in,
    or None if no driver is active.

    Safe to call from multiple concurrent monitor processes.
    """
    if not os.path.exists(SESSION_FILE):
        return None

    _acquire_lock()
    try:
        with open(SESSION_FILE, 'r') as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return None
    finally:
        _release_lock()

    if not data.get('logged_in', False):
        return None
    if not data.get('driver_id'):
        return None

    return data   # keys: driver_id, driver_name, session_token, login_time, ...


def is_driver_logged_in():
    """Quick boolean check — use when you don't need driver details."""
    return get_active_driver() is not None