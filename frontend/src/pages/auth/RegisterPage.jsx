import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Toast from "../../components/Toast";
import {
  PersonIcon,
  EmailIcon,
  LockIcon,
  ShieldIcon,
  EyeIcon,
  EyeOffIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "../../icons/auth";
import authService from "../../services/auth.service";
import "./RegisterPage.css";

const RegisterPage = () => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(
    form.password,
  );
  const passwordMatch =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword;
  const passwordMismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;
  const isFormValid =
    form.name.trim() && form.email.trim() && strongPassword && passwordMatch;

  const handleChange = (e) => {
    if (e.target.name === "email") setEmailError("");
    if (e.target.name === "password") setPasswordError("");
    setSubmitError("");
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setLoading(true);
    setEmailError("");
    setSubmitError("");

    authService
      .register({ name: form.name, email: form.email, password: form.password })
      .then(() => {
        // Toast hiện → sau khi hết giờ hoặc bấm X mới navigate về login
        setToast({
          message: "Tạo tài khoản thành công! Vui lòng đăng nhập.",
          type: "success",
          duration: 2000,
          onDone: () => navigate("/login"),
        });
      })
      .catch((error) => {
        const message =
          error.response?.data?.message ||
          "Đăng ký thất bại. Vui lòng thử lại.";
        if (message.includes("already"))
          setEmailError("Email này đã được sử dụng.");
        else if (message.includes("Password"))
          setPasswordError(
            "Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.",
          );
        else setSubmitError(message);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className={`rp-root ${mounted ? "rp-mounted" : ""}`}>
      <div className="rp-blob rp-blob-1" />
      <div className="rp-blob rp-blob-2" />
      <div className="rp-blob rp-blob-3" />
      <div className="rp-grid" />

      <div className="rp-card">
        {/* Left panel */}
        <div className="rp-panel-left">
          <div className="rp-brand">
            <div className="rp-brand-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <span className="rp-brand-name">ChatApp</span>
          </div>

          <div className="rp-panel-content">
            <h1 className="rp-headline">
              Bắt đầu
              <br />
              <span className="rp-headline-accent">hành trình</span>
              <br />
              của bạn.
            </h1>
            <p className="rp-desc">
              Tạo tài khoản miễn phí và kết nối với bạn bè, đồng nghiệp ngay hôm
              nay.
            </p>
            <div className="rp-steps">
              {[
                { n: "01", label: "Tạo tài khoản" },
                { n: "02", label: "Thêm bạn bè" },
                { n: "03", label: "Bắt đầu trò chuyện" },
              ].map((s) => (
                <div key={s.n} className="rp-step">
                  <span className="rp-step-n">{s.n}</span>
                  <span className="rp-step-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rp-panel-decoration">
            <div className="rp-deco-circle rp-deco-1" />
            <div className="rp-deco-circle rp-deco-2" />
          </div>
        </div>

        {/* Right panel */}
        <div className="rp-panel-right">
          <div className="rp-form-header">
            <h2>Tạo tài khoản</h2>
            <p>Điền thông tin để bắt đầu</p>
          </div>

          <form className="rp-form" onSubmit={handleSubmit}>
            <div className="rp-field">
              <label>Họ và tên</label>
              <div className="rp-input-wrap">
                <span className="rp-input-icon">
                  <PersonIcon />
                </span>
                <input
                  type="text"
                  name="name"
                  placeholder="Nguyễn Văn A"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="rp-field">
              <label>Email</label>
              <div className="rp-input-wrap">
                <span className="rp-input-icon">
                  <EmailIcon />
                </span>
                <input
                  type="email"
                  name="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  className={emailError ? "rp-input-err" : ""}
                />
              </div>
              {emailError && <p className="rp-field-err">{emailError}</p>}
            </div>

            <div className="rp-field">
              <div className="rp-field-row">
                <label>Mật khẩu</label>
                {form.password.length > 0 && !strongPassword && (
                  <span className="rp-hint">
                    Tối thiểu 8 ký tự, chữ hoa, số
                  </span>
                )}
              </div>
              <div className="rp-input-wrap">
                <span className="rp-input-icon">
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  className={passwordError ? "rp-input-err" : ""}
                />
                <button
                  type="button"
                  className="rp-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {passwordError && <p className="rp-field-err">{passwordError}</p>}
            </div>

            <div className="rp-field">
              <div className="rp-field-row">
                <label>Xác nhận mật khẩu</label>
                {passwordMatch && (
                  <span className="rp-badge rp-badge-ok">
                    <CheckCircleIcon /> Khớp
                  </span>
                )}
                {passwordMismatch && (
                  <span className="rp-badge rp-badge-err">
                    <XCircleIcon /> Chưa khớp
                  </span>
                )}
              </div>
              <div className="rp-input-wrap">
                <span className="rp-input-icon">
                  <ShieldIcon />
                </span>
                <input
                  type={showConfirm ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  className={
                    passwordMatch
                      ? "rp-input-ok"
                      : passwordMismatch
                        ? "rp-input-err"
                        : ""
                  }
                />
                <button
                  type="button"
                  className="rp-eye"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {submitError && (
              <div className="rp-error-box">
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

            <button
              type="submit"
              className={`rp-submit ${isFormValid ? "rp-submit-active" : ""}`}
              disabled={!isFormValid || loading}
            >
              {loading ? <span className="rp-spinner" /> : "Tạo tài khoản"}
            </button>
          </form>

          <p className="rp-login-link">
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </p>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration || 2000}
          onDone={() => {
            const cb = toast.onDone;
            setToast(null);
            cb?.();
          }}
        />
      )}
    </div>
  );
};

export default RegisterPage;
