import React from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import MedicineList from "../components/MedicineList";
import "../styles/Home.css";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>👤 Добро пожаловать, {user.username}!</h1>
        <p className="home-subtitle">Управляйте вашими лекарствами</p>
      </div>
      <MedicineList />
    </div>
  );
}