const express = require("express");
const cors = require("cors");
const multer = require("multer");
const xlsx = require("xlsx");
const { encodeToken, requireUser, requireAdmin } = require("./auth");
const { readDb, writeDb, uid, publicExam, shuffle } = require("./store");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

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

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const db = readDb();
  const user = db.users.find((item) => item.username === username && item.password === password);
  if (!user) return res.status(401).json({ message: "用户名或密码错误" });

  res.json({
    token: encodeToken(user),
    user: { id: user.id, username: user.username, name: user.name, role: user.role }
  });
});

app.get("/api/user", requireUser, (req, res) => {
  const { id, username, name, role } = req.user;
  res.json({ id, username, name, role });
});

app.get("/api/exams", requireUser, (req, res) => {
  const db = readDb();
  res.json(db.exams.filter((exam) => exam.published).map((exam) => publicExam(exam)));
});

app.get("/api/exam/:id", requireUser, (req, res) => {
  const db = readDb();
  const exam = db.exams.find((item) => item.id === req.params.id && item.published);
  if (!exam) return res.status(404).json({ message: "试卷不存在" });

  const view = publicExam(exam, true);
  view.questions = exam.randomize ? shuffle(view.questions) : view.questions;
  res.json(view);
});

app.post("/api/exam/submit", requireUser, (req, res) => {
  const { examId, answers = {}, startedAt, focusWarnings = 0 } = req.body;
  const db = readDb();
  const exam = db.exams.find((item) => item.id === examId);
  if (!exam) return res.status(404).json({ message: "试卷不存在" });

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
    answers,
    score,
    totalScore: exam.totalScore,
    focusWarnings: Number(focusWarnings || 0),
    startedAt: startedAt || null,
    submittedAt: new Date().toISOString(),
    details
  };

  db.submissions.unshift(submission);
  writeDb(db);
  res.json(submission);
});

app.get("/api/submissions/:id", requireUser, (req, res) => {
  const submission = readDb().submissions.find((item) => item.id === req.params.id);
  if (!submission) return res.status(404).json({ message: "考试结果不存在" });
  if (req.user.role !== "admin" && submission.userId !== req.user.id) {
    return res.status(403).json({ message: "不能查看他人的考试结果" });
  }
  res.json(submission);
});

app.get("/api/admin/exams", requireAdmin, (req, res) => {
  res.json(readDb().exams);
});

app.post("/api/admin/exams", requireAdmin, (req, res) => {
  const message = validateExam(req.body);
  if (message) return res.status(400).json({ message });

  const db = readDb();
  const exam = {
    id: uid("exam"),
    title: String(req.body.title).trim(),
    description: String(req.body.description || "").trim(),
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

app.put("/api/admin/exams/:id", requireAdmin, (req, res) => {
  const message = validateExam(req.body);
  if (message) return res.status(400).json({ message });

  const db = readDb();
  const index = db.exams.findIndex((exam) => exam.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "试卷不存在" });

  db.exams[index] = {
    ...db.exams[index],
    title: String(req.body.title).trim(),
    description: String(req.body.description || "").trim(),
    duration: Number(req.body.duration),
    totalScore: Number(req.body.totalScore),
    published: Boolean(req.body.published),
    randomize: Boolean(req.body.randomize),
    questions: req.body.questions.map(normalizeQuestion)
  };
  writeDb(db);
  res.json(db.exams[index]);
});

app.delete("/api/admin/exams/:id", requireAdmin, (req, res) => {
  const db = readDb();
  db.exams = db.exams.filter((exam) => exam.id !== req.params.id);
  db.submissions = db.submissions.filter((submission) => submission.examId !== req.params.id);
  writeDb(db);
  res.status(204).end();
});

app.get("/api/admin/grades", requireAdmin, (req, res) => {
  res.json(readDb().submissions);
});

app.post("/api/admin/import", requireAdmin, upload.single("file"), (req, res) => {
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
