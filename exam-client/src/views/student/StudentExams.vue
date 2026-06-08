<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { listExamsApi } from "../../api/exam";
import AppShell from "../../components/AppShell.vue";
import type { Exam } from "../../types/exam";

const router = useRouter();
const loading = ref(false);
const exams = ref<Exam[]>([]);

async function load() {
  loading.value = true;
  try {
    exams.value = await listExamsApi();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <AppShell title="考生端">
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>考试列表</h2>
          <p>选择一场考试，进入后系统会开启倒计时并自动保存作答草稿。</p>
        </div>
      </div>

      <el-empty v-if="!loading && !exams.length" description="暂无已发布考试" />
      <div v-else v-loading="loading" class="exam-grid">
        <article v-for="exam in exams" :key="exam.id" class="exam-card">
          <div>
            <h3>{{ exam.title }}</h3>
            <p>{{ exam.description }}</p>
          </div>
          <div class="exam-card-meta">
            <el-tag>{{ exam.duration }} 分钟</el-tag>
            <el-tag type="success">{{ exam.totalScore }} 分</el-tag>
            <el-tag type="info">{{ exam.questionCount }} 题</el-tag>
          </div>
          <el-button type="primary" @click="router.push(`/student/exam/${exam.id}`)">开始考试</el-button>
        </article>
      </div>
    </section>
  </AppShell>
</template>
