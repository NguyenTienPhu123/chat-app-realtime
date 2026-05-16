const fs = require("fs");
const path = require("path");
const { verifyAccessToken } = require("../config/jwt.config");
const callHandler = require("./handlers/call.handler"); // ← THÊM MỚI
const messageHandler = require("./handlers/message.handler");

const DELETED_FILE = path.join(__dirname, "../../deletedMessages.json");

const loadDeletedFor = () => {
  try {
    if (fs.existsSync(DELETED_FILE)) {
      return JSON.parse(fs.readFileSync(DELETED_FILE, "utf8"));
    }
  } catch (e) {}
  return {}; // { messageId: [userId1, userId2] }
};

const saveDeletedFor = (data) => {
  try {
    fs.writeFileSync(DELETED_FILE, JSON.stringify(data), "utf8");
  } catch (e) {}
};

const deletedForData = loadDeletedFor();

const onlineUsers = new Set();
module.exports.onlineUsers = onlineUsers;

module.exports = (io, store) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.userId = payload.userId;
      socket.userEmail = payload.email;
      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;

    if (userId) {
      socket.userId = userId;
      socket.join(`user:${userId}`);
      onlineUsers.add(userId);
      console.log(`✅ User ${userId} connected, online: ${onlineUsers.size}`);

      // Join từ MongoDB thay vì store cứng
      // Join từ store trước (luôn hoạt động)
      const userConvsFromStore = Object.values(store.CONVERSATIONS).filter(
        (c) => c.participants.includes(userId),
      );
      userConvsFromStore.forEach((conv) => {
        socket.join(`conversation:${conv._id}`);
      });

      // Join thêm từ MongoDB nếu kết nối được
      try {
        const mongoose = require("mongoose");
        if (mongoose.connection.readyState === 1) {
          const Conversation = require("../models/Conversation.model");
          const userConversations = await Conversation.find({
            participants: userId,
          }).lean();
          userConversations.forEach((conv) => {
            socket.join(`conversation:${conv._id.toString()}`);
          });
        }
      } catch (e) {
        console.error("Join MongoDB conversations error:", e);
      }

      // Thông báo cho tất cả biết user này online
      socket.isHidingOnline = false;
      socket.broadcast.emit("user:status_changed", {
        userId,
        status: "online",
      });
      // Gửi trạng thái online của TẤT CẢ user đang online cho user mới
      const onlineUserIds = [...onlineUsers].filter((id) => id !== userId);
      socket.emit("users:online", onlineUserIds);
    }

    // Khi user connect → deliver tất cả tin nhắn sent của người khác gửi cho mình
    if (userId) {
      try {
        // In-memory store
        Object.keys(store.MESSAGES).forEach((convId) => {
          const conv = store.CONVERSATIONS[convId];
          if (!conv?.participants.includes(userId)) return;

          const undelivered = (store.MESSAGES[convId] || []).filter((m) => {
            const sid = m.senderId?._id?.toString() || m.senderId?.toString();
            return sid !== userId.toString() && m.status === "sent";
          });

          undelivered.forEach((msg) => {
            store.updateMessageStatus(msg._id, convId, "delivered");
            const senderId =
              msg.senderId?._id?.toString() || msg.senderId?.toString();
            io.to(`user:${senderId}`).emit("message:status", {
              messageId: msg._id,
              status: "delivered",
            });
          });
        });

        // MongoDB
        const mongoose = require("mongoose");
        if (mongoose.connection.readyState === 1) {
          const Message = require("../models/Message.model");
          const Conversation = require("../models/Conversation.model");

          const userConvs = await Conversation.find({
            participants: userId,
          }).lean();
          for (const conv of userConvs) {
            const undelivered = await Message.find({
              conversationId: conv._id,
              status: "sent",
              senderId: { $ne: userId },
            }).lean();

            for (const msg of undelivered) {
              await Message.findByIdAndUpdate(msg._id, { status: "delivered" });
              const senderId = msg.senderId?.toString();
              io.to(`user:${senderId}`).emit("message:status", {
                messageId: msg._id.toString(),
                status: "delivered",
              });
            }
          }
        }
      } catch (e) {
        console.error("Auto-deliver on connect error:", e);
      }
    }

    // ===== CALL HANDLER ===== // ← THÊM MỚI
    callHandler(io, socket, store);
    messageHandler(io, socket);
    // Gửi pending call cho user vừa đăng nhập
    const pendingCalls = callHandler.pendingCalls;
    if (userId && pendingCalls.has(userId)) {
      const pending = pendingCalls.get(userId);
      const elapsed = Date.now() - pending.timestamp;
      if (elapsed < 40000) {
        socket.emit("call:incoming", pending.payload);
        console.log(`📞 Sent pending call to newly logged-in user: ${userId}`);
      }
      clearTimeout(pending.timerId);
      pendingCalls.delete(userId);
    }

    socket.on("conversation:join", async (conversationId) => {
      socket.join(`conversation:${conversationId}`);

      // Emit danh sách messageId đã xóa cho user này
      if (socket.userId) {
        const msgs = store.MESSAGES[conversationId] || [];
        const deletedIds = msgs
          .filter((m) => {
            const fromFile = deletedForData[m._id] || [];
            return fromFile.includes(socket.userId);
          })
          .map((m) => m._id);
        if (deletedIds.length > 0) {
          socket.emit("message:deletedList", { deletedIds });
        }
      }

      if (socket.userId) {
        try {
          // Auto-deliver: chỉ deliver tin nhắn của NGƯỜI KHÁC gửi cho mình
          // KHÔNG deliver tin nhắn của chính mình gửi

          // In-memory store
          const undelivered = store.getDeliveredMessages(
            conversationId,
            socket.userId,
          );
          for (const msg of undelivered) {
            store.updateMessageStatus(msg._id, conversationId, "delivered");
            // Chỉ notify người gửi, không broadcast toàn room
            const senderId =
              msg.senderId?._id?.toString() || msg.senderId?.toString();
            io.to(`user:${senderId}`).emit("message:status", {
              messageId: msg._id,
              status: "delivered",
            });
          }

          // MongoDB
          const mongoose = require("mongoose");
          if (
            mongoose.connection.readyState === 1 &&
            mongoose.Types.ObjectId.isValid(conversationId)
          ) {
            const Message = require("../models/Message.model");
            const Conversation = require("../models/Conversation.model");

            const conv = await Conversation.findById(conversationId).lean();
            if (conv) {
              const undeliveredDB = await Message.find({
                conversationId,
                status: "sent",
                senderId: { $ne: socket.userId },
              }).lean();

              for (const msg of undeliveredDB) {
                await Message.findByIdAndUpdate(msg._id, {
                  status: "delivered",
                });
                // Chỉ notify người gửi
                const senderId = msg.senderId?.toString();
                io.to(`user:${senderId}`).emit("message:status", {
                  messageId: msg._id.toString(),
                  status: "delivered",
                });
              }
            }
          }
        } catch (e) {
          console.error("Auto-deliver error:", e);
        }
      }
    });

    socket.on("conversation:leave", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("user:online", () => {
      if (!socket.userId) return;
      socket.isHidingOnline = false;
      if (onlineUsers.has(socket.userId)) return;
      onlineUsers.add(socket.userId);
      socket.broadcast.emit("user:status_changed", {
        userId: socket.userId,
        status: "online",
      });
    });

    socket.on("user:hide_online", () => {
      if (!socket.userId) return;
      socket.isHidingOnline = true;
      // Xóa khỏi danh sách online với người khác
      onlineUsers.delete(socket.userId);
      socket.broadcast.emit("user:status_changed", {
        userId: socket.userId,
        status: "offline",
      });
    });

    // ===== USER OFFLINE (manual) =====
    socket.on("user:offline", () => {
      // Handled by disconnect
    });

    // ===== TYPING =====
    socket.on("typing:start", (data) => {
      const { conversationId } = data;
      const user = store.USERS[socket.userId];
      socket.to(`conversation:${conversationId}`).emit("typing:start", {
        conversationId,
        userId: socket.userId,
        name: user?.name || "Người dùng",
        avatar: user?.avatar || "",
      });
    });

    socket.on("typing:stop", (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit("typing:stop", {
        conversationId,
        userId: socket.userId,
      });
    });

    // ===== WALLPAPER =====
    socket.on("conversation:set_wallpaper", async (data) => {
      const { conversationId, wallpaper } = data;
      if (!socket.userId) return;

      // ✅ THÊM: chặn nếu nhóm đã giải tán
      const conv = store.CONVERSATIONS[conversationId];
      if (conv?.isDissolved) return;

      let changerName = store.USERS[socket.userId]?.name || "Người dùng";
      let changerAvatar = store.USERS[socket.userId]?.avatar || "";
      try {
        const mongoose = require("mongoose");
        if (mongoose.connection.readyState === 1) {
          const User = require("../models/User.model");
          const dbUser = await User.findById(socket.userId)
            .select("name avatar")
            .lean();
          if (dbUser) {
            changerName = dbUser.name || changerName;
            changerAvatar = dbUser.avatar || changerAvatar;
            store.USERS[socket.userId] = {
              ...store.USERS[socket.userId],
              name: changerName,
              avatar: changerAvatar,
            };
          }
        }
      } catch (e) {}

      // Tạo system message thông báo đổi ảnh nền
      const Message = require("../models/Message.model");
      const mongoose = require("mongoose");
      let sysMsg;
      try {
        if (
          mongoose.connection.readyState === 1 &&
          mongoose.Types.ObjectId.isValid(conversationId)
        ) {
          const savedWpMsg = await Message.create({
            conversationId,
            type: "system",
            subType: "wallpaper_changed",
            wallpaper: wallpaper || "",
            changerId: socket.userId,
            changerName,
            content: wallpaper
              ? `${changerName} đã thay đổi ảnh nền cuộc hội thoại`
              : `${changerName} đã xóa ảnh nền cuộc hội thoại`,
            senderId: null,
            reactions: [],
          });
          await require("../models/Conversation.model").findByIdAndUpdate(
            conversationId,
            {
              lastMessage: savedWpMsg._id,
            },
          );
          sysMsg = {
            _id: savedWpMsg._id.toString(),
            conversationId,
            type: "system",
            subType: "wallpaper_changed",
            wallpaper: wallpaper || "",
            changerId: socket.userId,
            changerName,
            content: savedWpMsg.content,
            senderId: null,
            createdAt: savedWpMsg.createdAt,
            reactions: [],
          };
        }
      } catch (e) {
        console.error("Save wallpaper system message error:", e);
      }
      if (!sysMsg) {
        sysMsg = {
          _id: `sys_wp_${Date.now()}`,
          conversationId,
          type: "system",
          subType: "wallpaper_changed",
          wallpaper: wallpaper || "",
          changerId: socket.userId,
          changerName,
          content: wallpaper
            ? `${changerName} đã thay đổi ảnh nền cuộc hội thoại`
            : `${changerName} đã xóa ảnh nền cuộc hội thoại`,
          senderId: null,
          createdAt: new Date(),
          reactions: [],
        };
      }

      // Broadcast system message cho cả phòng (hiện giữa chat)
      io.to(`conversation:${conversationId}`).emit("message:system", sysMsg);

      // Broadcast đổi ảnh nền cho cả phòng
      io.to(`conversation:${conversationId}`).emit(
        "conversation:wallpaper_changed",
        {
          conversationId,
          wallpaper: wallpaper || "",
          changerId: socket.userId,
        },
      );

      // Cập nhật lastMessage cho sidebar
      if (store.CONVERSATIONS[conversationId]) {
        store.CONVERSATIONS[conversationId].lastMessage = {
          _id: sysMsg._id,
          type: "system",
          content: sysMsg.content,
          senderId: null,
          createdAt: sysMsg.createdAt,
        };
        io.to(`conversation:${conversationId}`).emit(
          "conversation:lastMessage",
          {
            conversationId,
            lastMessage: store.CONVERSATIONS[conversationId].lastMessage,
          },
        );
      }
    });
    // ===== DISCONNECT =====
    socket.on("disconnect", () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        // Chỉ emit offline nếu không đang ẩn (vì đã ẩn rồi thì người khác đã thấy offline)
        if (!socket.isHidingOnline) {
          socket.broadcast.emit("user:status_changed", {
            userId: socket.userId,
            status: "offline",
          });
        }
      }
    });
  });
};
module.exports.onlineUsers = onlineUsers;