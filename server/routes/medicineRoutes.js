const express = require("express");
const fs = require("fs");
const path = require("path");

const { authenticateToken } = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");

const router = express.Router();

const medicinesPath = path.join(__dirname, "../data/medicines.json");

// функция загрузки
function loadMedicines() {
  if (fs.existsSync(medicinesPath)) {
    return JSON.parse(fs.readFileSync(medicinesPath, "utf8"));
  }
  return [];
}

// функция сохранения
function saveMedicines(data) {
  fs.writeFileSync(medicinesPath, JSON.stringify(data, null, 2));
}

let medicines = loadMedicines();


// получить лекарства: старые записи без userId видны всем; новые видны только владельцу
router.get("/", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  let userId = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, "secretkey");
      userId = decoded && decoded.id;
    } catch (err) {
      // недействительный токен — будем считать пользователя неавторизованным
      userId = null;
    }
  }

  const result = medicines.filter((m) => {
    // legacy записи (без userId) — видны всем
    if (m.userId == null) return true;
    // если пользователь авторизован — показать его записи
    if (userId != null && m.userId === userId) return true;
    return false;
  });

  res.json(result);
});

// добавить лекарство (привязано к пользователю)
router.post("/", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const newMedicine = {
    id: Date.now(),
    userId,
    name: req.body.name,
    time: req.body.time,
    taken: false,
  };

  medicines.push(newMedicine);
  saveMedicines(medicines);

  res.status(201).json(newMedicine);
});

// отметить "принято" для лекарства текущего пользователя
router.put("/:id/take", authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user.id;
  const medicine = medicines.find((m) => m.id === id && m.userId === userId);

  if (!medicine) {
    return res.status(404).json({ message: "Лекарство не найдено" });
  }

  medicine.taken = true;
  saveMedicines(medicines);

  res.json(medicine);
});

// удалить лекарство текущего пользователя
router.delete("/:id", authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user.id;

  const before = medicines.length;
  medicines = medicines.filter((m) => !(m.id === id && m.userId === userId));
  const after = medicines.length;

  saveMedicines(medicines);

  if (before === after) {
    return res.status(404).json({ message: "Лекарство не найдено" });
  }

  res.json({ message: "Удалено" });
});

module.exports = router;