const express = require("express");
const router = express.Router();
const conversationController = require("../controllers/conversation.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");

router.use(authMiddleware);

// Get user's conversations
router.get("/", conversationController.getUserConversations);

// Create private conversation
router.post("/private", conversationController.createPrivate);

// Create group conversation
router.post("/group", conversationController.createGroup);

// Get conversation details
router.get("/:id", conversationController.getConversation);

// Update group info
router.patch(
  "/:id",
  upload.single("groupAvatar"),
  conversationController.updateGroup,
);

// Add participants to group
router.post("/:id/participants", conversationController.addParticipants);

// Remove participant from group — phải đặt TRƯỚC router.delete("/:id")
router.delete(
  "/:id/participants/:userId",
  conversationController.removeParticipant,
);

// Remove moderator — phải đặt TRƯỚC router.delete("/:id")
router.delete(
  "/:id/moderators/:userId",
  conversationController.removeModerator,
);

// Delete group — đặt SAU tất cả delete có sub-path
router.delete("/:id", conversationController.deleteGroup);

// Leave group
router.post("/:id/leave", conversationController.leaveGroup);

// Update group permissions
router.patch("/:id/permissions", conversationController.updatePermissions);

// Add moderator
router.post("/:id/moderators", conversationController.addModerator);

// Transfer ownership
router.post("/:id/transfer", conversationController.transferOwnership);

// Pin/Unpin conversation
router.post("/:id/pin", conversationController.togglePin);

// Mute/Unmute conversation
router.post("/:id/mute", conversationController.toggleMute);

// Block/Unblock user
router.post("/:id/block", conversationController.toggleBlock);

// Archive/Unarchive conversation
router.post("/:id/archive", conversationController.toggleArchive);

// Mark all messages as read
router.post("/:id/mark-read", conversationController.markAllAsRead);

module.exports = router;
