const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
// защита удаления пользователя: только авторизованный запрос
router.delete("/:id", authenticateToken, authController.deleteUser);
// получить профиль текущего пользователя
router.get("/profile", authenticateToken, authController.profile);

module.exports = router;