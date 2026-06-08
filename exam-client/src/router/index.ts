import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import LoginView from "../views/LoginView.vue";
import AdminDashboard from "../views/admin/AdminDashboard.vue";
import AdminExams from "../views/admin/AdminExams.vue";
import AdminGrades from "../views/admin/AdminGrades.vue";
import AdminUsers from "../views/admin/AdminUsers.vue";
import StudentExams from "../views/student/StudentExams.vue";
import ExamTaking from "../views/student/ExamTaking.vue";
import ExamResult from "../views/student/ExamResult.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/student/exams" },
    { path: "/login", component: LoginView },
    {
      path: "/admin",
      component: AdminDashboard,
      meta: { staff: true },
      children: [
        { path: "", redirect: "/admin/exams" },
        { path: "exams", component: AdminExams },
        { path: "users", component: AdminUsers },
        { path: "grades", component: AdminGrades }
      ]
    },
    { path: "/student/exams", component: StudentExams, meta: { role: "student" } },
    { path: "/student/exam/:id", component: ExamTaking, meta: { role: "student" } },
    { path: "/student/result/:id", component: ExamResult, meta: { role: "student" } }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.hydrate();

  if (to.path === "/login") return true;
  if (!auth.user) return "/login";

  const role = to.meta.role;
  const staff = to.meta.staff;
  if (staff && !["admin", "teacher"].includes(auth.user.role)) return "/student/exams";
  if (role && auth.user.role !== role) {
    return ["admin", "teacher"].includes(auth.user.role) ? "/admin/users" : "/student/exams";
  }
  return true;
});

export default router;
