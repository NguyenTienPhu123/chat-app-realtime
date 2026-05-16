import React, { useState, useContext } from "react";
import ConversationList from "./ConversationList";
import AddFriend from "./AddFriend";
import { SearchIcon, GroupIcon, AddIcon } from "../../icons";
import { SocketContext } from "../../contexts/SocketContext";
import "./MiddlePanel.css";

const MiddlePanel = ({
  conversations,
  selectedId,
  onSelect,
  loading,
  onNewChat,
  onNewGroup,
  onConversationCreated,
}) => {
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showAddFriend, setShowAddFriend] = useState(false);
  const { pendingFriendRequests } = useContext(SocketContext);

  const filteredConversations = conversations.filter((conv) => {
    if (activeTab === "unread" && (!conv.unreadCount || conv.unreadCount === 0))
      return false;
    if (searchText.trim()) {
      const name = conv.name || conv.participants?.[0]?.name || "";
      return name.toLowerCase().includes(searchText.toLowerCase());
    }
    return true;
  });

  return (
    <div className="middle-panel-zalo">
      {/* Header */}
      <div className="middle-panel-header-zalo">
        <div className="search-box-zalo">
          <SearchIcon size={20} />
          <input
            type="text"
            placeholder="Tìm kiếm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="header-actions-zalo">
          <button className="header-icon-btn" title="Danh bạ">
            <GroupIcon size={22} />
          </button>

          {/* Nút thêm bạn với badge lời mời */}
          <button
            className={`header-icon-btn ${showAddFriend ? "active" : ""}`}
            title="Thêm bạn / Lời mời"
            onClick={() => setShowAddFriend((v) => !v)}
            style={{ position: "relative" }}
          >
            <AddIcon size={22} />
            {pendingFriendRequests.length > 0 && (
              <span className="mp-friend-badge">
                {pendingFriendRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Panel thêm bạn (toggle) */}
      {showAddFriend && (
        <div className="mp-addfriend-panel">
          <AddFriend onConversationCreated={onConversationCreated} />
        </div>
      )}

      {/* Tabs */}
      <div className="conversation-tabs-zalo">
        <button
          className={`tab-btn-zalo ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          Tất cả
        </button>
        <button
          className={`tab-btn-zalo ${activeTab === "unread" ? "active" : ""}`}
          onClick={() => setActiveTab("unread")}
        >
          Chưa đọc
        </button>
      </div>

      {/* New Chat + New Group Buttons */}
      <div className="action-buttons-container">
        <button className="new-chat-btn" onClick={onNewChat}>
          <span className="btn-icon">➕</span>
          <span>New Chat</span>
        </button>
        <button className="new-group-btn" onClick={onNewGroup}>
          <span className="btn-icon">👥</span>
          <span>New Group</span>
        </button>
      </div>

      {/* Search Conversations Input */}
      <div className="search-conversations-box">
        <input
          type="text"
          placeholder="Search conversations..."
          className="search-conversations-input"
        />
      </div>

      {/* Conversation List */}
      <ConversationList
        conversations={filteredConversations}
        selectedId={selectedId}
        onSelect={onSelect}
        loading={loading}
      />
    </div>
  );
};

export default MiddlePanel;
