const express = require("express");
const fs = require("fs");
const path = require("path");

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

// загружаю массив
let medicines = loadMedicines();


// получить все лекарства
router.get("/", (req, res) => {
  res.json(medicines);
});

// добавить лекарство
router.post("/", (req, res) => {
  const newMedicine = {
    id: Date.now(),
    name: req.body.name,
    time: req.body.time,
    taken: false,
  };

  medicines.push(newMedicine);
  saveMedicines(medicines); 

  res.status(201).json(newMedicine);
});

// отметить "принято"
router.put("/:id/take", (req, res) => {
  const id = parseInt(req.params.id);
  const medicine = medicines.find((m) => m.id === id);

  if (!medicine) {
    return res.status(404).json({ message: "Лекарство не найдено" });
  }

  medicine.taken = true;
  saveMedicines(medicines);

  res.json(medicine);
});

// удалить
router.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id);

  medicines = medicines.filter((m) => m.id !== id);
  saveMedicines(medicines); 

  res.json({ message: "Удалено" });
});

module.exports = router;