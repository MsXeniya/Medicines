import React, { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import LoginForm from "../components/LoginForm";
import MedicineList from "../components/MedicineList";
import ExternalWeather from "../components/ExternalWeather";
import setSEO from "../utils/useSEO";
import "../styles/Home.css";

export default function Home() {
  const { user } = useAuth();

  //SEO: title + description + canonical
  setSEO({ title: user ? `Medicines — ${user.username}` : "Medicines — Вход", description: "Управляйте вашими лекарствами", url: window.location.href });

  //JSON-LD structured data for homepage
  useEffect(() => {
    const ld = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Medicines App",
      "url": window.location.origin,
      "description": "Приложение для управления приёмом лекарств",
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(ld);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>👤 Добро пожаловать, {user.username}!</h1>
        <p className="home-subtitle">Управляйте вашими лекарствами</p>
      </div>

      <ExternalWeather city="Moscow" />

      <MedicineList />
    </div>
  );
}