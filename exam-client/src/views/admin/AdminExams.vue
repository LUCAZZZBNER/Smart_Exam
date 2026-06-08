<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Delete, Edit, Plus, Upload } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { z } from "zod";
import {
  adminListExamsApi,
  createExamApi,
  deleteExamApi,
  importQuestionsApi,
  updateExamApi
} from "../../api/exam";
import type { Exam, Question } from "../../types/exam";

const questionSchema = z.object({
  title: z.string().min(1),
  answer: z.string().min(1),
  score: z.number().positive()
});

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref("");
const exams = ref<Exam[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

const form = reactive<Omit<Exam, "id">>({
  title: "",
  description: "",
  duration: 30,
  totalScore: 100,
  published: true,
  randomize: true,
  questions: [],
  createdAt: ""
});

const questionTotal = computed(() => form.questions?.reduce((sum, question) => sum + Number(question.score || 0), 0) || 0);

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `question-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankQuestion(): Question {
  return {
    id: createId(),
    type: "choice",
    title: "",
    options: ["", "", "", ""],
    answer: "",
    score: 10,
    explanation: ""
  };
}

function resetForm() {
  editingId.value = "";
  Object.assign(form, {
    title: "",
    description: "",
    duration: 30,
    totalScore: 100,
    published: true,
    randomize: true,
    questions: [blankQuestion()],
    createdAt: ""
  });
}

async function load() {
  loading.value = true;
  try {
    exams.value = await adminListExamsApi();
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

function openEdit(exam: Exam) {
  editingId.value = exam.id;
  Object.assign(form, {
    title: exam.title,
    description: exam.description,
    duration: exam.duration,
    totalScore: exam.totalScore,
    published: exam.published,
    randomize: exam.randomize,
    questions: (exam.questions || []).map((question) => ({ ...question, options: [...question.options] })),
    createdAt: exam.createdAt || ""
  });
  dialogVisible.value = true;
}

function addQuestion() {
  form.questions?.push(blankQuestion());
}

function removeQuestion(index: number) {
  form.questions?.splice(index, 1);
}

function normalizeQuestion(question: Question) {
  if (question.type === "judgement") {
    question.options = ["正确", "错误"];
    if (!["正确", "错误"].includes(question.answer || "")) question.answer = "正确";
  }
}

async function save() {
  if (!form.title.trim()) {
    ElMessage.warning("请输入试卷标题");
    return;
  }
  if (!form.questions?.length) {
    ElMessage.warning("至少添加一道试题");
    return;
  }
  const invalid = form.questions.find((question) => !questionSchema.safeParse(question).success);
  if (invalid) {
    ElMessage.warning("请补全题干、答案和分值");
    return;
  }
  if (questionTotal.value !== Number(form.totalScore)) {
    ElMessage.warning("试题分值合计需要等于试卷总分");
    return;
  }

  saving.value = true;
  try {
    const payload = {
      ...form,
      questions: form.questions.map((question) => ({
        ...question,
        options: question.options.map((item) => item.trim()).filter(Boolean)
      }))
    };
    if (editingId.value) await updateExamApi(editingId.value, payload);
    else await createExamApi(payload);
    ElMessage.success("试卷已保存");
    dialogVisible.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

async function removeExam(exam: Exam) {
  await ElMessageBox.confirm(`确定删除「${exam.title}」吗？相关成绩也会删除。`, "删除试卷", { type: "warning" });
  await deleteExamApi(exam.id);
  ElMessage.success("已删除");
  await load();
}

async function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const questions = await importQuestionsApi(file);
    form.questions = questions;
    ElMessage.success(`已导入 ${questions.length} 道题`);
  } finally {
    if (fileInput.value) fileInput.value.value = "";
  }
}

onMounted(load);
</script>

<template>
  <section class="panel">
    <div class="section-head">
      <div>
        <h2>试卷管理</h2>
        <p>创建试卷、维护选择题与判断题，支持 JSON/Excel 批量导入。</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新建试卷</el-button>
    </div>

    <el-table v-loading="loading" :data="exams" stripe>
      <el-table-column prop="title" label="试卷标题" min-width="180" />
      <el-table-column prop="duration" label="时长(分钟)" width="110" />
      <el-table-column prop="totalScore" label="总分" width="90" />
      <el-table-column prop="questionCount" label="题数" width="90">
        <template #default="{ row }">{{ row.questions?.length || row.questionCount }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.published ? 'success' : 'info'">{{ row.published ? "已发布" : "草稿" }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button :icon="Edit" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button :icon="Delete" size="small" type="danger" @click="removeExam(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </section>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑试卷' : '新建试卷'" class="exam-dialog" width="min(960px, 94vw)">
    <div class="form-grid">
      <el-form label-position="top">
        <el-form-item label="试卷标题">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="试卷说明">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <el-form label-position="top">
        <el-form-item label="考试时长">
          <el-input-number v-model="form.duration" :min="1" :max="240" />
        </el-form-item>
        <el-form-item label="试卷总分">
          <el-input-number v-model="form.totalScore" :min="1" />
          <span class="score-hint">当前题目合计 {{ questionTotal }} 分</span>
        </el-form-item>
        <el-form-item label="设置">
          <el-switch v-model="form.published" active-text="发布" inactive-text="草稿" />
          <el-switch v-model="form.randomize" active-text="随机题序" inactive-text="固定题序" />
        </el-form-item>
      </el-form>
    </div>

    <div class="question-toolbar">
      <h3>试题</h3>
      <div>
        <input ref="fileInput" class="hidden-input" type="file" accept=".json,.xlsx,.xls" @change="handleFileChange" />
        <el-button :icon="Upload" @click="fileInput?.click()">导入试题</el-button>
        <el-button :icon="Plus" type="primary" @click="addQuestion">添加试题</el-button>
      </div>
    </div>

    <div class="question-list">
      <article v-for="(question, index) in form.questions" :key="question.id" class="question-editor">
        <div class="question-editor-head">
          <strong>第 {{ index + 1 }} 题</strong>
          <el-button :icon="Delete" size="small" type="danger" @click="removeQuestion(index)">删除</el-button>
        </div>
        <el-form label-position="top">
          <el-form-item label="题型">
            <el-segmented v-model="question.type" :options="[{ label: '选择题', value: 'choice' }, { label: '判断题', value: 'judgement' }]" @change="normalizeQuestion(question)" />
          </el-form-item>
          <el-form-item label="题干">
            <el-input v-model="question.title" />
          </el-form-item>
          <template v-if="question.type === 'choice'">
            <el-form-item label="选项">
              <div class="option-list">
                <el-input v-for="(_, optionIndex) in question.options" :key="optionIndex" v-model="question.options[optionIndex]" :placeholder="`选项 ${optionIndex + 1}`" />
              </div>
            </el-form-item>
            <el-form-item label="正确答案">
              <el-select v-model="question.answer" filterable allow-create placeholder="请选择或输入答案">
                <el-option v-for="option in question.options.filter(Boolean)" :key="option" :label="option" :value="option" />
              </el-select>
            </el-form-item>
          </template>
          <template v-else>
            <el-form-item label="正确答案">
              <el-radio-group v-model="question.answer">
                <el-radio value="正确">正确</el-radio>
                <el-radio value="错误">错误</el-radio>
              </el-radio-group>
            </el-form-item>
          </template>
          <div class="question-meta">
            <el-form-item label="分值">
              <el-input-number v-model="question.score" :min="1" />
            </el-form-item>
            <el-form-item label="错题解析">
              <el-input v-model="question.explanation" />
            </el-form-item>
          </div>
        </el-form>
      </article>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存试卷</el-button>
    </template>
  </el-dialog>
</template>
