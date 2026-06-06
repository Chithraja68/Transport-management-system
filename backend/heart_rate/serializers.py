from rest_framework import serializers
from .models import HeartRateAlert
from accounts.serializers import UserSerializer


class HeartRateAlertSerializer(serializers.ModelSerializer):
    driver_name  = serializers.CharField(source='driver.name',          read_only=True, default='Unknown')
    driver_phone = serializers.CharField(source='driver.phone_number',   read_only=True, default='N/A')
    driver_id_no = serializers.CharField(source='driver.employee_id',    read_only=True, default='N/A')
    acknowledged_by_name = serializers.CharField(
        source='acknowledged_by.name', read_only=True, default=None
    )
    time_since_detection = serializers.CharField(read_only=True)

    class Meta:
        model  = HeartRateAlert
        fields = [
            'id', 'driver', 'driver_name', 'driver_phone', 'driver_id_no',
            'alert_type', 'heart_rate', 'threshold_low', 'threshold_high',
            'status', 'email_sent', 'notes', 'detected_at',
            'acknowledged_at', 'acknowledged_by', 'acknowledged_by_name',
            'time_since_detection',
        ]
        read_only_fields = ['id', 'detected_at', 'email_sent']