const Message = require("../models/Message.model");
const Conversation = require("../models/Conversation.model");
const cacheService = require("./cache.service");
const fileService = require("./file.service");

class MessageService {
  async getOrCreatePrivateConversation(senderId, receiverId) {
    const Conversation = require("../models/Conversation.model");

    // Tìm conversation đã có
    let conversation = await Conversation.findOne({
      type: "private",
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      // Tạo mới
      conversation = await Conversation.create({
        type: "private",
        participants: [senderId, receiverId],
        isActive: true,
      });
    }

    return conversation;
  }

  async sendTextMessage(
    conversationId,
    senderId,
    content,
    replyToId = null,
    mentions = [],
  ) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.hasParticipant(senderId)) {
      throw new Error("Unauthorized");
    }

    // THÊM: Kiểm tra privacy nếu là chat 1-1
    if (conversation.type === "private") {
      const User = require("../models/User.model");
      const receiver = conversation.participants.find(
        (p) => p.toString() !== senderId.toString(),
      );
      if (receiver) {
        const receiverUser = await User.findById(receiver).select(
          "privacySettings friends",
        );
        if (receiverUser?.privacySettings?.allowMessagesFrom === "contacts") {
          const isFriend = receiverUser.friends?.some(
            (f) => f.toString() === senderId.toString(),
          );
          if (!isFriend) {
            throw new Error("BLOCKED_STRANGER");
          }
        }
      }
    }

    if (!conversation.canPerformAction(senderId, "sendMessage")) {
      throw new Error("You don't have permission to send messages");
    }

    const messageData = {
      conversationId,
      senderId,
      type: "text",
      content: content.trim(),
      status: "sent",
    };

    if (replyToId) messageData.replyTo = replyToId;
    if (mentions && mentions.length > 0) messageData.mentions = mentions;

    const message = await Message.create(messageData);
    await message.populate("senderId", "name avatar email");

    if (replyToId) {
      await message.populate({
        path: "replyTo",
        select: "content type senderId fileUrl fileName",
        populate: { path: "senderId", select: "name avatar" },
      });
    }

    await this.updateLastMessage(conversationId, message);
    await cacheService.deletePattern(`messages:${conversationId}:*`);

    return message;
  }

  async sendFileMessage(
    conversationId,
    senderId,
    file,
    type = "file",
    caption = "",
    replyToId = null,
  ) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.hasParticipant(senderId)) {
      throw new Error("Unauthorized");
    }

    if (!conversation.canPerformAction(senderId, "sendMessage")) {
      throw new Error("You don't have permission to send messages");
    }

    if (conversation.type === "private") {
      const User = require("../models/User.model");
      const receiver = conversation.participants.find(
        (p) => p.toString() !== senderId.toString(),
      );
      if (receiver) {
        const receiverUser = await User.findById(receiver).select(
          "privacySettings friends",
        );
        if (receiverUser?.privacySettings?.allowMessagesFrom === "contacts") {
          const isFriend = receiverUser.friends?.some(
            (f) => f.toString() === senderId.toString(),
          );
          if (!isFriend) {
            throw new Error("BLOCKED_STRANGER");
          }
        }
      }
    }

    const uploadResult = await fileService.uploadFile(file, type);

    const messageData = {
      conversationId,
      senderId,
      type,
      fileUrl: uploadResult.url,
      fileName: file.originalname,
      fileSize: file.size,
      thumbnail: uploadResult.thumbnail || null,
      status: "sent",
    };

    if (caption && caption.trim()) messageData.caption = caption.trim();
    if (replyToId) messageData.replyTo = replyToId;

    const message = await Message.create(messageData);
    await message.populate("senderId", "name avatar email");

    if (replyToId) {
      await message.populate({
        path: "replyTo",
        select: "content type senderId fileUrl fileName",
        populate: { path: "senderId", select: "name avatar" },
      });
    }

    await this.updateLastMessage(conversationId, message);
    await cacheService.deletePattern(`messages:${conversationId}:*`);

    return message;
  }

  async sendImagesMessage(
    conversationId,
    senderId,
    files,
    caption = "",
    replyToId = null,
  ) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.hasParticipant(senderId)) {
      throw new Error("Unauthorized");
    }

    if (conversation.type === "private") {
      const User = require("../models/User.model");
      const receiver = conversation.participants.find(
        (p) => p.toString() !== senderId.toString(),
      );
      if (receiver) {
        const receiverUser = await User.findById(receiver).select(
          "privacySettings friends",
        );
        if (receiverUser?.privacySettings?.allowMessagesFrom === "contacts") {
          const isFriend = receiverUser.friends?.some(
            (f) => f.toString() === senderId.toString(),
          );
          if (!isFriend) {
            throw new Error("BLOCKED_STRANGER");
          }
        }
      }
    }

    if (!conversation.canPerformAction(senderId, "sendMessage")) {
      throw new Error("You don't have permission to send messages");
    }

    const uploadedImages = [];
    for (const file of files) {
      const uploadResult = await fileService.uploadFile(file, "image");
      uploadedImages.push({
        url: uploadResult.url,
        fileName: file.originalname,
        fileSize: file.size,
      });
    }

    const messageData = {
      conversationId,
      senderId,
      type: "images",
      images: uploadedImages,
      status: "sent",
    };

    if (caption?.trim()) messageData.caption = caption.trim();
    if (replyToId) messageData.replyTo = replyToId;

    const message = await Message.create(messageData);
    await message.populate("senderId", "name avatar email");
    await this.updateLastMessage(conversationId, message);
    await cacheService.deletePattern(`messages:${conversationId}:*`);
    return message;
  }

  async sendVoiceMessage(
    conversationId,
    senderId,
    audioFile,
    duration,
    waveform = [],
  ) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.hasParticipant(senderId)) {
      throw new Error("Unauthorized");
    }

    if (conversation.type === "private") {
      const User = require("../models/User.model");
      const receiver = conversation.participants.find(
        (p) => p.toString() !== senderId.toString(),
      );
      if (receiver) {
        const receiverUser = await User.findById(receiver).select(
          "privacySettings friends",
        );
        if (receiverUser?.privacySettings?.allowMessagesFrom === "contacts") {
          const isFriend = receiverUser.friends?.some(
            (f) => f.toString() === senderId.toString(),
          );
          if (!isFriend) {
            throw new Error("BLOCKED_STRANGER");
          }
        }
      }
    }

    if (!conversation.canPerformAction(senderId, "sendMessage")) {
      throw new Error("You don't have permission to send messages");
    }

    const uploadResult = await fileService.uploadFile(audioFile, "voice");

    const message = await Message.create({
      conversationId,
      senderId,
      type: "voice",
      fileUrl: uploadResult.url,
      fileName: audioFile.originalname,
      fileSize: audioFile.size,
      voiceDuration: duration,
      waveform: waveform,
      status: "sent",
    });

    await message.populate("senderId", "name avatar email");
    await this.updateLastMessage(conversationId, message);
    await cacheService.deletePattern(`messages:${conversationId}:*`);

    return message;
  }

  async editMessage(messageId, userId, newContent) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error("Message not found");
    if (message.senderId.toString() !== userId.toString()) {
      throw new Error("Unauthorized");
    }
    if (message.type !== "text") {
      throw new Error("Can only edit text messages");
    }

    if (!message.editHistory) message.editHistory = [];
    message.editHistory.push({
      content: message.content,
      editedAt: new Date(),
    });

    message.content = newContent.trim();
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();
    await cacheService.deletePattern(`messages:${message.conversationId}:*`);

    return message;
  }

  async forwardMessage(messageId, userId, targetConversationIds) {
    const originalMessage = await Message.findById(messageId).populate(
      "senderId",
      "name avatar",
    );
    if (!originalMessage) throw new Error("Message not found");

    const forwardedMessages = [];

    for (const convId of targetConversationIds) {
      const conversation = await Conversation.findById(convId);
      if (!conversation || !conversation.hasParticipant(userId)) {
        continue;
      }

      if (!conversation.canPerformAction(userId, "sendMessage")) {
        continue;
      }

      const forwardedData = {
        conversationId: convId,
        senderId: userId,
        type: originalMessage.type,
        status: "sent",
        forwardedFrom: {
          messageId: originalMessage._id,
          senderId: originalMessage.senderId._id || originalMessage.senderId,
          conversationId: originalMessage.conversationId,
        },
      };

      // Copy content theo từng loại
      if (originalMessage.type === "text") {
        // text bắt buộc phải có content
        forwardedData.content = originalMessage.content || "";
      }

      if (originalMessage.caption) {
        forwardedData.caption = originalMessage.caption;
      }

      if (originalMessage.fileUrl) {
        forwardedData.fileUrl = originalMessage.fileUrl;
        forwardedData.fileName = originalMessage.fileName;
        forwardedData.fileSize = originalMessage.fileSize;
        forwardedData.thumbnail = originalMessage.thumbnail;
      }

      if (originalMessage.images && originalMessage.images.length > 0) {
        forwardedData.images = originalMessage.images;
      }

      if (originalMessage.voiceDuration) {
        forwardedData.voiceDuration = originalMessage.voiceDuration;
        forwardedData.waveform = originalMessage.waveform;
      }

      try {
        const forwardedMessage = await Message.create(forwardedData);
        await forwardedMessage.populate("senderId", "name avatar email");
        await forwardedMessage.populate(
          "forwardedFrom.senderId",
          "name avatar",
        );

        await this.updateLastMessage(convId, forwardedMessage);
        await cacheService.deletePattern(`messages:${convId}:*`);

        forwardedMessages.push(forwardedMessage);
      } catch (err) {
        console.error(`Forward to conv ${convId} failed:`, err.message);
        // Tiếp tục với conversation tiếp theo thay vì throw
        continue;
      }
    }

    if (forwardedMessages.length === 0) {
      throw new Error("Không thể chia sẻ đến bất kỳ cuộc trò chuyện nào");
    }

    return forwardedMessages;
  }

  async pinMessage(messageId, userId) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error("Message not found");

    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation || !conversation.hasParticipant(userId)) {
      throw new Error("Unauthorized");
    }

    if (!conversation.canPerformAction(userId, "pinMessage")) {
      throw new Error("You don't have permission to pin messages");
    }

    await Message.updateMany(
      { conversationId: message.conversationId, isPinned: true },
      { isPinned: false, pinnedAt: null, pinnedBy: null },
    );

    message.isPinned = true;
    message.pinnedAt = new Date();
    message.pinnedBy = userId;
    await message.save();

    if (!conversation.pinnedMessages) conversation.pinnedMessages = [];
    if (!conversation.pinnedMessages.includes(messageId)) {
      conversation.pinnedMessages.push(messageId);
      await conversation.save();
    }

    await cacheService.deletePattern(`messages:${message.conversationId}:*`);
    await cacheService.deletePattern(`user:conversations:*`);

    return message;
  }

  async unpinMessage(messageId, userId) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error("Message not found");

    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation || !conversation.hasParticipant(userId)) {
      throw new Error("Unauthorized");
    }

    if (!conversation.canPerformAction(userId, "pinMessage")) {
      throw new Error("You don't have permission to unpin messages");
    }

    message.isPinned = false;
    message.pinnedAt = null;
    message.pinnedBy = null;
    await message.save();

    if (conversation.pinnedMessages) {
      conversation.pinnedMessages = conversation.pinnedMessages.filter(
        (id) => id.toString() !== messageId.toString(),
      );
      await conversation.save();
    }

    await cacheService.deletePattern(`messages:${message.conversationId}:*`);
    await cacheService.deletePattern(`user:conversations:*`);

    return message;
  }

  async getPinnedMessages(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.hasParticipant(userId)) {
      throw new Error("Unauthorized");
    }

    const pinnedMessages = await Message.find({
      conversationId,
      isPinned: true,
      isDeleted: false,
    })
      .sort({ pinnedAt: -1 })
      .populate("senderId", "name avatar email")
      .populate("pinnedBy", "name avatar")
      .lean();

    return pinnedMessages;
  }

  async searchMessages(conversationId, userId, query) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.hasParticipant(userId)) {
      throw new Error("Unauthorized");
    }

    const messages = await Message.find({
      conversationId,
      isDeleted: false,
      $or: [
        { content: { $regex: query, $options: "i" } },
        { caption: { $regex: query, $options: "i" } },
        { fileName: { $regex: query, $options: "i" } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("senderId", "name avatar email")
      .lean();

    return messages;
  }

  async getMessages(conversationId, userId, page = 1, limit = 50) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.hasParticipant(userId)) {
      throw new Error("Unauthorized");
    }

    const skip = (page - 1) * limit;

    const messages = await Message.find({
      conversationId,
      isDeleted: false,
      deletedFor: { $ne: userId },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("senderId", "name avatar email")
      .populate({
        path: "replyTo",
        select: "content type senderId fileUrl fileName",
        populate: { path: "senderId", select: "name avatar" },
      })
      .populate("forwardedFrom.senderId", "name avatar")
      .populate("reactions.userId", "name avatar")
      .populate("readBy.userId", "name avatar")
      .lean();

    const total = await Message.countDocuments({
      conversationId,
      isDeleted: false,
    });

    return {
      messages: messages.reverse().map((m) => ({
        ...m,
        readBy: (m.readBy || []).map((r) => ({
          userId: r.userId?._id?.toString() || r.userId?.toString(),
          avatar: r.userId?.avatar || "",
          name: r.userId?.name || "",
          readAt: r.readAt,
        })),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async updateMessageStatus(messageId, userId, status) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error("Message not found");

    if (message.senderId.toString() !== userId.toString()) {
      message.status = status;
      await message.save();
      await cacheService.deletePattern(`messages:${message.conversationId}:*`);
    }
    return message;
  }

  async markAllAsRead(conversationId, userId) {
    await Message.updateMany(
      { conversationId, senderId: { $ne: userId }, status: { $ne: "read" } },
      { status: "read" },
    );

    await Conversation.findByIdAndUpdate(conversationId, {
      $set: {
        [`lastReadAt.${userId}`]: new Date(),
        [`unreadCounts.${userId}`]: 0,
      },
    });

    await cacheService.deletePattern(`messages:${conversationId}:*`);
  }

  async deleteMessage(messageId, userId) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error("Message not found");

    if (!message.deletedFor) message.deletedFor = [];

    if (!message.deletedFor.includes(userId.toString())) {
      message.deletedFor.push(userId.toString());
    }

    await message.save();
    await cacheService.deletePattern(`messages:${message.conversationId}:*`);
    return message;
  }

  async addReaction(messageId, userId, emoji) {
    const message = await Message.findByIdAndUpdate(
      messageId,
      { $push: { reactions: { userId, emoji } } },
      { new: true },
    ).populate("reactions.userId", "name avatar");

    if (!message) throw new Error("Message not found");

    await cacheService.deletePattern(`messages:${message.conversationId}:*`);
    return message;
  }

  async removeReaction(messageId, userId) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error("Message not found");

    message.reactions = message.reactions.filter(
      (r) => r.userId.toString() !== userId.toString(),
    );

    await message.save();
    await cacheService.deletePattern(`messages:${message.conversationId}:*`);

    return message;
  }

  async updateLastMessage(conversationId, message) {
    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) return;

    const senderId =
      message.senderId?._id?.toString() || message.senderId?.toString();

    console.log("updateLastMessage - senderId:", senderId);
    console.log("updateLastMessage - participants:", conversation.participants);

    const unreadUpdate = {};
    for (const participantId of conversation.participants) {
      const pId = participantId.toString();
      console.log(
        "updateLastMessage - pId:",
        pId,
        "senderId:",
        senderId,
        "skip:",
        pId === senderId,
      );
      if (pId === senderId) continue;
      const current = conversation.unreadCounts?.[pId] || 0;
      unreadUpdate[`unreadCounts.${pId}`] = current + 1;
    }
    console.log("updateLastMessage - unreadUpdate:", unreadUpdate);

    const result = await Conversation.findOneAndUpdate(
      { _id: conversationId },
      { $set: { lastMessage: message._id, ...unreadUpdate } },
      { new: true, timestamps: true },
    );
    console.log(
      "updateLastMessage - result unreadCounts:",
      result?.unreadCounts,
    );
    await cacheService.deletePattern(`user:conversations:*`);
  }
}

module.exports = new MessageService();
