/**
 * API Utility с автоматическим обновлением access token
 * Архитектурный паттерн: Adapter/Wrapper для fetch API
 */

const API_BASE = "/api";

/**
 * Получить токены из localStorage
 */
export function getTokens() {
  return {
    accessToken: localStorage.getItem("accessToken"),
    refreshToken: localStorage.getItem("refreshToken"),
  };
}

/**
 * Сохранить токены в localStorage
 */
export function setTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem("accessToken", accessToken);
  }
  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
  }
}

/**
 * Очистить токены
 */
export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

/**
 * Обновить access token используя refresh token
 * @returns {Promise<string|null>} новый access или null
 */
export async function refreshAccessToken() {
  const { refreshToken } = getTokens();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("accessToken", data.accessToken);
      return data.accessToken;
    }

    if (res.status === 403) {
      clearTokens();
    }
    return null;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

/**
 * При 401 пытается обновить токен и повторить запрос
 */
export async function apiFetch(endpoint, options = {}) {
  const { accessToken } = getTokens();
  const isFormDataBody = options.body instanceof FormData;

  const headers = {
    ...options.headers,
  };

  if (!isFormDataBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  // Если токен истёк (401), пытаемся обновить
  if (res.status === 401) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      headers.Authorization = `Bearer ${newAccessToken}`;
      res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    }
  }

  return res;
}

/**
 * методы для стандартных операций
 */
export const api = {
  get: (endpoint, options = {}) =>
    apiFetch(endpoint, { ...options, method: "GET" }),

  post: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: (endpoint, body, options = {}) =>
    apiFetch(endpoint, { ...options, method: "PUT", body: JSON.stringify(body) }),

  patch: (endpoint, body, options = {}) =>
    apiFetch(endpoint, { ...options, method: "PATCH", body: JSON.stringify(body) }),

  delete: (endpoint, options = {}) =>
    apiFetch(endpoint, { ...options, method: "DELETE" }),
};
