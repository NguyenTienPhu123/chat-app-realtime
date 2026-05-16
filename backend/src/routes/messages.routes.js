const express = require("express");
const router = express.Router();
const messageController = require("../controllers/message.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const uploadMiddleware = require("../middlewares/upload.middleware");

// All routes require authentication
router.use(authMiddleware);

// Get messages in conversation (with pagination)
router.get("/:conversationId", messageController.getMessages);

// Send message
router.post("/", uploadMiddleware.any(), messageController.sendMessage);

// Edit message
router.patch("/:id/edit", messageController.editMessage);

// Forward message
router.post("/:id/forward", messageController.forwardMessage);

// Pin message
router.post("/:id/pin", messageController.pinMessage);

// Unpin message
router.delete("/:id/pin", messageController.unpinMessage);

// Get pinned messages
router.get("/:conversationId/pinned", messageController.getPinnedMessages);

// Search messages
router.get("/:conversationId/search", messageController.searchMessages);

// Update message status
router.patch("/:id/status", messageController.updateStatus);

// Mark all as read
router.post("/:conversationId/mark-read", messageController.markAllAsRead);

// Delete message
router.delete("/:id", messageController.deleteMessage);

// Add reaction
router.post("/:id/reaction", messageController.addReaction);

// Remove reaction
router.delete("/:id/reaction", messageController.removeReaction);

module.exports = router;
