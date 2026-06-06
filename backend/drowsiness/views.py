from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.mail import EmailMessage
from django.conf import settings
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Count, Avg, Q,Min
from datetime import timedelta

from .models import DrowsinessAlert, DrowsinessSession
from .serializers import (
    DrowsinessAlertSerializer, 
    DrowsinessAlertCreateSerializer,
    DrowsinessSessionSerializer
)
from accounts.models import User
from transport.models import Schedule
import pytz
import logging

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_drowsiness_alert(request):
    """
    Create a drowsiness alert when detection occurs
    Called from frontend drowsiness detection component
    
    Expected data:
    - driver_id: int
    - schedule_id: int (optional)
    - eye_closure_duration: float
    - ear_value: float
    - snapshot: image file
    - latitude: decimal (optional)
    - longitude: decimal (optional)
    """
    try:
        serializer = DrowsinessAlertCreateSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.error(f"Validation error: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        # Get driver
        driver = get_object_or_404(User, id=data['driver_id'])
        
        # Verify driver is actually a driver
        if driver.user_type != 'DRIVER':
            return Response({
                'error': 'User is not a driver'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get schedule if provided
        schedule = None
        vehicle = None
        if 'schedule_id' in data and data['schedule_id']:
            schedule = get_object_or_404(Schedule, id=data['schedule_id'])
            vehicle = schedule.vehicle
        
        # Determine severity based on duration
        duration = data['eye_closure_duration']
        if duration < 5:
            severity = 'LOW'
        elif duration < 10:
            severity = 'MEDIUM'
        elif duration < 15:
            severity = 'HIGH'
        else:
            severity = 'CRITICAL'
        
        # Create alert
        alert = DrowsinessAlert.objects.create(
            driver=driver,
            schedule=schedule,
            vehicle=vehicle,
            severity=severity,
            eye_closure_duration=duration,
            ear_value=data['ear_value'],
            snapshot=data.get('snapshot')
        )
        
        logger.info(f"Alert created: {alert.id} for driver {driver.name}")
        
        # Send email notification asynchronously
        try:
            send_drowsiness_email(alert)
        except Exception as e:
            logger.error(f"Failed to send email for alert {alert.id}: {e}")
            # Don't fail the request if email fails
        
        return Response({
            'message': 'Alert created successfully',
            'alert_id': alert.id,
            'severity': severity,
            'email_sent': alert.email_sent
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating alert: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_drowsiness_alerts(request):
    """
    Get drowsiness alerts
    - Admin: sees all alerts (with filters)
    - Driver: sees only their own alerts
    
    Query params:
    - status: filter by status
    - severity: filter by severity
    - driver_id: filter by driver (admin only)
    - date_from: filter from date
    - date_to: filter to date
    """
    try:
        user = request.user
        
        # Base queryset
        if user.user_type == 'ADMIN':
            alerts = DrowsinessAlert.objects.all()
            
            # Apply filters
            status_filter = request.GET.get('status')
            severity_filter = request.GET.get('severity')
            driver_id = request.GET.get('driver_id')
            date_from = request.GET.get('date_from')
            date_to = request.GET.get('date_to')
            
            if status_filter:
                alerts = alerts.filter(status=status_filter)
            if severity_filter:
                alerts = alerts.filter(severity=severity_filter)
            if driver_id:
                alerts = alerts.filter(driver_id=driver_id)
            if date_from:
                alerts = alerts.filter(detected_at__gte=date_from)
            if date_to:
                alerts = alerts.filter(detected_at__lte=date_to)
                
        elif user.user_type == 'DRIVER':
            # Drivers see only their own alerts
            alerts = DrowsinessAlert.objects.filter(driver=user)
        else:
            # Other user types can't access alerts
            return Response({
                'error': 'Access denied'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Select related to optimize queries
        alerts = alerts.select_related('driver', 'schedule', 'vehicle')
        
        serializer = DrowsinessAlertSerializer(alerts, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting alerts: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_alert_detail(request, alert_id):
    """Get detailed information about a specific alert"""
    try:
        user = request.user
        
        alert = get_object_or_404(DrowsinessAlert, id=alert_id)
        
        # Check permissions
        if user.user_type != 'ADMIN' and alert.driver != user:
            return Response({
                'error': 'Access denied'
            }, status=status.HTTP_403_FORBIDDEN)
        
        serializer = DrowsinessAlertSerializer(alert)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting alert detail: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH', 'PUT'])
@permission_classes([IsAuthenticated])
def update_alert_status(request, alert_id):
    """
    Update alert status (acknowledge or resolve)
    Admin only
    
    Expected data:
    - status: 'ACKNOWLEDGED' or 'RESOLVED'
    - admin_remarks: optional text
    """
    try:
        user = request.user
        
        # Check admin permission
        if user.user_type != 'ADMIN':
            return Response({
                'error': 'Admin access required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        alert = get_object_or_404(DrowsinessAlert, id=alert_id)
        
        # Get new status
        new_status = request.data.get('status')
        admin_remarks = request.data.get('admin_remarks', '')
        
        # Validate status
        valid_statuses = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']
        if new_status not in valid_statuses:
            return Response({
                'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update alert
        alert.status = new_status
        alert.admin_remarks = admin_remarks
        
        # Update timestamps
        if new_status == 'ACKNOWLEDGED' and not alert.acknowledged_at:
            alert.acknowledged_at = timezone.now()
        elif new_status == 'RESOLVED' and not alert.resolved_at:
            alert.resolved_at = timezone.now()
        
        alert.save()
        
        logger.info(f"Alert {alert_id} status updated to {new_status} by {user.name}")
        
        serializer = DrowsinessAlertSerializer(alert)
        return Response({
            'message': f'Alert status updated to {new_status}',
            'alert': serializer.data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error updating alert status: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_alert(request, alert_id):
    """
    Delete an alert
    Admin only
    """
    try:
        user = request.user
        
        # Check admin permission
        if user.user_type != 'ADMIN':
            return Response({
                'error': 'Admin access required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        alert = get_object_or_404(DrowsinessAlert, id=alert_id)
        alert_info = f"Alert {alert_id} for driver {alert.driver.name}"
        
        alert.delete()
        
        logger.info(f"{alert_info} deleted by {user.name}")
        
        return Response({
            'message': 'Alert deleted successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error deleting alert: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_driver_stats(request):
    """
    Get drowsiness statistics for a driver
    Query params:
    - driver_id: (admin only, defaults to current user for drivers)
    - days: number of days to include (default: 30)
    """
    try:
        user = request.user
        days = int(request.GET.get('days', 30))
        
        # Determine which driver to get stats for
        if user.user_type == 'ADMIN':
            driver_id = request.GET.get('driver_id', user.id)
        else:
            driver_id = user.id
        
        driver = get_object_or_404(User, id=driver_id)
        
        # Check permissions
        if user.user_type != 'ADMIN' and driver != user:
            return Response({
                'error': 'Access denied'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Calculate date range
        start_date = timezone.now() - timedelta(days=days)
        
        # Get alerts in range
        alerts = DrowsinessAlert.objects.filter(
            driver=driver,
            detected_at__gte=start_date
        )
        
        # Calculate statistics
        stats = {
            'driver_name': driver.name,
            'total_alerts': alerts.count(),
            'critical_alerts': alerts.filter(severity='CRITICAL').count(),
            'high_alerts': alerts.filter(severity='HIGH').count(),
            'medium_alerts': alerts.filter(severity='MEDIUM').count(),
            'low_alerts': alerts.filter(severity='LOW').count(),
            'active_alerts': alerts.filter(status='ACTIVE').count(),
            'acknowledged_alerts': alerts.filter(status='ACKNOWLEDGED').count(),
            'resolved_alerts': alerts.filter(status='RESOLVED').count(),
        }
        
        # Calculate averages
        if alerts.exists():
            avg_data = alerts.aggregate(
                avg_ear=Avg('ear_value'),
                avg_closure=Avg('eye_closure_duration')
            )
            stats['avg_ear'] = avg_data['avg_ear']
            stats['avg_closure'] = avg_data['avg_closure']
        else:
            stats['avg_ear'] = None
            stats['avg_closure'] = None
        
        return Response(stats, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting driver stats: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_dashboard_summary(request):
    """
    Get dashboard summary for admins
    Shows overview of all alerts
    """
    try:
        user = request.user
        
        if user.user_type != 'ADMIN':
            return Response({
                'error': 'Admin access required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get time ranges
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)
        
        # Get alerts
        all_alerts = DrowsinessAlert.objects.all()
        
        # Count by time period
        today_alerts = all_alerts.filter(detected_at__gte=today_start).count()
        yesterday_alerts = all_alerts.filter(
            detected_at__gte=yesterday_start,
            detected_at__lt=today_start
        ).count()
        week_alerts = all_alerts.filter(detected_at__gte=week_start).count()
        month_alerts = all_alerts.filter(detected_at__gte=month_start).count()
        
        # Count by status
        active_alerts = all_alerts.filter(status='ACTIVE').count()
        acknowledged_alerts = all_alerts.filter(status='ACKNOWLEDGED').count()
        resolved_alerts = all_alerts.filter(status='RESOLVED').count()
        
        # Count by severity
        critical_count = all_alerts.filter(severity='CRITICAL').count()
        high_count = all_alerts.filter(severity='HIGH').count()
        medium_count = all_alerts.filter(severity='MEDIUM').count()
        low_count = all_alerts.filter(severity='LOW').count()
        total_alerts = all_alerts.count()
        
        # Calculate statistics
        stats = all_alerts.aggregate(
            avg_ear=Avg('ear_value'),
            avg_closure=Avg('eye_closure_duration')
        )
        
        # Count total unique drivers with alerts
        total_drivers = all_alerts.values('driver').distinct().count()
        
        # Find safest driver (driver with least alerts or no alerts)
        safest_driver = None
        try:
            # Get all drivers
            all_drivers = User.objects.filter(user_type='DRIVER')
            driver_alert_counts = []
            
            for driver in all_drivers:
                alert_count = DrowsinessAlert.objects.filter(driver=driver).count()
                driver_alert_counts.append({
                    'driver': driver,
                    'count': alert_count
                })
            
            # Sort by count (ascending) - driver with least alerts
            if driver_alert_counts:
                driver_alert_counts.sort(key=lambda x: x['count'])
                safest_driver = driver_alert_counts[0]['driver'].name
        except Exception as e:
            logger.warning(f"Could not determine safest driver: {e}")
            safest_driver = 'N/A'
        
        # Get recent critical alerts with vehicle info
        recent_alerts = all_alerts.filter(
            Q(severity='CRITICAL') | Q(severity='HIGH')
        ).select_related('driver', 'vehicle').order_by('-detected_at')[:10]
        
        recent_alerts_data = [{
            'id': alert.id,
            'driver_name': alert.driver.name,
            'vehicle_number': alert.vehicle.vehicle_number if alert.vehicle else None,
            'severity': alert.severity,
            'time_since_detection': alert.time_since_detection,
            'detected_at': alert.detected_at
        } for alert in recent_alerts]
        # ========================================================================
        # HIGH-PRIORITY ACTIVE ALERTS (For Overview Notifications)
        # Get ALL active alerts (not just CRITICAL/HIGH) for overview display
        # ========================================================================
        high_priority_alerts = DrowsinessAlert.objects.filter(
            status='ACTIVE'  # Show ALL new/active alerts
        ).select_related('driver', 'vehicle', 'schedule').order_by('-detected_at')
        
        high_priority_alerts_data = []
        for alert in high_priority_alerts:
            high_priority_alerts_data.append({
                'id': alert.id,
                'driver_name': alert.driver.name,
                'driver_phone': alert.driver.phone_number,
                'severity': alert.severity,
                'status': alert.status,
                'eye_closure_duration': alert.eye_closure_duration,
                'ear_value': alert.ear_value,
                'vehicle_number': alert.vehicle.vehicle_number if alert.vehicle else None,
                'route_name': alert.schedule.route.route_name if alert.schedule and alert.schedule.route else None,
                'detected_at': alert.detected_at.isoformat(),
                'time_since_detection': alert.time_since_detection,
                'snapshot_url': alert.snapshot.url if alert.snapshot else None,
                'location_link': alert.get_location_link()
            })
        summary = {
            # Main metrics
            'active_alerts': active_alerts,
            'acknowledged_alerts': acknowledged_alerts,
            'resolved_alerts': resolved_alerts,
            'today_alerts': today_alerts,
            'yesterday_alerts': yesterday_alerts,
            'week_alerts': week_alerts,
            'month_alerts': month_alerts,
            
            # Severity counts
            'critical_count': critical_count,
            'high_count': high_count,
            'medium_count': medium_count,
            'low_count': low_count,
            'total_alerts': total_alerts,
            
            # Statistics
            'avg_ear': stats['avg_ear'],
            'avg_closure': stats['avg_closure'],
            'total_drivers': total_drivers,
            'safest_driver': safest_driver,
            
            # Recent alerts
            'recent_alerts': recent_alerts_data,
            
            # ADD THESE TWO LINES:
            'high_priority_drowsiness_alerts': high_priority_alerts_data,
            'high_priority_drowsiness_count': len(high_priority_alerts_data),
        }
        
        return Response(summary, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting dashboard summary: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def send_drowsiness_email(alert):
    """
    Send email notification to admin when drowsiness detected
    
    Args:
        alert: DrowsinessAlert instance
    """
    try:
        
        local_tz = pytz.timezone('Asia/Kolkata')
        local_detected_time = alert.detected_at.astimezone(local_tz)
        subject = f"🚨 EMERGENCY ALERT - Driver Drowsiness Detected [{alert.severity}]"
        
        # Build email body
        body = f"""
EMERGENCY ALERT - Driver Drowsiness Detected
{'='*70}

SEVERITY: {alert.severity}
STATUS: {alert.status}

Driver Information:
------------------
Name: {alert.driver.name}
Employee ID: {alert.driver.employee_id or 'N/A'}
Phone: {alert.driver.phone_number}
Email: {alert.driver.email or 'N/A'}

Alert Details:
-------------
Eye Closure Duration: {alert.eye_closure_duration:.2f} seconds
Eye Aspect Ratio: {alert.ear_value:.3f}
Detected At: {local_detected_time.strftime('%Y-%m-%d %H:%M:%S')} IST

Vehicle Information:
-------------------
Vehicle Number: {alert.vehicle.vehicle_number if alert.vehicle else 'N/A'}
Route: {alert.schedule.route.route_name if alert.schedule else 'N/A'}
Schedule Date: {alert.schedule.schedule_date if alert.schedule else 'N/A'}
Departure Time: {alert.schedule.departure_time if alert.schedule else 'N/A'}
{'='*70}

⚠️ IMMEDIATE ACTION REQUIRED!

Please contact the driver immediately at {alert.driver.phone_number}

If this is a CRITICAL alert, consider:
1. Contacting emergency services
2. Sending nearby support staff
3. Initiating emergency protocols

---
This is an automated alert from the Transport Management System.
Alert ID: {alert.id}
Timestamp: {local_detected_time.strftime('%Y-%m-%d %H:%M:%S')} IST
        """
        
        # Create email
        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=settings.EMAIL_HOST_USER,
            to=[settings.EMAIL_HOST_USER, 'srajapriya650@gmail.com', 'makshaya500@gmail.com','abiramivenkatesan8059@gmail.com'],  # Admin emails
        )
        
        # Attach snapshot if available
        if alert.snapshot:
            try:
                email.attach_file(alert.snapshot.path)
            except Exception as e:
                logger.error(f"Failed to attach snapshot: {e}")
        
        # Send email
        email.send(fail_silently=False)
        
        # Mark as sent
        alert.email_sent = True
        alert.email_sent_at = timezone.now()
        alert.admin_notified = True
        alert.save(update_fields=['email_sent', 'email_sent_at', 'admin_notified'])
        
        logger.info(f"✅ Alert email sent for alert {alert.id} - Driver: {alert.driver.name}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send email for alert {alert.id}: {e}")
        return False





@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_monitoring_session(request):
    """
    Start a new monitoring session
    """
    try:
        driver_id = request.data.get('driver_id')
        schedule_id = request.data.get('schedule_id')
        
        driver = get_object_or_404(User, id=driver_id)
        
        schedule = None
        if schedule_id:
            schedule = get_object_or_404(Schedule, id=schedule_id)
        
        # Create session
        session = DrowsinessSession.objects.create(
            driver=driver,
            schedule=schedule
        )
        
        return Response({
            'message': 'Monitoring session started',
            'session_id': session.id
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error starting session: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def end_monitoring_session(request, session_id):
    """
    End a monitoring session and calculate statistics
    UPDATED VERSION - Automatically calculates session stats
    """
    try:
        session = get_object_or_404(DrowsinessSession, id=session_id)
        
        # End the session (sets ended_at and calculates duration)
        session.end_session()
        
        # Calculate statistics from all alerts during this session
        alerts = DrowsinessAlert.objects.filter(
            driver=session.driver,
            detected_at__gte=session.started_at,
            detected_at__lte=session.ended_at
        )
        
        # Update alert count
        session.total_alerts = alerts.count()
        
        # Calculate EAR statistics if there are alerts
        if alerts.exists():
            stats = alerts.aggregate(
                avg_ear=Avg('ear_value'),
                min_ear=Min('ear_value')
            )
            session.avg_ear = round(stats['avg_ear'], 3) if stats['avg_ear'] else 0
            session.min_ear = round(stats['min_ear'], 3) if stats['min_ear'] else 0
        else:
            session.avg_ear = 0.0
            session.min_ear = 0.0
        
        # Save all updates
        session.save()
        
        logger.info(f"Session {session_id} ended - Duration: {session.duration_minutes}m, Alerts: {session.total_alerts}")
        
        return Response({
            'message': 'Monitoring session ended',
            'duration_minutes': session.duration_minutes,
            'total_alerts': session.total_alerts,
            'avg_ear': session.avg_ear,
            'min_ear': session.min_ear
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error ending session: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================================
# OPTIONAL: Real-time Session Stats Update
# ============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_session_stats(request, session_id):
    """
    Update session statistics in real-time
    Call this after each alert to keep stats current
    OPTIONAL - Session stats are calculated on end anyway
    """
    try:
        session = get_object_or_404(DrowsinessSession, id=session_id)
        
        # Get all alerts during this session (including ongoing session)
        alerts = DrowsinessAlert.objects.filter(
            driver=session.driver,
            detected_at__gte=session.started_at
        )
        
        # If session ended, only count alerts up to end time
        if session.ended_at:
            alerts = alerts.filter(detected_at__lte=session.ended_at)
        
        # Update stats
        session.total_alerts = alerts.count()
        
        if alerts.exists():
            stats = alerts.aggregate(
                avg_ear=Avg('ear_value'),
                min_ear=Min('ear_value')
            )
            session.avg_ear = round(stats['avg_ear'], 3) if stats['avg_ear'] else 0
            session.min_ear = round(stats['min_ear'], 3) if stats['min_ear'] else 0
        
        session.save()
        
        return Response({
            'message': 'Session stats updated',
            'total_alerts': session.total_alerts,
            'avg_ear': session.avg_ear,
            'min_ear': session.min_ear
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error updating session stats: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================================
# ENHANCED GET SESSIONS WITH STATS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_drowsiness_sessions(request):
    """
    Get drowsiness sessions with statistics
    Filters:
    - driver_id: Filter by driver (admin only)
    - date_from: Filter from date
    - date_to: Filter to date
    """
    try:
        user = request.user
        
        # Base queryset
        if user.user_type == 'ADMIN':
            sessions = DrowsinessSession.objects.all()
            
            # Apply filters
            driver_id = request.GET.get('driver_id')
            date_from = request.GET.get('date_from')
            date_to = request.GET.get('date_to')
            
            if driver_id:
                sessions = sessions.filter(driver_id=driver_id)
            if date_from:
                sessions = sessions.filter(started_at__gte=date_from)
            if date_to:
                sessions = sessions.filter(started_at__lte=date_to)
                
        elif user.user_type == 'DRIVER':
            # Drivers see only their own sessions
            sessions = DrowsinessSession.objects.filter(driver=user)
        else:
            return Response({
                'error': 'Access denied'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Select related to optimize queries
        sessions = sessions.select_related('driver', 'schedule').order_by('-started_at')
        
        serializer = DrowsinessSessionSerializer(sessions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting sessions: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================================
# SESSION SUMMARY STATISTICS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_session_summary(request):
    """
    Get summary statistics for all sessions
    Admin only
    """
    try:
        if request.user.user_type != 'ADMIN':
            return Response({
                'error': 'Admin access required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get time range (default: last 30 days)
        days = int(request.GET.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)
        
        # Get sessions in range
        sessions = DrowsinessSession.objects.filter(
            started_at__gte=start_date
        )
        
        # Calculate summary
        summary = {
            'total_sessions': sessions.count(),
            'total_duration_minutes': sum(s.duration_minutes for s in sessions),
            'total_alerts': sum(s.total_alerts for s in sessions),
            'sessions_with_alerts': sessions.filter(total_alerts__gt=0).count(),
            'average_session_duration': sessions.aggregate(Avg('duration_minutes'))['duration_minutes__avg'] or 0,
            'average_alerts_per_session': sessions.aggregate(Avg('total_alerts'))['total_alerts__avg'] or 0,
        }
        
        return Response(summary, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting session summary: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)