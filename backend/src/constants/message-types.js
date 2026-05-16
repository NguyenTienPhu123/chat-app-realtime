module.exports = {
  MESSAGE_TYPES: {
    TEXT: "text",
    IMAGE: "image",
    FILE: "file",
    VIDEO: "video",
    AUDIO: "audio",
  },

  MESSAGE_STATUS: {
    SENDING: "sending",
    SENT: "sent",
    DELIVERED: "delivered",
    READ: "read",
  },

  FILE_MAX_SIZE: {
    IMAGE: 10 * 1024 * 1024, // 10MB
    VIDEO: 100 * 1024 * 1024, // 100MB
    FILE: 50 * 1024 * 1024, // 50MB
    AUDIO: 20 * 1024 * 1024, // 20MB
  },

  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  ALLOWED_VIDEO_TYPES: ["video/mp4", "video/webm", "video/ogg"],
  ALLOWED_AUDIO_TYPES: ["audio/mp3", "audio/wav", "audio/ogg", "audio/mpeg"],
};
