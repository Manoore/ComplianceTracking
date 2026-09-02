export type UserRole = 'admin' | 'manager' | 'auditor' | 'team_member'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  custom_role?: string
  is_active: boolean
  last_login?: string
  tenant_id?: number
}

export interface Tenant {
  id: number
  name: string
  slug: string
  plan: string
  is_active: boolean
  trial_ends_at: string | null
  created_at: string
}

export interface RoleConfig {
  name: string
  display_name: string
  is_system: boolean
  modules: string[]
}

export interface AuthState {
  user: User | null
  access_token: string | null
  refresh_token: string | null
}

export interface Clinic {
  id: number
  name: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  email?: string
  manager_id?: number
  manager_name?: string
  is_active: boolean
  notes?: string
  created_at?: string
}

export interface ChecklistItem {
  id: number
  template_id: number
  category: string
  question: string
  description?: string
  is_required: boolean
  is_critical: boolean
  order_index: number
}

export interface ChecklistTemplate {
  id: number
  name: string
  description?: string
  is_active: boolean
  created_by: number
  items: ChecklistItem[]
  created_at?: string
}

export type ItemType =
  | 'pass_fail_na' | 'yes_no' | 'text_input' | 'numeric' | 'numeric_range'
  | 'photo' | 'signature' | 'dual_signoff' | 'document_upload'
  | 'date_picker' | 'multiple_choice'

export interface TypeConfig {
  min?: number
  max?: number
  unit?: string
  options?: string[]
}

export interface InspectionItem {
  id: number
  checklist_item_id: number
  question: string
  category: string
  is_critical: boolean
  item_type: ItemType
  type_config?: TypeConfig
  result: 'pass' | 'fail' | 'na' | 'pending' | null
  notes?: string
  text_value?: string
  numeric_value?: number | null
  passes_range?: boolean | null
  document_url?: string | null
  photo_urls: string[]
  second_signer_id?: number | null
  second_signed_at?: string | null
  second_signer_name?: string | null
}

export interface Inspection {
  id: number
  clinic_id: number
  clinic_name?: string
  template_id: number
  template_name?: string
  inspector_id: number
  inspector_name?: string
  status: string
  compliance_score?: number
  risk_level?: string
  checkin_time?: string
  checkout_time?: string
  checkin_lat?: number
  checkin_lng?: number
  notes?: string
  submitted_at?: string
  created_at?: string
  items: InspectionItem[]
}

export interface AuditReview {
  id: number
  inspection_id: number
  auditor_id: number
  auditor_name?: string
  status: string
  findings?: string
  risk_score?: number
  risk_level?: string
  report_path?: string
  reviewed_at?: string
  created_at?: string
}

export interface Course {
  id: number
  title: string
  description?: string
  pass_threshold: number
  validity_days: number
  is_active: boolean
  quiz_count: number
  created_at?: string
}

export interface CertificationLink {
  id: number
  token: string
  course_id: number
  course_title?: string
  assigned_email?: string
  assigned_name?: string
  expires_at?: string
  is_active: boolean
  completions: number
}

export interface TeamCertification {
  id: number
  participant_name: string
  participant_email: string
  course_id: number
  course_title?: string
  status: string
  score?: number
  attempts: number
  started_at?: string
  completed_at?: string
  expires_at?: string
  certificate_path?: string
}

export interface CorrectiveAction {
  id: number
  inspection_id: number
  clinic_id: number
  clinic_name?: string
  title: string
  description?: string
  status: string
  priority: string
  assigned_to?: number
  assignee_name?: string
  due_date?: string
  requires_reinspection: boolean
  resolved_at?: string
  verified_at?: string
  created_at?: string
  evidence: ActionEvidence[]
}

export interface ActionEvidence {
  id: number
  file_name: string
  file_path: string
  notes?: string
  uploaded_at?: string
}

export interface PolicyDocument {
  id: number
  title: string
  description?: string
  content: string
  version: string
  category?: string
  target_roles: string[]
  is_published: boolean
  requires_quiz: boolean
  quiz_questions?: QuizQuestion[]
  pass_threshold: number
  effective_date?: string
  published_by?: number
  publisher_name?: string
  published_at?: string
  is_active: boolean
  created_at?: string
  total_assigned: number
  signed_count: number
  my_attestation?: {
    status: 'pending' | 'read' | 'signed' | 'quiz_failed'
    read_at?: string
    signed_at?: string
    quiz_score?: number
    quiz_passed?: boolean
  } | null
}

export interface QuizQuestion {
  question: string
  options: string[]
  answer_index: number
}

export interface PolicyAttestation {
  id: number
  user_id: number
  user_name?: string
  user_email?: string
  user_role?: string
  status: 'pending' | 'read' | 'signed' | 'quiz_failed'
  read_at?: string
  signed_at?: string
  quiz_score?: number
  quiz_passed?: boolean
}

export interface DashboardData {
  summary: {
    total_inspections: number
    approved_inspections: number
    pending_review: number
    avg_compliance_score: number
    open_corrective_actions: number
    overdue_corrective_actions: number
    total_certifications: number
    completed_certifications: number
    overdue_certifications: number
  }
  clinic_scores: Array<{
    clinic_id: number
    clinic_name: string
    score: number
    risk_level: string
    last_inspection?: string
  }>
  trend: Array<{ month: string; avg_score: number }>
  recent_inspections: Array<{
    id: number
    clinic_name?: string
    score?: number
    risk_level?: string
    status: string
    submitted_at?: string
  }>
}
