const User = require("../../models/User.model");
const Conversation = require("../../models/Conversation.model");

module.exports = (io, socket) => {
  socket.on("user:online", async () => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      await User.findByIdAndUpdate(userId, {
        status: "online",
        lastSeen: new Date(),
      });

      const conversations = await Conversation.find({
        participants: userId,
        isActive: true,
      }).select("_id participants");

      const notifiedUsers = new Set();
      for (const conv of conversations) {
        conv.participants.forEach((pid) => {
          const p = pid.toString();
          if (p !== userId.toString() && !notifiedUsers.has(p)) {
            notifiedUsers.add(p);
            io.to(`user:${p}`).emit("user:status_changed", {
              userId,
              status: "online",
              lastSeen: new Date(),
            });
          }
        });
      }
    } catch (error) {
      console.error("user:online error:", error);
    }
  });

  socket.on("disconnect", async () => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      await User.findByIdAndUpdate(userId, {
        status: "offline",
        lastSeen: new Date(),
      });

      const conversations = await Conversation.find({
        participants: userId,
        isActive: true,
      }).select("_id participants");

      const notifiedUsers = new Set();
      for (const conv of conversations) {
        conv.participants.forEach((pid) => {
          const p = pid.toString();
          if (p !== userId.toString() && !notifiedUsers.has(p)) {
            notifiedUsers.add(p);
            io.to(`user:${p}`).emit("user:status_changed", {
              userId,
              status: "offline",
              lastSeen: new Date(),
            });
          }
        });
      }
    } catch (error) {
      console.error("disconnect error:", error);
    }
  });

  socket.on("user:change_status", async (data) => {
    try {
      const { status } = data;
      const userId = socket.userId;
      if (!userId) return;

      await User.findByIdAndUpdate(userId, { status, lastSeen: new Date() });

      const conversations = await Conversation.find({
        participants: userId,
        isActive: true,
      }).select("_id participants");

      const notifiedUsers = new Set();
      for (const conv of conversations) {
        conv.participants.forEach((pid) => {
          const p = pid.toString();
          if (p !== userId.toString() && !notifiedUsers.has(p)) {
            notifiedUsers.add(p);
            io.to(`user:${p}`).emit("user:status_changed", {
              userId,
              status,
              lastSeen: new Date(),
            });
          }
        });
      }
    } catch (error) {
      console.error("user:change_status error:", error);
    }
  });

  // Emit lời mời kết bạn realtime đến người nhận
  // Gọi từ controller sau khi sendFriendRequest thành công:
  // io.to(`user:${targetUserId}`).emit("friend:request_received", { fromUser })
};

// Helper để emit từ controller (export riêng)
module.exports.emitFriendRequest = (io, targetUserId, fromUser) => {
  io.to(`user:${targetUserId}`).emit("friend:request_received", { fromUser });
};

module.exports.emitFriendAccepted = (io, toUserId, fromUser) => {
  io.to(`user:${toUserId}`).emit("friend:request_accepted", { fromUser });
};
