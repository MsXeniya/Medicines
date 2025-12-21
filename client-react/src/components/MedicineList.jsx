import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/MedicineList.css";

export default function MedicineList() {
  const { accessToken } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newMedicineName, setNewMedicineName] = useState("");
  const [newMedicineTime, setNewMedicineTime] = useState("09:00");

  const API_BASE = "http://localhost:5000/api";

  // Загрузить лекарства
  useEffect(() => {
    if (accessToken) {
      fetchMedicines();
    }
  }, [accessToken]);

  const fetchMedicines = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/medicines`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Фильтруем: показываем только лекарства с userId (свои лекарства)
        // Legacy-лекарства (без userId) не показываем
        const userMedicines = data.filter((m) => m.userId);
        setMedicines(userMedicines);
      } else {
        setError("Ошибка при загрузке лекарств");
      }
    } catch (err) {
      console.error("Error fetching medicines:", err);
      setError("Ошибка при загрузке лекарств");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    if (!newMedicineName.trim()) {
      setError("Введите название лекарства");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/medicines`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: newMedicineName, time: newMedicineTime }),
      });

      if (res.ok) {
        const newMedicine = await res.json();
        setMedicines([...medicines, newMedicine]);
        setNewMedicineName("");
        setNewMedicineTime("09:00");
        setError(null);
      } else {
        setError("Ошибка при добавлении лекарства");
      }
    } catch (err) {
      console.error("Error adding medicine:", err);
      setError("Ошибка при добавлении лекарства");
    }
  };

  const handleToggleTaken = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/medicines/${id}/take`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const updated = await res.json();
        setMedicines(medicines.map((m) => (m.id === id ? updated : m)));
        setError(null);
      } else if (res.status === 404) {
        // Лекарство не найдено — может быть, это legacy-лекарство без userId
        console.warn("Medicina not found (possibly legacy item without userId)");
        // Не показываем ошибку пользователю, просто удаляем из списка
        setMedicines(medicines.filter((m) => m.id !== id));
      } else {
        const errorData = await res.json();
        console.error("Error toggling medicine:", res.status, errorData);
        setError("Ошибка при обновлении лекарства");
      }
    } catch (err) {
      console.error("Error updating medicine:", err);
      setError("Ошибка при обновлении лекарства");
    }
  };

  const handleDeleteMedicine = async (id) => {
    if (!window.confirm("Вы уверены, что хотите удалить это лекарство?")) return;

    try {
      const res = await fetch(`${API_BASE}/medicines/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        setMedicines(medicines.filter((m) => m.id !== id));
        setError(null);
      } else {
        const errorText = await res.text();
        console.error("Error deleting medicine:", res.status, errorText);
        setError(`Ошибка при удалении: ${res.status}`);
      }
    } catch (err) {
      console.error("Error deleting medicine:", err);
      setError("Ошибка при удалении лекарства");
    }
  };

  if (loading && medicines.length === 0) {
    return <div className="loading">⏳ Загрузка лекарств...</div>;
  }

  return (
    <div className="medicine-list-container">
      <div className="add-medicine-card">
        <h2>➕ Добавить новое лекарство</h2>
        <form onSubmit={handleAddMedicine} className="add-medicine-form">
          <input
            type="text"
            placeholder="Название лекарства"
            value={newMedicineName}
            onChange={(e) => setNewMedicineName(e.target.value)}
            className="form-input"
          />
          <input
            type="time"
            value={newMedicineTime}
            onChange={(e) => setNewMedicineTime(e.target.value)}
            className="form-input"
          />
          <button type="submit" className="btn btn-success">
            Добавить
          </button>
        </form>
        {error && <div className="error-message">❌ {error}</div>}
      </div>

      <div className="medicines-grid">
        {medicines.length === 0 ? (
          <div className="empty-state">
            <p>📭 Нет лекарств</p>
            <p className="empty-subtitle">Добавьте первое лекарство выше</p>
          </div>
        ) : (
          medicines.map((medicine) => (
            <div
              key={medicine.id}
              className={`medicine-card ${medicine.taken ? "taken" : ""}`}
            >
              <div className="medicine-header">
                <h3 className="medicine-name">{medicine.name}</h3>
                <span className={`badge ${medicine.taken ? "badge-success" : "badge-warning"}`}>
                  {medicine.taken ? "✓ Принято" : "⏰ Ожидание"}
                </span>
              </div>

              <div className="medicine-time">
                <strong>🕐 Время:</strong> {medicine.time}
              </div>

              <div className="medicine-actions">
                <button
                  onClick={() => handleToggleTaken(medicine.id)}
                  className={`btn ${medicine.taken ? "btn-secondary" : "btn-primary"}`}
                >
                  {medicine.taken ? "↩️ Отменить" : "✓ Принято"}
                </button>
                <button
                  onClick={() => handleDeleteMedicine(medicine.id)}
                  className="btn btn-danger"
                >
                  🗑️ Удалить
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
