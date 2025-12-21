import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/LoginForm.css";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const { login, register, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    let success;

    if (isRegister) {
      success = await register(username, password);
    } else {
      success = await login(username, password);
    }

    if (success) {
      setUsername("");
      setPassword("");
      navigate("/");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Medicines</h1>
        <p className="login-subtitle">
          {isRegister ? "Создайте новый аккаунт" : "Войдите в свой аккаунт"}
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Имя пользователя</label>
            <input
              id="username"
              type="text"
              placeholder="Введите имя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>

          {error && <div className="error-message">❌ {error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Загрузка..." : isRegister ? "Зарегистрироваться" : "Войти"}
          </button>
        </form>

        <div className="login-toggle">
          <p>
            {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}{" "}
            <button
              type="button"
              className="toggle-link"
              onClick={() => {
                setIsRegister(!isRegister);
                setUsername("");
                setPassword("");
              }}
            >
              {isRegister ? "Войти" : "Зарегистрироваться"}
            </button>
          </p>
        </div>

        <div className="demo-users">
          <p className="demo-title">📋 Тестовые пользователи:</p>
          <ul>
            <li>
              <strong>xenia1</strong> / <code>123456</code>
            </li>
            <li>
              <strong>maya</strong> / <code>123</code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
