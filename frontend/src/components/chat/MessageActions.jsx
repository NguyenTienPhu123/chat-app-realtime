import React, { useState } from "react";
import {
  ReplyIcon,
  ForwardIcon,
  CopyIcon,
  PinIcon,
  StarIcon,
  InfoIcon,
  CheckSquareIcon,
  DeleteIcon,
  CloseIcon,
} from "../../icons";
import "./MessageActions.css";

const REACTIONS = [
  { emoji: "👍", label: "Thích" },
  { emoji: "❤️", label: "Yêu" },
  { emoji: "😂", label: "Haha" },
  { emoji: "😮", label: "Wow" },
  { emoji: "😢", label: "Buồn" },
  { emoji: "😡", label: "Tức" },
];

const MessageActions = ({
  message,
  isOwn,
  currentUserId,
  onClose,
  onReply,
  onForward,
  onPin,
  onDelete,
  onRecall,
  onReact,
  onRemoveReact,
  onStar,
  onSelectMode,
}) => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'delete' | 'recall', label: string }

  const showNotification = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    const baseURL =
      import.meta.env.VITE_API_URL?.replace("/api", "") ||
      "http://localhost:5000";
    return `${baseURL}${url}`;
  };

  const handleCopy = async () => {
    try {
      if (message.type === "text") {
        await navigator.clipboard.writeText(message.content || "");
      } else if (message.type === "image") {
        const response = await fetch(getFullUrl(message.fileUrl));
        const blob = await response.blob();
        const imgBitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = imgBitmap.width;
        canvas.height = imgBitmap.height;
        canvas.getContext("2d").drawImage(imgBitmap, 0, 0);
        await new Promise((resolve) =>
          canvas.toBlob(async (pngBlob) => {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": pngBlob }),
            ]);
            resolve();
          }, "image/png"),
        );
      } else if (message.type === "images") {
        const url = message.images?.[0]?.url;
        if (url) {
          const response = await fetch(getFullUrl(url));
          const blob = await response.blob();
          const imgBitmap = await createImageBitmap(blob);
          const canvas = document.createElement("canvas");
          canvas.width = imgBitmap.width;
          canvas.height = imgBitmap.height;
          canvas.getContext("2d").drawImage(imgBitmap, 0, 0);
          await new Promise((resolve) =>
            canvas.toBlob(async (pngBlob) => {
              await navigator.clipboard.write([
                new ClipboardItem({ "image/png": pngBlob }),
              ]);
              resolve();
            }, "image/png"),
          );
        }
      } else if (message.type === "file") {
        // File không copy được binary qua clipboard API, copy tên file thay thế
        await navigator.clipboard.writeText(message.fileName || "");
      } else if (message.type === "voice" || message.type === "video") {
        await navigator.clipboard.writeText(message.fileName || "");
      }

      showNotification("✓ Đã sao chép");
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
      showNotification("✗ Sao chép thất bại");
    }
  };

  const handlePin = () => {
    onPin?.();
    showNotification(message.isPinned ? "✓ Đã bỏ ghim" : "✓ Đã ghim tin nhắn");
    setTimeout(() => onClose(), 1500);
  };

  const handleStar = () => {
    onStar?.();
    const isStarred = message.starredBy?.some(
      (s) => (s.userId?._id || s.userId)?.toString() === currentUserId,
    );
    showNotification(isStarred ? "✓ Đã bỏ đánh dấu" : "✓ Đã đánh dấu tin nhắn");
    setTimeout(() => onClose(), 1500);
  };

  const handleDelete = () => {
    setConfirmAction({ type: "delete", label: "Xóa tin nhắn này?" });
  };

  const handleRecall = () => {
    setConfirmAction({ type: "recall", label: "Thu hồi tin nhắn này?" });
  };

  const handleConfirm = () => {
    if (confirmAction?.type === "delete") {
      onDelete?.();
      showNotification("✓ Đã xóa tin nhắn");
    } else if (confirmAction?.type === "recall") {
      onRecall?.();
      showNotification("✓ Đã thu hồi tin nhắn");
    }
    setConfirmAction(null);
    onClose();
  };

  const myReaction = message.reactions?.find(
    (r) => (r.userId?._id || r.userId)?.toString() === currentUserId,
  );

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <div className="ma-overlay">
        <div className="ma-backdrop" onClick={onClose} />

        <div className="ma-panel">
          {/* Header với nút X */}
          <div className="ma-header">
            <span>Tùy chọn</span>
            <button className="ma-close-btn" onClick={onClose}>
              <CloseIcon size={20} />
            </button>
          </div>

          {/* Reactions */}
          <div className="ma-reactions">
            {REACTIONS.map(({ emoji, label }) => (
              <button
                key={emoji}
                className={`ma-reaction-btn ${myReaction?.emoji === emoji ? "active" : ""}`}
                onClick={() => {
                  onReact?.(emoji);
                  onClose();
                }}
              >
                <span className="ma-reaction-emoji">{emoji}</span>
                <span className="ma-reaction-label">{label}</span>
              </button>
            ))}
            {myReaction && (
              <button
                className="ma-reaction-remove"
                onClick={() => {
                  onRemoveReact?.();
                  onClose();
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="ma-actions-list">
            <button
              className="ma-action-item"
              onClick={() => {
                onReply?.();
                onClose();
              }}
            >
              <ReplyIcon size={20} />
              <span>Trả lời</span>
            </button>

            <button
              className="ma-action-item"
              onClick={() => {
                onForward?.();
                onClose();
              }}
            >
              <ForwardIcon size={20} />
              <span>Chia sẻ</span>
            </button>

            {(message.type === "text" ||
              message.type === "image" ||
              message.type === "images" ||
              message.type === "file" ||
              message.type === "voice" ||
              message.type === "video") && (
              <button className="ma-action-item" onClick={handleCopy}>
                <CopyIcon size={20} />
                <span>Sao chép</span>
              </button>
            )}

            <button className="ma-action-item" onClick={handlePin}>
              <PinIcon size={20} />
              <span>{message.isPinned ? "Bỏ ghim" : "Ghim tin nhắn"}</span>
            </button>

            <button className="ma-action-item" onClick={handleStar}>
              <StarIcon size={20} />
              <span>Đánh dấu tin nhắn</span>
            </button>

            <button
              className="ma-action-item"
              onClick={() => setShowDetailModal(true)}
            >
              <InfoIcon size={20} />
              <span>Xem chi tiết</span>
            </button>

            <button
              className="ma-action-item"
              onClick={() => {
                onSelectMode?.();
                onClose();
              }}
            >
              <CheckSquareIcon size={20} />
              <span>Chọn nhiều tin nhắn</span>
            </button>

            {isOwn && (
              <button className="ma-action-item danger" onClick={handleRecall}>
                <DeleteIcon size={20} />
                <span>Thu hồi tin nhắn</span>
              </button>
            )}

            <button className="ma-action-item danger" onClick={handleDelete}>
              <DeleteIcon size={20} />
              <span>Xóa chỉ ở phía tôi</span>
            </button>
          </div>
        </div>
      </div>

      {confirmAction && (
        <div
          className="ma-detail-overlay"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="ma-detail-modal"
            style={{ maxWidth: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ma-detail-header">
              <span>
                {confirmAction.type === "delete"
                  ? "Xóa tin nhắn"
                  : "Thu hồi tin nhắn"}
              </span>
              <button onClick={() => setConfirmAction(null)}>
                <CloseIcon size={20} />
              </button>
            </div>
            <div className="ma-detail-body">
              <p style={{ fontSize: 15, color: "#1a1a1a", marginBottom: 20 }}>
                {confirmAction.label}
              </p>
              <div
                style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
              >
                <button
                  onClick={() => setConfirmAction(null)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirm}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#e53935",
                    color: "white",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && <div className="ma-toast">{toastMessage}</div>}

      {/* Detail Modal */}
      {showDetailModal && (
        <div
          className="ma-detail-overlay"
          onClick={() => setShowDetailModal(false)}
        >
          <div className="ma-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ma-detail-header">
              <span>Chi tiết tin nhắn</span>
              <button onClick={() => setShowDetailModal(false)}>
                <CloseIcon size={20} />
              </button>
            </div>
            <div className="ma-detail-body">
              {/* Nội dung tin nhắn */}
              <div className="ma-detail-section">
                <span className="ma-detail-section-title">Nội dung</span>
                <div className="ma-detail-content-box">
                  {message.type === "text" && (
                    <p className="ma-detail-message-text">{message.content}</p>
                  )}
                  {(message.type === "image" || message.type === "images") && (
                    <p className="ma-detail-message-text">Hình ảnh</p>
                  )}
                  {message.type === "file" && (
                    <p className="ma-detail-message-text">
                      📎 {message.fileName}
                    </p>
                  )}
                  {message.type === "voice" && (
                    <p className="ma-detail-message-text">🎤 Tin nhắn thoại</p>
                  )}
                  {message.type === "video" && (
                    <p className="ma-detail-message-text">🎥 Video</p>
                  )}
                </div>
              </div>

              {/* Thông tin */}
              <div className="ma-detail-section">
                <span className="ma-detail-section-title">Thông tin</span>
                <div className="ma-detail-row">
                  <span className="label">Người gửi:</span>
                  <span className="value">
                    {message.senderId?.name || "Không rõ"}
                  </span>
                </div>
                <div className="ma-detail-row">
                  <span className="label">Thời gian gửi:</span>
                  <span className="value">{formatTime(message.createdAt)}</span>
                </div>
                {message.isEdited && (
                  <div className="ma-detail-row">
                    <span className="label">Đã chỉnh sửa:</span>
                    <span className="value">
                      {formatTime(message.editedAt)}
                    </span>
                  </div>
                )}
                <div className="ma-detail-row">
                  <span className="label">Loại:</span>
                  <span className="value">{message.type}</span>
                </div>
                {message.isPinned && (
                  <div className="ma-detail-row">
                    <span className="label">Đã ghim lúc:</span>
                    <span className="value">
                      {formatTime(message.pinnedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Cảm xúc */}
              {message.reactions?.length > 0 && (
                <div className="ma-detail-section">
                  <span className="ma-detail-section-title">
                    Cảm xúc ({message.reactions.length})
                  </span>
                  <div className="ma-detail-reactions-list">
                    {message.reactions.map((r, i) => (
                      <div key={i} className="ma-detail-reaction-item">
                        <img
                          src={
                            r.userId?.avatar ||
                            "https://api.dicebear.com/7.x/avataaars/svg?seed=default"
                          }
                          alt={r.userId?.name}
                          className="ma-detail-reaction-avatar"
                        />
                        <span className="ma-detail-reaction-name">
                          {r.userId?.name || "Người dùng"}
                        </span>
                        <span className="ma-detail-reaction-emoji">
                          {r.emoji}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageActions;
