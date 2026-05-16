const { Types } = require("mongoose");

const IDS = {
  alice: "507f1f77bcf86cd799439011",
  bob: "507f1f77bcf86cd799439012",
  charlie: "507f1f77bcf86cd799439013",
  diana: "507f1f77bcf86cd799439014",
};

const CONV_IDS = {
  alice_bob: "60d5ec49f1b2c72b8c8e4e01",
  alice_charlie: "60d5ec49f1b2c72b8c8e4e02",
  alice_diana: "60d5ec49f1b2c72b8c8e4e03",
  bob_charlie: "60d5ec49f1b2c72b8c8e4e04",
  bob_diana: "60d5ec49f1b2c72b8c8e4e05",
  charlie_diana: "60d5ec49f1b2c72b8c8e4e06",
};

const USERS = {
  [IDS.alice]: {
    _id: IDS.alice,
    name: "Alice",
    email: "alice@test.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
    status: "offline",
  },
  [IDS.bob]: {
    _id: IDS.bob,
    name: "Bob",
    email: "bob@test.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
    status: "offline",
  },
  [IDS.charlie]: {
    _id: IDS.charlie,
    name: "Charlie",
    email: "charlie@test.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=charlie",
    status: "offline",
  },
  [IDS.diana]: {
    _id: IDS.diana,
    name: "Diana",
    email: "diana@test.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=diana",
    status: "offline",
  },
};

// conversations: map of id → conversation object
const CONVERSATIONS = {
  [CONV_IDS.alice_bob]: {
    _id: CONV_IDS.alice_bob,
    type: "private",
    participants: [IDS.alice, IDS.bob],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessage: null,
  },
  [CONV_IDS.alice_charlie]: {
    _id: CONV_IDS.alice_charlie,
    type: "private",
    participants: [IDS.alice, IDS.charlie],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessage: null,
  },
  [CONV_IDS.alice_diana]: {
    _id: CONV_IDS.alice_diana,
    type: "private",
    participants: [IDS.alice, IDS.diana],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessage: null,
  },
  [CONV_IDS.bob_charlie]: {
    _id: CONV_IDS.bob_charlie,
    type: "private",
    participants: [IDS.bob, IDS.charlie],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessage: null,
  },
  [CONV_IDS.bob_diana]: {
    _id: CONV_IDS.bob_diana,
    type: "private",
    participants: [IDS.bob, IDS.diana],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessage: null,
  },
  [CONV_IDS.charlie_diana]: {
    _id: CONV_IDS.charlie_diana,
    type: "private",
    participants: [IDS.charlie, IDS.diana],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessage: null,
  },
};

// messages: map of conversationId → array of messages
const MESSAGES = {};
Object.keys(CONVERSATIONS).forEach((id) => {
  MESSAGES[id] = [];
});

let msgCounter = 1;

function populateConversation(conv, currentUserId) {
  return {
    ...conv,
    participants: conv.participants.map((pid) => {
      // Nếu có trong store dùng luôn, không thì tạo placeholder để không bị filter mất
      return (
        USERS[pid] || {
          _id: pid,
          name: "Người dùng",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + pid,
          status: "offline",
        }
      );
    }),
    lastMessage: conv.lastMessage || null,
    unreadCount: currentUserId
      ? (MESSAGES[conv._id] || []).filter((m) => {
          const sid = m.senderId?._id?.toString() || m.senderId?.toString();
          return sid !== currentUserId.toString() && m.status !== "read";
        }).length
      : 0,
  };
}

module.exports = {
  IDS,
  CONV_IDS,
  USERS,
  CONVERSATIONS,
  MESSAGES,

  getUserConversations(userId) {
    return Object.values(CONVERSATIONS)
      .filter((c) => {
        if (!c.participants.includes(userId)) return false;
        // Ẩn nhóm đã giải tán với người giải tán
        if (c.isDissolved && c.dissolvedBy === userId) return false;
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map((c) => populateConversation(c, userId));
  },

  getConversationById(convId, userId) {
    const conv = CONVERSATIONS[convId];
    if (!conv) return null;
    if (!conv.participants.includes(userId)) return null;
    return populateConversation(conv, userId);
  },

  getMessages(convId, page = 1, limit = 50, userId = null) {
    const msgs = (MESSAGES[convId] || []).filter((m) => {
      if (!userId) return true;
      if (!m.deletedFor || m.deletedFor.length === 0) return true;
      // So sánh string vì userId có thể là string hoặc ObjectId
      return !m.deletedFor.some((id) => id?.toString() === userId?.toString());
    });
    const total = msgs.length;
    const start = Math.max(0, total - page * limit);
    const end = total - (page - 1) * limit;
    const slice = msgs.slice(start, end);
    return {
      messages: slice,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  },

  createMessage(convId, senderId, data) {
    const id = `msg_${Date.now()}_${msgCounter++}`;
    const msg = {
      _id: id,
      conversationId: convId,
      senderId: senderId ? { _id: senderId, ...USERS[senderId] } : null,
      status: "sent",
      createdAt: new Date(),
      updatedAt: new Date(),
      reactions: [],
      isEdited: false,
      isPinned: false,
      isDeleted: false,
      ...data,
    };
    if (!MESSAGES[convId]) MESSAGES[convId] = [];
    MESSAGES[convId].push(msg);

    // Không update lastMessage nếu là tin nhắn hệ thống
    if (data.type !== "system") {
      CONVERSATIONS[convId].lastMessage = {
        _id: id,
        content: data.content,
        type: data.type,
        senderId: { _id: senderId, name: USERS[senderId]?.name },
        createdAt: msg.createdAt,
      };
      CONVERSATIONS[convId].updatedAt = new Date();
    }

    return msg;
  },

  updateMessageStatus(msgId, convId, status, userId = null) {
    const msgs = MESSAGES[convId] || [];
    const msg = msgs.find((m) => m._id === msgId);
    if (!msg) return null;
    msg.status = status;
    if (status === "read" && userId) {
      if (!msg.readBy) msg.readBy = [];
      const already = msg.readBy.some((r) => r.userId === userId);
      if (!already) {
        msg.readBy.push({
          userId,
          avatar: USERS[userId]?.avatar || "",
          name: USERS[userId]?.name || "",
          readAt: new Date(),
        });
      }
    }
    return msg;
  },

  addReaction(msgId, convId, userId, emoji) {
    const msgs = MESSAGES[convId] || [];
    const msg = msgs.find((m) => m._id === msgId);
    if (!msg) return null;
    msg.reactions = msg.reactions.filter(
      (r) => (r.userId?._id || r.userId) !== userId,
    );
    msg.reactions.push({
      userId: { _id: userId, ...USERS[userId] },
      emoji,
      createdAt: new Date(),
    });
    return msg;
  },

  removeReaction(msgId, convId, userId) {
    const msgs = MESSAGES[convId] || [];
    const msg = msgs.find((m) => m._id === msgId);
    if (!msg) return null;
    msg.reactions = msg.reactions.filter(
      (r) => (r.userId?._id || r.userId) !== userId,
    );
    return msg;
  },

  editMessage(msgId, convId, content) {
    const msgs = MESSAGES[convId] || [];
    const msg = msgs.find((m) => m._id === msgId);
    if (!msg) return null;
    msg.content = content;
    msg.isEdited = true;
    msg.editedAt = new Date();
    return msg;
  },

  deleteMessage(msgId, convId) {
    const msgs = MESSAGES[convId] || [];
    const msg = msgs.find((m) => m._id === msgId);
    if (!msg) return null;
    msg.isDeleted = true;
    msg.deletedAt = new Date();
    return msg;
  },

  pinMessage(msgId, convId) {
    const msgs = MESSAGES[convId] || [];
    const msg = msgs.find((m) => m._id === msgId);
    if (!msg) return null;
    msg.isPinned = true;
    msg.pinnedAt = new Date();
    return msg;
  },

  unpinMessage(msgId, convId) {
    const msgs = MESSAGES[convId] || [];
    const msg = msgs.find((m) => m._id === msgId);
    if (!msg) return null;
    msg.isPinned = false;
    return msg;
  },

  getPinnedMessages(convId) {
    return (MESSAGES[convId] || []).filter((m) => m.isPinned && !m.isDeleted);
  },

  searchMessages(convId, query) {
    return (MESSAGES[convId] || []).filter(
      (m) =>
        !m.isDeleted && m.content?.toLowerCase().includes(query.toLowerCase()),
    );
  },

  getDeliveredMessages(convId, excludeUserId) {
    return (MESSAGES[convId] || []).filter((m) => {
      const sid = m.senderId?._id?.toString() || m.senderId?.toString();
      return sid !== excludeUserId?.toString() && m.status === "sent";
    });
  },
};
