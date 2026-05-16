// SAU
const messageService = require("../services/message.service");
const voiceService = require("../services/voice.service");
const notificationService = require("../services/notification.service");
const { successResponse, errorResponse } = require("../utils/response.util");
const Message = require("../models/Message.model"); // ← THÊM DÒNG NÀY
const socketIndex = require("../socket/socket-index");

class MessageController {
  async sendMessage(req, res) {
    try {
      const {
        conversationId,
        content,
        type = "text",
        caption,
        replyToId,
        mentions,
      } = req.body;
      const senderId = (req.user.id || req.user._id).toString();

      // THÊM: Nếu là preview conversation → tạo conversation thật
      let realConversationId = conversationId;
      if (conversationId?.startsWith("preview_")) {
        const receiverId = conversationId.replace("preview_", "");

        // Kiểm tra privacy của receiver
        const User = require("../models/User.model");
        const receiver = await User.findById(receiverId).select(
          "privacySettings friends",
        );
        if (!receiver)
          return errorResponse(res, "Người dùng không tồn tại", 404);

        if (receiver.privacySettings?.allowMessagesFrom === "contacts") {
          const isFriend = receiver.friends?.some(
            (f) => f.toString() === senderId,
          );
          if (!isFriend) {
            return errorResponse(res, "BLOCKED_STRANGER", 403);
          }
        }

        const Conversation = require("../models/Conversation.model");
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
          const io = req.app.get("io");
          if (io) {
            io.to(`user:${senderId}`).emit("conversation:new", conv);
            io.to(`user:${receiverId}`).emit("conversation:new", conv);
          }
        }
        realConversationId = conv._id.toString();
      }

      let message;
      // Chuẩn hóa req.file và req.files
      if (!req.file && req.files?.length > 0 && type !== "images") {
        req.file = req.files[0];
      }
      if (type === "text") {
        message = await messageService.sendTextMessage(
          realConversationId,
          senderId,
          content,
          replyToId,
          mentions ? JSON.parse(mentions) : [],
        );
      } else if (type === "voice") {
        if (!req.file) {
          return errorResponse(res, "Audio file is required", 400);
        }

        const duration = parseInt(req.body.duration) || 0;
        const waveform = req.body.waveform ? JSON.parse(req.body.waveform) : [];

        message = await messageService.sendVoiceMessage(
          realConversationId,
          senderId,
          req.file,
          duration,
          waveform,
        );
      } else if (type === "images") {
        if (!req.files || req.files.length === 0) {
          return errorResponse(res, "Files are required", 400);
        }

        message = await messageService.sendImagesMessage(
          realConversationId,
          senderId,
          req.files,
          caption || "",
          replyToId,
        );
      } else {
        if (!req.file) {
          return errorResponse(res, "File is required", 400);
        }

        message = await messageService.sendFileMessage(
          realConversationId,
          senderId,
          req.file,
          type,
          caption || "",
          replyToId,
        );
      }

      // Emit socket
      const io = req.app.get("io");
      if (io && message._id) {
        const fullMessage = await Message.findById(message._id)
          .populate("senderId", "name avatar email")
          .populate({
            path: "replyTo",
            select: "content type senderId fileUrl fileName",
            populate: { path: "senderId", select: "name avatar" },
          })
          .lean();

        if (fullMessage && fullMessage.senderId) {
          const normalizedMessage = {
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
            normalizedMessage,
          );

          const Conversation = require("../models/Conversation.model");
          const conversation2 =
            await Conversation.findById(realConversationId).lean();
          if (conversation2) {
            const otherParticipants = conversation2.participants
              .map((p) => p.toString())
              .filter((p) => p !== senderId);
            const anyOnline = otherParticipants.some((p) =>
              socketIndex.onlineUsers?.has(p),
            );
            if (anyOnline) {
              await Message.findByIdAndUpdate(message._id, {
                status: "delivered",
              });
              io.to(`conversation:${realConversationId}`).emit(
                "message:status",
                {
                  messageId: normalizedMessage._id,
                  status: "delivered",
                },
              );
            }
          }

          // Emit lastMessage cho sidebar — đồng bộ ngay lập tức
          io.to(`conversation:${realConversationId}`).emit(
            "conversation:lastMessage",
            {
              conversationId: realConversationId,
              lastMessage: {
                _id: normalizedMessage._id,
                content: normalizedMessage.content || "",
                type: normalizedMessage.type,
                senderId: normalizedMessage.senderId,
                createdAt: normalizedMessage.createdAt,
                fileName: normalizedMessage.fileName,
                fileUrl: normalizedMessage.fileUrl,
                images: normalizedMessage.images,
                caption: normalizedMessage.caption,
                voiceDuration: normalizedMessage.voiceDuration,
                isRecalled: false,
              },
            },
          );
        }
      }

      // Send notification
      notificationService.notifyNewMessage(message, realConversationId);

      return successResponse(res, message, "Message sent successfully", 201);
    } catch (error) {
      console.error("sendMessage error:", error);
      return errorResponse(res, error.message, 400);
    }
  }

  async editMessage(req, res) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      const message = await messageService.editMessage(id, userId, content);

      // Emit socket
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation:${message.conversationId}`).emit("message:edited", {
          messageId: message._id.toString(),
          content: message.content,
          isEdited: message.isEdited,
          editedAt: message.editedAt,
        });
      }

      return successResponse(res, message, "Message edited");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async forwardMessage(req, res) {
    try {
      const { id } = req.params;
      const { conversationIds } = req.body;
      const userId = req.user.id;

      if (!conversationIds || !Array.isArray(conversationIds)) {
        return errorResponse(res, "conversationIds (array) is required", 400);
      }

      const messages = await messageService.forwardMessage(
        id,
        userId,
        conversationIds,
      );

      // Emit socket for each conversation
      const io = req.app.get("io");
      if (io) {
        messages.forEach((msg) => {
          const plainMessage = msg.toObject ? msg.toObject() : msg;
          const normalizedMessage = {
            ...plainMessage,
            _id: plainMessage._id.toString(),
            conversationId: plainMessage.conversationId.toString(),
            senderId: {
              _id: plainMessage.senderId._id.toString(),
              name: plainMessage.senderId.name,
              avatar: plainMessage.senderId.avatar,
              email: plainMessage.senderId.email,
            },
            forwardedFrom: plainMessage.forwardedFrom
              ? {
                  ...plainMessage.forwardedFrom,
                  messageId: plainMessage.forwardedFrom.messageId?.toString(),
                  senderId: plainMessage.forwardedFrom.senderId?._id
                    ? {
                        _id: plainMessage.forwardedFrom.senderId._id.toString(),
                        name: plainMessage.forwardedFrom.senderId.name,
                        avatar: plainMessage.forwardedFrom.senderId.avatar,
                      }
                    : plainMessage.forwardedFrom.senderId,
                }
              : null,
          };

          io.to(`conversation:${msg.conversationId}`).emit(
            "message:new",
            normalizedMessage,
          );
        });
      }

      return successResponse(res, messages, "Message forwarded");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async pinMessage(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const message = await messageService.pinMessage(id, userId);

      // Emit socket
      const io = req.app.get("io");
      if (io) {
        // Thông báo unpin tất cả tin cũ
        io.to(`conversation:${message.conversationId}`).emit(
          "message:unpinall",
          {},
        );
        // Thông báo pin tin mới
        io.to(`conversation:${message.conversationId}`).emit("message:pinned", {
          messageId: message._id.toString(),
          isPinned: message.isPinned,
          pinnedAt: message.pinnedAt,
        });
      }

      return successResponse(res, message, "Message pinned");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async unpinMessage(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const message = await messageService.unpinMessage(id, userId);

      // Emit socket
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation:${message.conversationId}`).emit(
          "message:unpinned",
          {
            messageId: message._id.toString(),
            isPinned: message.isPinned,
          },
        );
      }

      return successResponse(res, message, "Message unpinned");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async getPinnedMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      const messages = await messageService.getPinnedMessages(
        conversationId,
        userId,
      );

      return successResponse(res, messages);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async searchMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { query } = req.query;
      const userId = req.user.id;

      if (!query) {
        return errorResponse(res, "Query is required", 400);
      }

      const messages = await messageService.searchMessages(
        conversationId,
        userId,
        query,
      );

      return successResponse(res, messages);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.id;

      const result = await messageService.getMessages(
        conversationId,
        userId,
        parseInt(page),
        parseInt(limit),
      );

      return successResponse(res, result);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      const message = await messageService.updateMessageStatus(
        id,
        userId,
        status,
      );

      return successResponse(res, message, "Status updated");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async markAllAsRead(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      await messageService.markAllAsRead(conversationId, userId);

      return successResponse(res, null, "All messages marked as read");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async deleteMessage(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const message = await messageService.deleteMessage(id, userId);

      // Emit socket
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation:${message.conversationId}`).emit(
          "message:deleted",
          {
            messageId: message._id.toString(),
          },
        );
      }

      return successResponse(res, message, "Message deleted");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async addReaction(req, res) {
    try {
      const { id } = req.params;
      const { emoji } = req.body;
      const userId = req.user.id;

      const message = await messageService.addReaction(id, userId, emoji);

      // Emit socket
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation:${message.conversationId}`).emit(
          "message:reaction",
          {
            messageId: message._id.toString(),
            reactions: message.reactions,
          },
        );
      }

      return successResponse(res, message, "Reaction added");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async removeReaction(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const message = await messageService.removeReaction(id, userId);

      // Emit socket
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation:${message.conversationId}`).emit(
          "message:reaction",
          {
            messageId: message._id.toString(),
            reactions: message.reactions,
          },
        );
      }

      return successResponse(res, message, "Reaction removed");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }
}

module.exports = new MessageController();
