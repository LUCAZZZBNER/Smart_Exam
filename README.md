# SmartExam 在线考试系统

这是“前端开发技术实践-作业2”第 5 题的实现版本，采用前后端分离结构。

- `exam-client`：Vue 3 + TypeScript + Pinia + Vue Router + Element Plus
- `exam-server`：Node.js + Express + JSON 文件存储

## 当前版本功能

- 三类角色：管理员、老师、学生
- 管理员：管理老师、班级、学生、试卷、成绩和重做申请
- 老师：管理自己的班级和学生，可以出题、编辑试卷、删除试卷、查看成绩、处理重做申请
- 学生：按自己的班级查看考试，参加考试，查看成绩，申请重做
- 班级关系：一个班级只属于一个老师，一个老师可以有多个班级，一个学生可以属于多个班级
- 考试归属：考试必须绑定到班级，学生只能看到自己班级下的考试
- 考试限制：学生完成某场考试后不能直接重复考试
- 重做流程：学生申请重做，老师或管理员审核通过后，学生才能再次考试
- 成绩统计：班级平均分按“同一学生同一考试的最后一次成绩”计算
- 考试能力：倒计时、自动提交、防切屏提醒、草稿保存、自动判分、错题解析
- 加分功能：JSON/Excel 导入试题、随机题序、PDF 成绩报告导出
- RESTful API：登录、用户、班级、试卷、提交、成绩、重做申请、导入

## 默认账号

```text
管理员：admin / admin123
老师：teacher / teacher123
学生：student / student123
```

默认数据包含：

```text
默认老师
默认班级
学生：张同学
考试：前端开发综合测验，10 题，总分 100
```

## 运行方式

后端：

```bash
cd exam-server
npm install
npm run dev
```

前端：

```bash
cd exam-client
npm install
npm run dev
```

默认地址：

- 前端：http://localhost:5173
- 后端：http://localhost:3001

WSL 下局域网访问时，前端已经使用 `--host 0.0.0.0` 启动。别人访问时通常使用 Windows 的局域网 IP，例如：

```text
http://192.168.x.x:5173
```

## 推荐测试流程

1. 使用 `teacher / teacher123` 登录。
2. 进入“试卷管理”，确认考试绑定到“默认班级”。
3. 新建或编辑试卷，选择所属班级，添加选择题或判断题。
4. 使用 `student / student123` 登录。
5. 在“我的班级考试”中按班级查看考试。
6. 完成考试并查看成绩。
7. 返回考试列表，此时不能直接再次考试，只能查看成绩或申请重做。
8. 学生提交重做申请。
9. 老师进入“成绩列表”，在“重做申请”中同意或拒绝。
10. 同意后，学生可以再次考试。
11. 老师查看成绩统计，班级平均分会按学生最后一次成绩计算。

## 试题导入格式

支持 `.json`、`.xlsx`、`.xls`。

字段支持英文或中文表头：

- `type` / `题型`：`choice`、`judgement`、`选择题`、`判断题`
- `title` / `题干`
- `options` / `选项`：多个选项用 `|` 分隔
- `answer` / `答案`
- `score` / `分值`
- `explanation` / `解析`

示例文件：

- [exam-server/samples/questions.json](exam-server/samples/questions.json)
- [exam-server/samples/questions.csv](exam-server/samples/questions.csv)

## REST API

基础接口：

- `POST /api/login`：登录
- `GET /api/user`：获取当前用户

学生考试：

- `GET /api/exams`：获取自己班级下的已发布考试
- `GET /api/exam/:id`：获取试卷，接口不会返回答案
- `POST /api/exam/submit`：提交答卷并自动判分
- `GET /api/submissions/:id`：查看单次考试结果
- `POST /api/exam/:id/redo-request`：申请重做

后台管理：

- `GET /api/admin/exams`：获取有权限的试卷列表
- `POST /api/admin/exams`：创建试卷
- `PUT /api/admin/exams/:id`：编辑试卷
- `DELETE /api/admin/exams/:id`：删除试卷
- `GET /api/admin/users`：获取用户列表
- `POST /api/admin/users`：创建老师或学生
- `DELETE /api/admin/users/:id`：删除用户
- `GET /api/admin/classes`：获取班级列表
- `POST /api/admin/classes`：创建班级
- `PUT /api/admin/classes/:id`：编辑班级
- `DELETE /api/admin/classes/:id`：删除班级
- `GET /api/admin/grades`：查看成绩、统计和重做申请
- `PATCH /api/admin/redo-requests/:id`：同意或拒绝重做申请
- `POST /api/admin/import`：导入 JSON/Excel 试题

## 数据文件

核心数据保存在：

```text
exam-server/src/data/db.json
```

包含：

- `users`：管理员、老师、学生
- `classes`：班级
- `exams`：试卷和题目
- `submissions`：考试提交记录
- `redoRequests`：重做申请

如果需要重置演示数据，可以恢复或编辑这个 JSON 文件，然后重启后端。
