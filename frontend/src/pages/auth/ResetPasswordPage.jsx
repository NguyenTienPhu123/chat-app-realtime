import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LockIcon, ShieldIcon, EyeIcon, EyeOffIcon } from "../../icons/auth";
import authService from "../../services/auth.service";
import "./ForgotPasswordPage.css";
import "./ResetPasswordPage.css";

const ResetPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const passwordStrong = useMemo(
    () => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password),
    [password],
  );

  const passwordMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit =
    passwordStrong && passwordMatch && !!location.state?.resetToken;

  // Password strength
  const strength = useMemo(() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  }, [password]);

  const strengthLabel = [
    "",
    "Rất yếu",
    "Yếu",
    "Trung bình",
    "Mạnh",
    "Rất mạnh",
  ][strength];
  const strengthColor = [
    "",
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#10b981",
    "#059669",
  ][strength];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      setLoading(true);
      setSubmitError("");
      await authService.resetPassword({
        resetToken: location.state.resetToken,
        password,
      });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (error) {
      setSubmitError(
        error.response?.data?.message || "Không đổi được mật khẩu.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fp-root ${mounted ? "fp-mounted" : ""}`}>
      <div className="fp-blob fp-blob-1" />
      <div className="fp-blob fp-blob-2" />
      <div className="fp-grid" />

      <div className="fp-card rp2-card">
        <Link to="/forgot-password" className="fp-back">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Quay lại
        </Link>

        {/* Header */}
        <div className="fp-header">
          <div
            className="fp-icon-wrap"
            style={{ background: "#f0fdf4", color: "#10b981" }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1>Đặt lại mật khẩu</h1>
          <p>
            {location.state?.email
              ? `Tài khoản: ${location.state.email}`
              : "Tạo mật khẩu mới an toàn cho tài khoản của bạn"}
          </p>
        </div>

        {/* Steps */}
        <div className="fp-steps">
          <div className="fp-step fp-step-done">
            <span className="fp-step-num">✓</span>
            <span>Nhập email</span>
          </div>
          <div className="fp-step-line" />
          <div className="fp-step fp-step-done">
            <span className="fp-step-num">✓</span>
            <span>Xác thực OTP</span>
          </div>
          <div className="fp-step-line" />
          <div className="fp-step fp-step-active">
            <span className="fp-step-num">3</span>
            <span>Đặt lại mật khẩu</span>
          </div>
        </div>

        {success ? (
          <div className="rp2-success">
            <div className="rp2-success-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3>Đổi mật khẩu thành công!</h3>
            <p>Đang chuyển hướng đến trang đăng nhập...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="fp-form">
            {/* New password */}
            <div className="fp-field">
              <label>Mật khẩu mới</label>
              <div className="fp-input-wrap">
                <span className="fp-input-icon">
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập mật khẩu mới"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ paddingRight: "44px" }}
                />
                <button
                  type="button"
                  className="rp2-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {/* Strength bar */}
              {password.length > 0 && (
                <div className="rp2-strength">
                  <div className="rp2-strength-bars">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="rp2-strength-bar"
                        style={{
                          background: i <= strength ? strengthColor : "#e2e8f0",
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className="rp2-strength-label"
                    style={{ color: strengthColor }}
                  >
                    {strengthLabel}
                  </span>
                </div>
              )}

              {password.length > 0 && !passwordStrong && (
                <p className="fp-err-text">
                  Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div className="fp-field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label>Xác nhận mật khẩu</label>
                {passwordMatch && (
                  <span
                    style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}
                  >
                    ✓ Khớp
                  </span>
                )}
                {passwordMismatch && (
                  <span
                    style={{ fontSize: 12, color: "#e11d48", fontWeight: 600 }}
                  >
                    ✗ Chưa khớp
                  </span>
                )}
              </div>
              <div className="fp-input-wrap">
                <span className="fp-input-icon">
                  <ShieldIcon />
                </span>
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ paddingRight: "44px" }}
                  className={
                    passwordMatch
                      ? "rp2-input-ok"
                      : passwordMismatch
                        ? "fp-input-err"
                        : ""
                  }
                />
                <button
                  type="button"
                  className="rp2-eye"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {submitError && (
              <div className="fp-error-box">
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
              className="fp-btn fp-btn-verify"
              disabled={!canSubmit || loading}
            >
              {loading ? <span className="fp-spinner" /> : "Cập nhật mật khẩu"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
