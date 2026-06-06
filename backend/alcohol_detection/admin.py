from django.contrib import admin
from .models import AlcoholAlert

@admin.register(AlcoholAlert)
class AlcoholAlertAdmin(admin.ModelAdmin):
    list_display   = ['id', 'detected_at', 'sensor_value', 'threshold',
                      'get_driver_name', 'status', 'email_sent']
    list_filter    = ['status', 'email_sent', 'detected_at']
    search_fields  = ['driver__name', 'driver__username', 'driver__employee_id']
    readonly_fields = ['detected_at', 'sensor_value', 'threshold',
                       'driver', 'email_sent', 'acknowledged_at', 'acknowledged_by']
    ordering = ['-detected_at']

    def get_driver_name(self, obj):
        return obj.driver.name if obj.driver else 'No Driver Assigned'
    get_driver_name.short_description = 'Driver'