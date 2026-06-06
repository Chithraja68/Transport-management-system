import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tms_project.settings')

django.setup()
from django.utils import timezone
from datetime import datetime, timedelta
from accounts.models import User
from transport.models import District, Vehicle, Route, Schedule, Payroll


# CHANGE this to your project name (folder that has settings.py)


# Add Districts
districts_data = [
    {'name': 'Chennai', 'code': 'CH'},
    {'name': 'Coimbatore', 'code': 'CB'},
    {'name': 'Madurai', 'code': 'MD'},
    {'name': 'Tiruchirappalli', 'code': 'TC'},
    {'name': 'Salem', 'code': 'SL'},
    {'name': 'Tirunelveli', 'code': 'TN'},
    {'name': 'Tiruppur', 'code': 'TP'},
    {'name': 'Vellore', 'code': 'VL'},
    {'name': 'Erode', 'code': 'ER'},
    {'name': 'Thanjavur', 'code': 'TJ'},
]

for d in districts_data:
    District.objects.get_or_create(**d)

# Create Admin
User.objects.create_user(
    username='admin',
    password='admin123',
    phone_number='9876543210',
    name='System Admin',
    user_type='ADMIN'
)

# Create Staff
driver1 = User.objects.create_user(
    username='driver001',
    password='driver123',
    phone_number='9876543211',
    name='Rajesh Kumar',
    user_type='DRIVER',
    employee_id='EMP001',
    employee_status='Driver',
    working_district='Chennai'
)

driver2 = User.objects.create_user(
    username='driver002',
    password='driver123',
    phone_number='9876543212',
    name='Suresh Babu',
    user_type='DRIVER',
    employee_id='EMP002',
    employee_status='Driver',
    working_district='Coimbatore'
)

conductor1 = User.objects.create_user(
    username='conductor001',
    password='conductor123',
    phone_number='9876543213',
    name='Ganesh M',
    user_type='CONDUCTOR',
    employee_id='EMP003',
    employee_status='Conductor',
    working_district='Chennai'
)

# Add Vehicles
chennai = District.objects.get(code='CH')
coimbatore = District.objects.get(code='CB')

vehicle1 = Vehicle.objects.create(
    vehicle_number='TN01AB1234',
    vehicle_type='Luxury Bus',
    capacity=50,
    district=chennai,
    status='ACTIVE',
    seat_layout='2-2',
    total_rows=15,
    last_row_seats=5,
    women_seats=['1A', '1B', '2A', '2B'],  # First 2 rows for women
    registration_date='2020-01-15',
    last_maintenance='2024-11-01'
)

vehicle2 = Vehicle.objects.create(
    vehicle_number='TN02CD1234',
    vehicle_type='AC Bus',
    capacity=40,
    district=coimbatore,
    status='ACTIVE',
    seat_layout='2-2',
    total_rows=12,
    last_row_seats=4,
    women_seats=['1A', '1B'],  # First row for women
    registration_date='2021-03-10',
    last_maintenance='2024-11-20'
)

# Add Routes
route1 = Route.objects.create(
    route_number='R001',
    route_name='Chennai-Tambaram Express',
    start_point='Chennai Central',
    end_point='Tambaram',
    distance_km=25.50,
    district=chennai,
    stops='Chennai Central,Guindy,St.Thomas Mount,Tambaram'
)

route2 = Route.objects.create(
    route_number='R003',
    route_name='Coimbatore-Ooty',
    start_point='Coimbatore',
    end_point='Ooty',
    distance_km=86.00,
    district=coimbatore,
    stops='Coimbatore,Mettupalayam,Coonoor,Ooty'
)

# Add Schedules
today = timezone.now().date()
for i in range(5):
    date = today + timedelta(days=i)
    
    Schedule.objects.create(
        route=route1,
        vehicle=vehicle1,
        driver=driver1,
        conductor=conductor1,
        departure_time='06:00:00',
        arrival_time='07:30:00',
        schedule_date=date,
        fare=50.00,
        available_seats=50,
        is_active=True
    )
    
    Schedule.objects.create(
        route=route2,
        vehicle=vehicle2,
        driver=driver2,
        departure_time='05:30:00',
        arrival_time='09:00:00',
        schedule_date=date,
        fare=200.00,
        available_seats=40,
        is_active=True
    )

# Add Payroll
Payroll.objects.create(
    staff=driver1,
    month=datetime(2024, 11, 1),
    basic_salary=25000.00,
    allowances=3000.00,
    deductions=2000.00,
    overtime_hours=10,
    overtime_pay=1500.00,
    net_salary=27500.00,
    payment_status=True
)

Payroll.objects.create(
    staff=driver2,
    month=datetime(2024, 11, 1),
    basic_salary=25000.00,
    allowances=3000.00,
    deductions=1800.00,
    overtime_hours=8,
    overtime_pay=1200.00,
    net_salary=27400.00,
    payment_status=False
)

print("Sample data added successfully!")
