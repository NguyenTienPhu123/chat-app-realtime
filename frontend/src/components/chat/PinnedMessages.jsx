import React from "react";
import { formatMessageTime } from "../../utils/date.util";
import "./PinnedMessages.css";

const PinnedMessages = ({
  messages = [],
  onClose,
  onMessageClick,
  onUnpin,
}) => {
  const pinnedMessages = messages.filter((m) => m.isPinned && !m.isDeleted);

  const handleUnpin = (messageId) => {
    onUnpin?.(messageId);
  };

  const getMessagePreview = (message) => {
    if (message.type === "text") return message.content;
    if (message.caption) return message.caption;
    const typeLabels = {
      image: "📷 Hình ảnh",
      images: "📷 Hình ảnh",
      video: "🎥 Video",
      file: "📄 File",
      voice: "🎤 Tin nhắn thoại",
    };
    return typeLabels[message.type] || "Tin nhắn";
  };

  return (
    <div className="pinned-messages-dropdown">
      <div className="pinned-header">
        <div className="pinned-title">
          <span className="pin-icon">📌</span>
          <span>Tin nhắn đã ghim</span>
          <span className="pinned-count">({pinnedMessages.length})</span>
        </div>
        <button className="close-pinned-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="pinned-list">
        {pinnedMessages.length === 0 && (
          <div className="no-pinned">
            <span>📌</span>
            <p>Chưa có tin nhắn nào được ghim</p>
          </div>
        )}

        {pinnedMessages.map((message) => (
          <div key={message._id} className="pinned-item">
            <div
              className="pinned-content"
              onClick={() => {
                onMessageClick(message._id);
                onClose();
              }}
            >
              <div className="pinned-sender">
                <img
                  src={
                    message.senderId?.avatar ||
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=default"
                  }
                  alt={message.senderId?.name}
                  className="pinned-avatar"
                />
                <div className="pinned-info">
                  <span className="pinned-name">
                    {(() => {
                      const sid =
                        message.senderId?._id?.toString() ||
                        message.senderId?.toString?.() ||
                        message.senderId;
                      return (
                        (sid && localStorage.getItem(`nickname_user_${sid}`)) ||
                        message.senderId?.name ||
                        "Người dùng"
                      );
                    })()}
                  </span>
                  <span className="pinned-time">
                    {formatMessageTime(message.createdAt)}
                  </span>
                </div>
              </div>
              <div className="pinned-text">{getMessagePreview(message)}</div>
            </div>
            <button
              className="unpin-btn"
              onClick={() => handleUnpin(message._id)}
              title="Bỏ ghim"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PinnedMessages;
