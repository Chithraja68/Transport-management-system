from django.contrib import admin
from .models import User, OTPVerification

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'name', 'user_type', 'phone_number', 'is_active']
    list_filter = ['user_type', 'is_active']
    search_fields = ['username', 'name', 'phone_number', 'employee_id']

@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    list_display = ['phone_number', 'otp', 'created_at', 'is_verified']
    list_filter = ['is_verified', 'created_at']