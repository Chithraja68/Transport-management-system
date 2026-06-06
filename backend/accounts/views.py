from django.middleware.csrf import get_token
from django.http import JsonResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.conf import settings
from .models import User, OTPVerification
from .serializers import (
    UserSerializer, PassengerRegistrationSerializer, 
    StaffRegistrationSerializer, OTPVerificationSerializer,
    CreateUserSerializer, LoginSerializer
)
from rest_framework.authtoken.models import Token
from .utils import generate_otp, send_otp_sms

@api_view(['POST'])
@permission_classes([AllowAny])
def passenger_registration_step1(request):
    """Step 1: Send OTP to passenger's phone"""
    serializer = PassengerRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        phone_number = serializer.validated_data['phone_number']
        
        # Check if phone number already exists
        if User.objects.filter(phone_number=phone_number).exists():
            return Response({'error': 'Phone number already registered'}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Generate OTP
        otp = generate_otp()
        
        # Delete old OTPs for this number
        OTPVerification.objects.filter(phone_number=phone_number).delete()
        
        # Create new OTP record
        OTPVerification.objects.create(phone_number=phone_number, otp=otp)
        
        # Send OTP via SMS
        print(f"\\n{'='*50}")
        print(f"Attempting to send OTP to {phone_number}")
        print(f"{'='*50}")
        
        success, message = send_otp_sms(phone_number, otp)
        
        print(f"SMS Result: Success={success}, Message={message}")
        print(f"{'='*50}\\n")
        
        # Check if SMS was sent successfully
        if not success:
            # Delete the OTP record if SMS failed
            OTPVerification.objects.filter(phone_number=phone_number).delete()
            return Response({
                'error': f'Failed to send OTP: {message}',
                'details': 'Please check your phone number and try again.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Store registration data in session
        request.session['pending_passenger'] = {
            'name': serializer.validated_data['name'],
            'phone_number': phone_number,
            'email': serializer.validated_data.get('email', '')
        }
        
        return Response({
            'message': 'OTP sent successfully',
            'phone_number': phone_number,
            'debug_otp': otp if settings.DEBUG else None  # Only in debug mode
        })
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def staff_registration_step1(request):
    """Step 1: Send OTP to staff's phone"""
    serializer = StaffRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        phone_number = serializer.validated_data['phone_number']
        employee_id = serializer.validated_data['employee_id']
        
        # Check if already registered
        if User.objects.filter(phone_number=phone_number).exists():
            return Response({'error': 'Phone number already registered'}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(employee_id=employee_id).exists():
            return Response({'error': 'Employee ID already registered'}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Generate OTP
        otp = generate_otp()
        
        # Delete old OTPs for this number
        OTPVerification.objects.filter(phone_number=phone_number).delete()
        
        # Create new OTP record
        OTPVerification.objects.create(phone_number=phone_number, otp=otp)
        
        # Send OTP via SMS
        print(f"\\n{'='*50}")
        print(f"Attempting to send OTP to {phone_number}")
        print(f"{'='*50}")
        
        success, message = send_otp_sms(phone_number, otp)
        
        print(f"SMS Result: Success={success}, Message={message}")
        print(f"{'='*50}\\n")
        
        # Check if SMS was sent successfully
        if not success:
            # Delete the OTP record if SMS failed
            OTPVerification.objects.filter(phone_number=phone_number).delete()
            return Response({
                'error': f'Failed to send OTP: {message}',
                'details': 'Please check your phone number and try again.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        # Store registration data in session
        request.session['pending_staff'] = {
            'name': serializer.validated_data['name'],
            'phone_number': phone_number,
            'employee_status': serializer.validated_data['employee_status'],
            'employee_id': employee_id,
            'working_district': serializer.validated_data['working_district']
        }
        
        return Response({
            'message': 'OTP sent successfully',
            'phone_number': phone_number,
            'debug_otp': otp if settings.DEBUG else None
        })
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    """Step 2: Verify OTP"""
    serializer = OTPVerificationSerializer(data=request.data)
    if serializer.is_valid():
        phone_number = serializer.validated_data['phone_number']
        otp = serializer.validated_data['otp']
        
        try:
            otp_record = OTPVerification.objects.filter(
                phone_number=phone_number,
                otp=otp,
                is_verified=False
            ).latest('created_at')
            
            if not otp_record.is_valid():
                return Response({'error': 'OTP expired. Please request a new one.'}, 
                                status=status.HTTP_400_BAD_REQUEST)
            
            otp_record.is_verified = True
            otp_record.save()
            
            return Response({'message': 'OTP verified successfully', 'verified': True})
        
        except OTPVerification.DoesNotExist:
            return Response({'error': 'Invalid OTP'}, 
                            status=status.HTTP_400_BAD_REQUEST)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def create_passenger_account(request):
    """Step 3: Create passenger account after OTP verification"""
    serializer = CreateUserSerializer(data=request.data)
    if serializer.is_valid():
        phone_number = serializer.validated_data['phone_number']
        
        # Verify OTP was verified
        if not OTPVerification.objects.filter(
            phone_number=phone_number, 
            is_verified=True
        ).exists():
            return Response({'error': 'Please verify OTP first'}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Get pending passenger data
        pending_data = request.session.get('pending_passenger')
        if not pending_data or pending_data['phone_number'] != phone_number:
            return Response({'error': 'Registration session expired. Please start again.'}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Check if username already exists
        if User.objects.filter(username=serializer.validated_data['username']).exists():
            return Response({'error': 'Username already taken. Please choose another.'}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Create user
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=serializer.validated_data['username'],
                    password=serializer.validated_data['password'],
                    phone_number=phone_number,
                    name=pending_data['name'],
                    email=pending_data.get('email', ''),
                    user_type='PASSENGER'
                )
                
                # Clear session data
                if 'pending_passenger' in request.session:
                    del request.session['pending_passenger']
                
                # Clear OTP records
                OTPVerification.objects.filter(phone_number=phone_number).delete()
                
                return Response({
                    'message': 'Registration successful! Please login.',
                    'user': UserSerializer(user).data
                }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response({'error': str(e)}, 
                            status=status.HTTP_400_BAD_REQUEST)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def create_staff_account(request):
    """Step 3: Create staff account after OTP verification"""
    serializer = CreateUserSerializer(data=request.data)
    if serializer.is_valid():
        phone_number = serializer.validated_data['phone_number']
        
        # Verify OTP was verified
        if not OTPVerification.objects.filter(
            phone_number=phone_number, 
            is_verified=True
        ).exists():
            return Response({'error': 'Please verify OTP first'}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Get pending staff data
        pending_data = request.session.get('pending_staff')
        if not pending_data or pending_data['phone_number'] != phone_number:
            return Response({'error': 'Registration session expired. Please start again.'}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Check if username already exists
        if User.objects.filter(username=serializer.validated_data['username']).exists():
            return Response({'error': 'Username already taken. Please choose another.'}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Create user
        try:
            with transaction.atomic():
                user_type = pending_data['employee_status'].upper()
                if user_type not in ['DRIVER', 'CONDUCTOR', 'SUPERVISOR', 'ADMIN']:
                    user_type = 'DRIVER'
                
                user = User.objects.create_user(
                    username=serializer.validated_data['username'],
                    password=serializer.validated_data['password'],
                    phone_number=phone_number,
                    name=pending_data['name'],
                    user_type=user_type,
                    employee_id=pending_data['employee_id'],
                    employee_status=pending_data['employee_status'],
                    working_district=pending_data['working_district']
                )
                
                # Clear session data
                if 'pending_staff' in request.session:
                    del request.session['pending_staff']
                
                # Clear OTP records
                OTPVerification.objects.filter(phone_number=phone_number).delete()
                
                return Response({
                    'message': 'Registration successful! Please login.',
                    'user': UserSerializer(user).data
                }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response({'error': str(e)}, 
                            status=status.HTTP_400_BAD_REQUEST)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """User login"""
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            if not user.is_active:
                return Response({'error': 'Account is disabled'}, 
                                status=status.HTTP_401_UNAUTHORIZED)
            
            login(request, user)
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'message': 'Login successful',
                'token': token.key,   
                'user': UserSerializer(user).data
            })
        else:
            return Response({'error': 'Invalid username or password'}, 
                            status=status.HTTP_401_UNAUTHORIZED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """User logout"""
    try:
        request.user.auth_token.delete()
        logout(request)
        return Response({'message': 'Logout successful'})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Get current user info"""
    return Response(UserSerializer(request.user).data)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    """Get CSRF token"""
    return JsonResponse({'csrfToken': get_token(request)})