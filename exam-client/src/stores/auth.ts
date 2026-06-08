import { defineStore } from "pinia";
import { currentUserApi, loginApi } from "../api/exam";
import type { User } from "../types/exam";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: localStorage.getItem("smart-exam-token") || "",
    user: null as User | null,
    ready: false
  }),
  actions: {
    async login(username: string, password: string) {
      const { token, user } = await loginApi({ username, password });
      this.token = token;
      this.user = user;
      localStorage.setItem("smart-exam-token", token);
      localStorage.setItem("smart-exam-user", JSON.stringify(user));
    },
    async hydrate() {
      if (!this.token) {
        this.ready = true;
        return;
      }
      try {
        this.user = await currentUserApi();
      } catch {
        this.logout();
      } finally {
        this.ready = true;
      }
    },
    logout() {
      this.token = "";
      this.user = null;
      localStorage.removeItem("smart-exam-token");
      localStorage.removeItem("smart-exam-user");
    }
  }
});
