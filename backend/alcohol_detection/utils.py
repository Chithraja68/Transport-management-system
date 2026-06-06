from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone


def send_alcohol_alert_email(alert):
    """
    Send a styled HTML email to admins.
    Content differs based on alert.alert_context:
      'LOGIN'   → Login was cancelled before the trip started
      'DRIVING' → Alcohol detected while the driver was already driving
    """
    from accounts.models import User

    admin_emails = list(
        User.objects.filter(user_type='ADMIN', is_active=True)
        .exclude(email__isnull=True).exclude(email='')
        .values_list('email', flat=True)
    )
    extra_emails = ['srajapriya650@gmail.com', 'makshaya500@gmail.com', 'abiramivenkatesan8059@gmail.com']
    all_recipients = list(set(admin_emails + extra_emails))

    if not all_recipients:
        print("⚠️  No admin emails found — skipping email notification")
        return False

    driver_name  = alert.driver.name         if alert.driver else 'Unknown Driver'
    driver_id    = alert.driver.employee_id  if alert.driver else 'N/A'
    driver_phone = alert.driver.phone_number if alert.driver else 'N/A'
    detected_str = timezone.localtime(alert.detected_at).strftime('%d %B %Y, %I:%M %p')

    is_login = (alert.alert_context == 'LOGIN')

    if is_login:
        subject        = f"🚫 Login Cancelled — Alcohol Detected — {driver_name}"
        header_title   = "🚫 Login Cancelled — Alcohol Detected"
        header_sub     = f"Driver blocked from starting shift on {detected_str}"
        header_color   = "linear-gradient(135deg, #7c3aed, #4c1d95)"   # purple
        badge_label    = "🚫 LOGIN CANCELLED"
        badge_bg       = "#ede9fe"
        badge_color    = "#5b21b6"
        badge_border   = "#c4b5fd"
        value_bg       = "#f5f3ff"
        value_border   = "#ddd6fe"
        value_color    = "#6d28d9"
        value_sublabel = "Sensor Value  ·  LOGIN BLOCKED"
        action_note    = (
            "The driver attempted to log in but was <strong>blocked automatically</strong> "
            "because alcohol was detected during the pre-drive sensor check. "
            "No trip has started. Please follow up with the driver immediately."
        )
        plain_status   = "LOGIN CANCELLED — Pre-drive alcohol check failed"
    else:
        subject        = f"🍺 Alcohol Detected During Driving — {driver_name} — IMMEDIATE ACTION REQUIRED"
        header_title   = "🍺 Alcohol Detected — Immediate Action Required"
        header_sub     = f"Detected while driving on {detected_str}"
        header_color   = "linear-gradient(135deg, #b45309, #92400e)"   # amber
        badge_label    = "⚠️ ALCOHOL DETECTED"
        badge_bg       = "#fef3c7"
        badge_color    = "#b45309"
        badge_border   = "#fde68a"
        value_bg       = "#fffbeb"
        value_border   = "#fde68a"
        value_color    = "#b45309"
        value_sublabel = "Sensor Value  ·  ALCOHOL DETECTED WHILE DRIVING"
        action_note    = (
            "Alcohol was detected <strong>while the driver was on an active trip</strong>. "
            "The driver may still be on the road. Contact them and dispatch a replacement immediately."
        )
        plain_status   = "ALCOHOL DETECTED DURING DRIVING"

    # ── Plain-text fallback ───────────────────────────────────────────────────
    message = f"""
{plain_status}

Sensor Value : {alert.sensor_value}
Threshold    : {alert.threshold}
Detected At  : {detected_str}

Driver Name  : {driver_name}
Employee ID  : {driver_id}
Phone        : {driver_phone}

{"The driver was blocked from logging in. No trip started." if is_login else "The driver may still be on the road. Take immediate action."}

— Transport Management System
"""

    # ── HTML email ────────────────────────────────────────────────────────────
    html_message = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; padding: 32px 16px; }}
  .wrapper {{ max-width: 560px; margin: 0 auto; }}
  .card {{ background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }}
  .header {{ background: {header_color}; padding: 32px 36px 28px; text-align: center; }}
  .header-badge {{ display: inline-block; background: rgba(255,255,255,0.18); color: white; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 5px 14px; border-radius: 20px; margin-bottom: 16px; }}
  .header h1 {{ color: white; font-size: 22px; font-weight: 700; margin-bottom: 6px; line-height: 1.3; }}
  .header-sub {{ color: rgba(255,255,255,0.80); font-size: 13px; }}
  .value-section {{ background: {value_bg}; border-bottom: 1px solid {value_border}; padding: 28px 36px; text-align: center; }}
  .value-number {{ font-size: 64px; font-weight: 900; color: {value_color}; line-height: 1; letter-spacing: -2px; }}
  .value-label {{ font-size: 14px; font-weight: 600; color: {value_color}; margin-top: 6px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.75; }}
  .action-box {{ margin: 24px 36px 0; padding: 14px 18px; background: #fafafa; border-left: 4px solid {value_color}; border-radius: 6px; font-size: 13px; color: #374151; line-height: 1.6; }}
  .body {{ padding: 20px 36px 28px; }}
  .section-title {{ font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #9ca3af; margin-bottom: 12px; margin-top: 24px; }}
  .section-title:first-child {{ margin-top: 0; }}
  .info-table {{ width: 100%; border-collapse: collapse; }}
  .info-table tr td {{ padding: 11px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; vertical-align: middle; }}
  .info-table tr:last-child td {{ border-bottom: none; }}
  .td-label {{ color: #6b7280; font-weight: 500; width: 42%; padding-right: 12px; }}
  .td-value {{ color: #111827; font-weight: 600; text-align: right; }}
  .badge-alert {{ background: {badge_bg}; color: {badge_color}; border: 1px solid {badge_border}; border-radius: 6px; padding: 3px 10px; font-size: 13px; font-weight: 700; }}
  .divider {{ height: 1px; background: #f3f4f6; margin: 4px 0 20px; }}
  .footer {{ background: #f9fafb; border-top: 1px solid #f0f0f0; padding: 18px 36px; text-align: center; font-size: 12px; color: #9ca3af; line-height: 1.6; }}
</style>
</head>
<body>
<div class="wrapper"><div class="card">

  <div class="header">
    <div class="header-badge">🚨 Automated Alert</div>
    <h1>{header_title}</h1>
    <div class="header-sub">{header_sub}</div>
  </div>

  <div class="value-section">
    <div class="value-number">{alert.sensor_value}</div>
    <div class="value-label">{value_sublabel}</div>
  </div>

  <div class="action-box">{action_note}</div>

  <div class="body">
    <div class="section-title">Alert Details</div>
    <div class="divider"></div>
    <table class="info-table">
      <tr><td class="td-label">Status</td><td class="td-value"><span class="badge-alert">{badge_label}</span></td></tr>
      <tr><td class="td-label">Sensor Value</td><td class="td-value">{alert.sensor_value}</td></tr>
      <tr><td class="td-label">Detection Threshold</td><td class="td-value">{alert.threshold}</td></tr>
      <tr><td class="td-label">Detected At</td><td class="td-value">{detected_str}</td></tr>
    </table>

    <div class="section-title">Driver Information</div>
    <div class="divider"></div>
    <table class="info-table">
      <tr><td class="td-label">Driver Name</td><td class="td-value">{driver_name}</td></tr>
      <tr><td class="td-label">Employee ID</td><td class="td-value">{driver_id}</td></tr>
      <tr><td class="td-label">Phone Number</td><td class="td-value">{driver_phone}</td></tr>
    </table>
  </div>

  <div class="footer">
    This is an automated alert from the <strong>Transport Management System</strong>.<br>
    Please log in to the admin dashboard to acknowledge and take action immediately.
  </div>

</div></div>
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
        print(f"✅ Alcohol alert email ({alert.alert_context}) sent to: {', '.join(all_recipients)}")
        return True
    except Exception as e:
        print(f"❌ Failed to send alcohol alert email: {e}")
        return False