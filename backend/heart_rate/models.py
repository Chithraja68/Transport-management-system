from django.db import models
from django.utils import timezone
from accounts.models import User


class HeartRateAlert(models.Model):
    """
    Stores every heart rate alert triggered by heart_monitor.py
    Shown in Admin Dashboard → Heart Rate Alerts tab
    """
    ALERT_TYPE_CHOICES = (
        ('HIGH', '🔥 Heart Rate Too High'),
        ('LOW',  '❄️ Heart Rate Too Low'),
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
        related_name='heart_rate_alerts',
        limit_choices_to={'user_type': 'DRIVER'},
    )
    alert_type    = models.CharField(max_length=10, choices=ALERT_TYPE_CHOICES)
    heart_rate    = models.FloatField(help_text='BPM at time of alert')
    threshold_low  = models.FloatField(default=50)
    threshold_high = models.FloatField(default=120)
    status        = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NEW')
    email_sent    = models.BooleanField(default=False)
    notes         = models.TextField(blank=True, null=True)
    detected_at   = models.DateTimeField(default=timezone.now)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acknowledged_hr_alerts',
    )

    class Meta:
        ordering = ['-detected_at']
        verbose_name = 'Heart Rate Alert'
        verbose_name_plural = 'Heart Rate Alerts'

    def __str__(self):
        driver_name = self.driver.name if self.driver else 'Unknown Driver'
        local_time = timezone.localtime(self.detected_at)
        return f"[{self.alert_type}] {self.heart_rate} BPM — {driver_name} — {local_time.strftime('%Y-%m-%d %H:%M:%S')}"

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