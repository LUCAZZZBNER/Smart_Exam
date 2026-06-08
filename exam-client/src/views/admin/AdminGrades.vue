<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { handleRedoRequestApi, listGradesApi } from "../../api/exam";
import type { GradeSummary, RedoRequest, Submission } from "../../types/exam";

const loading = ref(false);
const grades = ref<Submission[]>([]);
const summary = ref<GradeSummary[]>([]);
const redoRequests = ref<RedoRequest[]>([]);
const filters = reactive({
  teacher: "",
  className: "",
  student: ""
});

const filteredGrades = computed(() =>
  grades.value.filter((item) => {
    const teacherText = (item.teacherNames || []).join(" ");
    const classText = (item.classNames || []).join(" ");
    return (
      (!filters.teacher || teacherText.includes(filters.teacher)) &&
      (!filters.className || classText.includes(filters.className)) &&
      (!filters.student || item.userName.includes(filters.student))
    );
  })
);

const average = computed(() => {
  if (!filteredGrades.value.length) return 0;
  return Math.round(filteredGrades.value.reduce((sum, item) => sum + item.score, 0) / filteredGrades.value.length);
});

async function load() {
  loading.value = true;
  try {
    const data = await listGradesApi();
    grades.value = data.rows;
    summary.value = data.summary;
    redoRequests.value = data.redoRequests;
  } finally {
    loading.value = false;
  }
}

async function handleRedo(id: string, status: "approved" | "rejected") {
  await handleRedoRequestApi(id, status);
  ElMessage.success(status === "approved" ? "已同意重做" : "已拒绝重做");
  await load();
}

onMounted(load);
</script>

<template>
  <section class="panel">
    <div class="section-head">
      <div>
        <h2>成绩统计</h2>
        <p>按老师、班级、学生筛选成绩；班级平均分按每个学生最后一次作答计算。</p>
      </div>
    </div>

    <div class="filter-row">
      <el-input v-model="filters.teacher" clearable placeholder="按老师筛选" />
      <el-input v-model="filters.className" clearable placeholder="按班级筛选" />
      <el-input v-model="filters.student" clearable placeholder="搜索学生" />
    </div>

    <div class="metric-row">
      <div class="metric">
        <span>提交次数</span>
        <strong>{{ filteredGrades.length }}</strong>
      </div>
      <div class="metric">
        <span>当前筛选平均分</span>
        <strong>{{ average }}</strong>
      </div>
      <div class="metric">
        <span>统计分组</span>
        <strong>{{ summary.length }}</strong>
      </div>
    </div>

    <h3 class="compact-title">班级考试平均分</h3>
    <p class="muted-text">平均分只统计每个学生在同一班级、同一考试下的最后一次成绩。</p>
    <el-table v-loading="loading" :data="summary" stripe class="stacked-table">
      <el-table-column prop="className" label="班级" min-width="130" />
      <el-table-column prop="examTitle" label="考试" min-width="180" />
      <el-table-column prop="count" label="提交数" width="90" />
      <el-table-column prop="average" label="平均分" width="100" />
      <el-table-column prop="highest" label="最高分" width="100" />
      <el-table-column prop="lowest" label="最低分" width="100" />
    </el-table>

    <h3 class="compact-title">重做申请</h3>
    <el-table v-loading="loading" :data="redoRequests" stripe class="stacked-table">
      <el-table-column prop="studentName" label="学生" min-width="110" />
      <el-table-column label="班级" min-width="150">
        <template #default="{ row }">{{ row.classNames?.join("、") || "-" }}</template>
      </el-table-column>
      <el-table-column prop="examTitle" label="考试" min-width="180" />
      <el-table-column prop="reason" label="原因" min-width="160" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'pending' ? 'warning' : row.status === 'approved' ? 'success' : 'info'">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170">
        <template #default="{ row }">
          <el-button v-if="row.status === 'pending'" size="small" type="success" @click="handleRedo(row.id, 'approved')">同意</el-button>
          <el-button v-if="row.status === 'pending'" size="small" type="danger" @click="handleRedo(row.id, 'rejected')">拒绝</el-button>
        </template>
      </el-table-column>
    </el-table>

    <h3 class="compact-title">成绩明细</h3>
    <el-table v-loading="loading" :data="filteredGrades" stripe>
      <el-table-column prop="userName" label="学生" min-width="110" />
      <el-table-column label="班级" min-width="160">
        <template #default="{ row }">{{ row.classNames?.join("、") || "未分班" }}</template>
      </el-table-column>
      <el-table-column label="老师" min-width="140">
        <template #default="{ row }">{{ row.teacherNames?.join("、") || "-" }}</template>
      </el-table-column>
      <el-table-column prop="examTitle" label="考试" min-width="180" />
      <el-table-column label="成绩" min-width="130">
        <template #default="{ row }">{{ row.score }} / {{ row.totalScore }}（第 {{ row.attemptNo || 1 }} 次）</template>
      </el-table-column>
      <el-table-column prop="focusWarnings" label="切屏次数" min-width="100" />
      <el-table-column label="提交时间" min-width="190">
        <template #default="{ row }">{{ new Date(row.submittedAt).toLocaleString() }}</template>
      </el-table-column>
    </el-table>
  </section>
</template>
