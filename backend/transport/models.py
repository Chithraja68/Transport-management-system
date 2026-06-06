from django.db import models
from django.utils import timezone
from accounts.models import User
import json
import uuid
import random
import string
class District(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, unique=True)
    
    def __str__(self):
        return self.name

class Vehicle(models.Model):
    VEHICLE_STATUS = (
        ('ACTIVE', 'Active'),
        ('MAINTENANCE', 'Maintenance'),
        ('INACTIVE', 'Inactive'),
    )
    LAYOUT_CHOICES = (
        ('2-2', '2x2 Layout'),
        ('2-3', '2x3 Layout'),
        ('1-2', '1x2 Layout'),
    )
    vehicle_number = models.CharField(max_length=20, unique=True)
    vehicle_type = models.CharField(max_length=50)
    capacity = models.IntegerField()
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name='vehicles')
    status = models.CharField(max_length=20, choices=VEHICLE_STATUS, default='ACTIVE')
    registration_date = models.DateField()
    last_maintenance = models.DateField(null=True, blank=True)
    seat_layout = models.CharField(max_length=10, choices=LAYOUT_CHOICES, default='2-2')
    total_rows = models.IntegerField(default=15)  # Number of rows in bus
    last_row_seats = models.IntegerField(default=5)  # Seats in last row
    women_seats = models.TextField(default='[]', help_text='JSON array of seat numbers reserved for women')
    def __str__(self):
        return f"{self.vehicle_number} - {self.district.name}"
    def get_women_seats(self):
        """Get list of women-reserved seat numbers"""
        try:
            return json.loads(self.women_seats)
        except:
            return []
    
    def set_women_seats(self, seat_list):
        """Set women-reserved seats"""
        self.women_seats = json.dumps(seat_list)
class Route(models.Model):
    route_number = models.CharField(max_length=20, unique=True)
    route_name = models.CharField(max_length=200)
    start_point = models.CharField(max_length=200)
    end_point = models.CharField(max_length=200)
    distance_km = models.DecimalField(max_digits=6, decimal_places=2)
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name='routes')
    stops = models.TextField(help_text="Comma-separated list of stops")
    
    def __str__(self):
        return f"{self.route_number} - {self.route_name}"

class Schedule(models.Model):
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='schedules')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='schedules')
    driver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='driver_schedules')
    conductor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='conductor_schedules')
    departure_time = models.TimeField()
    arrival_time = models.TimeField()
    schedule_date = models.DateField()
    fare = models.DecimalField(max_digits=8, decimal_places=2)
    available_seats = models.IntegerField()
    is_active = models.BooleanField(default=True)
    booked_seats = models.TextField(default='[]', help_text='JSON array of booked seat numbers')
    STATUS_CHOICES = (
        ('SCHEDULED', 'Scheduled'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SCHEDULED')
    class Meta:
        unique_together = ['vehicle', 'schedule_date', 'departure_time']
    
    def __str__(self):
        return f"{self.route.route_number} - {self.schedule_date} {self.departure_time}"
    def get_booked_seats(self):
        """Get list of booked seat numbers"""
        try:
            return json.loads(self.booked_seats)
        except:
            return []
    
    def add_booked_seats(self, seat_numbers):
        """Add seats to booked list"""
        current_booked = self.get_booked_seats()
        current_booked.extend(seat_numbers)
        self.booked_seats = json.dumps(list(set(current_booked)))  # Remove duplicates
        self.save()
    
    def remove_booked_seats(self, seat_numbers):
        """Remove seats from booked list (for cancellation)"""
        current_booked = self.get_booked_seats()
        for seat in seat_numbers:
            if seat in current_booked:
                current_booked.remove(seat)
        self.booked_seats = json.dumps(current_booked)
        self.save()
class Booking(models.Model):
    BOOKING_STATUS = (
    ('PENDING_PAYMENT', 'Pending Payment'),
    ('CONFIRMED', 'Confirmed'),
    ('CANCELLED', 'Cancelled'),
    ('REFUNDED', 'Refunded'),
    ('COMPLETED', 'Completed'),
)

    
    booking_id = models.CharField(max_length=20, unique=True)
    passenger = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='bookings')
    seats_booked = models.IntegerField(default=1)
    seat_numbers = models.TextField(default='[]', help_text='JSON array of selected seat numbers')
    booking_date = models.DateTimeField(auto_now_add=True)
    boarding_point = models.CharField(max_length=200)
    destination_point = models.CharField(max_length=200)
    total_fare = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=20, choices=BOOKING_STATUS, default='PENDING_PAYMENT')
    cancellation_reason = models.TextField(blank=True, null=True)
    payment_status = models.BooleanField(default=False)
    mock_payment = models.OneToOneField(
        'MockPayment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='booking'
    )
    # Store passenger details as JSON array
    passenger_details = models.TextField(default='[]', help_text='JSON array of passenger details for each seat')
    alternate_contact_number = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        help_text='Alternate contact number for emergency notifications'
    )
    # NEW: Flag to track if booking triggers female-only restriction
    triggers_female_restriction = models.BooleanField(default=False)
    # Stores: True if this booking has female passengers that restrict adjacent seats
    
    is_group_booking = models.BooleanField(default=False)
    # Stores: True if this is a family/couple/group booking
    
    booking_type = models.CharField(
        max_length=20,
        choices=[
            ('INDIVIDUAL', 'Individual'),
            ('GROUP', 'Group/Family')
        ],
        default='INDIVIDUAL'
    )
    def __str__(self):
        return f"{self.booking_id} - {self.passenger.name}"

    def get_seat_numbers(self):
        """Get list of booked seat numbers"""
        try:
            return json.loads(self.seat_numbers)
        except:
            return []
    
    def set_seat_numbers(self, seat_list):
        """Set booked seat numbers"""
        self.seat_numbers = json.dumps(seat_list)
        self.seats_booked = len(seat_list)
    
    def get_passenger_details(self):
        """Get list of passenger details"""
        try:
            return json.loads(self.passenger_details)
        except:
            return []
    
    def set_passenger_details(self, details_list):
        """Set passenger details"""
        self.passenger_details = json.dumps(details_list)

class PassengerDetails(models.Model):
    """
    Individual passenger details for each seat in a booking
    This is a proper relational model (better than JSON storage)
    """
    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='passenger_details_set'
    )
    seat_number = models.CharField(max_length=10)
    passenger_name = models.CharField(max_length=200)
    passenger_gender = models.CharField(
        max_length=10,
        choices=[
            ('MALE', 'Male'),
            ('FEMALE', 'Female'),
            ('OTHER', 'Other')
        ]
    )
    passenger_age = models.IntegerField()
    passenger_phone = models.CharField(max_length=15)
    passenger_alternate_phone = models.CharField(max_length=15, blank=True, null=True)
    
    class Meta:
        ordering = ['seat_number']
        verbose_name = "Passenger Detail"
        verbose_name_plural = "Passenger Details"
    
    def __str__(self):
        return f"{self.passenger_name} - Seat {self.seat_number} ({self.booking.booking_id})"

class SeatRestriction(models.Model):
    """
    NEW MODEL: Track seat-level restrictions dynamically
    This allows us to flag seats as female-only based on adjacent bookings
    """
    schedule = models.ForeignKey('Schedule', on_delete=models.CASCADE)
    seat_number = models.CharField(max_length=10)
    
    # Restriction type
    restriction_type = models.CharField(
        max_length=30,
        choices=[
            ('WOMEN_RESERVED', 'Women Reserved Seat'),
            ('ADJACENT_TO_WOMEN_RESERVED', 'Adjacent to Women Reserved'),
            ('ADJACENT_TO_FEMALE', 'Adjacent to Female Passenger'),
            ('ADJACENT_TO_GROUP', 'Adjacent to Group Booking'),
        ]
    )
    
    # What caused this restriction
    caused_by_booking = models.ForeignKey(
        'Booking', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='caused_restrictions'
    )
    
    # Female only flag
    is_female_only = models.BooleanField(default=True)
    
    # Active flag (can be deactivated if causing booking is cancelled)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('schedule', 'seat_number', 'restriction_type')
    
    def __str__(self):
        return f"{self.seat_number} - {self.restriction_type} ({self.schedule})"
class LeaveRequest(models.Model):
    LEAVE_TYPE = (
        ('HEALTH', 'Health'),
        ('RELATIVE_DEAD', 'Relative Dead'),
        ('FAMILY_FUNCTION', 'Family Function'),
        ('PERSONAL', 'Personal'),
        ('OTHER', 'Other'),
    )
    
    LEAVE_STATUS = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )
    
    staff = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPE)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=LEAVE_STATUS, default='PENDING')
    applied_date = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_leaves')
    approved_date = models.DateTimeField(null=True, blank=True)
    admin_remarks = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['-applied_date']
    
    def get_priority(self):
        priority_order = {
            'HEALTH': 1,
            'RELATIVE_DEAD': 2,
            'FAMILY_FUNCTION': 3,
            'PERSONAL': 4,
            'OTHER': 5
        }
        return priority_order.get(self.leave_type, 99)
    
    def __str__(self):
        return f"{self.staff.name} - {self.leave_type} ({self.start_date})"

class Complaint(models.Model):
    COMPLAINT_STATUS = (
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('RESOLVED', 'Resolved'),
        ('CLOSED', 'Closed'),
    )
    
    PRIORITY = (
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('EMERGENCY', 'Emergency'),
    )
    
    complaint_id = models.CharField(max_length=20, unique=True)
    complainant = models.ForeignKey(User, on_delete=models.CASCADE, related_name='complaints')
    
    # 🆕 NEW: Store the actual passenger name and phone (from passenger_details)
    passenger_name = models.CharField(
        max_length=200,
        help_text="Name of the actual passenger who is complaining"
    )
    passenger_phone = models.CharField(
        max_length=15,
        help_text="Phone number of the actual passenger (must match booking)"
    )
    
    subject = models.CharField(max_length=200)
    description = models.TextField()
    priority = models.CharField(max_length=20, choices=PRIORITY, default='MEDIUM')
    status = models.CharField(max_length=20, choices=COMPLAINT_STATUS, default='PENDING')
    created_date = models.DateTimeField(auto_now_add=True)
    resolved_date = models.DateTimeField(null=True, blank=True)
    admin_response = models.TextField(blank=True, null=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_complaints')
    
    # Link to booking - MANDATORY for passengers
    related_booking = models.ForeignKey(
        'Booking', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='complaints',
        help_text="Link to passenger's booking (REQUIRED for passengers)"
    )
    
    related_schedule = models.ForeignKey(
        'Schedule',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='complaints',
        help_text="Link to schedule (for staff)"
    )
    
    vehicle = models.ForeignKey(
        'Vehicle',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Which bus this complaint is about"
    )
    
    # 🆕 Seat number from booking
    seat_number = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        help_text="Seat number of the complaining passenger"
    )
    
    # 🆕 MANDATORY FIELD - Seat Photo
    seat_photo = models.ImageField(
        upload_to='complaints/seat_photos/',
        null=True,
        blank=True,
        help_text="Photo of seat number (mandatory for passengers)"
    )
    
    # Optional: Issue Photo/Video
    issue_photo = models.ImageField(
        upload_to='complaints/issue_photos/',
        null=True,
        blank=True,
        help_text="Photo of the issue/problem"
    )
    
    issue_video = models.FileField(
        upload_to='complaints/issue_videos/',
        null=True,
        blank=True,
        help_text="Video of the issue/problem"
    )
    
    is_verified = models.BooleanField(
        default=False,
        help_text="Admin verified this is legitimate"
    )
    
    verification_notes = models.TextField(
        blank=True,
        null=True,
        help_text="Admin's verification notes"
    )
    
    class Meta:
        ordering = ['-created_date']
    
    def __str__(self):
        return f"{self.complaint_id} - {self.passenger_name} ({self.subject})"
class Payroll(models.Model):
    staff = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payrolls')
    month = models.DateField()
    basic_salary = models.DecimalField(max_digits=10, decimal_places=2)
    allowances = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    overtime_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    overtime_pay = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField(null=True, blank=True)
    payment_status = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ['staff', 'month']
        ordering = ['-month']
    
    def calculate_net_salary(self):
        self.net_salary = self.basic_salary + self.allowances + self.overtime_pay - self.deductions
        return self.net_salary
    
    def __str__(self):
        return f"{self.staff.name} - {self.month.strftime('%B %Y')}"
    
class EmergencyNotification(models.Model):
    """Model to track emergency notifications sent to passengers"""
    schedule = models.ForeignKey('Schedule', on_delete=models.CASCADE, related_name='emergency_notifications')
    message = models.TextField(help_text="Emergency message content")
    hospital_info = models.TextField(blank=True, null=True, help_text="Hospital and medical facility information")
    sent_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='sent_notifications')
    sent_at = models.DateTimeField(auto_now_add=True)
    total_recipients = models.IntegerField(default=0, help_text="Total passengers notified")
    successful_sends = models.IntegerField(default=0, help_text="Successfully delivered messages")
    failed_sends = models.IntegerField(default=0, help_text="Failed message deliveries")
    
    class Meta:
        ordering = ['-sent_at']
        
    def __str__(self):
        return f"Emergency Alert - {self.schedule.route.route_name} on {self.sent_at.strftime('%Y-%m-%d %H:%M')}"


class NotificationRecipient(models.Model):
    """Track individual recipients of emergency notifications"""
    notification = models.ForeignKey(EmergencyNotification, on_delete=models.CASCADE, related_name='recipients')
    booking = models.ForeignKey('Booking', on_delete=models.CASCADE)
    passenger_name = models.CharField(max_length=255)
    seat_number = models.CharField(max_length=10, blank=True, null=True, help_text="Seat number for sorting")
    contact_number = models.CharField(max_length=15)
    is_alternate_number = models.BooleanField(default=False)
    sent_status = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['seat_number', 'passenger_name']
        
    def __str__(self):
        return f"{self.passenger_name} - {self.contact_number}"

# =====================================================
# GPS TRACKING MODELS
# Add these at the end of transport/models.py
# =====================================================

class BusLocation(models.Model):
    """Real-time GPS location tracking for buses"""
    schedule = models.ForeignKey('Schedule', on_delete=models.CASCADE, related_name='locations')
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    speed = models.FloatField(default=0, help_text="Speed in km/h")
    heading = models.FloatField(null=True, blank=True, help_text="Direction in degrees (0-360)")
    accuracy = models.FloatField(null=True, blank=True, help_text="GPS accuracy in meters")
    timestamp = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='location_updates')
    
    # Additional tracking info
    is_moving = models.BooleanField(default=False)
    battery_level = models.IntegerField(null=True, blank=True, help_text="Device battery percentage")
    is_gps_enabled = models.BooleanField(default=True)
    
    # Track which device sent the update (for crash recovery)
    device_type = models.CharField(max_length=20, choices=(
        ('DRIVER_PHONE', 'Driver Phone'),
        ('CONDUCTOR_PHONE', 'Conductor Phone'),
        ('GPS_HARDWARE', 'GPS Hardware Device'),
        ('ADMIN', 'Admin'),
    ), default='DRIVER_PHONE')
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['schedule', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.schedule.route.route_name} - {self.timestamp}"
    
    def is_stale(self):
        """Check if location is stale (no update in last 2 minutes)"""
        from datetime import timedelta
        from django.utils import timezone
        return timezone.now() - self.timestamp > timedelta(minutes=2)


class BusLocationHistory(models.Model):
    """
    Historical record of bus GPS locations.
    Stores every GPS update from drivers and conductors.
    """
    schedule = models.ForeignKey(
        Schedule, 
        on_delete=models.CASCADE, 
        related_name='location_history'
    )
    
    # GPS Coordinates
    latitude = models.DecimalField(max_digits=10, decimal_places=6)
    longitude = models.DecimalField(max_digits=10, decimal_places=6)
    
    # GPS Metrics
    speed = models.FloatField(default=0, help_text="Speed in km/h")
    heading = models.FloatField(
        null=True, 
        blank=True, 
        help_text="Direction in degrees (0-360)"
    )
    accuracy = models.FloatField(
        null=True, 
        blank=True, 
        help_text="GPS accuracy in meters"
    )  # ✅ ADD THIS FIELD
    battery_level = models.IntegerField(
        null=True, 
        blank=True, 
        help_text="Device battery percentage (0-100)"
    )  # ✅ ADD THIS FIELD
    
    # Device Information
    device_type = models.CharField(
        max_length=20,
        choices=[
            ('DRIVER_PHONE', 'Driver Phone'),
            ('CONDUCTOR_PHONE', 'Conductor Phone'),
            ('GPS_HARDWARE', 'GPS Hardware Device'),
            ('UNKNOWN', 'Unknown'),
        ],
        default='DRIVER_PHONE'
    )  # ✅ ADD THIS FIELD
    
    # Status
    is_moving = models.BooleanField(
        default=False, 
        help_text="Whether the bus is moving"
    )  # ✅ ADD THIS FIELD
    is_gps_enabled = models.BooleanField(default=True)
    
    # Timestamp and User
    timestamp = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='gps_updates'
    )
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['schedule', '-timestamp']),
            models.Index(fields=['updated_by', '-timestamp']),
        ]
        verbose_name = "Bus Location History"
        verbose_name_plural = "Bus Location Histories"
    
    def __str__(self):
        return f"{self.schedule} - {self.timestamp}"



class MockPayment(models.Model):
    """
    Mock Payment System - Zero Cost Alternative
    Works exactly like Razorpay but completely free
    """
    
    PAYMENT_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('REFUNDED', 'Refunded'),
        ('PARTIAL_REFUND', 'Partial Refund'),
    ]
    
    PAYMENT_METHOD_CHOICES = [
        ('CARD', 'Credit/Debit Card'),
        ('UPI', 'UPI'),
        ('NETBANKING', 'Net Banking'),
        ('WALLET', 'Wallet'),
    ]
    
    # Payment identifiers (mock versions)
    payment_id = models.CharField(max_length=100, unique=True, editable=False)
    order_id = models.CharField(max_length=100, unique=True, editable=False)
    transaction_id = models.CharField(max_length=100, unique=True, editable=False)
    
    # Payment details
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='PENDING')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, null=True, blank=True)
    
    # Card/UPI details (stored for display only - in real system NEVER store this)
    card_last_4 = models.CharField(max_length=4, null=True, blank=True)
    card_type = models.CharField(max_length=20, null=True, blank=True)  # Visa, Mastercard, etc.
    upi_id = models.CharField(max_length=100, null=True, blank=True)
    
    # User information
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='mock_payments')
    user_email = models.EmailField(null=True, blank=True)
    user_phone = models.CharField(max_length=15)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    
    # Additional data
    description = models.TextField(null=True, blank=True)
    receipt = models.CharField(max_length=100, null=True, blank=True)
    notes = models.JSONField(default=dict, blank=True)
    
    # Error tracking
    error_code = models.CharField(max_length=100, null=True, blank=True)
    error_description = models.TextField(null=True, blank=True)
    
    # Mock specific fields
    is_mock = models.BooleanField(default=True)  # Always True
    mock_signature = models.CharField(max_length=500, null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['payment_id']),
            models.Index(fields=['order_id']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.payment_id:
            # Generate mock payment ID (like Razorpay format)
            self.payment_id = f"pay_mock_{self._generate_random_string(14)}"
        if not self.order_id:
            self.order_id = f"order_mock_{self._generate_random_string(14)}"
        if not self.transaction_id:
            self.transaction_id = f"txn_mock_{self._generate_random_string(10)}"
        super().save(*args, **kwargs)
    
    def _generate_random_string(self, length):
        """Generate random alphanumeric string"""
        chars = string.ascii_uppercase + string.ascii_lowercase + string.digits
        return ''.join(random.choice(chars) for _ in range(length))
    
    def __str__(self):
        return f"{self.payment_id} - {self.status} - ₹{self.amount}"


class MockRefund(models.Model):
    """
    Mock Refund System - Zero Cost
    """
    
    REFUND_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
    ]
    
    # Refund identifiers
    refund_id = models.CharField(max_length=100, unique=True, editable=False)
    payment = models.ForeignKey(MockPayment, on_delete=models.CASCADE, related_name='refunds')
    booking = models.ForeignKey('Booking', on_delete=models.CASCADE, related_name='mock_refunds')
    
    # Refund details
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=REFUND_STATUS_CHOICES, default='PENDING')
    
    # Refund reason
    reason = models.TextField()
    initiated_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='mock_initiated_refunds')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    # Mock specific
    is_mock = models.BooleanField(default=True)
    instant_refund = models.BooleanField(default=True)  # Mock refunds are instant!
    
    class Meta:
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        if not self.refund_id:
            chars = string.ascii_uppercase + string.ascii_lowercase + string.digits
            random_str = ''.join(random.choice(chars) for _ in range(14))
            self.refund_id = f"rfnd_mock_{random_str}"
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Refund {self.refund_id} - {self.status} - ₹{self.amount}"


