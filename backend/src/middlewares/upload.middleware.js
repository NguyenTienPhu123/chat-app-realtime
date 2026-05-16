const multer = require("multer");

// ✅ SỬA ENCODING TIẾNG VIỆT
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    // ✅ FIX ENCODING: Latin1 → UTF-8
    file.originalname = Buffer.from(file.originalname, "latin1").toString(
      "utf8",
    );
    cb(null, true);
  },
});

module.exports = upload;
