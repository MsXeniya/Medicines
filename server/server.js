const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

//Подключаем маршруты
const medicineRoutes = require("./routes/medicineRoutes.js").default || require("./routes/medicineRoutes");
const authRoutes = require("./routes/authRoutes");

app.use("/api/medicines", medicineRoutes);
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Сервер работает!");
});


const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
  console.log("Registered routes:");
  console.log("/api/medicines");
  console.log("/api/auth");
});