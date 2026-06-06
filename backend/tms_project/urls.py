from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/transport/', include('transport.urls')),
    path('api/drowsiness/', include('drowsiness.urls')),
    path('api/heart-monitor/', include('heart_rate.urls')),
    path('api/alcohol/', include('alcohol_detection.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)