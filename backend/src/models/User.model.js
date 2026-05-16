const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    avatar: String,
    bio: String,

    status: {
      type: String,
      enum: ["online", "offline", "away", "busy"],
      default: "offline",
    },

    lastSeen: Date,

    // Danh sách bạn bè
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Lời mời kết bạn
    friendRequests: [
      {
        from: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    notificationSettings: {
      pushEnabled: { type: Boolean, default: true },
      emailEnabled: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
      messagePreview: { type: Boolean, default: true },
    },

    privacySettings: {
      showLastSeen: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      showOnlineStatus: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      allowMessagesFrom: {
        type: String,
        enum: ["everyone", "contacts"],
        default: "everyone",
      },
    },

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    fcmTokens: [String],

    phone: { type: String, default: "" },
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },
    birthDate: { type: Date, default: null },
    lastNameChange: { type: Date, default: null },

    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

UserSchema.methods.isBlocked = function (userId) {
  return this.blockedUsers?.some((b) => b.toString() === userId.toString());
};

UserSchema.methods.isFriend = function (userId) {
  return this.friends?.some((f) => f.toString() === userId.toString());
};

module.exports = mongoose.model("User", UserSchema);
