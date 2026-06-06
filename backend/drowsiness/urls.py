from django.urls import path
from . import views

urlpatterns = [
    # ========================================================================
    # ALERTS
    # ========================================================================
    path('alerts/create/', views.create_drowsiness_alert, name='create_alert'),
    path('alerts/', views.get_drowsiness_alerts, name='get_alerts'),
    path('alerts/<int:alert_id>/', views.get_alert_detail, name='alert_detail'),
    path('alerts/<int:alert_id>/update/', views.update_alert_status, name='update_alert'),
    path('alerts/<int:alert_id>/delete/', views.delete_alert, name='delete_alert'),
    
    # ========================================================================
    # SESSIONS (UPDATED)
    # ========================================================================
    path('sessions/start/', views.start_monitoring_session, name='start_session'),
    path('sessions/<int:session_id>/end/', views.end_monitoring_session, name='end_session'),
    path('sessions/<int:session_id>/update-stats/', views.update_session_stats, name='update_session_stats'),  # NEW
    path('sessions/', views.get_drowsiness_sessions, name='get_sessions'),  # NEW
    
    # ========================================================================
    # STATISTICS & DASHBOARD
    # ========================================================================
    path('stats/', views.get_driver_stats, name='driver_stats'),
    path('dashboard/', views.get_dashboard_summary, name='dashboard_summary'),
    path('sessions/summary/', views.get_session_summary, name='session_summary'),  # NEW
]
