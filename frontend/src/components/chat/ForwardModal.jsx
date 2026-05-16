import React, { useState, useEffect, useMemo } from "react";
import conversationService from "../../services/conversation.service";
import messageService from "../../services/message.service";
import { useAuth } from "../../hooks/useAuth";
import UserAvatar from "../chat/UserAvatar";
import GroupAvatar from "../chat/GroupAvatar";
import "./ForwardModal.css";

// ── Icons tự làm ──────────────────────────────────────────────
const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const CloseIcon = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

const GroupIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const TextIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const VideoIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <polygon points="23,7 16,12 23,17 23,7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const FileIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
  </svg>
);

const VoiceIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

const DoneIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────
const BASE_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

const getFullUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${BASE_URL}${url}`;
};

// ── Component ─────────────────────────────────────────────────
const ForwardModal = ({ message, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("recent");
  const [forwardDone, setForwardDone] = useState(false);
  const [avatarVersions, setAvatarVersions] = useState({});

  // Lắng nghe avatar cập nhật realtime
  useEffect(() => {
    const handler = (e) => {
      const { userId, avatar } = e.detail || {};
      if (!userId) return;
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants?.map((p) =>
            p._id?.toString() === userId ? { ...p, avatar } : p,
          ),
        })),
      );
      setAvatarVersions((prev) => ({ ...prev, [userId]: Date.now() }));
    };
    window.addEventListener("user:avatar_updated", handler);
    return () => window.removeEventListener("user:avatar_updated", handler);
  }, []);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await conversationService.getConversations();
      setConversations(data.filter((c) => c._id !== message?.conversationId));
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleForward = async () => {
    if (selectedIds.length === 0) return;
    setForwarding(true);
    try {
      await messageService.forwardMessage(message._id, selectedIds);
      setForwardDone(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Forward error:", err);
    } finally {
      setForwarding(false);
    }
  };

  const getOtherUser = (c) =>
    c.participants?.find((p) => p._id?.toString() !== user?._id?.toString());

  const getName = (c) => {
    if (c.type === "group") return c.name || "Nhóm";
    const other = getOtherUser(c);
    return (
      localStorage.getItem(`nickname_user_${other?._id}`) ||
      other?.name ||
      "Unknown"
    );
  };

  const getTypeLabel = () => {
    const map = {
      text: "Tin nhắn văn bản",
      image: "Hình ảnh",
      images: `${message.images?.length || 0} hình ảnh`,
      video: "Video",
      file: "File đính kèm",
      voice: "Tin nhắn thoại",
    };
    return map[message.type] || "Tin nhắn";
  };

  const getThumbIcon = () => {
    const icons = {
      text: <TextIcon />,
      video: <VideoIcon />,
      file: <FileIcon />,
      voice: <VoiceIcon />,
    };
    return icons[message.type] || <TextIcon />;
  };

  const recentList = useMemo(() => conversations.slice(0, 8), [conversations]);
  const groupList = useMemo(
    () => conversations.filter((c) => c.type === "group"),
    [conversations],
  );
  const privateList = useMemo(
    () => conversations.filter((c) => c.type === "private"),
    [conversations],
  );

  const displayList = useMemo(() => {
    let list =
      activeTab === "group"
        ? groupList
        : activeTab === "private"
          ? privateList
          : recentList;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = conversations.filter((c) => getName(c).toLowerCase().includes(q));
    }
    return list;
  }, [activeTab, search, recentList, groupList, privateList, conversations]);

  const selectedConvs = conversations.filter((c) =>
    selectedIds.includes(c._id),
  );

  // ── Render avatar của conversation ────────────────────────
  const renderConvAvatar = (c, size = 44) => {
    if (c.type === "group") {
      if (c.avatar) {
        return (
          <img
            src={getFullUrl(c.avatar)}
            alt={c.name}
            style={{
              width: size,
              height: size,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        );
      }
      return (
        <GroupAvatar
          participants={c.participants || []}
          size={size}
          key={c.participants?.map((p) => (p.avatar || "") + p._id).join(",")}
        />
      );
    }
    const other = getOtherUser(c);
    return (
      <UserAvatar
        name={other?.name}
        avatar={other?.avatar}
        size={size}
        key={avatarVersions[other?._id] || 0}
      />
    );
  };

  if (forwardDone) {
    return (
      <div className="forward-modal-overlay">
        <div className="forward-done-toast">
          <div className="forward-done-check">
            <DoneIcon />
          </div>
          <span>Đã chia sẻ thành công!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="forward-modal-overlay" onClick={onClose}>
      <div className="forward-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="forward-header">
          <button className="fm-back-btn" onClick={onClose}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
          <h3>Chia sẻ</h3>
          <div className="fm-placeholder" />
        </div>

        {/* Preview */}
        <div className="fm-preview">
          <div className="fm-preview-thumb">
            {message.type === "image" && message.fileUrl ? (
              <img
                src={getFullUrl(message.fileUrl)}
                alt=""
                className="fm-thumb-img"
              />
            ) : message.type === "images" ? (
              <div className="fm-thumb-grid">
                {message.images?.slice(0, 4).map((img, i) => (
                  <img key={i} src={getFullUrl(img.url)} alt="" />
                ))}
                {message.images?.length > 4 && (
                  <div className="fm-thumb-more">
                    +{message.images.length - 4}
                  </div>
                )}
              </div>
            ) : (
              <div className="fm-thumb-icon">{getThumbIcon()}</div>
            )}
          </div>
          <div className="fm-preview-info">
            <span className="fm-preview-type">{getTypeLabel()}</span>
            {message.type === "text" && message.content && (
              <span className="fm-preview-content">{message.content}</span>
            )}
            {message.type === "file" && message.fileName && (
              <span className="fm-preview-content">{message.fileName}</span>
            )}
            {message.caption && (
              <span className="fm-preview-existing-caption">
                Chú thích: {message.caption}
              </span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="fm-search-wrap">
          <SearchIcon />
          <input
            type="text"
            className="fm-search"
            placeholder="Tìm kiếm cuộc trò chuyện..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="fm-search-clear" onClick={() => setSearch("")}>
              <CloseIcon size={12} />
            </button>
          )}
        </div>

        {/* Tabs */}
        {!search && (
          <div className="fm-tabs">
            {[
              { key: "recent", label: "Gần đây" },
              { key: "group", label: "Nhóm" },
              { key: "private", label: "Bạn bè" },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`fm-tab ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Selected chips */}
        {selectedConvs.length > 0 && (
          <div className="fm-chips">
            {selectedConvs.map((c) => (
              <button
                key={c._id}
                className="fm-chip"
                onClick={() => toggleSelection(c._id)}
              >
                {c.type === "group" ? (
                  c.avatar ? (
                    <img
                      src={getFullUrl(c.avatar)}
                      alt={c.name}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <GroupAvatar
                      participants={c.participants || []}
                      size={20}
                      key={c.participants
                        ?.map((p) => (p.avatar || "") + p._id)
                        .join(",")}
                    />
                  )
                ) : (
                  <UserAvatar
                    name={getOtherUser(c)?.name}
                    avatar={getOtherUser(c)?.avatar}
                    size={20}
                    key={avatarVersions[getOtherUser(c)?._id] || 0}
                  />
                )}
                <span>{getName(c)}</span>
                <span className="fm-chip-x">
                  <CloseIcon size={10} />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* List */}
        <div className="fm-list">
          {loading && (
            <div className="fm-empty">
              <div className="spinner" />
              <span>Đang tải...</span>
            </div>
          )}
          {!loading && displayList.length === 0 && (
            <div className="fm-empty">
              <p>
                {search
                  ? "Không tìm thấy kết quả"
                  : activeTab === "group"
                    ? "Bạn chưa có nhóm nào"
                    : activeTab === "private"
                      ? "Không có cuộc trò chuyện riêng"
                      : "Không có cuộc trò chuyện"}
              </p>
            </div>
          )}
          {!loading &&
            displayList.map((c) => {
              const selected = selectedIds.includes(c._id);
              return (
                <div
                  key={c._id}
                  className={`fm-item ${selected ? "selected" : ""}`}
                  onClick={() => toggleSelection(c._id)}
                >
                  <div className="fm-item-avatar-wrap">
                    {renderConvAvatar(c, 44)}
                    {c.type === "group" && (
                      <span className="fm-group-badge">
                        <GroupIcon />
                      </span>
                    )}
                  </div>
                  <div className="fm-item-info">
                    <span className="fm-item-name">{getName(c)}</span>
                    <span className="fm-item-sub">
                      {c.type === "group"
                        ? `Nhóm • ${c.participants?.length || 0} thành viên`
                        : "Trò chuyện riêng tư"}
                    </span>
                  </div>
                  <div className={`fm-checkbox ${selected ? "checked" : ""}`}>
                    {selected && <CheckIcon />}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="fm-footer">
          {selectedIds.length > 0 && (
            <span className="fm-footer-count">
              Đã chọn {selectedIds.length}
            </span>
          )}
          <div className="fm-footer-btns">
            <button
              className="fm-cancel-btn"
              onClick={onClose}
              disabled={forwarding}
            >
              Hủy
            </button>
            <button
              className="fm-send-btn"
              onClick={handleForward}
              disabled={selectedIds.length === 0 || forwarding}
            >
              {forwarding ? (
                <span className="fm-sending-spinner" />
              ) : (
                <>
                  <SendIcon /> Gửi
                  {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
