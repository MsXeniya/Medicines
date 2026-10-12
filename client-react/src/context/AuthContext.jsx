import React, { createContext, useState, useEffect, useCallback } from "react";
import { api, getTokens, setTokens, clearTokens, refreshAccessToken as apiRefreshToken } from "../utils/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken"));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem("refreshToken"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const API_BASE = "/api";

  const readResponseBody = async (res) => {
    const text = await res.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return { detail: text };
    }
  };

  // Сохранение токенов в localStorage
  useEffect(() => {
    if (accessToken) {
      localStorage.setItem("accessToken", accessToken);
    } else {
      localStorage.removeItem("accessToken");
    }
  }, [accessToken]);

  useEffect(() => {
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    } else {
      localStorage.removeItem("refreshToken");
    }
  }, [refreshToken]);

  // Обновление access token через refresh token
  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken) return false;
    try {
      const newAccessToken = await apiRefreshToken();
      if (newAccessToken) {
        setAccessToken(newAccessToken);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error refreshing token:", err);
      return false;
    }
  }, [refreshToken]);

  // Получение профиля пользователя
  const fetchProfile = useCallback(async () => {
    if (!accessToken) {
      setUser(null);
      return;
    }

    try {
      const res = await api.get("/auth/profile");
      if (res.ok) {
        const data = await readResponseBody(res);
        setUser(data.user);
        setError(null);
      } else if (res.status === 401) {
        // Токен истёк, пытаемся обновить
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          logout();
        }
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError("Ошибка при загрузке профиля");
    }
  }, [accessToken, refreshAccessToken]);

  // Инициализация: загрузить профиль при наличии токена
  useEffect(() => {
    if (accessToken && !isInitialized) {
      fetchProfile();
      setIsInitialized(true);
    }
  }, [accessToken, isInitialized, fetchProfile]);

  // Регистрация нового пользователя
  const register = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/register", { username, password });
      const data = await readResponseBody(res);
      if (!res.ok) {
        throw new Error(data.detail || data.message || "Ошибка регистрации");
      }
      setError(null);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Вход в систему
  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/login", { username, password });
      const data = await readResponseBody(res);
      if (!res.ok) {
        throw new Error(data.detail || data.message || "Ошибка входа");
      }
      // Сохраняем токены в state и в localStorage через общий util
      // затем сразу подгружаем профиль, чтобы избежать гонки записи в localStorage
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setTokens(data.accessToken, data.refreshToken);

      // Обновляем профиль
      await fetchProfile();
      setError(null);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Выход из системы
  const logout = async () => {
    try {
      if (accessToken) {
        await api.post("/auth/logout", {});
      }
    } catch (err) {
      console.error("Error during logout:", err);
    } finally {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      clearTokens();
      setError(null);
    }
  };

  // Проверка наличия прав
  const hasPermission = (permission) => {
    if (!user || !Array.isArray(user.permissions)) return false;
    return user.permissions.includes(permission);
  };

  // Проверка роли
  const hasRole = (roles) => {
    if (!user) return false;
    return Array.isArray(roles) ? roles.includes(user.role) : user.role === roles;
  };

  const value = {
    user,
    accessToken,
    refreshToken,
    loading,
    error,
    isInitialized,
    register,
    login,
    logout,
    fetchProfile,
    refreshAccessToken,
    hasPermission,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};