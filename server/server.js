const express = require("express");
const app = express();
const PORT = 3000;

app.use(express.json());

//импорт маршрутов
const medicineRoutes = require("./routes/medicineRoutes.js").default || require("./routes/medicineRoutes");
app.use("/api/medicines", medicineRoutes);

//приветственная страница
app.get("/", (req, res) => {
  res.send("Проект: Напоминания о лекарствах");
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});