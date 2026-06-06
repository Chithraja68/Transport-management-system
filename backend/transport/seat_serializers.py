from rest_framework import serializers
from .models import Seat, SeatBooking, SeatLayout, Schedule, Route

class SeatSerializer(serializers.ModelSerializer):
    is_booked = serializers.SerializerMethodField()
    booked_by_current_user = serializers.SerializerMethodField()
    
    class Meta:
        model = Seat
        fields = [
            'id', 'seat_number', 'row', 'column', 'seat_type', 
            'status', 'price', 'is_window', 'is_aisle', 
            'is_booked', 'booked_by_current_user'
        ]
    
    def get_is_booked(self, obj):
        return obj.status == 'BOOKED'
    
    def get_booked_by_current_user(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.bookings.filter(booking__passenger=request.user).exists()

class SeatBookingSerializer(serializers.ModelSerializer):
    seat_number = serializers.CharField(source='seat.seat_number', read_only=True)
    seat_type = serializers.CharField(source='seat.seat_type', read_only=True)
    seat_price = serializers.DecimalField(
        source='seat.price', 
        max_digits=8, 
        decimal_places=2, 
        read_only=True
    )
    
    class Meta:
        model = SeatBooking
        fields = [
            'id', 'seat', 'seat_number', 'seat_type', 'seat_price',
            'passenger_name', 'passenger_age', 'passenger_gender'
        ]

class PassengerDetailSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    age = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=120)
    gender = serializers.ChoiceField(choices=['MALE', 'FEMALE', 'OTHER'])

class BookingWithSeatsSerializer(serializers.Serializer):
    schedule = serializers.IntegerField()
    seat_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        max_length=10
    )
    passengers = serializers.ListField(
        child=PassengerDetailSerializer()
    )
    boarding_point = serializers.CharField(max_length=255)
    destination_point = serializers.CharField(max_length=255)
    
    def validate(self, data):
        if len(data['seat_ids']) != len(data['passengers']):
            raise serializers.ValidationError(
                "Number of passengers must match number of seats"
            )
        
        try:
            schedule = Schedule.objects.get(id=data['schedule'])
            data['schedule_obj'] = schedule
        except Schedule.DoesNotExist:
            raise serializers.ValidationError("Schedule not found")
        
        return data