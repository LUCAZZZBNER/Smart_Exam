import { http } from "./http";
import type { ClassInfo, Exam, GradeSummary, RedoRequest, Submission, User } from "../types/exam";

export async function loginApi(payload: { username: string; password: string }) {
  const { data } = await http.post<{ token: string; user: User }>("/login", payload);
  return data;
}

export async function currentUserApi() {
  const { data } = await http.get<User>("/user");
  return data;
}

export async function listExamsApi() {
  const { data } = await http.get<Exam[]>("/exams");
  return data;
}

export async function getExamApi(id: string) {
  const { data } = await http.get<Exam>(`/exam/${id}`);
  return data;
}

export async function submitExamApi(payload: {
  examId: string;
  answers: Record<string, string>;
  startedAt: string;
  focusWarnings: number;
}) {
  const { data } = await http.post<Submission>("/exam/submit", payload);
  return data;
}

export async function getSubmissionApi(id: string) {
  const { data } = await http.get<Submission>(`/submissions/${id}`);
  return data;
}

export async function adminListExamsApi() {
  const { data } = await http.get<Exam[]>("/admin/exams");
  return data;
}

export async function createExamApi(payload: Omit<Exam, "id">) {
  const { data } = await http.post<Exam>("/admin/exams", payload);
  return data;
}

export async function updateExamApi(id: string, payload: Omit<Exam, "id">) {
  const { data } = await http.put<Exam>(`/admin/exams/${id}`, payload);
  return data;
}

export async function deleteExamApi(id: string) {
  await http.delete(`/admin/exams/${id}`);
}

export async function listGradesApi() {
  const { data } = await http.get<{ rows: Submission[]; summary: GradeSummary[]; redoRequests: RedoRequest[] }>("/admin/grades");
  return data;
}

export async function requestRedoApi(examId: string, reason: string) {
  const { data } = await http.post<RedoRequest>(`/exam/${examId}/redo-request`, { reason });
  return data;
}

export async function handleRedoRequestApi(id: string, status: "approved" | "rejected") {
  const { data } = await http.patch<RedoRequest>(`/admin/redo-requests/${id}`, { status });
  return data;
}

export async function listUsersApi() {
  const { data } = await http.get<User[]>("/admin/users");
  return data;
}

export async function createUserApi(payload: {
  username: string;
  password: string;
  name: string;
  role: "teacher" | "student";
  classIds?: string[];
}) {
  const { data } = await http.post<User>("/admin/users", payload);
  return data;
}

export async function deleteUserApi(id: string) {
  await http.delete(`/admin/users/${id}`);
}

export async function listClassesApi() {
  const { data } = await http.get<ClassInfo[]>("/admin/classes");
  return data;
}

export async function createClassApi(payload: { name: string; teacherId?: string }) {
  const { data } = await http.post<ClassInfo>("/admin/classes", payload);
  return data;
}

export async function updateClassApi(id: string, payload: { name?: string; teacherId?: string; studentIds?: string[] }) {
  const { data } = await http.put<ClassInfo>(`/admin/classes/${id}`, payload);
  return data;
}

export async function deleteClassApi(id: string) {
  await http.delete(`/admin/classes/${id}`);
}

export async function importQuestionsApi(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await http.post<{ questions: NonNullable<Exam["questions"]> }>("/admin/import", form);
  return data.questions;
}
