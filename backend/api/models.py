from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.validators import FileExtensionValidator

# ──────────────────────────────────────────────────────────────
# CHOICES
# ──────────────────────────────────────────────────────────────

class Role(models.TextChoices):
    PATIENT = 'patient', 'Patient'
    DOCTOR  = 'doctor',  'Doctor'
    LAB     = 'lab',     'Lab'


class DocumentType(models.TextChoices):
    BLOOD_TEST        = 'blood_test',        'Blood Test'
    PATHOLOGY         = 'pathology',         'Pathology'
    LAB_REPORT        = 'lab_report',        'Lab Report'
    PRESCRIPTION      = 'prescription',      'Prescription'
    DISCHARGE_SUMMARY = 'discharge_summary', 'Discharge Summary'
    VACCINATION       = 'vaccination',       'Vaccination'
    INSURANCE         = 'insurance',         'Insurance'
    OTHER             = 'other',             'Other'


# ──────────────────────────────────────────────────────────────
# USER PROFILE
# Extends Django's built-in User with a role + phone.
# Every registered user gets one of these automatically via signal.
# Access in views: request.user.userprofile.role
# ──────────────────────────────────────────────────────────────

class UserProfile(models.Model):
    user  = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='userprofile'
    )
    role  = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.PATIENT
    )
    phone = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.role})"

    class Meta:
        db_table = 'user_profiles'


# ──────────────────────────────────────────────────────────────
# PATIENT PROFILE
# Created only for users with role='patient'.
# Stores health-specific info: dob, blood group, allergies.
# ──────────────────────────────────────────────────────────────

class PatientProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='patient_profile'
    )
    dob               = models.DateField(blank=True, null=True)
    blood_group       = models.CharField(max_length=5, blank=True, null=True)
    allergies         = models.TextField(blank=True, null=True)
    emergency_contact = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return f"Patient — {self.user.get_full_name()}"

    class Meta:
        db_table = 'patient_profiles'
        indexes  = [
            models.Index(fields=['user'], name='idx_patient_profile_user'),
        ]


# ──────────────────────────────────────────────────────────────
# DOCTOR PROFILE
# Created only for users with role='doctor'.
# ──────────────────────────────────────────────────────────────

class DoctorProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='doctor_profile'
    )
    specialization = models.CharField(max_length=100, blank=True, null=True)
    license_number = models.CharField(max_length=100, blank=True, null=True)
    hospital       = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"Dr. {self.user.get_full_name()} — {self.specialization}"

    class Meta:
        db_table = 'doctor_profiles'
        indexes  = [
            models.Index(fields=['user'], name='idx_doctor_profile_user'),
        ]


# ──────────────────────────────────────────────────────────────
# LAB PROFILE
# Created only for users with role='lab'.
# Labs can push documents directly to a patient's treasury.
# ──────────────────────────────────────────────────────────────

class LabProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='lab_profile'
    )
    lab_name            = models.CharField(max_length=100, blank=True, null=True)
    registration_number = models.CharField(max_length=100, blank=True, null=True)
    address             = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Lab — {self.lab_name}"

    class Meta:
        db_table = 'lab_profiles'
        indexes  = [
            models.Index(fields=['user'], name='idx_lab_profile_user'),
        ]


# ──────────────────────────────────────────────────────────────
# DOCUMENT
# Core table — every uploaded file lives here.
# file_url points to cloud storage (Firebase / Cloudinary).
# NEVER store raw files in the database.
#
# Two FKs on User:
#   patient     → who the document belongs to
#   uploaded_by → who actually uploaded it (patient or lab)
#
# on_delete=RESTRICT means you cannot delete a user
# who still has documents — medical data must not vanish silently.
# ──────────────────────────────────────────────────────────────

class Document(models.Model):
    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.RESTRICT,
        related_name='documents'
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.RESTRICT,
        related_name='uploaded_documents'
    )
    title         = models.CharField(max_length=200)
    document_type = models.CharField(
        max_length=20,
        choices=DocumentType.choices,
        default=DocumentType.OTHER
    )
    file_url = models.FileField(
        upload_to='documents/',
        validators=[FileExtensionValidator(allowed_extensions=['pdf', 'png', 'jpg', 'jpeg'])]
    )
    document_date = models.DateField(blank=True, null=True)
    file_hash     = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} [{self.document_type}] — {self.patient.get_full_name()}"

    class Meta:
        db_table = 'documents'
        ordering = ['-document_date', '-created_at']
        indexes  = [
            models.Index(fields=['patient'],       name='idx_doc_patient'),
            models.Index(fields=['uploaded_by'],   name='idx_doc_uploaded_by'),
            models.Index(fields=['document_type'], name='idx_doc_type'),
            models.Index(fields=['document_date'], name='idx_doc_date'),
            models.Index(fields=['file_hash'],     name='idx_doc_hash'),
        ]


# ──────────────────────────────────────────────────────────────
# MEDICAL RECORD
# AI-generated output produced from a Document.
# Exactly one MedicalRecord per Document (OneToOne on document).
#
# extracted_data: raw key-value pairs from OCR pipeline.
#   e.g. {"Haemoglobin": "10.2 g/dL", "WBC": "7400 /μL"}
#
# ai_summary: human-readable LangChain-generated summary.
#
# timeline_date: the date this record appears on the
#   patient's health timeline (usually == document_date).
# ──────────────────────────────────────────────────────────────

class MedicalRecord(models.Model):
    document = models.OneToOneField(
        Document,
        on_delete=models.CASCADE,
        related_name='medical_record'
    )
    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.RESTRICT,
        related_name='medical_records'
    )
    extracted_data = models.JSONField(blank=True, null=True)
    ai_summary     = models.TextField(blank=True, null=True)
    timeline_date  = models.DateField(blank=True, null=True)

    def __str__(self):
        return f"Record — {self.document.title} ({self.timeline_date})"

    class Meta:
        db_table = 'medical_records'
        ordering = ['-timeline_date']
        indexes  = [
            models.Index(fields=['patient'],       name='idx_mr_patient'),
            models.Index(fields=['timeline_date'], name='idx_mr_timeline_date'),
        ]


# ──────────────────────────────────────────────────────────────
# ACCESS PERMISSION
# The consent layer — a doctor can only view a patient's
# records if an active, non-expired permission row exists.
#
# unique_together('patient', 'doctor') prevents duplicate rows.
# When regranting access, just set is_active=True on the
# existing row instead of creating a new one.
#
# ALWAYS call permission.is_valid() in your views before
# returning any patient data to a doctor.
# ──────────────────────────────────────────────────────────────

class AccessStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    ACTIVE  = 'active',  'Active'
    REVOKED = 'revoked', 'Revoked'

class AccessPermission(models.Model):
    patient     = models.ForeignKey(User, on_delete=models.CASCADE, related_name='permissions_granted')
    doctor      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='permissions_received')
    status      = models.CharField(max_length=10, choices=AccessStatus.choices, default=AccessStatus.PENDING)
    granted_at  = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(blank=True, null=True)
    expires_at  = models.DateTimeField(blank=True, null=True)
    is_active   = models.BooleanField(default=False)

    def is_valid(self):
        return self.status == AccessStatus.ACTIVE and self.is_active

    class Meta:
        db_table        = 'access_permissions'
        unique_together = ('patient', 'doctor')

# ──────────────────────────────────────────────────────────────
# NOTIFICATION
# Every in-app alert sent to any user type.
# Examples:
#   "Apollo Labs uploaded your CBC report"
#   "Dr. Mehta has requested access to your records"
#   "Your report is ready — AI summary generated"
# ──────────────────────────────────────────────────────────────

class Notification(models.Model):
    user    = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title   = models.CharField(max_length=100)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        status = 'read' if self.is_read else 'unread'
        return f"[{status}] {self.title} → {self.user.get_full_name()}"

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes  = [
            # Composite index — most queries filter by user AND is_read together
            models.Index(fields=['user', 'is_read'], name='idx_notif_user_read'),
        ]


# ──────────────────────────────────────────────────────────────
# AUDIT LOG
# Records every sensitive action in the system.
# NEVER cascade-delete audit logs — they must outlive users.
# SET_NULL preserves the log row even after account deletion.
#
# action examples:
#   'document_uploaded', 'document_viewed', 'access_granted',
#   'access_revoked', 'summary_generated', 'profile_updated'
#
# To log an action in a view:
#   AuditLog.objects.create(
#       user=request.user,
#       action='document_viewed',
#       target_table='documents',
#       target_id=document.id
#   )
# ──────────────────────────────────────────────────────────────
# NOTIFICATION
# ──────────────────────────────────────────────────────────────

class Notification(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title      = models.CharField(max_length=200)
    message    = models.TextField()
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.user.username}] {self.title}"

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes  = [
            models.Index(fields=['user', 'is_read'], name='idx_notif_user_read'),
        ]


# ──────────────────────────────────────────────────────────────
# AUDIT LOG
# ──────────────────────────────────────────────────────────────

class AuditLog(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs'
    )
    action       = models.CharField(max_length=100)
    target_table = models.CharField(max_length=100, blank=True, null=True)
    target_id    = models.IntegerField(blank=True, null=True)
    performed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} — {self.action} on {self.target_table}:{self.target_id}"

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-performed_at']
        indexes  = [
            models.Index(fields=['user'],         name='idx_audit_user'),
            models.Index(fields=['target_table'], name='idx_audit_target_table'),
            models.Index(fields=['performed_at'], name='idx_audit_performed_at'),
        ]


# ──────────────────────────────────────────────────────────────
# CHAT SESSION
# ──────────────────────────────────────────────────────────────

class ChatSession(models.Model):
    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.CASCADE,
        related_name='chat_sessions'
    )
    title = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Chat Session — {self.patient.user.get_full_name()} ({self.created_at.date()})"

    class Meta:
        db_table = 'chat_sessions'
        ordering = ['-updated_at']


# ──────────────────────────────────────────────────────────────
# CHAT MESSAGE
# ──────────────────────────────────────────────────────────────

class ChatMessage(models.Model):
    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.CharField(max_length=20, choices=[('user', 'User'), ('ai', 'AI')])
    text = models.TextField()
    eval_metrics = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.sender}] {self.text[:50]}"

    class Meta:
        db_table = 'chat_messages'
        ordering = ['created_at']

from django.db.models.signals import post_delete
from django.dispatch import receiver

@receiver(post_delete, sender=Document)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    """
    Deletes file from filesystem when corresponding `Document` object is deleted.
    """
    if instance.file_url:
        try:
            instance.file_url.delete(save=False)
        except Exception:
            pass
