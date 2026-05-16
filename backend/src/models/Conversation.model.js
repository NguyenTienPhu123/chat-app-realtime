const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["private", "group", "mydoc"],
      required: true,
    },

    // For private chat
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // For group chat
    name: {
      type: String,
      required: function () {
        return this.type === "group";
      },
    },
    avatar: String,
    description: String,

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.type === "group";
      },
    },

    // Group moderators
    moderators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Group permissions
    permissions: {
      onlyAdminCanSendMessages: {
        type: Boolean,
        default: false,
      },
      onlyAdminCanAddMembers: {
        type: Boolean,
        default: false,
      },
      onlyAdminCanPinMessages: {
        type: Boolean,
        default: false,
      },
      onlyAdminCanEditGroupInfo: {
        type: Boolean,
        default: false,
      },
      allowMemberToRemoveOthers: {
        type: Boolean,
        default: false,
      },
    },

    // Last message info (for sorting conversations)
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    // Pinned messages in this conversation
    pinnedMessages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    ],

    // Typing indicators
    typingUsers: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        updatedAt: Date,
      },
    ],

    // Muted users
    mutedBy: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        mutedUntil: Date,
      },
    ],

    // Pinned for users (pin conversation to top)
    pinnedBy: [mongoose.Schema.Types.ObjectId],

    // Archived for users
    archivedBy: [mongoose.Schema.Types.ObjectId],

    // Blocked users (in private chat)
    blockedBy: [mongoose.Schema.Types.ObjectId],

    isActive: {
      type: Boolean,
      default: true,
    },
    isDissolved: {
      type: Boolean,
      default: false,
    },
    dissolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Track lần cuối mỗi user đọc tin nhắn
    lastReadAt: {
      type: Map,
      of: Date,
      default: {},
    },

    deletedFor: {
      type: Map,
      of: Date,
      default: {},
    },

    // Số tin chưa đọc của từng user
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ type: 1, isActive: 1 });
ConversationSchema.index({ lastMessage: -1 });

// Method to check if user is participant
ConversationSchema.methods.hasParticipant = function (userId) {
  return this.participants.some((p) => p.toString() === userId.toString());
};

// Method to check if user is admin
ConversationSchema.methods.isAdmin = function (userId) {
  return this.adminId && this.adminId.toString() === userId.toString();
};

// Method to check if user is moderator
ConversationSchema.methods.isModerator = function (userId) {
  return this.moderators?.some((m) => m.toString() === userId.toString());
};

// Method to check if user can perform action
ConversationSchema.methods.canPerformAction = function (userId, action) {
  if (this.type === "private") return true;

  const isAdmin = this.isAdmin(userId);
  const isMod = this.isModerator(userId);

  switch (action) {
    case "sendMessage":
      return !this.permissions.onlyAdminCanSendMessages || isAdmin || isMod;
    case "addMembers":
      return !this.permissions.onlyAdminCanAddMembers || isAdmin || isMod;
    case "pinMessage":
      return !this.permissions.onlyAdminCanPinMessages || isAdmin || isMod;
    case "editGroupInfo":
      return !this.permissions.onlyAdminCanEditGroupInfo || isAdmin;
    case "removeMembers":
      return isAdmin || (isMod && this.permissions.allowMemberToRemoveOthers);
    default:
      return false;
  }
};

module.exports = mongoose.model("Conversation", ConversationSchema);
