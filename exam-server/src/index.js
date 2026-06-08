const express = require("express");
const cors = require("cors");
const multer = require("multer");
const xlsx = require("xlsx");
const { encodeToken, requireUser, requireStaff } = require("./auth");
const { readDb, writeDb, uid, publicExam, shuffle } = require("./store");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function ensureOrgShape() {
  const db = readDb();
  let changed = false;
  db.classes = Array.isArray(db.classes) ? db.classes : [];
  db.redoRequests = Array.isArray(db.redoRequests) ? db.redoRequests : [];

  for (const exam of db.exams) {
    if (!Array.isArray(exam.classIds) || !exam.classIds.length) {
      exam.classIds = db.classes[0] ? [db.classes[0].id] : [];
      changed = true;
    }
  }

  for (const student of db.users.filter((user) => user.role === "student")) {
    student.classIds = Array.isArray(student.classIds) ? student.classIds : [];
    if (!student.classIds.length && db.classes[0]) {
      student.classIds = [db.classes[0].id];
      changed = true;
    }
  }

  for (const submission of db.submissions) {
    if (!Array.isArray(submission.classIds)) {
      const student = db.users.find((user) => user.id === submission.userId);
      const exam = db.exams.find((item) => item.id === submission.examId);
      submission.classIds = intersectIds(student?.classIds || [], exam?.classIds || []);
      if (!submission.classIds.length) submission.classIds = student?.classIds || exam?.classIds || [];
      changed = true;
    }
    if (!submission.attemptNo) {
      const sameBefore = db.submissions.filter(
        (item) => item.userId === submission.userId && item.examId === submission.examId && item.submittedAt <= submission.submittedAt
      );
      submission.attemptNo = sameBefore.length || 1;
      changed = true;
    }
  }

  if (changed) writeDb(db);
}

function normalizeQuestion(question, index) {
  const type = question.type === "judgement" || question.type === "判断题" ? "judgement" : "choice";
  const options = Array.isArray(question.options)
    ? question.options
    : String(question.options || "")
        .split(/[|,，]/)
        .map((item) => item.trim())
        .filter(Boolean);

  return {
    id: question.id || uid(`q${index + 1}`),
    type,
    title: String(question.title || question.question || "").trim(),
    options: type === "judgement" ? ["正确", "错误"] : options,
    answer: String(question.answer || "").trim(),
    score: Number(question.score || 5),
    explanation: String(question.explanation || "暂无解析").trim()
  };
}

function validateExam(payload) {
  const questions = Array.isArray(payload.questions) ? payload.questions.map(normalizeQuestion) : [];
  if (!payload.title || !String(payload.title).trim()) return "试卷标题不能为空";
  if (!Array.isArray(payload.classIds) || !payload.classIds.length) return "请选择考试所属班级";
  if (!Number(payload.duration) || Number(payload.duration) <= 0) return "考试时长必须大于 0";
  if (!Number(payload.totalScore) || Number(payload.totalScore) <= 0) return "试卷总分必须大于 0";
  if (!questions.length) return "至少需要一道试题";
  if (questions.some((q) => !q.title || !q.answer || !q.score)) return "试题题干、答案和分值不能为空";
  if (questions.some((q) => q.type === "choice" && q.options.length < 2)) return "选择题至少需要两个选项";
  return "";
}

function sameAnswer(userAnswer, answer) {
  return String(userAnswer ?? "").trim() === String(answer ?? "").trim();
}

function intersectIds(left = [], right = []) {
  const rightSet = new Set(right);
  return left.filter((id) => rightSet.has(id));
}

function latestBySubmittedAt(items) {
  return [...items].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0] || null;
}

function teacherById(db, teacherId) {
  return db.users.find((user) => user.id === teacherId && user.role === "teacher") || null;
}

function classById(db, classId) {
  return db.classes.find((item) => item.id === classId) || null;
}

function examClasses(db, exam) {
  return (exam.classIds || []).map((id) => classById(db, id)).filter(Boolean);
}

function studentClasses(db, student) {
  return (student.classIds || []).map((id) => classById(db, id)).filter(Boolean);
}

function sanitizeUser(user, db) {
  const classes = user.role === "student" ? studentClasses(db, user) : [];
  const teacher = user.role === "teacher" ? null : teacherById(db, classes[0]?.teacherId);
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    classIds: user.classIds || [],
    classes: classes.map((item) => ({ id: item.id, name: item.name, teacherId: item.teacherId })),
    teacherId: user.role === "teacher" ? user.id : teacher?.id || "",
    teacherName: user.role === "teacher" ? user.name : teacher?.name || "",
    adminId: user.adminId || "",
    createdAt: user.createdAt || ""
  };
}

function sanitizeClass(item, db) {
  const teacher = teacherById(db, item.teacherId);
  const studentCount = db.users.filter((user) => user.role === "student" && (user.classIds || []).includes(item.id)).length;
  return {
    id: item.id,
    name: item.name,
    teacherId: item.teacherId,
    teacherName: teacher?.name || "",
    studentCount,
    createdAt: item.createdAt || ""
  };
}

function staffClassIds(db, user) {
  if (user.role === "admin") return db.classes.map((item) => item.id);
  if (user.role === "teacher") return db.classes.filter((item) => item.teacherId === user.id).map((item) => item.id);
  return [];
}

function visibleClasses(db, user) {
  if (user.role === "admin") return db.classes;
  if (user.role === "teacher") return db.classes.filter((item) => item.teacherId === user.id);
  return [];
}

function visibleUsers(db, user) {
  if (user.role === "admin") return db.users;
  if (user.role === "teacher") {
    const classIds = new Set(staffClassIds(db, user));
    return db.users.filter(
      (item) => item.id === user.id || (item.role === "student" && (item.classIds || []).some((id) => classIds.has(id)))
    );
  }
  return [user];
}

function canSeeStudent(db, viewer, student) {
  if (viewer.role === "admin") return true;
  if (viewer.role !== "teacher") return viewer.id === student.id;
  const classIds = new Set(staffClassIds(db, viewer));
  return (student.classIds || []).some((id) => classIds.has(id));
}

function canAccessExam(db, user, exam) {
  if (user.role === "admin") return true;
  if (user.role === "teacher") return intersectIds(staffClassIds(db, user), exam.classIds || []).length > 0;
  return intersectIds(user.classIds || [], exam.classIds || []).length > 0;
}

function pendingRedo(db, userId, examId) {
  return db.redoRequests.find((item) => item.userId === userId && item.examId === examId && item.status === "pending") || null;
}

function approvedRedo(db, userId, examId) {
  return db.redoRequests.find((item) => item.userId === userId && item.examId === examId && item.status === "approved") || null;
}

function studentExamStatus(db, student, exam) {
  const submissions = db.submissions.filter((item) => item.userId === student.id && item.examId === exam.id);
  const latest = latestBySubmittedAt(submissions);
  const pending = pendingRedo(db, student.id, exam.id);
  const approved = approvedRedo(db, student.id, exam.id);

  if (!latest) return { status: "available", latestSubmissionId: "", redoRequestStatus: "" };
  if (approved) return { status: "redo_approved", latestSubmissionId: latest.id, redoRequestStatus: "approved" };
  if (pending) return { status: "completed", latestSubmissionId: latest.id, redoRequestStatus: "pending" };
  return { status: "completed", latestSubmissionId: latest.id, redoRequestStatus: "" };
}

function publicExamWithMeta(db, exam, user) {
  const base = publicExam(exam);
  const classes = examClasses(db, exam);
  const meta = {
    ...base,
    classIds: classes.map((item) => item.id),
    classNames: classes.map((item) => item.name),
    classes: classes.map((item) => sanitizeClass(item, db))
  };

  if (user?.role === "student") return { ...meta, ...studentExamStatus(db, user, exam) };
  return meta;
}

function enrichSubmission(db, submission) {
  const classes = (submission.classIds || []).map((id) => classById(db, id)).filter(Boolean);
  const teachers = classes.map((item) => teacherById(db, item.teacherId)).filter(Boolean);
  return {
    ...submission,
    classIds: classes.map((item) => item.id),
    classNames: classes.map((item) => item.name),
    teacherIds: teachers.map((item) => item.id),
    teacherNames: teachers.map((item) => item.name)
  };
}

function visibleSubmissions(db, user) {
  if (user.role === "admin") return db.submissions.map((item) => enrichSubmission(db, item));
  if (user.role === "teacher") {
    const classIds = new Set(staffClassIds(db, user));
    return db.submissions
      .filter((item) => (item.classIds || []).some((id) => classIds.has(id)))
      .map((item) => enrichSubmission(db, item));
  }
  return db.submissions.filter((item) => item.userId === user.id).map((item) => enrichSubmission(db, item));
}

function latestVisibleSubmissions(db, user) {
  const latestMap = new Map();
  for (const row of visibleSubmissions(db, user)) {
    const classIds = row.classIds.length ? row.classIds : ["unassigned"];
    for (const classId of classIds) {
      const key = `${classId}::${row.examId}::${row.userId}`;
      const current = latestMap.get(key);
      if (!current || new Date(row.submittedAt) > new Date(current.submittedAt)) latestMap.set(key, { ...row, classIds: [classId] });
    }
  }
  return [...latestMap.values()];
}

function gradeSummary(db, user) {
  const rows = latestVisibleSubmissions(db, user);
  const groups = new Map();

  for (const row of rows) {
    const classId = row.classIds[0] || "unassigned";
    const klass = classById(db, classId);
    const key = `${classId}::${row.examId}`;
    const current =
      groups.get(key) ||
      {
        classId,
        className: klass?.name || "未分班",
        examId: row.examId,
        examTitle: row.examTitle,
        count: 0,
        average: 0,
        highest: 0,
        lowest: 0
      };
    current.count += 1;
    current.average += Number(row.score || 0);
    current.highest = current.count === 1 ? row.score : Math.max(current.highest, row.score);
    current.lowest = current.count === 1 ? row.score : Math.min(current.lowest, row.score);
    groups.set(key, current);
  }

  return [...groups.values()].map((item) => ({
    ...item,
    average: item.count ? Math.round(item.average / item.count) : 0
  }));
}

function visibleRedoRequests(db, user) {
  const classIds = new Set(staffClassIds(db, user));
  return db.redoRequests
    .filter((request) => user.role === "admin" || (request.classIds || []).some((id) => classIds.has(id)))
    .map((request) => {
      const student = db.users.find((item) => item.id === request.userId);
      const exam = db.exams.find((item) => item.id === request.examId);
      const classes = (request.classIds || []).map((id) => classById(db, id)).filter(Boolean);
      return {
        ...request,
        studentName: student?.name || "",
        examTitle: exam?.title || "",
        classNames: classes.map((item) => item.name)
      };
    });
}

ensureOrgShape();

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const db = readDb();
  const user = db.users.find((item) => item.username === username && item.password === password);
  if (!user) return res.status(401).json({ message: "用户名或密码错误" });

  res.json({
    token: encodeToken(user),
    user: sanitizeUser(user, db)
  });
});

app.get("/api/user", requireUser, (req, res) => {
  const db = readDb();
  res.json(sanitizeUser(req.user, db));
});

app.get("/api/exams", requireUser, (req, res) => {
  const db = readDb();
  const exams = db.exams
    .filter((exam) => exam.published && canAccessExam(db, req.user, exam))
    .map((exam) => publicExamWithMeta(db, exam, req.user));
  res.json(exams);
});

app.get("/api/exam/:id", requireUser, (req, res) => {
  const db = readDb();
  const exam = db.exams.find((item) => item.id === req.params.id && item.published);
  if (!exam) return res.status(404).json({ message: "试卷不存在" });
  if (!canAccessExam(db, req.user, exam)) return res.status(403).json({ message: "不能参加不属于自己班级的考试" });

  if (req.user.role === "student") {
    const status = studentExamStatus(db, req.user, exam);
    if (status.status === "completed") return res.status(403).json({ message: "该考试已完成，不能重复考试，可申请重做" });
  }

  const view = publicExam(exam, true);
  view.classIds = exam.classIds || [];
  view.classNames = examClasses(db, exam).map((item) => item.name);
  view.questions = exam.randomize ? shuffle(view.questions) : view.questions;
  res.json(view);
});

app.post("/api/exam/:id/redo-request", requireUser, (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ message: "只有学生可以申请重做" });
  const db = readDb();
  const exam = db.exams.find((item) => item.id === req.params.id);
  if (!exam) return res.status(404).json({ message: "试卷不存在" });
  if (!canAccessExam(db, req.user, exam)) return res.status(403).json({ message: "不能申请不属于自己班级的考试" });

  const latest = latestBySubmittedAt(db.submissions.filter((item) => item.userId === req.user.id && item.examId === exam.id));
  if (!latest) return res.status(400).json({ message: "未参加过考试，不能申请重做" });
  if (pendingRedo(db, req.user.id, exam.id)) return res.status(400).json({ message: "已有待处理的重做申请" });
  if (approvedRedo(db, req.user.id, exam.id)) return res.status(400).json({ message: "重做申请已通过，请直接开始考试" });

  const request = {
    id: uid("redo"),
    userId: req.user.id,
    examId: exam.id,
    classIds: latest.classIds || intersectIds(req.user.classIds || [], exam.classIds || []),
    reason: String(req.body.reason || "").trim(),
    status: "pending",
    createdAt: new Date().toISOString()
  };
  db.redoRequests.unshift(request);
  writeDb(db);
  res.status(201).json(request);
});

app.post("/api/exam/submit", requireUser, (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ message: "只有学生可以提交考试" });
  const { examId, answers = {}, startedAt, focusWarnings = 0 } = req.body;
  const db = readDb();
  const exam = db.exams.find((item) => item.id === examId);
  if (!exam) return res.status(404).json({ message: "试卷不存在" });
  if (!canAccessExam(db, req.user, exam)) return res.status(403).json({ message: "不能提交不属于自己班级的考试" });

  const previous = db.submissions.filter((item) => item.userId === req.user.id && item.examId === exam.id);
  const approved = approvedRedo(db, req.user.id, exam.id);
  if (previous.length && !approved) return res.status(403).json({ message: "该考试已完成，不能重复考试，可申请重做" });

  let score = 0;
  const details = exam.questions.map((question) => {
    const userAnswer = answers[question.id] || "";
    const correct = sameAnswer(userAnswer, question.answer);
    if (correct) score += Number(question.score);
    return {
      questionId: question.id,
      title: question.title,
      type: question.type,
      options: question.options,
      userAnswer,
      answer: question.answer,
      correct,
      score: correct ? Number(question.score) : 0,
      questionScore: Number(question.score),
      explanation: question.explanation
    };
  });

  const submission = {
    id: uid("submission"),
    examId,
    examTitle: exam.title,
    userId: req.user.id,
    userName: req.user.name,
    classIds: intersectIds(req.user.classIds || [], exam.classIds || []),
    attemptNo: previous.length + 1,
    answers,
    score,
    totalScore: exam.totalScore,
    focusWarnings: Number(focusWarnings || 0),
    startedAt: startedAt || null,
    submittedAt: new Date().toISOString(),
    details
  };

  if (approved) approved.status = "used";
  db.submissions.unshift(submission);
  writeDb(db);
  res.json(enrichSubmission(db, submission));
});

app.get("/api/submissions/:id", requireUser, (req, res) => {
  const db = readDb();
  const submission = db.submissions.find((item) => item.id === req.params.id);
  if (!submission) return res.status(404).json({ message: "考试结果不存在" });
  const student = db.users.find((user) => user.id === submission.userId);
  if (!student || !canSeeStudent(db, req.user, student)) return res.status(403).json({ message: "不能查看该考试结果" });
  res.json(enrichSubmission(db, submission));
});

app.get("/api/admin/exams", requireStaff, (req, res) => {
  const db = readDb();
  res.json(db.exams.filter((exam) => canAccessExam(db, req.user, exam)).map((exam) => ({ ...exam, ...publicExamWithMeta(db, exam, req.user) })));
});

app.post("/api/admin/exams", requireStaff, (req, res) => {
  const message = validateExam(req.body);
  if (message) return res.status(400).json({ message });

  const db = readDb();
  const allowedClassIds = new Set(staffClassIds(db, req.user));
  const classIds = req.body.classIds.filter((id) => allowedClassIds.has(id));
  if (!classIds.length) return res.status(403).json({ message: "只能给自己有权限的班级创建考试" });

  const exam = {
    id: uid("exam"),
    title: String(req.body.title).trim(),
    description: String(req.body.description || "").trim(),
    classIds,
    duration: Number(req.body.duration),
    totalScore: Number(req.body.totalScore),
    published: Boolean(req.body.published),
    randomize: Boolean(req.body.randomize),
    createdAt: new Date().toISOString(),
    questions: req.body.questions.map(normalizeQuestion)
  };
  db.exams.unshift(exam);
  writeDb(db);
  res.status(201).json(exam);
});

app.put("/api/admin/exams/:id", requireStaff, (req, res) => {
  const message = validateExam(req.body);
  if (message) return res.status(400).json({ message });

  const db = readDb();
  const index = db.exams.findIndex((exam) => exam.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "试卷不存在" });
  if (!canAccessExam(db, req.user, db.exams[index])) return res.status(403).json({ message: "不能编辑无权限班级的考试" });

  const allowedClassIds = new Set(staffClassIds(db, req.user));
  const classIds = req.body.classIds.filter((id) => allowedClassIds.has(id));
  if (!classIds.length) return res.status(403).json({ message: "只能选择自己有权限的班级" });

  db.exams[index] = {
    ...db.exams[index],
    title: String(req.body.title).trim(),
    description: String(req.body.description || "").trim(),
    classIds,
    duration: Number(req.body.duration),
    totalScore: Number(req.body.totalScore),
    published: Boolean(req.body.published),
    randomize: Boolean(req.body.randomize),
    questions: req.body.questions.map(normalizeQuestion)
  };
  writeDb(db);
  res.json(db.exams[index]);
});

app.delete("/api/admin/exams/:id", requireStaff, (req, res) => {
  const db = readDb();
  const exam = db.exams.find((item) => item.id === req.params.id);
  if (!exam) return res.status(404).json({ message: "试卷不存在" });
  if (!canAccessExam(db, req.user, exam)) return res.status(403).json({ message: "不能删除无权限班级的考试" });
  db.exams = db.exams.filter((item) => item.id !== req.params.id);
  db.submissions = db.submissions.filter((submission) => submission.examId !== req.params.id);
  db.redoRequests = db.redoRequests.filter((request) => request.examId !== req.params.id);
  writeDb(db);
  res.status(204).end();
});

app.get("/api/admin/users", requireStaff, (req, res) => {
  const db = readDb();
  res.json(visibleUsers(db, req.user).map((user) => sanitizeUser(user, db)));
});

app.post("/api/admin/users", requireStaff, (req, res) => {
  const { username, password, name, role, classIds = [] } = req.body;
  const db = readDb();

  if (!username || !password || !name) return res.status(400).json({ message: "用户名、姓名和密码不能为空" });
  if (!["teacher", "student"].includes(role)) return res.status(400).json({ message: "只能添加老师或学生" });
  if (role === "teacher" && req.user.role !== "admin") return res.status(403).json({ message: "只有管理员可以添加老师" });
  if (db.users.some((user) => user.username === username)) return res.status(400).json({ message: "用户名已存在" });

  const visibleClassIds = new Set(staffClassIds(db, req.user));
  const nextClassIds = Array.isArray(classIds) ? classIds : [];
  if (role === "student") {
    if (!nextClassIds.length) return res.status(400).json({ message: "学生至少需要加入一个班级" });
    if (req.user.role === "teacher" && nextClassIds.some((id) => !visibleClassIds.has(id))) {
      return res.status(403).json({ message: "老师只能把学生加入自己的班级" });
    }
  }

  const user = {
    id: uid(role),
    username: String(username).trim(),
    password: String(password),
    name: String(name).trim(),
    role,
    createdAt: new Date().toISOString()
  };

  if (role === "teacher") user.adminId = "u-admin";
  if (role === "student") user.classIds = nextClassIds;

  db.users.push(user);
  writeDb(db);
  res.status(201).json(sanitizeUser(user, db));
});

app.delete("/api/admin/users/:id", requireStaff, (req, res) => {
  const db = readDb();
  const target = db.users.find((user) => user.id === req.params.id);
  if (!target) return res.status(404).json({ message: "用户不存在" });
  if (target.id === req.user.id) return res.status(400).json({ message: "不能删除当前登录账号" });
  if (target.role === "admin") return res.status(400).json({ message: "不能删除管理员" });
  if (target.role === "teacher" && req.user.role !== "admin") return res.status(403).json({ message: "只有管理员可以删除老师" });
  if (target.role === "teacher" && db.classes.some((item) => item.teacherId === target.id)) {
    return res.status(400).json({ message: "该老师名下还有班级，不能删除" });
  }
  if (req.user.role === "teacher" && (!target || !canSeeStudent(db, req.user, target))) {
    return res.status(403).json({ message: "只能删除自己班级的学生" });
  }

  db.users = db.users.filter((user) => user.id !== target.id);
  db.submissions = db.submissions.filter((submission) => submission.userId !== target.id);
  db.redoRequests = db.redoRequests.filter((request) => request.userId !== target.id);
  writeDb(db);
  res.status(204).end();
});

app.get("/api/admin/classes", requireStaff, (req, res) => {
  const db = readDb();
  res.json(visibleClasses(db, req.user).map((item) => sanitizeClass(item, db)));
});

app.post("/api/admin/classes", requireStaff, (req, res) => {
  const { name, teacherId } = req.body;
  const db = readDb();
  if (!name || !String(name).trim()) return res.status(400).json({ message: "班级名称不能为空" });

  const ownerId = req.user.role === "admin" ? teacherId : req.user.id;
  const teacher = teacherById(db, ownerId);
  if (!teacher) return res.status(400).json({ message: "请选择班级所属老师" });
  if (req.user.role === "teacher" && ownerId !== req.user.id) {
    return res.status(403).json({ message: "老师只能创建自己的班级" });
  }

  const item = {
    id: uid("class"),
    name: String(name).trim(),
    teacherId: ownerId,
    createdAt: new Date().toISOString()
  };
  db.classes.push(item);
  writeDb(db);
  res.status(201).json(sanitizeClass(item, db));
});

app.put("/api/admin/classes/:id", requireStaff, (req, res) => {
  const { name, teacherId, studentIds } = req.body;
  const db = readDb();
  const item = db.classes.find((klass) => klass.id === req.params.id);
  if (!item) return res.status(404).json({ message: "班级不存在" });
  if (req.user.role === "teacher" && item.teacherId !== req.user.id) {
    return res.status(403).json({ message: "只能修改自己的班级" });
  }

  if (name) item.name = String(name).trim();
  if (req.user.role === "admin" && teacherId) {
    if (!teacherById(db, teacherId)) return res.status(400).json({ message: "老师不存在" });
    item.teacherId = teacherId;
  }

  if (Array.isArray(studentIds)) {
    for (const student of db.users.filter((user) => user.role === "student")) {
      const next = new Set(student.classIds || []);
      if (studentIds.includes(student.id)) next.add(item.id);
      else next.delete(item.id);
      student.classIds = [...next];
    }
  }

  writeDb(db);
  res.json(sanitizeClass(item, db));
});

app.delete("/api/admin/classes/:id", requireStaff, (req, res) => {
  const db = readDb();
  const item = db.classes.find((klass) => klass.id === req.params.id);
  if (!item) return res.status(404).json({ message: "班级不存在" });
  if (req.user.role === "teacher" && item.teacherId !== req.user.id) {
    return res.status(403).json({ message: "只能删除自己的班级" });
  }
  if (db.users.some((user) => user.role === "student" && (user.classIds || []).includes(item.id))) {
    return res.status(400).json({ message: "班级里还有学生，不能删除" });
  }

  db.classes = db.classes.filter((klass) => klass.id !== item.id);
  writeDb(db);
  res.status(204).end();
});

app.get("/api/admin/grades", requireStaff, (req, res) => {
  const db = readDb();
  res.json({
    rows: visibleSubmissions(db, req.user),
    summary: gradeSummary(db, req.user),
    redoRequests: visibleRedoRequests(db, req.user)
  });
});

app.patch("/api/admin/redo-requests/:id", requireStaff, (req, res) => {
  const db = readDb();
  const request = db.redoRequests.find((item) => item.id === req.params.id);
  if (!request) return res.status(404).json({ message: "重做申请不存在" });
  if (req.user.role === "teacher") {
    const classIds = new Set(staffClassIds(db, req.user));
    if (!(request.classIds || []).some((id) => classIds.has(id))) return res.status(403).json({ message: "不能处理其他班级的申请" });
  }
  if (!["approved", "rejected"].includes(req.body.status)) return res.status(400).json({ message: "状态不正确" });
  request.status = req.body.status;
  request.handledAt = new Date().toISOString();
  request.handlerId = req.user.id;
  writeDb(db);
  res.json(request);
});

app.post("/api/admin/import", requireStaff, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "请上传 JSON 或 Excel 文件" });

  let rows = [];
  const originalName = req.file.originalname.toLowerCase();
  if (originalName.endsWith(".json")) {
    rows = JSON.parse(req.file.buffer.toString("utf-8"));
  } else {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  }

  if (!Array.isArray(rows)) return res.status(400).json({ message: "文件内容必须是数组或表格数据" });
  const questions = rows.map((row, index) =>
    normalizeQuestion(
      {
        type: row.type || row.题型,
        title: row.title || row.题干,
        options: row.options || row.选项,
        answer: row.answer || row.答案,
        score: row.score || row.分值,
        explanation: row.explanation || row.解析
      },
      index
    )
  );

  res.json({ questions });
});

app.listen(port, () => {
  console.log(`SmartExam API running at http://localhost:${port}`);
});
