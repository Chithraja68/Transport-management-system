from rest_framework import serializers
from .models import AlcoholAlert


class AlcoholAlertSerializer(serializers.ModelSerializer):
    driver_name          = serializers.CharField(source='driver.name',          read_only=True, default='Unknown')
    driver_phone         = serializers.CharField(source='driver.phone_number',   read_only=True, default='N/A')
    driver_id_no         = serializers.CharField(source='driver.employee_id',    read_only=True, default='N/A')
    acknowledged_by_name = serializers.CharField(source='acknowledged_by.name',  read_only=True, default=None)
    time_since_detection = serializers.CharField(read_only=True)
    alert_context_display = serializers.CharField(source='get_alert_context_display', read_only=True) 
    class Meta:
        model  = AlcoholAlert
        fields = [
            'id', 'driver', 'driver_name', 'driver_phone', 'driver_id_no',
            'sensor_value', 'threshold','alert_context', 'alert_context_display',
            'status', 'email_sent', 'notes', 'detected_at',
            'acknowledged_at', 'acknowledged_by', 'acknowledged_by_name',
            'time_since_detection',
        ]
        read_only_fields = ['id', 'detected_at', 'email_sent']