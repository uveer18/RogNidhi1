from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.urls import path, include

def health(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("health/", health),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')), # Includes your app's urls
]

# This is the "Magic Line" for local file serving
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)