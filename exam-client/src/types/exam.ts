export type Role = "admin" | "teacher" | "student";
export type QuestionType = "choice" | "judgement";

export interface ClassInfo {
  id: string;
  name: string;
  teacherId: string;
  teacherName?: string;
  studentCount?: number;
  createdAt?: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  classIds?: string[];
  classes?: ClassInfo[];
  teacherId?: string;
  teacherName?: string;
  adminId?: string;
  createdAt?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  options: string[];
  answer?: string;
  score: number;
  explanation?: string;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  classIds?: string[];
  classNames?: string[];
  classes?: ClassInfo[];
  duration: number;
  totalScore: number;
  published: boolean;
  randomize: boolean;
  questionCount?: number;
  questions?: Question[];
  createdAt?: string;
  status?: "available" | "completed" | "redo_approved";
  latestSubmissionId?: string;
  redoRequestStatus?: "" | "pending" | "approved" | "rejected";
}

export interface SubmissionDetail {
  questionId: string;
  title: string;
  type: QuestionType;
  options: string[];
  userAnswer: string;
  answer: string;
  correct: boolean;
  score: number;
  questionScore: number;
  explanation: string;
}

export interface Submission {
  id: string;
  examId: string;
  examTitle: string;
  userId: string;
  userName: string;
  score: number;
  totalScore: number;
  focusWarnings: number;
  startedAt: string | null;
  submittedAt: string;
  details: SubmissionDetail[];
  classIds?: string[];
  classNames?: string[];
  teacherIds?: string[];
  teacherNames?: string[];
  attemptNo?: number;
}

export interface RedoRequest {
  id: string;
  userId: string;
  studentName: string;
  examId: string;
  examTitle: string;
  classIds: string[];
  classNames: string[];
  reason: string;
  status: "pending" | "approved" | "rejected" | "used";
  createdAt: string;
}

export interface GradeSummary {
  classId: string;
  className: string;
  examId: string;
  examTitle: string;
  count: number;
  average: number;
  highest: number;
  lowest: number;
}
