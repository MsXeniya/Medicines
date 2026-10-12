import React from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/Profile.css";
import setSEO from "../utils/useSEO";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  setSEO({ title: user ? `Profile — ${user.username}` : "Profile", description: user ? `Профиль пользователя ${user.username}` : "Профиль" });

  if (!user) {
    navigate("/");
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <h1>👤 Мой Профиль</h1>
        </div>

        <div className="profile-info">
          <div className="info-item">
            <label>Имя пользователя:</label>
            <p className="info-value">{user.username}</p>
          </div>

          <div className="info-item">
            <label>ID пользователя:</label>
            <p className="info-value">{user.id}</p>
          </div>

          <div className="info-item">
            <label>Роль:</label>
            <p className="info-value">{user.role || "user"}</p>
          </div>

          <div className="info-item">
            <label>Права:</label>
            <p className="info-value">
              {Array.isArray(user.permissions) ? user.permissions.join(", ") : "Нет данных"}
            </p>
          </div>
        </div>

        <div className="profile-actions">
          <button onClick={() => navigate("/")} className="btn btn-primary">
            ← Вернуться на главную
          </button>
          <button onClick={handleLogout} className="btn btn-danger">
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}