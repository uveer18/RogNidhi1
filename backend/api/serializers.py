from rest_framework import serializers
from django.contrib.auth.models import User
from .models import DoctorProfile, Document
from .models import AccessPermission, AccessStatus, UserProfile, Role

# ──────────────────────────────────────────────────────────────
# PATIENT REGISTER SERIALIZER
# Validates all fields required to create a patient account.
# Patient-specific fields: dob, blood_group, allergies,
#                          emergency_contact
# ──────────────────────────────────────────────────────────────

class PatientRegisterSerializer(serializers.Serializer):

    # ── Core user fields ──
    first_name = serializers.CharField(max_length=100)
    last_name  = serializers.CharField(max_length=100)
    email      = serializers.EmailField()
    password   = serializers.CharField(min_length=8, write_only=True)
    phone      = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True
    )

    # ── Patient-specific fields ──
    dob = serializers.DateField(
        required=False,
        allow_null=True
    )
    blood_group = serializers.ChoiceField(
        choices=['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        required=False,
        allow_null=True
    )
    allergies = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True
    )
    emergency_contact = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True
    )

    def validate_email(self, value):
        """
        Reject if email is already registered.
        Stored lowercase — 'User@Gmail.com' == 'user@gmail.com'
        """
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )
        return value.lower()

    def validate_password(self, value):
        if value.isdigit():
            raise serializers.ValidationError(
                "Password cannot be entirely numeric."
            )
        if value.lower() in ['password', 'password123', '12345678']:
            raise serializers.ValidationError(
                "This password is too common."
            )
        return value


# ──────────────────────────────────────────────────────────────
# DOCTOR REGISTER SERIALIZER
# Validates all fields required to create a doctor account.
# Doctor-specific fields: specialization, license_number,
#                         hospital
# license_number is required and must be unique globally.
# ──────────────────────────────────────────────────────────────

class DoctorRegisterSerializer(serializers.Serializer):

    # ── Core user fields ──
    first_name = serializers.CharField(max_length=100)
    last_name  = serializers.CharField(max_length=100)
    email      = serializers.EmailField()
    password   = serializers.CharField(min_length=8, write_only=True)
    phone      = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True
    )

    # ── Doctor-specific fields ──
    specialization = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True
    )
    license_number = serializers.CharField(max_length=100)
    hospital       = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True
    )

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )
        return value.lower()

    def validate_password(self, value):
        if value.isdigit():
            raise serializers.ValidationError(
                "Password cannot be entirely numeric."
            )
        if value.lower() in ['password', 'password123', '12345678']:
            raise serializers.ValidationError(
                "This password is too common."
            )
        return value

    def validate_license_number(self, value):
        """
        One license number = one doctor account.
        Prevents duplicate doctor registrations.
        """
        if DoctorProfile.objects.filter(license_number=value).exists():
            raise serializers.ValidationError(
                "A doctor with this license number is already registered."
            )
        return value
    
# ----------------------------------------------------------------------------
# LOGIN SERIALIZERS
# ----------------------------------------------------------------------------

class LoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)

class UserResponseSerializer(serializers.Serializer):
    """
    Used only for documentation or structured output if needed.
    """
    id = serializers.IntegerField()
    name = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField()
    details = serializers.DictField(required=False)

# ----------------------------------------------------------------------------
# Document upload serializer
# ----------------------------------------------------------------------------
import os
from rest_framework import serializers
from django.core.exceptions import ValidationError

class DocumentUploadSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)

    class Meta:
        model = Document
        fields = ['title', 'document_type', 'document_date', 'file']

    def validate_file(self, value):
        # 1. Extract the file extension
        ext = os.path.splitext(value.name)[1].lower()
        
        # 2. Define supported extensions
        valid_extensions = ['.pdf', '.png', '.jpg', '.jpeg']
        
        # 3. Check extension
        if ext not in valid_extensions:
            raise serializers.ValidationError(
                f"Unsupported file extension '{ext}'. Supported types are: {', '.join(valid_extensions)}"
            )
            
        # 4. Optional: Check file size (e.g., limit to 5MB)
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("File size too large. Maximum limit is 5MB.")
            
        return value

# ----------------------------------------------------------------------------
# CHAT SERIALIZERS
# ----------------------------------------------------------------------------
from .models import ChatSession, ChatMessage

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'sender', 'text', 'created_at', 'eval_metrics']

class ChatSessionSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = ['id', 'patient', 'title', 'created_at', 'updated_at', 'messages']
        read_only_fields = ['patient']

# ──────────────────────────────────────────────────────────────
# ACCESS CONTROL SERIALIZERS ->
# ACCESS REQUEST SERIALIZER
# Used by: Doctor → POST /api/access/request/
#
# Doctor provides patient_email to find and request access.
# Validates:
#   - Email belongs to an existing user
#   - That user is actually a patient
#   - Doctor hasn't already sent a pending/active request
# ──────────────────────────────────────────────────────────────

class AccessRequestSerializer(serializers.Serializer):
    patient_email = serializers.EmailField()

    def validate_patient_email(self, value):
        value = value.lower()

        # ── Check patient exists ──
        try:
            patient = User.objects.get(email__iexact=value)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                "No patient found with this email address."
            )

        # ── Check the user is actually a patient ──
        try:
            if patient.userprofile.role != Role.PATIENT:
                raise serializers.ValidationError(
                    "This email does not belong to a patient account."
                )
        except UserProfile.DoesNotExist:
            raise serializers.ValidationError(
                "This account has no role assigned."
            )

        return value

    def validate(self, data):
        """
        Cross-field validation — needs both patient and request.user (doctor).
        Called after validate_patient_email passes.
        request is passed via context: serializer = AccessRequestSerializer(
            data=request.data, context={'request': request}
        )
        """
        doctor  = self.context['request'].user
        patient_email = data['patient_email']

        try:
            patient = User.objects.get(email__iexact=patient_email)
        except User.DoesNotExist:
            return data  # already caught above

        # ── Prevent duplicate requests ──
        existing = AccessPermission.objects.filter(
            patient=patient,
            doctor=doctor
        ).first()

        if existing:
            if existing.status == AccessStatus.PENDING:
                raise serializers.ValidationError(
                    "You have already sent an access request to this patient. "
                    "Please wait for their response."
                )
            if existing.status == AccessStatus.ACTIVE:
                raise serializers.ValidationError(
                    "You already have active access to this patient's records."
                )
            if existing.status == AccessStatus.REVOKED:
                # Allow re-requesting after revocation — service handles this
                pass

        return data


# ──────────────────────────────────────────────────────────────
# ACCESS PERMISSION RESPONSE SERIALIZER
# Used for: GET /api/access/pending/ and GET /api/access/my-doctors/
# Serializes AccessPermission rows for the patient to see.
# ──────────────────────────────────────────────────────────────

class AccessPermissionSerializer(serializers.ModelSerializer):
    doctor_name           = serializers.SerializerMethodField()
    doctor_email          = serializers.SerializerMethodField()
    doctor_specialization = serializers.SerializerMethodField()
    doctor_hospital       = serializers.SerializerMethodField()

    class Meta:
        model  = AccessPermission
        fields = [
            'id',
            'status',
            'granted_at',
            'approved_at',
            'doctor_name',
            'doctor_email',
            'doctor_specialization',
            'doctor_hospital',
        ]

    def get_doctor_name(self, obj):
        return obj.doctor.get_full_name()

    def get_doctor_email(self, obj):
        return obj.doctor.email

    def get_doctor_specialization(self, obj):
        try:
            return obj.doctor.doctor_profile.specialization
        except Exception:
            return None

    def get_doctor_hospital(self, obj):
        try:
            return obj.doctor.doctor_profile.hospital
        except Exception:
            return None


# ──────────────────────────────────────────────────────────────
# MY PATIENTS SERIALIZER
# Used for: GET /api/access/my-patients/ (doctor side)
# Serializes AccessPermission rows for the doctor to see.
# ──────────────────────────────────────────────────────────────

class MyPatientSerializer(serializers.ModelSerializer):
    patient_id    = serializers.SerializerMethodField()
    patient_name  = serializers.SerializerMethodField()
    patient_email = serializers.SerializerMethodField()
    blood_group   = serializers.SerializerMethodField()

    class Meta:
        model  = AccessPermission
        fields = [
            'id',
            'status',
            'granted_at',
            'approved_at',
            'patient_id',
            'patient_name',
            'patient_email',
            'blood_group',
        ]

    def get_patient_id(self, obj):
        return obj.patient.id

    def get_patient_name(self, obj):
        return obj.patient.get_full_name()

    def get_patient_email(self, obj):
        return obj.patient.email

    def get_blood_group(self, obj):
        try:
            return obj.patient.patient_profile.blood_group
        except Exception:
            return None