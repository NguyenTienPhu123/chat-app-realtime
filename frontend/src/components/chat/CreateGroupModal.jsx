import React, { useState, useEffect, useRef } from "react";
import conversationService from "../../services/conversation.service";
import GroupAvatar from "./GroupAvatar";
import api from "../../services/api.service";
import "./CreateGroupModal.css";
import UserAvatar from "../chat/UserAvatar";

const CreateGroupModal = ({ onClose, onSuccess, currentUser }) => {
  const [tab, setTab] = useState("friends"); // "friends" | "email"
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  // Avatar nhóm
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState("");
  const avatarInputRef = useRef(null);

  // Email tab
  const [emailInput, setEmailInput] = useState("");
  const [emailSearching, setEmailSearching] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [emailError, setEmailError] = useState("");
  const [emailSelected, setEmailSelected] = useState([]);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const data = await conversationService.getConversations();
      setConversations(data.filter((c) => c.type === "private"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getOtherUser = (conv) =>
    conv.participants?.find(
      (p) => p._id?.toString() !== currentUser?._id?.toString(),
    );

  const getDisplayName = (u) =>
    localStorage.getItem(`nickname_user_${u?._id}`) || u?.name || "";

  const toggleSelect = (user) => {
    setSelected((prev) => {
      const exists = prev.find((u) => u._id === user._id);
      return exists ? prev.filter((u) => u._id !== user._id) : [...prev, user];
    });
  };

  const filtered = conversations.filter((c) => {
    const other = getOtherUser(c);
    return getDisplayName(other).toLowerCase().includes(search.toLowerCase());
  });

  const handleSearchEmail = async () => {
    if (!emailInput.trim()) return;
    setEmailSearching(true);
    setEmailResult(null);
    setEmailError("");
    try {
      const res = await api.get(
        `/auth/users/search?email=${encodeURIComponent(emailInput.trim())}`,
      );
      const user = res.data?.data?.user;
      if (!user) {
        setEmailError("Không tìm thấy người dùng.");
        return;
      }
      const alreadySelected =
        emailSelected.some((u) => u._id === user._id) ||
        selected.some((u) => u._id === user._id);
      setEmailResult({ user, alreadySelected });
    } catch (err) {
      setEmailError(
        err.response?.data?.message || "Không tìm thấy người dùng.",
      );
    } finally {
      setEmailSearching(false);
    }
  };

  const handleAddEmailUser = () => {
    if (!emailResult?.user) return;
    const u = emailResult.user;
    if (
      !emailSelected.some((x) => x._id === u._id) &&
      !selected.some((x) => x._id === u._id)
    ) {
      setEmailSelected((prev) => [...prev, u]);
    }
    setEmailResult(null);
    setEmailInput("");
    setEmailError("");
  };

  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGroupAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setGroupAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeEmailSelected = (id) =>
    setEmailSelected((prev) => prev.filter((u) => u._id !== id));

  const allSelected = [...selected, ...emailSelected];

  const BASE_URL =
    import.meta.env.VITE_API_URL?.replace("/api", "") ||
    "http://localhost:5000";

  const normalizeAvatar = (avatar) => {
    if (!avatar) return "";
    if (avatar.includes("dicebear")) return ""; // bỏ avatar giả
    if (avatar.startsWith("/uploads")) return `${BASE_URL}${avatar}`;
    if (avatar.startsWith("http")) return avatar;
    return "";
  };

  const previewParticipants = [currentUser, ...allSelected]
    .filter(Boolean)
    .map((p) => ({
      _id: p._id,
      name: localStorage.getItem(`nickname_user_${p._id}`) || p.name || "",
      avatar: normalizeAvatar(p.avatar),
    }));

  const handleCreate = async () => {
    if (allSelected.length < 1) {
      alert("Vui lòng chọn ít nhất 1 người");
      return;
    }
    if (!groupName.trim()) {
      alert("Vui lòng nhập tên nhóm");
      return;
    }
    setCreating(true);
    try {
      let avatarUrl = "";

      if (groupAvatarFile) {
        const formData = new FormData();
        formData.append("file", groupAvatarFile);
        // Thêm type để multer biết lưu vào folder image
        formData.append("type", "image");
        const uploadRes = await api.post("/files/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const raw = uploadRes.data?.data?.url || uploadRes.data?.url || "";
        // Server trả URL dạng http://localhost:5000/uploads/image/...
        // Chỉ lấy phần path để lưu vào DB
        avatarUrl = raw.startsWith("http") ? new URL(raw).pathname : raw;
      }

      const participantIds = allSelected.map((u) => u._id);
      await conversationService.createGroup(
        groupName.trim(),
        participantIds,
        avatarUrl,
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      alert(
        "Không thể tạo nhóm: " + (err.response?.data?.message || err.message),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="cg-overlay" onClick={onClose}>
      <div className="cg-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cg-header">
          <button className="cg-close" onClick={onClose}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <h3>Tạo nhóm mới</h3>
          <div style={{ width: 32 }} />
        </div>

        {/* Group name + avatar */}
        <div className="cg-preview">
          <div className="cg-avatar-section">
            <div className="cg-avatar-wrap">
              {groupAvatarPreview ? (
                <img
                  src={groupAvatarPreview}
                  alt="avatar"
                  className="cg-avatar-img"
                />
              ) : (
                <GroupAvatar
                  participants={previewParticipants}
                  size={64}
                  nicknames={Object.fromEntries(
                    previewParticipants.map((p) => [
                      p._id?.toString(),
                      localStorage.getItem(`nickname_user_${p._id}`) ||
                        p.name ||
                        "",
                    ]),
                  )}
                  key={previewParticipants
                    .map((p) => p?.avatar + p?._id)
                    .join(",")}
                />
              )}
            </div>
            <button
              type="button"
              className="cg-avatar-upload-btn"
              onClick={() => avatarInputRef.current?.click()}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              {groupAvatarPreview ? "Đổi ảnh" : "Thêm ảnh"}
            </button>
            {groupAvatarPreview && (
              <button
                type="button"
                className="cg-avatar-remove-btn"
                onClick={() => {
                  setGroupAvatarPreview("");
                  setGroupAvatarFile(null);
                }}
              >
                Xóa ảnh
              </button>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarFileChange}
            />
          </div>
          <div className="cg-name-wrap">
            <label className="cg-name-label">Tên nhóm</label>
            <input
              className="cg-name-input"
              placeholder="Nhập tên nhóm..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
              autoFocus
            />
          </div>
        </div>

        {/* Selected chips */}
        {allSelected.length > 0 && (
          <div className="cg-chips">
            {selected.map((u) => (
              <div
                key={u._id}
                className="cg-chip"
                onClick={() => toggleSelect(u)}
              >
                <UserAvatar
                  name={
                    localStorage.getItem(`nickname_user_${u._id}`) || u.name
                  }
                  avatar={u.avatar}
                  size={20}
                />
                <span>{getDisplayName(u)}</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            ))}
            {emailSelected.map((u) => (
              <div
                key={u._id}
                className="cg-chip cg-chip--email"
                onClick={() => removeEmailSelected(u._id)}
              >
                <UserAvatar name={u.name} avatar={u.avatar} size={20} />
                <span>{u.name}</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="cg-tabs">
          <button
            className={`cg-tab ${tab === "friends" ? "active" : ""}`}
            onClick={() => setTab("friends")}
          >
            Từ bạn bè
          </button>
          <button
            className={`cg-tab ${tab === "email" ? "active" : ""}`}
            onClick={() => setTab("email")}
          >
            Qua email
          </button>
        </div>

        {/* Tab: Bạn bè */}
        {tab === "friends" && (
          <>
            <div className="cg-search">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#999"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                placeholder="Tìm bạn bè..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="cg-list">
              {loading && <div className="cg-empty">Đang tải...</div>}
              {!loading && filtered.length === 0 && (
                <div className="cg-empty">Không tìm thấy bạn bè</div>
              )}
              {!loading &&
                filtered.map((conv) => {
                  const other = getOtherUser(conv);
                  if (!other) return null;
                  const isSel = !!selected.find((u) => u._id === other._id);
                  return (
                    <div
                      key={conv._id}
                      className={`cg-item ${isSel ? "selected" : ""}`}
                      onClick={() => toggleSelect(other)}
                    >
                      <UserAvatar
                        name={getDisplayName(other)}
                        avatar={other.avatar}
                        size={40}
                        className="cg-item-avatar"
                      />
                      <div className="cg-item-info">
                        <span className="cg-item-name">
                          {getDisplayName(other)}
                        </span>
                        <span className="cg-item-sub">Bạn bè</span>
                      </div>
                      <div className={`cg-checkbox ${isSel ? "checked" : ""}`}>
                        {isSel && (
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="3"
                          >
                            <polyline points="20,6 9,17 4,12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {/* Tab: Email */}
        {tab === "email" && (
          <div className="cg-email-panel">
            <p className="cg-email-hint">
              Thêm người chưa kết bạn vào nhóm qua địa chỉ email
            </p>
            <div className="cg-email-row">
              <input
                type="email"
                placeholder="Nhập địa chỉ email..."
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setEmailError("");
                  setEmailResult(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearchEmail()}
                className="cg-email-input"
              />
              <button
                className="cg-email-btn"
                onClick={handleSearchEmail}
                disabled={emailSearching || !emailInput.trim()}
              >
                {emailSearching ? "..." : "Tìm"}
              </button>
            </div>

            {emailError && <p className="cg-email-error">{emailError}</p>}

            {emailResult && (
              <div className="cg-email-result">
                <UserAvatar
                  name={emailResult.user.name}
                  avatar={emailResult.user.avatar}
                  size={40}
                  className="cg-email-avatar"
                />
                <div className="cg-email-info">
                  <span className="cg-email-name">{emailResult.user.name}</span>
                  <span className="cg-email-sub">{emailResult.user.email}</span>
                </div>
                {emailResult.alreadySelected ? (
                  <span className="cg-email-tag">Đã chọn</span>
                ) : (
                  <button className="cg-email-add" onClick={handleAddEmailUser}>
                    Thêm
                  </button>
                )}
              </div>
            )}

            {emailSelected.length === 0 && !emailResult && !emailError && (
              <div className="cg-email-empty">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  style={{ opacity: 0.25 }}
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Chưa có ai được thêm qua email</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="cg-footer">
          <span className="cg-count">
            {allSelected.length > 0
              ? `${allSelected.length + 1} thành viên`
              : ""}
          </span>
          <div className="cg-footer-btns">
            <button className="cg-cancel" onClick={onClose}>
              Hủy
            </button>
            <button
              className="cg-create"
              onClick={handleCreate}
              disabled={allSelected.length < 1 || !groupName.trim() || creating}
            >
              {creating ? "Đang tạo..." : "Tạo nhóm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
