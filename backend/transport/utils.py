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
    try:
        seat_index = seat_letters.index(seat_letter)
    except ValueError:
        return []
    
    # Parse layout (e.g., "2-3" means 2 left, aisle, 3 right)
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


def create_seat_restrictions(booking, schedule):
    """
    Create seat restrictions based on a new booking
    
    LOGIC:
    - If booking has 2+ seats → Auto-set as group (no restrictions within group)
    - Groups: NO restrictions for seats WITHIN the same booking
    - Groups: YES restrictions for seats OUTSIDE the booking (if has females)
    - Individual (1 seat): Creates restrictions normally for adjacent seats
    """
    from .models import SeatRestriction
    import json
    
    # Get passenger details
    try:
        passenger_details = json.loads(booking.passenger_details)
    except:
        return
    
    # Get all seats in THIS booking
    booking_seats = [detail.get('seat_number') for detail in passenger_details]
    
    print(f"🔧 Creating restrictions for booking: {booking.booking_id}")
    print(f"🔧 Seats in booking: {booking_seats}")
    
    # Auto-detect group: 2+ seats = group
    is_multi_seat = len(booking_seats) >= 2
    
    # Update booking to reflect group status
    if is_multi_seat and not booking.is_group_booking:
        booking.is_group_booking = True
        booking.booking_type = 'GROUP'
        booking.save()
        print(f"✅ Auto-set as GROUP booking (2+ seats)")
    
    # For each seat with FEMALE passenger
    for detail in passenger_details:
        seat_number = detail.get('seat_number')
        gender = detail.get('passenger_gender')
        
        print(f"🔍 Processing seat {seat_number} with gender {gender}")
        
        # Only create restrictions if passenger is FEMALE
        if gender == 'FEMALE':
            # Mark booking as triggering restriction
            booking.triggers_female_restriction = True
            booking.save()
            
            # Get adjacent seats
            adjacent_seats = get_adjacent_seats(seat_number, schedule.vehicle)
            print(f"📍 Adjacent seats to {seat_number}: {adjacent_seats}")
            
            # Create restriction for each adjacent seat
            for adj_seat in adjacent_seats:
                # CRITICAL: Don't restrict seats within the same booking
                if adj_seat in booking_seats:
                    print(f"⏭️ Skipping {adj_seat} - part of same booking (family can sit together)")
                    continue
                
                # FIXED: Use update_or_create to handle existing restrictions
                print(f"🚩 Creating/Updating FEMALE-ONLY restriction for {adj_seat}")
                restriction, created = SeatRestriction.objects.update_or_create(
                    schedule=schedule,
                    seat_number=adj_seat,
                    restriction_type='ADJACENT_TO_FEMALE',
                    defaults={
                        'caused_by_booking': booking,
                        'is_female_only': True,
                        'is_active': True
                    }
                )
                if created:
                    print(f"   ✅ Created new restriction for {adj_seat}")
                else:
                    print(f"   ♻️ Reactivated existing restriction for {adj_seat}")
        else:
            print(f"⏭️ Skipping {seat_number} - passenger is {gender}, not FEMALE")


def remove_seat_restrictions(booking):
    """
    Remove seat restrictions when a booking is cancelled
    Deactivates all restrictions caused by this booking
    """
    from .models import SeatRestriction
    
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
    from .models import SeatRestriction
    
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
                'caused_by': r.caused_by_booking.booking_id if r.caused_by_booking else None
            }
            for r in restrictions
        ]
    }


def get_women_reserved_seats(vehicle):
    """
    Get list of women-reserved seats for a vehicle
    Handles both JSON array and comma-separated string formats
    """
    if not vehicle.women_seats:
        return []
    
    import json
    
    # Try JSON format first
    try:
        seats = json.loads(vehicle.women_seats)
        if isinstance(seats, list):
            return [str(seat).strip().upper() for seat in seats]
    except (json.JSONDecodeError, ValueError):
        pass
    
    # Fallback to comma-separated format
    seats = [seat.strip().upper() for seat in str(vehicle.women_seats).split(',') if seat.strip()]
    return seats


def check_seat_availability_with_flags(seat_number, passenger_gender, schedule, 
                                        is_group_booking=False, current_booking_seats=None):
    """
    Check if a seat can be booked considering all restrictions
    
    RULES:
    1. Women-reserved seats → ONLY females can book (HARD BLOCK for males/other)
    2. Adjacent to women-reserved → ONLY females can book (HARD BLOCK for males/other)
    3. Seat flagged as female-only → ONLY females (HARD BLOCK for males/other)
    4. Male/Other booking adjacent to FEMALE → HARD BLOCK (not allowed)
    5. Female booking adjacent to MALE/OTHER → CONFIRM (soft warning)
    
    SPECIAL: current_booking_seats = seats in SAME booking (no restrictions within)
    
    Returns: (can_book: bool, reason: str, requires_confirmation: bool, confirmation_type: str)
    """
    from .models import Booking
    import json
    
    current_booking_seats = current_booking_seats or []
    
    # Get women-reserved seats from vehicle
    women_seats = get_women_reserved_seats(schedule.vehicle)
    
    # Debug logging
    print(f"\n{'='*80}")
    print(f"🔍 CHECKING SEAT AVAILABILITY")
    print(f"{'='*80}")
    print(f"📍 Seat: {seat_number}")
    print(f"👤 Passenger Gender: {passenger_gender}")
    print(f"👨‍👩‍👧‍👦 Current Booking Seats: {current_booking_seats}")
    print(f"{'='*80}\n")
    
    # Normalize seat number for comparison
    seat_number_normalized = str(seat_number).strip().upper()
    
    # ============================================================
    # RULE 1: Women-reserved seats - ONLY FEMALE allowed
    # ============================================================
    if seat_number_normalized in women_seats:
        print(f"⚠️ RULE 1: Seat {seat_number_normalized} is WOMEN-RESERVED")
        if passenger_gender == 'FEMALE':
            print(f"✅ ALLOWED: Female booking women-reserved seat")
            return True, "OK", False, None
        else:
            print(f"❌ BLOCKED: {passenger_gender} cannot book women-reserved seat")
            return False, f"Seat {seat_number} is a women-reserved seat. Only female passengers can book this seat.", False, None
    
    # ============================================================
    # RULE 2: Adjacent to women-reserved seats - HARD BLOCK for males/other
    # ============================================================
    adjacent_seats = get_adjacent_seats(seat_number, schedule.vehicle)
    adjacent_normalized = [str(s).strip().upper() for s in adjacent_seats]
    
    print(f"📍 Adjacent seats to {seat_number}: {adjacent_seats}")
    
    for adj in adjacent_normalized:
        if adj in women_seats:
            print(f"⚠️ RULE 2: Seat {seat_number_normalized} is ADJACENT to women-reserved seat {adj}")
            if passenger_gender == 'FEMALE':
                print(f"✅ ALLOWED: Female booking adjacent to women-reserved")
                return True, "OK", False, None
            else:
                print(f"❌ BLOCKED: {passenger_gender} cannot book adjacent to women-reserved")
                return False, f"Seat {seat_number} is adjacent to women-reserved seat {adj}. Only female passengers can book adjacent seats.", False, None
    
    # ============================================================
    # RULE 3: Check active seat restrictions (FLAGS from previous bookings)
    # ============================================================
    restrictions = get_seat_restrictions(seat_number, schedule)
    
    print(f"🚩 Restrictions for {seat_number}: {restrictions}")
    
    if restrictions['is_restricted'] and restrictions['is_female_only']:
        print(f"⚠️ RULE 3: Seat {seat_number} has FEMALE-ONLY restriction")
        # Female booking next to restricted seat - OK
        if passenger_gender == 'FEMALE':
            print(f"✅ ALLOWED: Female can book flagged seat")
            return True, "OK", False, None
        # Male/Other booking next to restricted seat - BLOCK
        elif passenger_gender in ['MALE', 'OTHER']:
            print(f"❌ BLOCKED: {passenger_gender} cannot book flagged seat (female-only)")
            return False, f"Seat {seat_number} is adjacent to a female passenger. Only female passengers can book adjacent seats.", False, None
    
    # ============================================================
    # RULE 4 & 5: Check adjacent seats for existing bookings
    # ============================================================
    for adj in adjacent_seats:
        # CRITICAL: Skip seats in the SAME booking (family can sit together)
        if adj in current_booking_seats:
            print(f"⏭️ Skipping {adj} - part of same booking (family sitting together)")
            continue
        
        print(f"🔍 Checking if {adj} is booked...")
        
        # Check if adjacent seat is already booked by DIFFERENT booking
        try:
            adj_booking = Booking.objects.filter(
                schedule=schedule,
                passenger_details__contains=adj,
                status='CONFIRMED'
            ).first()
            
            if adj_booking:
                print(f"✓ Seat {adj} is booked (Booking ID: {adj_booking.booking_id})")
                
                # Get passenger details for adjacent booking
                details = json.loads(adj_booking.passenger_details)
                adj_passenger = next((p for p in details if p.get('seat_number') == adj), None)
                
                if adj_passenger:
                    adj_gender = adj_passenger.get('passenger_gender')
                    print(f"👤 Adjacent passenger in {adj}: {adj_gender}")
                    
                    # ========================================================
                    # RULE 4: Male/Other booking next to FEMALE - HARD BLOCK
                    # ========================================================
                    if adj_gender == 'FEMALE':
                        print(f"⚠️ RULE 4: Adjacent seat {adj} has FEMALE passenger")
                        if passenger_gender in ['MALE', 'OTHER']:
                            print(f"❌ BLOCKED: {passenger_gender} cannot book next to FEMALE")
                            return False, f"Seat {adj} has a female passenger. Only female passengers can book adjacent seats.", False, None
                        elif passenger_gender == 'FEMALE':
                            print(f"✅ ALLOWED: Female next to female is OK")
                    
                    # ========================================================
                    # RULE 5: Female booking next to MALE/OTHER - REQUIRES CONFIRMATION
                    # ========================================================
                    elif adj_gender in ['MALE', 'OTHER']:
                        print(f"⚠️ RULE 5: Adjacent seat {adj} has {adj_gender} passenger")
                        if passenger_gender == 'FEMALE':
                            print(f"⚠️ CONFIRMATION REQUIRED: Female booking next to {adj_gender}")
                            return True, f"Seat {adj} has a {adj_gender.lower()} passenger", True, 'MALE_ADJACENT'
                else:
                    print(f"⚠️ Warning: Could not find passenger details for {adj}")
            else:
                print(f"✓ Seat {adj} is NOT booked")
                        
        except Exception as e:
            print(f"❌ Error checking adjacent booking for {adj}: {e}")
            pass
    
    # ============================================================
    # No restrictions apply - seat is available
    # ============================================================
    print(f"✅ NO RESTRICTIONS: Seat {seat_number} is available for {passenger_gender}")
    print(f"{'='*80}\n")
    return True, "No restrictions", False, None