from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
 
from .models import Document
from .serializers import PatientRegisterSerializer, DoctorRegisterSerializer, LoginRequestSerializer
from .services import register_patient, register_doctor
from rest_framework import status, permissions
from .services import AuthService
from .serializers import DocumentUploadSerializer
from .services import DocumentService

from rest_framework import status
from django.utils import timezone
from datetime import timedelta

from .models import Role
from .serializers import (
    AccessRequestSerializer,
    AccessPermissionSerializer,
    MyPatientSerializer,
)
from .services import (
    request_access,
    approve_access,
    revoke_access,
    get_pending_requests,
    get_my_doctors,
    get_my_patients,
)

# ──────────────────────────────────────────────────────────────
# PATIENT REGISTER VIEW
# POST /api/auth/register/patient/
#
# Flow:
#   1. Deserialize + validate incoming JSON via serializer
#   2. Call service layer to create User + profiles atomically
#   3. Return success message
#
# permission_classes = [AllowAny] because this is a public
# endpoint — no token needed to register.
# ──────────────────────────────────────────────────────────────

class PatientRegisterView(APIView):
    permission_classes = [AllowAny]

    """
    POST /api/auth/register/patient/

    Request body:
    {
        "first_name": "Ramesh",
        "last_name": "Kumar",
        "email": "ramesh@gmail.com",
        "password": "secure123",
        "phone": "9876543210",         ← optional
        "dob": "1985-04-12",           ← optional
        "blood_group": "O+",           ← optional
        "allergies": "Penicillin",     ← optional
        "emergency_contact": "9000000" ← optional
    }
    """

    def post(self, request):
        serializer = PatientRegisterSerializer(data=request.data)

        if not serializer.is_valid():
            # Returns all validation errors at once
            # e.g. {"email": ["already exists"], "password": ["too common"]}
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            register_patient(serializer.validated_data)
        except Exception as e:
            return Response(
                {"error": "Registration failed. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {"message": "User created successfully"},
            status=status.HTTP_201_CREATED
        )


# ──────────────────────────────────────────────────────────────
# DOCTOR REGISTER VIEW
# POST /api/auth/register/doctor/
#
# Same flow as patient but uses DoctorRegisterSerializer
# and register_doctor service.
# ──────────────────────────────────────────────────────────────

class DoctorRegisterView(APIView):
    """
    POST /api/auth/register/doctor/

    Request body:
    {
        "first_name": "Anjali",
        "last_name": "Mehta",
        "email": "anjali@hospital.com",
        "password": "secure123",
        "phone": "9876543210",         ← optional
        "specialization": "Cardiology",← optional
        "license_number": "MH-12345",  ← required
        "hospital": "Apollo Delhi"     ← optional
    }
    """


    permission_classes = [AllowAny]

    def post(self, request):
        serializer = DoctorRegisterSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            register_doctor(serializer.validated_data)
        except Exception as e:
            return Response(
                {"error": "Registration failed. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {"message": "User created successfully"},
            status=status.HTTP_201_CREATED
        )
    
# --------------------------------------------------------------------------------
# LOGIN VIEW 
# --------------------------------------------------------------------------------
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .serializers import LoginRequestSerializer
from .services import AuthService

class LoginView(APIView):
    # This endpoint must be public
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginRequestSerializer(data=request.data)
        
        if serializer.is_valid():
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']
            
            # Business Logic via Service
            user = AuthService.authenticate_user(email, password)
            tokens = AuthService.get_tokens_for_user(user)
            user_data = AuthService.get_user_payload(user)
            
            return Response({
                **tokens,
                "user": user_data
            }, status=status.HTTP_200_OK)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
# --------------------------------------------------------------------------------
# DOCUMENT VIEWS
# --------------------------------------------------------------------------------

class DocumentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        
        if serializer.is_valid():
            # Get the patient profile of the logged-in user
            patient_profile = request.user.patient_profile
            
            # Save the document
            try:
                doc = DocumentService.save_document(patient_profile, serializer.validated_data)
                return Response({
                    "message": "Document uploaded successfully",
                    "document_id": doc.id,
                    "file_path": request.build_absolute_uri(doc.file_url.url)
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                # If it's a validation error (duplicate check), return 409
                from django.core.exceptions import ValidationError
                if isinstance(e, ValidationError):
                    return Response({"detail": str(e.message)}, status=status.HTTP_409_CONFLICT)
                # If it's an AI processing failure, return 422
                if isinstance(e, ValueError):
                    return Response({"detail": str(e)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
                raise e
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DocumentDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        try:
            # We filter by both ID and patient to ensure ownership
            document = Document.objects.get(pk=pk, patient=request.user.patient_profile)
            
            DocumentService.delete_document(document)
            
            return Response({
                "message": "Document and clinical records deleted successfully."
            }, status=status.HTTP_204_NO_CONTENT)
            
        except Document.DoesNotExist:
            return Response({
                "error": "Document not found or you don't have permission to delete it."
            }, status=status.HTTP_404_NOT_FOUND)

# --------------------------------------------------------------------------------
# PATIENT DOCUMENT UPLOAD TIMELINE VIEW 
# --------------------------------------------------------------------------------
class PatientTimelineView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Fetch documents for the logged-in patient
        documents = Document.objects.filter(patient=request.user.patient_profile)
        
        # Serialize the data
        data = []
        for doc in documents:
            record = {
                "id": doc.id,
                "title": doc.title,
                "type": doc.document_type.replace('_', ' ').title(),
                "date": doc.document_date.strftime("%d %b") if doc.document_date else "Recent",
                "upload_date": doc.created_at.strftime("%d %b %Y, %H:%M"),
                "year": doc.document_date.year if doc.document_date else "2026",
                "file_url": request.build_absolute_uri(doc.file_url.url),
                "ai_summary": None,
            }
            if hasattr(doc, 'medical_record') and doc.medical_record:
                record["ai_summary"] = doc.medical_record.ai_summary
            data.append(record)
        
        return Response(data)


class PatientChartDataView(APIView):
    """GET /api/records/chart-data/
    Returns all documents with full extracted_data (structured tests + ai_summary)
    for use in Health Trends charts.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        documents = (
            Document.objects
            .filter(patient=request.user.patient_profile)
            .select_related('medical_record')
            .order_by('document_date', 'created_at')
        )
        data = []
        for doc in documents:
            record = {
                "id": doc.id,
                "title": doc.title,
                "type": doc.document_type,
                "date": str(doc.document_date) if doc.document_date else None,
                "ai_summary": None,
                "tests": [],
            }
            if hasattr(doc, 'medical_record') and doc.medical_record:
                mr = doc.medical_record
                record["ai_summary"] = mr.ai_summary
                # extracted_data can be a dict with 'tests' key or a list directly
                ed = mr.extracted_data
                if isinstance(ed, dict):
                    record["tests"] = ed.get("tests", [])
                elif isinstance(ed, list):
                    record["tests"] = ed
            data.append(record)
        return Response(data)

# --------------------------------------------------------------------------------
# CHAT VIEWS 
# --------------------------------------------------------------------------------
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from .models import ChatSession, ChatMessage
from .serializers import ChatSessionSerializer, ChatMessageSerializer
from ai.ai import chat_with_rognidhi

class ChatSessionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sessions = ChatSession.objects.filter(patient=request.user.patient_profile)
        serializer = ChatSessionSerializer(sessions, many=True)
        return Response(serializer.data)

    def post(self, request):
        title = request.data.get('title', 'New Chat')
        session = ChatSession.objects.create(patient=request.user.patient_profile, title=title)
        return Response(ChatSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    def delete(self, request):
        ChatSession.objects.filter(patient=request.user.patient_profile).delete()
        return Response({"message": "All chat sessions deleted."}, status=status.HTTP_204_NO_CONTENT)

class ChatSessionMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            session = ChatSession.objects.get(pk=pk, patient=request.user.patient_profile)
            return Response(ChatSessionSerializer(session).data)
        except ChatSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request, pk):
        try:
            session = ChatSession.objects.get(pk=pk, patient=request.user.patient_profile)
        except ChatSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
            
        question = request.data.get('question')
        if not question:
            return Response({"error": "Question is required"}, status=status.HTTP_400_BAD_REQUEST)

        ChatMessage.objects.create(session=session, sender='user', text=question)

        medical_data = []
        patient_documents = Document.objects.filter(patient=request.user.patient_profile).select_related('medical_record')
        for doc in patient_documents:
            # Build a more complete context block for each record
            record_context = {
                "title": doc.title,
                "type": doc.document_type,
                "date": str(doc.document_date) if doc.document_date else "Unknown Date",
            }
            if hasattr(doc, 'medical_record'):
                # Include the AI's summary of what it saw in the image/PDF
                record_context["ai_analysis"] = doc.medical_record.ai_summary
                # Include extracted raw data if available
                if doc.medical_record.extracted_data:
                    record_context["structured_tests"] = doc.medical_record.extracted_data
            
            medical_data.append(record_context)
        
        history_msgs = ChatMessage.objects.filter(session=session).order_by('created_at')
        chat_history = []
        for msg in history_msgs:
            role = "user" if msg.sender == "user" else "assistant"
            chat_history.append({"role": role, "content": msg.text})

        if chat_history and chat_history[-1]['role'] == 'user' and chat_history[-1]['content'] == question:
            chat_history.pop()
            
        eval_metrics = None
        try:
            ans, eval_metrics = chat_with_rognidhi(
                medical_data=medical_data,
                chat_history=chat_history,
                new_question=question,
                patient_id=request.user.id,
            )
        except Exception as e:
            ans = "I'm having trouble analyzing your request right now. Please try again."
            eval_metrics = None

        ChatMessage.objects.create(session=session, sender='ai', text=ans, eval_metrics=eval_metrics)

        serializer = ChatSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def patch(self, request, pk):
        try:
            session = ChatSession.objects.get(pk=pk, patient=request.user.patient_profile)
        except ChatSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
            
        title = request.data.get('title')
        if title:
            session.title = title
            session.save()
            return Response(ChatSessionSerializer(session).data, status=status.HTTP_200_OK)
        return Response({"error": "No title provided"}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        try:
            session = ChatSession.objects.get(pk=pk, patient=request.user.patient_profile)
            session.delete()
            return Response({"message": "Chat session deleted."}, status=status.HTTP_204_NO_CONTENT)
        except ChatSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        
# ──────────────────────────────────────────────────────────────
# ACCESS CONTROL VIEWS ->
# POST /api/auth/register/doctor/
# ──────────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────────
# ROLE GUARD HELPERS
#
# Used at the top of each view to reject wrong-role requests
# before touching any business logic.
# Returns a 403 Response if the role doesn't match, else None.
# ──────────────────────────────────────────────────────────────

def require_role(user, required_role: str):
    """
    Returns a 403 Response if user's role != required_role.
    Returns None if role is correct (caller proceeds normally).

    Usage:
        guard = require_role(request.user, Role.DOCTOR)
        if guard: return guard
    """
    try:
        if user.userprofile.role != required_role:
            return Response(
                {"error": f"Only {required_role}s can perform this action."},
                status=status.HTTP_403_FORBIDDEN
            )
    except Exception:
        return Response(
            {"error": "User profile not found."},
            status=status.HTTP_403_FORBIDDEN
        )
    return None


# ──────────────────────────────────────────────────────────────
# REQUEST ACCESS VIEW
# POST /api/access/request/
# Role: Doctor only
#
# Doctor provides patient_email.
# Creates a pending AccessPermission + notifies patient.
# ──────────────────────────────────────────────────────────────

class RequestAccessView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):

        # ── Role guard ──
        guard = require_role(request.user, Role.DOCTOR)
        if guard:
            return guard

        # ── Validate ──
        serializer = AccessRequestSerializer(
            data=request.data,
            context={'request': request}   # needed for doctor identity in validate()
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # ── Create request ──
        try:
            request_access(
                doctor        = request.user,
                patient_email = serializer.validated_data['patient_email'],
            )
        except Exception:
            return Response(
                {"error": "Could not send access request. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {"message": "Access request sent successfully. The patient will be notified."},
            status=status.HTTP_201_CREATED
        )


# ──────────────────────────────────────────────────────────────
# PENDING REQUESTS VIEW
# GET /api/access/pending/
# Role: Patient only
#
# Returns all pending access requests waiting for this
# patient's approval.
# ──────────────────────────────────────────────────────────────

class PendingRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        # ── Role guard ──
        guard = require_role(request.user, Role.PATIENT)
        if guard:
            return guard

        permissions = get_pending_requests(patient=request.user)
        serializer  = AccessPermissionSerializer(permissions, many=True)

        return Response(
            {
                "count":   permissions.count(),
                "results": serializer.data,
            },
            status=status.HTTP_200_OK
        )


# ──────────────────────────────────────────────────────────────
# APPROVE ACCESS VIEW
# POST /api/access/approve/<int:permission_id>/
# Role: Patient only
#
# Patient approves a pending request.
# Sets status='active', notifies doctor.
# ──────────────────────────────────────────────────────────────

class ApproveAccessView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permission_id: int):

        # ── Role guard ──
        guard = require_role(request.user, Role.PATIENT)
        if guard:
            return guard

        try:
            approve_access(
                patient       = request.user,
                permission_id = permission_id,
            )
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception:
            return Response(
                {"error": "Could not approve request. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {"message": "Access approved. The doctor can now view your records."},
            status=status.HTTP_200_OK
        )


# ──────────────────────────────────────────────────────────────
# REVOKE ACCESS VIEW
# POST /api/access/revoke/<int:permission_id>/
# Role: Patient only
#
# Patient revokes an active permission.
# Sets status='revoked', notifies doctor.
# ──────────────────────────────────────────────────────────────

class RevokeAccessView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, permission_id: int):

        # ── Role guard ──
        guard = require_role(request.user, Role.PATIENT)
        if guard:
            return guard

        try:
            revoke_access(
                patient       = request.user,
                permission_id = permission_id,
            )
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception:
            return Response(
                {"error": "Could not revoke access. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {"message": "Access revoked successfully."},
            status=status.HTTP_200_OK
        )


# ──────────────────────────────────────────────────────────────
# MY DOCTORS VIEW  (patient sees who has access)
# GET /api/access/my-doctors/
# Role: Patient only
# ──────────────────────────────────────────────────────────────

class MyDoctorsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        # ── Role guard ──
        guard = require_role(request.user, Role.PATIENT)
        if guard:
            return guard

        permissions = get_my_doctors(patient=request.user)
        serializer  = AccessPermissionSerializer(permissions, many=True)

        return Response(
            {
                "count":   permissions.count(),
                "results": serializer.data,
            },
            status=status.HTTP_200_OK
        )


# ──────────────────────────────────────────────────────────────
# MY PATIENTS VIEW  (doctor sees who granted them access)
# GET /api/access/my-patients/
# Role: Doctor only
#
# Supports optional ?search=query param for patient name/email.
# ──────────────────────────────────────────────────────────────

class MyPatientsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        # ── Role guard ──
        guard = require_role(request.user, Role.DOCTOR)
        if guard:
            return guard

        search      = request.query_params.get('search', '').strip()
        permissions = get_my_patients(doctor=request.user, search=search)
        serializer  = MyPatientSerializer(permissions, many=True)

        return Response(
            {
                "count":   permissions.count(),
                "results": serializer.data,
            },
            status=status.HTTP_200_OK
        )


# ──────────────────────────────────────────────────────────────
# PATIENT DOCUMENTS FOR DOCTOR VIEW
# GET /api/access/patient-documents/<int:patient_id>/
# Role: Doctor only
#
# Returns all documents for a patient that the doctor has
# active access to. Includes AI summaries from MedicalRecord.
# Creates an AuditLog entry for each viewing.
# ──────────────────────────────────────────────────────────────

from .models import AccessPermission, AccessStatus, AuditLog, MedicalRecord

class PatientDocumentsForDoctorView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, patient_id: int):

        # ── Role guard ──
        guard = require_role(request.user, Role.DOCTOR)
        if guard:
            return guard

        # ── Verify active access ──
        has_access = AccessPermission.objects.filter(
            doctor=request.user,
            patient__id=patient_id,
            status=AccessStatus.ACTIVE,
        ).exists()

        if not has_access:
            return Response(
                {"error": "You do not have active access to this patient's records."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── Fetch patient info ──
        try:
            from django.contrib.auth.models import User as AuthUser
            patient_user = AuthUser.objects.select_related('patient_profile').get(id=patient_id)
        except AuthUser.DoesNotExist:
            return Response(
                {"error": "Patient not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── Fetch documents ──
        documents = (
            Document.objects
            .filter(patient=patient_user.patient_profile)
            .select_related('medical_record')
            .order_by('-document_date', '-created_at')
        )

        data = []
        for doc in documents:
            record = {
                "id": doc.id,
                "title": doc.title,
                "type": doc.document_type.replace('_', ' ').title(),
                "raw_type": doc.document_type,
                "date": doc.document_date.strftime("%d %b %Y") if doc.document_date else "Recent",
                "upload_date": doc.created_at.strftime("%d %b %Y, %H:%M"),
                "file_url": request.build_absolute_uri(doc.file_url.url),
                "ai_summary": None,
                "extracted_data": None,
            }
            if hasattr(doc, 'medical_record') and doc.medical_record:
                record["ai_summary"] = doc.medical_record.ai_summary
                record["extracted_data"] = doc.medical_record.extracted_data
            data.append(record)

        # ── Audit log ──
        AuditLog.objects.create(
            user=request.user,
            action='patient_documents_viewed',
            target_table='documents',
            target_id=patient_id,
        )

        # ── Build patient info ──
        patient_info = {
            "id": patient_user.id,
            "name": patient_user.get_full_name(),
            "email": patient_user.email,
        }
        try:
            pp = patient_user.patient_profile
            patient_info["blood_group"] = pp.blood_group
            patient_info["dob"] = str(pp.dob) if pp.dob else None
            patient_info["allergies"] = pp.allergies
        except Exception:
            pass

        return Response(
            {
                "patient": patient_info,
                "count": len(data),
                "documents": data,
            },
            status=status.HTTP_200_OK,
        )

# --------------------------------------------------------------------------------
# SCHEME SCRAPER VIEW
# --------------------------------------------------------------------------------
from .services import scrape_insurance_schemes

class ScrapeSchemesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        data = scrape_insurance_schemes()
        if not data:
            return Response([{"title": "Could not connect to scraping service.", "description": "Please try again later.", "category": "Error", "features": [], "url": ""}], status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(data, status=status.HTTP_200_OK)

# --------------------------------------------------------------------------------
# NOTIFICATION VIEWS
# --------------------------------------------------------------------------------
from .models import Notification
from datetime import timedelta

class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # 1. Clean up old notifications (auto-delete > 30 days)
        cutoff_date = timezone.now() - timedelta(days=30)
        Notification.objects.filter(user=request.user, created_at__lt=cutoff_date).delete()

        # 2. Fetch active notifications
        notifications = Notification.objects.filter(user=request.user).order_by('-created_at')[:50]
        
        data = [{
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.strftime("%d %b %Y, %H:%M")
        } for n in notifications]

        return Response(data, status=status.HTTP_200_OK)

class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(id=pk, user=request.user)
            notification.is_read = True
            notification.save()
            return Response({"success": True})
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)