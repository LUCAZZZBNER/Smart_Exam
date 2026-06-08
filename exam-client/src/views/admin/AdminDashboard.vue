<template>
  <AppShell
    title="管理员工作台"
    :nav="[
      { label: '试卷管理', path: '/admin/exams' },
      { label: '成绩列表', path: '/admin/grades' }
    ]"
  >
    <router-view />
  </AppShell>
</template>

<script setup lang="ts">
import AppShell from "../../components/AppShell.vue";
</script>
