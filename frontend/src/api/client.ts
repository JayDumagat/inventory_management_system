import axios from "axios";

const isLocalHost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export const API_BASE_URL = import.meta.env.VITE_API_URL || (isLocalHost ? "http://localhost:3001" : "/api");
const REFRESH_ENDPOINT = API_BASE_URL.endsWith("/api") ? "/auth/refresh" : "/api/auth/refresh";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenantId = localStorage.getItem("currentTenantId");
  if (tenantId) config.headers["x-tenant-id"] = tenantId;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");
        const { data } = await axios.post(`${API_BASE_URL}${REFRESH_ENDPOINT}`, { refreshToken });
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("currentTenantId");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
