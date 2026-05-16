import axios from "axios";

const AUTH_KEYS = {
  user: "currentUser",
  token: "accessToken",
  expiresAt: "accessTokenExpiresAt",
};

const clearAuthStorage = () => {
  localStorage.removeItem(AUTH_KEYS.user);
  localStorage.removeItem(AUTH_KEYS.token);
  localStorage.removeItem(AUTH_KEYS.expiresAt);
  sessionStorage.removeItem(AUTH_KEYS.user);
  sessionStorage.removeItem(AUTH_KEYS.token);
  sessionStorage.removeItem(AUTH_KEYS.expiresAt);
};

const getPreferredStorage = () =>
  localStorage.getItem(AUTH_KEYS.user) ? localStorage : sessionStorage;

const persistAuthPayload = (authData) => {
  if (!authData?.token || !authData?.expiresAt || !authData?.user) return;

  const storage = getPreferredStorage();
  storage.setItem(AUTH_KEYS.user, JSON.stringify(authData.user));
  storage.setItem(AUTH_KEYS.token, authData.token);
  storage.setItem(AUTH_KEYS.expiresAt, String(authData.expiresAt));
  window.dispatchEvent(
    new CustomEvent("auth:token-refreshed", { detail: authData }),
  );
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (token) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const onRefreshFailed = () => {
  refreshSubscribers.forEach((callback) => callback(null));
  refreshSubscribers = [];
};

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("accessToken");

  if (!token && !config.url?.startsWith("/auth/")) {
    console.error("❌ CRITICAL: No auth token in storage!");
    console.error("Request:", config.method, config.url);
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const statusCode = err.response?.status;
    const requestUrl = err.config?.url || "";
    const isAuthEndpoint =
      requestUrl.startsWith("/auth/") &&
      !requestUrl.startsWith("/auth/refresh");
    const originalRequest = err.config;

    if (statusCode === 401 && !isAuthEndpoint && !originalRequest?._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token) => {
            if (!token) {
              reject(err);
              return;
            }

            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await refreshClient.post("/auth/refresh");
        const refreshedData = refreshResponse.data?.data || null;
        persistAuthPayload(refreshedData);
        onTokenRefreshed(refreshedData?.token || null);

        if (refreshedData?.token) {
          originalRequest.headers.Authorization = `Bearer ${refreshedData.token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        onRefreshFailed();
        clearAuthStorage();

        if (window.location.pathname !== "/login") {
          window.location.assign("/login");
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (statusCode === 401 && requestUrl.startsWith("/auth/refresh")) {
      clearAuthStorage();

      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    console.error("API error:", err.response?.data?.message || err.message);
    return Promise.reject(err);
  },
);

export default api;
