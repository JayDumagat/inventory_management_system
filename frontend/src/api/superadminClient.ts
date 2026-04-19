import axios from "axios";
import { API_BASE_URL } from "./client";

/** Dedicated axios instance that attaches the superadmin JWT. */
export const superadminApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

superadminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("superadminToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

superadminApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("superadminToken");
      window.location.href = "/superadmin/login";
    }
    return Promise.reject(error);
  },
);
