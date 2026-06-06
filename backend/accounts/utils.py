import random
import requests
import json
from django.conf import settings

def generate_otp():
    """Generate a 6-digit OTP"""
    return str(random.randint(100000, 999999))


def send_sms_test_mode(phone_number, message, otp=None):
    """
    Test mode: Display OTP in console instead of sending SMS
    Perfect for development and testing
    """
    # Clean phone number
    phone_number = str(phone_number).strip()
    if phone_number.startswith('+91'):
        phone_number = phone_number[3:]
    elif phone_number.startswith('91') and len(phone_number) == 12:
        phone_number = phone_number[2:]
    phone_number = phone_number[-10:]  # Get last 10 digits
    
    print(f"\n{'='*70}")
    print(f"📱 SMS TEST MODE - MESSAGE DETAILS")
    print(f"{'='*70}")
    print(f"📞 To Phone Number: {phone_number}")
    print(f"💬 Message: {message}")
    if otp:
        print(f"🔐 OTP CODE: {otp}")
        print(f"{'='*70}")
        print(f"⚠️  COPY THIS OTP TO VERIFY: {otp}")
    print(f"{'='*70}\n")
    
    # Always return success in test mode
    return True, "SMS sent successfully (Test Mode - Check console for OTP)"


def send_sms_fast2sms(phone_number, message):
    """
    Production mode: Actually send SMS via Fast2SMS
    """
    # Clean phone number
    phone_number = str(phone_number).strip()
    if phone_number.startswith('+91'):
        phone_number = phone_number[3:]
    elif phone_number.startswith('91') and len(phone_number) == 12:
        phone_number = phone_number[2:]
    elif phone_number.startswith('0'):
        phone_number = phone_number[1:]
    
    # Validate
    if len(phone_number) != 10 or not phone_number.isdigit():
        return False, "Invalid phone number format"
    
    # Check if API key is configured
    api_key = getattr(settings, 'FAST2SMS_API_KEY', None)
    if not api_key or api_key == 'your-fast2sms-api-key-here' or api_key == 'your-actual-fast2sms-api-key-here':
        print("\n" + "="*70)
        print("⚠️  WARNING: Fast2SMS API Key Not Configured!")
        print("="*70)
        print("To send real SMS, follow these steps:")
        print("1. Go to https://www.fast2sms.com/")
        print("2. Register/Login to your account")
        print("3. Go to Dashboard → Dev API")
        print("4. Copy your API Key")
        print("5. Add to settings.py:")
        print("   FAST2SMS_API_KEY = 'your-copied-api-key'")
        print("\nFor now, falling back to TEST MODE...")
        print("="*70 + "\n")
        
        # Extract OTP if present
        import re
        otp_match = re.search(r'\b\d{6}\b', message)
        otp = otp_match.group(0) if otp_match else None
        return send_sms_test_mode(phone_number, message, otp)
    
    # Try multiple routes until one works
    routes_to_try = [
        ("q", "Quick Transactional"),
        ("v3", "Promotional"), 
        ("otp", "OTP Route"),
        ("dlt", "DLT Route")
    ]
    
    for route, route_name in routes_to_try:
        try:
            url = "https://www.fast2sms.com/dev/bulkV2"
            
            payload = {
                "route": route,
                "sender_id": "FSTSMS",
                "message": message,
                "language": "english",
                "flash": 0,
                "numbers": phone_number
            }
            
            headers = {
                "authorization": api_key,
                "Content-Type": "application/json"
            }
            
            print(f"\n{'='*70}")
            print(f"🚀 ATTEMPT: {route_name} (route='{route}')")
            print(f"{'='*70}")
            print(f"📞 Phone: {phone_number}")
            print(f"💬 Message: {message[:50]}...")
            print(f"⏳ Sending request...")
            
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            
            print(f"\n📥 Status: {response.status_code}")
            print(f"📦 Response: {response.text[:500]}")
            
            # Check if response is empty
            if not response.text or response.text.strip() == '':
                print(f"❌ Empty response from Fast2SMS")
                print(f"💡 Trying next route...")
                continue
            
            # Try to parse JSON
            try:
                result = response.json()
                print(f"📦 Parsed: {json.dumps(result, indent=2)}")
                
                # Check for success
                if result.get('return') is True or result.get('return') == 'true' or str(result.get('return')).lower() == 'true':
                    print(f"\n✅ SUCCESS! SMS sent via {route_name}")
                    print(f"📝 Note: Route '{route}' works for your account")
                    print(f"{'='*70}\n")
                    return True, "SMS sent successfully"
                else:
                    error = result.get('message', 'Unknown error')
                    print(f"❌ Error: {error}")
                    
                    # If this is a permission/route error, try next route
                    if 'route' in str(error).lower() or 'not allowed' in str(error).lower():
                        print(f"💡 Route '{route}' not allowed, trying next...")
                        continue
                    
                    # If it's an API key error, no point trying other routes
                    if 'invalid' in str(error).lower() and 'key' in str(error).lower():
                        print(f"\n💡 SOLUTION: API Key Issue")
                        print(f"   1. Go to https://www.fast2sms.com/dashboard")
                        print(f"   2. Find 'Dev API' section")
                        print(f"   3. Copy your API key EXACTLY as shown")
                        print(f"   4. Update settings.py: FAST2SMS_API_KEY = 'your-key'")
                        print(f"{'='*70}\n")
                        return False, "Invalid API key"
                    
                    # For other errors, try next route
                    print(f"💡 Trying next route...")
                    continue
                    
            except json.JSONDecodeError:
                print(f"❌ Invalid JSON response")
                print(f"💡 Raw: {response.text[:200]}")
                continue
                
        except requests.exceptions.Timeout:
            print(f"❌ Timeout on route '{route}'")
            continue
        except requests.exceptions.ConnectionError:
            print(f"❌ Connection error")
            return False, "No internet connection"
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            continue
    
    # If all routes failed
    print(f"\n{'='*70}")
    print(f"❌ ALL ROUTES FAILED")
    print(f"{'='*70}")
    print(f"\n🔧 TROUBLESHOOTING STEPS:")
    print(f"1. Verify API Key:")
    print(f"   - Go to: https://www.fast2sms.com/dashboard")
    print(f"   - Section: Dev API")
    print(f"   - Copy the EXACT key shown")
    print(f"\n2. Check Account Status:")
    print(f"   - Balance: ₹75 (you have credits ✓)")
    print(f"   - Verify account is activated")
    print(f"   - Check if API access is enabled")
    print(f"\n3. API Key Permissions:")
    print(f"   - Enable 'Send SMS' permission")
    print(f"   - Enable routes: OTP, Transactional, Promotional")
    print(f"\n4. Contact Support:")
    print(f"   - Email: support@fast2sms.com")
    print(f"   - Tell them you're getting empty/invalid responses")
    print(f"{'='*70}\n")
    
    return False, "Could not send SMS. Check API key and account settings."


def send_sms(phone_number, message):
    """
    Main SMS function
    Uses SMS_TEST_MODE setting to determine mode
    """
    # Check SMS_TEST_MODE setting (default to True for safety)
    sms_test_mode = getattr(settings, 'SMS_TEST_MODE', True)
    
    print(f"\n{'🔧 SMS MODE: ' + ('TEST (Console)' if sms_test_mode else 'PRODUCTION (Real SMS)')}")
    
    if sms_test_mode:
        return send_sms_test_mode(phone_number, message)
    else:
        return send_sms_fast2sms(phone_number, message)


def send_otp_sms(phone_number, otp):
    """
    Send OTP via SMS
    Uses SMS_TEST_MODE setting to determine mode
    """
    message = f"Your TMS OTP is {otp}. Valid for 10 minutes. Do not share."
    
    # Check SMS_TEST_MODE setting (default to True for safety)
    sms_test_mode = getattr(settings, 'SMS_TEST_MODE', True)
    
    print(f"\n{'🔧 OTP MODE: ' + ('TEST (Console)' if sms_test_mode else 'PRODUCTION (Real SMS)')}")
    
    if sms_test_mode:
        return send_sms_test_mode(phone_number, message, otp)
    else:
        return send_sms_fast2sms(phone_number, message)


def send_booking_confirmation_sms(phone_number, booking_id, schedule_info):
    """Send booking confirmation SMS"""
    message = f"Booking confirmed! ID: {booking_id}. {schedule_info}. Thank you for using TMS."
    return send_sms(phone_number, message)


def send_leave_status_sms(phone_number, leave_type, status, dates):
    """Send leave status update SMS"""
    message = f"Your {leave_type} leave for {dates} has been {status}."
    return send_sms(phone_number, message)