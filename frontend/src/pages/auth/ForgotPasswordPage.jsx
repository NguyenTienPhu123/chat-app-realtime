import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmailIcon, ShieldIcon } from "../../icons/auth";
import authService from "../../services/auth.service";
import "./ForgotPasswordPage.css";

const RESEND_SECONDS = 15;

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [mounted, setMounted] = useState(false);

  const canResend = countdown === 0;
  const otpValue = otp.join("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (countdown === 0) return;
    const t = setInterval(() => setCountdown((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!email.trim()) {
      setEmailError("Vui lòng nhập email.");
      return;
    }
    setLoading(true);
    setEmailError("");
    setOtpError("");
    setSubmitError("");
    try {
      const result = await authService.requestPasswordResetOtp({
        email: email.trim(),
      });
      setOtpSent(true);
      setOtp(["", "", "", "", "", ""]);
      setCountdown(
        result?.resendAvailableAt
          ? Math.max(
              0,
              Math.ceil((result.resendAvailableAt - Date.now()) / 1000),
            )
          : RESEND_SECONDS,
      );
      // Focus first OTP input
      setTimeout(() => document.getElementById("otp-0")?.focus(), 100);
    } catch (error) {
      setSubmitError(error.response?.data?.message || "Không gửi được OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    setOtpError("");
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!paste) return;
    const next = [...otp];
    paste.split("").forEach((c, i) => {
      if (i < 6) next[i] = c;
    });
    setOtp(next);
    document.getElementById(`otp-${Math.min(paste.length, 5)}`)?.focus();
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpValue.length < 6) {
      setOtpError("Vui lòng nhập đủ 6 chữ số.");
      return;
    }
    try {
      setLoading(true);
      setOtpError("");
      setSubmitError("");
      const result = await authService.verifyPasswordResetOtp({
        email,
        otp: otpValue,
      });
      navigate("/reset-password", {
        state: {
          email,
          resetToken: result.resetToken,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      if (error.response?.status === 400)
        setOtpError("Mã OTP không đúng hoặc đã hết hạn.");
      else
        setSubmitError(error.response?.data?.message || "Xác thực thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fp-root ${mounted ? "fp-mounted" : ""}`}>
      <div className="fp-blob fp-blob-1" />
      <div className="fp-blob fp-blob-2" />
      <div className="fp-grid" />

      <div className="fp-card">
        {/* Back link */}
        <Link to="/login" className="fp-back">
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
          Quay lại đăng nhập
        </Link>

        {/* Header */}
        <div className="fp-header">
          <div className="fp-icon-wrap">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1>{otpSent ? "Nhập mã xác thực" : "Quên mật khẩu"}</h1>
          <p>
            {otpSent
              ? `Mã OTP 6 chữ số đã được gửi đến ${email}`
              : "Nhập email để nhận mã xác thực đặt lại mật khẩu"}
          </p>
        </div>

        {/* Step indicator */}
        <div className="fp-steps">
          <div
            className={`fp-step ${!otpSent ? "fp-step-active" : "fp-step-done"}`}
          >
            <span className="fp-step-num">{otpSent ? "✓" : "1"}</span>
            <span>Nhập email</span>
          </div>
          <div className="fp-step-line" />
          <div className={`fp-step ${otpSent ? "fp-step-active" : ""}`}>
            <span className="fp-step-num">2</span>
            <span>Xác thực OTP</span>
          </div>
          <div className="fp-step-line" />
          <div className="fp-step">
            <span className="fp-step-num">3</span>
            <span>Đặt lại mật khẩu</span>
          </div>
        </div>

        <form onSubmit={handleVerifyOtp} className="fp-form">
          {/* Email field */}
          <div className="fp-field">
            <label>Địa chỉ email</label>
            <div className="fp-input-wrap">
              <span className="fp-input-icon">
                <EmailIcon />
              </span>
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                disabled={otpSent}
                className={emailError ? "fp-input-err" : ""}
              />
              {otpSent && (
                <button
                  type="button"
                  className="fp-change-email"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp(["", "", "", "", "", ""]);
                  }}
                >
                  Sửa
                </button>
              )}
            </div>
            {emailError && <p className="fp-err-text">{emailError}</p>}
          </div>

          {/* Send OTP button */}
          {!otpSent ? (
            <button
              type="button"
              className="fp-btn"
              onClick={handleSendOtp}
              disabled={loading || !email.trim()}
            >
              {loading ? <span className="fp-spinner" /> : "Gửi mã OTP"}
            </button>
          ) : (
            <>
              {/* OTP boxes */}
              <div className="fp-otp-section">
                <div className="fp-otp-boxes" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`fp-otp-box ${otpError ? "fp-otp-err" : ""} ${digit ? "fp-otp-filled" : ""}`}
                    />
                  ))}
                </div>
                {otpError && (
                  <p className="fp-err-text" style={{ textAlign: "center" }}>
                    {otpError}
                  </p>
                )}

                {/* Resend */}
                <div className="fp-resend-row">
                  {canResend ? (
                    <button
                      type="button"
                      className="fp-resend-btn"
                      onClick={handleSendOtp}
                      disabled={loading}
                    >
                      Gửi lại mã
                    </button>
                  ) : (
                    <span className="fp-resend-countdown">
                      Gửi lại sau <strong>{countdown}s</strong>
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="fp-btn fp-btn-verify"
                disabled={loading || otpValue.length < 6}
              >
                {loading ? <span className="fp-spinner" /> : "Xác nhận OTP"}
              </button>
            </>
          )}
        </form>

        {submitError && (
          <div className="fp-error-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            {submitError}
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
