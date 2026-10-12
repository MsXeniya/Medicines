import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";
import setSEO from "../utils/useSEO";

export default function AdminPanel() {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // загружаем всех юзеров для админки
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get("/admin/users");

      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else if (res.status === 403) {
        setError("Недостаточно прав: доступ только для администратора");
      } else {
        setError("Ошибка загрузки пользователей");
      }
    } catch (err) {
      setError("Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessToken) {
      loadUsers();
    }
  }, [accessToken, loadUsers]);

  setSEO({ title: "Admin — Управление ролями", description: "Администрирование приложения" });

  // обновление роли юзера
  const updateRole = async (userId, role) => {
    try {
      const res = await api.patch(`/admin/users/${userId}/role`, { role });

      if (res.ok) {
        // после успешной смены роли перезагружаем список для отображения актуальных данных
        await loadUsers();
      } else if (res.status === 403) {
        setError("Недостаточно прав для смены роли");
      } else {
        const data = await res.json();
        setError(data.detail || "Ошибка смены роли");
      }
    } catch (err) {
      setError("Ошибка смены роли");
    }
  };

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>Администрирование ролей</h1>
        <p className="home-subtitle">Доступно только пользователю с ролью admin</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading">Загрузка пользователей...</div>}

      {!loading && (
        <div className="medicines-grid">
          {users.map((item) => (
            <div key={item.id} className="medicine-card">
              <div className="medicine-header">
                <h3 className="medicine-name">{item.username}</h3>
                <span className="badge badge-warning">Текущая роль: {item.role}</span>
              </div>

              <div className="medicine-actions">
                <button
                  className="btn btn-secondary"
                  disabled={item.role === "user"}
                  onClick={() => updateRole(item.id, "user")}
                >
                  Сделать user
                </button>
                <button
                  className="btn btn-primary"
                  disabled={item.role === "admin"}
                  onClick={() => updateRole(item.id, "admin")}
                >
                  Сделать admin
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}