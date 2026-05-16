const rateLimit = require("express-rate-limit");

const createLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
  });

const registerLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Quá nhiều lần đăng ký, vui lòng thử lại sau.",
});

const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Quá nhiều lần đăng nhập, vui lòng thử lại sau.",
});

const forgotPasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Quá nhiều lần yêu cầu đặt lại mật khẩu, vui lòng thử lại sau.",
});

const verifyOtpLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
  message: "Quá nhiều lần xác minh OTP, vui lòng thử lại sau.",
});

module.exports = {
  registerLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  verifyOtpLimiter,
};
