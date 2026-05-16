import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import api from "../../services/api.service";
import "./UserProfileModal.css";
import UserAvatar from "./UserAvatar";
import { useSocket } from "../../hooks/useSocket";

const IconMail = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);
const IconPhone = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const IconBirth = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const IconGender = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="11" r="4" />
    <path d="M12 15v6M9 18h6" />
    <path d="M17 3h4v4" />
    <path d="m21 3-5.2 5.2" />
  </svg>
);
const IconDate = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const UserProfileModal = ({ userId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !userId) return;
    const handler = (data) => {
      if (data.userId?.toString() === userId?.toString()) {
        setProfile((prev) => (prev ? { ...prev, ...data } : prev));
      }
    };
    socket.on("user:profile_updated", handler);
    return () => socket.off("user:profile_updated", handler);
  }, [socket, userId]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    api
      .get(`/auth/users/${userId}`)
      .then((res) => {
        const data = res.data?.data || res.data;
        setProfile(data);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId]);

  const avatarSrc =
    profile?.avatar && !profile.avatar.includes("dicebear")
      ? profile.avatar.startsWith("/uploads")
        ? `${import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000"}${profile.avatar}`
        : profile.avatar
      : null;

  const getInitial = (name = "") => name.trim().charAt(0).toUpperCase() || "?";
  const getBg = (name = "") => {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FECA57",
      "#FF9FF3",
      "#54A0FF",
      "#5F27CD",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return createPortal(
    <div className="upm-overlay" onClick={onClose}>
      <div className="upm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="upm-close" onClick={onClose}>
          ✕
        </button>

        {loading ? (
          <div className="upm-loading">
            <div className="upm-spinner" />
            <span>Đang tải...</span>
          </div>
        ) : !profile ? (
          <div className="upm-loading">Không thể tải thông tin</div>
        ) : (
          <>
            {/* Cover + Avatar */}
            <div className="upm-cover">
              <div className="upm-avatar-wrap">
                <UserAvatar
                  name={profile.name}
                  avatar={profile.avatar}
                  size={82}
                  style={{ border: "3px solid var(--bg-primary, #fff)" }}
                />
              </div>
            </div>

            {/* Name */}
            <div className="upm-name">{profile.name || "Người dùng"}</div>
            {profile.bio && <div className="upm-bio">{profile.bio}</div>}

            <div className="upm-info-list">
              <div className="upm-info-row">
                <span className="upm-info-icon">
                  <IconMail />
                </span>
                <span className="upm-info-label">Email</span>
                <span className="upm-info-value">{profile.email || "—"}</span>
              </div>
              <div className="upm-info-row">
                <span className="upm-info-icon">
                  <IconPhone />
                </span>
                <span className="upm-info-label">Số điện thoại</span>
                <span className="upm-info-value">
                  {profile.phone || "Chưa cập nhật"}
                </span>
              </div>
              <div className="upm-info-row">
                <span className="upm-info-icon">
                  <IconBirth />
                </span>
                <span className="upm-info-label">Ngày sinh</span>
                <span className="upm-info-value">
                  {profile.birthDate
                    ? new Date(profile.birthDate).toLocaleDateString("vi-VN")
                    : "Chưa cập nhật"}
                </span>
              </div>
              <div className="upm-info-row">
                <span className="upm-info-icon">
                  <IconGender />
                </span>
                <span className="upm-info-label">Giới tính</span>
                <span className="upm-info-value">
                  {profile.gender === "male"
                    ? "Nam"
                    : profile.gender === "female"
                      ? "Nữ"
                      : profile.gender === "other"
                        ? "Khác"
                        : "Chưa cập nhật"}
                </span>
              </div>
              <div className="upm-info-row">
                <span className="upm-info-icon">
                  <IconDate />
                </span>
                <span className="upm-info-label">Tham gia</span>
                <span className="upm-info-value">
                  {profile.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString("vi-VN")
                    : "—"}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default UserProfileModal;
