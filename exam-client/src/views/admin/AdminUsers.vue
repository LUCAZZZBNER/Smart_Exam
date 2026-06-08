<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Delete, Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createClassApi,
  createUserApi,
  deleteClassApi,
  deleteUserApi,
  listClassesApi,
  listUsersApi
} from "../../api/exam";
import { useAuthStore } from "../../stores/auth";
import type { ClassInfo, Role, User } from "../../types/exam";

const auth = useAuthStore();
const loading = ref(false);
const saving = ref(false);
const users = ref<User[]>([]);
const classes = ref<ClassInfo[]>([]);
const userDialogVisible = ref(false);
const classDialogVisible = ref(false);

const userForm = reactive({
  username: "",
  password: "",
  name: "",
  role: "student" as Extract<Role, "teacher" | "student">,
  classIds: [] as string[]
});

const classForm = reactive({
  name: "",
  teacherId: ""
});

const isAdmin = computed(() => auth.user?.role === "admin");
const teachers = computed(() => users.value.filter((user) => user.role === "teacher"));
const students = computed(() => users.value.filter((user) => user.role === "student"));

async function load() {
  loading.value = true;
  try {
    const [nextUsers, nextClasses] = await Promise.all([listUsersApi(), listClassesApi()]);
    users.value = nextUsers;
    classes.value = nextClasses;
  } finally {
    loading.value = false;
  }
}

function openCreateUser(role: Extract<Role, "teacher" | "student">) {
  if (role === "teacher" && !isAdmin.value) {
    ElMessage.warning("只有管理员可以添加老师");
    return;
  }
  Object.assign(userForm, {
    username: "",
    password: "",
    name: "",
    role,
    classIds: role === "student" && classes.value[0] ? [classes.value[0].id] : []
  });
  userDialogVisible.value = true;
}

function openCreateClass() {
  Object.assign(classForm, {
    name: "",
    teacherId: isAdmin.value ? teachers.value[0]?.id || "" : auth.user?.id || ""
  });
  classDialogVisible.value = true;
}

async function saveUser() {
  if (!userForm.username.trim() || !userForm.password.trim() || !userForm.name.trim()) {
    ElMessage.warning("请补全用户名、姓名和密码");
    return;
  }
  if (userForm.role === "student" && !userForm.classIds.length) {
    ElMessage.warning("学生至少需要加入一个班级");
    return;
  }

  saving.value = true;
  try {
    await createUserApi({ ...userForm });
    ElMessage.success(userForm.role === "teacher" ? "老师已创建" : "学生已创建");
    userDialogVisible.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

async function saveClass() {
  if (!classForm.name.trim()) {
    ElMessage.warning("请填写班级名称");
    return;
  }
  if (isAdmin.value && !classForm.teacherId) {
    ElMessage.warning("请选择班级所属老师");
    return;
  }

  saving.value = true;
  try {
    await createClassApi({ ...classForm });
    ElMessage.success("班级已创建");
    classDialogVisible.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

async function removeUser(user: User) {
  await ElMessageBox.confirm(`确定删除「${user.name}」吗？相关成绩也会删除。`, "删除用户", { type: "warning" });
  await deleteUserApi(user.id);
  ElMessage.success("已删除");
  await load();
}

async function removeClass(item: ClassInfo) {
  await ElMessageBox.confirm(`确定删除班级「${item.name}」吗？`, "删除班级", { type: "warning" });
  await deleteClassApi(item.id);
  ElMessage.success("已删除");
  await load();
}

onMounted(load);
</script>

<template>
  <section class="panel">
    <div class="section-head">
      <div>
        <h2>用户与班级管理</h2>
        <p>管理员统一管理老师、班级和学生；老师可以维护自己的班级和学生。</p>
      </div>
      <div class="toolbar-actions">
        <el-button v-if="isAdmin" :icon="Plus" @click="openCreateUser('teacher')">添加老师</el-button>
        <el-button :icon="Plus" @click="openCreateClass">添加班级</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreateUser('student')">添加学生</el-button>
      </div>
    </div>

    <div class="metric-row">
      <div class="metric">
        <span>老师</span>
        <strong>{{ teachers.length }}</strong>
      </div>
      <div class="metric">
        <span>班级</span>
        <strong>{{ classes.length }}</strong>
      </div>
      <div class="metric">
        <span>学生</span>
        <strong>{{ students.length }}</strong>
      </div>
    </div>

    <el-tabs>
      <el-tab-pane label="老师">
        <el-table v-loading="loading" :data="teachers" stripe>
          <el-table-column prop="name" label="老师" min-width="120" />
          <el-table-column prop="username" label="用户名" min-width="130" />
          <el-table-column label="负责班级" min-width="220">
            <template #default="{ row }">
              {{ classes.filter((item) => item.teacherId === row.id).map((item) => item.name).join("、") || "暂无班级" }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="110">
            <template #default="{ row }">
              <el-button :icon="Delete" size="small" type="danger" @click="removeUser(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="班级">
        <el-table v-loading="loading" :data="classes" stripe>
          <el-table-column prop="name" label="班级" min-width="120" />
          <el-table-column prop="teacherName" label="所属老师" min-width="120" />
          <el-table-column prop="studentCount" label="学生数" width="100" />
          <el-table-column label="操作" width="110">
            <template #default="{ row }">
              <el-button :icon="Delete" size="small" type="danger" @click="removeClass(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="学生">
        <el-table v-loading="loading" :data="students" stripe>
          <el-table-column prop="name" label="学生" min-width="120" />
          <el-table-column prop="username" label="用户名" min-width="130" />
          <el-table-column label="所属班级" min-width="220">
            <template #default="{ row }">
              {{ row.classes?.map((item) => item.name).join("、") || "未分班" }}
            </template>
          </el-table-column>
          <el-table-column label="老师" min-width="160">
            <template #default="{ row }">
              {{ row.classes?.map((item) => classes.find((klass) => klass.id === item.id)?.teacherName).filter(Boolean).join("、") || "-" }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="110">
            <template #default="{ row }">
              <el-button :icon="Delete" size="small" type="danger" @click="removeUser(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </section>

  <el-dialog v-model="userDialogVisible" :title="userForm.role === 'teacher' ? '添加老师' : '添加学生'" width="min(560px, 94vw)">
    <el-form label-position="top">
      <el-form-item label="角色">
        <el-segmented
          v-model="userForm.role"
          :options="isAdmin ? [{ label: '学生', value: 'student' }, { label: '老师', value: 'teacher' }] : [{ label: '学生', value: 'student' }]"
        />
      </el-form-item>
      <el-form-item label="姓名">
        <el-input v-model="userForm.name" placeholder="例如：王老师 / 李同学" />
      </el-form-item>
      <el-form-item label="用户名">
        <el-input v-model="userForm.username" placeholder="登录账号，不能重复" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="userForm.password" type="password" show-password placeholder="登录密码" />
      </el-form-item>
      <el-form-item v-if="userForm.role === 'student'" label="所属班级">
        <el-select v-model="userForm.classIds" multiple filterable placeholder="学生可以属于多个班">
          <el-option
            v-for="item in classes"
            :key="item.id"
            :label="`${item.name} - ${item.teacherName}`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="userDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveUser">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="classDialogVisible" title="添加班级" width="min(520px, 94vw)">
    <el-form label-position="top">
      <el-form-item label="班级名称">
        <el-input v-model="classForm.name" placeholder="例如：高一 3 班" />
      </el-form-item>
      <el-form-item v-if="isAdmin" label="所属老师">
        <el-select v-model="classForm.teacherId" filterable placeholder="请选择老师">
          <el-option v-for="teacher in teachers" :key="teacher.id" :label="teacher.name" :value="teacher.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="classDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveClass">保存</el-button>
    </template>
  </el-dialog>
</template>
