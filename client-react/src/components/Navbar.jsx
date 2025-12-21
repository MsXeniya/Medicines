import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
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
              <span className="navbar-user">👤 {user.username}</span>
              <Link to="/profile" className="nav-link">
                Профиль
              </Link>
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