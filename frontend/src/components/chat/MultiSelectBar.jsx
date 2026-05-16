import React from "react";
import "./MultiSelectBar.css";

// ✅ ICON THU HỒI ĐÚNG (Mũi tên quay lại)
const RecallIcon = ({ size = 20, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

const MultiSelectBar = ({
  selectedMessages,
  onCopy,
  onForward,
  onRecall,
  onDelete,
  onCancel,
  currentUserId,
}) => {
  const count = selectedMessages.length;

  // Kiểm tra tất cả tin nhắn có phải của user không
  const allOwn = selectedMessages.every((m) => {
    const id = m.senderId?._id?.toString() || m.senderId?.toString();
    return id === currentUserId;
  });

  // ✅ Kiểm tra có tin nhắn text không (để hiện nút Copy)
  const hasTextMessages = selectedMessages.some((m) => m.type === "text");

  return (
    <div className="multiselect-bar">
      <div className="multiselect-info">
        <span>{count} tin nhắn được chọn</span>
      </div>

      <div className="multiselect-actions">
        {/* ✅ NÚT SAO CHÉP - Hiện khi có tin nhắn text */}
        {hasTextMessages && (
          <button className="ms-btn" onClick={onCopy} title="Sao chép">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
            </svg>
            <span>Sao chép</span>
          </button>
        )}

        {/* NÚT CHIA SẺ */}
        <button className="ms-btn" onClick={onForward} title="Chia sẻ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" />
          </svg>
          <span>Chia sẻ</span>
        </button>

        {/* ✅ NÚT THU HỒI - Icon mới đúng */}
        {allOwn && (
          <button
            className="ms-btn danger"
            onClick={onRecall}
            title="Thu hồi tin nhắn"
          >
            <RecallIcon size={20} />
            <span>Thu hồi</span>
          </button>
        )}

        {/* NÚT XÓA */}
        <button className="ms-btn danger" onClick={onDelete} title="Xóa">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
          <span>Xóa</span>
        </button>

        {/* NÚT HỦY */}
        <button className="ms-btn cancel" onClick={onCancel} title="Hủy">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
          <span>Hủy</span>
        </button>
      </div>
    </div>
  );
};

export default MultiSelectBar;
