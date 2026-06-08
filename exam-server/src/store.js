const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "data", "db.json");

function readDb() {
  return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf-8");
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function publicExam(exam, includeQuestions = false) {
  const base = {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    duration: exam.duration,
    totalScore: exam.totalScore,
    published: exam.published,
    randomize: exam.randomize,
    questionCount: exam.questions.length,
    createdAt: exam.createdAt
  };

  if (!includeQuestions) return base;

  return {
    ...base,
    questions: exam.questions.map(({ answer, explanation, ...question }) => question)
  };
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

module.exports = {
  readDb,
  writeDb,
  uid,
  publicExam,
  shuffle
};
