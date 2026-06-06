from django.contrib import admin
from .models import DrowsinessAlert, DrowsinessSession

@admin.register(DrowsinessAlert)
class DrowsinessAlertAdmin(admin.ModelAdmin):
    list_display = ['driver', 'severity', 'status', 'eye_closure_duration', 'detected_at', 'email_sent']
    list_filter = ['severity', 'status', 'detected_at', 'email_sent', 'admin_notified']
    search_fields = ['driver__name', 'driver__employee_id']
    readonly_fields = ['detected_at', 'email_sent_at', 'acknowledged_at', 'resolved_at']
    
    fieldsets = (
        ('Alert Information', {
            'fields': ('driver', 'schedule', 'vehicle', 'severity', 'status')
        }),
        ('Detection Data', {
            'fields': ('eye_closure_duration', 'ear_value', 'snapshot')
        }),
        ('Notifications', {
            'fields': ('email_sent', 'email_sent_at', 'admin_notified')
        }),
        ('Timestamps', {
            'fields': ('detected_at', 'acknowledged_at', 'resolved_at')
        }),
        ('Admin Response', {
            'fields': ('admin_remarks',)
        }),
    )

@admin.register(DrowsinessSession)
class DrowsinessSessionAdmin(admin.ModelAdmin):
    list_display = ['driver', 'started_at', 'ended_at', 'duration_minutes', 'total_alerts']
    list_filter = ['started_at']
    search_fields = ['driver__name']