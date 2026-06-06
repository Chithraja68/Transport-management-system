from rest_framework import serializers
from .models import (
    District, Vehicle, Route, Schedule, Booking, 
    LeaveRequest, Complaint, Payroll,EmergencyNotification, NotificationRecipient,MockPayment, MockRefund

)
from accounts.serializers import UserSerializer 

class DistrictSerializer(serializers.ModelSerializer):
    class Meta:
        model = District
        fields = '__all__'

class VehicleSerializer(serializers.ModelSerializer):
    district_name = serializers.CharField(source='district.name', read_only=True)
    women_seats_list = serializers.SerializerMethodField()
    class Meta:
        model = Vehicle
        fields = '__all__'
    def get_women_seats_list(self, obj):
        return obj.get_women_seats()
    
class RouteSerializer(serializers.ModelSerializer):
    district_name = serializers.CharField(source='district.name', read_only=True)
    stops_list = serializers.SerializerMethodField()
    
    class Meta:
        model = Route
        fields = '__all__'
    
    def get_stops_list(self, obj):
        """Return stops as a list instead of comma-separated string"""
        if obj.stops:
            return [stop.strip() for stop in obj.stops.split(',')]
        return []

class ScheduleSerializer(serializers.ModelSerializer):
    # Nested Serializers used by Search and Booking tabs
    route_details = RouteSerializer(source='route', read_only=True)
    vehicle_details = VehicleSerializer(source='vehicle', read_only=True)
    
    driver_name = serializers.CharField(source='driver.name', read_only=True)
    conductor_name = serializers.CharField(source='conductor.name', read_only=True, allow_null=True)
    
    booked_seats_list = serializers.SerializerMethodField()
    women_seats_list = serializers.SerializerMethodField()
    seat_layout = serializers.CharField(source='vehicle.seat_layout', read_only=True)
    total_rows = serializers.IntegerField(source='vehicle.total_rows', read_only=True)
    last_row_seats = serializers.IntegerField(source='vehicle.last_row_seats', read_only=True)
    class Meta:
        model = Schedule
        fields = '__all__'
    def get_booked_seats_list(self, obj):
        return obj.get_booked_seats()
    
    def get_women_seats_list(self, obj):
        return obj.vehicle.get_women_seats()
class BookingSerializer(serializers.ModelSerializer):
    passenger_name = serializers.CharField(source='passenger.name', read_only=True)
    passenger_phone = serializers.CharField(source='passenger.phone_number', read_only=True)
    
    schedule_details = ScheduleSerializer(source='schedule', read_only=True)
    seat_numbers_list = serializers.SerializerMethodField()
    passenger_details_list = serializers.SerializerMethodField()
    payment_details = serializers.SerializerMethodField()  # ← NEW

    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ['booking_id', 'booking_date', 'passenger', 'status']

    def get_seat_numbers_list(self, obj):
        return obj.get_seat_numbers()
    
    def get_passenger_details_list(self, obj):
        return obj.get_passenger_details()
    def get_payment_details(self, obj):
        """Return payment details from the associated MockPayment"""
        if not obj.mock_payment:
            return None
        
        payment = obj.mock_payment
        
        # Check if there's a refund (get the latest one)
        refund_info = None
        try:
            # Use .refunds (plural) and get the most recent one
            latest_refund = payment.refunds.filter(status='SUCCESS').order_by('-processed_at').first()
            if latest_refund:
                refund_info = {
                    'refund_id': latest_refund.refund_id,
                    'refund_amount': float(latest_refund.amount),
                    'refund_status': latest_refund.status,
                    'refund_date': latest_refund.processed_at.isoformat() if latest_refund.processed_at else None,
                    'instant_refund': latest_refund.instant_refund
                }
        except Exception as e:
            print(f"Error fetching refund: {e}")
            pass
        
        return {
            'payment_id': payment.payment_id,
            'payment_status': payment.status,
            'payment_method': payment.get_payment_method_display() if payment.payment_method else None,
            'transaction_date': payment.paid_at.isoformat() if payment.paid_at else payment.created_at.isoformat(),
            'amount': float(payment.amount),
            'card_last_4': payment.card_last_4,
            'card_type': payment.card_type,
            'upi_id': payment.upi_id,
            'refund_id': refund_info['refund_id'] if refund_info else None,
            'refund_amount': refund_info['refund_amount'] if refund_info else None,
            'refund_status': refund_info['refund_status'] if refund_info else None,
            'refund_date': refund_info['refund_date'] if refund_info else None,
            'instant_refund': refund_info['instant_refund'] if refund_info else False,
        }
    
class LeaveRequestSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    staff_employee_id = serializers.CharField(source='staff.employee_id', read_only=True)
    staff_district = serializers.CharField(source='staff.working_district', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.name', read_only=True, allow_null=True)
    
    class Meta:
        model = LeaveRequest
        fields = '__all__'
        read_only_fields = ['applied_date', 'approved_by', 'approved_date', 'staff', 'status']

class ComplaintSerializer(serializers.ModelSerializer):
    complainant_name = serializers.CharField(source='complainant.name', read_only=True)
    complainant_type = serializers.CharField(source='complainant.user_type', read_only=True)
    
    booking_id = serializers.CharField(source='related_booking.booking_id', read_only=True)
    vehicle_number = serializers.CharField(source='vehicle.vehicle_number', read_only=True)
    route_name = serializers.CharField(source='related_schedule.route.route_name', read_only=True)
    
    # 🆕 Booking details for verification
    booking_date = serializers.DateField(source='related_booking.schedule.schedule_date', read_only=True)
    departure_time = serializers.TimeField(source='related_booking.schedule.departure_time', read_only=True)
    boarding_point = serializers.CharField(source='related_booking.boarding_point', read_only=True)
    destination_point = serializers.CharField(source='related_booking.destination_point', read_only=True)
    
    # 🆕 File URLs
    seat_photo_url = serializers.SerializerMethodField()
    issue_photo_url = serializers.SerializerMethodField()
    issue_video_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Complaint
        fields = [
            'id', 'complaint_id', 'complainant', 'complainant_name', 
            'complainant_type', 'passenger_name', 'passenger_phone',
            'subject', 'description', 'priority', 'status', 
            'created_date', 'resolved_date', 'admin_response',
            'related_booking', 'booking_id', 'booking_date', 'departure_time',
            'boarding_point', 'destination_point', 'seat_number',
            'related_schedule', 'vehicle', 'vehicle_number', 'route_name',
            'seat_photo', 'issue_photo', 'issue_video',
            'seat_photo_url', 'issue_photo_url', 'issue_video_url',
            'is_verified', 'verification_notes'
        ]
        read_only_fields = ['complaint_id', 'created_date', 'complainant']
    
    def get_seat_photo_url(self, obj):
        if obj.seat_photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.seat_photo.url)
        return None
    
    def get_issue_photo_url(self, obj):
        if obj.issue_photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.issue_photo.url)
        return None
    
    def get_issue_video_url(self, obj):
        if obj.issue_video:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.issue_video.url)
        return None

class PayrollSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    staff_employee_id = serializers.CharField(source='staff.employee_id', read_only=True)
    staff_district = serializers.CharField(source='staff.working_district', read_only=True)
    
    class Meta:
        model = Payroll
        fields = '__all__'
        read_only_fields = ['net_salary', 'payment_date']

class NotificationRecipientSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationRecipient
        fields = '__all__'


class EmergencyNotificationSerializer(serializers.ModelSerializer):
    schedule_details = serializers.SerializerMethodField()
    sent_by_name = serializers.CharField(source='sent_by.name', read_only=True)
    recipients_list = NotificationRecipientSerializer(source='recipients', many=True, read_only=True)
    
    class Meta:
        model = EmergencyNotification
        fields = '__all__'
    
    def get_schedule_details(self, obj):
        return {
            'route_name': obj.schedule.route.route_name,
            'route_number': obj.schedule.route.route_number,
            'vehicle_number': obj.schedule.vehicle.vehicle_number,
            'schedule_date': obj.schedule.schedule_date,
            'departure_time': obj.schedule.departure_time,
        }


class SendEmergencyNotificationSerializer(serializers.Serializer):
    schedule_id = serializers.IntegerField()
    message = serializers.CharField()
    hospital_info = serializers.CharField(required=False, allow_blank=True)

# =====================================================
# GPS TRACKING SERIALIZERS
# Add these to transport/serializers.py
# =====================================================

from rest_framework import serializers
from .models import BusLocation, BusLocationHistory

class BusLocationSerializer(serializers.ModelSerializer):
    """Serializer for viewing bus locations with schedule details"""
    route_name = serializers.CharField(source='schedule.route.route_name', read_only=True)
    route_number = serializers.CharField(source='schedule.route.route_number', read_only=True)
    vehicle_number = serializers.CharField(source='schedule.vehicle.vehicle_number', read_only=True)
    driver_name = serializers.CharField(source='schedule.driver.name', read_only=True)
    conductor_name = serializers.CharField(source='schedule.conductor.name', read_only=True)
    schedule_date = serializers.DateField(source='schedule.schedule_date', read_only=True)
    departure_time = serializers.TimeField(source='schedule.departure_time', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.name', read_only=True)
    schedule_status = serializers.CharField(source='schedule.status', read_only=True)
    class Meta:
        model = BusLocation
        fields = [
            'id', 'schedule', 'latitude', 'longitude', 'speed', 'heading',
            'accuracy', 'timestamp', 'updated_by', 'is_moving', 'battery_level',
            'is_gps_enabled', 'device_type',
            # Related fields
            'route_name', 'route_number', 'vehicle_number', 'driver_name',
            'conductor_name', 'schedule_date', 'departure_time', 'updated_by_name','schedule_status', 
        ]
        read_only_fields = ['timestamp']


class BusLocationUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating bus location (used by drivers/conductors)"""
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    speed = serializers.FloatField(default=0)
    heading = serializers.FloatField(required=False, allow_null=True)
    accuracy = serializers.FloatField(required=False, allow_null=True)
    battery_level = serializers.IntegerField(required=False, allow_null=True)
    device_type = serializers.ChoiceField(
        choices=[('DRIVER_PHONE', 'Driver Phone'), ('CONDUCTOR_PHONE', 'Conductor Phone'),('GPS_HARDWARE',    'GPS Hardware Device'),],
        default='DRIVER_PHONE'
    )
    class Meta:
        model = BusLocation
        fields = [
            'schedule_id', 'latitude', 'longitude', 'speed', 'heading',
            'accuracy', 'is_moving', 'battery_level', 'is_gps_enabled', 'device_type'
        ]
    
    def validate_latitude(self, value):
        if not (-90 <= float(value) <= 90):
            raise serializers.ValidationError("Latitude must be between -90 and 90")
        return value
    
    def validate_longitude(self, value):
        if not (-180 <= float(value) <= 180):
            raise serializers.ValidationError("Longitude must be between -180 and 180")
        return value


class BusLocationHistorySerializer(serializers.ModelSerializer):
    """Serializer for historical location data"""
    route_name = serializers.CharField(source='schedule.route.route_name', read_only=True)
    vehicle_number = serializers.CharField(source='schedule.vehicle.vehicle_number', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.name', read_only=True)
    device_type = serializers.SerializerMethodField()
    battery_level = serializers.SerializerMethodField()
    
    class Meta:
        model = BusLocationHistory
        fields = [
            'id', 'schedule', 'latitude', 'longitude', 'speed', 'heading',
            'timestamp', 'updated_by', 'route_name', 'vehicle_number','updated_by_name', 'device_type', 'accuracy', 'battery_level'
        ]
    def get_device_type(self, obj):
    # Use stored device_type if it's a known valid value
        known_types = ['GPS_HARDWARE', 'DRIVER_PHONE', 'CONDUCTOR_PHONE', 'ADMIN']
        if obj.device_type and obj.device_type in known_types:
            return obj.device_type
        # Fall back to inferring from who updated it
        if not obj.updated_by:
            return 'GPS_HARDWARE'
        if obj.schedule.driver == obj.updated_by:
            return 'DRIVER_PHONE'
        elif obj.schedule.conductor == obj.updated_by:
            return 'CONDUCTOR_PHONE'
        return 'DRIVER_PHONE'
    
    
    
    def get_battery_level(self, obj):
        """Return None since field doesn't exist in database yet"""
        return obj.battery_level




class MockPaymentSerializer(serializers.ModelSerializer):
    """Serializer for Mock Payment"""
    
    display_amount = serializers.SerializerMethodField()
    display_method = serializers.SerializerMethodField()
    
    class Meta:
        model = MockPayment
        fields = [
            'id', 'payment_id', 'order_id', 'transaction_id',
            'amount', 'display_amount', 'currency', 'status',
            'payment_method', 'display_method',
            'card_last_4', 'card_type', 'upi_id',
            'user_email', 'user_phone',
            'created_at', 'paid_at', 'description',
            'is_mock'
        ]
        read_only_fields = [
            'id', 'payment_id', 'order_id', 'transaction_id',
            'status', 'created_at', 'paid_at', 'is_mock'
        ]
    
    def get_display_amount(self, obj):
        return f"₹{obj.amount}"
    
    def get_display_method(self, obj):
        if obj.payment_method == 'CARD' and obj.card_last_4:
            return f"{obj.card_type or 'Card'} ending in {obj.card_last_4}"
        elif obj.payment_method == 'UPI' and obj.upi_id:
            return f"UPI - {obj.upi_id}"
        return obj.get_payment_method_display() if obj.payment_method else 'N/A'


class MockRefundSerializer(serializers.ModelSerializer):
    """Serializer for Mock Refund"""
    
    payment_details = MockPaymentSerializer(source='payment', read_only=True)
    display_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = MockRefund
        fields = [
            'id', 'refund_id', 'payment', 'booking',
            'amount', 'display_amount', 'status', 'reason',
            'created_at', 'processed_at', 'instant_refund',
            'payment_details', 'is_mock'
        ]
        read_only_fields = [
            'id', 'refund_id', 'status',
            'created_at', 'processed_at', 'is_mock'
        ]
    
    def get_display_amount(self, obj):
        return f"₹{obj.amount}"