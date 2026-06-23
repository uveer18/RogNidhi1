from django.urls import path
from .views import (
    PatientRegisterView, DoctorRegisterView, LoginView, DocumentUploadView, 
    PatientTimelineView, PatientChartDataView, DocumentDeleteView, ChatSessionListView, ChatSessionMessageView
)
from .views import (
    RequestAccessView, PendingRequestsView, ApproveAccessView, RevokeAccessView, MyDoctorsView, MyPatientsView,
    PatientDocumentsForDoctorView, ScrapeSchemesView, NotificationListView, NotificationMarkReadView
)

urlpatterns = [
    path('auth/register/patient/', PatientRegisterView.as_view(), name='patient-register'),
    path('auth/register/doctor/',  DoctorRegisterView.as_view(), name='doctor-register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('documents/upload/', DocumentUploadView.as_view(), name='document-upload'),
    path('records/timeline/', PatientTimelineView.as_view(), name='patient-timeline'),
    path('records/chart-data/', PatientChartDataView.as_view(), name='patient-chart-data'),
    path('documents/delete/<int:pk>/', DocumentDeleteView.as_view(), name='document-delete'),
    path('chat/sessions/', ChatSessionListView.as_view(), name='chat-sessions'),
    path('chat/sessions/<int:pk>/', ChatSessionMessageView.as_view(), name='chat-session-messages'),

    # ── Access Control ──
    path('access/request/', RequestAccessView.as_view(), name='access-request'),
    path('access/pending/', PendingRequestsView.as_view(), name='access-pending'),
    path('access/approve/<int:permission_id>/', ApproveAccessView.as_view(), name='access-approve'),
    path('access/revoke/<int:permission_id>/',  RevokeAccessView.as_view(), name='access-revoke'),
    path('access/my-doctors/', MyDoctorsView.as_view(), name='my-doctors'),
    path('access/my-patients/', MyPatientsView.as_view(), name='my-patients'),
    path('access/patient-documents/<int:patient_id>/', PatientDocumentsForDoctorView.as_view(), name='patient-documents-for-doctor'),
    path('schemes/scrape/', ScrapeSchemesView.as_view(), name='scrape-schemes'),

    # ── Notifications ──
    path('notifications/', NotificationListView.as_view(), name='notifications-list'),
    path('notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notifications-mark-read'),
]