import { api } from "../api/client";

export const authService = {
  login: (email: string, password: string) =>
    api.post("/api/auth/login", { email, password }).then((r) => r.data),
  register: (data: Record<string, unknown>) =>
    api.post("/api/auth/register", data).then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post("/api/auth/forgot-password", { email }).then((r) => r.data),
  resetPassword: (data: Record<string, unknown>) =>
    api.post("/api/auth/reset-password", data).then((r) => r.data),
  oauthGoogle: (credential: string) =>
    api.post("/api/auth/oauth/google", { credential }).then((r) => r.data),
  getMe: () =>
    api.get("/api/auth/me").then((r) => r.data),
  updateMe: (data: Record<string, unknown>) =>
    api.patch("/api/auth/me", data).then((r) => r.data),
  changePassword: (data: Record<string, unknown>) =>
    api.patch("/api/auth/me/password", data).then((r) => r.data),
};
