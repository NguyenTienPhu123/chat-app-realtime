import React, { useState, useEffect } from "react";
import {
  CallIcon,
  VideoIcon,
  SearchIcon,
  SidebarToggleIcon,
} from "../../icons";
import "./ChatHeader.css";
import GroupAvatar from "../chat/GroupAvatar";
import UserAvatar from "../chat/UserAvatar";

const ChatHeader = ({
  name,
  avatar,
  status,
  isGroup,
  isMyDoc = false,
  memberCount,
  participants = [],
  onVideoCall,
  onVoiceCall,
  onToggleInfo,
  showInfoSidebar,
  pinnedMessage,
  onClickPinned,
  onSearch,
  onAddMember,
  isDissolved = false,
  isPreview = false,
  onBack,
}) => {
  const [avatarVersion, setAvatarVersion] = useState(0);

  useEffect(() => {
    const handler = () => setAvatarVersion((v) => v + 1);
    window.addEventListener("user:avatar_updated", handler);
    return () => window.removeEventListener("user:avatar_updated", handler);
  }, []);

  return (
    <div className="chat-header-modern">
      <div className="chat-header-left">
  {onBack && (
    <button className="header-back-btn" onClick={onBack}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
    </button>
  )}
        <div className="chat-header-avatar-wrapper">
          {isMyDoc ? (
            <UserAvatar
              name="My Document"
              size={40}
              className="chat-header-avatar"
              isMyDoc={true}
            />
          ) : isGroup && !avatar ? (
            <GroupAvatar
              participants={participants}
              size={40}
              nicknames={Object.fromEntries(
                (participants || []).map((p) => [
                  p._id?.toString(),
                  localStorage.getItem(`nickname_user_${p._id}`) ||
                    p.name ||
                    "",
                ]),
              )}
              key={
                participants?.map((p) => (p.avatar || "") + p._id).join(",") +
                (participants || [])
                  .map(
                    (p) => localStorage.getItem(`nickname_user_${p._id}`) || "",
                  )
                  .join(",")
              }
            />
          ) : (
            <UserAvatar
              name={name}
              avatar={avatar}
              size={40}
              className="chat-header-avatar"
              key={avatarVersion}
            />
          )}
          {!isGroup && !isMyDoc && (
            <div
              className={`online-indicator ${status === "online" ? "online" : "offline"}`}
              title={status === "online" ? "Đang hoạt động" : "Không hoạt động"}
            ></div>
          )}
        </div>

        <div className="chat-header-info">
          <h3 className="chat-header-name">{name}</h3>
          <span className="chat-header-status">
            {isMyDoc
              ? "Ghi chú cá nhân"
              : isGroup
                ? `${memberCount} thành viên`
                : status === "online"
                  ? "Đang hoạt động"
                  : "Không hoạt động"}
          </span>
        </div>
      </div>

      <div className="chat-header-actions">
        {isGroup && (
          <button
            className="header-action-btn"
            onClick={isDissolved ? undefined : onAddMember}
            title={isDissolved ? "Nhóm đã giải tán" : "Thêm thành viên"}
            disabled={isDissolved}
            style={isDissolved ? { opacity: 0.4, cursor: "not-allowed" } : {}}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </button>
        )}

        {!isMyDoc && (
          <>
            <button
              className="header-action-btn"
              onClick={isDissolved || isPreview ? undefined : onVoiceCall}
              disabled={isDissolved || isPreview}
              style={
                isDissolved || isPreview
                  ? { opacity: 0.4, cursor: "not-allowed" }
                  : {}
              }
            >
              <CallIcon size={20} />
            </button>
            <button
              className="header-action-btn"
              onClick={isDissolved ? undefined : onVideoCall}
              title={isDissolved ? "Nhóm đã giải tán" : "Gọi video"}
              disabled={isDissolved}
              style={isDissolved ? { opacity: 0.4, cursor: "not-allowed" } : {}}
            >
              <VideoIcon size={20} />
            </button>
          </>
        )}

        <button
          className="header-action-btn"
          onClick={() => onSearch?.()}
          title="Tìm kiếm tin nhắn"
        >
          <SearchIcon size={20} />
        </button>

        <button
          className={`header-action-btn ${showInfoSidebar ? "active" : ""}`}
          onClick={onToggleInfo}
          title="Thông tin hội thoại"
        >
          <SidebarToggleIcon size={20} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
