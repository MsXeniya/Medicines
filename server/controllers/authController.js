const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const usersPath = path.join(__dirname, "../data/users.json");
const SECRET_KEY = "secretkey";
const REFRESH_SECRET = "refresh_secret";

// Загрузка пользователей
function loadUsers() {
  if (fs.existsSync(usersPath)) {
    return JSON.parse(fs.readFileSync(usersPath, "utf8"));
  }
  return [];
}

// Сохранение пользователей
function saveUsers(users) {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

// =======================
// ✅ Регистрация
// =======================
exports.register = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: "Введите имя пользователя и пароль" });

  let users = loadUsers();

  if (users.find((u) => u.username === username))
    return res.status(400).json({ message: "Такой пользователь уже существует" });

  const newUser = {
    id: Date.now(),
    username,
    password,
    refreshToken: null,
  };

  users.push(newUser);
  saveUsers(users);

  res.json({ message: "Пользователь зарегистрирован", user: newUser });
};

// =======================
// ✅ Авторизация
// =======================
exports.login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: "Введите имя пользователя и пароль" });

  const users = loadUsers();
  const user = users.find((u) => u.username === username && u.password === password);

  if (!user) return res.status(401).json({ message: "Неверные данные" });

  const accessToken = jwt.sign({ id: user.id, username }, SECRET_KEY, { expiresIn: "1h" });
  const refreshToken = jwt.sign({ id: user.id, username }, REFRESH_SECRET, { expiresIn: "7d" });

  user.refreshToken = refreshToken;
  saveUsers(users);

  res.json({ message: "Успешный вход", accessToken, refreshToken });
};

// =======================
// ✅ Обновление токена (refresh)
// =======================
exports.refresh = (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.status(400).json({ message: "Нет refresh токена" });

  const users = loadUsers();
  const user = users.find((u) => u.refreshToken === refreshToken);
  if (!user) return res.status(403).json({ message: "Неверный refresh токен" });

  try {
    jwt.verify(refreshToken, REFRESH_SECRET);
    const newAccessToken = jwt.sign(
      { id: user.id, username: user.username },
      SECRET_KEY,
      { expiresIn: "1h" }
    );
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ message: "Refresh токен недействителен" });
  }
};

// =======================
// ✅ Удаление пользователя
// =======================
exports.deleteUser = (req, res) => {
  const id = parseInt(req.params.id);
  let users = loadUsers();

  const index = users.findIndex((u) => u.id === id);
  if (index === -1)
    return res.status(404).json({ message: "Пользователь не найден" });

  users.splice(index, 1);
  saveUsers(users);

  res.json({ message: "Пользователь удалён" });
};