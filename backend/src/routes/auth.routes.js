const express = require("express");
const authController = require("../controllers/auth.controller");
const {
  registerLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  verifyOtpLimiter,
} = require("../middlewares/rate-limit.middleware");
const authMiddleware = require("../middlewares/auth.middleware");
const cacheService = require("../services/cache.service");

const router = express.Router();

// ─── Auth routes (public) ───────────────────────────────────────
router.post("/register", registerLimiter, (req, res) =>
  authController.register(req, res),
);
router.post("/login", loginLimiter, (req, res) =>
  authController.login(req, res),
);
router.post("/forgot-password/request-otp", forgotPasswordLimiter, (req, res) =>
  authController.requestPasswordResetOtp(req, res),
);
router.post("/forgot-password/verify-otp", verifyOtpLimiter, (req, res) =>
  authController.verifyPasswordResetOtp(req, res),
);
router.post("/refresh", (req, res) => authController.refresh(req, res));
router.post("/logout", (req, res) => authController.logout(req, res));
router.post("/reset-password", (req, res) =>
  authController.resetPassword(req, res),
);

// ─── Friend routes (cần đăng nhập) ─────────────────────────────
router.get("/users/search", authMiddleware, (req, res) =>
  authController.searchUserByEmail(req, res),
);
router.post("/friends/send-request", authMiddleware, (req, res) =>
  authController.sendFriendRequest(req, res),
);
router.post("/friends/accept", authMiddleware, async (req, res) => {
  await cacheService.invalidateFriendsList(req.user.id);
  return authController.acceptFriendRequest(req, res);
});
router.post("/friends/reject", authMiddleware, (req, res) =>
  authController.rejectFriendRequest(req, res),
);
router.get("/friends/requests", authMiddleware, (req, res) =>
  authController.getFriendRequests(req, res),
);

// ✅ Cache danh sách bạn bè - TTL 5 phút
router.get("/friends", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const cached = await cacheService.getFriendsList(userId);
    if (cached) {
      return res.json({ success: true, data: cached, _cache: "HIT" });
    }
    // Gọi controller gốc nhưng intercept response
    const originalJson = res.json.bind(res);
    res.json = async (data) => {
      if (data?.success !== false && data?.data) {
        await cacheService.setFriendsList(userId, data.data);
      }
      return originalJson(data);
    };
    return authController.getFriends(req, res);
  } catch (e) {
    return authController.getFriends(req, res);
  }
});

router.delete("/friends/:friendId", authMiddleware, async (req, res) => {
  // Xóa cache khi unfriend
  await cacheService.invalidateFriendsList(req.user.id);
  return authController.removeFriend(req, res);
});

// ✅ Xóa cache khi cập nhật profile
router.patch("/profile", authMiddleware, async (req, res) => {
  await cacheService.invalidateUserProfile(req.user.id);
  return authController.updateProfile(req, res);
});

const uploadMiddleware = require("../middlewares/upload.middleware");
router.patch(
  "/avatar",
  authMiddleware,
  uploadMiddleware.single("avatar"),
  async (req, res) => {
    await cacheService.invalidateUserProfile(req.user.id);
    return authController.updateAvatar(req, res);
  },
);

// ✅ Cache user profile theo userId - TTL 10 phút
const User = require("../models/User.model");
router.get("/users/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const cached = await cacheService.getUserProfile(userId);
    if (cached) {
      return res.json({ data: cached, _cache: "HIT" });
    }
    const user = await User.findById(userId).select(
      "name email phone bio gender birthDate avatar createdAt",
    );
    if (!user) return res.status(404).json({ message: "Không tìm thấy" });
    await cacheService.setUserProfile(userId, user);
    res.json({ data: user });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/change-password", authMiddleware, (req, res) =>
  authController.changePassword(req, res),
);
router.put("/update-email", authMiddleware, (req, res) =>
  authController.updateEmail(req, res),
);

// ✅ Xóa cache khi thay đổi privacy
router.put("/privacy-settings", authMiddleware, async (req, res) => {
  await cacheService.delete(`user:privacy:${req.user.id}`);
  return authController.updatePrivacySettings(req, res);
});

// ✅ Cache privacy settings - TTL 10 phút
router.get("/users/:userId/privacy", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const cacheKey = `user:privacy:${userId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({ data: cached, _cache: "HIT" });
    }
    const u = await User.findById(userId).select("privacySettings");
    if (!u) return res.status(404).json({ message: "User not found" });
    await cacheService.set(cacheKey, u.privacySettings, 600);
    return res.json({ data: u.privacySettings });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

module.exports = router;
