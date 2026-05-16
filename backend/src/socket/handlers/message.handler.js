const messageService = require("../../services/message.service");
const notificationService = require("../../services/notification.service");
const Message = require("../../models/Message.model");
const Conversation = require("../../models/Conversation.model");
const cacheService = require("../../services/cache.service");
const User = require("../../models/User.model");
const socketIndex = require("../socket-index");

module.exports = (io, socket) => {
  // Send text message
  socket.on("message:send", async (data) => {
    try {
      const { conversationId, content, replyToId, mentions } = data;
      const senderId = socket.userId;

      if (!senderId) {
        return socket.emit("error", { message: "Not authenticated" });
      }

      // THÊM: Xử lý preview conversation
      let realConversationId = conversationId;
      if (conversationId?.startsWith("preview_")) {
        const receiverId = conversationId.replace("preview_", "");

        // Kiểm tra privacy
        const receiver = await User.findById(receiverId).select(
          "privacySettings friends",
        );
        if (!receiver)
          return socket.emit("error", { message: "User not found" });

        if (receiver.privacySettings?.allowMessagesFrom === "contacts") {
          const isFriend = receiver.friends?.some(
            (f) => f.toString() === senderId,
          );
          if (!isFriend) {
            return socket.emit("error", { message: "BLOCKED_STRANGER" });
          }
        }

        // Tìm hoặc tạo conversation thật
        let conv = await Conversation.findOne({
          type: "private",
          participants: { $all: [senderId, receiverId] },
        });
        if (!conv) {
          conv = await Conversation.create({
            type: "private",
            participants: [senderId, receiverId],
            isActive: true,
          });
          // Emit conversation mới cho cả 2
          io.to(`user:${senderId}`).emit("conversation:new", conv);
          io.to(`user:${receiverId}`).emit("conversation:new", conv);
        }
        realConversationId = conv._id.toString();

        // Join room mới
        socket.join(`conversation:${realConversationId}`);
        // Join room cho receiver nếu đang online
        io.sockets.sockets.forEach((s) => {
          if (s.userId === receiverId)
            s.join(`conversation:${realConversationId}`);
        });
      }

      const message = await messageService.sendTextMessage(
        realConversationId,
        senderId,
        content,
        replyToId,
        mentions,
      );

      const fullMessage = await Message.findById(message._id)
        .populate("senderId", "name avatar email")
        .populate({
          path: "replyTo",
          select: "content type senderId fileUrl fileName",
          populate: { path: "senderId", select: "name avatar" },
        })
        .lean();

      const messageToEmit = {
        ...fullMessage,
        _id: fullMessage._id.toString(),
        conversationId: fullMessage.conversationId.toString(),
        senderId: {
          _id: fullMessage.senderId._id.toString(),
          name: fullMessage.senderId.name,
          avatar: fullMessage.senderId.avatar,
          email: fullMessage.senderId.email,
        },
      };

      io.to(`conversation:${realConversationId}`).emit(
        "message:new",
        messageToEmit,
      );

      // Emit lastMessage update cho sidebar — không cần đợi gì thêm
      // Lấy unread count cho từng participant (trừ sender)
      const convForUnread =
        await Conversation.findById(realConversationId).lean();
      const unreadMap = {};
      if (convForUnread) {
        for (const participantId of convForUnread.participants) {
          const pIdStr = participantId.toString();
          if (pIdStr === senderId) {
            unreadMap[pIdStr] = 0;
            continue;
          }
          const lastReadAt = convForUnread.lastReadAt?.[pIdStr] || null;
          const count = await Message.countDocuments({
            conversationId: convForUnread._id,
            senderId: { $ne: new (require("mongoose").Types.ObjectId)(pIdStr) },
            isDeleted: false,
            isRecalled: { $ne: true },
            ...(lastReadAt ? { createdAt: { $gt: new Date(lastReadAt) } } : {}),
          });
          unreadMap[pIdStr] = count;
        }
      }

      io.to(`conversation:${realConversationId}`).emit(
        "conversation:lastMessage",
        {
          conversationId: realConversationId,
          unreadMap,
          lastMessage: {
            _id: messageToEmit._id,
            content: messageToEmit.content,
            type: messageToEmit.type,
            senderId: messageToEmit.senderId,
            createdAt: messageToEmit.createdAt,
            fileName: messageToEmit.fileName,
            fileUrl: messageToEmit.fileUrl,
            images: messageToEmit.images,
            caption: messageToEmit.caption,
            voiceDuration: messageToEmit.voiceDuration,
            isRecalled: false,
          },
        },
      );

      // Emit conversationId thật về cho sender để frontend cập nhật
      if (conversationId !== realConversationId) {
        socket.emit("conversation:id_updated", {
          oldId: conversationId,
          newId: realConversationId,
        });
      }

      const conversation =
        await Conversation.findById(realConversationId).lean();
      if (conversation) {
        const otherParticipants = conversation.participants
          .map((p) => p.toString())
          .filter((p) => p !== senderId);
        const anyOnline = otherParticipants.some((p) =>
          socketIndex.onlineUsers?.has(p),
        );
        console.log("onlineUsers:", socketIndex.onlineUsers);
        console.log("otherParticipants:", otherParticipants);
        console.log("anyOnline:", anyOnline);
        if (anyOnline) {
          await Message.findByIdAndUpdate(message._id, { status: "delivered" });
          io.to(`conversation:${realConversationId}`).emit("message:status", {
            messageId: message._id.toString(),
            status: "delivered",
          });
        }
      }

      notificationService.notifyNewMessage(fullMessage, realConversationId);
    } catch (error) {
      console.error("message:send error:", error);
      socket.emit("error", { message: error.message });
    }
  });

  // Edit message
  socket.on("message:edit", async (data) => {
    try {
      const { messageId, content } = data;
      const userId = socket.userId;
      if (!userId) return;

      const message = await messageService.editMessage(
        messageId,
        userId,
        content,
      );

      io.to(`conversation:${message.conversationId}`).emit("message:edited", {
        messageId: message._id.toString(),
        content: message.content,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
      });
    } catch (error) {
      console.error("message:edit error:", error);
      socket.emit("error", { message: error.message });
    }
  });

  // Delete message
  socket.on("message:delete", async (data) => {
    try {
      const { messageId } = data;
      const userId = socket.userId;
      if (!userId) return;

      const message = await messageService.deleteMessage(messageId, userId);

      io.to(`conversation:${message.conversationId}`).emit("message:deleted", {
        messageId: message._id.toString(),
      });
    } catch (error) {
      console.error("message:delete error:", error);
      socket.emit("error", { message: error.message });
    }
  });

  // Pin message
  socket.on("message:pin", async (data) => {
    try {
      const { messageId } = data;
      const userId = socket.userId;
      if (!userId) return;

      const message = await messageService.pinMessage(messageId, userId);

      const populatedMessage = await Message.findById(message._id)
        .populate("senderId", "name avatar")
        .lean();

      // Lưu system message vào DB
      const pinner = await User.findById(userId).select("name").lean();
      const pinnerName = pinner?.name || "Người dùng";
      const conversationId = message.conversationId.toString();

      const Conversation = require("../../models/Conversation.model");
      const savedPinMsg = await Message.create({
        conversationId,
        type: "system",
        content: `${pinnerName} đã ghim một tin nhắn`,
        changerId: userId,
        changerName: pinnerName,
        senderId: null,
        reactions: [],
      });
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: savedPinMsg._id,
      });

      const sysMsg = {
        _id: savedPinMsg._id.toString(),
        conversationId,
        type: "system",
        content: savedPinMsg.content,
        changerId: userId,
        changerName: pinnerName,
        senderId: null,
        createdAt: savedPinMsg.createdAt,
        reactions: [],
      };

      io.to(`conversation:${conversationId}`).emit("message:unpinall", {});
      io.to(`conversation:${conversationId}`).emit("message:pinned", {
        messageId: message._id.toString(),
        isPinned: message.isPinned,
        pinnedAt: message.pinnedAt,
        message: populatedMessage,
      });
      io.to(`conversation:${conversationId}`).emit("message:system", sysMsg);
      io.to(`conversation:${conversationId}`).emit("conversation:lastMessage", {
        conversationId,
        lastMessage: {
          _id: sysMsg._id,
          type: "pin",
          content: "",
          senderId: {
            _id: populatedMessage.senderId._id.toString(),
            name: populatedMessage.senderId.name,
            avatar: populatedMessage.senderId.avatar,
          },
          changerId: userId,
          changerName: pinnerName,
          createdAt: message.pinnedAt || new Date(),
        },
      });
    } catch (error) {
      console.error("message:pin error:", error);
      socket.emit("error", { message: error.message });
    }
  });

  // Unpin message
  socket.on("message:unpin", async (data) => {
    try {
      const { messageId } = data;
      const userId = socket.userId;
      if (!userId) return;

      const message = await messageService.unpinMessage(messageId, userId);

      io.to(`conversation:${message.conversationId}`).emit("message:unpinned", {
        messageId: message._id.toString(),
        isPinned: message.isPinned,
      });
    } catch (error) {
      console.error("message:unpin error:", error);
      socket.emit("error", { message: error.message });
    }
  });

  // Add reaction
  // Add reaction
socket.on("message:reaction:add", async (data) => {
  try {
    const { messageId, emoji } = data;
    const userId = socket.userId;
    if (!userId) return;

    const message = await messageService.addReaction(
      messageId,
      userId,
      emoji,
    );

    io.to(`conversation:${message.conversationId}`).emit("message:reaction", {
      messageId: message._id.toString(),
      reactions: message.reactions,
    });

    // Emit cập nhật sidebar
    // Emit cập nhật sidebar
const reactor = await User.findById(userId).select("name").lean();
const reactorName = reactor?.name || "Người dùng";
const conversationId = message.conversationId.toString();
const conv = await Conversation.findById(conversationId).lean();
if (conv) {
  for (const participantId of conv.participants) {
    const pIdStr = participantId.toString();
    if (pIdStr === userId) continue; // bỏ qua người thả cảm xúc
    io.to(`user:${pIdStr}`).emit("conversation:lastMessage", {
      conversationId,
      lastMessage: {
        _id: message._id.toString(),
        type: "reaction",
        emoji,
        senderId: { _id: userId, name: reactorName },
        createdAt: new Date(),
      },
    });
  }
}
  } catch (error) {
      console.error("message:reaction:add error:", error);
      socket.emit("error", { message: error.message });
    }
  });

  // Remove reaction
  socket.on("message:reaction:remove", async (data) => {
    try {
      const { messageId } = data;
      const userId = socket.userId;
      if (!userId) return;

      const message = await messageService.removeReaction(messageId, userId);

      io.to(`conversation:${message.conversationId}`).emit("message:reaction", {
        messageId: message._id.toString(),
        reactions: message.reactions,
      });
    } catch (error) {
      console.error("message:reaction:remove error:", error);
      socket.emit("error", { message: error.message });
    }
  });

  // ✅ Update status (delivered/read)
  socket.on("message:status", async (data) => {
    try {
      const { messageId, status } = data;
      const userId = socket.userId;
      if (!userId || status !== "read") return;

      // ✅ messageId phải là string
      const msgIdStr = messageId?.toString();
      if (!msgIdStr) return;

      const message = await Message.findById(msgIdStr).lean();
      if (!message) return;

      const senderId = message.senderId?.toString();
      if (senderId === userId.toString()) return;

      const conversationId = message.conversationId.toString();

      // Kiểm tra đã đọc chưa
      const alreadyRead = message.readBy?.some(
        (r) => r.userId?.toString() === userId.toString(),
      );
      if (alreadyRead) return;

      // Lưu vào MongoDB
      await Message.findByIdAndUpdate(msgIdStr, {
        $push: { readBy: { userId, readAt: new Date() } },
        $set: { status: "read" },
      });

      const reader = await User.findById(userId).select("name avatar").lean();

      io.to(`conversation:${conversationId}`).emit("message:status", {
        messageId: msgIdStr,
        status: "read",
        readBy: {
          userId: userId.toString(),
          avatar: reader?.avatar || "",
          name: reader?.name || "",
        },
      });
    } catch (error) {
      console.error("message:status error:", error);
    }
  });

  // Star message
  socket.on("message:star", async (data) => {
    try {
      const { messageId } = data;
      const userId = socket.userId;
      if (!userId) return;

      const message = await Message.findById(messageId);
      if (!message) return;

      const alreadyStarred = message.starredBy?.some(
        (s) => s.userId.toString() === userId.toString(),
      );

      if (alreadyStarred) {
        message.starredBy = message.starredBy.filter(
          (s) => s.userId.toString() !== userId.toString(),
        );
      } else {
        message.starredBy.push({ userId, starredAt: new Date() });
      }

      await message.save();

      socket.emit("message:starred", {
        messageId: message._id.toString(),
        isStarred: !alreadyStarred,
      });
    } catch (error) {
      console.error("message:star error:", error);
    }
  });

  // Get starred messages
  socket.on("message:getStarred", async () => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      const messages = await Message.find({
        "starredBy.userId": userId,
        isDeleted: false,
      })
        .populate("senderId", "name avatar")
        .populate("conversationId", "name type participants")
        .sort({ createdAt: -1 })
        .lean();

      const result = messages.map((m) => ({
        ...m,
        starredAt: m.starredBy.find(
          (s) => s.userId.toString() === userId.toString(),
        )?.starredAt,
      }));

      socket.emit("message:starredList", result);
    } catch (error) {
      console.error("message:getStarred error:", error);
    }
  });

  // Đánh dấu tất cả tin nhắn đã đọc khi user mở conversation
  socket.on("conversation:read", async ({ conversationId }) => {
    try {
      const userId = socket.userId;
      if (!userId || !conversationId) return;

      await messageService.markAllAsRead(conversationId, userId);

      // Emit lại để cập nhật unreadCount trên các tab khác của cùng user
      io.to(`user:${userId}`).emit("conversation:marked_read", {
        conversationId,
      });
    } catch (err) {
      console.error("conversation:read error:", err);
    }
  });
  // Recall message
  socket.on("message:recall", async (data) => {
    try {
      const { messageId } = data;
      const userId = socket.userId;
      if (!userId) return;

      const message = await Message.findById(messageId);
      if (!message) return;

      const senderId = message.senderId?.toString();
      if (senderId !== userId.toString()) return;

      await Message.findByIdAndUpdate(messageId, {
        content: "Tin nhắn đã được thu hồi",
        isRecalled: true,
        type: "text",
        fileUrl: null,
        fileName: null,
      });

      const conversationId = message.conversationId.toString();

      io.to(`conversation:${conversationId}`).emit("message:recalled", {
        messageId: messageId.toString(),
        content: "Tin nhắn đã được thu hồi",
        isRecalled: true,
      });

      const sender = await User.findById(userId).select("name avatar").lean();
      io.to(`conversation:${conversationId}`).emit("conversation:lastMessage", {
        conversationId,
        lastMessage: {
          _id: messageId.toString(),
          type: "text",
          content: "Tin nhắn đã được thu hồi",
          isRecalled: true,
          senderId: {
            _id: userId,
            name: sender?.name || "Người dùng",
            avatar: sender?.avatar || "",
          },
          createdAt: new Date(),
        },
      });

      // Cập nhật lastMessage trong Conversation
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: messageId,
      });
    } catch (error) {
      console.error("message:recall error:", error);
    }
  });
  // Set wallpaper
  socket.on(
    "conversation:set_wallpaper",
    async ({ conversationId, wallpaper }) => {
      try {
        const userId = socket.userId;
        if (!userId || !conversationId) return;
        // Broadcast cho tất cả người trong conversation, trừ người gửi
        socket
          .to(`conversation:${conversationId}`)
          .emit("conversation:wallpaper_updated", {
            conversationId,
            wallpaper: wallpaper || "",
          });
      } catch (error) {
        console.error("conversation:set_wallpaper error:", error);
      }
    },
  );
};
