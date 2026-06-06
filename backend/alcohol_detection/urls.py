from django.urls import path
from . import views
 
urlpatterns = [
    # Called by alcohol_monitor.py (no auth needed)
    path('alert/',                          views.receive_alcohol_alert,         name='alcohol_alert_receive'),
 
    # Admin dashboard APIs
    path('alerts/',                         views.get_alcohol_alerts,             name='alcohol_alerts_list'),
    path('alerts/<int:alert_id>/',          views.get_alcohol_alert_detail,       name='alcohol_alert_detail'),
    path('alerts/<int:alert_id>/status/',   views.update_alert_status,            name='alcohol_alert_status'),
    path('summary/',                        views.get_alcohol_dashboard_summary,  name='alcohol_summary'),
    path('my-alerts/', views.get_my_alcohol_alerts, name='alcohol_my_alerts'),
]