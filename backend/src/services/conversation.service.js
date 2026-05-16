const Conversation = require("../models/Conversation.model");
const Message = require("../models/Message.model");
const cacheService = require("./cache.service");

class ConversationService {
  async createPrivateConversation(userId, participantId) {
    const existing = await Conversation.findOne({
      type: "private",
      participants: { $all: [userId, participantId] },
    }).populate("participants", "name avatar email lastSeen");

    if (existing) {
      return existing;
    }

    const conversation = await Conversation.create({
      type: "private",
      participants: [userId, participantId],
    });

    await conversation.populate("participants", "name avatar email lastSeen");
    await cacheService.deletePattern(`user:conversations:*`);

    return conversation;
  }

  async createGroupConversation(
    userId,
    name,
    participantIds,
    avatar = null,
    description = "",
  ) {
    const allParticipants = [userId, ...participantIds];

    const conversation = await Conversation.create({
      type: "group",
      name,
      avatar,
      description,
      participants: allParticipants,
      adminId: userId,
    });

    await conversation.populate("participants", "name avatar email lastSeen");
    await cacheService.deletePattern(`user:conversations:*`);

    return conversation;
  }

  async getUserConversations(userId) {
    const mongoose = require("mongoose");

    const conversations = await Conversation.find({
      participants: new mongoose.Types.ObjectId(userId),
    })
      .populate("participants", "name avatar email lastSeen")
      .populate({
        path: "lastMessage",
        select:
          "content type fileName fileUrl senderId createdAt isRecalled callType callStatus callDuration images caption",
        populate: { path: "senderId", select: "_id name avatar" },
      })
      .populate("adminId", "name avatar")
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const isPinned =
          conv.pinnedBy?.some((id) => id.toString() === userId.toString()) ||
          false;
        const isMuted =
          conv.mutedBy?.some(
            (m) => m.userId?.toString() === userId.toString(),
          ) || false;

        // Đọc trực tiếp từ unreadCounts map — không cần query Message nữa
        let unreadCount = 0;
        try {
          let lastReadAt = null;
          if (conv.lastReadAt) {
            const raw = conv.lastReadAt[userId.toString()];
            if (raw) lastReadAt = new Date(raw);
          }
          unreadCount = await Message.countDocuments({
            conversationId: conv._id,
            senderId: { $ne: new mongoose.Types.ObjectId(userId) },
            isDeleted: false,
            isRecalled: { $ne: true },
            ...(lastReadAt ? { createdAt: { $gt: lastReadAt } } : {}),
          });
        } catch (e) {}

        return { ...conv, unreadCount, isPinned, isMuted };
      }),
    );

    return conversationsWithUnread;
  }

  async getConversationById(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId)
      .populate("participants", "name avatar email lastSeen")
      .populate({
        path: "lastMessage",
        select:
          "_id content type fileName fileUrl fileSize senderId createdAt isRecalled callType callStatus callDuration images caption voiceDuration",
        populate: {
          path: "senderId",
          select: "_id name avatar",
        },
      })
      .populate("adminId", "name avatar")
      .populate("moderators", "name avatar")
      .lean();

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (p) => p._id.toString() === userId.toString(),
    );

    if (!isParticipant) {
      throw new Error("Unauthorized");
    }

    return conversation;
  }

  async addParticipants(conversationId, userId, participantIds) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    if (!conversation.canPerformAction(userId, "addMembers")) {
      throw new Error("You don't have permission to add members");
    }

    participantIds.forEach((id) => {
      if (!conversation.participants.includes(id)) {
        conversation.participants.push(id);
      }
    });

    await conversation.save();
    await conversation.populate("participants", "name avatar email lastSeen");
    await cacheService.deletePattern(`user:conversations:*`);

    return conversation;
  }

  async removeParticipant(conversationId, userId, targetUserId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Not found");

    const adminIdStr = conversation.adminId?.toString();
    const userIdStr = userId?.toString();

    if (adminIdStr !== userIdStr) {
      throw new Error("Chỉ trưởng nhóm mới có quyền xóa thành viên");
    }

    if (targetUserId?.toString() === userIdStr) {
      throw new Error("Không thể tự kick bản thân");
    }

    conversation.participants = conversation.participants.filter(
      (id) => id.toString() !== targetUserId.toString(),
    );

    conversation.moderators = conversation.moderators.filter(
      (id) => id.toString() !== targetUserId.toString(),
    );

    await conversation.save();
    await conversation.populate("participants", "name avatar email lastSeen");
    await cacheService.deletePattern(`user:conversations:*`);

    return conversation;
  }

  async leaveGroup(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    if (conversation.type !== "group") {
      throw new Error("Can only leave group conversations");
    }

    conversation.participants = conversation.participants.filter(
      (id) => id.toString() !== userId.toString(),
    );

    if (conversation.adminId?.toString() === userId.toString()) {
      const nextAdmin = conversation.participants[0];
      if (nextAdmin) conversation.adminId = nextAdmin;
    }

    conversation.moderators = conversation.moderators.filter(
      (id) => id.toString() !== userId.toString(),
    );

    await conversation.save();
    await cacheService.deletePattern(`user:conversations:*`);

    return conversation;
  }

  async deleteGroup(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    if (conversation.adminId?.toString() !== userId.toString()) {
      throw new Error("Only group admin can delete the group");
    }

    conversation.isDeleted = true;
    await conversation.save();
    await cacheService.deletePattern(`user:conversations:*`);

    return conversation;
  }

  async updateGroupInfo(conversationId, userId, updates) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    if (!conversation.canPerformAction(userId, "editGroupInfo")) {
      throw new Error("You don't have permission to edit group info");
    }

    if (updates.name) conversation.name = updates.name;
    if (updates.avatar !== undefined) conversation.avatar = updates.avatar;
    if (updates.description !== undefined)
      conversation.description = updates.description;

    await conversation.save();
    await cacheService.deletePattern(`user:conversations:*`);

    return conversation;
  }

  async updateGroupPermissions(conversationId, userId, permissions) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    if (conversation.adminId?.toString() !== userId.toString()) {
      throw new Error("Only group admin can change permissions");
    }

    conversation.permissions = { ...conversation.permissions, ...permissions };
    await conversation.save();
    await cacheService.deletePattern(`user:conversations:*`);

    return conversation;
  }

  async addModerator(conversationId, userId, targetUserId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // ✅ Dùng adminId thay vì admins array
    if (conversation.adminId?.toString() !== userId.toString()) {
      throw new Error("Only admins can add moderators");
    }

    if (!conversation.moderators.includes(targetUserId)) {
      conversation.moderators.push(targetUserId);
      await conversation.save();
      await cacheService.deletePattern(`user:conversations:*`);
    }

    return conversation;
  }

  async removeModerator(conversationId, userId, targetUserId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // ✅ Dùng adminId thay vì admins array
    if (conversation.adminId?.toString() !== userId.toString()) {
      throw new Error("Only admins can remove moderators");
    }

    conversation.moderators = conversation.moderators.filter(
      (id) => id.toString() !== targetUserId.toString(),
    );

    await conversation.save();
    await cacheService.deletePattern(`user:conversations:*`);

    return conversation;
  }

  async transferOwnership(conversationId, userId, newAdminId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    if (conversation.adminId?.toString() !== userId.toString()) {
      throw new Error("Only the admin can transfer ownership");
    }

    conversation.adminId = newAdminId;

    await conversation.save();
    await cacheService.deletePattern(`user:conversations:*`);

    return conversation;
  }

  async togglePin(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const isPinned = conversation.pinnedBy?.includes(userId);
    if (isPinned) {
      conversation.pinnedBy = conversation.pinnedBy.filter(
        (id) => id.toString() !== userId.toString(),
      );
    } else {
      if (!conversation.pinnedBy) conversation.pinnedBy = [];
      conversation.pinnedBy.push(userId);
    }

    await conversation.save();
    await cacheService.deletePattern(`user:conversations:*`);
    return { isPinned: !isPinned };
  }

  async toggleMute(conversationId, userId, mutedUntil = null) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const existingMute = conversation.mutedBy?.find(
      (m) => m.userId?.toString() === userId.toString(),
    );

    if (existingMute) {
      conversation.mutedBy = conversation.mutedBy.filter(
        (m) => m.userId?.toString() !== userId.toString(),
      );
      await conversation.save();
      await cacheService.deletePattern(`user:conversations:*`);
      return { isMuted: false };
    } else {
      if (!conversation.mutedBy) conversation.mutedBy = [];
      conversation.mutedBy.push({
        userId,
        mutedUntil: mutedUntil ? new Date(mutedUntil) : null,
      });
      await conversation.save();
      await cacheService.deletePattern(`user:conversations:*`);
      return { isMuted: true };
    }
  }

  async toggleBlock(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const isBlocked = conversation.blockedBy?.some(
      (id) => id.toString() === userId.toString(),
    );
    if (isBlocked) {
      conversation.blockedBy = conversation.blockedBy.filter(
        (id) => id.toString() !== userId.toString(),
      );
    } else {
      if (!conversation.blockedBy) conversation.blockedBy = [];
      conversation.blockedBy.push(userId);
    }

    await conversation.save();
    await cacheService.deletePattern(`user:conversations:*`);
    return { isBlocked: !isBlocked };
  }

  async toggleArchive(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const isArchived = conversation.archivedBy?.some(
      (id) => id.toString() === userId.toString(),
    );
    if (isArchived) {
      conversation.archivedBy = conversation.archivedBy.filter(
        (id) => id.toString() !== userId.toString(),
      );
    } else {
      if (!conversation.archivedBy) conversation.archivedBy = [];
      conversation.archivedBy.push(userId);
    }

    await conversation.save();
    await cacheService.deletePattern(`user:conversations:*`);
    return { isArchived: !isArchived };
  }

  async markAllAsRead(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    conversation.lastReadAt.set(userId.toString(), new Date());
    conversation.unreadCounts.set(userId.toString(), 0);
    await conversation.save();

    return { success: true };
  }
}

module.exports = new ConversationService();
