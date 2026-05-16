const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.type !== "system";
      },
      index: true,
    },

    type: {
      type: String,
      enum: [
        "text",
        "image",
        "images",
        "video",
        "file",
        "voice",
        "system",
        "call",
      ],
      required: true,
    },
    isRecalled: {
      type: Boolean,
      default: false,
    },
    subType: String,
    changerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changerName: String,
    targetId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    targetName: String,
    wallpaper: String,

    // Text message
    content: {
      type: String,
      required: function () {
        return this.type === "text" || this.type === "system";
      },
    },

    // Caption cho file/image/video
    caption: {
      type: String,
    },

    // File/Image/Video
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    thumbnail: String,

    images: [
      {
        url: String,
        fileName: String,
        fileSize: Number,
        width: Number,
        height: Number,
      },
    ],
    // Voice message
    voiceDuration: Number, // seconds
    waveform: [Number], // amplitude array for visualization

    // Message status
    status: {
      type: String,
      enum: ["sending", "sent", "delivered", "read"],
      default: "sent",
    },

    // Reply to message
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    // Forward
    forwardedFrom: {
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
      },
    },

    // Reactions
    reactions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        emoji: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Edit history
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
    editHistory: [
      {
        content: String,
        editedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Pin in conversation
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedAt: Date,
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Star message (per user)

    // Read by (ai đã đọc)
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    starredBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        starredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Xóa ở phía từng user
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Link preview metadata
    linkPreview: {
      url: String,
      title: String,
      description: String,
      image: String,
      siteName: String,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, isDeleted: 1 });
MessageSchema.index({ conversationId: 1, isPinned: 1 });
MessageSchema.index({ content: "text" }); // Full-text search

// Virtual for reaction counts
MessageSchema.virtual("reactionCounts").get(function () {
  const counts = {};
  this.reactions.forEach((r) => {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
  });
  return counts;
});

module.exports = mongoose.model("Message", MessageSchema);
