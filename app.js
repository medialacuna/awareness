const API_BASE = ""; // same origin

let authToken = null;
let currentUser = null;
let wheelSpinning = false;
let currentQuiz = null;
let quizAnswered = false;

/* ===== СУТРЫ И ВОПРОСЫ ===== */

const SUTRAS = [
  "Замечать свои автоматические реакции — уже первый шаг к свободе.",
  "Осознанность не отменяет боль. Она учит быть с ней честно.",
  "Там, где ты хочешь убежать, часто спрятан твой рост.",
  "Настоящее уважение — позволить другому быть не таким, как ты ожидаешь.",
  "Иногда самый смелый поступок — сказать себе: «я не знаю» и остаться.",
  "Дух развивается, когда ты способен увидеть свою тень и не отвернуться.",
  "Глубина дыхания часто показывает глубину доверия миру.",
  "Скорость — не всегда движение. Иногда это способ не чувствовать.",
  "Осознанность — это не быть идеальным, а быть живым и внимательным."
];

const QUIZ_QUESTIONS = [
  {
    id: 1,
    quote: "«Когда я раздражён, это не значит, что мир плохой. Это значит, что во мне что-то хочет быть услышанным.»",
    question: "Какой шаг ближе всего к осознанности в такой момент?",
    options: [
      "Сразу написать гневное сообщение, чтобы стало легче.",
      "На минуту остановиться, почувствовать тело и назвать своё чувство.",
      "Сделать вид, что ничего не происходит и продолжать как ни в чём не бывало.",
      "Обвинить другого в том, что ты чувствуешь."
    ],
    correctIndex: 1,
    reward: 2
  },
  {
    id: 2,
    quote: "«Уважение — это не соглашаться, а признавать, что другой видит мир по-своему.»",
    question: "Какой вариант ближе к этому принципу?",
    options: [
      "Слушать до конца и переспрашивать, правильно ли ты понял.",
      "Разрешать говорить только тогда, когда ты согласен.",
      "Сразу доказывать, почему другой неправ.",
      "Избегать любых сложных тем, чтобы не было конфликтов."
    ],
    correctIndex: 0,
    reward: 1
  },
  {
    id: 3,
    quote: "«Осознанность в деньгах — это не отсутствие желаний, а честность с тем, зачем тебе то, что ты хочешь.»",
    question: "Какой шаг наиболее осознанный перед спонтанной покупкой?",
    options: [
      "Купить сразу, пока не передумал.",
      "Сравнить цену и понять, удачная ли скидка.",
      "Спросить себя: «Какое состояние я пытаюсь купить?» и сделать пару дыханий.",
      "Взять кредит, чтобы точно не упустить возможность."
    ],
    correctIndex: 2,
    reward: 2
  },
  {
    id: 4,
    quote: "«Духовный рост — это не полёт над людьми, а способность встречаться с собой без масок.»",
    question: "Какой вариант ближе к этому подходу?",
    options: [
      "Считать себя более осознанным, чем остальные.",
      "Признавать свои слабости и, по возможности, говорить о них честно.",
      "Избегать людей, которые вызывают неудобные чувства.",
      "Ждать, когда другие начнут меняться первыми."
    ],
    correctIndex: 1,
    reward: 2
  },
  {
    id: 5,
    quote: "«Пауза между стимулом и реакцией — пространство, где рождается свобода.»",
    question: "Как можно развивать эту паузу в обычной жизни?",
    options: [
      "Отвечать быстрее, чтобы не потерять контроль над ситуацией.",
      "Приучать себя хотя бы один раз в день делать несколько осознанных вдохов перед важным действием.",
      "По максимуму избегать любых решений.",
      "Стараться вообще ничего не чувствовать, чтобы не мешало."
    ],
    correctIndex: 1,
    reward: 1
  }
];

/* ===== DOM ===== */

const authSection = document.getElementById("authSection");
const mainSection = document.getElementById("mainSection");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");

const profileGreeting = document.getElementById("profileGreeting");
const profileEmail = document.getElementById("profileEmail");
const statKarma = document.getElementById("statKarma");
const statAwareness = document.getElementById("statAwareness");
const statQuiz = document.getElementById("statQuiz");

const karmaClickBtn = document.getElementById("karmaClickBtn");
const wheelVisual = document.getElementById("wheelVisual");
const spinBtn = document.getElementById("spinBtn");
const wheelResultEl = document.getElementById("wheelResult");
const sutraBox = document.getElementById("sutraBox");

const quizQuoteEl = document.getElementById("quizQuote");
const quizQuestionEl = document.getElementById("quizQuestion");
const quizOptionsEl = document.getElementById("quizOptions");
const quizStatusEl = document.getElementById("quizStatus");
const newQuestionBtn = document.getElementById("newQuestionBtn");

/* ===== HELPERS ===== */

function setToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem("hw_awareness_token", token);
  } else {
    localStorage.removeItem("hw_awareness_token");
  }
}

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (authToken) headers["Authorization"] = "Bearer " + authToken;
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers,
    body: opts.body && !(opts.body instanceof FormData)
      ? JSON.stringify(opts.body)
      : opts.body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || "Ошибка запроса");
  }
  return data;
}

function updateUserUI() {
  if (!currentUser) return;
  const name = currentUser.email.split("@")[0];
  profileGreeting.textContent = "Привет, " + name + "!";
  profileEmail.textContent = currentUser.email;
  statKarma.textContent = currentUser.karma ?? 0;
  statAwareness.textContent = currentUser.awareness ?? 0;
  statQuiz.textContent = currentUser.quizCorrect ?? 0;
}

function showMain(show) {
  authSection.style.display = show ? "none" : "block";
  mainSection.style.display = show ? "block" : "none";
  logoutBtn.style.display = show ? "inline-flex" : "none";
}

/* Частицы при клике */
function spawnClickParticles(containerEl, count = 7) {
  if (!containerEl) return;
  for (let i = 0; i < count; i++) {
    const span = document.createElement("span");
    const isHeart = Math.random() < 0.6;
    span.className = "click-particle " + (isHeart ? "heart" : "dot");
    span.textContent = isHeart ? "❤" : "•";

    const dx = (Math.random() - 0.5) * 80;
    const dy = (Math.random() - 0.5) * 60;
    span.style.setProperty("--dx", dx + "px");
    span.style.setProperty("--dy", dy + "px");

    containerEl.appendChild(span);
    setTimeout(() => span.remove(), 650);
  }
}
function isVKMiniApp() {
  return typeof window.vkBridge !== "undefined";
}

async function vkAutoLogin() {
  if (!isVKMiniApp()) return;

  try {
    const bridge = window.vkBridge;
    await bridge.send("VKWebAppInit");
    const userInfo = await bridge.send("VKWebAppGetUserInfo");

    const data = await api("/api/auth/vk", {
      method: "POST",
      body: {
        vkId: userInfo.id,
        firstName: userInfo.first_name,
        lastName: userInfo.last_name,
        username: userInfo.screen_name || null
      }
    });

    setToken(data.token);
    currentUser = data.user;
    updateUserUI();
    showMain(true);

    const authSection = document.getElementById("authSection");
    if (authSection) authSection.style.display = "none";
  } catch (e) {
    console.error("Ошибка VK логина", e);
  }
}

/* ===== AUTH ===== */

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Введите email и пароль");
    return;
  }

  try {
    // Пробуем логин. Если email не подтверждён — покажем ошибку.
    try {
      const data = await api("/api/auth/login", { method: "POST", body: { email, password } });
      setToken(data.token);
      currentUser = data.user;
      updateUserUI();
      showMain(true);
      return;
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("Email не подтверждён")) {
        alert("Email не подтверждён. Проверь почту — там письмо от HeartWins.");
        return;
      }
      // если ошибка другая (например, пользователь не найден) — пробуем signup
    }

    const signupRes = await api("/api/auth/signup", { method: "POST", body: { email, password } });
    alert(signupRes.message || "Регистрация успешна. Проверьте почту для подтверждения.");
  } catch (err) {
    alert(err.message || "Ошибка авторизации");
  }
});

logoutBtn.addEventListener("click", () => {
  currentUser = null;
  setToken(null);
  showMain(false);
});

/* Авто-подхват токена при загрузке */

(async function initAuthFromStorage() {
  const token = localStorage.getItem("hw_awareness_token");
  if (!token) return;
  setToken(token);
  try {
    const user = await api("/api/user/me");
    currentUser = user;
    updateUserUI();
    showMain(true);
  } catch (e) {
    setToken(null);
  }
})();

/* ===== КЛИКЕР КАРМЫ ===== */

karmaClickBtn.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Сначала войди.");
    return;
  }
  try {
    const data = await api("/api/actions/karma-click", { method: "POST" });
    currentUser.karma = data.karma;
    updateUserUI();

    karmaClickBtn.style.transform = "scale(0.97)";
    setTimeout(() => {
      karmaClickBtn.style.transform = "";
    }, 80);

    const container = karmaClickBtn.closest(".panel-card") || karmaClickBtn.parentElement;
    spawnClickParticles(container, 7);
  } catch (e) {
    alert(e.message || "Ошибка кликера");
  }
});

/* ===== КОЛЕСО ОСОЗНАННОСТИ ===== */

spinBtn.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Сначала войди.");
    return;
  }
  if (wheelSpinning) return;
  wheelSpinning = true;
  wheelResultEl.textContent = "Колесо крутится...";

  const extraTurns = Math.floor(Math.random() * 3) + 2;
  const finalDeg = extraTurns * 360 + Math.floor(Math.random() * 360);
  wheelVisual.style.transform = `rotate(${finalDeg}deg)`;

  try {
    const data = await api("/api/actions/wheel-spin", { method: "POST" });
    setTimeout(() => {
      currentUser.karma = data.user.karma;
      currentUser.awareness = data.user.awareness;
      currentUser.quizCorrect = data.user.quizCorrect;
      updateUserUI();

      wheelResultEl.textContent = data.message || "Спин завершён.";
      const sutra = SUTRAS[Math.floor(Math.random() * SUTRAS.length)];
      sutraBox.textContent = sutra;

      wheelSpinning = false;
    }, 900);
  } catch (e) {
    wheelSpinning = false;
    wheelResultEl.textContent = e.message || "Ошибка спина";
  }
});

/* ===== ВИКТОРИНА ОСОЗНАННОСТИ ===== */

function renderQuiz(questionObj) {
  quizQuoteEl.textContent = questionObj.quote;
  quizQuestionEl.textContent = questionObj.question;
  quizOptionsEl.innerHTML = "";
  quizStatusEl.textContent = "";
  quizAnswered = false;

  questionObj.options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost full";
    btn.textContent = opt;

    btn.addEventListener("click", async () => {
      if (!currentUser) {
        alert("Сначала войди.");
        return;
      }
      if (quizAnswered) return;
      quizAnswered = true;

      if (index === questionObj.correctIndex) {
        quizStatusEl.textContent = "✅ Да. Это направление ближе к осознанности.";
        quizStatusEl.style.color = "#2f7c4a";

        try {
          const reward = questionObj.reward ?? 1;
          const data = await api("/api/actions/quiz-correct", {
            method: "POST",
            body: { awarenessReward: reward }
          });
          currentUser.karma = data.karma;
          currentUser.awareness = data.awareness;
          currentUser.quizCorrect = data.quizCorrect;
          updateUserUI();
        } catch (e) {
          console.error("Ошибка отправки результата викторины", e);
        }
      } else {
        quizStatusEl.textContent = "🙂 Не совсем. Попробуй посмотреть на цитату ещё глубже.";
        quizStatusEl.style.color = "#a35b2a";
      }
    });

    quizOptionsEl.appendChild(btn);
  });
}

newQuestionBtn.addEventListener("click", () => {
  const q = QUIZ_QUESTIONS[Math.floor(Math.random() * QUIZ_QUESTIONS.length)];
  currentQuiz = q;
  renderQuiz(q);
});
