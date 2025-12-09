# HeartWins — Колесо осознанности

- Node.js + Express backend (`server.js`)
- Хранение пользователей в `users.json` (файловая "БД")
- Регистрация с e-mail подтверждением (подключается через SMTP)
- Логин, хранение токена в localStorage
- Фронтенд в `/public`:
  - Кликер кармы с анимацией разлетающихся сердечек
  - Колесо осознанности
  - Викторина осознанности (более сложные вопросы)

## Запуск локально

```bash
npm install
npm start
# приложение будет на http://localhost:3000
```

## Переменные окружения для Render

Минимум для e-mail подтверждения:

- `APP_BASE_URL` — базовый URL приложения (например, `https://your-app.onrender.com`)
- `SMTP_HOST` — хост SMTP (например `smtp.gmail.com` или сервис вроде SendGrid)
- `SMTP_PORT` — порт (обычно 587 или 465)
- `SMTP_USER` — логин
- `SMTP_PASS` — пароль или API key
- `SMTP_FROM` — от кого отправляются письма (например `noreply@heartwins.app`)

Если SMTP не настроен, регистрация всё равно отработает, но письмо не уйдёт.

## Деплой на Render

1. Залей репозиторий на GitHub.
2. Создай новый Web Service на Render, выбрав этот репозиторий.
3. Build command: `npm install`
4. Start command: `npm start`
5. Node версию Render возьмёт из настроек по умолчанию (можно задать переменной среды `NODE_VERSION`, например `20`).

