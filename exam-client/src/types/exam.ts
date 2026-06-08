export type Role = "admin" | "student";
export type QuestionType = "choice" | "judgement";

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
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
  duration: number;
  totalScore: number;
  published: boolean;
  randomize: boolean;
  questionCount?: number;
  questions?: Question[];
  createdAt?: string;
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
}
