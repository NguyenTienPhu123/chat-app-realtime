import React from "react";
import "./CallMessage.css";
import {
  PhoneOutgoingIcon,
  PhoneIncomingIcon,
  PhoneMissedIcon,
  VideoOutgoingIcon,
  VideoIncomingIcon,
  VideoMissedIcon,
} from "../../icons/CallIcons";

const formatDuration = (secs) => {
  if (!secs || secs <= 0) return null;
  const m = Math.floor(secs / 60),
    s = secs % 60;
  return m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
};

// ── Icon: Cảnh báo (failed / offline) ────────────────────────
const WarningIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#e53935">
    <path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
      10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
    />
  </svg>
);

// ── Component chính ──────────────────────────────────────────
const CallMessage = ({ message, isSelf, onCallBack }) => {
  const { callType, callStatus, callDuration } = message;
  const isVideo = callType === "video";
  const duration = formatDuration(callDuration);

  // ── Dòng 1: Trạng thái / hướng cuộc gọi ─────────────────
  const getLine1 = () => {
    switch (callStatus) {
      case "completed":
        return isSelf ? "Bạn đã gọi đi" : "Cuộc gọi đến";
      case "missed":
        return isSelf ? "Không có người trả lời" : "Cuộc gọi nhỡ";
      case "rejected":
        return isSelf ? "Cuộc gọi bị từ chối" : "Bạn đã từ chối";
      case "cancelled":
        return isSelf ? "Bạn đã hủy cuộc gọi" : "Cuộc gọi bị hủy";
      case "failed":
        return "Cuộc gọi thất bại";
      case "offline":
        return "Người dùng không khả dụng";
      case "ringing":
        return isSelf ? "Đang gọi..." : "Cuộc gọi đến...";
      default:
        return isSelf ? "Bạn đã gọi" : "Cuộc gọi đến";
    }
  };

  // ── Dòng 2: 1 icon kết hợp + loại + thời lượng ──────────
  const getLine2 = () => {
    const type = isVideo ? "Gọi video" : "Gọi thoại";
    const text =
      duration && callStatus === "completed" ? `${type} · ${duration}` : type;
    const icon = isVideo ? (
      <VideoOutgoingIcon size={18} color="currentColor" />
    ) : (
      <PhoneOutgoingIcon size={18} color="currentColor" />
    );
    return { icon, text };
  };

  const isBad = [
    "missed",
    "rejected",
    "cancelled",
    "failed",
    "offline",
  ].includes(callStatus);
  const isMissedForMe = callStatus === "missed" && !isSelf;
  const line1 = getLine1();
  const line2 = getLine2();

  return (
    <div
      className={[
        "call-msg",
        isSelf ? "call-msg--self" : "call-msg--other",
        isMissedForMe ? "call-msg--missed" : "",
        isBad ? "call-msg--bad" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Dòng 1 — trạng thái */}
      <div className="call-msg__line1">{line1}</div>

      {/* Dòng 2 — 1 icon + loại + thời lượng */}
      <div className="call-msg__line2">
        <span className="call-msg__icon">{line2.icon}</span>
        <span className="call-msg__line2-text">{line2.text}</span>
      </div>

      <div className="call-msg__divider" />

      {/* Dòng 3 — gọi lại căn giữa */}
      <button className="call-msg__callback" onClick={onCallBack}>
        Gọi lại
      </button>
    </div>
  );
};

export default CallMessage;
