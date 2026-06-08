<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { listGradesApi } from "../../api/exam";
import type { Submission } from "../../types/exam";

const loading = ref(false);
const grades = ref<Submission[]>([]);

const average = computed(() => {
  if (!grades.value.length) return 0;
  return Math.round(grades.value.reduce((sum, item) => sum + item.score, 0) / grades.value.length);
});

async function load() {
  loading.value = true;
  try {
    grades.value = await listGradesApi();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="panel">
    <div class="metric-row">
      <div class="metric">
        <span>提交次数</span>
        <strong>{{ grades.length }}</strong>
      </div>
      <div class="metric">
        <span>平均得分</span>
        <strong>{{ average }}</strong>
      </div>
    </div>

    <el-table v-loading="loading" :data="grades" stripe>
      <el-table-column prop="userName" label="考生" min-width="110" />
      <el-table-column prop="examTitle" label="试卷" min-width="180" />
      <el-table-column label="成绩" min-width="110">
        <template #default="{ row }">{{ row.score }} / {{ row.totalScore }}</template>
      </el-table-column>
      <el-table-column prop="focusWarnings" label="切屏次数" min-width="100" />
      <el-table-column label="提交时间" min-width="190">
        <template #default="{ row }">{{ new Date(row.submittedAt).toLocaleString() }}</template>
      </el-table-column>
    </el-table>
  </section>
</template>
