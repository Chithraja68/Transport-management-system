from django.urls import path
from . import views

urlpatterns = [
    path('register/passenger/step1/', views.passenger_registration_step1),
    path('register/staff/step1/', views.staff_registration_step1),
    path('verify-otp/', views.verify_otp),
    path('register/passenger/complete/', views.create_passenger_account),
    path('register/staff/complete/', views.create_staff_account),
    path('login/', views.login_view),
    path('logout/', views.logout_view),
    path('current-user/', views.current_user),
    path('csrf/', views.get_csrf_token, name='csrf'),
    
]

