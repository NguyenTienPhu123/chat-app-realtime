import api from "./api.service";

class AuthService {
  async register(payload) {
    const response = await api.post("/auth/register", payload);
    return response.data.data || response.data;
  }

  async login(payload) {
    const response = await api.post("/auth/login", payload);
    return response.data.data || response.data;
  }

  async requestPasswordResetOtp(payload) {
    const response = await api.post("/auth/forgot-password/request-otp", payload);
    return response.data.data || response.data;
  }

  async verifyPasswordResetOtp(payload) {
    const response = await api.post("/auth/forgot-password/verify-otp", payload);
    return response.data.data || response.data;
  }

  async resetPassword(payload) {
    const response = await api.post("/auth/reset-password", payload);
    return response.data.data || response.data;
  }

  async refreshSession() {
    const response = await api.post("/auth/refresh");
    return response.data.data || response.data;
  }

  async logout() {
    const response = await api.post("/auth/logout");
    return response.data.data || response.data;
  }
}

export default new AuthService();