from django.contrib import admin
from .models import HeartRateAlert


@admin.register(HeartRateAlert)
class HeartRateAlertAdmin(admin.ModelAdmin):
    list_display  = [
        'id', 'detected_at', 'alert_type', 'heart_rate',
        'get_driver_name', 'status', 'email_sent',
    ]
    list_filter   = ['alert_type', 'status', 'email_sent', 'detected_at']
    search_fields = ['driver__name', 'driver__username', 'driver__employee_id']
    readonly_fields = [
        'detected_at', 'heart_rate', 'alert_type',
        'driver', 'threshold_low', 'threshold_high',
        'email_sent', 'acknowledged_at', 'acknowledged_by',
    ]
    ordering = ['-detected_at']
    list_per_page = 25

    fieldsets = (
        ('Alert Info', {
            'fields': ('alert_type', 'heart_rate', 'threshold_low', 'threshold_high', 'detected_at')
        }),
        ('Driver', {
            'fields': ('driver',)
        }),
        ('Status', {
            'fields': ('status', 'email_sent', 'notes', 'acknowledged_at', 'acknowledged_by')
        }),
    )
    def get_driver_name(self, obj):
        return obj.driver.name if obj.driver else 'No Driver Assigned'
    get_driver_name.short_description = 'Driver'