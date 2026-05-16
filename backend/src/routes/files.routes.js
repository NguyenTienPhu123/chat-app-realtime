const express = require("express");
const router = express.Router();
const path = require("path");
const Message = require("../models/Message.model");
const authMiddleware = require("../middlewares/auth.middleware");
const uploadMiddleware = require("../middlewares/upload.middleware");
const fileService = require("../services/file.service");

// ✅ SERVE FILE VỚI TÊN GỐC
router.get("/view/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message || !message.fileUrl) {
      return res.status(404).send("File not found");
    }

    const filePath = path.join(__dirname, "../..", message.fileUrl);
    const fileName = message.fileName || "file";

    // ✅ SET HEADER với tên file gốc (UTF-8)
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );

    // Set content type
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");

    res.sendFile(filePath);
  } catch (error) {
    console.error("❌ View file error:", error);
    res.status(500).send("Error loading file");
  }
});

// Upload ảnh (dùng cho avatar nhóm, v.v.)
router.post(
  "/upload/image",
  authMiddleware,
  uploadMiddleware.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Không có file" });
      const result = await fileService.uploadFile(req.file, "image");
      return res.json({ data: result });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
);

module.exports = router;
