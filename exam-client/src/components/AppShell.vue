<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const props = defineProps<{
  title: string;
  nav?: Array<{ label: string; path: string }>;
}>();

const router = useRouter();
const auth = useAuthStore();

function logout() {
  auth.logout();
  router.push("/login");
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">SmartExam</p>
        <h1>{{ props.title }}</h1>
      </div>
      <nav v-if="props.nav?.length" class="nav">
        <router-link v-for="item in props.nav" :key="item.path" :to="item.path">{{ item.label }}</router-link>
      </nav>
      <div class="profile">
        <span>{{ auth.user?.name }}</span>
        <el-button size="small" @click="logout">退出</el-button>
      </div>
    </header>
    <main class="content">
      <slot />
    </main>
  </div>
</template>
