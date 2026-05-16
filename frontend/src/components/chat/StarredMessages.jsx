import React, { useEffect, useState } from "react";
import { useSocket } from "../../hooks/useSocket";
import "./StarredMessages.css";

const formatStarredDate = (date) => {
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDate.getTime() === today.getTime()) return "Hôm nay";
  if (msgDate.getTime() === yesterday.getTime()) return "Hôm qua";
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

const formatTime = (date) => {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const StarredMessages = ({ onClose, onJumpToMessage }) => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!socket) return;
    socket.emit("message:getStarred");
    const handleList = (data) => {
      setMessages(data);
      setLoading(false);
    };
    socket.on("message:starredList", handleList);
    return () => socket.off("message:starredList", handleList);
  }, [socket]);

  const handleUnstar = (messageId) => {
    socket?.emit("message:star", { messageId });
    setMessages((prev) => prev.filter((m) => m._id !== messageId));
  };

  const renderContent = (msg) => {
    if (msg.type === "text") return msg.content;
    if (msg.type === "image" || msg.type === "images") return "🖼️ Hình ảnh";
    if (msg.type === "file") return `📎 ${msg.fileName}`;
    if (msg.type === "voice") return "🎤 Tin nhắn thoại";
    if (msg.type === "video") return "🎥 Video";
    return "[Tin nhắn]";
  };

  return (
    <div className="starred-overlay" onClick={onClose}>
      <div className="starred-panel" onClick={(e) => e.stopPropagation()}>
        <div className="starred-header">
          <span>⭐ Tin nhắn đã đánh dấu</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="starred-body">
          {loading && <div className="starred-loading">Đang tải...</div>}
          {!loading && messages.length === 0 && (
            <div className="starred-empty">
              <span>⭐</span>
              <p>Chưa có tin nhắn nào được đánh dấu</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg._id} className="starred-item">
              <div
                className="starred-item-main"
                onClick={() => {
                  onJumpToMessage(
                    msg.conversationId?._id || msg.conversationId,
                    msg._id,
                  );
                  onClose();
                }}
              >
                <img
                  src={
                    msg.senderId?.avatar ||
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=default"
                  }
                  alt={msg.senderId?.name}
                  className="starred-avatar"
                />
                <div className="starred-info">
                  <div className="starred-meta">
                    <span className="starred-sender">
                      {msg.senderId?.name || "Người dùng"}
                    </span>
                    <span className="starred-time">
                      {formatStarredDate(msg.starredAt)} •{" "}
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <p className="starred-content">{renderContent(msg)}</p>
                </div>
              </div>
              <button
                className="starred-unstar-btn"
                onClick={() => handleUnstar(msg._id)}
                title="Bỏ đánh dấu"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StarredMessages;
