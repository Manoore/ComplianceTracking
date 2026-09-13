// Barrel file — all models in one place

class Clinic {
  final int id;
  final String name;
  final String? address, city, state, zipCode, region, phone, email, website, notes, licenseNumber, clinicType;
  final List<String> services;
  final bool isActive;
  final double? complianceScore;
  final int? departmentId;
  final String? departmentName;
  Clinic({
    required this.id, required this.name, this.address, this.city, this.state, this.zipCode,
    this.region, this.phone, this.email, this.website, this.notes, this.licenseNumber,
    this.clinicType, this.services = const [], required this.isActive, this.complianceScore,
    this.departmentId, this.departmentName,
  });
  factory Clinic.fromJson(Map<String, dynamic> j) => Clinic(
        id: (j['id'] as num).toInt(), name: j['name'] as String? ?? '',
        address: j['address'], city: j['city'], state: j['state'], zipCode: j['zip_code'],
        region: j['region'], phone: j['phone'], email: j['email'], website: j['website'],
        notes: j['notes'], licenseNumber: j['license_number'], clinicType: j['clinic_type'],
        services: (j['services'] as List?)?.map((e) => e.toString()).toList() ?? const [],
        isActive: j['is_active'] ?? true, complianceScore: (j['compliance_score'] as num?)?.toDouble(),
        departmentId: (j['department_id'] as num?)?.toInt(), departmentName: j['department_name'],
      );

  /// "205 W Bagley Rd, Berea, OH 44017"
  String get fullAddress {
    bool has(String? s) => s != null && s.isNotEmpty;
    final cityState = [city, state].where(has).join(', ');
    final locality = [cityState, zipCode].where(has).join(' ');
    return [address, locality].where(has).join(', ');
  }
}

class Inspection {
  final int id;
  final String clinicName, inspectorName, status;
  final double? complianceScore;
  final String? riskLevel, submittedAt, createdAt;
  Inspection({required this.id, required this.clinicName, required this.inspectorName, required this.status, this.complianceScore, this.riskLevel, this.submittedAt, this.createdAt});
  factory Inspection.fromJson(Map<String, dynamic> j) => Inspection(
        id: (j['id'] as num).toInt(), clinicName: j['clinic_name'] ?? '', inspectorName: j['inspector_name'] ?? '',
        status: j['status'] ?? 'draft', complianceScore: (j['compliance_score'] as num?)?.toDouble(),
        riskLevel: j['risk_level'], submittedAt: j['submitted_at'], createdAt: j['created_at'],
      );
}

class InspectionDetail extends Inspection {
  final List<ChecklistItem> items;
  InspectionDetail({required super.id, required super.clinicName, required super.inspectorName, required super.status, super.complianceScore, super.riskLevel, super.submittedAt, super.createdAt, required this.items});
  factory InspectionDetail.fromJson(Map<String, dynamic> j) => InspectionDetail(
        id: (j['id'] as num).toInt(), clinicName: j['clinic_name'] ?? '', inspectorName: j['inspector_name'] ?? '',
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
        id: (j['id'] as num).toInt(), question: j['question'] ?? '', answer: j['answer'],
        notes: j['notes'], isRequired: j['is_required'] ?? false,
      );
}

class ChecklistTemplate {
  final int id;
  final String name;
  final int? departmentId;
  final String? departmentName;
  ChecklistTemplate({required this.id, required this.name, this.departmentId, this.departmentName});
  factory ChecklistTemplate.fromJson(Map<String, dynamic> j) => ChecklistTemplate(
        id: (j['id'] as num).toInt(), name: j['name'] as String? ?? '',
        departmentId: (j['department_id'] as num?)?.toInt(), departmentName: j['department_name'],
      );
}

/// Matches the backend's AuditReview (GET/PUT /audits/reviews), not a
/// per-clinic audit — there is no clinic_name or overall_score on this record.
class Audit {
  final int id;
  final int inspectionId;
  final String auditorName, status;
  final double? riskScore;
  final String? riskLevel, findings, reportPath, createdAt, reviewedAt;
  Audit({
    required this.id, required this.inspectionId, required this.auditorName, required this.status,
    this.riskScore, this.riskLevel, this.findings, this.reportPath, this.createdAt, this.reviewedAt,
  });
  factory Audit.fromJson(Map<String, dynamic> j) => Audit(
        id: (j['id'] as num).toInt(), inspectionId: (j['inspection_id'] as num).toInt(),
        auditorName: j['auditor_name'] ?? '', status: j['status'] ?? 'pending',
        riskScore: (j['risk_score'] as num?)?.toDouble(), riskLevel: j['risk_level'],
        findings: j['findings'], reportPath: j['report_path'],
        createdAt: j['created_at'], reviewedAt: j['reviewed_at'],
      );
}

class CorrectiveAction {
  final int id;
  final String title, status, priority;
  final String? clinicName, assigneeName, assignedTo, dueDate, description;
  final bool? requiresReinspection;
  final int evidenceCount;
  CorrectiveAction({required this.id, required this.title, required this.status, required this.priority, this.clinicName, this.assigneeName, this.assignedTo, this.dueDate, this.description, this.requiresReinspection, this.evidenceCount = 0});
  factory CorrectiveAction.fromJson(Map<String, dynamic> j) => CorrectiveAction(
        id: j['id'], title: j['title'] ?? '', status: j['status'] ?? 'open',
        priority: j['priority'] ?? 'medium', clinicName: j['clinic_name'],
        assigneeName: j['assignee_name'], assignedTo: j['assigned_to_name'] ?? j['assignee_name'],
        dueDate: j['due_date'], description: j['description'],
        requiresReinspection: j['requires_reinspection'] as bool?,
        evidenceCount: (j['evidence'] as List?)?.length ?? 0,
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
  final String? managedRegion;
  final bool isActive;
  AppUser({required this.id, required this.email, required this.fullName,
           required this.role, this.customRole, this.managedRegion, required this.isActive});
  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: j['id'], email: j['email'], fullName: j['full_name'] ?? '',
        role: j['role'], customRole: j['custom_role'], managedRegion: j['managed_region'],
        isActive: j['is_active'] ?? true,
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
