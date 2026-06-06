from rest_framework import serializers
from .models import DrowsinessAlert, DrowsinessSession
from accounts.serializers import UserSerializer

class DrowsinessAlertSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.name', read_only=True)
    driver_phone = serializers.CharField(source='driver.phone_number', read_only=True)
    vehicle_number = serializers.CharField(source='vehicle.vehicle_number', read_only=True)
    route_name = serializers.CharField(source='schedule.route.route_name', read_only=True)
    time_since_detection = serializers.CharField(read_only=True)
    
    class Meta:
        model = DrowsinessAlert
        fields = '__all__'
        read_only_fields = ['detected_at', 'email_sent', 'email_sent_at']

class DrowsinessAlertCreateSerializer(serializers.Serializer):
    driver_id = serializers.IntegerField()
    schedule_id = serializers.IntegerField(required=False, allow_null=True)
    eye_closure_duration = serializers.FloatField()
    ear_value = serializers.FloatField()
    snapshot = serializers.ImageField(required=False)

class DrowsinessSessionSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.name', read_only=True)
    
    class Meta:
        model = DrowsinessSession
        fields = '__all__'