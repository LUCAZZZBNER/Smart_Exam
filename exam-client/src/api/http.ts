import axios from "axios";
import { ElMessage } from "element-plus";

export const http = axios.create({
  baseURL: "/api",
  timeout: 10000
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("smart-exam-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || "请求失败，请稍后重试";
    ElMessage.error(message);
    return Promise.reject(error);
  }
);
