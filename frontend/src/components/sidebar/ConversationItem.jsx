import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useSocket } from "../../hooks/useSocket";
import { formatRelativeTime } from "../../utils/date.util";
import messageService from "../../services/message.service";
import { createPortal } from "react-dom";
import "./ConversationItem.css";
import GroupAvatar from "../chat/GroupAvatar";
import UserAvatar from "../chat/UserAvatar";
import {
  PhoneOutgoingIcon,
  PhoneIncomingIcon,
  PhoneMissedIcon,
  VideoOutgoingIcon,
  VideoIncomingIcon,
  VideoMissedIcon,
} from "../../icons/CallIcons";

const ConversationItem = ({
  conversation,
  isSelected,
  onSelect,
  onPin,
  onMarkUnread,
  onMute,
  onDelete,
  onAddToGroup,
}) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [showMenu, setShowMenu] = useState(false);
  const [showMuteSubmenu, setShowMuteSubmenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  const hasMarkedReadRef = useRef(false);

  const isSelectedRef = useRef(false);

  useEffect(() => {
    if (!isSelected) {
      isSelectedRef.current = false;
      return;
    }
    if (!socket?.connected) return;
    if (isSelectedRef.current) return;

    isSelectedRef.current = true;

    // Luôn mark read khi select, không check unreadCount
    // (vì ChatPage đã reset unreadCount=0 trước khi effect này chạy)
    messageService
      .markAllAsRead(conversation._id)
      .then(() => {
        socket.emit("conversation:read", {
          conversationId: conversation._id,
        });
      })
      .catch((err) => console.error("Mark as read error:", err));
  }, [isSelected, conversation._id, socket?.connected]);

  // Đóng menu khi click ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Kiểm tra click có nằm trong portal menu không
      const menuEl = document.querySelector(".conv-context-menu");
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        menuEl &&
        !menuEl.contains(e.target)
      ) {
        setShowMenu(false);
        setShowMuteSubmenu(false);
      }
    };
    if (showMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const getDisplayInfo = () => {
    if (conversation.type === "mydoc") {
      return {
        name: "My Document",
        avatar: null,
        isMyDoc: true,
      };
    }
    if (conversation.type === "group") {
      return {
        name: conversation.name,
        avatar: conversation.avatar || "/default-group.png",
      };
    } else {
      const otherUser = conversation.participants?.find(
        (p) => p._id?.toString() !== user?._id?.toString(),
      );
      // Ưu tiên nickname theo userId, fallback về nickname theo conversationId
      const nickname =
        localStorage.getItem(`nickname_user_${otherUser?._id}`) || "";
      return {
        name: nickname || otherUser?.name || "Unknown",
        avatar: otherUser?.avatar || "/default-avatar.png",
      };
    }
  };

  const { name, avatar, isMyDoc = false } = getDisplayInfo();
  const lastMessage = conversation.lastMessage;
  const unreadCount = conversation.unreadCount || 0;
  const isManualUnread = conversation.isManualUnread || false;

  const isLastMessageOwn =
    lastMessage?.senderId?._id?.toString() === user?._id?.toString() ||
    lastMessage?.senderId?.toString() === user?._id?.toString();

  const isUnread = isManualUnread || (unreadCount > 0 && !isLastMessageOwn);

  const getLastMessagePreview = () => {
    const draft = sessionStorage.getItem(`draft_${conversation._id}`);
    if (draft?.trim() && !isSelected) {
      return `__DRAFT__${draft}`;
    }
    if (!lastMessage) return "Chưa có tin nhắn";

    const otherParticipant = conversation.participants?.find(
      (p) => p._id?.toString() !== user?._id?.toString(),
    );
    const senderName =
      lastMessage.senderId?.name || lastMessage.senderName || "Người dùng";

    const isOwn =
      lastMessage.senderId?._id?.toString() === user?._id?.toString() ||
      lastMessage.senderId?.toString() === user?._id?.toString();

    const shortName =
      otherParticipant?.name?.split(" ").pop() ||
      senderName?.split(" ").pop() ||
      "Người dùng";
    const prefix = isOwn
      ? "Bạn"
      : conversation.type === "group"
        ? senderName
        : null;

    // Tin nhắn thu hồi
    if (lastMessage.isRecalled) {
      return prefix
        ? `${prefix}: Đã thu hồi một tin nhắn`
        : "Đã thu hồi một tin nhắn";
    }

    if (lastMessage.type === "system") {
      const currentUserId = user?._id?.toString();
      const currentUserName = user?.name || "";
      const content = lastMessage.content || "[Thông báo hệ thống]";

      const toStr = (v) =>
        v?._id?.toString?.() || v?.toString?.() || (v ? String(v) : null);

      const getDisplayName = (userId, fallbackName) => {
        if (!userId && !fallbackName) return "Người dùng";
        const uid = toStr(userId);
        if (uid && uid === currentUserId) return "Bạn";
        if (!uid && fallbackName && fallbackName === currentUserName)
          return "Bạn";
        const nickname = uid
          ? localStorage.getItem(`nickname_user_${uid}`)
          : null;
        return nickname || fallbackName || "Người dùng";
      };

      const changerId = toStr(lastMessage.changerId);
      const targetId = toStr(lastMessage.targetId);
      const changerName = lastMessage.changerName || "";
      const targetName = lastMessage.targetName || "";

      // Có cả 2 tên
      if (changerName && targetName) {
        const changerDisplay = getDisplayName(changerId, changerName);
        const targetDisplay = getDisplayName(targetId, targetName);
        const idx1 = content.indexOf(changerName);
        const idx2 = content.indexOf(targetName);
        if (idx1 !== -1 && idx2 !== -1) {
          if (idx1 < idx2) {
            return (
              content.slice(0, idx1) +
              changerDisplay +
              content.slice(idx1 + changerName.length, idx2) +
              targetDisplay +
              content.slice(idx2 + targetName.length)
            );
          } else {
            return (
              content.slice(0, idx2) +
              targetDisplay +
              content.slice(idx2 + targetName.length, idx1) +
              changerDisplay +
              content.slice(idx1 + changerName.length)
            );
          }
        }
      }

      // Chỉ có changerName
      if (changerName) {
        const changerDisplay = getDisplayName(changerId, changerName);
        const idx = content.indexOf(changerName);
        if (idx !== -1) {
          return (
            content.slice(0, idx) +
            changerDisplay +
            content.slice(idx + changerName.length)
          );
        }
      }

      // Fallback: thay tên mình bằng "Bạn"
      let result = content;
      if (currentUserName) {
        if (
          result.startsWith(currentUserName + " đã ") ||
          result.startsWith(currentUserName + " được ")
        ) {
          result = "Bạn" + result.slice(currentUserName.length);
        }
        result = result.replace(
          new RegExp(
            `(\\s)${currentUserName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`,
            "g",
          ),
          (_, b, a) => `${b}Bạn${a}`,
        );
        if (result.endsWith(" " + currentUserName)) {
          result =
            result.slice(0, result.length - currentUserName.length - 1) +
            " Bạn";
        }
      }
      return result;
    }

    // Cảm xúc
    if (lastMessage.type === "reaction") {
      const reactorName = isOwn ? "Bạn" : shortName;
      return `${reactorName} đã thả cảm xúc ${lastMessage.emoji || "👍"} tin nhắn`;
    }

    // Ghim tin nhắn
    if (lastMessage.type === "pin") {
      const senderIdStr =
        lastMessage.senderId?._id?.toString() ||
        lastMessage.senderId?.toString();
      const isPinOwn = senderIdStr === user?._id?.toString();
      // Ưu tiên nickname từ localStorage, fallback về tên thật
      const pinSenderId =
        lastMessage.senderId?._id?.toString() ||
        lastMessage.senderId?.toString();
      const nickname = !isPinOwn
        ? localStorage.getItem(`nickname_user_${pinSenderId}`) || ""
        : "";
      const pinSenderName =
        nickname || lastMessage.senderId?.name || senderName || "Người dùng";
      const actorName = isPinOwn ? "Bạn" : pinSenderName;
      return `${actorName} đã ghim một tin nhắn`;
    }

    // Thêm vào nhóm
    if (lastMessage.type === "group_add") {
      const actorName = isOwn ? "Bạn" : shortName;
      return `${actorName} đã thêm thành viên vào nhóm`;
    }

    // Rời nhóm
    if (lastMessage.type === "group_leave") {
      return `${isOwn ? "Bạn" : shortName} đã rời nhóm`;
    }

    // ── Cuộc gọi (MỚI THÊM) ──────────────────────────────────────────────────
    if (lastMessage.type === "call") {
      const isVideo = lastMessage.callType === "video";
      const typeLabel = isVideo ? "video" : "thoại";
      const status = lastMessage.callStatus;
      const dur = lastMessage.callDuration;
      const formatDur = (s) => {
        if (!s || s <= 0) return "";
        const m = Math.floor(s / 60),
          sec = s % 60;
        return m > 0 ? ` (${m} phút ${sec} giây)` : ` (${sec} giây)`;
      };

      if (status === "completed") {
        return isOwn
          ? `Bạn đã gọi ${typeLabel}${formatDur(dur)}`
          : `Cuộc gọi ${typeLabel} đến${formatDur(dur)}`;
      }
      if (status === "rejected") {
        return isOwn
          ? `Cuộc gọi ${typeLabel} bị từ chối`
          : `Bạn đã từ chối cuộc gọi ${typeLabel}`;
      }
      if (status === "missed") {
        return isOwn
          ? `Không trả lời (${typeLabel})`
          : `Cuộc gọi ${typeLabel} nhỡ`;
      }
      if (status === "cancelled") {
        return isOwn
          ? `Bạn đã hủy cuộc gọi ${typeLabel}`
          : `Cuộc gọi ${typeLabel} đã bị hủy`;
      }
      if (status === "failed") return `Cuộc gọi ${typeLabel} thất bại`;
      if (status === "offline") return `Người dùng không khả dụng`;
      return isOwn ? `Bạn đã gọi ${typeLabel}` : `Cuộc gọi ${typeLabel}`;
    }

    // Nội dung thông thường
    const content =
      lastMessage.type === "text"
        ? lastMessage.isRecalled
          ? "Đã thu hồi một tin nhắn"
          : lastMessage.content?.substring(0, 40) || ""
        : lastMessage.type === "image"
          ? "[Hình ảnh]"
          : lastMessage.type === "images"
            ? "[Hình ảnh]"
            : lastMessage.type === "file"
              ? `[File] ${lastMessage.fileName || ""}`
              : lastMessage.type === "voice"
                ? "[Tin nhắn thoại]"
                : lastMessage.type === "video"
                  ? "[Video]"
                  : `[${lastMessage.type}]`;

    if (prefix) return `${prefix}: ${content}`;
    return content;
  };

  const handleMenuClick = (e) => {
    console.log("PIN CALLED", conversation._id);
    e.stopPropagation();
    if (!showMenu && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left - 180 });
    }
    setShowMenu(!showMenu);
    setShowMuteSubmenu(false);
  };
  // Lắng nghe thay đổi biệt danh để re-render
  const [, setNicknameVersion] = useState(0);
  useEffect(() => {
    const handler = () => setNicknameVersion((v) => v + 1);
    window.addEventListener("nickname:changed", handler);
    return () => window.removeEventListener("nickname:changed", handler);
  }, []);
  const [draft, setDraft] = useState(
    sessionStorage.getItem(`draft_${conversation._id}`) || "",
  );

  const [avatarVersion, setAvatarVersion] = useState(0);

  // Lắng nghe socket realtime khi avatar thay đổi
  useEffect(() => {
    if (!socket) return;
    const handler = ({ userId, avatar }) => {
      const isParticipant = conversation.participants?.some(
        (p) => p._id?.toString() === userId?.toString(),
      );
      if (isParticipant) {
        // Cập nhật avatar trong participants để UserAvatar render đúng
        const p = conversation.participants?.find(
          (p) => p._id?.toString() === userId?.toString(),
        );
        if (p) p.avatar = avatar;
        setAvatarVersion((v) => v + 1);
      }
    };
    socket.on("user:avatar_updated", handler);
    return () => socket.off("user:avatar_updated", handler);
  }, [socket, conversation]);

  // Lắng nghe window event (khi chính mình đổi avatar)
  useEffect(() => {
    const handler = (e) => {
      const { userId, avatar } = e.detail;
      const isParticipant = conversation.participants?.some(
        (p) => p._id?.toString() === userId?.toString(),
      );
      if (isParticipant) {
        const p = conversation.participants?.find(
          (p) => p._id?.toString() === userId?.toString(),
        );
        if (p) p.avatar = avatar;
        setAvatarVersion((v) => v + 1);
      }
    };
    window.addEventListener("user:avatar_updated", handler);
    return () => window.removeEventListener("user:avatar_updated", handler);
  }, [conversation]);

  useEffect(() => {
    const checkDraft = () => {
      setDraft(sessionStorage.getItem(`draft_${conversation._id}`) || "");
    };
    window.addEventListener("storage", checkDraft);
    // Poll mỗi 500ms vì sessionStorage không trigger storage event trong cùng tab
    const interval = setInterval(checkDraft, 500);
    return () => {
      window.removeEventListener("storage", checkDraft);
      clearInterval(interval);
    };
  }, [conversation._id]);

  const renderCallPreviewIcon = () => {
    const msg = lastMessage;
    if (msg?.type !== "call") return null;
    const isVideo = msg.callType === "video";
    return isVideo ? (
      <VideoOutgoingIcon size={14} color="currentColor" />
    ) : (
      <PhoneOutgoingIcon size={14} color="currentColor" />
    );
  };

  return (
    <div
      className={`conversation-item ${isSelected ? "selected" : ""} ${isUnread ? "unread" : ""}`}
      onClick={() => onSelect(conversation)}
    >
      <div className="conversation-avatar-wrapper">
        {isMyDoc ? (
          <UserAvatar
            name="My Document"
            size={56}
            className="conversation-avatar"
            isMyDoc={true}
          />
        ) : conversation.type === "group" ? (
          conversation.avatar ? (
            <UserAvatar
              name={conversation.name}
              avatar={conversation.avatar}
              size={56}
              className="conversation-avatar"
            />
          ) : (
            <GroupAvatar
              participants={conversation.participants || []}
              size={56}
              nicknames={Object.fromEntries(
                (conversation.participants || []).map((p) => [
                  p._id?.toString(),
                  localStorage.getItem(`nickname_user_${p._id}`) ||
                    p.name ||
                    "",
                ]),
              )}
              key={
                conversation.participants
                  ?.map((p) => (p.avatar || "") + p._id)
                  .join(",") +
                (conversation.participants || [])
                  .map(
                    (p) => localStorage.getItem(`nickname_user_${p._id}`) || "",
                  )
                  .join(",")
              }
            />
          )
        ) : (
          <UserAvatar
            name={name}
            avatar={avatar}
            size={56}
            className="conversation-avatar"
            key={avatarVersion}
          />
        )}
      </div>

      <div className="conversation-content">
        <div className="conversation-header">
          <h4 className="conversation-name">{name}</h4>
          <div className="conversation-meta" ref={menuRef}>
            <div className="conversation-time-row">
              <div className="conversation-time-with-mute">
                {conversation.isMuted && (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="#999"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                    <line
                      x1="3"
                      y1="3"
                      x2="21"
                      y2="21"
                      stroke="#999"
                      strokeWidth="2"
                    />
                  </svg>
                )}
                <span className="conversation-time">
                  {sessionStorage
                    .getItem(`draft_${conversation._id}`)
                    ?.trim() && !isSelected
                    ? ""
                    : lastMessage?.createdAt
                      ? formatRelativeTime(lastMessage.createdAt)
                      : ""}
                </span>
              </div>
              <div className="conversation-icons-row">
                {conversation.isPinned && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="#999"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                )}
              </div>
            </div>
            <button
              className="conv-more-btn"
              onClick={handleMenuClick}
              title="Tùy chọn"
              ref={btnRef}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>

            {showMenu &&
              createPortal(
                <div
                  className="conv-context-menu"
                  style={{
                    position: "fixed",
                    top: menuPos.top,
                    left: menuPos.left,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Ghim - tất cả đều có */}
                  <button
                    className="conv-menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPin?.(conversation);
                      setShowMenu(false);
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                    </svg>
                    <span>
                      {conversation.isPinned
                        ? "Bỏ ghim hội thoại"
                        : "Ghim hội thoại"}
                    </span>
                  </button>

                  {/* Đánh dấu chưa đọc - ẩn với mydoc */}
                  {conversation.type !== "mydoc" && (
                    <button
                      className="conv-menu-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkUnread?.(conversation);
                        setShowMenu(false);
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                      </svg>
                      <span>
                        {conversation.isManualUnread
                          ? "Đánh dấu đã đọc"
                          : "Đánh dấu chưa đọc"}
                      </span>
                    </button>
                  )}

                  {/* Thêm vào nhóm - ẩn với mydoc và group */}
                  {conversation.type !== "group" &&
                    conversation.type !== "mydoc" && (
                      <button
                        className="conv-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToGroup?.(conversation);
                          setShowMenu(false);
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                        </svg>
                        <span>Thêm vào nhóm</span>
                      </button>
                    )}

                  {/* Tắt thông báo - ẩn với mydoc */}
                  {conversation.type !== "mydoc" &&
                    (conversation.isMuted ? (
                      <button
                        className="conv-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMute?.(conversation, null);
                          setShowMenu(false);
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                        </svg>
                        <span>Bật thông báo</span>
                      </button>
                    ) : (
                      <div
                        className="conv-menu-item has-submenu"
                        onMouseEnter={() => setShowMuteSubmenu(true)}
                        onMouseLeave={() => setShowMuteSubmenu(false)}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                        </svg>
                        <span>Tắt thông báo</span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{ marginLeft: "auto" }}
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                        {showMuteSubmenu && (
                          <div className="conv-submenu">
                            {[
                              { label: "Trong 1 giờ", hours: 1 },
                              { label: "Trong 5 giờ", hours: 5 },
                              { label: "Cho đến khi được mở lại", hours: null },
                            ].map(({ label, hours }) => (
                              <button
                                key={label}
                                className="conv-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const until = hours
                                    ? new Date(
                                        Date.now() + hours * 3600000,
                                      ).toISOString()
                                    : null;
                                  onMute?.(conversation, until);
                                  setShowMenu(false);
                                  setShowMuteSubmenu(false);
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                  <div className="conv-menu-divider" />

                  {/* Xóa - mydoc chỉ xóa nội dung, không xóa hội thoại */}
                  <button
                    className="conv-menu-item danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (conversation.type === "mydoc") {
                        if (
                          window.confirm(
                            "Xóa toàn bộ nội dung trong My Document?",
                          )
                        ) {
                          // Chỉ xóa messages, không xóa conversation
                          import("../../services/message.service").then(
                            ({ default: msgSvc }) => {
                              msgSvc.clearMessages?.(conversation._id);
                            },
                          );
                          // Emit socket để clear messages
                          socket?.emit("conversation:clear_messages", {
                            conversationId: conversation._id,
                          });
                        }
                      } else {
                        onDelete?.(conversation);
                      }
                      setShowMenu(false);
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                    <span>
                      {conversation.type === "mydoc"
                        ? "Xóa nội dung"
                        : "Xóa hội thoại"}
                    </span>
                  </button>
                </div>,
                document.body,
              )}
          </div>
        </div>

        <div className="conversation-footer">
          {(() => {
            const preview = getLastMessagePreview();
            if (preview?.startsWith("__DRAFT__")) {
              return (
                <p className="conversation-preview">
                  <span className="draft-label">Chưa gửi: </span>
                  {preview.replace("__DRAFT__", "")}
                </p>
              );
            }
            return (
              <p className="conversation-preview">
                {lastMessage?.type === "call" && (
                  <span
                    style={{
                      marginRight: 4,
                      verticalAlign: "middle",
                      display: "inline-flex",
                    }}
                  >
                    {renderCallPreviewIcon()}
                  </span>
                )}
                {preview}
              </p>
            );
          })()}
          {((unreadCount > 0 && !isLastMessageOwn) || isManualUnread) &&
            !isSelected && (
              <span className="unread-badge">
                {isManualUnread && unreadCount === 0
                  ? "●"
                  : unreadCount > 99
                    ? "99+"
                    : unreadCount}
              </span>
            )}
        </div>
      </div>
    </div>
  );
};

export default ConversationItem;
