const authService = require("../services/auth.service");
const Message = require("../models/Message.model");
const { successResponse, errorResponse } = require("../utils/response.util");

const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refreshToken";

const getRefreshCookieOptions = (maxAge) => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/api/auth",
    maxAge,
  };
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(0));
};

const parseCookie = (req, cookieName) => {
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...val] = part.trim().split("=");
    if (key === cookieName) return decodeURIComponent(val.join("="));
  }
  return null;
};

const extractRefreshTokenFromRequest = (req) =>
  parseCookie(req, REFRESH_COOKIE_NAME);
const buildClientAuthPayload = ({ user, token, expiresAt }) => ({
  user,
  token,
  expiresAt,
});

class AuthController {
  async register(req, res) {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password)
        return errorResponse(
          res,
          "Vui lòng nhập đầy đủ họ tên, email và mật khẩu",
          400,
        );
      const user = await authService.registerUser({ name, email, password });
      const refreshMaxAge = Math.max(0, user.refreshExpiresAt - Date.now());
      res.cookie(
        REFRESH_COOKIE_NAME,
        user.refreshToken,
        getRefreshCookieOptions(refreshMaxAge),
      );
      return successResponse(
        res,
        buildClientAuthPayload(user),
        "Register successfully",
        201,
      );
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return errorResponse(
          res,
          "Vui lòng nhập đầy đủ email và mật khẩu",
          400,
        );
      const user = await authService.loginUser({ email, password });
      const refreshMaxAge = Math.max(0, user.refreshExpiresAt - Date.now());
      res.cookie(
        REFRESH_COOKIE_NAME,
        user.refreshToken,
        getRefreshCookieOptions(refreshMaxAge),
      );
      return successResponse(
        res,
        buildClientAuthPayload(user),
        "Login successfully",
        200,
      );
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }

  async refresh(req, res) {
    try {
      const refreshToken = extractRefreshTokenFromRequest(req);
      const result = await authService.refreshSession({ refreshToken });
      const refreshMaxAge = Math.max(0, result.refreshExpiresAt - Date.now());
      res.cookie(
        REFRESH_COOKIE_NAME,
        result.refreshToken,
        getRefreshCookieOptions(refreshMaxAge),
      );
      return successResponse(
        res,
        buildClientAuthPayload(result),
        "Refresh token successfully",
        200,
      );
    } catch (error) {
      clearRefreshCookie(res);
      return errorResponse(res, error.message, error.statusCode || 401);
    }
  }

  async logout(req, res) {
    try {
      const refreshToken = extractRefreshTokenFromRequest(req);
      await authService.logoutSession({ refreshToken });
      clearRefreshCookie(res);
      return successResponse(
        res,
        { success: true },
        "Đăng xuất thành công",
        200,
      );
    } catch {
      clearRefreshCookie(res);
      return successResponse(
        res,
        { success: true },
        "Đăng xuất thành công",
        200,
      );
    }
  }

  async requestPasswordResetOtp(req, res) {
    try {
      const { email } = req.body;
      if (!email) return errorResponse(res, "email là bắt buộc", 400);
      const result = await authService.requestPasswordResetOtp({ email });
      return successResponse(
        res,
        result,
        "Email tồn tại, mã OTP đã được gửi.",
        200,
      );
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }

  async verifyPasswordResetOtp(req, res) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp)
        return errorResponse(res, "email và otp là bắt buộc", 400);
      const result = await authService.verifyPasswordResetOtp({ email, otp });
      return successResponse(
        res,
        result,
        "OTP đã được xác minh thành công",
        200,
      );
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }

  async resetPassword(req, res) {
    try {
      const { resetToken, password } = req.body;
      if (!resetToken || !password)
        return errorResponse(res, "resetToken và mật khẩu là bắt buộc", 400);
      const result = await authService.resetPassword({ resetToken, password });
      return successResponse(
        res,
        result,
        "Mật khẩu đã được đặt lại thành công",
        200,
      );
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }

  // ─── Friend handlers ─────────────────────────────────────────
  // Dùng req.user.id (middleware set req.user = { id, _id, email })

  async searchUserByEmail(req, res) {
    try {
      const { email } = req.query;
      if (!email) return errorResponse(res, "email là bắt buộc", 400);
      const result = await authService.searchUserByEmail({
        email,
        currentUserId: req.user.id, // ← req.user.id
      });
      return successResponse(res, result, "Tìm kiếm thành công", 200);
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }

  async sendFriendRequest(req, res) {
    try {
      const { targetUserId } = req.body;
      if (!targetUserId)
        return errorResponse(res, "targetUserId là bắt buộc", 400);
      const result = await authService.sendFriendRequest({
        fromUserId: req.user.id, // ← req.user.id
        targetUserId,
      });
      // Emit socket realtime cho người nhận
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${targetUserId}`).emit("friend:request_received", {
          fromUser: result.fromUser,
        });
      }
      return successResponse(
        res,
        { success: true },
        "Đã gửi lời mời kết bạn",
        200,
      );
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }

  async acceptFriendRequest(req, res) {
    try {
      const { fromUserId } = req.body;
      if (!fromUserId) return errorResponse(res, "fromUserId là bắt buộc", 400);

      const result = await authService.acceptFriendRequest({
        currentUserId: req.user.id,
        fromUserId,
      });

      const io = req.app.get("io");
      const store = require("../inMemoryStore");
      const User = require("../models/User.model");
      const Conversation = require("../models/Conversation.model");

      const [me, fromUser] = await Promise.all([
        User.findById(req.user.id).select("_id name email avatar status"),
        User.findById(fromUserId).select("_id name email avatar status"),
      ]);

      // Sync vào store.USERS
      if (me)
        store.USERS[req.user.id] = {
          _id: me._id.toString(),
          name: me.name,
          email: me.email,
          avatar: me.avatar,
          status: me.status || "offline",
        };
      if (fromUser)
        store.USERS[fromUserId] = {
          _id: fromUser._id.toString(),
          name: fromUser.name,
          email: fromUser.email,
          avatar: fromUser.avatar,
          status: fromUser.status || "offline",
        };

      // Tìm hoặc tạo conversation trong MongoDB
      
      let conv = await Conversation.findOne({
  type: "private",
  participants: { $all: [req.user.id, fromUserId] },
});

if (!conv) {
  conv = await Conversation.create({
    type: "private",
    participants: [req.user.id, fromUserId],
    isActive: true,
  });
} else {
  // Xóa deletedFor để hiện lại conversation + xóa toàn bộ tin nhắn cũ
  await Conversation.findByIdAndUpdate(conv._id, {
    $unset: { deletedFor: "" },
    $set: { isActive: true, lastMessage: null },
  });
  await Message.deleteMany({ conversationId: conv._id });
  conv = await Conversation.findById(conv._id);
}

      const convId = conv._id.toString();

      // Sync vào store
      if (!store.CONVERSATIONS[convId]) {
        store.CONVERSATIONS[convId] = {
          _id: convId,
          type: "private",
          participants: [req.user.id, fromUserId],
          isActive: true,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          lastMessage: null,
        };
        store.MESSAGES[convId] = [];
      }

      // Xóa conversation in-memory cũ nếu có
      const oldConvEntry = Object.entries(store.CONVERSATIONS).find(
        ([id, c]) =>
          id !== convId &&
          c.type === "private" &&
          c.participants.includes(req.user.id) &&
          c.participants.includes(fromUserId),
      );
      if (oldConvEntry) {
        delete store.CONVERSATIONS[oldConvEntry[0]];
        delete store.MESSAGES[oldConvEntry[0]];
      }

      if (io) {
        const convForMe = store.getConversationById(convId, req.user.id);
        const convForFrom = store.getConversationById(convId, fromUserId);

        io.to(`user:${req.user.id}`).emit("conversation:new", convForMe);
        io.to(`user:${fromUserId}`).emit("conversation:new", convForFrom);
        io.to(`user:${fromUserId}`).emit("friend:request_accepted", {
          fromUser: me,
          withUserId: fromUserId,
        });
        io.to(`user:${req.user.id}`).emit("friend:request_accepted", {
          fromUser: fromUser,
          withUserId: req.user.id,
        });

        io.sockets.sockets.forEach((s) => {
          if (s.userId === req.user.id || s.userId === fromUserId)
            s.join(`conversation:${convId}`);
        });
      }

      return successResponse(res, result, "Đã chấp nhận lời mời kết bạn", 200);
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }

  async rejectFriendRequest(req, res) {
    try {
      const { fromUserId } = req.body;
      if (!fromUserId) return errorResponse(res, "fromUserId là bắt buộc", 400);
      const result = await authService.rejectFriendRequest({
        currentUserId: req.user.id, // ← req.user.id
        fromUserId,
      });
      return successResponse(res, result, "Đã từ chối lời mời kết bạn", 200);
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }

  async getFriendRequests(req, res) {
    try {
      const result = await authService.getFriendRequests({
        currentUserId: req.user.id, // ← req.user.id
      });
      return successResponse(
        res,
        result,
        "Lấy danh sách lời mời thành công",
        200,
      );
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }

  async getFriends(req, res) {
    try {
      const result = await authService.getFriends({
        currentUserId: req.user.id, // ← req.user.id
      });
      return successResponse(
        res,
        result,
        "Lấy danh sách bạn bè thành công",
        200,
      );
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }

  async removeFriend(req, res) {
    try {
      const { friendId } = req.params;
      const result = await authService.removeFriend({
        currentUserId: req.user.id,
        friendId,
      });

      // ✅ Xóa conversation khỏi store + emit socket
      try {
        const store = require("../inMemoryStore");
        const io = req.app.get("io");

        // Tìm conversation private giữa 2 người
        const convEntry = Object.entries(store.CONVERSATIONS).find(
          ([, c]) =>
            c.type === "private" &&
            c.participants.includes(req.user.id) &&
            c.participants.includes(friendId),
        );

        if (convEntry) {
          const [convId] = convEntry;
          // Xóa khỏi store
          delete store.CONVERSATIONS[convId];
          delete store.MESSAGES[convId];

          // Emit cho cả 2 người để xóa khỏi danh sách
          if (io) {
            // Chỉ emit cho người xóa, bên kia giữ nguyên
            io.to(`user:${req.user.id}`).emit("friend:removed", {
              friendId,
              conversationId: convId,
            });
          }
        }
      } catch (e) {
        console.error("Remove conv after unfriend error:", e);
      }

      return successResponse(res, result, "Đã xóa bạn bè", 200);
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }
  }
  async updateProfile(req, res) {
    try {
      const User = require("../models/User.model");
      const userId = req.user.id;
      const { name, phone, bio, gender, birthDate } = req.body;
      const user = await User.findById(userId);
      if (!user) return errorResponse(res, "Không tìm thấy người dùng", 404);

      if (name && name.trim() !== user.name) {
        const FIFTEEN_DAYS = 15 * 24 * 3600 * 1000;
        const lastChange = user.lastNameChange
          ? user.lastNameChange.getTime()
          : 0;
        const diff = Date.now() - lastChange;
        if (diff < FIFTEEN_DAYS) {
          const daysLeft = Math.ceil(
            (FIFTEEN_DAYS - diff) / (24 * 3600 * 1000),
          );
          return errorResponse(
            res,
            `Chỉ được đổi tên 1 lần / 15 ngày. Còn ${daysLeft} ngày.`,
            400,
          );
        }
        user.name = name.trim();
        user.lastNameChange = new Date();
      }

      if (phone !== undefined) user.phone = phone;
      if (bio !== undefined) user.bio = bio;
      if (gender !== undefined) user.gender = gender;
      if (birthDate !== undefined)
        user.birthDate = birthDate ? new Date(birthDate) : null;

      await user.save();
      // Emit cho tất cả client biết profile thay đổi
      const io = req.app.get("io");
      if (io) {
        io.emit("user:profile_updated", {
          userId: userId.toString(),
          name: user.name,
          avatar: user.avatar,
          bio: user.bio,
          phone: user.phone,
          gender: user.gender,
          birthDate: user.birthDate,
        });
      }

      const userData = user.toObject();
      delete userData.password;
      delete userData.refreshTokens;
      return successResponse(res, userData, "Cập nhật thành công", 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async updateAvatar(req, res) {
    try {
      const User = require("../models/User.model");
      const fs = require("fs");
      const path = require("path");

      if (!req.file) return errorResponse(res, "Không có file ảnh", 400);

      const ext = path.extname(req.file.originalname) || ".jpg";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      const uploadDir = path.join(__dirname, "../../uploads/image");

      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);

      const avatarUrl = `/uploads/image/${filename}`;
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { avatar: avatarUrl },
        { new: true },
      ).select("-password -refreshTokens");

      // Cập nhật store + emit socket cho tất cả client
      const io = req.app.get("io");
      if (io) {
        try {
          const store = require("../inMemoryStore");
          if (store.USERS[req.user.id]) {
            store.USERS[req.user.id].avatar = avatarUrl;
          }
        } catch (e) {}

        io.emit("user:avatar_updated", {
          userId: req.user.id.toString(),
          avatar: avatarUrl,
        });
      }

      return successResponse(res, user, "Cập nhật avatar thành công", 200);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }
  async updateEmail(req, res) {
    try {
      const User = require("../models/User.model");
      const bcrypt = require("bcryptjs");
      const userId = req.user.id;
      const { newEmail, password } = req.body;

      if (!newEmail || !password)
        return errorResponse(res, "Email mới và mật khẩu là bắt buộc", 400);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail))
        return errorResponse(res, "Email không hợp lệ", 400);

      const user = await User.findById(userId).select("+password");
      if (!user) return errorResponse(res, "Không tìm thấy người dùng", 404);

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return errorResponse(res, "Mật khẩu không đúng", 400);

      const existing = await User.findOne({ email: newEmail });
      if (existing && existing._id.toString() !== userId)
        return errorResponse(res, "Email này đã được sử dụng", 400);

      user.email = newEmail;
      await user.save();

      return successResponse(
        res,
        { email: newEmail },
        "Cập nhật email thành công",
        200,
      );
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async changePassword(req, res) {
    try {
      const User = require("../models/User.model");
      const bcrypt = require("bcryptjs");
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword)
        return errorResponse(
          res,
          "Mật khẩu hiện tại và mật khẩu mới là bắt buộc",
          400,
        );

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(newPassword))
        return errorResponse(
          res,
          "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số",
          400,
        );

      const user = await User.findById(userId).select("+password");
      if (!user) return errorResponse(res, "Không tìm thấy người dùng", 404);

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch)
        return errorResponse(res, "Mật khẩu hiện tại không đúng", 400);

      user.password = await bcrypt.hash(newPassword, 12);
      await user.save();

      return successResponse(
        res,
        { success: true },
        "Đổi mật khẩu thành công",
        200,
      );
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async updatePrivacySettings(req, res) {
    try {
      const User = require("../models/User.model");
      const userId = req.user.id;
      const { allowMessagesFrom } = req.body;

      const allowed = ["everyone", "contacts"];
      if (!allowed.includes(allowMessagesFrom))
        return errorResponse(res, "Giá trị không hợp lệ", 400);

      await User.findByIdAndUpdate(userId, {
        "privacySettings.allowMessagesFrom": allowMessagesFrom,
      });

      // THÊM: Emit socket để tất cả client cập nhật real-time
      const io = req.app.get("io");
      if (io) {
        io.emit("user:privacy_changed", {
          userId: userId.toString(),
          allowMessagesFrom,
        });
      }

      return successResponse(
        res,
        { allowMessagesFrom },
        "Cập nhật thành công",
        200,
      );
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }
}

module.exports = new AuthController();
