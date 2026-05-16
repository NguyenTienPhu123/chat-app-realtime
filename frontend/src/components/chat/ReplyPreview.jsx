import React from "react";
import { useAuth } from "../../hooks/useAuth";
import "./ReplyPreview.css";

const ReplyPreview = ({ message, onCancel }) => {
  const { user } = useAuth();
  if (!message) return null;

  // ❌ Ẩn reply nếu là ảnh nhiều (images)
  if (message.type === "images") return null;

  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    const baseURL =
      import.meta.env.VITE_API_URL?.replace("/api", "") ||
      "http://localhost:5000";
    return `${baseURL}${url}`;
  };

  const getPreviewText = () => {
    if (message.type === "image") {
      return message.caption || message.content || "";
    }
    if (message.type === "file") return "[File] " + (message.fileName || "");
    if (message.type === "voice") return "[Tin nhắn thoại]";
    if (message.type === "video") return "[Video]";
    return message.content || "";
  };

  const showThumbnail = message.type === "image" && message.fileUrl;
  const thumbnailUrl = message.fileUrl;
  const senderName =
    message.senderId?.name || message.senderName || "Người dùng";

  return (
    <div className="reply-preview-bar">
      <div className="reply-line" />

      {showThumbnail && (
        <img
          src={getFullUrl(thumbnailUrl)}
          alt=""
          className="reply-thumbnail"
        />
      )}

      <div className="reply-content">
        <span className="reply-to-label">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ marginRight: 5, opacity: 0.7 }}
          >
            <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
          </svg>
          {senderName}
        </span>
        <span className="reply-message-preview">
          {showThumbnail
            ? "[Hình ảnh]" + (getPreviewText() ? " " + getPreviewText() : "")
            : getPreviewText()}
        </span>
      </div>

      <button className="cancel-reply-btn" onClick={onCancel} title="Hủy">
        ✕
      </button>
    </div>
  );
};

export default ReplyPreview;
