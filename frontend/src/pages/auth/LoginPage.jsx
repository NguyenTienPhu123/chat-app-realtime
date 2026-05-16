import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmailIcon, LockIcon, EyeIcon, EyeOffIcon } from "../../icons/auth";
import { useAuth } from "../../hooks/useAuth";
import authService from "../../services/auth.service";
import Toast from "../../components/Toast";
import "./LoginPage.css";

const REMEMBERED_EMAIL_KEY = "rememberedEmail";
const REMEMBERED_PWD_KEY = "rememberedPwd";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setMounted(true);
    const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    const rememberedPwd = localStorage.getItem(REMEMBERED_PWD_KEY);
    if (!rememberedEmail) return;
    setEmail(rememberedEmail);
    if (rememberedPwd) setPassword(rememberedPwd);
    setRememberMe(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSubmitError("");
    try {
      const authData = await authService.login({ email, password });

      if (rememberMe) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        localStorage.setItem(REMEMBERED_PWD_KEY, password);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        localStorage.removeItem(REMEMBERED_PWD_KEY);
      }

      login(authData, { rememberMe });

      // Toast hiện → sau khi toast done (hết giờ hoặc bấm X) mới navigate
      setToast({
        message: "Đăng nhập thành công!",
        type: "success",
        onDone: () => navigate("/chat"),
      });
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Đăng nhập thất bại. Vui lòng thử lại.";
      if (message === "Invalid email or password") {
        setSubmitError("Email hoặc mật khẩu không đúng.");
      } else {
        setSubmitError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`lp-root ${mounted ? "lp-mounted" : ""}`}>
      <div className="lp-blob lp-blob-1" />
      <div className="lp-blob lp-blob-2" />
      <div className="lp-blob lp-blob-3" />
      <div className="lp-grid" />

      <div className="lp-card">
        {/* Left panel */}
        <div className="lp-panel-left">
          <div className="lp-brand">
            <div className="lp-brand-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <span className="lp-brand-name">ChatApp</span>
          </div>

          <div className="lp-panel-content">
            <h1 className="lp-headline">
              Kết nối
              <br />
              <span className="lp-headline-accent">mọi lúc</span>
              <br />
              mọi nơi.
            </h1>
            <p className="lp-desc">
              Nhắn tin, chia sẻ file và trò chuyện nhóm — tất cả trong một nơi.
            </p>
            <div className="lp-features">
              {[
                "Bảo mật đầu-cuối",
                "Nhắn tin thời gian thực",
                "Chia sẻ file dễ dàng",
              ].map((f) => (
                <div key={f} className="lp-feature-item">
                  <span className="lp-feature-dot" />
                  {f}
                </div>
              ))}
            </div>
          </div>

          <div className="lp-panel-decoration">
            <div className="lp-deco-circle lp-deco-1" />
            <div className="lp-deco-circle lp-deco-2" />
          </div>
        </div>

        {/* Right panel */}
        <div className="lp-panel-right">
          <div className="lp-form-header">
            <h2>Đăng nhập</h2>
            <p>Chào mừng trở lại!</p>
          </div>

          <form className="lp-form" onSubmit={handleSubmit}>
            <div className="lp-field">
              <label>Email</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon">
                  <EmailIcon />
                </span>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSubmitError("");
                  }}
                  autoComplete="email"
                  className={submitError ? "lp-input-err" : ""}
                />
              </div>
            </div>

            <div className="lp-field">
              <div className="lp-field-row">
                <label>Mật khẩu</label>
                <Link to="/forgot-password" className="lp-forgot">
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="lp-input-wrap">
                <span className="lp-input-icon">
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setSubmitError("");
                  }}
                  autoComplete="current-password"
                  className={submitError ? "lp-input-err" : ""}
                />
                <button
                  type="button"
                  className="lp-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {submitError && (
              <div className="lp-error-box">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                {submitError}
              </div>
            )}

            <div className="lp-remember">
              <label className="lp-check-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="lp-checkmark" />
                Ghi nhớ đăng nhập
              </label>
            </div>

            <button
              type="submit"
              className="lp-submit"
              disabled={loading || !email || !password}
            >
              {loading ? <span className="lp-spinner" /> : "Đăng nhập"}
            </button>
          </form>

          <p className="lp-register-link">
            Chưa có tài khoản? <Link to="/register">Tạo tài khoản</Link>
          </p>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={2000}
          onDone={() => {
            const cb = toast.onDone;
            setToast(null);
            cb?.(); // navigate sau khi thanh chạy hết + animation out 400ms
          }}
        />
      )}
    </div>
  );
};

export default LoginPage;
