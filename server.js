const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(bodyParser.json());
app.use(cors());

// Раздаём статику из /public
app.use(express.static(path.join(__dirname, "public")));

// ===== SIMPLE FILE-BASED "DB" =====
const DB_FILE = path.join(__dirname, "users.json");

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    // Инициализируем с пустыми массивами
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], tokens: {} }, null, 2));
  }
  const raw = fs.readFileSync(DB_FILE, "utf8");
  return JSON.parse(raw);
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function generateId(prefix) {
  return prefix + "_" + crypto.randomBytes(8).toString("hex");
}

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

// ===== AUTH MIDDLEWARE =====
function authMiddleware(req, res, next) {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Нет токена" });
  }
  const token = auth.slice(7);
  const db = loadDb();
  const userId = db.tokens[token];
  if (!userId) {
    return res.status(401).json({ error: "Неверный или просроченный токен" });
  }
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: "Пользователь не найден" });
  }
  req.user = user;
  req.db = db;
  req.token = token;
  next();
}

// ===== TELEGRAM AUTH =====
app.post("/api/auth/telegram", (req, res) => {
  const { telegramId, firstName, lastName, username } = req.body || {};
  if (!telegramId) {
    return res.status(400).json({ error: "Нет telegramId" });
  }

  const db = loadDb();
  let user = db.users.find(u => u.telegramId === String(telegramId));

  if (!user) {
    // Создаём нового пользователя
    user = {
      id: generateId("usr"),
      telegramId: String(telegramId),
      telegramUsername: username || null,
      telegramName: [firstName, lastName].filter(Boolean).join(" "),
      karma: 0,
      awareness: 0,
      quizCorrect: 0
    };
    db.users.push(user);
  }

  const token = generateToken();
  db.tokens[token] = user.id;
  saveDb(db);

  res.json({
    token,
    user: {
      id: user.id,
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername,
      telegramName: user.telegramName,
      karma: user.karma,
      awareness: user.awareness,
      quizCorrect: user.quizCorrect
    }
  });
});

// ===== GET CURRENT USER =====
app.get("/api/user/me", authMiddleware, (req, res) => {
  const user = req.user;
  res.json({
    id: user.id,
    telegramId: user.telegramId,
    telegramUsername: user.telegramUsername,
    telegramName: user.telegramName,
    karma: user.karma,
    awareness: user.awareness,
    quizCorrect: user.quizCorrect
  });
});

// ===== ACTIONS =====

// Кликер кармы
app.post("/api/actions/karma-click", authMiddleware, (req, res) => {
  const db = req.db;
  const user = db.users.find(u => u.id === req.user.id);
  user.karma += 1;
  saveDb(db);
  res.json({ karma: user.karma });
});

// Колесо осознанности
const WHEEL_OUTCOMES = [
  { type: "karma", amount: 5, label: "+5 кармы" },
  { type: "karma", amount: 10, label: "+10 кармы" },
  { type: "karma", amount: 25, label: "+25 кармы (серия внимания)" },
  { type: "pause", amount: 0, label: "Пауза: 3 осознанных вдоха" },
  { type: "awareness", amount: 1, label: "+1 токен осознанности" },
  { type: "awareness", amount: 2, label: "+2 токена осознанности (глубокое попадание)" },
  { type: "nothing", amount: 0, label: "Ничего. Отследи своё чувство от этого." },
  { type: "karma", amount: 3, label: "+3 кармы" }
];

app.post("/api/actions/wheel-spin", authMiddleware, (req, res) => {
  const db = req.db;
  const user = db.users.find(u => u.id === req.user.id);

  const outcome = WHEEL_OUTCOMES[Math.floor(Math.random() * WHEEL_OUTCOMES.length)];
  let message = "";
  if (outcome.type === "karma") {
    user.karma += outcome.amount;
    message = `Результат: ${outcome.label}`;
  } else if (outcome.type === "awareness") {
    user.awareness += outcome.amount;
    message = `Результат: ${outcome.label}`;
  } else if (outcome.type === "pause") {
    message = "Пауза. Сделай 3 мягких вдоха и выдоха, ничего не меняя.";
  } else {
    message = "На этот раз — пусто. Заметь реакцию, не оценивая её.";
  }

  saveDb(db);
  res.json({
    outcome,
    message,
    user: {
      karma: user.karma,
      awareness: user.awareness,
      quizCorrect: user.quizCorrect
    }
  });
});

// Верный ответ викторины
app.post("/api/actions/quiz-correct", authMiddleware, (req, res) => {
  const db = req.db;
  const user = db.users.find(u => u.id === req.user.id);
  const { awarenessReward = 1 } = req.body || {};

  user.quizCorrect += 1;
  user.awareness += Number(awarenessReward) || 1;

  saveDb(db);
  res.json({
    karma: user.karma,
    awareness: user.awareness,
    quizCorrect: user.quizCorrect
  });
});

// SPA fallback: любые неизвестные маршруты отдаём index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`HeartWins backend запущен на порту ${PORT}`);
});
