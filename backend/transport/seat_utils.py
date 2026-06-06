from .models import Seat, Schedule, SeatLayout, SeatBooking
from django.db import transaction

def initialize_seats_for_schedule(schedule):
    """Initialize seats for a schedule based on vehicle's seat layout"""
    vehicle = schedule.vehicle
    
    if schedule.seats.exists():
        return
    
    if not vehicle.seat_layout:
        total_seats = vehicle.capacity
        rows = total_seats // 4
        create_default_layout(schedule, total_seats, rows)
    else:
        create_layout_from_config(schedule, vehicle.seat_layout)

def create_default_layout(schedule, total_seats, rows):
    """Create default 2-2 seating layout (2 seats, aisle, 2 seats)"""
    seat_number_counter = 1
    base_price = float(schedule.fare)
    seats_to_create = []
    
    for row in range(1, rows + 1):
        for col in range(1, 5):
            if seat_number_counter > total_seats:
                break
            
            seat_type = 'REGULAR'
            price = base_price
            
            if row <= 2:
                seat_type = 'WOMEN'
            
            if row == rows and col <= 2:
                seat_type = 'WHEELCHAIR'
                price = base_price * 0.9
            
            is_window = col in [1, 4]
            is_aisle = col in [2, 3]
            
            if 3 <= row <= 5 and is_window and seat_type == 'REGULAR':
                seat_type = 'PREMIUM'
                price = base_price * 1.2
            
            seat_label = f"{row}{chr(64+col)}"
            
            seats_to_create.append(
                Seat(
                    schedule=schedule,
                    seat_number=seat_label,
                    row=row,
                    column=col,
                    seat_type=seat_type,
                    status='AVAILABLE',
                    price=price,
                    is_window=is_window,
                    is_aisle=is_aisle
                )
            )
            seat_number_counter += 1
    
    Seat.objects.bulk_create(seats_to_create)

def create_layout_from_config(schedule, seat_layout):
    """Create seats based on custom layout configuration"""
    config = seat_layout.layout_config
    base_price = float(schedule.fare)
    seats_to_create = []
    
    for seat_config in config.get('seats', []):
        price = seat_config.get('price', base_price)
        seat_type = seat_config.get('type', 'REGULAR')
        
        if seat_type == 'PREMIUM':
            price = base_price * 1.2
        elif seat_type == 'WHEELCHAIR':
            price = base_price * 0.9
        
        seats_to_create.append(
            Seat(
                schedule=schedule,
                seat_number=seat_config['number'],
                row=seat_config['row'],
                column=seat_config['column'],
                seat_type=seat_type,
                status='AVAILABLE',
                price=price,
                is_window=seat_config.get('is_window', False),
                is_aisle=seat_config.get('is_aisle', False)
            )
        )
    
    Seat.objects.bulk_create(seats_to_create)

@transaction.atomic
def book_seats(booking, seat_ids, passenger_details):
    """Book multiple seats for a booking"""
    seats = Seat.objects.select_for_update().filter(
        id__in=seat_ids, 
        status='AVAILABLE'
    )
    
    if seats.count() != len(seat_ids):
        unavailable = set(seat_ids) - set(seats.values_list('id', flat=True))
        raise ValueError(f"Some seats are not available: {unavailable}")
    
    seat_bookings = []
    
    for i, seat in enumerate(seats):
        passenger = passenger_details[i] if i < len(passenger_details) else passenger_details[0]
        
        if seat.seat_type == 'WOMEN' and passenger.get('gender') != 'FEMALE':
            raise ValueError(
                f"Seat {seat.seat_number} is reserved for women only. "
                f"Passenger {passenger.get('name')} cannot book this seat."
            )
        
        seat.status = 'BOOKED'
        seat.save()
        
        seat_booking = SeatBooking(
            booking=booking,
            seat=seat,
            passenger_name=passenger['name'],
            passenger_age=passenger.get('age'),
            passenger_gender=passenger['gender']
        )
        seat_bookings.append(seat_booking)
    
    SeatBooking.objects.bulk_create(seat_bookings)
    return seat_bookings

@transaction.atomic
def release_seats(booking):
    """Release seats when booking is cancelled"""
    seat_bookings = booking.seat_bookings.select_related('seat').all()
    seat_ids = [sb.seat.id for sb in seat_bookings]
    Seat.objects.filter(id__in=seat_ids).update(status='AVAILABLE')
    seat_bookings.delete()
    return len(seat_ids)

def get_seat_availability_summary(schedule):
    """Get summary of seat availability"""
    from django.db.models import Count
    
    summary = schedule.seats.values('seat_type', 'status').annotate(
        count=Count('id')
    ).order_by('seat_type', 'status')
    
    result = {
        'total': schedule.seats.count(),
        'available': schedule.seats.filter(status='AVAILABLE').count(),
        'booked': schedule.seats.filter(status='BOOKED').count(),
        'blocked': schedule.seats.filter(status='BLOCKED').count(),
        'by_type': {}
    }
    
    for item in summary:
        seat_type = item['seat_type']
        if seat_type not in result['by_type']:
            result['by_type'][seat_type] = {
                'AVAILABLE': 0,
                'BOOKED': 0,
                'BLOCKED': 0
            }
        result['by_type'][seat_type][item['status']] = item['count']
    
    return result