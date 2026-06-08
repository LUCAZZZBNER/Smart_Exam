const { readDb } = require("./store");

function encodeToken(user) {
  return Buffer.from(JSON.stringify({ id: user.id, role: user.role }), "utf-8").toString("base64url");
}

function decodeToken(token) {
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

function currentUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = decodeToken(token);
  if (!payload) return null;
  return readDb().users.find((user) => user.id === payload.id) || null;
}

function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ message: "请先登录" });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ message: "请先登录" });
  if (user.role !== "admin") return res.status(403).json({ message: "需要管理员权限" });
  req.user = user;
  next();
}

module.exports = {
  encodeToken,
  requireUser,
  requireAdmin
};
