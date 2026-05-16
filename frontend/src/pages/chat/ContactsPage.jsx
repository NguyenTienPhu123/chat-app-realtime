import React, { useState, useEffect } from "react";
import api from "../../services/api.service";
import "./ContactsPage.css";
import UserAvatar from "../../components/chat/UserAvatar";

const ContactsPage = ({ onStartChat, onlineUsers = new Set() }) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [avatarVersions, setAvatarVersions] = useState({});
  const [nicknameVersion, setNicknameVersion] = useState(0);

  useEffect(() => {
    const handler = () => setNicknameVersion((v) => v + 1);
    window.addEventListener("nickname:changed", handler);
    return () => window.removeEventListener("nickname:changed", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const { userId, avatar } = e.detail || {};
      if (!userId) return;
      // Cập nhật avatar trong danh sách friends
      setFriends((prev) =>
        prev.map((f) =>
          f._id?.toString() === userId.toString() ? { ...f, avatar } : f,
        ),
      );
      setAvatarVersions((prev) => ({
        ...prev,
        [userId]: (prev[userId] || 0) + 1,
      }));
    };
    window.addEventListener("user:avatar_updated", handler);
    return () => window.removeEventListener("user:avatar_updated", handler);
  }, []);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await api.get("/auth/friends");
        setFriends(res.data?.data?.friends || []);
      } catch (e) {
        console.error("Load friends error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchFriends();
  }, []);

  const handleRemoveFriend = async (friendId) => {
    setRemovingId(friendId);
    setConfirmRemoveId(null);
    try {
      await api.delete(`/auth/friends/${friendId}`);
      setFriends((prev) => prev.filter((f) => f._id !== friendId));

      // ✅ Xóa biệt danh - convId dạng private_id1_id2
      const keys = Object.keys(localStorage).filter(
        (k) => k.startsWith("nickname_") && k.includes(friendId),
      );
      keys.forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem(`nickname_user_${friendId}`);
    } catch (err) {
      alert(err.response?.data?.message || "Xóa thất bại");
    } finally {
      setRemovingId(null);
    }
  };

  // Lọc theo search
  const filtered = friends.filter((f) =>
    f.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const sorted = [...filtered].sort((a, b) => {
    const getFirstChar = (name) => {
      const parts = (name || "").trim().split(" ");
      for (const part of parts) {
        const c = part[0]?.toUpperCase() || "";
        if (/[A-ZÀ-Ỹ]/i.test(c)) return c;
      }
      return parts[0]?.[0]?.toUpperCase() || "#";
    };
    const nameA = localStorage.getItem(`nickname_user_${a._id}`) || a.name;
    const nameB = localStorage.getItem(`nickname_user_${b._id}`) || b.name;
    return getFirstChar(nameA).localeCompare(getFirstChar(nameB), "vi");
  });

  const grouped = sorted.reduce((acc, friend) => {
    const displayName =
      localStorage.getItem(`nickname_user_${friend._id}`) || friend.name;
    const parts = (displayName || "").trim().split(" ");
    let letter = "#";
    for (const part of parts) {
      const c = part[0]?.toUpperCase() || "";
      if (/[A-ZÀ-Ỹ]/i.test(c)) {
        letter = c;
        break;
      }
    }
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(friend);
    return acc;
  }, {});

  const letters = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "vi"));

  const confirmFriend = friends.find((x) => x._id === confirmRemoveId);

  return (
    <div className="contacts-page">
      {/* Header */}
      <div className="contacts-header">
        <h2>Danh bạ</h2>
        <div className="contacts-search">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Tìm bạn bè..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Count */}
      <div className="contacts-count">{filtered.length} bạn bè</div>

      {/* List */}
      <div className="contacts-list">
        {loading ? (
          <div className="contacts-empty">Đang tải...</div>
        ) : letters.length === 0 ? (
          <div className="contacts-empty">Chưa có bạn bè nào</div>
        ) : (
          letters.map((letter) => (
            <div key={letter} className="contacts-group">
              <div className="contacts-letter">{letter}</div>
              {grouped[letter].map((friend) => {
                const isOnline = onlineUsers.has(friend._id?.toString());
                return (
                  <div
                    key={friend._id}
                    className="contacts-item"
                    onClick={() => onStartChat && onStartChat(friend)}
                  >
                    <div className="contacts-avatar-wrap">
                      <UserAvatar
                        name={
                          localStorage.getItem(`nickname_user_${friend._id}`) ||
                          friend.name
                        }
                        avatar={friend.avatar}
                        size={46}
                        className="contacts-avatar"
                        key={`${friend._id}-${nicknameVersion}-${avatarVersions[friend._id] || 0}`}
                      />
                      <span
                        className={`contacts-dot ${isOnline ? "online" : "offline"}`}
                      />
                    </div>
                    <div className="contacts-info">
                      <span className="contacts-name">
                        {localStorage.getItem(`nickname_user_${friend._id}`) ||
                          friend.name}
                      </span>
                      <span className="contacts-email">{friend.email}</span>
                    </div>
                    <div className="contacts-actions">
                      <button
                        className="contacts-chat-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartChat && onStartChat(friend);
                        }}
                      >
                        Nhắn tin
                      </button>
                      <button
                        className="contacts-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmRemoveId(friend._id);
                        }}
                        disabled={removingId === friend._id}
                      >
                        {removingId === friend._id ? "..." : "Xóa bạn"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Confirm modal */}
      {confirmRemoveId && (
        <div
          className="contacts-modal-overlay"
          onClick={() => setConfirmRemoveId(null)}
        >
          <div className="contacts-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Xóa bạn bè</h3>
            <p>
              Bạn có chắc muốn xóa <strong>{confirmFriend?.name}</strong> khỏi
              danh sách bạn bè? Cuộc trò chuyện vẫn được giữ lại.
            </p>
            <div className="contacts-modal-actions">
              <button
                className="contacts-modal-cancel"
                onClick={() => setConfirmRemoveId(null)}
              >
                Hủy
              </button>
              <button
                className="contacts-modal-confirm"
                onClick={() => handleRemoveFriend(confirmRemoveId)}
              >
                Xóa bạn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactsPage;
