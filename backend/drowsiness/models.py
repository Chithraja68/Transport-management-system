from django.db import models
from django.utils import timezone
from accounts.models import User
from transport.models import Schedule, Vehicle
import pytz
class DrowsinessAlert(models.Model):
    """
    Store drowsiness detection alerts
    This model tracks when drivers show signs of drowsiness
    """
    
    ALERT_SEVERITY = (
        ('LOW', 'Low - Eye closure < 5 seconds'),
        ('MEDIUM', 'Medium - Eye closure 5-10 seconds'),
        ('HIGH', 'High - Eye closure 10-15 seconds'),
        ('CRITICAL', 'Critical - Eye closure > 15 seconds')
    )
    
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('ACKNOWLEDGED', 'Acknowledged'),
        ('RESOLVED', 'Resolved'),
    )
    
    # Who and where
    driver = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='drowsiness_alerts',
        help_text="Driver who triggered the alert"
    )
    schedule = models.ForeignKey(
        Schedule, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        help_text="Active schedule during alert (if any)"
    )
    vehicle = models.ForeignKey(
        Vehicle, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        help_text="Vehicle being driven (if any)"
    )
    
    # Alert details
    severity = models.CharField(
        max_length=20, 
        choices=ALERT_SEVERITY, 
        default='MEDIUM'
    )
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='ACTIVE'
    )
    
    # Detection data
    eye_closure_duration = models.FloatField(
        help_text="Duration in seconds that eyes were closed"
    )
    ear_value = models.FloatField(
        help_text="Eye Aspect Ratio value at time of detection"
    )
    
    # Evidence
    snapshot = models.ImageField(
        upload_to='alerts/%Y/%m/%d/', 
        blank=True, 
        null=True,
        help_text="Photo captured when drowsiness detected"
    )
    
    # Location (if GPS available)
    latitude = models.DecimalField(
        max_digits=9, 
        decimal_places=6, 
        null=True, 
        blank=True,
        help_text="GPS latitude"
    )
    longitude = models.DecimalField(
        max_digits=9, 
        decimal_places=6, 
        null=True, 
        blank=True,
        help_text="GPS longitude"
    )
    
    # Email notification tracking
    email_sent = models.BooleanField(
        default=False,
        help_text="Whether email notification was sent"
    )
    email_sent_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When email was sent"
    )
    admin_notified = models.BooleanField(
        default=False,
        help_text="Whether admin was notified"
    )
    
    # Timestamps
    detected_at = models.DateTimeField(
        default=timezone.now,
        help_text="When drowsiness was detected"
    )
    acknowledged_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When alert was acknowledged by admin"
    )
    resolved_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When alert was marked as resolved"
    )
    
    # Admin remarks
    admin_remarks = models.TextField(
        blank=True,
        help_text="Notes from admin about this alert"
    )
    
    class Meta:
        ordering = ['-detected_at']
        verbose_name = "Drowsiness Alert"
        verbose_name_plural = "Drowsiness Alerts"
        indexes = [
            models.Index(fields=['-detected_at']),
            models.Index(fields=['driver', '-detected_at']),
            models.Index(fields=['status', '-detected_at']),
        ]
        
    def __str__(self):
        local_tz = pytz.timezone('Asia/Kolkata')
        local_time = self.detected_at.astimezone(local_tz)
        return f"{self.driver.name} - {self.severity} - {local_time.strftime('%Y-%m-%d %H:%M')}"
    
    def get_local_detected_time(self):
        """Get detection time in Asia/Kolkata timezone"""
        local_tz = pytz.timezone('Asia/Kolkata')
        return self.detected_at.astimezone(local_tz)
    
    def get_severity_display_class(self):
        """Return Bootstrap/CSS class based on severity"""
        return {
            'LOW': 'warning',
            'MEDIUM': 'alert',
            'HIGH': 'danger',
            'CRITICAL': 'critical'
        }.get(self.severity, 'info')
    
    def get_status_display_class(self):
        """Return Bootstrap/CSS class based on status"""
        return {
            'ACTIVE': 'danger',
            'ACKNOWLEDGED': 'warning',
            'RESOLVED': 'success',
        }.get(self.status, 'secondary')
    
    def get_location_link(self):
        """Get Google Maps link if location available"""
        if self.latitude and self.longitude:
            return f"https://www.google.com/maps?q={self.latitude},{self.longitude}"
        return None
    
    @property
    def is_recent(self):
        """Check if alert is less than 1 hour old"""
        return (timezone.now() - self.detected_at).seconds < 3600
    
    @property
    def time_since_detection(self):
        """Get human-readable time since detection"""
        delta = timezone.now() - self.detected_at
        
        if delta.days > 0:
            return f"{delta.days} day{'s' if delta.days > 1 else ''} ago"
        
        hours = delta.seconds // 3600
        if hours > 0:
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        
        minutes = (delta.seconds % 3600) // 60
        if minutes > 0:
            return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
        
        return "Just now"


class DrowsinessSession(models.Model):
    """
    Track drowsiness monitoring sessions
    Useful for analytics and reporting
    """
    driver = models.ForeignKey(User, on_delete=models.CASCADE)
    schedule = models.ForeignKey(Schedule, on_delete=models.SET_NULL, null=True, blank=True)
    
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    
    total_alerts = models.IntegerField(default=0)
    duration_minutes = models.IntegerField(default=0, help_text="Session duration in minutes")
    
    # Session stats
    avg_ear = models.FloatField(default=0, help_text="Average EAR during session")
    min_ear = models.FloatField(default=0, help_text="Minimum EAR during session")
    
    class Meta:
        ordering = ['-started_at']
        
    def __str__(self):
        local_tz = pytz.timezone('Asia/Kolkata')
        local_time = self.started_at.astimezone(local_tz)
        return f"{self.driver.name} - {local_time.strftime('%Y-%m-%d %H:%M')}"
    
    def end_session(self):
        """End the monitoring session"""
        if not self.ended_at:
            self.ended_at = timezone.now()
            duration = (self.ended_at - self.started_at).seconds // 60
            self.duration_minutes = duration
            self.save()