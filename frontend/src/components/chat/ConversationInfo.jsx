import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import GroupAvatar from "./GroupAvatar";
import SearchMessages from "./SearchMessages";
import PinnedMessages from "./PinnedMessages";
import ImageLightbox from "./ImageLightbox";
import "./ConversationInfo.css";
import api from "../../services/api.service";
import AddMemberModal from "./AddMemberModal";
import UserProfileModal from "./UserProfileModal";
import { useAuth } from "../../hooks/useAuth";
import UserAvatar from "./UserAvatar";
import Toast from "../Toast";
import { useSocket } from "../../hooks/useSocket";

const MAX_NICKNAME_LENGTH = 25;

// Biệt danh lưu theo userId của người được đặt biệt danh
const getNickname = (conversationId, otherUserId) => {
  if (!otherUserId) return "";
  return localStorage.getItem(`nickname_user_${otherUserId}`) || "";
};

const setNickname = (conversationId, value, otherUserId) => {
  if (!otherUserId) return;
  if (value) localStorage.setItem(`nickname_user_${otherUserId}`, value);
  else localStorage.removeItem(`nickname_user_${otherUserId}`);
};

const getWallpaper = (conversationId) =>
  localStorage.getItem(`wallpaper_${conversationId}`) || "";

const ConversationInfo = ({
  dimmed = false,
  conversation,
  otherUser,
  isGroup,
  isMyDoc = false,
  onClose,
  onVoiceCall,
  onVideoCall,
  messages = [],
  socket,
  conversationId,
  onMessageClick,
  onMute,
  onDelete,
  onPin,
  status = "offline",
  isDissolved = false, // ✅ THÊM
  isPreview = false,
}) => {
  const [activeSection, setActiveSection] = useState("images");
  const { user } = useAuth();
  const [isDimmed, setIsDimmed] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [isMuted, setIsMuted] = useState(conversation?.isMuted || false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const [showMembersTab, setShowMembersTab] = useState(false);
  const [showAddMemberInline, setShowAddMemberInline] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [deputyTarget, setDeputyTarget] = useState(null);
  const [showDeputyConfirm, setShowDeputyConfirm] = useState(false);
  const [fullConversation, setFullConversation] = useState(null);
  const [showPinnedTab, setShowPinnedTab] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDissolveConfirm, setShowDissolveConfirm] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [viewingUserId, setViewingUserId] = useState(null);
  const groupAvatarInputRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [showDissolvedDialog, setShowDissolvedDialog] = useState(false);
  const [dissolvedDialogMsg, setDissolvedDialogMsg] = useState("");
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const groupNameRef = useRef(null);

  const [nicknameVersion, setNicknameVersion] = useState(0);
  useEffect(() => {
    const handler = () => setNicknameVersion((v) => v + 1);
    window.addEventListener("nickname:changed", handler);
    return () => window.removeEventListener("nickname:changed", handler);
  }, []);

  useEffect(() => {
    if (editingGroupName) {
      setGroupNameInput(conversation?.name || "");
      setTimeout(() => groupNameRef.current?.focus(), 50);
    }
  }, [editingGroupName]);

  const handleSaveGroupName = async () => {
    const trimmed = groupNameInput.trim();
    if (!trimmed || trimmed === conversation?.name) {
      setEditingGroupName(false);
      return;
    }
    if (isDissolved) {
      setDissolvedDialogMsg("Nhóm đã bị giải tán, không thể đổi tên nhóm.");
      setShowDissolvedDialog(true);
      setEditingGroupName(false);
      return;
    }
    try {
      await api.patch(`/conversations/${conversationId}`, { name: trimmed });
      setEditingGroupName(false);
    } catch (err) {
      setDissolvedDialogMsg("Không thể đổi tên nhóm.");
      setShowDissolvedDialog(true);
      setEditingGroupName(false);
    }
  };

  const refreshConversation = () => {
    api
      .get(`/conversations/${conversationId}`)
      .then((res) => {
        const data = res.data?.data || res.data;
        if (data?.adminId && typeof data.adminId === "object") {
          data._resolvedAdminId = data.adminId._id
            ? data.adminId._id.toString()
            : data.adminId.toString();
        } else if (data?.adminId) {
          data._resolvedAdminId = data.adminId.toString();
        }
        setFullConversation(data);
      })
      .catch(() => {});
  };

  // ── Biệt danh ──────────────────────────────────────────────────
  const [nickname, setNicknameState] = useState(() =>
    getNickname(conversationId, otherUser?._id),
  );
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const nicknameRef = useRef(null);

  // ── Ảnh nền ────────────────────────────────────────────────────
  const [wallpaper, setWallpaperState] = useState(
    () => conversation?.wallpaper || "",
  );
  const [showWallpaperPanel, setShowWallpaperPanel] = useState(false);
  const [wallpaperPreview, setWallpaperPreview] = useState(null);
  const wallpaperInputRef = useRef(null);

  useEffect(() => {
    const onOpen = () => setIsDimmed(true);
    const onCloseEvt = () => setIsDimmed(false);
    window.addEventListener("messageActionsOpen", onOpen);
    window.addEventListener("messageActionsClose", onCloseEvt);
    return () => {
      window.removeEventListener("messageActionsOpen", onOpen);
      window.removeEventListener("messageActionsClose", onCloseEvt);
    };
  }, []);
  // Sync wallpaper khi người khác trong phòng đổi
  useEffect(() => {
    const handler = (e) => {
      if (e.detail.conversationId === conversationId) {
        setWallpaperState(e.detail.wallpaper || "");
      }
    };
    window.addEventListener("wallpaper:changed", handler);
    return () => window.removeEventListener("wallpaper:changed", handler);
  }, [conversationId]);
  // Reset khi đổi conversation
  useEffect(() => {
    setNicknameState(getNickname(conversationId, otherUser?._id));
    setWallpaperState(
      localStorage.getItem(`wallpaper_${conversationId}`) || "",
    );
    setEditingNickname(false);
    setShowWallpaperPanel(false);
    setWallpaperPreview(null);
  }, [conversationId]);

  // Focus input khi mở edit
  useEffect(() => {
    if (editingNickname) {
      setNicknameInput(nickname);
      setTimeout(() => nicknameRef.current?.focus(), 50);
    }
  }, [editingNickname]);

  // Thêm useEffect mới này
  useEffect(() => {
    if (showMembersTab && conversationId) {
      setFullConversation(null); // reset khi đổi tab
      api
        .get(`/conversations/${conversationId}`)
        .then((res) => {
          const data = res.data?.data || res.data;
          // Đảm bảo adminId luôn là string để so sánh dễ
          if (data && data.adminId && typeof data.adminId === "object") {
            data._resolvedAdminId = data.adminId._id
              ? data.adminId._id.toString()
              : data.adminId.toString();
          } else if (data && data.adminId) {
            data._resolvedAdminId = data.adminId.toString();
          }
          setFullConversation(data);
        })
        .catch(() => {});
    }
  }, [showMembersTab, conversationId]);

  const displayName = isMyDoc
    ? "My Document"
    : isGroup
      ? conversation?.name
      : nickname || otherUser?.name;

  const participants = conversation?.participants || [];

  // ── Nickname handlers ──────────────────────────────────────────
  const handleSaveNickname = () => {
    const trimmed = nicknameInput.trim().slice(0, MAX_NICKNAME_LENGTH);
    setNickname(conversationId, trimmed, otherUser?._id);
    setNicknameState(trimmed);
    setEditingNickname(false);
    // Dispatch event để các component khác cập nhật
    window.dispatchEvent(
      new CustomEvent("nickname:changed", {
        detail: { userId: otherUser?._id, conversationId, nickname: trimmed },
      }),
    );
  };

  const handleClearNickname = () => {
    setNickname(conversationId, "", otherUser?._id);
    setNicknameState("");
    setEditingNickname(false);
    window.dispatchEvent(
      new CustomEvent("nickname:changed", {
        detail: { userId: otherUser?._id, conversationId, nickname: "" },
      }),
    );
  };

  // ── Wallpaper handlers ─────────────────────────────────────────
  const handleWallpaperFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setWallpaperPreview(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleApplyWallpaper = async () => {
    if (!wallpaperPreview) return;
    if (isDissolved) {
      setDissolvedDialogMsg("Nhóm đã bị giải tán, không thể thay đổi ảnh nền.");
      setShowDissolvedDialog(true);
      setWallpaperPreview(null);
      setShowWallpaperPanel(false);
      return;
    }
    const wp = wallpaperPreview;
    localStorage.setItem(`wallpaper_${conversationId}`, wp);
    setWallpaperState(wp);
    setWallpaperPreview(null);
    setShowWallpaperPanel(false);
    window.dispatchEvent(
      new CustomEvent("wallpaper:changed", {
        detail: { conversationId, wallpaper: wp },
      }),
    );
    // Dùng socket để broadcast cho tất cả mọi người
    socket?.emit("conversation:set_wallpaper", {
      conversationId,
      wallpaper: wp,
    });
  };

  const handleRemoveWallpaper = async () => {
    if (isDissolved) {
      setDissolvedDialogMsg("Nhóm đã bị giải tán, không thể thay đổi ảnh nền.");
      setShowDissolvedDialog(true);
      setShowWallpaperPanel(false);
      return;
    }
    localStorage.removeItem(`wallpaper_${conversationId}`);
    setWallpaperState("");
    setWallpaperPreview(null);
    setShowWallpaperPanel(false);
    window.dispatchEvent(
      new CustomEvent("wallpaper:changed", {
        detail: { conversationId, wallpaper: "" },
      }),
    );
    // Dùng socket để broadcast cho tất cả mọi người
    socket?.emit("conversation:set_wallpaper", {
      conversationId,
      wallpaper: "",
    });
  };

  // ── Media ──────────────────────────────────────────────────────
  const sharedImages = useMemo(() => {
    const imgs = [];
    messages.forEach((m) => {
      if (m.type === "image" && m.fileUrl)
        imgs.push({
          id: m._id,
          url: m.fileUrl,
          date: m.createdAt,
          senderId: m.senderId,
          fileName: m.fileName,
        });
      if (m.type === "images" && m.images)
        m.images.forEach((img, i) =>
          imgs.push({
            id: m._id + "_" + i,
            url: img.url,
            date: m.createdAt,
            senderId: m.senderId,
            fileName: img.fileName,
          }),
        );
    });
    return imgs.reverse().slice(0, 12);
  }, [messages]);

  const sharedFiles = useMemo(
    () =>
      messages
        .filter((m) => m.type === "file" && m.fileUrl)
        .map((m) => ({
          id: m._id,
          name: m.fileName || "File",
          size: m.fileSize
            ? m.fileSize < 1024 * 1024
              ? (m.fileSize / 1024).toFixed(1) + " KB"
              : (m.fileSize / 1024 / 1024).toFixed(2) + " MB"
            : "",
          url: m.fileUrl,
        }))
        .reverse()
        .slice(0, 20),
    [messages],
  );

  const pinnedMessages = messages.filter((m) => m.isPinned && !m.isDeleted);

  const renderAvatar = () => {
    if (isMyDoc) {
      return (
        <UserAvatar
          name="My Document"
          size={100}
          className="info-avatar-large"
          isMyDoc={true}
        />
      );
    }
    if (isGroup) {
      return (
        <div
          style={{
            position: "relative",
            display: "inline-block",
            cursor: "pointer",
          }}
          onClick={() => groupAvatarInputRef.current?.click()}
          title="Đổi ảnh nhóm"
        >
          {conversation?.avatar ? (
            <UserAvatar
              name={displayName}
              avatar={conversation.avatar}
              size={100}
              className="info-avatar-large"
            />
          ) : (
            <GroupAvatar
              participants={participants}
              size={100}
              nicknames={Object.fromEntries(
                (participants || []).map((p) => [
                  p._id?.toString(),
                  localStorage.getItem(`nickname_user_${p._id}`) ||
                    p.name ||
                    "",
                ]),
              )}
              key={participants?.map((p) => (p.avatar || "") + p._id).join(",")}
            />
          )}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              background: "#0068ff",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fff",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <input
            ref={groupAvatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleGroupAvatarChange}
          />
        </div>
      );
    }
    return (
      <UserAvatar
        name={nickname || otherUser?.name}
        avatar={otherUserAvatar}
        size={100}
        className="info-avatar-large"
        style={{ cursor: "pointer" }}
        onClick={() => otherUser?._id && setViewingUserId(otherUser._id)}
      />
    );
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    onMute?.(conversation, next ? Date.now() + 86400000 : null);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setDeleteLoading(true);
    try {
      if (isMyDoc) {
        await api.delete(`/conversations/${conversationId}/clear-messages`);
        window.dispatchEvent(
          new CustomEvent("mydoc:cleared", { detail: { conversationId } }),
        );
        setShowDeleteConfirm(false);
      } else {
        await onDelete?.(conversation);
        setShowDeleteConfirm(false);
        onClose();
      }
    } catch (e) {
      console.error("Delete error:", e?.response?.data || e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const [avatarVersion, setAvatarVersion] = useState(0);
  const [otherUserAvatar, setOtherUserAvatar] = useState(otherUser?.avatar);

  useEffect(() => {
    setOtherUserAvatar(otherUser?.avatar);
  }, [otherUser?.avatar]);

  useEffect(() => {
    const handler = () => setAvatarVersion((v) => v + 1);
    window.addEventListener("user:avatar_updated", handler);
    return () => window.removeEventListener("user:avatar_updated", handler);
  }, []);

  const handleGroupAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (isDissolved) {
      setDissolvedDialogMsg(
        "Nhóm đã bị giải tán, không thể thay đổi ảnh nhóm.",
      );
      setShowDissolvedDialog(true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("groupAvatar", file);
      await api.patch(`/conversations/${conversationId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (err) {
      setDissolvedDialogMsg("Không thể cập nhật ảnh nhóm.");
      setShowDissolvedDialog(true);
    }
  };

  const handleUnpin = (messageId) =>
    socket?.emit("message:unpin", { messageId });

  return (
    <div className="conversation-info-sidebar">
      {(isDimmed || dimmed) && <div className="info-sidebar-dimmed" />}

      <div className="info-full-scroll">
        {/* Header */}
        <div className="info-sidebar-header">
          <h3>Thông tin hội thoại</h3>
          <button
            className="close-sidebar-btn"
            onClick={onClose}
            style={{ position: "absolute", right: 16 }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Profile */}
        <div className="info-user-profile">
          <div className="info-avatar-wrapper">
            {renderAvatar()}
            {!isGroup && (
              <div
                className={`info-online-dot ${status === "online" ? "online" : "offline"}`}
              />
            )}
          </div>
          {isGroup && editingGroupName ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0 16px",
                marginBottom: 4,
              }}
            >
              <input
                ref={groupNameRef}
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveGroupName();
                  if (e.key === "Escape") setEditingGroupName(false);
                }}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1.5px solid #6366f1",
                  fontSize: 15,
                  fontWeight: 600,
                  outline: "none",
                  fontFamily: "inherit",
                }}
                maxLength={50}
              />
              <button
                onClick={handleSaveGroupName}
                style={{
                  background: "#6366f1",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Lưu
              </button>
              <button
                onClick={() => setEditingGroupName(false)}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "none",
                  borderRadius: 7,
                  padding: "6px 12px",
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
            </div>
          ) : (
            <h2
              className="info-user-name"
              style={{ cursor: isGroup ? "pointer" : "default" }}
              onClick={() => {
                if (isGroup) setEditingGroupName(true);
                if (!isGroup && otherUser?._id) setViewingUserId(otherUser._id);
              }}
              title={isGroup ? "Nhấn để đổi tên nhóm" : undefined}
            >
              {displayName}
              {isGroup && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  style={{ marginLeft: 6, verticalAlign: "middle" }}
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              )}
            </h2>
          )}
          <span className="info-user-status">
            {isMyDoc
              ? "Ghi chú cá nhân"
              : isGroup
                ? `${participants.length} thành viên`
                : status === "online"
                  ? "Đang hoạt động"
                  : "Không hoạt động"}
          </span>
        </div>

        {/* ✅ THÊM: Banner giải tán */}
        {isDissolved && isGroup && (
          <div
            style={{
              background: "#fff3cd",
              border: "1px solid #ffc107",
              borderRadius: 8,
              padding: "10px 16px",
              margin: "0 16px 12px",
              color: "#856404",
              fontSize: 13,
              textAlign: "center",
              fontWeight: 500,
            }}
          >
            ⚠️ Nhóm này đã bị giải tán.
          </div>
        )}

        {/* Quick Actions */}
        {!isMyDoc && (
          <div className="info-quick-actions">
            <button
              className="quick-action-btn"
              onClick={onVoiceCall}
              disabled={isGroup && isDissolved}
              style={
                isGroup && isDissolved
                  ? { opacity: 0.5, cursor: "not-allowed" }
                  : {}
              }
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.86 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>Gọi điện</span>
            </button>
            <button
              className="quick-action-btn"
              onClick={onVideoCall}
              disabled={isGroup && isDissolved}
              style={
                isGroup && isDissolved
                  ? { opacity: 0.5, cursor: "not-allowed" }
                  : {}
              }
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="23,7 16,12 23,17 23,7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <span>Video</span>
            </button>
            <button
              className="quick-action-btn"
              onClick={() => {
                if (!(isGroup && isDissolved)) setShowSearch(true);
              }}
              disabled={isGroup && isDissolved}
              style={
                isGroup && isDissolved
                  ? { opacity: 0.5, cursor: "not-allowed" }
                  : {}
              }
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Tìm kiếm</span>
            </button>
          </div>
        )}

        {/* ── Biệt danh (chỉ chat 1:1) ── */}
        {!isGroup && !isMyDoc && !isPreview && (
          <div className="info-section">
            <h4 className="info-section-title">Biệt danh</h4>
            {editingNickname ? (
              <div className="nickname-edit-box">
                <div className="nickname-input-wrap">
                  <input
                    ref={nicknameRef}
                    type="text"
                    className="nickname-input"
                    placeholder={`Biệt danh (tối đa ${MAX_NICKNAME_LENGTH} ký tự)`}
                    value={nicknameInput}
                    maxLength={MAX_NICKNAME_LENGTH}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveNickname();
                      if (e.key === "Escape") setEditingNickname(false);
                    }}
                  />
                  <span className="nickname-counter">
                    {nicknameInput.length}/{MAX_NICKNAME_LENGTH}
                  </span>
                </div>
                <div className="nickname-actions">
                  <button
                    className="nickname-btn-cancel"
                    onClick={() => setEditingNickname(false)}
                  >
                    Hủy
                  </button>
                  {nickname && (
                    <button
                      className="nickname-btn-clear"
                      onClick={handleClearNickname}
                    >
                      Xóa biệt danh
                    </button>
                  )}
                  <button
                    className="nickname-btn-save"
                    onClick={handleSaveNickname}
                    disabled={!nicknameInput.trim()}
                  >
                    Lưu
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="info-action-row"
                onClick={() => setEditingNickname(true)}
                style={{ cursor: "pointer" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span style={{ flex: 1 }}>
                  {nickname ? nickname : "Đặt biệt danh"}
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                >
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </div>
            )}
          </div>
        )}

        {/* ── Ảnh nền ── */}
        {!isPreview && (
          <div className="info-section">
            <h4 className="info-section-title">Ảnh nền chat</h4>

            {!showWallpaperPanel ? (
              <div
                className="info-action-row"
                onClick={() => setShowWallpaperPanel(true)}
                style={{ cursor: "pointer" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21,15 16,10 5,21" />
                </svg>
                <span style={{ flex: 1 }}>
                  {wallpaper ? "Thay đổi ảnh nền" : "Đặt ảnh nền"}
                </span>
                {wallpaper && (
                  <div className="wallpaper-thumb">
                    <img src={wallpaper} alt="current wallpaper" />
                  </div>
                )}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                >
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </div>
            ) : (
              <div className="wallpaper-panel">
                {/* Preview */}
                <div className="wallpaper-preview-box">
                  {wallpaperPreview || wallpaper ? (
                    <img
                      src={wallpaperPreview || wallpaper}
                      alt="preview"
                      className="wallpaper-preview-img"
                    />
                  ) : (
                    <div className="wallpaper-preview-empty">
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21,15 16,10 5,21" />
                      </svg>
                      <span>Chưa có ảnh nền</span>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="wallpaper-btn-group">
                  <button
                    className="wallpaper-btn-upload"
                    onClick={() => wallpaperInputRef.current?.click()}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17,8 12,3 7,8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Chọn ảnh
                  </button>
                  <input
                    ref={wallpaperInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleWallpaperFile}
                  />

                  {wallpaperPreview && (
                    <button
                      className="wallpaper-btn-apply"
                      onClick={handleApplyWallpaper}
                    >
                      Áp dụng
                    </button>
                  )}

                  {wallpaper && !wallpaperPreview && (
                    <button
                      className="wallpaper-btn-remove"
                      onClick={handleRemoveWallpaper}
                    >
                      Xóa ảnh nền
                    </button>
                  )}

                  <button
                    className="wallpaper-btn-cancel"
                    onClick={() => {
                      setShowWallpaperPanel(false);
                      setWallpaperPreview(null);
                    }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Thông tin cá nhân - chat đơn */}
        {!isGroup && !isMyDoc && (
          <div className="info-section">
            <h4 className="info-section-title">Thông tin cá nhân</h4>
            <div className="info-list">
              <div className="info-row">
                <span className="info-label">Email</span>
                <span className="info-value">
                  {otherUser?.email || "Chưa cập nhật"}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Số điện thoại</span>
                <span className="info-value">
                  {otherUser?.phone || "Chưa cập nhật"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Thành viên nhóm */}
        {isGroup && !showMembersTab && (
          <div className="info-section">
            <h4 className="info-section-title">Thành viên nhóm</h4>
            <div
              className="info-action-row"
              onClick={() => {
                if (!isDissolved) setShowMembersTab(true);
              }}
              style={{
                cursor: isDissolved ? "not-allowed" : "pointer",
                opacity: isDissolved ? 0.5 : 1,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span style={{ flex: 1 }}>{participants.length} thành viên</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
              >
                <polyline points="9,18 15,12 9,6" />
              </svg>
            </div>
          </div>
        )}

        {/* Ảnh / File */}
        <div className="info-section">
          <div className="media-tabs">
            <button
              className={`media-tab ${activeSection === "images" ? "active" : ""}`}
              onClick={() => setActiveSection("images")}
            >
              Ảnh/Video ({sharedImages.length})
            </button>
            <button
              className={`media-tab ${activeSection === "files" ? "active" : ""}`}
              onClick={() => setActiveSection("files")}
            >
              File ({sharedFiles.length})
            </button>
          </div>

          {activeSection === "images" &&
            (sharedImages.length === 0 ? (
              <div className="info-empty">Chưa có ảnh nào</div>
            ) : (
              <div className="media-grid">
                {sharedImages.map((img) => (
                  <div
                    key={img.id}
                    className="media-item"
                    onClick={() =>
                      setLightboxImage({
                        _id: img.id,
                        fileUrl: img.url,
                        fileName: img.fileName || "image.jpg",
                        createdAt: img.date,
                        senderId: img.senderId,
                        type: "image",
                      })
                    }
                  >
                    <img src={img.url} alt="Shared" />
                  </div>
                ))}
              </div>
            ))}

          {activeSection === "files" &&
            (sharedFiles.length === 0 ? (
              <div className="info-empty">Chưa có file nào</div>
            ) : (
              <div className="file-list">
                {sharedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="file-item"
                    onClick={async () => {
                      try {
                        const r = await fetch(file.url);
                        const blob = await r.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = file.name || "file";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                      } catch {
                        window.open(file.url, "_blank");
                      }
                    }}
                  >
                    <div className="file-icon">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0068ff"
                        strokeWidth="2"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                      </svg>
                    </div>
                    <div className="file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-meta">{file.size}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>

        {/* Cài đặt */}
        <div className="info-section">
          <h4 className="info-section-title">Cài đặt</h4>
          <div className="info-list">
            <button
              className="info-action-row"
              onClick={() => onPin?.(conversation)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={conversation?.isPinned ? "#0068ff" : "none"}
                stroke={conversation?.isPinned ? "#0068ff" : "currentColor"}
                strokeWidth="2"
              >
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
              </svg>
              <span
                style={{
                  color: conversation?.isPinned ? "#0068ff" : undefined,
                }}
              >
                {conversation?.isPinned
                  ? "Bỏ ghim hội thoại"
                  : "Ghim hội thoại"}
              </span>
            </button>

            <button
              className="info-action-row"
              onClick={() => setShowPinnedTab(true)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
              </svg>
              <span style={{ flex: 1 }}>
                Tin nhắn đã ghim
                {pinnedMessages.length > 0 && ` (${pinnedMessages.length})`}
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
              >
                <polyline points="9,18 15,12 9,6" />
              </svg>
            </button>

            {!isMyDoc && (
              <div
                className="info-action-row"
                onClick={handleToggleMute}
                style={{ cursor: "pointer" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span>{isMuted ? "Bật thông báo" : "Tắt thông báo"}</span>
                <div
                  className="toggle-switch"
                  style={{ marginLeft: "auto" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    id="mute-notif"
                    checked={isMuted}
                    onChange={handleToggleMute}
                  />
                  <label htmlFor="mute-notif" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Danger */}
        <div className="info-section danger-zone">
          {/* Rời nhóm — tất cả thành viên nhóm */}
          {isGroup && (
            <button
              className="info-action-row danger"
              onClick={() => {
                if (!isDissolved) setShowLeaveConfirm(true);
              }}
              disabled={isDissolved}
              title={isDissolved ? "Nhóm đã bị giải tán" : undefined}
              style={{
                opacity: isDissolved ? 0.5 : 1,
                cursor: isDissolved ? "not-allowed" : "pointer",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16,17 21,12 16,7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Rời khỏi nhóm</span>
            </button>
          )}

          {/* Giải tán nhóm — chỉ admin và moderator */}
          {isGroup &&
            (() => {
              const conv = fullConversation || conversation;
              const adminIdStr =
                conv?._resolvedAdminId ||
                (conv?.adminId
                  ? typeof conv.adminId === "string"
                    ? conv.adminId
                    : (conv.adminId._id || conv.adminId).toString()
                  : null);
              const moderatorIds =
                conv?._resolvedModerators ||
                (conv?.moderators || []).map((m) =>
                  typeof m === "string" ? m : (m._id || m).toString(),
                );
              const currentUserId = user?._id?.toString();
              const canDissolve =
                (adminIdStr && adminIdStr === currentUserId) ||
                moderatorIds.includes(currentUserId);
              if (!canDissolve) return null;
              return (
                <button
                  className="info-action-row danger"
                  onClick={() => {
                    if (!isDissolved) setShowDissolveConfirm(true);
                  }}
                  disabled={isDissolved}
                  style={{
                    opacity: isDissolved ? 0.5 : 1,
                    cursor: isDissolved ? "not-allowed" : "pointer",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3,6 5,6 21,6" />
                    <path d="M19,6v14a2 2 0 0 1-2,2H7a2 2 0 0 1-2-2V6m3,0V4a2 2 0 0 1,2-2h4a2 2 0 0 1,2,2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  <span>Giải tán nhóm</span>
                </button>
              );
            })()}

          <button className="info-action-row danger" onClick={handleDelete}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3,6 5,6 21,6" />
              <path d="M19,6v14a2 2 0 0 1-2,2H7a2 2 0 0 1-2-2V6m3,0V4a2 2 0 0 1,2-2h4a2 2 0 0 1,2,2v2" />
            </svg>
            <span>Xóa hội thoại</span>
          </button>
        </div>
      </div>

      {/* ── TAB THÀNH VIÊN ── */}
      {isGroup &&
        showMembersTab &&
        (() => {
          const conv = fullConversation || conversation;

          const rawAdmin =
            conv?._resolvedAdminId ??
            conv?.adminId ??
            conversation?.adminId ??
            null;

          const resolvedAdminId = rawAdmin
            ? typeof rawAdmin === "string"
              ? rawAdmin
              : typeof rawAdmin === "object" && rawAdmin._id
                ? rawAdmin._id.toString()
                : rawAdmin.toString()
            : null;

          const currentUserId = user?._id ? user._id.toString() : null;

          const isAdmin = !!(
            resolvedAdminId &&
            currentUserId &&
            resolvedAdminId === currentUserId
          );

          const moderatorIds = (conv?.moderators || []).map((m) =>
            m._id ? m._id.toString() : m.toString(),
          );

          const memberList =
            conv?.participants || conversation?.participants || [];

          return (
            <div className="members-tab-panel">
              {/* Header tab */}
              <div className="members-tab-header">
                <button
                  className="members-tab-back"
                  onClick={() => {
                    setShowMembersTab(false);
                    setShowAddMemberInline(false);
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="15,18 9,12 15,6" />
                  </svg>
                </button>
                <span>Thành viên ({memberList.length})</span>
              </div>

              {/* Nút thêm thành viên */}
              <button
                className="members-add-btn"
                onClick={() => setShowAddMemberInline(true)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                Thêm thành viên
              </button>

              {/* Danh sách thành viên */}
              <div className="members-full-list">
                {memberList.map((p) => {
                  const pid = p._id ? p._id.toString() : p.toString();
                  const isMemberAdmin = !!(
                    resolvedAdminId &&
                    pid &&
                    pid.toString() === resolvedAdminId.toString()
                  );
                  const isMemberDeputy = moderatorIds.includes(pid);

                  return (
                    <div key={pid} className="member-full-item">
                      <UserAvatar
                        name={
                          localStorage.getItem(
                            `nickname_user_${p._id?.toString()}`,
                          ) || p.name
                        }
                        avatar={p.avatar}
                        size={40}
                        className="member-full-avatar"
                        style={{ cursor: "pointer" }}
                        onClick={() => setViewingUserId(pid)}
                        key={`${pid}-${avatarVersion}`}
                      />
                      <div className="member-full-info">
                        <span className="member-full-name">
                          {(() => {
                            const pid2 = p._id?.toString();
                            const isMe = pid2 === user?._id?.toString();
                            if (isMe) return p.name || "Bạn";
                            return (
                              localStorage.getItem(`nickname_user_${pid2}`) ||
                              p.name ||
                              p.email?.split("@")[0] ||
                              "Người dùng"
                            );
                          })()}
                        </span>
                        {isMemberAdmin && (
                          <span className="member-role-badge admin">
                            Trưởng nhóm
                          </span>
                        )}
                        {!isMemberAdmin && isMemberDeputy && (
                          <span className="member-role-badge deputy">
                            Phó nhóm
                          </span>
                        )}
                      </div>

                      {isAdmin && pid !== currentUserId && (
                        <div className="member-actions-menu">
                          <button
                            className="member-action-dot"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTransferTarget(
                                transferTarget === pid ? null : pid,
                              );
                            }}
                          >
                            ···
                          </button>
                          {transferTarget === pid && (
                            <>
                              <div
                                className="member-action-backdrop"
                                onClick={() => setTransferTarget(null)}
                              />
                              <div className="member-action-dropdown">
                                {!isMemberDeputy ? (
                                  <button
                                    className="member-action-item"
                                    onClick={() => {
                                      setDeputyTarget(p);
                                      setShowDeputyConfirm(true);
                                      setTransferTarget(null);
                                    }}
                                  >
                                    👑 Bầu làm phó nhóm
                                  </button>
                                ) : (
                                  <button
                                    className="member-action-item danger"
                                    onClick={async () => {
                                      try {
                                        await api.delete(
                                          `/conversations/${conversationId}/moderators/${pid}`,
                                        );
                                        setTransferTarget(null);
                                        refreshConversation(); // ✅ cập nhật UI
                                      } catch (e) {
                                        alert("Lỗi: " + e.message);
                                      }
                                    }}
                                  >
                                    ✕ Xóa phó nhóm
                                  </button>
                                )}
                                <button
                                  className="member-action-item"
                                  onClick={() => {
                                    setTransferTarget(null);
                                    setShowTransferConfirm(true);
                                    setDeputyTarget(p);
                                  }}
                                >
                                  🔁 Chuyển quyền trưởng nhóm
                                </button>
                                <button
                                  className="member-action-item danger"
                                  onClick={() => {
                                    setKickTarget(p);
                                    setShowKickConfirm(true);
                                    setTransferTarget(null);
                                  }}
                                >
                                  🚫 Xóa khỏi nhóm
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Confirm chuyển quyền trưởng */}
              {showTransferConfirm &&
                deputyTarget &&
                createPortal(
                  <div
                    className="member-confirm-overlay"
                    onClick={() => setShowTransferConfirm(false)}
                  >
                    <div
                      className="member-confirm-box"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h4>Chuyển quyền trưởng nhóm</h4>
                      <p>
                        Bạn có chắc muốn chuyển quyền trưởng nhóm cho{" "}
                        <strong>{deputyTarget.name}</strong>?
                      </p>
                      <div className="member-confirm-btns">
                        <button onClick={() => setShowTransferConfirm(false)}>
                          Hủy
                        </button>
                        <button
                          className="confirm-danger"
                          onClick={async () => {
                            try {
                              await api.post(
                                `/conversations/${conversationId}/transfer`,
                                { newAdminId: deputyTarget._id },
                              );
                              setShowTransferConfirm(false);
                              setDeputyTarget(null);
                              refreshConversation();
                            } catch (e) {
                              alert("Lỗi: " + e.message);
                            }
                          }}
                        >
                          Xác nhận
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )}

              {/* Confirm bầu phó nhóm */}
              {showDeputyConfirm &&
                deputyTarget &&
                createPortal(
                  <div
                    className="member-confirm-overlay"
                    onClick={() => setShowDeputyConfirm(false)}
                  >
                    <div
                      className="member-confirm-box"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h4>Bầu phó nhóm</h4>
                      <p>
                        Bầu <strong>{deputyTarget.name}</strong> làm phó nhóm?
                      </p>
                      <div className="member-confirm-btns">
                        <button onClick={() => setShowDeputyConfirm(false)}>
                          Hủy
                        </button>
                        <button
                          className="confirm-primary"
                          onClick={async () => {
                            try {
                              await api.post(
                                `/conversations/${conversationId}/moderators`,
                                { userId: deputyTarget._id },
                              );
                              setShowDeputyConfirm(false);
                              setDeputyTarget(null);
                              refreshConversation();
                            } catch (e) {
                              alert("Lỗi: " + e.message);
                            }
                          }}
                        >
                          Xác nhận
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )}
              {/* Confirm xóa khỏi nhóm */}
              {showKickConfirm &&
                kickTarget &&
                createPortal(
                  <div
                    className="member-confirm-overlay"
                    onClick={() => setShowKickConfirm(false)}
                  >
                    <div
                      className="member-confirm-box"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h4>Xóa thành viên khỏi nhóm</h4>
                      <p>
                        Bạn có chắc muốn xóa{" "}
                        <strong>
                          {localStorage.getItem(
                            `nickname_user_${kickTarget._id?.toString()}`,
                          ) ||
                            kickTarget.name ||
                            "thành viên này"}
                        </strong>{" "}
                        khỏi nhóm?
                      </p>
                      <div className="member-confirm-btns">
                        <button onClick={() => setShowKickConfirm(false)}>
                          Hủy
                        </button>
                        <button
                          className="confirm-danger"
                          disabled={groupActionLoading}
                          onClick={async () => {
                            setGroupActionLoading(true);
                            try {
                              await api.delete(
                                `/conversations/${conversationId}/participants/${kickTarget._id}`,
                              );
                              setShowKickConfirm(false);
                              setKickTarget(null);
                              refreshConversation();
                            } catch (e) {
                              alert(
                                "Lỗi: " +
                                  (e.response?.data?.message || e.message),
                              );
                            } finally {
                              setGroupActionLoading(false);
                            }
                          }}
                        >
                          {groupActionLoading
                            ? "Đang xử lý..."
                            : "Xóa khỏi nhóm"}
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )}
            </div>
          );
        })()}

      {/* ── TAB GHim TIN NHẮN ── */}
      {showPinnedTab && (
        <div className="members-tab-panel">
          <div className="members-tab-header">
            <button
              className="members-tab-back"
              onClick={() => setShowPinnedTab(false)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="15,18 9,12 15,6" />
              </svg>
            </button>
            <span>Tin nhắn đã ghim ({pinnedMessages.length})</span>
          </div>

          <div className="members-full-list">
            {pinnedMessages.length === 0 ? (
              <div className="info-empty" style={{ padding: "40px 16px" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📌</div>
                <div>Chưa có tin nhắn nào được ghim</div>
              </div>
            ) : (
              pinnedMessages.map((msg) => (
                <div
                  key={msg._id}
                  className="member-full-item"
                  style={{ cursor: "pointer", alignItems: "flex-start" }}
                  onClick={() => {
                    onMessageClick?.(msg._id);
                    setShowPinnedTab(false);
                  }}
                >
                  <UserAvatar
                    name={
                      typeof msg.senderId === "object"
                        ? msg.senderId?.name
                        : participants?.find(
                            (p) =>
                              p._id?.toString() === msg.senderId?.toString(),
                          )?.name || ""
                    }
                    avatar={
                      typeof msg.senderId === "object"
                        ? msg.senderId?.avatar
                        : participants?.find(
                            (p) =>
                              p._id?.toString() === msg.senderId?.toString(),
                          )?.avatar || ""
                    }
                    size={42}
                    className="member-full-avatar"
                    key={avatarVersion}
                  />
                  <div className="member-full-info" style={{ gap: 2 }}>
                    <span className="member-full-name">
                      {(() => {
                        // Lấy tất cả key nickname trong localStorage
                        const nicknameKeys = Object.keys(localStorage).filter(
                          (k) => k.startsWith("nickname_user_"),
                        );

                        // Thử tất cả dạng có thể của senderId
                        const possibleIds = [
                          msg.senderId?._id?.toString(),
                          typeof msg.senderId === "string"
                            ? msg.senderId
                            : null,
                          msg.senderId?.toString?.(),
                        ].filter(Boolean);

                        // Tìm nickname khớp với bất kỳ dạng id nào
                        let nickname = null;
                        for (const id of possibleIds) {
                          const found = localStorage.getItem(
                            `nickname_user_${id}`,
                          );
                          if (found) {
                            nickname = found;
                            break;
                          }
                        }

                        // Fallback về tên thật
                        const realName =
                          typeof msg.senderId === "object"
                            ? msg.senderId?.name
                            : participants?.find(
                                (p) =>
                                  p._id?.toString() ===
                                  msg.senderId?.toString(),
                              )?.name;

                        return nickname || realName || "Người dùng";
                      })()}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: "#65676b",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {msg.type === "text"
                        ? msg.content
                        : msg.caption ||
                          {
                            image: "📷 Hình ảnh",
                            images: "📷 Hình ảnh",
                            video: "🎥 Video",
                            file: "📄 " + (msg.fileName || "File"),
                            voice: "🎤 Tin nhắn thoại",
                          }[msg.type] ||
                          "Tin nhắn"}
                    </span>
                  </div>
                  <button
                    style={{
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      border: "none",
                      background: "transparent",
                      color: "#94a3b8",
                      cursor: "pointer",
                      borderRadius: "50%",
                      fontSize: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Bỏ ghim"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnpin(msg._id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showSearch && (
        <SearchMessages
          conversationId={conversationId}
          onClose={() => setShowSearch(false)}
          onMessageClick={(msgId) => {
            onMessageClick?.(msgId);
            setShowSearch(false);
          }}
        />
      )}
      {showPinned && (
        <PinnedMessages
          messages={messages}
          onClose={() => setShowPinned(false)}
          onMessageClick={(msgId) => {
            onMessageClick?.(msgId);
            setShowPinned(false);
          }}
          onUnpin={handleUnpin}
        />
      )}
      {lightboxImage && (
        <ImageLightbox
          message={lightboxImage}
          allImages={sharedImages.map((img) => ({
            _id: img.id,
            fileUrl: img.url,
            fileName: img.fileName || "image.jpg",
            createdAt: img.date,
            senderId: img.senderId,
            type: "image",
          }))}
          conversationName=""
          onClose={() => setLightboxImage(null)}
        />
      )}
      {showAddMemberInline && (
        <AddMemberModal
          conversation={{
            ...(fullConversation || conversation),
            _id: conversationId,
          }}
          onClose={() => setShowAddMemberInline(false)}
          currentUser={user}
        />
      )}
      {/* Dialog rời nhóm */}
      {showLeaveConfirm &&
        createPortal(
          <div
            className="member-confirm-overlay"
            onClick={() => setShowLeaveConfirm(false)}
          >
            <div
              className="member-confirm-box"
              onClick={(e) => e.stopPropagation()}
            >
              <h4>Rời khỏi nhóm</h4>
              <p>
                Bạn có chắc muốn rời khỏi nhóm này? Bạn sẽ không còn nhận được
                tin nhắn từ nhóm nữa.
              </p>
              <div className="member-confirm-btns">
                <button onClick={() => setShowLeaveConfirm(false)}>Hủy</button>
                <button
                  className="confirm-danger"
                  disabled={groupActionLoading}
                  onClick={async () => {
                    setGroupActionLoading(true);
                    try {
                      await api.post(`/conversations/${conversationId}/leave`);
                      setShowLeaveConfirm(false);
                      onClose?.();
                    } catch (e) {
                      alert("Lỗi: " + e.message);
                    } finally {
                      setGroupActionLoading(false);
                    }
                  }}
                >
                  {groupActionLoading ? "Đang xử lý..." : "Rời nhóm"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Dialog giải tán nhóm */}
      {showDissolveConfirm &&
        createPortal(
          <div
            className="member-confirm-overlay"
            onClick={() => setShowDissolveConfirm(false)}
          >
            <div
              className="member-confirm-box"
              onClick={(e) => e.stopPropagation()}
            >
              <h4>Giải tán nhóm</h4>
              <p>
                Nhóm sẽ bị giải tán. Các thành viên còn lại sẽ nhận được thông
                báo và không thể gửi tin nhắn nữa. Bạn có chắc chắn?
              </p>
              <div className="member-confirm-btns">
                <button onClick={() => setShowDissolveConfirm(false)}>
                  Hủy
                </button>
                <button
                  className="confirm-danger"
                  disabled={groupActionLoading}
                  onClick={async () => {
                    setGroupActionLoading(true);
                    try {
                      await api.post(
                        `/conversations/${conversationId}/dissolve`,
                      );
                      setShowDissolveConfirm(false);
                      onClose?.();
                    } catch (e) {
                      alert("Lỗi: " + e.message);
                    } finally {
                      setGroupActionLoading(false);
                    }
                  }}
                >
                  {groupActionLoading ? "Đang xử lý..." : "Giải tán"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Dialog xóa hội thoại */}
      {showDeleteConfirm &&
        createPortal(
          <div
            className="member-confirm-overlay"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div
              className="member-confirm-box"
              onClick={(e) => e.stopPropagation()}
            >
              <h4>Xóa hội thoại</h4>
              <p>
                Tất cả tin nhắn trong hội thoại này sẽ bị xóa vĩnh viễn và không
                thể khôi phục. Bạn có chắc chắn muốn xóa?
              </p>
              <div className="member-confirm-btns">
                <button onClick={() => setShowDeleteConfirm(false)}>Hủy</button>
                <button
                  className="confirm-danger"
                  disabled={deleteLoading}
                  onClick={handleConfirmDelete}
                >
                  {deleteLoading ? "Đang xóa..." : "Xóa"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal xem thông tin thành viên */}
      {viewingUserId && (
        <UserProfileModal
          userId={viewingUserId}
          onClose={() => setViewingUserId(null)}
        />
      )}

      {showDissolvedDialog &&
        createPortal(
          <div
            className="member-confirm-overlay"
            onClick={() => setShowDissolvedDialog(false)}
          >
            <div
              className="member-confirm-box"
              onClick={(e) => e.stopPropagation()}
            >
              <h4>Không thể thực hiện</h4>
              <p>{dissolvedDialogMsg}</p>
              <div className="member-confirm-btns">
                <button
                  className="confirm-danger"
                  onClick={() => setShowDissolvedDialog(false)}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {toast &&
        createPortal(
          <Toast
            message={toast.message}
            type={toast.type}
            duration={3000}
            onDone={() => setToast(null)}
          />,
          document.body,
        )}
    </div>
  );
};

export default ConversationInfo;
