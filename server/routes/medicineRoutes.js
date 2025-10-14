const express = require("express");
const router = express.Router();

let medicines = [
  { id: 1, name: "Антибиотик", time: "13:00", taken: false },
  { id: 2, name: "Витамин D", time: "15:00", taken: true },
];

//получить все лекарства
router.get("/", (req, res) => {
  res.json(medicines);
});

//добавить лекарство
router.post("/", (req, res) => {
  const newMedicine = {
    id: medicines.length + 1,
    name: req.body.name,
    time: req.body.time,
    taken: false,
  };
  medicines.push(newMedicine);
  res.status(201).json(newMedicine);
});

//отметка"принято"
router.put("/:id/take", (req, res) => {
  const id = parseInt(req.params.id);
  const medicine = medicines.find((m) => m.id === id);
  if (medicine) {
    medicine.taken = true;
    res.json(medicine);
  } else {
    res.status(404).json({ message: "Лекарство не найдено" });
  }
});

//удалить
router.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id);
  medicines = medicines.filter((m) => m.id !== id);
  res.json({ message: "Удалено" });
});

module.exports = router;