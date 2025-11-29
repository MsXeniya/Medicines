import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav style={{ display: "flex", gap: "10px", padding: "10px" }}>
      <Link to="/">Главная</Link>
      <Link to="/profile">Профиль</Link>
    </nav>
  );
}