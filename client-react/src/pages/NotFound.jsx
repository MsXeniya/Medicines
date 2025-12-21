import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/NotFound.css";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="notfound-container">
      <div className="notfound-content">
        <h1 className="notfound-code">404</h1>
        <h2 className="notfound-title">Страница не найдена</h2>
        <p className="notfound-text">Извините, страница, которую вы ищете, не существует.</p>
        <button onClick={() => navigate("/")} className="btn btn-primary">
          ← Вернуться на главную
        </button>
      </div>
    </div>
  );
}