"""
Fastrack Watch – Google Fit Heart Rate Monitor
Device-compatible FINAL version
"""

import os
import time
import datetime
import pickle
import requests
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# ================= CONFIG =================
SCOPES = ["https://www.googleapis.com/auth/fitness.heart_rate.read"]

DJANGO_BACKEND_URL = "http://127.0.0.1:8000/api/health/"
DRIVER_ID = "driver002"

CHECK_INTERVAL = 60          # seconds
MAX_DELAY_MINUTES = 20
# ==========================================


def get_google_fit_service():
    creds = None
    if os.path.exists("token.pickle"):
        with open("token.pickle", "rb") as f:
            creds = pickle.load(f)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "credentials.json", SCOPES
            )
            creds = flow.run_local_server(port=0)

        with open("token.pickle", "wb") as f:
            pickle.dump(creds, f)

    return build("fitness", "v1", credentials=creds)


def get_latest_heart_rate(service):
    """
    Read directly from Fastrack + merged sources
    """
    sources = [
        "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm",
        "derived:com.google.heart_rate.bpm:com.titan.fastrack.reflex:heart count"
    ]

    now = datetime.datetime.now()
    start = now - datetime.timedelta(minutes=10)

    start_ns = int(start.timestamp() * 1e9)
    end_ns = int(now.timestamp() * 1e9)

    latest = None

    for source in sources:
        try:
            dataset_id = f"{start_ns}-{end_ns}"
            dataset = service.users().dataSources().datasets().get(
                userId="me",
                dataSourceId=source,
                datasetId=dataset_id
            ).execute()

            for point in dataset.get("point", []):
                ts = int(point["endTimeNanos"]) / 1e9
                hr = int(point["value"][0]["fpVal"])

                if not latest or ts > latest["timestamp"]:
                    latest = {
                        "heart_rate": hr,
                        "timestamp": ts,
                        "source": source.split(":")[-1]
                    }

        except Exception:
            pass

    if latest:
        ts_local = datetime.datetime.fromtimestamp(latest["timestamp"])
        delay = int((datetime.datetime.now() - ts_local).seconds / 60)

        latest["timestamp"] = ts_local
        latest["delay"] = delay
        return latest

    return None


def send_to_backend(data):
    payload = {
        "driver_id": DRIVER_ID,
        "heart_rate": data["heart_rate"],
        "timestamp": data["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
        "delay_minutes": data["delay"],
        "source": "google_fit"
    }

    try:
        r = requests.post(DJANGO_BACKEND_URL, json=payload, timeout=5)
        if r.status_code == 201:
            print("   ✅ Sent to backend")
        else:
            print("   ⚠️ Backend error:", r.status_code)
    except Exception as e:
        print("   ❌ Backend error:", e)


def main():
    print("=" * 65)
    print("🏥 Fastrrack Heart Rate Monitor (FINAL)")
    print("=" * 65)

    service = get_google_fit_service()
    print("✅ Google Fit authenticated")

    last_ts = None

    while True:
        print("\n⏱️ Checking heart rate...")
        data = get_latest_heart_rate(service)

        if data:
            ts = data["timestamp"]

            if last_ts != ts:
                print(f"❤️  Heart Rate : {data['heart_rate']} bpm")
                print(f"🕒 Time       : {ts.strftime('%H:%M:%S')}")
                print(f"⏳ Delay      : {data['delay']} min")
                print(f"📡 Source     : {data['source']}")

                if data["delay"] <= MAX_DELAY_MINUTES:
                    send_to_backend(data)
                else:
                    print("⚠️ Data too old – not sending")

                last_ts = ts
            else:
                print("⏸️ No new data")

        else:
            print("❌ No heart rate data found")
            print("👉 Open Fastrack app & take manual HR")

        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()