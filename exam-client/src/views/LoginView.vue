<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { z } from "zod";
import { useAuthStore } from "../stores/auth";

const schema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码")
});

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const form = reactive({ username: "student", password: "student123" });

async function submit() {
  const result = schema.safeParse(form);
  if (!result.success) {
    ElMessage.warning(result.error.issues[0].message);
    return;
  }

  loading.value = true;
  try {
    await auth.login(form.username, form.password);
    router.push(auth.user?.role === "admin" ? "/admin/exams" : "/student/exams");
  } finally {
    loading.value = false;
  }
}

function fill(role: "admin" | "student") {
  form.username = role;
  form.password = role === "admin" ? "admin123" : "student123";
}
</script>

<template>
  <main class="login-page">
    <section class="login-visual">
      <p class="eyebrow">Vue 3 + Pinia + Router + Express</p>
      <h1>SmartExam 在线考试系统</h1>
      <p>覆盖管理员出卷、考生考试、倒计时提交、防切屏、自动判分、错题解析、试题导入和 PDF 报告。</p>
    </section>

    <el-card class="login-card" shadow="never">
      <h2>登录</h2>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="admin / student" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
        <el-button type="primary" :loading="loading" class="full-button" @click="submit">进入系统</el-button>
      </el-form>
      <div class="quick-login">
        <el-button size="small" @click="fill('student')">考生演示</el-button>
        <el-button size="small" @click="fill('admin')">管理员演示</el-button>
      </div>
    </el-card>
  </main>
</template>
