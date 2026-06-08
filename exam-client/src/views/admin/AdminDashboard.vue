<script setup lang="ts">
import { computed } from "vue";
import AppShell from "../../components/AppShell.vue";
import { useAuthStore } from "../../stores/auth";

const auth = useAuthStore();

const nav = computed(() => {
  return [
    { label: "试卷管理", path: "/admin/exams" },
    { label: "用户管理", path: "/admin/users" },
    { label: "成绩列表", path: "/admin/grades" }
  ];
});
</script>

<template>
  <AppShell title="后台工作台" :nav="nav">
    <router-view />
  </AppShell>
</template>
