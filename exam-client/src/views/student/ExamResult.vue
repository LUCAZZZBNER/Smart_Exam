<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import jsPDF from "jspdf";
import { getSubmissionApi } from "../../api/exam";
import AppShell from "../../components/AppShell.vue";
import type { Submission } from "../../types/exam";

const route = useRoute();
const router = useRouter();
const result = ref<Submission | null>(null);

const percent = computed(() => {
  if (!result.value) return 0;
  return Math.round((result.value.score / result.value.totalScore) * 100);
});

async function load() {
  const id = String(route.params.id);
  const raw = sessionStorage.getItem(`smart-exam-result-${String(route.params.id)}`);
  if (raw) {
    result.value = JSON.parse(raw);
    return;
  }
  result.value = await getSubmissionApi(id);
}

function downloadPdf() {
  if (!result.value) return;
  const doc = new jsPDF();
  doc.setFont("helvetica");
  doc.setFontSize(18);
  doc.text("SmartExam Report", 14, 18);
  doc.setFontSize(11);
  doc.text(`Student: ${result.value.userName}`, 14, 32);
  doc.text(`Exam: ${result.value.examTitle}`, 14, 40);
  doc.text(`Score: ${result.value.score}/${result.value.totalScore}`, 14, 48);
  doc.text(`Focus warnings: ${result.value.focusWarnings}`, 14, 56);
  doc.text(`Submitted at: ${new Date(result.value.submittedAt).toLocaleString()}`, 14, 64);
  let y = 78;
  result.value.details.forEach((detail, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const mark = detail.correct ? "Correct" : "Wrong";
    doc.text(`${index + 1}. ${mark} ${detail.score}/${detail.questionScore}`, 14, y);
    doc.text(`Your answer: ${detail.userAnswer || "Blank"}`, 18, y + 8);
    doc.text(`Answer: ${detail.answer}`, 18, y + 16);
    y += 28;
  });
  doc.save(`${result.value.examTitle}-report.pdf`);
}

onMounted(load);
</script>

<template>
  <AppShell title="考试结果">
    <section v-if="result" class="result-page panel">
      <div class="result-hero">
        <div>
          <p class="eyebrow">自动判分完成</p>
          <h2>{{ result.examTitle }}</h2>
          <p>{{ new Date(result.submittedAt).toLocaleString() }}</p>
        </div>
        <el-progress type="dashboard" :percentage="percent">
          <template #default>
            <strong>{{ result.score }}</strong>
            <span>/ {{ result.totalScore }}</span>
          </template>
        </el-progress>
      </div>

      <div class="metric-row">
        <div class="metric">
          <span>切屏次数</span>
          <strong>{{ result.focusWarnings }}</strong>
        </div>
        <div class="metric">
          <span>错题数量</span>
          <strong>{{ result.details.filter((item) => !item.correct).length }}</strong>
        </div>
      </div>

      <div class="result-actions">
        <el-button type="primary" @click="downloadPdf">导出 PDF 报告</el-button>
        <el-button @click="router.push('/student/exams')">返回考试列表</el-button>
      </div>

      <article v-for="(detail, index) in result.details" :key="detail.questionId" class="review-card" :class="{ wrong: !detail.correct }">
        <div class="question-title">
          <strong>{{ index + 1 }}.</strong>
          <span>{{ detail.title }}</span>
          <el-tag :type="detail.correct ? 'success' : 'danger'">{{ detail.correct ? "正确" : "错误" }}</el-tag>
        </div>
        <p>你的答案：{{ detail.userAnswer || "未作答" }}</p>
        <p>正确答案：{{ detail.answer }}</p>
        <p>解析：{{ detail.explanation }}</p>
      </article>
    </section>

    <el-empty v-else description="未找到本次考试结果">
      <el-button type="primary" @click="router.push('/student/exams')">返回考试列表</el-button>
    </el-empty>
  </AppShell>
</template>
