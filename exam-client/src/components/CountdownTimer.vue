<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{ seconds: number }>();
const emit = defineEmits<{ timeout: [] }>();

const remain = ref(props.seconds);
let timer = 0;

const text = computed(() => {
  const minutes = Math.floor(remain.value / 60);
  const seconds = remain.value % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});

onMounted(() => {
  timer = window.setInterval(() => {
    remain.value -= 1;
    if (remain.value <= 0) {
      window.clearInterval(timer);
      emit("timeout");
    }
  }, 1000);
});

onBeforeUnmount(() => window.clearInterval(timer));
</script>

<template>
  <strong class="timer">{{ text }}</strong>
</template>
