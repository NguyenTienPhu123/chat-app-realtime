import React, { createContext, useState, useEffect, useCallback } from "react";
import authService from "../services/auth.service";

export const AuthContext = createContext();

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

const getStoredValue = (key) =>
  localStorage.getItem(key) || sessionStorage.getItem(key);

const isTokenExpired = (expiresAt) =>
  !expiresAt || Number.isNaN(Number(expiresAt)) || Date.now() >= Number(expiresAt);

const getStoredTokenExpiry = () => Number(getStoredValue(AUTH_KEYS.expiresAt));
const getStorageByExistingSession = () =>
  localStorage.getItem(AUTH_KEYS.user) ? localStorage : sessionStorage;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const logout = useCallback(() => {
    authService.logout().catch(() => null).finally(() => {
      setUser(null);
      setIsAuthenticated(false);
      clearAuthStorage();
    });
  }, []);

  const applyAuthPayload = useCallback((authData) => {
    if (!authData?.user?._id || !authData?.token || !authData?.expiresAt) return false;

    const storage = getStorageByExistingSession();
    clearAuthStorage();
    storage.setItem(AUTH_KEYS.user, JSON.stringify(authData.user));
    storage.setItem(AUTH_KEYS.token, authData.token);
    storage.setItem(AUTH_KEYS.expiresAt, String(authData.expiresAt));
    setUser(authData.user);
    setIsAuthenticated(true);
    return true;
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const refreshed = await authService.refreshSession();
      return applyAuthPayload(refreshed);
    } catch {
      return false;
    }
  }, [applyAuthPayload]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const savedUser = getStoredValue(AUTH_KEYS.user);
      const savedToken = getStoredValue(AUTH_KEYS.token);
      const savedExpiresAt = getStoredValue(AUTH_KEYS.expiresAt);

      if (savedUser && savedToken && savedExpiresAt && !isTokenExpired(savedExpiresAt)) {
        try {
          setUser(JSON.parse(savedUser));
          setIsAuthenticated(true);
          setAuthReady(true);
          return;
        } catch {
          clearAuthStorage();
        }
      }

      const refreshed = await refreshSession();
      if (!refreshed) {
        clearAuthStorage();
        setUser(null);
        setIsAuthenticated(false);
      }

      setAuthReady(true);
    };

    bootstrapAuth();
  }, [refreshSession]);

  useEffect(() => {
    const onStorageChange = (event) => {
      if (!Object.values(AUTH_KEYS).includes(event.key)) return;

      const savedUser = getStoredValue(AUTH_KEYS.user);
      const savedToken = getStoredValue(AUTH_KEYS.token);
      const savedExpiresAt = getStoredValue(AUTH_KEYS.expiresAt);

      if (!savedUser || !savedToken || isTokenExpired(savedExpiresAt)) {
        logout();
        return;
      }

      try {
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } catch {
        logout();
      }
    };

    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }, [logout]);

  useEffect(() => {
    const onTokenRefreshed = (event) => {
      const authData = event.detail;
      if (authData?.user?._id) {
        setUser(authData.user);
        setIsAuthenticated(true);
      }
    };

    window.addEventListener("auth:token-refreshed", onTokenRefreshed);
    return () => window.removeEventListener("auth:token-refreshed", onTokenRefreshed);
  }, []);

  const login = (authData, options = {}) => {
    if (!authData?.user?._id || !authData?.token || !authData?.expiresAt) return;

    const { rememberMe = true } = options;
    const storage = rememberMe ? localStorage : sessionStorage;

    clearAuthStorage();
    storage.setItem(AUTH_KEYS.user, JSON.stringify(authData.user));
    storage.setItem(AUTH_KEYS.token, authData.token);
    storage.setItem(AUTH_KEYS.expiresAt, String(authData.expiresAt));
    setUser(authData.user);
    setIsAuthenticated(true);
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, authReady, login, logout, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
};
