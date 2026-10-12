import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RoleRoute({ roles = [], children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Если роль пользователя не входит в список разрешённых ролей — возврат на главную
  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
