from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone


def send_heart_rate_alert_email(alert):
    """
    Send email to all admin users when a heart rate alert is triggered.
    Called from views.py after saving the alert to the database.
    """
    from accounts.models import User  # avoid circular import

    # ── Gather admin email addresses ──────────────────────────────────────────
    admin_emails = list(
        User.objects.filter(user_type='ADMIN', is_active=True)
        .exclude(email__isnull=True)
        .exclude(email='')
        .values_list('email', flat=True)
    )

    # Add extra hardcoded recipients (same approach as drowsiness alerts)
    extra_emails = ['srajapriya650@gmail.com', 'makshaya500@gmail.com', 'abiramivenkatesan8059@gmail.com']
    all_recipients = list(set(admin_emails + extra_emails))

    if not all_recipients:
        print("⚠️  No admin emails found — skipping email notification")
        return False

    # ── Build email content ────────────────────────────────────────────────────
    driver_name  = alert.driver.name         if alert.driver else 'Unknown Driver'
    driver_id    = alert.driver.employee_id  if alert.driver else 'N/A'
    driver_phone = alert.driver.phone_number if alert.driver else 'N/A'

    alert_emoji = '🔥' if alert.alert_type == 'HIGH' else '❄️'
    direction   = 'TOO HIGH' if alert.alert_type == 'HIGH' else 'TOO LOW'
    threshold   = (
        f"above {alert.threshold_high} BPM"
        if alert.alert_type == 'HIGH'
        else f"below {alert.threshold_low} BPM"
    )

    # ── Use local time (fixes wrong detection time in email) ──────────────────
    local_detected_at = timezone.localtime(alert.detected_at)
    detected_str = local_detected_at.strftime('%d %B %Y, %I:%M %p')   # e.g. 25 February 2026, 03:15 PM

    header_color = '#dc2626' if alert.alert_type == 'HIGH' else '#1d4ed8'

    subject = f"{alert_emoji} Heart Rate Alert — {driver_name} — {direction}"

    message = f"""
HEART RATE ALERT — {direction}

Alert Type   : {alert.alert_type} {alert_emoji}
Heart Rate   : {int(alert.heart_rate)} BPM
Threshold    : {threshold}
Detected At  : {detected_str}

Driver Name  : {driver_name}
Employee ID  : {driver_id}
Phone        : {driver_phone}

This alert has been automatically saved to the admin dashboard.
Please log in to acknowledge and take action.

— Transport Management System
"""

    html_message = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #f0f2f5;
    padding: 32px 16px;
  }}
  .wrapper {{
    max-width: 560px;
    margin: 0 auto;
  }}
  .card {{
    background: #ffffff;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.10);
  }}

  /* ── Header ── */
  .header {{
    background: {header_color};
    padding: 32px 36px 28px;
    text-align: center;
  }}
  .header-badge {{
    display: inline-block;
    background: rgba(255,255,255,0.18);
    color: white;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 5px 14px;
    border-radius: 20px;
    margin-bottom: 16px;
  }}
  .header h1 {{
    color: white;
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 6px;
    line-height: 1.3;
  }}
  .header-sub {{
    color: rgba(255,255,255,0.80);
    font-size: 13px;
  }}

  /* ── BPM Hero ── */
  .bpm-section {{
    background: {'#fff5f5' if alert.alert_type == 'HIGH' else '#eff6ff'};
    border-bottom: 1px solid {'#fecaca' if alert.alert_type == 'HIGH' else '#bfdbfe'};
    padding: 28px 36px;
    text-align: center;
  }}
  .bpm-number {{
    font-size: 64px;
    font-weight: 900;
    color: {header_color};
    line-height: 1;
    letter-spacing: -2px;
  }}
  .bpm-label {{
    font-size: 14px;
    font-weight: 600;
    color: {header_color};
    margin-top: 6px;
    letter-spacing: 2px;
    text-transform: uppercase;
    opacity: 0.75;
  }}

  /* ── Body ── */
  .body {{
    padding: 28px 36px;
  }}
  .section-title {{
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #9ca3af;
    margin-bottom: 12px;
    margin-top: 24px;
  }}
  .section-title:first-child {{
    margin-top: 0;
  }}
  .info-table {{
    width: 100%;
    border-collapse: collapse;
  }}
  .info-table tr td {{
    padding: 11px 0;
    border-bottom: 1px solid #f3f4f6;
    font-size: 14px;
    vertical-align: middle;
  }}
  .info-table tr:last-child td {{
    border-bottom: none;
  }}
  .info-table .td-label {{
    color: #6b7280;
    font-weight: 500;
    width: 42%;
    padding-right: 12px;
  }}
  .info-table .td-value {{
    color: #111827;
    font-weight: 600;
    text-align: right;
  }}
  .badge-high {{
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 3px 10px;
    font-size: 13px;
    font-weight: 700;
  }}
  .badge-low {{
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    padding: 3px 10px;
    font-size: 13px;
    font-weight: 700;
  }}
  .divider {{
    height: 1px;
    background: #f3f4f6;
    margin: 4px 0 20px;
  }}

  /* ── Footer ── */
  .footer {{
    background: #f9fafb;
    border-top: 1px solid #f0f0f0;
    padding: 18px 36px;
    text-align: center;
    font-size: 12px;
    color: #9ca3af;
    line-height: 1.6;
  }}
</style>
</head>
<body>
<div class="wrapper">
<div class="card">

  <!-- Header -->
  <div class="header">
    <div class="header-badge">Automated Alert</div>
    <h1>{alert_emoji} Heart Rate Alert — {direction}</h1>
    <div class="header-sub">Detected on {detected_str}</div>
  </div>

  <!-- BPM Hero -->
  <div class="bpm-section">
    <div class="bpm-number">{int(alert.heart_rate)}</div>
    <div class="bpm-label">BPM &nbsp;·&nbsp; {direction}</div>
  </div>

  <!-- Body -->
  <div class="body">

    <div class="section-title">Alert Details</div>
    <div class="divider"></div>
    <table class="info-table">
      <tr>
        <td class="td-label">Alert Type</td>
        <td class="td-value">
          <span class="{'badge-high' if alert.alert_type == 'HIGH' else 'badge-low'}">
            {alert.alert_type} {alert_emoji}
          </span>
        </td>
      </tr>
      <tr>
        <td class="td-label">Heart Rate</td>
        <td class="td-value">{int(alert.heart_rate)} BPM</td>
      </tr>
      <tr>
        <td class="td-label">Threshold</td>
        <td class="td-value">{threshold}</td>
      </tr>
      <tr>
        <td class="td-label">Detected At</td>
        <td class="td-value">{detected_str}</td>
      </tr>
    </table>

    <div class="section-title" style="margin-top:28px;">Driver Information</div>
    <div class="divider"></div>
    <table class="info-table">
      <tr>
        <td class="td-label">Driver Name</td>
        <td class="td-value">{driver_name}</td>
      </tr>
      <tr>
        <td class="td-label">Employee ID</td>
        <td class="td-value">{driver_id}</td>
      </tr>
      <tr>
        <td class="td-label">Phone</td>
        <td class="td-value">{driver_phone}</td>
      </tr>
    </table>

  </div>

  <!-- Footer -->
  <div class="footer">
    This is an automated alert from the <strong>Transport Management System</strong>.<br>
    Please log in to the admin dashboard to acknowledge and take action.
  </div>

</div>
</div>
</body>
</html>
"""

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@tms.local'),
            recipient_list=all_recipients,
            html_message=html_message,
            fail_silently=False,
        )
        print(f"✅ Heart rate alert email sent to: {', '.join(all_recipients)}")
        return True
    except Exception as e:
        print(f"❌ Failed to send heart rate alert email: {e}")
        return False