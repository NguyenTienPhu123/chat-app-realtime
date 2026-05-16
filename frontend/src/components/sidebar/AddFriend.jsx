import React, { useState, useEffect, useContext } from "react";
import api from "../../services/api.service";
import { SocketContext } from "../../contexts/SocketContext";
import "./AddFriend.css";
import UserAvatar from "../chat/UserAvatar";

const AddFriend = ({
  onConversationCreated,
  onStartChat,
  onViewProfile,
  conversations = [],
}) => {
  const { pendingFriendRequests, clearFriendRequest } =
    useContext(SocketContext);
  const [tab, setTab] = useState("search");
  const [email, setEmail] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => {
    if (tab === "requests") fetchRequests();
  }, [tab]);

  useEffect(() => {
    if (pendingFriendRequests.length > 0) {
      setIncomingRequests((prev) => {
        const merged = [...prev];
        pendingFriendRequests.forEach((r) => {
          if (!merged.some((m) => m.from._id === r._id)) {
            merged.push({ from: r, _id: r._id });
          }
        });
        return merged;
      });
    }
  }, [pendingFriendRequests]);

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await api.get("/auth/friends/requests");
      setIncomingRequests(res.data?.data?.requests || []);
    } catch {
      setIncomingRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleSearch = async () => {
    if (!email.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setSearchError("");
    try {
      const res = await api.get(
        `/auth/users/search?email=${encodeURIComponent(email.trim())}`,
      );
      setSearchResult(res.data?.data);
    } catch (err) {
      setSearchError(
        err.response?.data?.message || "Không tìm thấy người dùng",
      );
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (targetUserId) => {
    setActionLoading(targetUserId);
    try {
      await api.post("/auth/friends/send-request", { targetUserId });
      setSearchResult((prev) => ({ ...prev, hasSentRequest: true }));
    } catch (err) {
      alert(err.response?.data?.message || "Gửi lời mời thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = async (fromUserId) => {
    setActionLoading(fromUserId);
    try {
      await api.post("/auth/friends/accept", { fromUserId });
      setIncomingRequests((prev) =>
        prev.filter((r) => r.from._id !== fromUserId),
      );
      clearFriendRequest(fromUserId);

      // Xóa deletedIds liên quan rồi reload conversations
      try {
        const DELETED_KEY = `deleted_conversations_${
          JSON.parse(
            localStorage.getItem("currentUser") ||
              sessionStorage.getItem("currentUser") ||
              "{}",
          )?._id
        }`;
        const stored = JSON.parse(localStorage.getItem(DELETED_KEY) || "[]");
        // Lấy conversation với fromUser để xóa khỏi deleted
        const res = await api.get("/conversations");
        const convs = res.data?.data || [];
        const relatedConv = convs.find(
          (c) =>
            c.type === "private" &&
            c.participants?.some(
              (p) => (p._id || p)?.toString() === fromUserId,
            ),
        );
        if (relatedConv) {
          const updated = stored.filter((id) => id !== relatedConv._id);
          localStorage.setItem(DELETED_KEY, JSON.stringify(updated));
        }
      } catch {}

      // Dispatch để ChatPage và ContactsPage reload
      window.dispatchEvent(new CustomEvent("friend:list_changed"));
      window.dispatchEvent(
        new CustomEvent("friend:accepted", { detail: { fromUserId } }),
      );
    } catch (err) {
      alert(err.response?.data?.message || "Thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (fromUserId) => {
    setActionLoading(fromUserId + "_reject");
    try {
      await api.post("/auth/friends/reject", { fromUserId });
      setIncomingRequests((prev) =>
        prev.filter((r) => r.from._id !== fromUserId),
      );
      clearFriendRequest(fromUserId);
    } catch (err) {
      alert(err.response?.data?.message || "Thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = incomingRequests.length;

  const getStatusBadge = (result) => {
    // Tìm conversation trong danh sách
    const existingConv = conversations.find(
      (c) =>
        c.type === "private" &&
        c.participants?.some(
          (p) => (p._id || p)?.toString() === result.user._id?.toString(),
        ),
    );

    // THAY BẰNG:
    const chatBtn = (
      <button
        className="af-btn"
        style={{ background: "#f0f2f5", color: "#1c1e21", marginLeft: 6 }}
        onClick={() => {
          if (existingConv) {
            onStartChat?.(existingConv);
          } else {
            onViewProfile?.(result.user);
          }
        }}
        title="Nhắn tin"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
        Nhắn tin
      </button>
    );

    if (result.isFriend)
      return (
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className="af-badge-status af-badge-friend">Bạn bè</span>
          {chatBtn}
        </div>
      );
    if (result.hasSentRequest)
      return (
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className="af-badge-status af-badge-sent">Đã gửi lời mời</span>
          {chatBtn}
        </div>
      );
    if (result.hasReceivedRequest)
      return (
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className="af-badge-status af-badge-pending">Chờ xác nhận</span>
          {chatBtn}
        </div>
      );
    return (
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          className="af-btn af-btn-primary"
          onClick={() => handleSendRequest(result.user._id)}
          disabled={actionLoading === result.user._id}
        >
          {actionLoading === result.user._id ? (
            <span className="af-spinner" />
          ) : (
            <>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              Kết bạn
            </>
          )}
        </button>
        {chatBtn}
      </div>
    );
  };

  return (
    <div className="af-container">
      {/* Tabs */}
      <div className="af-tabs">
        <button
          className={`af-tab ${tab === "search" ? "active" : ""}`}
          onClick={() => setTab("search")}
        >
          Thêm bạn
        </button>
        <button
          className={`af-tab ${tab === "requests" ? "active" : ""}`}
          onClick={() => setTab("requests")}
        >
          Lời mời
          {pendingCount > 0 && (
            <span className="af-count-badge">{pendingCount}</span>
          )}
        </button>
      </div>

      {/* Tab: Tìm kiếm */}
      {tab === "search" && (
        <div className="af-search-panel">
          <div className="af-search-hint">
            Tìm kiếm bạn bè qua địa chỉ email
          </div>

          <div className="af-search-row">
            <div className="af-input-wrap">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="af-search-icon"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="email"
                className="af-input"
                placeholder="Nhập địa chỉ email..."
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSearchError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              {email && (
                <button
                  className="af-input-clear"
                  onClick={() => {
                    setEmail("");
                    setSearchResult(null);
                    setSearchError("");
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
            <button
              className="af-btn af-btn-search"
              onClick={handleSearch}
              disabled={searching || !email.trim()}
            >
              {searching ? <span className="af-spinner" /> : "Tìm"}
            </button>
          </div>

          {searchError && (
            <div className="af-error-box">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {searchError}
            </div>
          )}

          {searchResult && (
            <div className="af-result-card">
              <UserAvatar
                name={searchResult.user.name}
                avatar={searchResult.user.avatar}
                size={48}
                className="af-avatar"
              />
              <div className="af-info">
                <span className="af-name">{searchResult.user.name}</span>
                <span className="af-email">{searchResult.user.email}</span>
              </div>
              {getStatusBadge(searchResult)}
            </div>
          )}

          {!searchResult && !searchError && !searching && (
            <div className="af-empty-state">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                style={{ opacity: 0.2 }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Nhập email để tìm kiếm</span>
            </div>
          )}
        </div>
      )}

      {/* Tab: Lời mời */}
      {tab === "requests" && (
        <div className="af-requests-panel">
          {loadingRequests ? (
            <div className="af-loading">
              <span className="af-spinner af-spinner--lg" />
            </div>
          ) : incomingRequests.length === 0 ? (
            <div className="af-empty-state">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                style={{ opacity: 0.2 }}
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Không có lời mời kết bạn nào</span>
            </div>
          ) : (
            <>
              <div className="af-requests-count">
                {incomingRequests.length} lời mời
              </div>
              {incomingRequests.map((req) => (
                <div key={req.from._id} className="af-request-card">
                  <UserAvatar
                    name={req.from.name}
                    avatar={req.from.avatar}
                    size={48}
                    className="af-avatar"
                  />
                  <div className="af-info">
                    <span className="af-name">{req.from.name}</span>
                    <span className="af-email">{req.from.email}</span>
                  </div>
                  <div className="af-request-btns">
                    <button
                      className="af-btn af-btn-accept"
                      onClick={() => handleAccept(req.from._id)}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === req.from._id ? (
                        <span className="af-spinner" />
                      ) : (
                        "Chấp nhận"
                      )}
                    </button>
                    <button
                      className="af-btn af-btn-reject"
                      onClick={() => handleReject(req.from._id)}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === req.from._id + "_reject" ? (
                        <span className="af-spinner" />
                      ) : (
                        "Từ chối"
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AddFriend;
