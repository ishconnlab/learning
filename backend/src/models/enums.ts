export const ROLES = ['platform_owner', 'platform_admin', 'school_admin', 'teacher', 'student'] as const;
export type Role = (typeof ROLES)[number];

export const COURSE_LEVELS = ['L3', 'L4', 'L5', 'General', 'Professional', 'Other'] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const ENROLLMENT_STATUS = ['pending', 'active', 'completed', 'suspended', 'withdrawn'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUS)[number];

export const COURSE_STATUS = ['draft', 'in_review', 'published', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUS)[number];

export const BOOK_JOB_STATUS = ['queued', 'validating', 'extracting', 'ocr', 'structuring', 'review', 'ready', 'failed'] as const;
export type BookJobStatus = (typeof BOOK_JOB_STATUS)[number];

export const CONTENT_SOURCE_KIND = ['verbatim', 'summary', 'derived_practice', 'admin_authored'] as const;
export type ContentSourceKind = (typeof CONTENT_SOURCE_KIND)[number];

export const LESSON_KIND = ['theory', 'guided_practice', 'independent_practice', 'assessment'] as const;
export type LessonKind = (typeof LESSON_KIND)[number];

export const DIFFICULTY = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTY)[number];

export const SUBMISSION_STATUS = ['draft', 'submitted', 'graded', 'returned', 'resubmitted', 'late'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUS)[number];

export const CERTIFICATE_STATUS = ['issued', 'revoked', 'reissued'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUS)[number];

export const ATTEMPT_STATUS = ['in_progress', 'submitted', 'graded', 'expired', 'abandoned'] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUS)[number];

export const AUDIT_SEVERITY = ['info', 'warning', 'critical'] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITY)[number];

export const SYNC_ENTITY_TYPES = [
  'progress',
  'assessment_attempt',
  'project_submission',
  'assignment_submission',
] as const;
export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];
