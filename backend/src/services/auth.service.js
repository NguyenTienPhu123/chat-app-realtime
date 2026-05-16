const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User.model");
const {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  decodeToken,
  verifyRefreshToken,
  verifyResetToken,
} = require("../config/jwt.config");
const { sendOtpMail } = require("../config/mail.config");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const isValidEmail = (email) => EMAIL_REGEX.test(email);
const isStrongPassword = (password) => STRONG_PASSWORD_REGEX.test(password);
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 15 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const MAX_REFRESH_TOKENS_PER_USER = 5;
const passwordResetStore = new Map();

const generateOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const hashOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");
const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const isOtpMatch = (providedOtp, expectedHash) => {
  const providedHash = hashOtp(providedOtp);
  const a = Buffer.from(providedHash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const buildForgotPasswordResponse = (
  email,
  resendAvailableAt = Date.now(),
) => ({
  email,
  otpExpiresAt: Date.now() + OTP_TTL_MS,
  resendAvailableAt,
});

const buildAccessAuthResponse = (user) => {
  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    email: user.email,
  });
  const decoded = decodeToken(accessToken);
  return {
    user: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
    },
    token: accessToken,
    expiresAt: decoded?.exp ? decoded.exp * 1000 : null,
  };
};

const cleanupExpiredRefreshTokens = (user) => {
  const now = Date.now();
  user.refreshTokens = (user.refreshTokens || []).filter(
    (s) => new Date(s.expiresAt).getTime() > now,
  );
};

const issueSessionTokens = async (user) => {
  const refreshToken = generateRefreshToken({
    userId: user._id.toString(),
    email: user.email,
    type: "refresh",
  });
  const decodedRefresh = decodeToken(refreshToken);
  const refreshExpiresAt = decodedRefresh?.exp
    ? decodedRefresh.exp * 1000
    : null;

  cleanupExpiredRefreshTokens(user);
  user.refreshTokens.push({
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(refreshExpiresAt),
    createdAt: new Date(),
  });

  if (user.refreshTokens.length > MAX_REFRESH_TOKENS_PER_USER) {
    user.refreshTokens = user.refreshTokens
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, MAX_REFRESH_TOKENS_PER_USER);
  }

  await user.save();
  return { ...buildAccessAuthResponse(user), refreshToken, refreshExpiresAt };
};

class AuthService {
  async registerUser({ name, email, password }) {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName) {
      const e = new Error("Vui lòng nhập tên.");
      e.statusCode = 400;
      throw e;
    }
    if (!isValidEmail(normalizedEmail)) {
      const e = new Error("Vui lòng nhập email hợp lệ");
      e.statusCode = 400;
      throw e;
    }
    if (!isStrongPassword(password)) {
      const e = new Error(
        "Mật khẩu phải có ít nhất 8 ký tự và bao gồm chữ hoa, chữ thường và một số",
      );
      e.statusCode = 400;
      throw e;
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      const e = new Error("Email này đã tồn tại. Vui lòng sử dụng email khác.");
      e.statusCode = 409;
      throw e;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const avatarSeed = encodeURIComponent(normalizedName || normalizedEmail);
    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`,
      status: "offline",
      refreshTokens: [],
      friends: [],
      friendRequests: [],
    });

    return issueSessionTokens(user);
  }

  async loginUser({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail) || !password) {
      const e = new Error("Email hoặc mật khẩu không hợp lệ");
      e.statusCode = 401;
      throw e;
    }
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const e = new Error("Email hoặc mật khẩu không hợp lệ");
      e.statusCode = 401;
      throw e;
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      const e = new Error("Email hoặc mật khẩu không hợp lệ");
      e.statusCode = 401;
      throw e;
    }
    return issueSessionTokens(user);
  }

  async refreshSession({ refreshToken }) {
    if (!refreshToken) {
      const e = new Error("Refresh token is required");
      e.statusCode = 401;
      throw e;
    }
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      const e = new Error("Refresh token không hợp lệ hoặc đã hết hạn");
      e.statusCode = 401;
      throw e;
    }
    if (payload.type !== "refresh") {
      const e = new Error("Refresh token không hợp lệ hoặc đã hết hạn");
      e.statusCode = 401;
      throw e;
    }
    const user = await User.findById(payload.userId);
    if (!user) {
      const e = new Error("Refresh token không hợp lệ hoặc đã hết hạn");
      e.statusCode = 401;
      throw e;
    }
    cleanupExpiredRefreshTokens(user);
    const hash = hashToken(refreshToken);
    if (!user.refreshTokens.some((s) => s.tokenHash === hash)) {
      await user.save();
      const e = new Error("Refresh token không hợp lệ hoặc đã hết hạn");
      e.statusCode = 401;
      throw e;
    }
    user.refreshTokens = user.refreshTokens.filter((s) => s.tokenHash !== hash);
    return issueSessionTokens(user);
  }

  async logoutSession({ refreshToken }) {
    if (!refreshToken) return { success: true };
    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await User.findById(payload.userId);
      if (!user) return { success: true };
      const hash = hashToken(refreshToken);
      cleanupExpiredRefreshTokens(user);
      user.refreshTokens = user.refreshTokens.filter(
        (s) => s.tokenHash !== hash,
      );
      await user.save();
    } catch {
      return { success: true };
    }
    return { success: true };
  }

  async requestPasswordResetOtp({ email }) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      const e = new Error("Vui lòng nhập email hợp lệ");
      e.statusCode = 400;
      throw e;
    }
    const user = await User.findOne({ email: normalizedEmail });
    const existing = passwordResetStore.get(normalizedEmail);
    if (existing && existing.resendAvailableAt > Date.now())
      return buildForgotPasswordResponse(
        normalizedEmail,
        existing.resendAvailableAt,
      );
    if (!user)
      return buildForgotPasswordResponse(
        normalizedEmail,
        Date.now() + OTP_RESEND_DELAY_MS,
      );
    const otp = generateOtp();
    await sendOtpMail({ to: normalizedEmail, otp });
    const otpExpiresAt = Date.now() + OTP_TTL_MS;
    const resendAvailableAt = Date.now() + OTP_RESEND_DELAY_MS;
    passwordResetStore.set(normalizedEmail, {
      userId: user._id.toString(),
      otpHash: hashOtp(otp),
      otpExpiresAt,
      resendAvailableAt,
      attempts: 0,
      verified: false,
    });
    return buildForgotPasswordResponse(normalizedEmail, resendAvailableAt);
  }

  async verifyPasswordResetOtp({ email, otp }) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail) || !otp) {
      const e = new Error("OTP không hợp lệ hoặc đã hết hạn");
      e.statusCode = 400;
      throw e;
    }
    const req = passwordResetStore.get(normalizedEmail);
    if (!req || req.otpExpiresAt < Date.now()) {
      const e = new Error("OTP không hợp lệ hoặc đã hết hạn");
      e.statusCode = 400;
      throw e;
    }
    if (req.attempts >= OTP_MAX_ATTEMPTS) {
      passwordResetStore.delete(normalizedEmail);
      const e = new Error("OTP không hợp lệ hoặc đã hết hạn");
      e.statusCode = 400;
      throw e;
    }
    if (!isOtpMatch(otp, req.otpHash)) {
      req.attempts += 1;
      if (req.attempts >= OTP_MAX_ATTEMPTS)
        passwordResetStore.delete(normalizedEmail);
      else passwordResetStore.set(normalizedEmail, req);
      const e = new Error("OTP không hợp lệ hoặc đã hết hạn");
      e.statusCode = 400;
      throw e;
    }
    req.verified = true;
    req.otpHash = null;
    passwordResetStore.set(normalizedEmail, req);
    const resetToken = generateResetToken({
      userId: req.userId,
      email: normalizedEmail,
      type: "password-reset",
    });
    const decoded = decodeToken(resetToken);
    return { resetToken, expiresAt: decoded?.exp ? decoded.exp * 1000 : null };
  }

  async resetPassword({ resetToken, password }) {
    if (!isStrongPassword(password)) {
      const e = new Error(
        "Mật khẩu phải có ít nhất 8 ký tự và bao gồm chữ hoa, chữ thường và một số",
      );
      e.statusCode = 400;
      throw e;
    }
    let payload;
    try {
      payload = verifyResetToken(resetToken);
    } catch {
      const e = new Error("Reset token không hợp lệ hoặc đã hết hạn");
      e.statusCode = 401;
      throw e;
    }
    if (payload.type !== "password-reset") {
      const e = new Error("Reset token không hợp lệ hoặc đã hết hạn");
      e.statusCode = 401;
      throw e;
    }
    const req = passwordResetStore.get(payload.email);
    if (!req || !req.verified) {
      const e = new Error("Xác thực OTP là bắt buộc");
      e.statusCode = 400;
      throw e;
    }
    const user = await User.findById(payload.userId);
    if (!user) {
      const e = new Error("Người dùng không tồn tại");
      e.statusCode = 404;
      throw e;
    }
    const isSame = await bcrypt.compare(password, user.password);
    if (isSame) {
      const e = new Error("Mật khẩu mới không được trùng mật khẩu cũ");
      e.statusCode = 400;
      throw e;
    }
    user.password = await bcrypt.hash(password, 10);
    user.refreshTokens = [];
    await user.save();
    passwordResetStore.delete(payload.email);
    return { success: true };
  }

  // ─── FRIEND LOGIC ────────────────────────────────────────────────

  // Tìm user theo email (trả về thông tin cơ bản + trạng thái kết bạn)
  async searchUserByEmail({ email, currentUserId }) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      const e = new Error("Email không hợp lệ");
      e.statusCode = 400;
      throw e;
    }

    const target = await User.findOne({ email: normalizedEmail }).select(
      "_id name email avatar status",
    );
    if (!target) {
      const e = new Error("Không tìm thấy người dùng với email này");
      e.statusCode = 404;
      throw e;
    }
    if (target._id.toString() === currentUserId) {
      const e = new Error("Không thể tìm kiếm chính mình");
      e.statusCode = 400;
      throw e;
    }

    const currentUser = await User.findById(currentUserId).select(
      "friends friendRequests",
    );

    const isFriend = currentUser.friends.some(
      (f) => f.toString() === target._id.toString(),
    );

    // Kiểm tra đã gửi lời mời chưa
    const targetUser = await User.findById(target._id).select("friendRequests");
    const hasSentRequest = targetUser.friendRequests.some(
      (r) => r.from.toString() === currentUserId && r.status === "pending",
    );

    // Kiểm tra người kia đã gửi lời mời cho mình chưa
    const hasReceivedRequest = currentUser.friendRequests.some(
      (r) =>
        r.from.toString() === target._id.toString() && r.status === "pending",
    );

    return {
      user: {
        _id: target._id,
        name: target.name,
        email: target.email,
        avatar: target.avatar,
        status: target.status,
      },
      isFriend,
      hasSentRequest,
      hasReceivedRequest,
    };
  }

  // Gửi lời mời kết bạn
  async sendFriendRequest({ fromUserId, targetUserId }) {
    if (fromUserId === targetUserId) {
      const e = new Error("Không thể gửi lời mời cho chính mình");
      e.statusCode = 400;
      throw e;
    }

    const target = await User.findById(targetUserId);
    if (!target) {
      const e = new Error("Người dùng không tồn tại");
      e.statusCode = 404;
      throw e;
    }

    // Kiểm tra đã là bạn chưa
    if (target.friends.some((f) => f.toString() === fromUserId)) {
      const e = new Error("Hai người đã là bạn bè");
      e.statusCode = 400;
      throw e;
    }

    // Kiểm tra đã gửi lời mời chưa
    const alreadySent = target.friendRequests.some(
      (r) => r.from.toString() === fromUserId && r.status === "pending",
    );
    if (alreadySent) {
      const e = new Error("Bạn đã gửi lời mời kết bạn rồi");
      e.statusCode = 400;
      throw e;
    }

    target.friendRequests.push({ from: fromUserId, status: "pending" });
    await target.save();

    // Lấy thông tin người gửi để trả về (dùng cho socket emit)
    const fromUser = await User.findById(fromUserId).select(
      "_id name email avatar",
    );

    return { success: true, fromUser, targetUserId };
  }

  // Chấp nhận lời mời
  async acceptFriendRequest({ currentUserId, fromUserId }) {
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      const e = new Error("Người dùng không tồn tại");
      e.statusCode = 404;
      throw e;
    }

    const request = currentUser.friendRequests.find(
      (r) => r.from.toString() === fromUserId && r.status === "pending",
    );
    if (!request) {
      const e = new Error("Không tìm thấy lời mời kết bạn");
      e.statusCode = 404;
      throw e;
    }

    request.status = "accepted";

    // Thêm bạn 2 chiều
    if (!currentUser.friends.includes(fromUserId))
      currentUser.friends.push(fromUserId);
    await currentUser.save();

    const fromUser = await User.findById(fromUserId);
    if (fromUser && !fromUser.friends.includes(currentUserId)) {
      fromUser.friends.push(currentUserId);
      await fromUser.save();
    }

    return { success: true };
  }

  // Từ chối lời mời
  async rejectFriendRequest({ currentUserId, fromUserId }) {
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      const e = new Error("Người dùng không tồn tại");
      e.statusCode = 404;
      throw e;
    }

    const request = currentUser.friendRequests.find(
      (r) => r.from.toString() === fromUserId && r.status === "pending",
    );
    if (!request) {
      const e = new Error("Không tìm thấy lời mời kết bạn");
      e.statusCode = 404;
      throw e;
    }

    request.status = "rejected";
    await currentUser.save();

    return { success: true };
  }

  // Lấy danh sách lời mời đến (pending)
  async getFriendRequests({ currentUserId }) {
    const user = await User.findById(currentUserId).populate({
      path: "friendRequests.from",
      select: "_id name email avatar status",
    });

    const pending = user.friendRequests.filter((r) => r.status === "pending");
    return { requests: pending };
  }

  // Lấy danh sách bạn bè
  async getFriends({ currentUserId }) {
    const user = await User.findById(currentUserId).populate({
      path: "friends",
      select: "_id name email avatar status",
    });

    return { friends: user.friends };
  }
  async removeFriend({ currentUserId, friendId }) {
    const [userA, userB] = await Promise.all([
      User.findById(currentUserId),
      User.findById(friendId),
    ]);
    if (!userA || !userB) {
      const e = new Error("Người dùng không tồn tại");
      e.statusCode = 404;
      throw e;
    }
    // Xóa 2 chiều
    userA.friends = userA.friends.filter((f) => f.toString() !== friendId);
    userB.friends = userB.friends.filter((f) => f.toString() !== currentUserId);
    await Promise.all([userA.save(), userB.save()]);
    return { success: true };
  }
}

module.exports = new AuthService();
