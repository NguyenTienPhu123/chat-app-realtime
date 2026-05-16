const path = require("path");
const fs = require("fs").promises;
const sharp = require("sharp");

class FileService {
  async uploadFile(file, type = "file") {
    try {
      const uploadsDir = path.join(__dirname, "../../uploads", type);
      await fs.mkdir(uploadsDir, { recursive: true });

      // ✅ KHÔNG CONVERT NỮA - ĐÃ ĐÚNG TỪ MIDDLEWARE!
      const originalName = file.originalname; // ← XÓA Buffer.from()
      const ext = path.extname(originalName).toLowerCase();
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 10);
      const safeFileName = `${timestamp}-${random}${ext}`;
      const filePath = path.join(uploadsDir, safeFileName);

      await fs.writeFile(filePath, file.buffer);

      const result = {
        url: `/uploads/${type}/${safeFileName}`,
        fileName: originalName, // ✅ TÊN ĐÚNG
      };

      if (type === "image") {
        const thumbnailDir = path.join(__dirname, "../../uploads/thumbnails");
        await fs.mkdir(thumbnailDir, { recursive: true });

        const thumbnailName = `thumb_${safeFileName}`;
        const thumbnailPath = path.join(thumbnailDir, thumbnailName);

        await sharp(file.buffer)
          .resize(300, 300, { fit: "inside" })
          .toFile(thumbnailPath);

        result.thumbnail = `/uploads/thumbnails/${thumbnailName}`;
      }

      console.log(`✅ Uploaded: "${originalName}" → ${safeFileName}`);
      return result;
    } catch (error) {
      console.error("❌ Upload error:", error);
      throw new Error("Failed to upload file");
    }
  }

  async deleteFile(fileUrl) {
    try {
      if (!fileUrl) return;

      const filePath = path.join(__dirname, "../..", fileUrl);
      await fs.unlink(filePath);

      if (fileUrl.includes("/image/")) {
        const fileName = path.basename(fileUrl);
        const thumbnailPath = path.join(
          __dirname,
          "../../uploads/thumbnails",
          `thumb_${fileName}`,
        );
        try {
          await fs.unlink(thumbnailPath);
        } catch {}
      }
    } catch (error) {
      console.error("❌ Delete error:", error);
    }
  }
}

module.exports = new FileService();
