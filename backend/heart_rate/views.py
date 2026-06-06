from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import HeartRateAlert
from .serializers import HeartRateAlertSerializer
from .utils import send_heart_rate_alert_email
from accounts.models import User


# ============================================================================
# CALLED BY heart_monitor.py  (no auth — secured by token or internal-only)
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])   # heart_monitor.py calls this without a session
def receive_heart_rate_alert(request):
    """
    Endpoint called by heart_monitor.py when abnormal BPM is detected.
    
    Payload from heart_monitor.py:
    {
        "heart_rate": 145,
        "alert_type": "HIGH",          # or "LOW"
        "driver_id": 3,                # optional — Django User.id
        "threshold_low": 50,
        "threshold_high": 120
    }
    
    Returns:
    {
        "status": "alert saved",
        "alert_id": 12,
        "email_sent": true
    }
    """
    # ── Optional simple token check ──────────────────────────────────────────
    # Add HEART_RATE_ALERT_TOKEN = 'some-secret' in settings.py
    # and pass {"token": "some-secret"} in the payload for security.
    from django.conf import settings
    secret = getattr(settings, 'HEART_RATE_ALERT_TOKEN', None)
    if secret:
        if request.data.get('token') != secret:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

    heart_rate  = request.data.get('heart_rate')
    alert_type  = request.data.get('alert_type', '').upper()
    driver_id   = request.data.get('driver_id')
    threshold_low  = request.data.get('threshold_low', 50)
    threshold_high = request.data.get('threshold_high', 120)

    # ── Validate ─────────────────────────────────────────────────────────────
    if heart_rate is None:
        return Response({'error': 'heart_rate is required'}, status=status.HTTP_400_BAD_REQUEST)
    if alert_type not in ('HIGH', 'LOW'):
        return Response({'error': 'alert_type must be HIGH or LOW'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Resolve driver ────────────────────────────────────────────────────────
    driver = None
    if driver_id:
        try:
            driver = User.objects.get(id=driver_id, user_type='DRIVER')
        except User.DoesNotExist:
            pass  # alert saved without driver link

    # ── Save alert ────────────────────────────────────────────────────────────
    alert = HeartRateAlert.objects.create(
        driver=driver,
        alert_type=alert_type,
        heart_rate=float(heart_rate),
        threshold_low=float(threshold_low),
        threshold_high=float(threshold_high),
        status='NEW',
    )

    # ── Send email ────────────────────────────────────────────────────────────
    email_sent = send_heart_rate_alert_email(alert)
    alert.email_sent = email_sent
    alert.save(update_fields=['email_sent'])

    print(f"\n💾 Heart Rate Alert #{alert.id} saved to DB")
    print(f"   Type: {alert_type} | BPM: {heart_rate} | Driver: {driver}")
    print(f"   Email sent: {email_sent}\n")

    return Response({
        'status': 'alert saved',
        'alert_id': alert.id,
        'email_sent': email_sent,
    }, status=status.HTTP_201_CREATED)


# ============================================================================
# ADMIN DASHBOARD — list + acknowledge + stats
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_heart_rate_alerts(request):
    """
    GET /api/heart-monitor/alerts/
    Returns all heart rate alerts (admin only).
    Query params: ?status=NEW  ?alert_type=HIGH  ?driver_id=3
    """
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    qs = HeartRateAlert.objects.select_related('driver', 'acknowledged_by').all()

    # Filters
    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter.upper())

    alert_type = request.query_params.get('alert_type')
    if alert_type:
        qs = qs.filter(alert_type=alert_type.upper())

    driver_id = request.query_params.get('driver_id')
    if driver_id:
        qs = qs.filter(driver_id=driver_id)

    serializer = HeartRateAlertSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_heart_rate_alert_detail(request, alert_id):
    """GET /api/heart-monitor/alerts/<id>/"""
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        alert = HeartRateAlert.objects.select_related('driver', 'acknowledged_by').get(id=alert_id)
    except HeartRateAlert.DoesNotExist:
        return Response({'error': 'Alert not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = HeartRateAlertSerializer(alert)
    return Response(serializer.data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_alert_status(request, alert_id):
    """
    PATCH /api/heart-monitor/alerts/<id>/status/
    Body: { "status": "ACKNOWLEDGED" }  or  { "status": "RESOLVED", "notes": "..." }
    """
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        alert = HeartRateAlert.objects.get(id=alert_id)
    except HeartRateAlert.DoesNotExist:
        return Response({'error': 'Alert not found'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status', '').upper()
    if new_status not in ('ACKNOWLEDGED', 'RESOLVED'):
        return Response({'error': 'status must be ACKNOWLEDGED or RESOLVED'}, status=status.HTTP_400_BAD_REQUEST)

    alert.status = new_status
    if new_status == 'ACKNOWLEDGED':
        alert.acknowledged_at = timezone.now()
        alert.acknowledged_by = request.user
    if request.data.get('notes'):
        alert.notes = request.data['notes']
    alert.save()

    return Response(HeartRateAlertSerializer(alert).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_heart_rate_alerts(request):
    """
    GET /api/heart-monitor/alerts/my/
    Returns only THIS driver's own heart rate alerts.
    Accessible by DRIVER users only.
    """
    if request.user.user_type != 'DRIVER':
        return Response({'error': 'Driver access only'}, status=status.HTTP_403_FORBIDDEN)

    qs = HeartRateAlert.objects.select_related('driver', 'acknowledged_by').filter(
        driver=request.user
    ).order_by('-detected_at')

    serializer = HeartRateAlertSerializer(qs, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_heart_rate_dashboard_summary(request):
    """
    GET /api/heart-monitor/summary/
    Returns counts used by the admin overview tab.
    """
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    from django.utils import timezone as tz
    today = tz.now().date()

    total_alerts    = HeartRateAlert.objects.count()
    new_alerts      = HeartRateAlert.objects.filter(status='NEW').count()
    today_alerts    = HeartRateAlert.objects.filter(detected_at__date=today).count()
    high_alerts     = HeartRateAlert.objects.filter(alert_type='HIGH', status='NEW').count()
    low_alerts      = HeartRateAlert.objects.filter(alert_type='LOW',  status='NEW').count()

    # Latest 5 new alerts for the overview widget
    recent = HeartRateAlert.objects.filter(status='NEW').select_related('driver').order_by('-detected_at')
    recent_serialized = HeartRateAlertSerializer(recent, many=True).data

    return Response({
        'total_alerts':    total_alerts,
        'new_alerts':      new_alerts,
        'today_alerts':    today_alerts,
        'high_bpm_alerts': high_alerts,
        'low_bpm_alerts':  low_alerts,
        'recent_alerts':   recent_serialized,
    })