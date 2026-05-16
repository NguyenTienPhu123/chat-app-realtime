const conversationService = require("../services/conversation.service");
const { successResponse, errorResponse } = require("../utils/response.util");

class ConversationController {
  async createPrivate(req, res) {
    try {
      const { participantId } = req.body;
      const userId = req.user.id;

      if (!participantId) {
        return errorResponse(res, "participantId is required", 400);
      }

      const conversation = await conversationService.createPrivateConversation(
        userId,
        participantId,
      );

      return successResponse(
        res,
        conversation,
        "Private conversation created",
        201,
      );
    } catch (error) {
      console.error("❌ createPrivate error:", error);
      return errorResponse(res, error.message, 400);
    }
  }

  async createGroup(req, res) {
    try {
      const { name, participantIds, avatar, description } = req.body;
      const userId = req.user.id;

      if (!name || !participantIds || !Array.isArray(participantIds)) {
        return errorResponse(
          res,
          "name and participantIds (array) are required",
          400,
        );
      }

      const conversation = await conversationService.createGroupConversation(
        userId,
        name,
        participantIds,
        avatar,
        description,
      );

      return successResponse(
        res,
        conversation,
        "Group conversation created",
        201,
      );
    } catch (error) {
      console.error("❌ createGroup error:", error);
      return errorResponse(res, error.message, 400);
    }
  }

  async getUserConversations(req, res) {
    try {
      const userId = req.user.id;

      const result = await conversationService.getUserConversations(userId);

      return successResponse(res, result);
    } catch (error) {
      console.error("❌ getUserConversations error:", error);
      return errorResponse(res, error.message, 400);
    }
  }

  async getConversation(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const conversation = await conversationService.getConversationById(
        id,
        userId,
      );

      if (!conversation) {
        return errorResponse(res, "Conversation not found", 404);
      }

      return successResponse(res, conversation);
    } catch (error) {
      console.error("❌ getConversation error:", error);
      return errorResponse(res, error.message, 400);
    }
  }

  async addParticipants(req, res) {
    try {
      const { id } = req.params;
      const { participantIds } = req.body;
      const userId = req.user.id;

      if (!participantIds || !Array.isArray(participantIds)) {
        return errorResponse(res, "participantIds (array) is required", 400);
      }

      const conversation = await conversationService.addParticipants(
        id,
        userId,
        participantIds,
      );

      const io = req.app.get("io");

      if (io) {
        // Lấy thông tin người thêm
        const User = require("../models/User.model");
        const adder = await User.findById(userId).select("name").lean();
        const adderName = adder?.name || "Người dùng";

        // Emit system message cho mỗi người mới được thêm
        for (const newId of participantIds) {
          const addedUser = conversation.participants.find(
            (p) => p._id?.toString() === newId.toString(),
          );
          const addedName = addedUser?.name || "Người dùng";
          const Message = require("../models/Message.model");
          const savedMsg = await Message.create({
            conversationId: id,
            type: "system",
            content: `${addedName} được ${adderName} thêm vào nhóm`,
            senderId: null,
            reactions: [],
          });
          await require("../models/Conversation.model").findByIdAndUpdate(id, {
            lastMessage: savedMsg._id,
          });
          const sysMsg = {
            _id: savedMsg._id.toString(),
            conversationId: id,
            type: "system",
            content: savedMsg.content,
            addedUserAvatar: addedUser?.avatar || null,
            senderId: null,
            createdAt: savedMsg.createdAt,
            reactions: [],
          };

          io.to(`conversation:${id}`).emit("message:system", sysMsg);

          // Join room cho thành viên mới
          io.sockets.sockets.forEach((s) => {
            if (s.userId === newId.toString()) s.join(`conversation:${id}`);
          });

          // Gửi conversation mới cho thành viên mới
          io.to(`user:${newId}`).emit("conversation:new", {
            _id: id,
            ...(conversation.toObject ? conversation.toObject() : conversation),
          });
        }

        // Emit cập nhật danh sách thành viên cho tất cả trong nhóm
        io.to(`conversation:${id}`).emit("conversation:updated_info", {
          _id: id,
          name: conversation.name,
          avatar: conversation.avatar,
          adminId: conversation.adminId,
          moderators: conversation.moderators,
          participants: conversation.participants.map((p) => ({
            _id: p._id?.toString(),
            name: p.name || p.email?.split("@")[0] || "Người dùng",
            avatar: p.avatar || "",
            email: p.email || "",
            phone: p.phone || "",
          })),
        });
      }

      return successResponse(res, conversation, "Participants added");
    } catch (error) {
      console.error("❌ addParticipants error:", error);
      return errorResponse(res, error.message, 400);
    }
  }

  async removeParticipant(req, res) {
    try {
      const { id, userId: targetUserId } = req.params;
      const userId = req.user.id?.toString();

      const User = require("../models/User.model");

      const admin = await User.findById(userId).select("name avatar").lean();
      const adminName = admin?.name || "Trưởng nhóm";

      const target = await User.findById(targetUserId)
        .select("name avatar")
        .lean();
      if (!target) return errorResponse(res, "Không tìm thấy người dùng", 404);
      const targetName = target?.name || "Người dùng";

      const conversation = await conversationService.removeParticipant(
        id,
        userId,
        targetUserId,
      );

      const io = req.app.get("io");
      if (io) {
        const Message = require("../models/Message.model");
        const savedKickMsg = await Message.create({
          conversationId: id,
          type: "system",
          content: `${targetName} được ${adminName} (trưởng nhóm) xóa khỏi nhóm`,
          changerId: userId,
          changerName: adminName,
          senderId: null,
          reactions: [],
        });
        await require("../models/Conversation.model").findByIdAndUpdate(id, {
          lastMessage: savedKickMsg._id,
        });
        const sysMsg = {
          _id: savedKickMsg._id.toString(),
          conversationId: id,
          type: "system",
          content: savedKickMsg.content,
          changerId: userId,
          changerName: adminName,
          targetId: targetUserId,
          targetName: targetName,
          senderId: null,
          createdAt: savedKickMsg.createdAt,
          reactions: [],
        };

        io.to(`conversation:${id}`).emit("message:system", sysMsg);

        io.to(`conversation:${id}`).emit("conversation:lastMessage", {
          conversationId: id,
          lastMessage: {
            _id: sysMsg._id,
            type: "system",
            content: sysMsg.content,
            changerId: userId,
            changerName: adminName,
            senderId: null,
            createdAt: sysMsg.createdAt,
          },
        });

        io.to(`conversation:${id}`).emit("conversation:updated_info", {
          _id: id,
          name: conversation.name,
          avatar: conversation.avatar,
          adminId: conversation.adminId,
          moderators: conversation.moderators,
          participants: conversation.participants.map((p) => ({
            _id: p._id?.toString(),
            name: p.name || "Người dùng",
            avatar: p.avatar || "",
            email: p.email || "",
          })),
        });

        io.to(`user:${targetUserId}`).emit("conversation:kicked", {
          conversationId: id,
        });
      }

      return successResponse(res, conversation, "Participant removed");
    } catch (error) {
      console.error("❌ removeParticipant error:", error);
      if (error.message === "Not found") {
        return errorResponse(res, "Conversation not found", 404);
      }
      return errorResponse(res, error.message, 400);
    }
  }

  async leaveGroup(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const User = require("../models/User.model");
      const leaver = await User.findById(userId).select("name").lean();
      const leaverName = leaver?.name || "Người dùng";

      await conversationService.leaveGroup(id, userId);

      const io = req.app.get("io");
      if (io) {
        const Message = require("../models/Message.model");
        const savedMsg = await Message.create({
          conversationId: id,
          type: "system",
          content: `${leaverName} đã rời khỏi nhóm`,
          changerId: userId,
          changerName: leaverName,
          senderId: null,
          reactions: [],
        });
        await require("../models/Conversation.model").findByIdAndUpdate(id, {
          lastMessage: savedMsg._id,
        });

        const sysMsg = {
          _id: savedMsg._id.toString(),
          conversationId: id,
          type: "system",
          content: savedMsg.content,
          changerId: userId,
          changerName: leaverName,
          senderId: null,
          createdAt: savedMsg.createdAt,
          reactions: [],
        };

        io.to(`conversation:${id}`).emit("message:system", sysMsg);
        io.to(`conversation:${id}`).emit("conversation:lastMessage", {
          conversationId: id,
          lastMessage: {
            _id: sysMsg._id,
            type: "system",
            content: sysMsg.content,
            changerId: userId,
            changerName: leaverName,
            senderId: null,
            createdAt: sysMsg.createdAt,
          },
        });
        io.to(`conversation:${id}`).emit("conversation:member_left", {
          conversationId: id,
          userId,
        });
      }

      return successResponse(res, null, "Left group successfully");
    } catch (error) {
      console.error("❌ leaveGroup error:", error);
      return errorResponse(res, error.message, 400);
    }
  }

  async deleteGroup(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await conversationService.deleteGroup(id, userId);

      // Emit socket
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation:${id}`).emit("conversation:deleted", {
          conversationId: id,
        });
      }

      return successResponse(res, null, "Group deleted successfully");
    } catch (error) {
      console.error("❌ deleteGroup error:", error);
      return errorResponse(res, error.message, 400);
    }
  }

  async updateGroup(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const userId = req.user.id;
      const fs = require("fs");
      const path = require("path");
      const User = require("../models/User.model");

      let avatar = req.body.avatar;

      // Upload file nếu có
      if (req.file) {
        const ext = path.extname(req.file.originalname) || ".jpg";
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const uploadDir = path.join(__dirname, "../../uploads/image");
        if (!fs.existsSync(uploadDir))
          fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
        avatar = `/uploads/image/${filename}`;
      }

      const conversation = await conversationService.updateGroupInfo(
        id,
        userId,
        { name, avatar, description },
      );

      const io = req.app.get("io");
      if (io) {
        // Emit cập nhật info cho tất cả
        io.to(`conversation:${id}`).emit("conversation:updated_info", {
          _id: id,
          name: conversation.name,
          avatar: conversation.avatar,
          description: conversation.description,
          adminId: conversation.adminId,
          moderators: conversation.moderators,
          participants: conversation.participants,
        });

        // Nếu đổi avatar → emit system message
        const changer = await User.findById(userId).select("name").lean();
        const changerName = changer?.name || "Người dùng";

        // Nếu đổi avatar → lưu DB
        if (req.file || (avatar && avatar !== req.body._oldAvatar)) {
          const Message = require("../models/Message.model");
          const savedAvatarMsg = await Message.create({
            conversationId: id,
            type: "system",
            content: `${changerName} đã thay đổi ảnh đại diện nhóm`,
            changerId: userId,
            changerName,
            senderId: null,
            reactions: [],
          });
          await require("../models/Conversation.model").findByIdAndUpdate(id, {
            lastMessage: savedAvatarMsg._id,
          });
          const sysMsg = {
            _id: savedAvatarMsg._id.toString(),
            conversationId: id,
            type: "system",
            content: savedAvatarMsg.content,
            changerId: userId,
            changerName,
            senderId: null,
            createdAt: savedAvatarMsg.createdAt,
            reactions: [],
          };
          io.to(`conversation:${id}`).emit("message:system", sysMsg);
          io.to(`conversation:${id}`).emit("conversation:lastMessage", {
            conversationId: id,
            lastMessage: {
              _id: sysMsg._id,
              type: "system",
              content: sysMsg.content,
              changerId: userId,
              changerName,
              senderId: null,
              createdAt: sysMsg.createdAt,
            },
          });
        }

        // Nếu đổi tên → lưu DB
        if (name && name !== conversation.name) {
          const Message = require("../models/Message.model");
          const savedNameMsg = await Message.create({
            conversationId: id,
            type: "system",
            content: `${changerName} đã đổi tên nhóm thành "${name}"`,
            changerId: userId,
            changerName,
            senderId: null,
            reactions: [],
          });
          await require("../models/Conversation.model").findByIdAndUpdate(id, {
            lastMessage: savedNameMsg._id,
          });
          const sysNameMsg = {
            _id: savedNameMsg._id.toString(),
            conversationId: id,
            type: "system",
            content: savedNameMsg.content,
            changerId: userId,
            changerName,
            senderId: null,
            createdAt: savedNameMsg.createdAt,
            reactions: [],
          };
          io.to(`conversation:${id}`).emit("message:system", sysNameMsg);
          io.to(`conversation:${id}`).emit("conversation:lastMessage", {
            conversationId: id,
            lastMessage: {
              _id: sysNameMsg._id,
              type: "system",
              content: sysNameMsg.content,
              changerId: userId,
              changerName,
              senderId: null,
              createdAt: sysNameMsg.createdAt,
            },
          });
        }
      }

      return successResponse(res, conversation, "Group updated");
    } catch (error) {
      console.error("❌ updateGroup error:", error);
      return errorResponse(res, error.message, 400);
    }
  }

  async updatePermissions(req, res) {
    try {
      const { id } = req.params;
      const { permissions } = req.body;
      const userId = req.user.id;

      const conversation = await conversationService.updateGroupPermissions(
        id,
        userId,
        permissions,
      );

      // Emit socket
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation:${id}`).emit("conversation:permissions_updated", {
          conversationId: id,
          permissions: conversation.permissions,
        });
      }

      return successResponse(res, conversation, "Permissions updated");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async addModerator(req, res) {
    try {
      const { id } = req.params;
      const { userId: targetUserId } = req.body;
      const userId = req.user.id;

      const conversation = await conversationService.addModerator(
        id,
        userId,
        targetUserId,
      );

      // Emit socket
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation:${id}`).emit("conversation:moderator_added", {
          conversationId: id,
          moderatorId: targetUserId,
        });
      }

      return successResponse(res, conversation, "Moderator added");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async removeModerator(req, res) {
    try {
      const { id, userId: targetUserId } = req.params;
      const userId = req.user.id;

      const conversation = await conversationService.removeModerator(
        id,
        userId,
        targetUserId,
      );

      // Emit socket
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation:${id}`).emit("conversation:moderator_removed", {
          conversationId: id,
          moderatorId: targetUserId,
        });
      }

      return successResponse(res, conversation, "Moderator removed");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async transferOwnership(req, res) {
    try {
      const { id } = req.params;
      const { newAdminId } = req.body;
      const userId = req.user.id;

      const conversation = await conversationService.transferOwnership(
        id,
        userId,
        newAdminId,
      );

      // Emit socket
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation:${id}`).emit("conversation:ownership_transferred", {
          conversationId: id,
          newAdminId,
        });
      }

      return successResponse(res, conversation, "Ownership transferred");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async togglePin(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await conversationService.togglePin(id, userId);

      return successResponse(res, result, "Pin status updated");
    } catch (error) {
      console.error("❌ togglePin error:", error);
      return errorResponse(res, error.message, 400);
    }
  }

  async toggleMute(req, res) {
    try {
      const { id } = req.params;
      const { mutedUntil } = req.body;
      const userId = req.user.id;

      const result = await conversationService.toggleMute(
        id,
        userId,
        mutedUntil,
      );

      return successResponse(res, result, "Mute status updated");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async toggleBlock(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await conversationService.toggleBlock(id, userId);

      return successResponse(res, result, "Block status updated");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async toggleArchive(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await conversationService.toggleArchive(id, userId);

      return successResponse(res, result, "Archive status updated");
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }

  async markAllAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await conversationService.markAllAsRead(id, userId);

      return successResponse(res, result, "Marked as read");
    } catch (error) {
      console.error("❌ markAllAsRead error:", error);
      return errorResponse(res, error.message, 400);
    }
  }
}

module.exports = new ConversationController();
