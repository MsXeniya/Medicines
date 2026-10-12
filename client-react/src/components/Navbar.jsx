import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          Medicines
        </Link>

        <div className="navbar-menu">
          {user ? (
            <>
              {/* Показываем роль рядом с именем, чтобы пользователю было видно текущие права. */}
              <span className="navbar-user">👤 {user.username} ({user.role})</span>
              <Link to="/profile" className="nav-link">
                Профиль
              </Link>
              {user.role === "admin" && (
                <Link to="/admin" className="nav-link">
                  Админ
                </Link>
              )}
              <button onClick={handleLogout} className="btn btn-logout">
                Выход
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary">
              Вход
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}