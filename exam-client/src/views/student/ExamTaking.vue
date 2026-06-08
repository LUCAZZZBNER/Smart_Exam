<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { getExamApi, submitExamApi } from "../../api/exam";
import AppShell from "../../components/AppShell.vue";
import CountdownTimer from "../../components/CountdownTimer.vue";
import type { Exam, Submission } from "../../types/exam";

const route = useRoute();
const router = useRouter();
const examId = String(route.params.id);
const draftKey = `smart-exam-draft-${examId}`;

const loading = ref(false);
const submitting = ref(false);
const exam = ref<Exam | null>(null);
const startedAt = ref(new Date().toISOString());
const focusWarnings = ref(0);
const answers = reactive<Record<string, string>>({});

const answeredCount = computed(() => Object.values(answers).filter(Boolean).length);
const questionCount = computed(() => exam.value?.questions?.length || 0);

function saveDraft() {
  localStorage.setItem(
    draftKey,
    JSON.stringify({
      startedAt: startedAt.value,
      focusWarnings: focusWarnings.value,
      answers
    })
  );
}

function restoreDraft() {
  const raw = localStorage.getItem(draftKey);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw) as {
      startedAt?: string;
      focusWarnings?: number;
      answers?: Record<string, string>;
    };
    Object.assign(answers, draft.answers || {});
    startedAt.value = draft.startedAt || startedAt.value;
    focusWarnings.value = Number(draft.focusWarnings || 0);
    ElMessage.success("已恢复上次未提交的作答草稿");
  } catch {
    localStorage.removeItem(draftKey);
  }
}

async function load() {
  loading.value = true;
  try {
    exam.value = await getExamApi(examId);
    restoreDraft();
  } finally {
    loading.value = false;
  }
}

async function submit(auto = false) {
  if (submitting.value) return;
  if (!auto && answeredCount.value < questionCount.value) {
    await ElMessageBox.confirm("仍有题目未作答，确定提交吗？", "提交确认", { type: "warning" });
  }

  submitting.value = true;
  try {
    const result: Submission = await submitExamApi({
      examId,
      answers: { ...answers },
      startedAt: startedAt.value,
      focusWarnings: focusWarnings.value
    });
    localStorage.removeItem(draftKey);
    sessionStorage.setItem(`smart-exam-result-${result.id}`, JSON.stringify(result));
    ElMessage.success(auto ? "考试时间到，已自动提交" : "提交成功");
    router.replace(`/student/result/${result.id}`);
  } finally {
    submitting.value = false;
  }
}

function onBlur() {
  focusWarnings.value += 1;
  saveDraft();
  ElMessage.warning(`检测到离开考试页面 ${focusWarnings.value} 次`);
}

watch(answers, saveDraft, { deep: true });
watch(focusWarnings, saveDraft);

onMounted(() => {
  load();
  window.addEventListener("blur", onBlur);
});

onBeforeUnmount(() => {
  window.removeEventListener("blur", onBlur);
});
</script>

<template>
  <AppShell title="在线考试">
    <section v-loading="loading" class="exam-taking">
      <div v-if="exam" class="exam-layout">
        <aside class="exam-status panel">
          <p class="eyebrow">倒计时</p>
          <CountdownTimer :seconds="exam.duration * 60" @timeout="submit(true)" />
          <div class="progress-info">
            <span>已答 {{ answeredCount }} / {{ questionCount }}</span>
            <el-progress :percentage="questionCount ? Math.round((answeredCount / questionCount) * 100) : 0" />
          </div>
          <div class="warning-box">
            <strong>{{ focusWarnings }}</strong>
            <span>切屏提醒</span>
          </div>
          <el-button type="primary" :loading="submitting" @click="submit(false)">提交试卷</el-button>
        </aside>

        <main class="paper panel">
          <div class="paper-head">
            <div>
              <h2>{{ exam.title }}</h2>
              <p>{{ exam.description }}</p>
            </div>
            <el-tag>{{ exam.totalScore }} 分</el-tag>
          </div>

          <article v-for="(question, index) in exam.questions" :key="question.id" class="question-card">
            <div class="question-title">
              <strong>{{ index + 1 }}.</strong>
              <span>{{ question.title }}</span>
              <el-tag size="small">{{ question.score }} 分</el-tag>
            </div>
            <el-radio-group v-model="answers[question.id]" class="answer-list">
              <el-radio v-for="option in question.options" :key="option" :value="option">{{ option }}</el-radio>
            </el-radio-group>
          </article>
        </main>
      </div>
    </section>
  </AppShell>
</template>
