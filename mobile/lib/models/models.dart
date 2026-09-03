// Barrel file — all models in one place

class Clinic {
  final int id;
  final String name;
  final String? address, phone, email, licenseNumber;
  final bool isActive;
  final double? complianceScore;
  Clinic({required this.id, required this.name, this.address, this.phone, this.email, this.licenseNumber, required this.isActive, this.complianceScore});
  factory Clinic.fromJson(Map<String, dynamic> j) => Clinic(
        id: j['id'], name: j['name'], address: j['address'], phone: j['phone'],
        email: j['email'], licenseNumber: j['license_number'],
        isActive: j['is_active'] ?? true, complianceScore: (j['compliance_score'] as num?)?.toDouble(),
      );
}

class Inspection {
  final int id;
  final String clinicName, inspectorName, status;
  final double? complianceScore;
  final String? riskLevel, submittedAt, createdAt;
  Inspection({required this.id, required this.clinicName, required this.inspectorName, required this.status, this.complianceScore, this.riskLevel, this.submittedAt, this.createdAt});
  factory Inspection.fromJson(Map<String, dynamic> j) => Inspection(
        id: j['id'], clinicName: j['clinic_name'] ?? '', inspectorName: j['inspector_name'] ?? '',
        status: j['status'] ?? 'draft', complianceScore: (j['compliance_score'] as num?)?.toDouble(),
        riskLevel: j['risk_level'], submittedAt: j['submitted_at'], createdAt: j['created_at'],
      );
}

class InspectionDetail extends Inspection {
  final List<ChecklistItem> items;
  InspectionDetail({required super.id, required super.clinicName, required super.inspectorName, required super.status, super.complianceScore, super.riskLevel, super.submittedAt, super.createdAt, required this.items});
  factory InspectionDetail.fromJson(Map<String, dynamic> j) => InspectionDetail(
        id: j['id'], clinicName: j['clinic_name'] ?? '', inspectorName: j['inspector_name'] ?? '',
        status: j['status'] ?? 'draft', complianceScore: (j['compliance_score'] as num?)?.toDouble(),
        riskLevel: j['risk_level'], submittedAt: j['submitted_at'], createdAt: j['created_at'],
        items: (j['items'] as List? ?? []).map((i) => ChecklistItem.fromJson(i)).toList(),
      );
}

class ChecklistItem {
  final int id;
  final String question;
  final String? answer, notes;
  final bool isRequired;
  ChecklistItem({required this.id, required this.question, this.answer, this.notes, required this.isRequired});
  factory ChecklistItem.fromJson(Map<String, dynamic> j) => ChecklistItem(
        id: j['id'], question: j['question'] ?? '', answer: j['answer'],
        notes: j['notes'], isRequired: j['is_required'] ?? false,
      );
}

class ChecklistTemplate {
  final int id;
  final String name;
  ChecklistTemplate({required this.id, required this.name});
  factory ChecklistTemplate.fromJson(Map<String, dynamic> j) => ChecklistTemplate(id: j['id'], name: j['name']);
}

class Audit {
  final int id;
  final String clinicName, auditorName, status;
  final double? overallScore;
  final String? riskLevel, createdAt, reviewedAt;
  Audit({required this.id, required this.clinicName, required this.auditorName, required this.status, this.overallScore, this.riskLevel, this.createdAt, this.reviewedAt});
  factory Audit.fromJson(Map<String, dynamic> j) => Audit(
        id: j['id'], clinicName: j['clinic_name'] ?? '', auditorName: j['auditor_name'] ?? '',
        status: j['status'] ?? 'draft', overallScore: (j['overall_score'] as num?)?.toDouble(),
        riskLevel: j['risk_level'], createdAt: j['created_at'], reviewedAt: j['reviewed_at'],
      );
}

class CorrectiveAction {
  final int id;
  final String title, status, priority;
  final String? clinicName, assigneeName, assignedTo, dueDate, description;
  final bool? requiresReinspection;
  CorrectiveAction({required this.id, required this.title, required this.status, required this.priority, this.clinicName, this.assigneeName, this.assignedTo, this.dueDate, this.description, this.requiresReinspection});
  factory CorrectiveAction.fromJson(Map<String, dynamic> j) => CorrectiveAction(
        id: j['id'], title: j['title'] ?? '', status: j['status'] ?? 'open',
        priority: j['priority'] ?? 'medium', clinicName: j['clinic_name'],
        assigneeName: j['assignee_name'], assignedTo: j['assigned_to_name'] ?? j['assignee_name'],
        dueDate: j['due_date'], description: j['description'],
        requiresReinspection: j['requires_reinspection'] as bool?,
      );
}

class Course {
  final int id;
  final String title;
  final String? description;
  final double passThreshold;
  final int validityDays, quizCount;
  Course({required this.id, required this.title, this.description, required this.passThreshold, required this.validityDays, required this.quizCount});
  factory Course.fromJson(Map<String, dynamic> j) => Course(
        id: j['id'], title: j['title'], description: j['description'],
        passThreshold: (j['pass_threshold'] as num).toDouble(),
        validityDays: j['validity_days'], quizCount: j['quiz_count'] ?? 0,
      );
}

class TeamCertification {
  final int id;
  final String participantName, participantEmail, status;
  final String? courseTitle, completedAt, expiresAt, certificatePath;
  final double? score;
  TeamCertification({required this.id, required this.participantName, required this.participantEmail, required this.status, this.courseTitle, this.completedAt, this.expiresAt, this.certificatePath, this.score});
  factory TeamCertification.fromJson(Map<String, dynamic> j) => TeamCertification(
        id: j['id'], participantName: j['participant_name'] ?? '',
        participantEmail: j['participant_email'] ?? '', status: j['status'] ?? 'pending',
        courseTitle: j['course_title'], completedAt: j['completed_at'],
        expiresAt: j['expires_at'], certificatePath: j['certificate_path'],
        score: (j['score'] as num?)?.toDouble(),
      );
}

class Announcement {
  final int id;
  final String title, content, priority;
  final bool isRead;
  final String? createdAt, authorName;
  Announcement({required this.id, required this.title, required this.content, required this.priority, required this.isRead, this.createdAt, this.authorName});
  factory Announcement.fromJson(Map<String, dynamic> j) => Announcement(
        id: j['id'], title: j['title'] ?? '', content: j['content'] ?? '',
        priority: j['priority'] ?? 'normal', isRead: j['is_read'] ?? false,
        createdAt: j['created_at'], authorName: j['author_name'],
      );
}

class AppNotification {
  final int id;
  final String title, body, type;
  final bool isRead;
  final String? createdAt;
  AppNotification({required this.id, required this.title, required this.body, required this.type, required this.isRead, this.createdAt});
  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: j['id'], title: j['title'] ?? '', body: j['body'] ?? '',
        type: j['type'] ?? 'info', isRead: j['is_read'] ?? false, createdAt: j['created_at'],
      );
}

class AppUser {
  final int id;
  final String email, fullName, role;
  final String? customRole;
  final bool isActive;
  AppUser({required this.id, required this.email, required this.fullName,
           required this.role, this.customRole, required this.isActive});
  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: j['id'], email: j['email'], fullName: j['full_name'] ?? '',
        role: j['role'], customRole: j['custom_role'], isActive: j['is_active'] ?? true,
      );
  String get effectiveRole => customRole ?? role;
}

class RoleConfig {
  final String name, displayName;
  final bool isSystem;
  final List<String> modules;
  RoleConfig({required this.name, required this.displayName, required this.isSystem, required this.modules});
  factory RoleConfig.fromJson(Map<String, dynamic> j) => RoleConfig(
        name: j['name'], displayName: j['display_name'],
        isSystem: j['is_system'] ?? false,
        modules: List<String>.from(j['modules'] ?? []),
      );
}
