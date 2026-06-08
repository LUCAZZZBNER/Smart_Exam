<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { listExamsApi, requestRedoApi } from "../../api/exam";
import AppShell from "../../components/AppShell.vue";
import type { Exam } from "../../types/exam";

const router = useRouter();
const loading = ref(false);
const exams = ref<Exam[]>([]);
const redoReason = reactive<Record<string, string>>({});

const examsByClass = computed(() => {
  const groups = new Map<string, { classId: string; className: string; exams: Exam[] }>();
  for (const exam of exams.value) {
    const ids = exam.classIds?.length ? exam.classIds : ["unassigned"];
    const names = exam.classNames?.length ? exam.classNames : ["未分班"];
    ids.forEach((classId, index) => {
      const current = groups.get(classId) || { classId, className: names[index] || "未分班", exams: [] };
      current.exams.push(exam);
      groups.set(classId, current);
    });
  }
  return [...groups.values()];
});

async function load() {
  loading.value = true;
  try {
    exams.value = await listExamsApi();
  } finally {
    loading.value = false;
  }
}

async function requestRedo(exam: Exam) {
  await requestRedoApi(exam.id, redoReason[exam.id] || "");
  ElMessage.success("已提交重做申请，等待老师审核");
  redoReason[exam.id] = "";
  await load();
}

onMounted(load);
</script>

<template>
  <AppShell title="考生端">
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>我的班级考试</h2>
          <p>考试按所属班级展示。每场考试完成后不能再次作答，申请重做通过后才能重新考试。</p>
        </div>
      </div>

      <el-empty v-if="!loading && !exams.length" description="暂无已发布考试" />
      <div v-else v-loading="loading" class="class-exam-list">
        <section v-for="group in examsByClass" :key="group.classId" class="class-band">
          <h3>{{ group.className }}</h3>
          <div class="exam-grid">
            <article v-for="exam in group.exams" :key="`${group.classId}-${exam.id}`" class="exam-card">
              <div>
                <h3>{{ exam.title }}</h3>
                <p>{{ exam.description }}</p>
              </div>
              <div class="exam-card-meta">
                <el-tag>{{ exam.duration }} 分钟</el-tag>
                <el-tag type="success">{{ exam.totalScore }} 分</el-tag>
                <el-tag type="info">{{ exam.questionCount }} 题</el-tag>
                <el-tag v-if="exam.status === 'completed'" type="warning">已完成</el-tag>
                <el-tag v-if="exam.status === 'redo_approved'" type="success">可重做</el-tag>
                <el-tag v-if="exam.redoRequestStatus === 'pending'" type="info">重做审核中</el-tag>
              </div>

              <el-button v-if="exam.status === 'available'" type="primary" @click="router.push(`/student/exam/${exam.id}`)">开始考试</el-button>
              <el-button v-else-if="exam.status === 'redo_approved'" type="primary" @click="router.push(`/student/exam/${exam.id}`)">开始重做</el-button>
              <el-button v-if="exam.latestSubmissionId" @click="router.push(`/student/result/${exam.latestSubmissionId}`)">查看成绩</el-button>

              <div v-if="exam.status === 'completed' && !exam.redoRequestStatus" class="redo-box">
                <el-input v-model="redoReason[exam.id]" size="small" placeholder="重做原因，可不填" />
                <el-button size="small" @click="requestRedo(exam)">申请重做</el-button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>
  </AppShell>
</template>
