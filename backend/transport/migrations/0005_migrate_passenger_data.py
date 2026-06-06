# backend/transport/migrations/000X_migrate_passenger_data.py
from django.db import migrations
import json


def migrate_existing_bookings(apps, schema_editor):
    Booking = apps.get_model('transport', 'Booking')
    
    for booking in Booking.objects.all():
        # Check if booking has old-style data
        if hasattr(booking, 'passenger_name') and booking.passenger_name:
            # Get seat numbers
            try:
                seat_numbers = json.loads(booking.seat_numbers) if isinstance(booking.seat_numbers, str) else booking.seat_numbers
            except:
                seat_numbers = ['Unknown']
            
            # Create passenger detail from old fields
            detail = {
                'seat_number': seat_numbers[0] if seat_numbers else 'Unknown',
                'passenger_name': booking.passenger_name or 'N/A',
                'passenger_gender': booking.passenger_gender or 'OTHER',
                'passenger_age': booking.passenger_age or 0,
                'passenger_phone': booking.passenger_phone or '',
                'passenger_alternate_phone': booking.passenger_alternate_phone or ''
            }
            
            # Set passenger details as JSON array
            booking.passenger_details = json.dumps([detail])
            booking.save(update_fields=['passenger_details'])
    
    print(f"Migrated {Booking.objects.count()} bookings")


def reverse_migration(apps, schema_editor):
    # Reverse is not needed for this migration
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0004_booking_passenger_details'),  # Replace with actual previous migration
    ]

    operations = [
        migrations.RunPython(migrate_existing_bookings, reverse_migration),
    ]