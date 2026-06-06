from rest_framework import serializers
from .models import User, OTPVerification

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone_number', 'name', 'user_type', 
                  'employee_id', 'employee_status', 'working_district', 'is_active', 'date_joined']
        read_only_fields = ['id', 'date_joined']

class PassengerRegistrationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    phone_number = serializers.CharField(max_length=15)
    email = serializers.EmailField(required=False, allow_blank=True)

class StaffRegistrationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    employee_status = serializers.CharField(max_length=50)
    employee_id = serializers.CharField(max_length=50)
    working_district = serializers.CharField(max_length=100)
    phone_number = serializers.CharField(max_length=15)

class OTPVerificationSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    otp = serializers.CharField(max_length=6)

class CreateUserSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
