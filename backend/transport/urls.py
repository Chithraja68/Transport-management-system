from django.urls import path
from . import views

urlpatterns = [
    # Dashboards
    path('dashboard/admin/', views.admin_dashboard),
    path('dashboard/passenger/<int:passenger_id>/', views.passenger_overview),
    
    # Core Data
    path('districts/', views.districts),
    path('schedules/', views.schedules),
    path('schedules/<int:schedule_id>/update-status/', views.update_schedule_status, name='update-schedule-status'),

    # Staff/Admin Management
    path('employees/', views.district_wise_employees),
    path('vehicles/', views.district_wise_vehicles),
    path('routes/', views.district_wise_routes),
    path('payrolls/', views.payrolls),
    
    # Booking Management
    path('bookings/', views.bookings),
    path('bookings/<int:booking_id>/cancel/', views.cancel_booking),
    
    # Leave Management
    path('leave-requests/', views.leave_requests),
    path('leave-requests/<int:leave_id>/approve/', views.approve_leave),
    
    # Complaint Management
    path('complaints/', views.complaints),
    path('complaints/<int:complaint_id>/resolve/', views.resolve_complaint),

    # 🆕 NEW: Phone verification for complaints
    path('verify-passenger-phone/', views.verify_passenger_phone),
    path('verify-staff-phone/', views.verify_staff_phone, name='verify-staff-phone'),

    # Emergency Notification URLs
    path('emergency-notifications/', views.get_emergency_notifications, name='emergency-notifications'),
    path('emergency-notifications/send/', views.send_emergency_notification, name='send-emergency-notification'),
    path('emergency-notifications/<int:notification_id>/', views.get_notification_details, name='notification-details'),

    # 🚩 NEW: Seat matrix with flags
    path('seat-matrix/<int:schedule_id>/', views.get_seat_matrix_with_flags),
    path('check-seat-availability/', views.check_seat_availability_api),

    path('gps/update/', views.update_bus_location, name='update_bus_location'),
    path('gps/location/<int:schedule_id>/', views.get_bus_location, name='get_bus_location'),
    path('gps/locations/', views.get_all_bus_locations, name='get_all_bus_locations'),
    path('gps/history/<int:schedule_id>/', views.get_location_history, name='get_location_history'),
    path('gps/delete/<int:schedule_id>/', views.delete_bus_location, name='delete_bus_location'),
    
    
    #Mock Payment URLs
    path('mock-payment/create-order/', views.create_mock_payment_order, name='create-mock-payment-order'),
    path('mock-payment/process/', views.process_mock_payment, name='process-mock-payment'),
    path('mock-payment/verify/', views.verify_mock_payment, name='verify-mock-payment'),
    path('mock-payment/confirm-booking/', views.confirm_booking_after_mock_payment, name='confirm-booking-mock-payment'),
    path('mock-payment/my-payments/', views.get_user_mock_payments, name='my-mock-payments'),
    path('mock-payment/<int:payment_id>/details/', views.get_mock_payment_details, name='mock-payment-details'),
    
    # Mock Refund
    path('booking/<int:booking_id>/cancel-mock-refund/', views.cancel_booking_with_mock_refund, name='cancel-booking-mock-refund'),
]