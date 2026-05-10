import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  AxiosError
} from "axios";

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

interface PromiseItem {
  resolve: (token: string) => void;
  reject: (error: Error | AxiosError) => void;
}

const AUTH_KEYS = {
  ACCESS: "accessToken",
  REFRESH: "refreshToken",
  TENANT: "currentTenantId",
} as const;

const getBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://localhost:3001";
  }
  return "";
};

export const API_BASE_URL = getBaseUrl().replace(/\/+$/, "");

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

let isRefreshing = false;
let failedQueue: PromiseItem[] = [];

const processQueue = (error: Error | AxiosError | null, token: string | null = null): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const handleLogout = (): void => {
  Object.values(AUTH_KEYS).forEach((key) => localStorage.removeItem(key));
  window.location.href = "/login";
};

api.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
      const token = localStorage.getItem(AUTH_KEYS.ACCESS);
      const tenantId = localStorage.getItem(AUTH_KEYS.TENANT);

      if (token) config.headers.Authorization = `Bearer ${token}`;
      if (tenantId) config.headers["x-tenant-id"] = tenantId;

      return config;
    },
    (error: AxiosError): Promise<AxiosError> => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError): Promise<unknown> => {
      const originalRequest = error.config as CustomAxiosRequestConfig;

      if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      if (originalRequest.url?.includes("/api/auth/refresh")) {
        handleLogout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
            .then((token) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return api(originalRequest);
            })
            .catch((err: Error | AxiosError) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem(AUTH_KEYS.REFRESH);
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post<AuthResponse>(
            `${API_BASE_URL}/api/auth/refresh`,
            { refreshToken }
        );

        localStorage.setItem(AUTH_KEYS.ACCESS, data.accessToken);
        localStorage.setItem(AUTH_KEYS.REFRESH, data.refreshToken);

        processQueue(null, data.accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        const finalError = refreshError instanceof Error ? refreshError : new Error("Session Expired");
        processQueue(finalError, null);
        handleLogout();
        return Promise.reject(finalError);
      } finally {
        isRefreshing = false;
      }
    }
);