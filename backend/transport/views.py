# =====================================================
# COMPLETE VIEWS.PY WITH FLAG SYSTEM + ALL PREVIOUS FEATURES
# =====================================================
import time
import random
import hashlib
from django.utils import timezone
from datetime import datetime, timedelta

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from django.db.models import Q, Count, Case, When, Value, IntegerField
from django.db import models
from accounts.models import User
from accounts.utils import send_booking_confirmation_sms, send_leave_status_sms
from accounts.serializers import UserSerializer
from django.shortcuts import get_object_or_404
from .models import (
    District, Vehicle, Route, Schedule, Booking, LeaveRequest, 
    Complaint, Payroll, SeatRestriction, EmergencyNotification, 
    NotificationRecipient,BusLocation, 
    BusLocationHistory,
    MockPayment, MockRefund,PassengerDetails
)
from .utils import (
    create_seat_restrictions, 
    remove_seat_restrictions,
    check_seat_availability_with_flags
)
from .serializers import (
    DistrictSerializer, VehicleSerializer, RouteSerializer,
    ScheduleSerializer, BookingSerializer, LeaveRequestSerializer,
    ComplaintSerializer, PayrollSerializer, EmergencyNotificationSerializer,
    SendEmergencyNotificationSerializer,BusLocationSerializer,          # ✅ ADD THIS
    BusLocationUpdateSerializer,    # ✅ ADD THIS
    BusLocationHistorySerializer,   # ✅ ADD THIS
    MockPaymentSerializer, MockRefundSerializer
)
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import parser_classes
from django.core.files.uploadedfile import UploadedFile
import json
from django.db import transaction
from accounts.utils import send_sms_fast2sms


# =====================================================
# UTILITY FUNCTIONS
# =====================================================

def calculate_fare_by_distance(schedule, boarding_point, destination_point):
    """
    Calculate fare based on distance between boarding and destination points.
    Uses the stops field in Route model.
    """
    route = schedule.route
    base_fare = float(schedule.fare)
    
    # Get stops as a list
    stops = [stop.strip() for stop in route.stops.split(',')]
    
    try:
        # Find indices of boarding and destination points
        boarding_index = stops.index(boarding_point)
        destination_index = stops.index(destination_point)
        
        if boarding_index >= destination_index:
            raise ValueError("Destination must be after boarding point")
        
        # Calculate number of stops traveled
        stops_traveled = destination_index - boarding_index
        total_stops = len(stops) - 1
        
        # Calculate fare proportionally based on stops
        calculated_fare = base_fare * (stops_traveled / total_stops)
        
        # Round to 2 decimal places
        return round(calculated_fare, 2)
        
    except ValueError as e:
        print(f"Error calculating fare: {e}")
        return base_fare


# =====================================================
# SEAT RESTRICTION UTILITY FUNCTIONS (FLAG SYSTEM)
# =====================================================

def get_adjacent_seats(seat_number, vehicle):
    """
    Get adjacent seats based on vehicle layout
    Returns list of seat numbers that are immediately adjacent
    Does NOT cross aisle
    """
    try:
        row_num = int(''.join(filter(str.isdigit, seat_number)))
        seat_letter = ''.join(filter(str.isalpha, seat_number))
    except:
        return []
    
    seat_letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    seat_index = seat_letters.index(seat_letter)
    
    # Parse layout (e.g., "2-3" means 2 left, 3 right)
    layout = vehicle.seat_layout
    if '-' in layout:
        left_seats, right_seats = map(int, layout.split('-'))
    else:
        # Default 2-2 layout
        left_seats, right_seats = 2, 2
    
    adjacent = []
    
    # Left neighbor (don't cross aisle)
    if seat_index > 0 and seat_index != left_seats:
        adjacent.append(f"{row_num}{seat_letters[seat_index - 1]}")
    
    # Right neighbor (don't cross aisle)
    if seat_index < left_seats + right_seats - 1 and seat_index != left_seats - 1:
        adjacent.append(f"{row_num}{seat_letters[seat_index + 1]}")
    
    return adjacent


def get_women_reserved_seats(vehicle):
    """
    Get list of women-reserved seats for a vehicle
    Handles both JSON array and comma-separated string formats
    """
    if not vehicle.women_seats:
        return []
    
    import json
    
    # ✅ FIX: Try JSON format FIRST (handles double-encoding issue)
    try:
        seats = json.loads(vehicle.women_seats)
        if isinstance(seats, list):
            # It's a JSON array - normalize and return
            return [str(seat).strip().upper() for seat in seats]
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    
    # ✅ Fallback: Try comma-separated format
    try:
        seats = [seat.strip().upper() for seat in str(vehicle.women_seats).split(',') if seat.strip()]
        return seats
    except Exception as e:
        print(f"❌ Error parsing women_seats: {e}")
        return []


def create_seat_restrictions(booking, schedule):
    """
    Create seat restrictions based on a new booking
    Called after a booking is created
    
    Creates FLAGS for adjacent seats when female passengers book
    """
    # Skip if group booking (they don't restrict adjacent seats)
    if booking.is_group_booking:
        return
    
    # Get passenger details
    try:
        passenger_details = json.loads(booking.passenger_details)
    except:
        return
    
    # For each seat in booking
    for detail in passenger_details:
        seat_number = detail.get('seat_number')
        gender = detail.get('passenger_gender')
        
        # Only create restrictions if passenger is FEMALE
        if gender == 'FEMALE':
            # Mark booking as triggering restriction
            booking.triggers_female_restriction = True
            booking.save()
            
            # Get adjacent seats
            adjacent_seats = get_adjacent_seats(seat_number, schedule.vehicle)
            
            # Create restriction for each adjacent seat
            for adj_seat in adjacent_seats:
                SeatRestriction.objects.get_or_create(
                    schedule=schedule,
                    seat_number=adj_seat,
                    restriction_type='ADJACENT_TO_FEMALE',
                    defaults={
                        'caused_by_booking': booking,
                        'is_female_only': True,
                        'is_active': True
                    }
                )


def remove_seat_restrictions(booking):
    """
    Remove seat restrictions when a booking is cancelled
    Deactivates all restrictions caused by this booking
    """
    # Deactivate all restrictions caused by this booking
    SeatRestriction.objects.filter(
        caused_by_booking=booking,
        is_active=True
    ).update(is_active=False)


def get_seat_restrictions(seat_number, schedule):
    """
    Get all active restrictions for a seat
    Returns dict with restriction info
    """
    restrictions = SeatRestriction.objects.filter(
        schedule=schedule,
        seat_number=seat_number,
        is_active=True
    )
    
    if not restrictions.exists():
        return {
            'is_restricted': False,
            'is_female_only': False,
            'restriction_type': None,
            'restrictions': []
        }
    
    # Check for any female-only restriction
    is_female_only = restrictions.filter(is_female_only=True).exists()
    
    return {
        'is_restricted': True,
        'is_female_only': is_female_only,
        'restriction_type': restrictions.first().restriction_type,
        'restrictions': [
            {
                'type': r.restriction_type,
                'caused_by': r.caused_by_booking.booking_id if r.caused_by_booking else None,
                'is_group': r.caused_by_booking.is_group_booking if r.caused_by_booking else False
            }
            for r in restrictions
        ]
    }




# =====================================================
# ADMIN DASHBOARD
# =====================================================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    total_staff = User.objects.filter(user_type__in=['DRIVER', 'CONDUCTOR', 'SUPERVISOR']).count()
    total_vehicles = Vehicle.objects.count()
    total_routes = Route.objects.count()
    total_schedules = Schedule.objects.count()
    total_bookings = Booking.objects.count()
    pending_bookings = Booking.objects.filter(status='PENDING').count()

    # Optimized High Priority Complaints Query
    high_priority_complaints = Complaint.objects.filter(
        status__in=['PENDING', 'IN_PROGRESS'],
        priority__in=['HIGH', 'EMERGENCY']
    ).order_by(
        Case(
            When(priority='EMERGENCY', then=Value(1)),
            When(priority='HIGH', then=Value(2)),
            default=Value(99),
            output_field=IntegerField()
        ),
        '-created_date'
    )

    # Optimized High Priority Leaves Query
    high_priority_leaves = LeaveRequest.objects.filter(
        status='PENDING',
        leave_type__in=['HEALTH', 'RELATIVE_DEAD']
    ).order_by(
        Case(
            When(leave_type='HEALTH', then=Value(1)),
            When(leave_type='RELATIVE_DEAD', then=Value(2)),
            default=Value(99),
            output_field=IntegerField()
        ),
        '-applied_date'
    )

    all_pending_leaves = LeaveRequest.objects.filter(status='PENDING').count()
    all_pending_complaints = Complaint.objects.filter(status='PENDING').count()

    districts = District.objects.all()
    district_data = [
        {
            'name': district.name,
            'vehicles': Vehicle.objects.filter(district=district).count(),
            'routes': Route.objects.filter(district=district).count(),
            'staff': User.objects.filter(working_district=district.name).count()
        }
        for district in districts
    ]

    return Response({
        'total_staff': total_staff,
        'total_vehicles': total_vehicles,
        'total_routes': total_routes,
        'total_schedules': total_schedules,
        'total_bookings': total_bookings,
        'pending_bookings': pending_bookings,
        'pending_complaints': all_pending_complaints,
        'pending_leaves': all_pending_leaves,
        'high_priority_complaints_count': high_priority_complaints.count(),
        'high_priority_leaves_count': high_priority_leaves.count(),
        'district_data': district_data,
        'high_priority_leaves': LeaveRequestSerializer(high_priority_leaves[:10], many=True).data,
        'high_priority_complaints': ComplaintSerializer(high_priority_complaints[:10], many=True,context={'request': request}).data,
    })


# =====================================================
# PASSENGER DASHBOARD OVERVIEW
# =====================================================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def passenger_overview(request, passenger_id):
    """Get overview data for passenger dashboard"""
    if request.user.user_type != 'PASSENGER':
        return Response({'error': 'Passenger access required'}, status=status.HTTP_403_FORBIDDEN)
    
    if request.user.id != passenger_id:
        return Response({'error': 'Unauthorized access'}, status=status.HTTP_403_FORBIDDEN)

    total_bookings = Booking.objects.filter(passenger_id=passenger_id).count()
    
    today = timezone.now().date()
    upcoming_trips = Booking.objects.filter(
        passenger_id=passenger_id,
        status__in=['CONFIRMED', 'PENDING'],
        schedule__schedule_date__gte=today
    ).count()
    
    open_complaints = Complaint.objects.filter(
        complainant_id=passenger_id,
        status__in=['PENDING', 'IN_PROGRESS']
    ).count()

    return Response({
        'total_bookings': total_bookings,
        'upcoming_trips': upcoming_trips,
        'open_complaints': open_complaints
    })


# =====================================================
# DISTRICT-WISE VIEWS
# =====================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def district_wise_employees(request):
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    district = request.query_params.get('district')
    search = request.query_params.get('search', '')

    employees = User.objects.filter(user_type__in=['DRIVER', 'CONDUCTOR', 'SUPERVISOR'])

    if district:
        employees = employees.filter(working_district=district)

    if search:
        employees = employees.filter(
            Q(name__icontains=search) |
            Q(employee_id__icontains=search) |
            Q(phone_number__icontains=search)
        )

    return Response(UserSerializer(employees, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def district_wise_vehicles(request):
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    district = request.query_params.get('district')
    search = request.query_params.get('search', '')

    vehicles = Vehicle.objects.all()

    if district:
        vehicles = vehicles.filter(district__name=district)

    if search:
        vehicles = vehicles.filter(
            Q(vehicle_number__icontains=search) |
            Q(vehicle_type__icontains=search)
        )

    return Response(VehicleSerializer(vehicles, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def district_wise_routes(request):
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    district = request.query_params.get('district')
    search = request.query_params.get('search', '')

    routes = Route.objects.all()

    if district:
        routes = routes.filter(district__name=district)

    if search:
        routes = routes.filter(
            Q(route_number__icontains=search) |
            Q(route_name__icontains=search) |
            Q(start_point__icontains=search) |
            Q(end_point__icontains=search)
        )

    return Response(RouteSerializer(routes, many=True).data)


# =====================================================
# LEAVE REQUESTS
# =====================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def leave_requests(request):
    if request.method == 'GET':
        search = request.query_params.get('search', '')

        if request.user.user_type == 'ADMIN':
            leaves = LeaveRequest.objects.annotate(
                status_order=Case(
                    When(status='PENDING', then=1),
                    When(status='APPROVED', then=2),
                    When(status='REJECTED', then=3),
                    default=4,
                    output_field=IntegerField(),
                ),
                priority_order=Case(
                    When(leave_type='HEALTH', then=1),
                    When(leave_type='RELATIVE_DEAD', then=2),
                    When(leave_type='FAMILY_FUNCTION', then=3),
                    When(leave_type='PERSONAL', then=4),
                    When(leave_type='OTHER', then=5),
                    default=6,
                    output_field=IntegerField(),
                )
            ).order_by('status_order', 'priority_order', '-applied_date')

            if search:
                leaves = leaves.filter(
                    Q(staff__name__icontains=search) |
                    Q(staff__employee_id__icontains=search) |
                    Q(reason__icontains=search)
                )
        else:
            leaves = LeaveRequest.objects.filter(staff=request.user).order_by('-applied_date')

        return Response(LeaveRequestSerializer(leaves, many=True).data)

    # POST — Staff Creates Leave
    if request.user.user_type not in ['DRIVER', 'CONDUCTOR', 'SUPERVISOR']:
        return Response({'error': 'Only staff can create leave requests'}, status=status.HTTP_403_FORBIDDEN)

    serializer = LeaveRequestSerializer(data=request.data)
    if serializer.is_valid():
        leave_request = serializer.save(staff=request.user)
        return Response(LeaveRequestSerializer(leave_request).data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def approve_leave(request, leave_id):
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        leave = LeaveRequest.objects.get(id=leave_id)
    except LeaveRequest.DoesNotExist:
        return Response({'error': 'Leave request not found'}, status=status.HTTP_404_NOT_FOUND)

    action = request.data.get('action')
    admin_remarks = request.data.get('admin_remarks', '')

    if action not in ['approve', 'reject']:
        return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

    leave.status = 'APPROVED' if action == 'approve' else 'REJECTED'
    leave.approved_by = request.user
    leave.approved_date = timezone.now()
    leave.admin_remarks = admin_remarks
    leave.save()

    date_range = f"{leave.start_date} to {leave.end_date}"
    send_leave_status_sms(
        leave.staff.phone_number,
        leave.get_leave_type_display(),
        leave.status.lower(),
        date_range
    )

    return Response(LeaveRequestSerializer(leave).data)


# =====================================================
# COMPLAINTS
# =====================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def complaints(request):
    """
    GET: List complaints
    POST: Create new complaint (passengers OR staff, must verify phone number)
    """
    search = request.query_params.get('search', '')
    priority = request.query_params.get('priority', '')

    if request.method == 'GET':
        if request.user.user_type == 'ADMIN':
            complaints_qs = Complaint.objects.annotate(
                priority_order=Case(
                    When(priority='EMERGENCY', then=1),
                    When(priority='HIGH', then=2),
                    When(priority='MEDIUM', then=3),
                    When(priority='LOW', then=4),
                    default=5,
                    output_field=IntegerField(),
                )
            ).order_by('status', 'priority_order', '-created_date')

            if search:
                complaints_qs = complaints_qs.filter(
                    Q(complaint_id__icontains=search) |
                    Q(subject__icontains=search) |
                    Q(complainant__name__icontains=search) |
                    Q(passenger_name__icontains=search) |
                    Q(passenger_phone__icontains=search)
                )
            
            if priority:
                complaints_qs = complaints_qs.filter(priority=priority)
        else:
            complaints_qs = Complaint.objects.filter(complainant=request.user).order_by('-created_date')
            
            if search:
                complaints_qs = complaints_qs.filter(
                    Q(subject__icontains=search) |
                    Q(description__icontains=search)
                )
            
            if priority:
                complaints_qs = complaints_qs.filter(priority=priority)

        serializer = ComplaintSerializer(complaints_qs, many=True, context={'request': request})
        return Response(serializer.data)
    
    # POST - Create complaint
    if request.method == 'POST':
        user = request.user
        user_type = user.user_type
        
        # Check if user is passenger or staff
        if user_type == 'PASSENGER':
            return handle_passenger_complaint(request)
        elif user_type in ['DRIVER', 'CONDUCTOR', 'SUPERVISOR']:
            return handle_staff_complaint(request)
        else:
            return Response({
                'error': '❌ Only passengers and staff can file complaints'
            }, status=status.HTTP_403_FORBIDDEN)


def handle_passenger_complaint(request):
    """Handle complaint creation for passengers"""
    try:
        user = request.user
        
        # Get files from request
        seat_photo = request.FILES.get('seat_photo')
        issue_photo = request.FILES.get('issue_photo')
        issue_video = request.FILES.get('issue_video')
        
        # Get text data
        subject = request.data.get('subject', '').strip()
        description = request.data.get('description', '').strip()
        priority = request.data.get('priority', 'MEDIUM')
        passenger_phone = request.data.get('passenger_phone', '').strip()
        
        # Validation
        if not subject or len(subject) < 5:
            return Response({
                'error': '❌ Subject must be at least 5 characters long'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not description or len(description) < 10:
            return Response({
                'error': '❌ Description must be at least 10 characters long'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not passenger_phone:
            return Response({
                'error': '📱 Please enter your passenger phone number to verify your travel'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Clean phone number
        passenger_phone_clean = ''.join(filter(str.isdigit, passenger_phone))
        if len(passenger_phone_clean) != 10:
            return Response({
                'error': '❌ Phone number must be 10 digits'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find booking with this phone number
        cutoff_date = (timezone.now() - timedelta(days=7)).date()
        
        matching_bookings = Booking.objects.filter(
            passenger=user,
            status__in=['CONFIRMED', 'COMPLETED'],
            schedule__schedule_date__gte=cutoff_date
        ).select_related('schedule', 'schedule__vehicle', 'schedule__route').order_by('-booking_date')
        
        # Find which booking has this passenger phone
        found_booking = None
        passenger_name = None
        seat_number = None
        
        for booking in matching_bookings:
            passenger_details_list = booking.get_passenger_details()
            
            for passenger in passenger_details_list:
                p_phone = passenger.get('passenger_phone', '').strip()
                p_phone_clean = ''.join(filter(str.isdigit, p_phone))
                
                if p_phone_clean == passenger_phone_clean:
                    found_booking = booking
                    passenger_name = passenger.get('passenger_name', '')
                    seat_number = passenger.get('seat_number', '')
                    break
            
            if found_booking:
                break
        
        if not found_booking:
            return Response({
                'error': f'❌ No recent booking found with phone number {passenger_phone}. You can only file complaints if you actually traveled on the bus.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not seat_photo:
            return Response({
                'error': '📸 Seat photo is mandatory! Please upload a clear photo of your seat number.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not issue_photo and not issue_video:
            return Response({
                'error': '⚠️ Please upload either an issue photo OR an issue video'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate complaint ID
        complaint_id = f"CMP{timezone.now().strftime('%Y%m%d%H%M%S')}"
        
        # Get booking details
        related_schedule = found_booking.schedule
        vehicle = related_schedule.vehicle
        
        # Create verification notes
        verification_notes = f"""
✅ VERIFIED PASSENGER COMPLAINT
Passenger Name: {passenger_name}
Passenger Phone: {passenger_phone_clean}
Seat Number: {seat_number}
Booking ID: {found_booking.booking_id}
Route: {related_schedule.route.route_name}
Date: {related_schedule.schedule_date}
Vehicle: {vehicle.vehicle_number}
"""
        
        # Create complaint
        complaint = Complaint.objects.create(
            complainant=user,
            passenger_name=passenger_name,
            passenger_phone=passenger_phone_clean,
            seat_number=seat_number,
            complaint_id=complaint_id,
            subject=subject,
            description=description,
            priority=priority,
            related_booking=found_booking,
            related_schedule=related_schedule,
            vehicle=vehicle,
            seat_photo=seat_photo,
            issue_photo=issue_photo,
            issue_video=issue_video,
            is_verified=True,
            verification_notes=verification_notes
        )
        
        serializer = ComplaintSerializer(complaint, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({
            'error': f'Failed to create complaint: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)

def validate_staff_schedule_access(staff_user, schedule_id):
    """
    Validate if staff member has access to complain about this schedule
    Returns (is_valid, error_message)
    """
    if not schedule_id:
        # General complaints (no schedule) are always allowed
        return True, None
    
    try:
        schedule = Schedule.objects.get(id=schedule_id)
    except Schedule.DoesNotExist:
        return False, "Schedule not found"
    
    # Check if staff was assigned to this schedule
    is_assigned = (schedule.driver == staff_user or schedule.conductor == staff_user)
    
    if not is_assigned:
        return False, f"You were not assigned to this schedule. Only assigned staff (driver/conductor) can file complaints about specific schedules."
    
    # Optional: Check if schedule is recent (last 90 days)
    cutoff_date = (timezone.now() - timedelta(days=90)).date()
    if schedule.schedule_date < cutoff_date:
        return False, f"Cannot file complaint about schedules older than 90 days"
    
    return True, None
def handle_staff_complaint(request):
    """Handle complaint creation for staff members"""
    try:
        user = request.user
        
        # Get files
        issue_photo = request.FILES.get('issue_photo')
        issue_video = request.FILES.get('issue_video')
        
        # Get text data
        subject = request.data.get('subject', '').strip()
        description = request.data.get('description', '').strip()
        priority = request.data.get('priority', 'MEDIUM')
        staff_phone = request.data.get('staff_phone', '').strip()
        schedule_id = request.data.get('related_schedule')
        
        # Validation
        if not subject or len(subject) < 5:
            return Response({'error': '❌ Subject must be at least 5 characters long'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not description or len(description) < 10:
            return Response({'error': '❌ Description must be at least 10 characters long'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not staff_phone:
            return Response({'error': '📱 Please enter your registered phone number'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify phone
        staff_phone_clean = ''.join(filter(str.isdigit, staff_phone))
        user_phone_clean = ''.join(filter(str.isdigit, user.phone_number or ''))
        
        if staff_phone_clean != user_phone_clean:
            return Response({'error': '❌ Phone number does not match your registered phone'}, status=status.HTTP_400_BAD_REQUEST)
        # 🆕 VALIDATE SCHEDULE ACCESS (ADD THIS SECTION)
        if schedule_id:
            is_valid, error_message = validate_staff_schedule_access(user, schedule_id)
            if not is_valid:
                return Response({
                    'error': error_message
                }, status=status.HTTP_403_FORBIDDEN)
        
        if not issue_photo and not issue_video:
            return Response({'error': '⚠️ Evidence is mandatory'}, status=status.HTTP_400_BAD_REQUEST)
        if not issue_photo and not issue_video:
            return Response({'error': '⚠️ Evidence is mandatory'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get related schedule
        related_schedule = None
        vehicle = None
        
        if schedule_id:
            try:
                related_schedule = Schedule.objects.get(id=schedule_id)
                vehicle = related_schedule.vehicle
            except Schedule.DoesNotExist:
                pass
        
        # Generate complaint ID
        complaint_id = f"CMP{timezone.now().strftime('%Y%m%d%H%M%S')}"
        
        # Create complaint
        complaint = Complaint.objects.create(
            complainant=user,
            passenger_name=user.name,
            passenger_phone=staff_phone_clean,
            complaint_id=complaint_id,
            subject=subject,
            description=description,
            priority=priority,
            related_schedule=related_schedule,
            vehicle=vehicle,
            issue_photo=issue_photo,
            issue_video=issue_video,
            is_verified=True,
            verification_notes=f"✅ VERIFIED STAFF COMPLAINT\nStaff: {user.name}\nEmployee ID: {user.employee_id}"
        )
        
        serializer = ComplaintSerializer(complaint, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({'error': f'Failed to create complaint: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_passenger_phone(request):
    """Verify if a phone number exists in user's bookings"""
    if request.user.user_type != 'PASSENGER':
        return Response({'error': 'Only passengers can verify phone numbers'}, status=status.HTTP_403_FORBIDDEN)
    
    passenger_phone = request.data.get('passenger_phone', '').strip()
    
    if not passenger_phone:
        return Response({'error': 'Phone number is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    passenger_phone_clean = ''.join(filter(str.isdigit, passenger_phone))
    if len(passenger_phone_clean) != 10:
        return Response({'error': 'Phone number must be 10 digits'}, status=status.HTTP_400_BAD_REQUEST)
    
    cutoff_date = (timezone.now() - timedelta(days=7)).date()
    
    matching_bookings = Booking.objects.filter(
        passenger=request.user,
        status__in=['CONFIRMED', 'COMPLETED'],
        schedule__schedule_date__gte=cutoff_date
    ).select_related('schedule', 'schedule__vehicle', 'schedule__route')
    
    found_bookings = []
    
    for booking in matching_bookings:
        passenger_details_list = booking.get_passenger_details()
        
        for passenger in passenger_details_list:
            p_phone_clean = ''.join(filter(str.isdigit, passenger.get('passenger_phone', '')))
            
            if p_phone_clean == passenger_phone_clean:
                found_bookings.append({
                    'booking_id': booking.booking_id,
                    'passenger_name': passenger.get('passenger_name', ''),
                    'seat_number': passenger.get('seat_number', ''),
                    'route': booking.schedule.route.route_name,
                    'date': str(booking.schedule.schedule_date),
                    'vehicle': booking.schedule.vehicle.vehicle_number
                })
    
    if not found_bookings:
        return Response({
            'verified': False,
            'message': f'No recent booking found with phone number {passenger_phone}'
        })
    
    return Response({
        'verified': True,
        'bookings': found_bookings,
        'message': f'Found {len(found_bookings)} booking(s)'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_staff_phone(request):
    """
    Verify if a staff member's phone number matches their profile
    Returns staff details if verified
    """
    if request.user.user_type not in ['DRIVER', 'CONDUCTOR', 'SUPERVISOR']:
        return Response({
            'error': 'Only staff members can verify their phone'
        }, status=status.HTTP_403_FORBIDDEN)
    
    staff_phone = request.data.get('staff_phone', '').strip()
    
    if not staff_phone:
        return Response({
            'error': 'Phone number is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Clean phone number
    staff_phone_clean = ''.join(filter(str.isdigit, staff_phone))
    if len(staff_phone_clean) != 10:
        return Response({
            'error': 'Phone number must be 10 digits'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get user's registered phone
    user_phone = request.user.phone_number or ''
    user_phone_clean = ''.join(filter(str.isdigit, user_phone))
    
    # Verify phone matches
    if staff_phone_clean != user_phone_clean:
        return Response({
            'verified': False,
            'message': f'Phone number {staff_phone} does not match your registered phone number'
        })
    
    # Get staff's recent schedules for context
    cutoff_date = (timezone.now() - timedelta(days=30)).date()
    
    recent_schedules = Schedule.objects.filter(
        Q(driver=request.user) | Q(conductor=request.user),
        schedule_date__gte=cutoff_date
    ).select_related('route', 'vehicle').order_by('-schedule_date')[:5]
    
    schedules_info = []
    for schedule in recent_schedules:
        schedules_info.append({
            'route': schedule.route.route_name,
            'vehicle': schedule.vehicle.vehicle_number,
            'date': str(schedule.schedule_date),
            'role': 'Driver' if schedule.driver == request.user else 'Conductor'
        })
    #🆕 GET ALL ELIGIBLE SCHEDULES (for complaint dropdown)
    # Staff can complain about schedules from last 90 days where they were assigned
    complaint_cutoff = (timezone.now() - timedelta(days=90)).date()
    
    eligible_schedules = Schedule.objects.filter(
        Q(driver=request.user) | Q(conductor=request.user),
        schedule_date__gte=complaint_cutoff
    ).select_related('route', 'vehicle').order_by('-schedule_date')
    
    eligible_schedules_list = []
    for schedule in eligible_schedules:
        eligible_schedules_list.append({
            'id': schedule.id,
            'route_name': schedule.route.route_name if schedule.route else 'Unknown',
            'vehicle_number': schedule.vehicle.vehicle_number if schedule.vehicle else 'Unknown',
            'schedule_date': str(schedule.schedule_date),
            'departure_time': str(schedule.departure_time) if schedule.departure_time else 'N/A',
            'role': 'Driver' if schedule.driver == request.user else 'Conductor'
        })
    return Response({
        'verified': True,
        'staff_info': {
            'name': request.user.name,
            'employee_id': request.user.employee_id,
            'phone': staff_phone_clean,
            'user_type': request.user.user_type,
            'working_district': request.user.working_district,
            'recent_schedules': schedules_info,
            'eligible_schedules': eligible_schedules_list
        },
        'message': 'Phone number verified successfully'
    })


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def resolve_complaint(request, complaint_id):
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        complaint = Complaint.objects.get(id=complaint_id)
    except Complaint.DoesNotExist:
        return Response({'error': 'Complaint not found'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status', complaint.status)
    valid_statuses = [choice[0] for choice in Complaint.COMPLAINT_STATUS]
    
    if new_status not in valid_statuses:
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

    complaint.status = new_status
    complaint.admin_response = request.data.get('admin_response', '')

    if complaint.status in ['RESOLVED', 'CLOSED']:
        complaint.resolved_date = timezone.now()

    complaint.save()

    return Response(ComplaintSerializer(complaint, context={'request': request}).data)


# =====================================================
# BOOKINGS WITH FLAG-BASED SEAT RESTRICTIONS
# =====================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def bookings(request):
    if request.method == 'GET':
        search = request.query_params.get('search', '')

        if request.user.user_type == 'PASSENGER':
            bookings_qs = Booking.objects.filter(passenger=request.user)
        elif request.user.user_type == 'ADMIN':
            bookings_qs = Booking.objects.all()
        else:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        if search:
            bookings_qs = bookings_qs.filter(
                Q(booking_id__icontains=search) |
                Q(passenger__name__icontains=search) |
                Q(schedule__vehicle__vehicle_number__icontains=search) |
                Q(schedule__route__route_name__icontains=search)
            )

        bookings_qs = bookings_qs.order_by('-booking_date')
        return Response(BookingSerializer(bookings_qs, many=True).data)

    # POST - Create booking with flag validation
    # ⚠️ DEPRECATED: This endpoint is for backwards compatibility only
    # New bookings should use the mock payment flow instead
    if request.user.user_type != 'PASSENGER':
        return Response({'error': 'Only passengers can create bookings'}, status=status.HTTP_403_FORBIDDEN)

    # ⚠️ PAYMENT VERIFICATION REQUIRED
    # Check if this is coming from payment flow
    payment_id = request.data.get('payment_id')
    if not payment_id:
        return Response({
            'error': 'Payment required. Please complete payment before booking.',
            'message': 'Direct booking creation is not allowed. Use the payment flow instead.'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        schedule_id = request.data.get('schedule')
        boarding_point = request.data.get('boarding_point', '').strip()
        destination_point = request.data.get('destination_point', '').strip()
        passenger_details = request.data.get('passenger_details', [])
        is_group_booking = request.data.get('is_group_booking', False)
        confirmed_warnings = request.data.get('confirmed_warnings', [])
        
        # Handle JSON parsing
        if isinstance(passenger_details, str):
            try:
                passenger_details = json.loads(passenger_details)
            except json.JSONDecodeError:
                return Response({'error': 'Invalid passenger details format'}, status=status.HTTP_400_BAD_REQUEST)

        if not schedule_id or not boarding_point or not destination_point:
            return Response({'error': 'Schedule, boarding and destination points are required'}, status=status.HTTP_400_BAD_REQUEST)

        if not passenger_details or not isinstance(passenger_details, list):
            return Response({'error': 'Passenger details are required'}, status=status.HTTP_400_BAD_REQUEST)

        seat_numbers = [detail.get('seat_number') for detail in passenger_details if detail.get('seat_number')]
        
        if not seat_numbers:
            return Response({'error': 'At least one seat must be selected'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate each passenger's details
        for detail in passenger_details:
            seat = detail.get('seat_number')
            
            if not detail.get('passenger_name') or not detail['passenger_name'].strip():
                return Response({'error': f'Passenger name is required for seat {seat}'}, status=status.HTTP_400_BAD_REQUEST)
            
            if not detail.get('passenger_phone') or not detail['passenger_phone'].strip():
                return Response({'error': f'Passenger phone number is required for seat {seat}'}, status=status.HTTP_400_BAD_REQUEST)
            
            if not detail.get('passenger_gender'):
                return Response({'error': f'Passenger gender is required for seat {seat}'}, status=status.HTTP_400_BAD_REQUEST)
            
            phone_clean = ''.join(filter(str.isdigit, detail['passenger_phone']))
            if len(phone_clean) != 10:
                return Response({'error': f'Phone number must be 10 digits for seat {seat}'}, status=status.HTTP_400_BAD_REQUEST)
            
            if not detail.get('passenger_alternate_phone'):
                return Response({'error': f'Alternate phone number is required for seat {seat}'}, status=status.HTTP_400_BAD_REQUEST)
            
            alt_phone_clean = ''.join(filter(str.isdigit, detail['passenger_alternate_phone']))
            if len(alt_phone_clean) != 10:
                return Response({'error': f'Alternate phone must be 10 digits for seat {seat}'}, status=status.HTTP_400_BAD_REQUEST)
            
            if phone_clean == alt_phone_clean:
                return Response({'error': f'Phone numbers cannot be the same for seat {seat}'}, status=status.HTTP_400_BAD_REQUEST)

            # Clean and store
            detail['passenger_phone'] = phone_clean
            detail['passenger_alternate_phone'] = alt_phone_clean
            detail['seat_number'] = seat

        try:
            schedule = Schedule.objects.get(id=schedule_id)
        except Schedule.DoesNotExist:
            return Response({'error': 'Schedule not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check if seats are already booked
        booked_seats = schedule.get_booked_seats()
        conflicting_seats = [seat for seat in seat_numbers if seat in booked_seats]
        
        if conflicting_seats:
            return Response({
                'error': f'Seats {", ".join(conflicting_seats)} are already booked'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 🚩 NEW: Validate each seat with flag system
        for detail in passenger_details:
            seat = detail['seat_number']
            gender = detail['passenger_gender']
            
            can_book, reason, requires_confirmation, confirmation_type = check_seat_availability_with_flags(
                seat_number=seat,
                passenger_gender=gender,
                schedule=schedule,
                is_group_booking=False,  # Will be auto-set by create_seat_restrictions()
                current_booking_seats=seat_numbers
            )
            
            if not can_book:
                return Response({
                    'error': f"Cannot book seat {seat}: {reason}"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if requires_confirmation:
                # Check if user confirmed this warning
                if confirmation_type not in confirmed_warnings:
                    # ✅ FIXED: Return 200 OK instead of 400 Bad Request
                    # This allows frontend to show confirmation dialog instead of error message
                    return Response({
                        'requires_confirmation': True,
                        'confirmation_type': confirmation_type,
                        'seat': seat,
                        'message': reason
                    }, status=status.HTTP_200_OK)

        # Check availability
        seats_count = len(seat_numbers)
        if schedule.available_seats < seats_count:
            return Response({'error': f'Only {schedule.available_seats} seats available'}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate fare
        fare_per_seat = calculate_fare_by_distance(schedule, boarding_point, destination_point)
        total_fare = fare_per_seat * seats_count

        # Create booking
        booking_id = f"BKG{timezone.now().strftime('%Y%m%d%H%M%S')}"
        first_passenger_alt_phone = passenger_details[0].get('passenger_alternate_phone', '')
        
        booking = Booking.objects.create(
            passenger=request.user,
            schedule=schedule,
            booking_id=booking_id,
            boarding_point=boarding_point,
            destination_point=destination_point,
            total_fare=total_fare,
            status='CONFIRMED',
            payment_status=True,
            seat_numbers=json.dumps(seat_numbers),
            passenger_details=json.dumps(passenger_details),
            seats_booked=len(seat_numbers),
            alternate_contact_number=first_passenger_alt_phone,
            is_group_booking=is_group_booking,
            booking_type='GROUP' if is_group_booking else 'INDIVIDUAL'
        )

        # 🚩 NEW: Create seat restrictions (FLAGS)
        create_seat_restrictions(booking, schedule)

        # Update schedule
        schedule.add_booked_seats(seat_numbers)
        schedule.available_seats -= seats_count
        schedule.save()

        # Send SMS
        schedule_info = f"{schedule.route.route_name} on {schedule.schedule_date} at {schedule.departure_time}. Seats: {', '.join(seat_numbers)}. Fare: ₹{total_fare}"
        send_booking_confirmation_sms(request.user.phone_number, booking_id, schedule_info)

        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def cancel_booking(request, booking_id):
    """Cancel a booking and remove seat restrictions (FLAGS)"""
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.user.user_type == 'PASSENGER' and booking.passenger != request.user:
        return Response({'error': 'Unauthorized access'}, status=status.HTTP_403_FORBIDDEN)
    
    if booking.status not in ['CONFIRMED', 'PENDING']:
        return Response({'error': 'Only confirmed or pending bookings can be cancelled'}, status=status.HTTP_400_BAD_REQUEST)
    
    today = timezone.now().date()
    if booking.schedule.schedule_date <= today:
        return Response({'error': 'Cannot cancel bookings for today or past dates'}, status=status.HTTP_400_BAD_REQUEST)
    
    cancellation_reason = request.data.get('cancellation_reason', '')
    if cancellation_reason:
        booking.cancellation_reason = cancellation_reason
    
    booking.status = 'CANCELLED'
    booking.save()
    remove_seat_restrictions(booking)
    schedule = booking.schedule
    seat_numbers = booking.get_seat_numbers()
    schedule.remove_booked_seats(seat_numbers)
    schedule.available_seats = schedule.vehicle.capacity - len(schedule.get_booked_seats())
    schedule.save()
    
    return Response({
        'message': 'Booking cancelled successfully',
        'booking': BookingSerializer(booking).data
    })


# =====================================================
# SEAT MATRIX WITH FLAGS
# =====================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_seat_matrix_with_flags(request, schedule_id):
    """
    Get complete seat matrix showing all seats and their restriction flags
    """
    try:
        schedule = Schedule.objects.get(id=schedule_id)
        vehicle = schedule.vehicle
        
        # Get all seats
        total_rows = vehicle.total_rows
        layout = vehicle.seat_layout
        if '-' in layout:
            left_seats, right_seats = map(int, layout.split('-'))
        else:
            left_seats, right_seats = 2, 2
        
        seats_per_row = left_seats + right_seats
        seat_letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        
        seat_matrix = []
        
        for row in range(1, total_rows + 1):
            row_seats = []
            
            for seat_idx in range(seats_per_row):
                seat_number = f"{row}{seat_letters[seat_idx]}"
                
                # Get booking info
                booking = Booking.objects.filter(
                    schedule=schedule,
                    passenger_details__contains=seat_number,
                    status='CONFIRMED'
                ).first()
                
                # Get passenger info if booked
                passenger_info = None
                if booking:
                    try:
                        details = json.loads(booking.passenger_details)
                        passenger_info = next((p for p in details if p.get('seat_number') == seat_number), None)
                    except:
                        pass
                
                # Get restrictions
                restrictions = get_seat_restrictions(seat_number, schedule)
                
                # Determine seat type
                women_seats = get_women_reserved_seats(vehicle)
                seat_type = 'AVAILABLE'
                
                if seat_number in women_seats:
                    seat_type = 'WOMEN_RESERVED'
                elif booking:
                    if booking.is_group_booking:
                        seat_type = 'BOOKED_GROUP'
                    elif passenger_info:
                        seat_type = f"BOOKED_{passenger_info.get('passenger_gender', 'UNKNOWN')}"
                elif restrictions['is_female_only']:
                    seat_type = 'FEMALE_ONLY'
                
                row_seats.append({
                    'seat_number': seat_number,
                    'seat_type': seat_type,
                    'is_booked': booking is not None,
                    'booking_id': booking.booking_id if booking else None,
                    'is_group_booking': booking.is_group_booking if booking else False,
                    'passenger_gender': passenger_info.get('passenger_gender') if passenger_info else None,
                    'is_female_only': restrictions['is_female_only'],
                    'restrictions': restrictions['restrictions'],
                    'is_aisle': seat_idx == left_seats - 1
                })
            
            seat_matrix.append(row_seats)
        
        return Response({
            'schedule_id': schedule_id,
            'vehicle': vehicle.vehicle_number,
            'layout': layout,
            'seat_matrix': seat_matrix
        })
        
    except Schedule.DoesNotExist:
        return Response({'error': 'Schedule not found'}, status=status.HTTP_404_NOT_FOUND)


# =====================================================
# CHECK SEAT AVAILABILITY WITH FLAGS
# =====================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_seat_availability_api(request):
    """
    Check if seats can be booked
    Returns restriction info including flags
    """
    schedule_id = request.data.get('schedule_id')
    seats = request.data.get('seats', [])
    passenger_gender = request.data.get('passenger_gender')
    is_group_booking = request.data.get('is_group_booking', False)
    
    try:
        schedule = Schedule.objects.get(id=schedule_id)
    except Schedule.DoesNotExist:
        return Response({'error': 'Schedule not found'}, status=status.HTTP_404_NOT_FOUND)
    
    seat_info = []
    
    for seat in seats:
        can_book, reason, requires_confirmation, confirmation_type = check_seat_availability_with_flags(
            seat, 
            passenger_gender,
            schedule,
            is_group_booking,
            seats
        )
        
        # Get restriction details
        restrictions = get_seat_restrictions(seat, schedule)
        
        seat_info.append({
            'seat_number': seat,
            'can_book': can_book,
            'reason': reason,
            'requires_confirmation': requires_confirmation,
            'confirmation_type': confirmation_type,
            'is_female_only': restrictions['is_female_only'],
            'restriction_type': restrictions['restriction_type'],
            'restrictions': restrictions['restrictions']
        })
    
    return Response({
        'seat_info': seat_info
    })


# =====================================================
# OTHER ENDPOINTS
# =====================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payrolls(request):
    search = request.query_params.get('search', '')

    if request.user.user_type == 'ADMIN':
        payrolls_qs = Payroll.objects.all().order_by('-month', 'staff__name')
        if search:
            payrolls_qs = payrolls_qs.filter(
                Q(staff__name__icontains=search) |
                Q(staff__employee_id__icontains=search)
            )
    elif request.user.user_type in ['DRIVER', 'CONDUCTOR', 'SUPERVISOR']:
        payrolls_qs = Payroll.objects.filter(staff=request.user).order_by('-month')
    else:
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

    return Response(PayrollSerializer(payrolls_qs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def schedules(request):
    district = request.query_params.get('district')
    date = request.query_params.get('date')
    search = request.query_params.get('search', '')

    schedules_qs = Schedule.objects.filter(is_active=True)

    if request.user.user_type == 'DRIVER':
        schedules_qs = schedules_qs.filter(driver=request.user)
    elif request.user.user_type == 'CONDUCTOR':
        schedules_qs = schedules_qs.filter(conductor=request.user)
    elif request.user.user_type == 'PASSENGER':
        schedules_qs = schedules_qs.filter(schedule_date__gte=timezone.now().date())

    if district:
        schedules_qs = schedules_qs.filter(route__district__name=district)

    if date:
        schedules_qs = schedules_qs.filter(schedule_date=date)

    if search:
        schedules_qs = schedules_qs.filter(
            Q(route__route_number__icontains=search) |
            Q(route__route_name__icontains=search) |
            Q(vehicle__vehicle_number__icontains=search) |
            Q(driver__name__icontains=search)
        )

    schedules_qs = schedules_qs.order_by('schedule_date', 'departure_time')
    return Response(ScheduleSerializer(schedules_qs, many=True).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def districts(request):
    districts_qs = District.objects.all().order_by('name')
    return Response(DistrictSerializer(districts_qs, many=True).data)


# =====================================================
# EMERGENCY NOTIFICATIONS
# =====================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_emergency_notification(request):
    """Send emergency notification to all active passengers of a schedule"""
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Only administrators can send emergency notifications'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = SendEmergencyNotificationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    schedule_id = serializer.validated_data['schedule_id']
    message = serializer.validated_data['message']
    hospital_info = serializer.validated_data.get('hospital_info', '')
    
    try:
        schedule = Schedule.objects.get(id=schedule_id)
    except Schedule.DoesNotExist:
        return Response({'error': 'Schedule not found'}, status=status.HTTP_404_NOT_FOUND)
    
    active_bookings = Booking.objects.filter(schedule=schedule).exclude(status='CANCELLED').select_related('passenger')
    
    if not active_bookings.exists():
        return Response({'error': 'No active passengers found'}, status=status.HTTP_400_BAD_REQUEST)
    
    full_message = f"""🚨 EMERGENCY ALERT 🚨

{message}

Route: {schedule.route.route_name}
Vehicle: {schedule.vehicle.vehicle_number}
Date: {schedule.schedule_date}

"""
    
    if hospital_info:
        full_message += f"""Hospital Information:
{hospital_info}

"""
    
    full_message += "Please contact authorities immediately if you need assistance."
    
    notification = EmergencyNotification.objects.create(
        schedule=schedule,
        message=message,
        hospital_info=hospital_info,
        sent_by=request.user,
        total_recipients=0,
        successful_sends=0,
        failed_sends=0
    )
    
    successful_sends = 0
    failed_sends = 0
    recipients_data = []
    total_individual_passengers = 0
    
    for booking in active_bookings:
        try:
            passenger_details = json.loads(booking.passenger_details)
        except (json.JSONDecodeError, TypeError):
            passenger_details = []
        
        if not passenger_details:
            
            continue
        
        for passenger_info in passenger_details:
            total_individual_passengers += 1
            
            passenger_name = passenger_info.get('passenger_name', 'Unknown')
            alternate_number = passenger_info.get('passenger_alternate_phone', '')
            seat_number = passenger_info.get('seat_number', 'N/A')
            
            if not alternate_number or alternate_number.strip() == '':
                failed_sends += 1
                continue
            
            success, result = send_sms_fast2sms(alternate_number, full_message)
            
            NotificationRecipient.objects.create(
                notification=notification,
                booking=booking,
                passenger_name=f"{passenger_name} (Seat {seat_number})",
                seat_number=seat_number,
                contact_number=alternate_number,
                is_alternate_number=True,
                sent_status=success,
                sent_at=timezone.now() if success else None,
                error_message=None if success else result
            )
            
            if success:
                successful_sends += 1
            else:
                failed_sends += 1
    
    notification.total_recipients = total_individual_passengers
    notification.successful_sends = successful_sends
    notification.failed_sends = failed_sends
    notification.save()
    
    return Response({
        'message': 'Emergency notification sent',
        'notification_id': notification.id,
        'total_recipients': notification.total_recipients,
        'successful_sends': successful_sends,
        'failed_sends': failed_sends
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_emergency_notifications(request):
    """Get all emergency notifications (admin only)"""
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Only administrators can view emergency notifications'}, status=status.HTTP_403_FORBIDDEN)
    
    notifications = EmergencyNotification.objects.all()
    serializer = EmergencyNotificationSerializer(notifications, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notification_details(request, notification_id):
    """Get detailed information about a specific notification"""
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Only administrators can view notification details'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        notification = EmergencyNotification.objects.get(id=notification_id)
    except EmergencyNotification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)
    
    serializer = EmergencyNotificationSerializer(notification)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_bus_location(request):
    """
    Update bus GPS location
    - Drivers and conductors can update their assigned schedules
    - Admins can update any schedule
    - Supports multiple devices (driver + conductor phones)
    """
    data = request.data
    
    # ✅ Get battery and accuracy from request
    battery_level = data.get('battery_level')
    accuracy = data.get('accuracy')
    
    print(f"🔋 Received battery: {battery_level}")  # Debug
    print(f"📍 Received accuracy: {accuracy}")  # Debug
    try:
        schedule_id = request.data.get('schedule_id')
        if not schedule_id:
            return Response(
                {'error': 'schedule_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        schedule = get_object_or_404(Schedule, id=schedule_id)
        
        # Permission check
        user = request.user
        is_admin = user.user_type == 'ADMIN'
        is_driver = schedule.driver == user
        is_conductor = schedule.conductor == user
        
        if not (is_admin or is_driver or is_conductor):
            return Response(
                {'error': 'You do not have permission to update this schedule\'s location'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get or create location record for this schedule
        location, created = BusLocation.objects.get_or_create(
            schedule=schedule,
            defaults={
                'latitude': request.data.get('latitude'),
                'longitude': request.data.get('longitude'),
                'updated_by': user,
            }
        )
        
        # Update location data
        serializer = BusLocationUpdateSerializer(location, data=request.data, partial=True)
        if serializer.is_valid():
            # Determine device type
            if is_admin:
                device_type = 'ADMIN'
            elif is_driver:
                device_type = 'DRIVER_PHONE'
            elif is_conductor:
                device_type = 'CONDUCTOR_PHONE'
            else:
                device_type = request.data.get('device_type', 'DRIVER_PHONE')
            # ── Hardware GPS override ──────────────────────────────────
            # If the request explicitly sends GPS_HARDWARE, honour it
            # regardless of which user account is logged in
            if request.data.get('device_type') == 'GPS_HARDWARE':
                device_type = 'GPS_HARDWARE'

            # ── Block phone updates if hardware GPS posted within 30s ──
            if device_type in ('DRIVER_PHONE', 'CONDUCTOR_PHONE'):
                last_hw = BusLocationHistory.objects.filter(
                    schedule=schedule,
                    device_type='GPS_HARDWARE'
                ).order_by('-timestamp').first()

                if last_hw:
                    age = (timezone.now() - last_hw.timestamp).total_seconds()
                    if age < 30:
                        return Response({
                            'status':  'skipped',
                            'reason':  'GPS hardware is active. Phone updates are disabled.',
                            'last_hardware_update': last_hw.timestamp,
                        }, status=status.HTTP_200_OK)
            location = serializer.save(
                updated_by=user,
                device_type=device_type,
                timestamp=timezone.now()
            )
            
            # Save to history
            BusLocationHistory.objects.create(
                schedule=schedule,
                latitude=data.get('latitude'),
                longitude=data.get('longitude'),
                speed=data.get('speed', 0),
                heading=data.get('heading', 0),
                accuracy=accuracy,  # ✅ Save real accuracy
                battery_level=battery_level,  # ✅ Save battery!
                updated_by=request.user,
                device_type=device_type,
                is_moving=data.get('is_moving', False),
            )
            
            
            
            return Response(
                BusLocationSerializer(location).data,
                status=status.HTTP_200_OK
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_bus_location(request, schedule_id):
    """
    Get current location of a specific bus
    - Admins can view any bus
    - Staff can view their assigned buses
    - Passengers can only view buses they have booked
    """
    try:
        schedule = get_object_or_404(Schedule, id=schedule_id)
        user = request.user
        
        # Permission check
        is_admin = user.user_type == 'ADMIN'
        is_staff = schedule.driver == user or schedule.conductor == user
        
        # Check if passenger has booking for this schedule
        is_passenger_with_booking = False
        if user.user_type == 'PASSENGER':
            is_passenger_with_booking = Booking.objects.filter(
                schedule=schedule,
                passenger=user,
                status__in=['BOOKED', 'CONFIRMED']
            ).exists()
        
        if not (is_admin or is_staff or is_passenger_with_booking):
            return Response(
                {'error': 'You do not have permission to view this bus location'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get latest location
        location = BusLocation.objects.filter(schedule=schedule).first()
        
        if not location:
            return Response(
                {'error': 'No location data available for this schedule'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = BusLocationSerializer(location)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_bus_locations(request):
    """
    Get locations of all active buses with BOTH driver and conductor updates
    """
    try:
        user = request.user
        
        if user.user_type == 'ADMIN':
            locations = BusLocation.objects.select_related(
                'schedule__route',
                'schedule__vehicle',
                'schedule__driver',
                'schedule__conductor'
            ).order_by( '-timestamp')
            # 2️⃣ Deduplicate schedules in Python (SQLite safe)
            seen_schedule_ids = set()
            unique_locations = []

            for location in locations:
                if location.schedule_id not in seen_schedule_ids:
                    seen_schedule_ids.add(location.schedule_id)
                    unique_locations.append(location)

            locations = unique_locations

        elif user.user_type == 'PASSENGER':
            booked_schedules = Booking.objects.filter(
                passenger=user,
                status__in=['BOOKED', 'CONFIRMED']
            ).values_list('schedule_id', flat=True)
            
            locations = BusLocation.objects.filter(
                schedule_id__in=booked_schedules
            ).select_related(
                'schedule__route',
                'schedule__vehicle',
                'schedule__driver',
                'schedule__conductor'
            )
        else:
            locations = BusLocation.objects.filter(
                models.Q(schedule__driver=user) |
                models.Q(schedule__conductor=user)
            ).select_related(
                'schedule__route',
                'schedule__vehicle',
                'schedule__driver',
                'schedule__conductor'
            )

        # 🔍 Optional search
        search = request.query_params.get('search')
        if search:
            locations = locations.filter(
                models.Q(schedule__route__route_name__icontains=search) |
                models.Q(schedule__route__route_number__icontains=search) |
                models.Q(schedule__vehicle__vehicle_number__icontains=search)
            )

        result = []
        for location in locations:
            location_data = BusLocationSerializer(location).data
            # Hardware GPS update (ESP32)
            hardware_update = BusLocationHistory.objects.filter(
                schedule=location.schedule,
                device_type='GPS_HARDWARE'
            ).order_by('-timestamp').first()
            location_data['hardware_update'] = (
                BusLocationHistorySerializer(hardware_update).data
                if hardware_update else None
            )
            # Driver update
            driver = location.schedule.driver
            if driver:
                driver_update = BusLocationHistory.objects.filter(
                    schedule=location.schedule,
                    updated_by=driver,
                    device_type='DRIVER_PHONE'
                ).order_by('-timestamp').first()
                location_data['driver_update'] = (
                    BusLocationHistorySerializer(driver_update).data
                    if driver_update else None
                )
            else:
                location_data['driver_update'] = None

            # Conductor update
            conductor = location.schedule.conductor
            if conductor:
                conductor_update = BusLocationHistory.objects.filter(
                    schedule=location.schedule,
                    updated_by=conductor
                ).order_by('-timestamp').first()
                location_data['conductor_update'] = (
                    BusLocationHistorySerializer(conductor_update).data
                    if conductor_update else None
                )
            else:
                location_data['conductor_update'] = None

            # Recent history
            recent_history = BusLocationHistory.objects.filter(
                schedule=location.schedule
            ).order_by('-timestamp')[:10]

            location_data['recent_history'] = BusLocationHistorySerializer(
                recent_history, many=True
            ).data

            result.append(location_data)

        return Response(result, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_location_history(request, schedule_id):
    """
    Get historical location data for a schedule
    - Admin and staff only
    """
    try:
        user = request.user
        schedule = get_object_or_404(Schedule, id=schedule_id)
        
        # Permission check
        is_admin = user.user_type == 'ADMIN'
        is_staff = schedule.driver == user or schedule.conductor == user
        
        if not (is_admin or is_staff):
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get history (limit to last 1000 points for performance)
        history = BusLocationHistory.objects.filter(
            schedule=schedule
        ).order_by('-timestamp')[:1000]
        
        serializer = BusLocationHistorySerializer(history, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_bus_location(request, schedule_id):
    """
    Delete GPS location data for a schedule
    - Admin only
    """
    try:
        user = request.user
        
        if user.user_type != 'ADMIN':
            return Response(
                {'error': 'Permission denied. Admin only.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        schedule = get_object_or_404(Schedule, id=schedule_id)
        
        # Delete current location
        deleted_count = BusLocation.objects.filter(schedule=schedule).delete()[0]
        
        return Response(
            {'message': f'Deleted {deleted_count} location record(s)'},
            status=status.HTTP_200_OK
        )
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )




def generate_mock_signature(order_id, payment_id):
    """Generate mock payment signature for verification"""
    secret = "mock_secret_key_12345"
    data = f"{order_id}|{payment_id}|{secret}"
    return hashlib.sha256(data.encode()).hexdigest()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_mock_payment_order(request):
    """
    STEP 1: Create a mock payment order
    This is called when user clicks 'Confirm Booking'
    """
    try:
        user = request.user
        amount = request.data.get('amount')
        
        if not amount:
            return Response(
                {'error': 'Amount is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create mock payment
        payment = MockPayment.objects.create(
            amount=amount,
            currency='INR',
            status='PENDING',
            user=user,
            user_email=user.email or '',
            user_phone=user.phone_number,
            receipt=f"receipt_{user.id}_{int(time.time())}",
            description=f"Bus booking for {user.name}",
            notes=request.data.get('notes', {})
        )
        
        # Return payment details
        return Response({
            'order_id': payment.order_id,
            'payment_id': payment.payment_id,
            'amount': float(payment.amount),
            'currency': payment.currency,
            'user_name': user.name,
            'user_email': user.email or '',
            'user_phone': user.phone_number,
            'is_mock': True
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_mock_payment(request):
    """
    STEP 2: Process mock payment with card/UPI/netbanking/wallet details
    This simulates the actual payment processing
    """
    try:
        order_id = request.data.get('order_id')
        payment_method = request.data.get('payment_method')  # CARD, UPI, NETBANKING, WALLET

        # Get payment
        payment = get_object_or_404(MockPayment, order_id=order_id)

        # Simulate processing delay
        time.sleep(2)

        # Default success value
        success = True

        # ---------------- CARD LOGIC ----------------
        if payment_method == 'CARD':
            card_number = request.data.get('card_number', '')
            cvv = request.data.get('cvv', '')

            if card_number.endswith('1111'):  # Success card
                success = True
                payment.card_last_4 = card_number[-4:]
                payment.card_type = 'Visa' if card_number.startswith('4') else 'Mastercard'

            elif card_number.endswith('0000'):  # Failure card
                success = False
                payment.error_code = 'CARD_DECLINED'
                payment.error_description = 'Card was declined by the bank'

            else:  # Random success
                success = random.random() < 0.9
                if success:
                    payment.card_last_4 = card_number[-4:]
                    payment.card_type = 'Visa' if card_number.startswith('4') else 'Mastercard'
                else:
                    payment.error_code = 'INSUFFICIENT_FUNDS'
                    payment.error_description = 'Insufficient balance in account'

        # ---------------- UPI LOGIC ----------------
        elif payment_method == 'UPI':
            upi_id = request.data.get('upi_id', '')

            if 'success@' in upi_id.lower():
                success = True
                payment.upi_id = upi_id

            elif 'fail@' in upi_id.lower():
                success = False
                payment.error_code = 'UPI_DECLINED'
                payment.error_description = 'UPI payment declined'

            else:
                success = random.random() < 0.9
                if success:
                    payment.upi_id = upi_id
                else:
                    payment.error_code = 'UPI_TIMEOUT'
                    payment.error_description = 'UPI payment timed out'

        # ---------------- NET BANKING LOGIC ----------------
        elif payment_method == 'NETBANKING':
            bank_code = request.data.get('bank_code', '')

            if bank_code == 'test_success':
                success = True
                payment.notes = {'bank': 'Test Bank - Success'}

            elif bank_code == 'test_failure':
                success = False
                payment.error_code = 'NETBANKING_DECLINED'
                payment.error_description = 'Net banking payment was declined'

            else:
                success = random.random() < 0.95
                if success:
                    bank_names = {
                        'sbi': 'State Bank of India',
                        'hdfc': 'HDFC Bank',
                        'icici': 'ICICI Bank',
                        'axis': 'Axis Bank',
                        'kotak': 'Kotak Mahindra Bank',
                        'pnb': 'Punjab National Bank',
                        'bob': 'Bank of Baroda',
                        'canara': 'Canara Bank'
                    }
                    payment.notes = {'bank': bank_names.get(bank_code, 'Unknown Bank')}
                else:
                    payment.error_code = 'NETBANKING_TIMEOUT'
                    payment.error_description = 'Net banking session timed out'

        # ---------------- WALLET LOGIC ----------------
        elif payment_method == 'WALLET':
            wallet_provider = request.data.get('wallet_provider', '')
            wallet_phone = request.data.get('wallet_phone', '')

            if wallet_provider == 'test_success':
                success = True
                payment.notes = {
                    'wallet': 'Test Wallet - Success',
                    'phone': wallet_phone
                }

            elif wallet_provider == 'test_failure':
                success = False
                payment.error_code = 'WALLET_DECLINED'
                payment.error_description = 'Wallet payment was declined'

            else:
                success = random.random() < 0.92
                if success:
                    wallet_names = {
                        'paytm': 'Paytm Wallet',
                        'phonepe': 'PhonePe Wallet',
                        'googlepay': 'Google Pay',
                        'amazonpay': 'Amazon Pay',
                        'mobikwik': 'Mobikwik',
                        'freecharge': 'Freecharge'
                    }
                    payment.notes = {
                        'wallet': wallet_names.get(wallet_provider, 'Unknown Wallet'),
                        'phone': wallet_phone
                    }
                else:
                    payment.error_code = 'WALLET_INSUFFICIENT_BALANCE'
                    payment.error_description = 'Insufficient balance in wallet'

        # ---------------- UPDATE PAYMENT STATUS ----------------
        payment.payment_method = payment_method

        if success:
            payment.status = 'SUCCESS'
            payment.paid_at = timezone.now()
            payment.mock_signature = generate_mock_signature(
                payment.order_id,
                payment.payment_id
            )
        else:
            payment.status = 'FAILED'

        payment.save()

        return Response({
            'success': success,
            'payment_id': payment.payment_id,
            'order_id': payment.order_id,
            'status': payment.status,
            'signature': payment.mock_signature if success else None,
            'error_code': payment.error_code if not success else None,
            'error_description': payment.error_description if not success else None
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_mock_payment(request):
    """
    STEP 3: Verify mock payment signature
    """
    try:
        order_id = request.data.get('order_id')
        payment_id = request.data.get('payment_id')
        signature = request.data.get('signature')
        
        if not all([order_id, payment_id, signature]):
            return Response(
                {'error': 'Missing verification details'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get payment
        payment = get_object_or_404(MockPayment, order_id=order_id, payment_id=payment_id)
        
        # Verify signature
        expected_signature = generate_mock_signature(order_id, payment_id)
        
        if signature != expected_signature:
            payment.status = 'FAILED'
            payment.error_description = 'Signature verification failed'
            payment.save()
            
            return Response(
                {'error': 'Payment signature verification failed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Signature verified
        return Response({
            'message': 'Payment verified successfully',
            'payment_id': payment.id,
            'status': 'SUCCESS'
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_booking_after_mock_payment(request):
    """
    STEP 4: Confirm booking after successful payment
    FIXED VERSION - Properly handles all edge cases
    """
    try:
        user = request.user
        payment_id = request.data.get('payment_id')
        booking_data = request.data.get('booking_data')
        
        print(f"\n{'='*80}")
        print(f"🎫 CONFIRMING BOOKING AFTER PAYMENT")
        print(f"{'='*80}")
        print(f"👤 User: {user.name} ({user.id})")
        print(f"💳 Payment ID: {payment_id}")
        print(f"📦 Booking Data: {booking_data}")
        print(f"{'='*80}\n")
        
        # ✅ VALIDATION - Step by step with specific errors
        if not payment_id:
            return Response(
                {'error': 'Missing payment ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not booking_data:
            return Response(
                {'error': 'Missing booking data. Please try booking again.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # ✅ GET PAYMENT - With proper error handling
        try:
            payment = MockPayment.objects.get(payment_id=payment_id, user=user)
        except MockPayment.DoesNotExist:
            return Response(
                {'error': 'Payment not found or does not belong to you'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # ✅ VERIFY PAYMENT STATUS
        if payment.status != 'SUCCESS':
            return Response(
                {'error': f'Payment status is {payment.status}, not SUCCESS. Cannot confirm booking.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # ✅ CHECK IF PAYMENT ALREADY USED
        if Booking.objects.filter(mock_payment=payment).exists():
            return Response(
                {'error': 'This payment has already been used for another booking'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # ✅ GET SCHEDULE
        schedule_id = booking_data.get('schedule_id') or booking_data.get('schedule')
        if not schedule_id:
            return Response(
                {'error': 'Missing schedule_id in booking data'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            schedule = Schedule.objects.get(id=schedule_id)
        except Schedule.DoesNotExist:
            return Response(
                {'error': f'Schedule with ID {schedule_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # ✅ EXTRACT AND VALIDATE DATA
        passenger_details = booking_data.get('passenger_details', [])
        if not passenger_details:
            return Response(
                {'error': 'Missing passenger details'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        seat_numbers = booking_data.get('seat_numbers', [])
        if not seat_numbers:
            return Response(
                {'error': 'Missing seat numbers'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        boarding_point = booking_data.get('boarding_point', '').strip()
        destination_point = booking_data.get('destination_point', '').strip()
        
        if not boarding_point or not destination_point:
            return Response(
                {'error': 'Missing boarding or destination point'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # ✅ VERIFY SEAT AVAILABILITY (double-check)
        current_booked_seats = schedule.get_booked_seats()
        for seat in seat_numbers:
            if seat in current_booked_seats:
                return Response(
                    {'error': f'Seat {seat} is already booked. Please select different seats.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        print(f"✅ All validations passed!")
        print(f"📍 Boarding: {boarding_point}")
        print(f"📍 Destination: {destination_point}")
        print(f"💺 Seats: {seat_numbers}")
        print(f"👥 Passengers: {len(passenger_details)}")
        
        # ✅ USE TRANSACTION TO ENSURE ATOMICITY
        with transaction.atomic():
            # Generate unique booking ID
            booking_id = f"BK{timezone.now().strftime('%Y%m%d')}{random.randint(1000, 9999)}"
            while Booking.objects.filter(booking_id=booking_id).exists():
                booking_id = f"BK{timezone.now().strftime('%Y%m%d')}{random.randint(1000, 9999)}"
            
            # ✅ CREATE BOOKING
            booking = Booking.objects.create(
                booking_id=booking_id,
                passenger=user,
                schedule=schedule,
                booking_date=timezone.now(),
                boarding_point=boarding_point,
                destination_point=destination_point,
                total_fare=payment.amount,
                status='CONFIRMED',
                payment_status=True,
                mock_payment=payment,
                seats_booked=len(seat_numbers),
                seat_numbers=json.dumps(seat_numbers),
                passenger_details=json.dumps(passenger_details),
                is_group_booking=len(seat_numbers) >= 2,
                booking_type='GROUP' if len(seat_numbers) >= 2 else 'INDIVIDUAL'
            )
            
            print(f"✅ Booking created: {booking.booking_id}")
            
            # ✅ CREATE PASSENGER DETAILS (related model)
            for passenger_data in passenger_details:
                PassengerDetails.objects.create(
                    booking=booking,
                    seat_number=passenger_data.get('seat_number', ''),
                    passenger_name=passenger_data.get('passenger_name', ''),
                    passenger_gender=passenger_data.get('passenger_gender', 'OTHER'),
                    passenger_age=int(passenger_data.get('passenger_age', 0)),
                    passenger_phone=passenger_data.get('passenger_phone', ''),
                    passenger_alternate_phone=passenger_data.get('passenger_alternate_phone', '')
                )
            
            print(f"✅ Created {len(passenger_details)} passenger detail records")
            
            # ✅ UPDATE SCHEDULE BOOKED SEATS
            new_booked_seats = list(set(current_booked_seats + seat_numbers))
            schedule.booked_seats = json.dumps(new_booked_seats)
            schedule.available_seats = schedule.vehicle.capacity - len(new_booked_seats)
            schedule.save()
            
            print(f"✅ Updated schedule: {len(new_booked_seats)} total booked seats, {schedule.available_seats} available")
            
            # ✅ CREATE SEAT RESTRICTIONS (for female passengers)
            try:
                from .utils import create_seat_restrictions
                create_seat_restrictions(booking, schedule)
                print(f"✅ Seat restrictions created (if applicable)")
            except Exception as e:
                print(f"⚠️ Warning: Could not create seat restrictions: {e}")
                # Don't fail the booking if restriction creation fails
            
            # ✅ SEND SMS CONFIRMATION (optional - graceful failure)
            try:
                from accounts.utils import send_booking_confirmation_sms
                send_booking_confirmation_sms(
                    phone_number=user.phone_number,
                    booking_id=booking.booking_id,
                    route_name=schedule.route.route_name,
                    schedule_date=schedule.schedule_date.strftime('%Y-%m-%d'),
                    departure_time=schedule.departure_time.strftime('%H:%M'),
                    seats=', '.join(seat_numbers)
                )
                print(f"✅ SMS confirmation sent to {user.phone_number}")
            except Exception as e:
                print(f"⚠️ Warning: Could not send SMS: {e}")
                # Don't fail the booking if SMS fails
        
        print(f"\n{'='*80}")
        print(f"🎉 BOOKING CONFIRMED SUCCESSFULLY")
        print(f"{'='*80}\n")
        
        # ✅ RETURN SUCCESS RESPONSE
        return Response({
            'message': 'Booking confirmed successfully',
            'booking_id': booking.id,
            'booking_reference': booking.booking_id,
            'seats': seat_numbers,
            'total_fare': str(payment.amount),
            'payment_status': 'SUCCESS',
            'schedule': {
                'route_name': schedule.route.route_name,
                'date': schedule.schedule_date.strftime('%Y-%m-%d'),
                'time': schedule.departure_time.strftime('%H:%M')
            }
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        print(f"\n{'='*80}")
        print(f"❌ BOOKING CONFIRMATION ERROR")
        print(f"{'='*80}")
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*80}\n")
        
        return Response(
            {'error': f'Booking confirmation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_booking_with_mock_refund(request, booking_id):
    """
    Cancel booking and process INSTANT mock refund
    """
    try:
        user = request.user
        booking = get_object_or_404(Booking, id=booking_id, passenger=user)
        
        # Check if booking can be cancelled
        if booking.status in ['CANCELLED', 'REFUNDED', 'COMPLETED']:
            return Response(
                {'error': f'Booking already {booking.status.lower()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check payment
        if not booking.mock_payment:
            return Response(
                {'error': 'No payment found for this booking'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payment = booking.mock_payment
        
        if payment.status != 'SUCCESS':
            return Response(
                {'error': 'Payment was not successful. Cannot refund.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate refund (you can add cancellation charges)
        refund_amount = payment.amount
        cancellation_charge = 0
        
        # Example: 10% charge if < 24 hours before journey
        # Uncomment if you want to implement this
        # from datetime import timedelta
        # journey_time = booking.schedule.departure_time
        # time_until_journey = journey_time - timezone.now()
        # if time_until_journey < timedelta(hours=24):
        #     cancellation_charge = float(refund_amount) * 0.10
        
        final_refund_amount = float(refund_amount) - cancellation_charge
        cancellation_reason = request.data.get('reason', '').strip()
        if not cancellation_reason:
            return Response(
                {'error': 'Cancellation reason is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Create refund (INSTANT in mock system)
        refund = MockRefund.objects.create(
            payment=payment,
            booking=booking,
            amount=final_refund_amount,
            status='SUCCESS',  # Instant success!
            reason=cancellation_reason,
            initiated_by=user,
            instant_refund=True,
            processed_at=timezone.now()
        )
        
        # Update statuses
        booking.status = 'REFUNDED'
        booking.cancellation_reason = cancellation_reason
        booking.save()
        
        payment.status = 'REFUNDED'
        payment.save()
        
        # Remove seat restrictions (FLAGS)
        remove_seat_restrictions(booking)
        
        # Release seats using the Schedule model's method
        passenger_details = booking.get_passenger_details()
        seats_to_release = [pd.get('seat_number') for pd in passenger_details]
        
        schedule = booking.schedule
        schedule.remove_booked_seats(seats_to_release)
        schedule.available_seats = schedule.vehicle.capacity - len(schedule.get_booked_seats())
        schedule.save()
        
        return Response({
            'message': 'Booking cancelled and refund processed',
            'refund_id': refund.refund_id,
            'refund_amount': final_refund_amount,
            'cancellation_charge': cancellation_charge,
            'refund_status': 'SUCCESS',
            'instant_refund': True,
            'note': 'Mock refund processed instantly! In real system, it takes 5-7 days.'
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_mock_payments(request):
    """Get all mock payments for current user"""
    try:
        user = request.user
        payments = MockPayment.objects.filter(user=user).order_by('-created_at')
        serializer = MockPaymentSerializer(payments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_mock_payment_details(request, payment_id):
    """Get specific payment details"""
    try:
        user = request.user
        payment = get_object_or_404(MockPayment, id=payment_id, user=user)
        serializer = MockPaymentSerializer(payment)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_schedule_status(request, schedule_id):
    """
    Update the status of a schedule
    Only admins can update schedule status
    """
    if request.user.user_type != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        schedule = get_object_or_404(Schedule, id=schedule_id)
        new_status = request.data.get('status')
        
        # Validate status
        valid_statuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
        if new_status not in valid_statuses:
            return Response({
                'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update status
        old_status = schedule.status
        schedule.status = new_status
        schedule.save()
        
        # Log the change
        print(f"✅ Schedule {schedule_id} status updated: {old_status} → {new_status} by {request.user.name}")
        
        return Response({
            'message': 'Schedule status updated successfully',
            'schedule_id': schedule_id,
            'old_status': old_status,
            'new_status': new_status
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response({
            'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )