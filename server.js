const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIG / ENV =====
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

// Настройки SMTP берём из переменных окружения Render / .env
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "no-reply@example.com";

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
  console.log("SMTP transporter initialized");
} else {
  console.warn("SMTP not fully configured; email verification will NOT be sent.");
}

// ===== MIDDLEWARE =====
app.use(bodyParser.json());
app.use(cors());

// Раздаём статику из /public
app.use(express.static(path.join(__dirname, "public")));

// ===== SIMPLE FILE-BASED "DB" =====
const DB_FILE = path.join(__dirname, "users.json");

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], tokens: {} }, null, 2));
  }
  const raw = fs.readFileSync(DB_FILE, "utf8");
  return JSON.parse(raw);
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

function generateId(prefix) {
  return prefix + "_" + crypto.randomBytes(8).toString("hex");
}

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

async function sendVerificationEmail(userEmail, token) {
  if (!transporter) {
    console.warn("sendVerificationEmail called but SMTP is not configured.");
    return;
  }
  const verifyUrl = `${APP_BASE_URL.replace(/\/$/, "")}/verify-email.html?token=${token}`;
  const mailOptions = {
    from: `"HeartWins" <${SMTP_FROM}>`,
    to: userEmail,
    subject: "Подтверждение e-mail для HeartWins",
    text: `Здравствуйте! Перейдите по ссылке, чтобы подтвердить e-mail: ${verifyUrl}`,
    html: `
      <p>Здравствуйте!</p>
      <p>Спасибо за регистрацию в <b>HeartWins — Колесо осознанности</b>.</p>
      <p>Чтобы подтвердить ваш e-mail, перейдите по ссылке:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>Если вы не регистрировались, просто проигнорируйте это письмо.</p>
    `
  };
  await transporter.sendMail(mailOptions);
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

// ===== AUTH ROUTES =====

// SIGNUP c email-подтверждением
// SIGNUP c "умным" режимом верификации
app.post("/api/auth/signup", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Нужны email и пароль" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Пароль должен быть минимум 6 символов" });
  }

  const db = loadDb();
  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: "Пользователь с такой почтой уже есть" });
  }
// Телеграм-авторизация (упрощённо: доверяем прокинутому ID)
app.post("/api/auth/telegram", (req, res) => {
  const { telegramId, firstName, username } = req.body || {};
  if (!telegramId) {
    return res.status(400).json({ error: "Нет telegramId" });
  }

  const db = loadDb();
  let user = db.users.find(u => u.telegramId === String(telegramId));

  // если уже есть — используем
  if (!user) {
    // авто-регистрация
    user = {
      id: generateId("usr"),
      email: null,              // нет email
      passwordHash: null,       // нет пароля
      telegramId: String(telegramId),
      telegramUsername: username || null,
      telegramName: firstName || null,
      karma: 0,
      awareness: 0,
      quizCorrect: 0,
      isVerified: true,         // телега сама даёт идентичность
      verificationToken: null,
      verificationExpires: null
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
      email: user.email,
      karma: user.karma,
      awareness: user.awareness,
      quizCorrect: user.quizCorrect,
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername,
      telegramName: user.telegramName
    }
  });
});
// VK Mini App авторизация (упрощённо)
app.post("/api/auth/vk", (req, res) => {
  const { vkId, firstName, lastName, username } = req.body || {};
  if (!vkId) {
    return res.status(400).json({ error: "Нет vkId" });
  }

  const db = loadDb();
  let user = db.users.find(u => u.vkId === String(vkId));

  if (!user) {
    user = {
      id: generateId("usr"),
      email: null,
      passwordHash: null,
      vkId: String(vkId),
      vkUsername: username || null,
      vkName: [firstName, lastName].filter(Boolean).join(" "),
      karma: 0,
      awareness: 0,
      quizCorrect: 0,
      isVerified: true,
      verificationToken: null,
      verificationExpires: null
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
      email: user.email,
      karma: user.karma,
      awareness: user.awareness,
      quizCorrect: user.quizCorrect,
      vkId: user.vkId,
      vkUsername: user.vkUsername,
      vkName: user.vkName
    }
  });
});

  // Если SMTP реально доступен — можем когда-нибудь включить письма.
  // Сейчас на free Render SMTP-порты заблокированы → делаем авто-verify.
  const useEmailVerification = !!transporter && process.env.FORCE_EMAIL_VERIFY === "1";

  const verificationToken = useEmailVerification ? generateToken() : null;
  const expiresAt = useEmailVerification
    ? Date.now() + 24 * 60 * 60 * 1000
    : null;

  const user = {
    id: generateId("usr"),
    email,
    passwordHash: hashPassword(password),
    karma: 0,
    awareness: 0,
    quizCorrect: 0,
    isVerified: !useEmailVerification, // сейчас: сразу подтверждён
    verificationToken,
    verificationExpires: expiresAt
  };

  db.users.push(user);
  saveDb(db);

  if (useEmailVerification) {
    try {
      await sendVerificationEmail(email, verificationToken);
      return res.json({
        ok: true,
        message: "Проверьте email и подтвердите регистрацию."
      });
    } catch (e) {
      console.error("Ошибка отправки письма:", e);
      return res.status(500).json({
        error: "Не удалось отправить письмо. Позже попробуйте снова."
      });
    }
  } else {
    // DEV / alpha: без писем, аккаунт уже активен
    return res.json({
      ok: true,
      message: "E-mail подтверждение временно отключено (alpha). Аккаунт уже активирован."
    });
  }
});

  const verificationToken = generateToken();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 часа

  const user = {
    id: generateId("usr"),
    email,
    passwordHash: hashPassword(password),
    karma: 0,
    awareness: 0,
    quizCorrect: 0,
    isVerified: false,
    verificationToken,
    verificationExpires: expiresAt
  };

  db.users.push(user);
  saveDb(db);

  try {
    await sendVerificationEmail(email, verificationToken);
  } catch (e) {
    console.error("Ошибка отправки письма:", e);
    return res.status(500).json({ error: "Не удалось отправить письмо. Проверьте настройки SMTP." });
  }

  res.json({ ok: true, message: "Проверьте email и подтвердите регистрацию." });
});

// LOGIN
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Нужны email и пароль" });
  }
  const db = loadDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(400).json({ error: "Неверная почта или пароль" });
  }
  if (user.passwordHash !== hashPassword(password)) {
    return res.status(400).json({ error: "Неверная почта или пароль" });
  }
  if (!user.isVerified) {
    return res.status(403).json({ error: "Email не подтверждён. Проверьте почту." });
  }

  const token = generateToken();
  db.tokens[token] = user.id;
  saveDb(db);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      karma: user.karma,
      awareness: user.awareness,
      quizCorrect: user.quizCorrect
    }
  });
});

// VERIFY EMAIL
app.get("/api/auth/verify-email", (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Нет токена" });

  const db = loadDb();
  const user = db.users.find(
    u => u.verificationToken === token && u.verificationExpires > Date.now()
  );
  if (!user) {
    return res.status(400).json({ error: "Неверный или просроченный токен" });
  }

  user.isVerified = true;
  user.verificationToken = null;
  user.verificationExpires = null;
  saveDb(db);

  const authToken = generateToken();
  db.tokens[authToken] = user.id;
  saveDb(db);

  res.json({
    token: authToken,
    user: {
      id: user.id,
      email: user.email,
      karma: user.karma,
      awareness: user.awareness,
      quizCorrect: user.quizCorrect
    }
  });
});

// GET CURRENT USER
app.get("/api/user/me", authMiddleware, (req, res) => {
  const user = req.user;
  res.json({
    id: user.id,
    email: user.email,
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
