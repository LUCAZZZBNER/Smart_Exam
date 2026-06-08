# SmartExam 在线考试系统

这是“前端开发技术实践-作业2”第 5 题的完整实现，采用前后端分离结构：

- `exam-client`：Vue 3 + TypeScript + Pinia + Vue Router + Element Plus
- `exam-server`：Node.js + Express + JSON 文件存储

## 功能覆盖

- 管理员端：创建、编辑、删除选择题和判断题
- 管理员端：设置试卷总分、考试时长、发布状态、题目随机排序
- 管理员端：查看考生成绩列表和切屏次数
- 考生端：登录后查看考试列表并开始考试
- 考生端：倒计时组件，到时自动提交
- 考生端：作答草稿保存到 `localStorage`
- 考生端：监听页面 `blur` 事件实现防切屏提醒
- 考生端：提交后自动判分，展示错题解析
- 加分项：JSON/Excel 批量导入试题
- 加分项：试题随机排序
- 加分项：PDF 考试报告导出
- 表单验证：使用 Zod
- RESTful API：登录、用户、试卷、提交、成绩、导入

## 演示账号

管理员：

```text
用户名：admin
密码：admin123
```

考生：

```text
用户名：student
密码：student123
```

## 运行方式

分别进入两个项目安装依赖并启动：

```bash
cd exam-server
npm install
npm run dev
```

```bash
cd exam-client
npm install
npm run dev
```

默认地址：

- 前端：http://localhost:5173
- 后端：http://localhost:3001

## 导入试题格式

支持 `.json`、`.xlsx`、`.xls`。字段支持英文或中文表头：

- `type` / `题型`：`choice`、`judgement`、`选择题`、`判断题`
- `title` / `题干`
- `options` / `选项`：多个选项用 `|` 分隔
- `answer` / `答案`
- `score` / `分值`
- `explanation` / `解析`

JSON 示例见 [exam-server/samples/questions.json](exam-server/samples/questions.json)。
CSV 示例见 [exam-server/samples/questions.csv](exam-server/samples/questions.csv)，可用 Excel 打开后另存为 `.xlsx` 上传。

## REST API

- `POST /api/login`：登录
- `GET /api/user`：获取当前用户
- `GET /api/exams`：考生获取考试列表
- `GET /api/exam/:id`：考生获取试卷，接口不会返回答案
- `POST /api/exam/submit`：提交答卷并自动批改
- `GET /api/submissions/:id`：查看单次考试结果
- `GET /api/admin/exams`：管理员获取试卷列表
- `POST /api/admin/exams`：管理员创建试卷
- `PUT /api/admin/exams/:id`：管理员编辑试卷
- `DELETE /api/admin/exams/:id`：管理员删除试卷
- `GET /api/admin/grades`：管理员查看成绩列表
- `POST /api/admin/import`：管理员导入 JSON/Excel 试题
