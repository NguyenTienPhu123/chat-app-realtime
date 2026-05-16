const User = require("../models/User.model");
const Message = require("../models/Message.model");
const Conversation = require("../models/Conversation.model");

class NotificationService {
  constructor() {
    // Initialize Firebase Admin SDK if needed
    // this.admin = require('firebase-admin');
  }

  // Send push notification
  async sendPushNotification(userId, notification) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.notificationSettings.pushEnabled) {
        return;
      }

      if (!user.fcmTokens || user.fcmTokens.length === 0) {
        return;
      }

      // Send via Firebase Cloud Messaging
      // const message = {
      //   notification: {
      //     title: notification.title,
      //     body: notification.body,
      //   },
      //   data: notification.data || {},
      //   tokens: user.fcmTokens,
      // };

      // await this.admin.messaging().sendMulticast(message);

      console.log(`📬 Push notification sent to user ${userId}`);
    } catch (error) {
      console.error("Push notification error:", error);
    }
  }

  // Send new message notification
  async notifyNewMessage(message, conversationId) {
    try {
      const conversation = await Conversation.findById(conversationId).populate(
        "participants",
        "_id name",
      );

      if (!conversation) return;

      const sender = await User.findById(message.senderId).select(
        "name avatar",
      );

      // Notify all participants except sender
      for (const participant of conversation.participants) {
        if (participant._id.toString() === message.senderId.toString()) {
          continue;
        }

        // Check if conversation is muted
        const isMuted = conversation.mutedBy?.some(
          (m) => m.userId.toString() === participant._id.toString(),
        );

        if (isMuted) continue;

        let notificationBody = "";

        if (conversation.type === "private") {
          notificationBody =
            message.content || this.getMessageTypeDescription(message.type);
        } else {
          notificationBody = `${sender.name}: ${message.content || this.getMessageTypeDescription(message.type)}`;
        }

        await this.sendPushNotification(participant._id, {
          title:
            conversation.type === "private" ? sender.name : conversation.name,
          body: notificationBody,
          data: {
            type: "new_message",
            conversationId: conversationId.toString(),
            messageId: message._id.toString(),
          },
        });
      }
    } catch (error) {
      console.error("Notify new message error:", error);
    }
  }

  // Get unread message count
  async getUnreadCount(userId) {
    try {
      const conversations = await Conversation.find({
        participants: userId,
        isActive: true,
      }).select("_id");

      const conversationIds = conversations.map((c) => c._id);

      const unreadCount = await Message.countDocuments({
        conversationId: { $in: conversationIds },
        senderId: { $ne: userId },
        status: { $ne: "read" },
        isDeleted: false,
      });

      return unreadCount;
    } catch (error) {
      console.error("Get unread count error:", error);
      return 0;
    }
  }

  // Get unread count by conversation
  async getUnreadCountByConversation(userId) {
    try {
      const conversations = await Conversation.find({
        participants: userId,
        isActive: true,
      }).select("_id");

      const conversationIds = conversations.map((c) => c._id);

      const unreadMessages = await Message.aggregate([
        {
          $match: {
            conversationId: { $in: conversationIds },
            senderId: { $ne: userId },
            status: { $ne: "read" },
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: "$conversationId",
            count: { $sum: 1 },
          },
        },
      ]);

      const result = {};
      unreadMessages.forEach((item) => {
        result[item._id.toString()] = item.count;
      });

      return result;
    } catch (error) {
      console.error("Get unread count by conversation error:", error);
      return {};
    }
  }

  // Update FCM token
  async updateFCMToken(userId, token) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      if (!user.fcmTokens) user.fcmTokens = [];

      // Remove if exists
      user.fcmTokens = user.fcmTokens.filter((t) => t !== token);

      // Add new token
      user.fcmTokens.push(token);

      // Keep only last 5 tokens
      if (user.fcmTokens.length > 5) {
        user.fcmTokens = user.fcmTokens.slice(-5);
      }

      await user.save();
    } catch (error) {
      console.error("Update FCM token error:", error);
    }
  }

  // Helper: Get message type description
  getMessageTypeDescription(type) {
    const descriptions = {
      image: "📷 Photo",
      video: "🎥 Video",
      file: "📄 File",
      voice: "🎤 Voice message",
      system: "System message",
    };
    return descriptions[type] || "Message";
  }
}

module.exports = new NotificationService();
