from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import AlcoholAlert
from .serializers import AlcoholAlertSerializer
from .utils import send_alcohol_alert_email
from accounts.models import User


# ============================================================================
# CALLED BY alcohol_monitor.py  (no auth — same pattern as heart_monitor.py)
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def receive_alcohol_alert(request):
    """
    Endpoint called by alcohol_monitor.py when alcohol is detected.

    Payload:
    {
        "sensor_value": 1800,
        "threshold": 1500,
        "driver_id": 3          # optional — Django User.id
    }

    Returns:
    {
        "status": "alert saved",
        "alert_id": 7,
        "email_sent": true
    }
    """
    from django.conf import settings
    secret = getattr(settings, 'ALCOHOL_ALERT_TOKEN', None)
    if secret and request.data.get('token') != secret:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

    sensor_value = request.data.get('sensor_value')
    threshold    = request.data.get('threshold', 1500)
    driver_id    = request.data.get('driver_id')
    alert_context = request.data.get('alert_context', 'DRIVING') 

    if alert_context not in ('DRIVING', 'LOGIN'):
        alert_context = 'DRIVING'
    


    if sensor_value is None:
        return Response({'error': 'sensor_value is required'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Resolve driver ────────────────────────────────────────────────────────
    driver = None
    if driver_id:
        try:
            driver = User.objects.get(id=driver_id, user_type='DRIVER')
        except User.DoesNotExist:
            pass

    # ── Save alert ────────────────────────────────────────────────────────────
    alert = AlcoholAlert.objects.create(
        driver=driver,
        sensor_value=int(sensor_value),
        threshold=int(threshold),
        alert_context=alert_context, 
        status='NEW',
    )

    # ── Send email ────────────────────────────────────────────────────────────
    email_sent = send_alcohol_alert_email(alert)
    alert.email_sent = email_sent
    alert.save(update_fields=['email_sent'])

    print(f"\n💾 Alcohol Alert #{alert.id} saved to DB")
    print(f"   Sensor Value: {sensor_value} | Threshold: {threshold} | Driver: {driver}")
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
def get_alcohol_alerts(request):
    """
    GET /api/alcohol/alerts/
    Returns all alcohol alerts (admin only).
    Query params: ?status=NEW  ?driver_id=3
    """
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    qs = AlcoholAlert.objects.select_related('driver', 'acknowledged_by').all()

    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter.upper())

    driver_id = request.query_params.get('driver_id')
    if driver_id:
        qs = qs.filter(driver_id=driver_id)

    serializer = AlcoholAlertSerializer(qs, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_alcohol_alerts(request):
    """
    GET /api/alcohol/my-alerts/
    Returns alcohol alerts for the logged-in driver only.
    """
    if request.user.user_type != 'DRIVER':
        return Response({'error': 'Driver access only'}, status=status.HTTP_403_FORBIDDEN)

    qs = AlcoholAlert.objects.select_related(
        'driver', 'acknowledged_by'
    ).filter(driver=request.user).order_by('-detected_at')

    serializer = AlcoholAlertSerializer(qs, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_alcohol_alert_detail(request, alert_id):
    """GET /api/alcohol/alerts/<id>/"""
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        alert = AlcoholAlert.objects.select_related('driver', 'acknowledged_by').get(id=alert_id)
    except AlcoholAlert.DoesNotExist:
        return Response({'error': 'Alert not found'}, status=status.HTTP_404_NOT_FOUND)

    return Response(AlcoholAlertSerializer(alert).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_alert_status(request, alert_id):
    """
    PATCH /api/alcohol/alerts/<id>/status/
    Body: { "status": "ACKNOWLEDGED" }  or  { "status": "RESOLVED", "notes": "..." }
    """
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        alert = AlcoholAlert.objects.get(id=alert_id)
    except AlcoholAlert.DoesNotExist:
        return Response({'error': 'Alert not found'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status', '').upper()
    if new_status not in ('ACKNOWLEDGED', 'RESOLVED'):
        return Response({'error': 'status must be ACKNOWLEDGED or RESOLVED'}, status=status.HTTP_400_BAD_REQUEST)

    alert.status = new_status
    if new_status == 'ACKNOWLEDGED':
        alert.acknowledged_at  = timezone.now()
        alert.acknowledged_by  = request.user
    if request.data.get('notes'):
        alert.notes = request.data['notes']
    alert.save()

    return Response(AlcoholAlertSerializer(alert).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_alcohol_dashboard_summary(request):
    """
    GET /api/alcohol/summary/
    Returns counts used by the admin overview tab.
    """
    user  = request.user
    today = timezone.now().date()

    # ── DRIVER: only their own alerts ─────────────────────────────────────
    if user.user_type == 'DRIVER':
        recent = AlcoholAlert.objects.filter(status='NEW').select_related('driver').order_by('-detected_at')
        return Response({
            'total_alerts':  AlcoholAlert.objects.filter(driver=user).count(),
            'new_alerts':    AlcoholAlert.objects.filter(status='NEW', driver=user).count(),
            'today_alerts':  AlcoholAlert.objects.filter(driver=user, detected_at__date=today).count(),
            'recent_alerts': AlcoholAlertSerializer(recent, many=True).data,
        })
    if user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    today = timezone.now().date()

    total_alerts = AlcoholAlert.objects.count()
    new_alerts   = AlcoholAlert.objects.filter(status='NEW').count()
    today_alerts = AlcoholAlert.objects.filter(detected_at__date=today).count()

    recent = AlcoholAlert.objects.filter(status='NEW').select_related('driver').order_by('-detected_at')
    recent_serialized = AlcoholAlertSerializer(recent, many=True).data

    return Response({
        'total_alerts':  total_alerts,
        'new_alerts':    new_alerts,
        'today_alerts':  today_alerts,
        'recent_alerts': recent_serialized,
    })