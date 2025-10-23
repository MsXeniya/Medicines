const jwt = require("jsonwebtoken");

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // формат: Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Токен не предоставлен" });
  }

  jwt.verify(token, "secretkey", (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Недействительный токен" });
    }
    req.user = user; // сохраняем данные юзера из токена
    next();
  });
};