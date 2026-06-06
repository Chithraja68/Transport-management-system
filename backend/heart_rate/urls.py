from django.urls import path
from . import views

urlpatterns = [
    # Called by heart_monitor.py
    path('alert/',           views.receive_heart_rate_alert,      name='hr_alert_receive'),

    # Admin dashboard APIs
    path('alerts/',          views.get_heart_rate_alerts,          name='hr_alerts_list'),
    path('alerts/my/',       views.get_my_heart_rate_alerts,          name='hr_my_alerts'),
    path('alerts/<int:alert_id>/',        views.get_heart_rate_alert_detail, name='hr_alert_detail'),
    path('alerts/<int:alert_id>/status/', views.update_alert_status,         name='hr_alert_status'),
    path('summary/',         views.get_heart_rate_dashboard_summary, name='hr_summary'),
]