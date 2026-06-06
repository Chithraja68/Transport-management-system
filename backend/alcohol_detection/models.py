from django.db import models
from django.utils import timezone
from accounts.models import User


class AlcoholAlert(models.Model):
    """
    Stores every alcohol detection alert triggered by alcohol_monitor.py
    Shown in Admin Dashboard → Alcohol Alerts tab
    """
    CONTEXT_CHOICES = (
        ('DRIVING', 'Detected During Driving'),
        ('LOGIN',   'Login Cancelled — Pre-Drive Check'),
    )

    STATUS_CHOICES = (
        ('NEW',          'New'),
        ('ACKNOWLEDGED', 'Acknowledged'),
        ('RESOLVED',     'Resolved'),
    )

    driver = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='alcohol_alerts',
        limit_choices_to={'user_type': 'DRIVER'},
    )
    sensor_value   = models.IntegerField(help_text='Raw MQ3 sensor value (0–4095)')
    threshold      = models.IntegerField(default=1500, help_text='Threshold used at detection time')
    alert_context  = models.CharField(             # ← ADD THIS
        max_length=10,
        choices=CONTEXT_CHOICES,
        default='DRIVING',
        help_text='Was this detected during driving or at login?'
    )
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NEW')
    email_sent     = models.BooleanField(default=False)
    notes          = models.TextField(blank=True, null=True)
    detected_at    = models.DateTimeField(default=timezone.now)
    acknowledged_at  = models.DateTimeField(null=True, blank=True)
    acknowledged_by  = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acknowledged_alcohol_alerts',
    )

    class Meta:
        ordering = ['-detected_at']
        verbose_name = 'Alcohol Alert'
        verbose_name_plural = 'Alcohol Alerts'

    def __str__(self):
        driver_name = self.driver.name if self.driver else 'Unknown Driver'
        local_time  = timezone.localtime(self.detected_at)
        return f"[ALCOHOL] Value:{self.sensor_value} — {driver_name} — {local_time.strftime('%Y-%m-%d %H:%M:%S')}"

    @property
    def time_since_detection(self):
        delta = timezone.now() - self.detected_at
        if delta.days > 0:
            return f"{delta.days} day{'s' if delta.days > 1 else ''} ago"
        seconds = int(delta.total_seconds())
        if seconds < 60:
            return f"{seconds}s ago"
        elif seconds < 3600:
            return f"{seconds // 60}m ago"
        else:
            return f"{seconds // 3600}h ago"