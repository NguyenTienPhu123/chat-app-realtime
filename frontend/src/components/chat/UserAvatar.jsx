import React, { useState, useEffect } from "react";
import {
  generateTextAvatar,
  getAvatarColor,
  getAvatarInitial,
} from "../../utils/avatar.util";

const UserAvatar = ({
  name = "",
  avatar = "",
  size = 40,
  className = "",
  style = {},
  onClick,
  isMyDoc = false,
}) => {
  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    setImgError(false);
  }, [avatar]);

  // Avatar đặc biệt cho My Document
  if (isMyDoc) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          cursor: onClick ? "pointer" : "default",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
        onClick={onClick}
      >
        <svg
          width={size * 0.5}
          height={size * 0.5}
          viewBox="0 0 24 24"
          fill="white"
        >
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM6 20V4h5v7h7v9H6z" />
          <path d="M8 14h8v1.5H8zm0 3h5v1.5H8z" />
        </svg>
      </div>
    );
  }

  const hasRealAvatar =
    avatar &&
    !avatar.includes("dicebear") &&
    !avatar.includes("/default-avatar") &&
    !imgError;

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    cursor: onClick ? "pointer" : "default",
    ...style,
  };

  const avatarSrc = avatar?.startsWith("/uploads")
    ? `${import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000"}${avatar}?v=${Date.now()}`
    : avatar;

  if (hasRealAvatar) {
    return (
      <img
        src={avatarSrc}
        alt={name}
        className={className}
        style={containerStyle}
        onError={() => setImgError(true)}
        onClick={onClick}
      />
    );
  }

  // Fallback: chữ cái đầu
  const initial = getAvatarInitial(name);
  const bg = getAvatarColor(name);

  return (
    <div
      className={className}
      style={{
        ...containerStyle,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.42,
        fontFamily: "Arial, sans-serif",
        userSelect: "none",
      }}
      onClick={onClick}
    >
      {initial}
    </div>
  );
};

export default UserAvatar;
