import React, { useEffect, useState } from "react";
import "./Toast.css";

const Toast = ({ message, type = "success", duration = 2000, onDone }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    // Đợi animation out xong rồi mới gọi onDone
    setTimeout(() => onDone?.(), 400);
  };

  useEffect(() => {
    // Slide in
    const t1 = setTimeout(() => setVisible(true), 10);

    // Tự dismiss sau duration (thanh chạy hết)
    const t3 = setTimeout(() => dismiss(), duration);

    return () => {
      clearTimeout(t1);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div
      className={`toast-wrap ${visible ? "toast-in" : ""} ${leaving ? "toast-out" : ""}`}
    >
      <div className={`toast-card toast-${type}`}>
        <span className="toast-icon">
          {type === "success" ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </span>
        <span className="toast-msg">{message}</span>
        <button className="toast-close" onClick={dismiss}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div
        className={`toast-progress toast-progress-${type}`}
        style={{
          animationDuration: `${duration}ms`,
          animationPlayState: visible ? "running" : "paused",
        }}
      />
    </div>
  );
};

export default Toast;
