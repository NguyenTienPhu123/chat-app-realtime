const jwt = require("jsonwebtoken");

if (!process.env.JWT_SECRET) {
	throw new Error("Thiếu biến môi trường: JWT_SECRET");
}

const JWT_SECRET = process.env.JWT_SECRET;
const RESET_TOKEN_SECRET = process.env.RESET_TOKEN_SECRET || JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "60m";
const RESET_TOKEN_EXPIRES_IN = process.env.RESET_TOKEN_EXPIRES_IN || "5m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

// Tạo access token ngắn hạn để xác thực request HTTP từ frontend.
const generateAccessToken = (payload) =>
	jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

// Tạo reset token ngắn hạn để cho phép đổi mật khẩu sau khi xác thực OTP.
const generateResetToken = (payload) =>
	jwt.sign(payload, RESET_TOKEN_SECRET, { expiresIn: RESET_TOKEN_EXPIRES_IN });

// Tạo refresh token dài hạn để xin access token mới mà không cần nhập lại mật khẩu.
const generateRefreshToken = (payload) =>
	jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });

// Xác minh access token và trả về payload nếu hợp lệ.
const verifyAccessToken = (token) => jwt.verify(token, JWT_SECRET);

// Xác minh reset token trước khi cập nhật mật khẩu mới.
const verifyResetToken = (token) => jwt.verify(token, RESET_TOKEN_SECRET);

// Xác minh refresh token trước khi cấp access token mới.
const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_TOKEN_SECRET);

// Giải mã token mà không verify để lấy thông tin hết hạn phục vụ frontend.
const decodeToken = (token) => jwt.decode(token);

module.exports = {
	generateAccessToken,
	generateResetToken,
	generateRefreshToken,
	verifyAccessToken,
	verifyResetToken,
	verifyRefreshToken,
	decodeToken,
	JWT_EXPIRES_IN,
	RESET_TOKEN_EXPIRES_IN,
	REFRESH_TOKEN_EXPIRES_IN,
};
