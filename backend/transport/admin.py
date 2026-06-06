from django.contrib import admin
from .models import *

@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ['name', 'code']
    search_fields = ['name', 'code']

@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ['vehicle_number', 'vehicle_type', 'district', 'status']
    list_filter = ['status', 'district']
    search_fields = ['vehicle_number']

@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ['route_number', 'route_name', 'district', 'distance_km']
    list_filter = ['district']
    search_fields = ['route_number', 'route_name']

@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ['route', 'vehicle', 'driver', 'schedule_date', 'departure_time']
    list_filter = ['schedule_date', 'is_active']

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['booking_id', 'passenger', 'schedule', 'status', 'booking_date']
    list_filter = ['status', 'booking_date']
    search_fields = ['booking_id']

@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ['staff', 'leave_type', 'start_date', 'end_date', 'status']
    list_filter = ['status', 'leave_type']

@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = ['complaint_id', 'complainant', 'priority', 'status', 'created_date']
    list_filter = ['status', 'priority']

@admin.register(Payroll)
class PayrollAdmin(admin.ModelAdmin):
    list_display = ['staff', 'month', 'net_salary', 'payment_status']
    list_filter = ['payment_status', 'month']

@admin.register(SeatRestriction)
class SeatRestrictionAdmin(admin.ModelAdmin):
    list_display = ['seat_number', 'schedule', 'restriction_type', 'is_female_only', 'is_active', 'caused_by_booking']
    list_filter = ['restriction_type', 'is_female_only', 'is_active', 'schedule']
    search_fields = ['seat_number', 'schedule__route__route_name']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('schedule', 'caused_by_booking')

@admin.register(BusLocation)
class BusLocationAdmin(admin.ModelAdmin):
    list_display = ['schedule', 'latitude', 'longitude', 'speed', 'timestamp', 'device_type', 'is_gps_enabled']
    list_filter = ['is_gps_enabled', 'is_moving', 'device_type', 'timestamp']
    search_fields = ['schedule__route__route_name', 'schedule__vehicle__vehicle_number']
    readonly_fields = ['timestamp']
    date_hierarchy = 'timestamp'

@admin.register(BusLocationHistory)
class BusLocationHistoryAdmin(admin.ModelAdmin):
    list_display = ['schedule', 'latitude', 'longitude', 'speed', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['schedule__route__route_name', 'schedule__vehicle__vehicle_number']
    readonly_fields = ['timestamp']
    date_hierarchy = 'timestamp'


@admin.register(MockPayment)
class MockPaymentAdmin(admin.ModelAdmin):
    list_display = ['payment_id', 'user', 'amount', 'status', 'payment_method', 'paid_at', 'created_at']
    list_filter = ['status', 'payment_method', 'created_at']
    search_fields = ['payment_id', 'user__name', 'user__phone_number']
    readonly_fields = ['payment_id', 'created_at', 'paid_at']
    date_hierarchy = 'created_at'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user')

@admin.register(MockRefund)
class MockRefundAdmin(admin.ModelAdmin):
    list_display = ['refund_id', 'payment', 'booking', 'amount', 'status', 'instant_refund', 'processed_at', 'created_at']
    list_filter = ['status', 'instant_refund', 'created_at']
    search_fields = ['refund_id', 'payment__payment_id', 'booking__booking_id']
    readonly_fields = ['refund_id', 'created_at', 'processed_at']
    date_hierarchy = 'created_at'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('payment', 'booking', 'initiated_by')
