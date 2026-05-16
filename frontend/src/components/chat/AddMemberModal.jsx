import React, { useState, useEffect } from "react";
import conversationService from "../../services/conversation.service";
import api from "../../services/api.service";
import "./AddMemberModal.css";
import UserAvatar from "../chat/UserAvatar";

const AddMemberModal = ({ conversation, onClose, currentUser }) => {
  const [tab, setTab] = useState("friends"); // "friends" | "email"
  const [conversations, setConversations] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]); // conv ids (friends tab)
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Email tab
  const [emailInput, setEmailInput] = useState("");
  const [emailSearching, setEmailSearching] = useState(false);
  const [emailResult, setEmailResult] = useState(null); // { user, alreadyMember }
  const [emailError, setEmailError] = useState("");
  const [emailSelected, setEmailSelected] = useState([]); // [{_id, name, avatar, email}]

  // Adding state
  const [adding, setAdding] = useState(false);

  const currentMemberIds =
    conversation.participants?.map((p) =>
      typeof p === "string" ? p : p._id?.toString(),
    ) || [];

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const data = await conversationService.getConversations();
      const filtered = data.filter((c) => {
        if (c.type !== "private") return false;
        const other = c.participants?.find(
          (p) => !currentMemberIds.includes(p._id?.toString()),
        );
        return !!other;
      });
      setConversations(filtered);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const getOther = (c) => {
    const other = c.participants?.find((p) => {
      const pid = typeof p === "string" ? p : p._id?.toString();
      return pid !== currentUser?._id?.toString();
    });
    return other;
  };
  const getName = (c) => {
    const other = getOther(c);
    return (
      localStorage.getItem(`nickname_user_${other?._id}`) ||
      other?.name ||
      "Unknown"
    );
  };
  const getAvatar = (c) =>
    getOther(c)?.avatar ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=default`;

  const toggleFriend = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const filteredFriends = conversations.filter((c) =>
    getName(c).toLowerCase().includes(search.toLowerCase()),
  );

  // ── Email search ──────────────────────────────────────────────
  const handleSearchEmail = async () => {
    if (!emailInput.trim()) return;
    setEmailSearching(true);
    setEmailResult(null);
    setEmailError("");
    try {
      const res = await api.get(
        `/auth/users/search?email=${encodeURIComponent(emailInput.trim())}`,
      );
      const data = res.data?.data;
      const user = data?.user;
      if (!user) {
        setEmailError("Không tìm thấy người dùng.");
        return;
      }

      const alreadyMember = currentMemberIds.includes(user._id?.toString());
      const alreadySelected = emailSelected.some((u) => u._id === user._id);
      setEmailResult({ user, alreadyMember, alreadySelected });
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
    if (!emailSelected.some((x) => x._id === u._id)) {
      setEmailSelected((prev) => [...prev, u]);
    }
    setEmailResult(null);
    setEmailInput("");
  };

  const removeEmailSelected = (id) =>
    setEmailSelected((prev) => prev.filter((u) => u._id !== id));

  // ── Submit ────────────────────────────────────────────────────
  const totalCount = selectedIds.length + emailSelected.length;

  const handleSubmit = async () => {
    if (totalCount === 0) return;
    setAdding(true);
    try {
      const fromFriends = conversations
        .filter((c) => selectedIds.includes(c._id))
        .map((c) => getOther(c)?._id)
        .filter(Boolean);

      const fromEmail = emailSelected.map((u) => u._id).filter(Boolean);

      const memberIds = [...new Set([...fromFriends, ...fromEmail])];
      await conversationService.addMembers(conversation._id, memberIds);
      onClose();
    } catch (err) {
      alert("Không thể thêm thành viên: " + err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="am-overlay" onClick={onClose}>
      <div className="am-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="am-header">
          <button className="am-close" onClick={onClose}>
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
          <h3>Thêm thành viên</h3>
          <div style={{ width: 32 }} />
        </div>

        {/* Tabs */}
        <div className="am-tabs">
          <button
            className={`am-tab ${tab === "friends" ? "active" : ""}`}
            onClick={() => setTab("friends")}
          >
            Từ bạn bè
          </button>
          <button
            className={`am-tab ${tab === "email" ? "active" : ""}`}
            onClick={() => setTab("email")}
          >
            Qua email
          </button>
        </div>

        {/* Selected chips — hiển thị cả 2 tab */}
        {totalCount > 0 && (
          <div className="am-chips">
            {conversations
              .filter((c) => selectedIds.includes(c._id))
              .map((c) => (
                <div
                  key={c._id}
                  className="am-chip"
                  onClick={() => toggleFriend(c._id)}
                >
                  <UserAvatar
                    name={getName(c)}
                    avatar={getOther(c)?.avatar}
                    size={20}
                  />
                  <span>{getName(c)}</span>
                  <span className="am-chip-x">✕</span>
                </div>
              ))}
            {emailSelected.map((u) => (
              <div
                key={u._id}
                className="am-chip"
                onClick={() => removeEmailSelected(u._id)}
              >
                <UserAvatar name={u.name} avatar={u.avatar} size={20} />
                <span>{u.name}</span>
                <span className="am-chip-x">✕</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Bạn bè ── */}
        {tab === "friends" && (
          <>
            <div className="am-search-wrap">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Tìm bạn bè..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="am-list">
              {loading && <div className="am-empty">Đang tải...</div>}
              {!loading && filteredFriends.length === 0 && (
                <div className="am-empty">
                  Không tìm thấy bạn bè chưa trong nhóm
                </div>
              )}
              {!loading &&
                filteredFriends.map((c) => {
                  const selected = selectedIds.includes(c._id);
                  return (
                    <div
                      key={c._id}
                      className={`am-item ${selected ? "selected" : ""}`}
                      onClick={() => toggleFriend(c._id)}
                    >
                      <UserAvatar
                        name={getOther(c)?.name}
                        avatar={getOther(c)?.avatar}
                        size={40}
                        className="am-item-avatar"
                      />
                      <div className="am-item-info">
                        <span className="am-item-name">{getName(c)}</span>
                        <span className="am-item-sub">Bạn bè</span>
                      </div>
                      <div
                        className={`am-checkbox ${selected ? "checked" : ""}`}
                      >
                        {selected && <span>✓</span>}
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {/* ── Tab: Qua email ── */}
        {tab === "email" && (
          <div className="am-email-panel">
            <p className="am-email-hint">
              Nhập email của người bạn muốn thêm vào nhóm
            </p>

            <div className="am-email-row">
              <input
                type="email"
                placeholder="Nhập email..."
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setEmailError("");
                  setEmailResult(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearchEmail()}
                className="am-email-input"
              />
              <button
                className="am-email-search-btn"
                onClick={handleSearchEmail}
                disabled={emailSearching || !emailInput.trim()}
              >
                {emailSearching ? "..." : "Tìm"}
              </button>
            </div>

            {emailError && <p className="am-email-error">{emailError}</p>}

            {emailResult && (
              <div className="am-email-result">
                <UserAvatar
                  name={emailResult.user.name}
                  avatar={emailResult.user.avatar}
                  size={40}
                  className="am-email-result-avatar"
                />
                <div className="am-email-result-info">
                  <span className="am-email-result-name">
                    {emailResult.user.name}
                  </span>
                  <span className="am-email-result-email">
                    {emailResult.user.email}
                  </span>
                </div>
                {emailResult.alreadyMember ? (
                  <span className="am-email-tag">Đã trong nhóm</span>
                ) : emailResult.alreadySelected ? (
                  <span className="am-email-tag">Đã chọn</span>
                ) : (
                  <button
                    className="am-email-add-btn"
                    onClick={handleAddEmailUser}
                  >
                    Thêm
                  </button>
                )}
              </div>
            )}

            {emailSelected.length === 0 && !emailResult && !emailError && (
              <div className="am-email-empty">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Chưa có người nào được chọn qua email</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="am-footer">
          {totalCount > 0 && (
            <span className="am-footer-count">Đã chọn {totalCount} người</span>
          )}
          <div className="am-footer-btns">
            <button className="am-cancel-btn" onClick={onClose}>
              Hủy
            </button>
            <button
              className="am-submit-btn"
              disabled={totalCount === 0 || adding}
              onClick={handleSubmit}
            >
              {adding
                ? "Đang thêm..."
                : `Thêm${totalCount > 0 ? ` (${totalCount})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMemberModal;
