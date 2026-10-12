export type Role = 'platform_owner' | 'platform_admin' | 'school_admin' | 'teacher' | 'student';
export type CourseLevel = 'L3' | 'L4' | 'L5' | 'General' | 'Professional' | 'Other';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  schoolIds: string[];
}

export interface SchoolMembership {
  _id: string;
  school: { _id: string; name: string; code: string } | string;
  role: Role;
  status: string;
}

export interface School {
  _id: string;
  name: string;
  code: string;
  type: string;
  district?: string;
  province?: string;
  status: string;
}

export interface Course {
  _id: string;
  id?: string;
  title: string;
  slug?: string;
  code?: string;
  summary?: string;
  description?: string;
  level: CourseLevel;
  category?: string;
  subject?: string;
  status: 'draft' | 'published' | 'archived';
  coverImageUrl?: string;
  tags?: string[];
  estimatedHours?: number;
  moduleCount?: number;
  lessonCount?: number;
  theoryPercent?: number;
  practicePercent?: number;
  certificateEligible?: boolean;
  price?: number;
}

export interface LessonBlock {
  type: 'heading' | 'paragraph' | 'list' | 'code' | 'image' | 'note' | 'quote';
  text?: string;
  title?: string;
  items?: string[];
  level?: number;
  language?: string;
  url?: string;
}

export interface Lesson {
  _id: string;
  module: string;
  course: string;
  order: number;
  kind: 'theory' | 'guided_practice' | 'independent_practice' | 'assessment';
  title: string;
  content: { blocks?: LessonBlock[]; [key: string]: unknown } | LessonBlock[];
  estimatedMinutes?: number;
  sourceRef?: { page?: number; note?: string };
  contentSourceKind?: string;
  status?: string;
}

export interface PracticalActivity {
  _id: string;
  course: string;
  module: string;
  title: string;
  kind?: string;
  instructions: string;
  steps?: { text: string }[];
  estimatedMinutes?: number;
  sourceRefs?: { page?: number }[];
}

export interface Module {
  _id: string;
  course: string;
  order: number;
  title: string;
  summary?: string;
  learningObjectives?: string[];
  estimatedMinutes?: number;
  lessons?: Lesson[];
  activities?: PracticalActivity[];
  practicalActivities?: PracticalActivity[];
  assessments?: AssessmentSummary[];
  sourceRef?: { page?: number };
}

export interface AssessmentSummary {
  id: string;
  title: string;
  moduleId?: string | null;
  passMarkPercent: number;
  attemptsAllowed: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  questionCount: number;
  timeLimitMinutes: number | null;
  offlineAllowed: boolean;
}

export interface AssessmentQuestionOption {
  id: string;
  text: string;
}

export interface PublicQuestion {
  id: string;
  questionText: string;
  options: AssessmentQuestionOption[];
  marks: number;
}

export interface StartedAttempt {
  attemptId: string;
  assessmentId: string;
  offlineAllowed?: boolean;
  timeLimitMinutes?: number | null;
  questions: PublicQuestion[];
}

export interface AttemptResult {
  attemptId: string;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  status: string;
  submittedAt?: string;
}

export interface QuestionFeedback {
  questionId: string;
  questionText: string;
  selectedOptionId: string;
  correctOptionId: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface CourseProgress {
  _id: string;
  enrollment: string;
  student: string;
  course: string;
  modules: ModulleProgressEntry[];
  completionPercent: number;
  theoryCompletedPercent: number;
  practiceCompletedPercent: number;
  finalProjectTasksCompleted: number;
  certificateEligible: boolean;
  certificateIssued: boolean;
}

export interface ModulleProgressEntry {
  module: string;
  started: boolean;
  completed: boolean;
  lessonsRead: string[];
  lessonsTotal: number;
  practicalCompleted: string[];
  practicalTotal: number;
  assessmentPassed: boolean;
  assessmentBestPercent: number;
}

export interface Enrollment {
  _id: string;
  student: string | { _id: string; name: string; email: string };
  course: string | { _id: string; title: string; level: string };
  school?: string;
  status: 'active' | 'completed' | 'suspended' | 'withdrawn';
  source: string;
  enrolledAt: string;
  completedAt?: string;
}

export interface Assignment {
  _id: string;
  course: string;
  module?: string;
  classGroups: string[];
  title: string;
  instructions?: string;
  deliverables?: string[];
  startAt?: string;
  dueAt?: string;
  allowLate?: boolean;
  marks?: number;
  status: 'draft' | 'published' | 'closed';
  mySubmission?: AssignmentSubmission | null;
}

export interface SubmissionFile {
  key: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface AssignmentSubmission {
  _id: string;
  assignment: string;
  course: string;
  student: string | { _id: string; name: string; email: string };
  content?: string;
  files: SubmissionFile[];
  status: string;
  isLate?: boolean;
  submittedAt?: string;
  grade?: number;
  feedback?: string;
  rubricScores?: { criterion: string; marks: number }[];
}

export interface FinalProject {
  _id: string;
  course: string;
  title: string;
  description: string;
  status: 'draft' | 'published';
  taskCount: number;
}

export interface FinalProjectTask {
  _id: string;
  project: string;
  course: string;
  order: number;
  kind: 'foundational' | 'integrated' | 'capstone';
  title: string;
  instructions: string;
  deliverables: string[];
  acceptanceCriteria: string[];
  marks: number;
  deadline?: string;
  mySubmission?: ProjectSubmission | null;
}

export interface ProjectSubmission {
  _id: string;
  task: string;
  course: string;
  student: string;
  content?: string;
  files: SubmissionFile[];
  status: string;
  isLate?: boolean;
  submittedAt?: string;
  grade?: number;
  feedback?: string;
}

export interface Certificate {
  _id: string;
  certificateId: string;
  studentName: string;
  courseTitle: string;
  courseLevel: string;
  institutionName: string;
  completionDate: string;
  issuedAt: string;
  status: 'issued' | 'revoked' | 'reissued';
  verifyUrl: string;
  verifyPath?: string;
  pdfKey?: string;
}

export interface BookJobStep {
  name: string;
  status: 'pending' | 'active' | 'done' | 'failed';
  message?: string;
  at?: string;
}

export interface SourceBook {
  _id: string;
  title: string;
  author?: string;
  level: CourseLevel;
  category?: string;
  subject?: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  pageCount?: number;
  charCount?: number;
  status: string;
  course?: string;
  createdAt: string;
}

export interface BookJob {
  _id: string;
  book: string | { _id: string; title?: string; level?: string; originalFilename?: string };
  status: string;
  progress?: number;
  steps: BookJobStep[];
  error?: string;
  result?: {
    modulesCreated?: number;
    lessonsCreated?: number;
    questionsCreated?: number;
    warnings?: string[];
  };
  createdAt: string;
  finishedAt?: string;
}

export interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface CmsPage {
  key: string;
  title: string;
  content?: Record<string, unknown>;
  draftContent?: Record<string, unknown>;
  publishedContent?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  status?: string;
  publishedAt?: string;
}
