const { verifyAccessToken } = require("../config/jwt.config");

// Bảo vệ route backend bằng Bearer token và đưa thông tin user vào req.user.
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Yêu cầu xác thực Bearer token",
    });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.userId,
      _id: payload.userId,
      email: payload.email,
    };
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
};

module.exports = authMiddleware;
