import React, { useMemo } from "react";
import ConversationItem from "./ConversationItem";
import "./ConversationList.css";

const ConversationList = React.memo(
  ({
    conversations,
    selectedId,
    onSelect,
    loading,
    onPin,
    onMarkUnread,
    onMute,
    onDelete,
    onAddToGroup,
  }) => {
    const sortedConversations = useMemo(() => {
      if (!conversations?.length) return [];
      const unique = conversations.filter(
        (conv, index, self) =>
          index === self.findIndex((c) => c._id === conv._id),
      );
      return unique.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const timeA = new Date(
          a.lastMessage?.createdAt || a.updatedAt || 0,
        ).getTime();
        const timeB = new Date(
          b.lastMessage?.createdAt || b.updatedAt || 0,
        ).getTime();
        return timeB - timeA;
      });
    }, [conversations]);

    if (loading) {
      return (
        <div className="conversation-list-container">
          <div className="loading-conversations">
            <div className="loading-spinner"></div>
            <p>Đang tải cuộc trò chuyện...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="conversation-list-container">
        <div className="conversation-list">
          {sortedConversations.length > 0 ? (
            sortedConversations.map((conversation) => (
              <ConversationItem
                key={conversation._id}
                conversation={conversation}
                isSelected={conversation._id === selectedId}
                onSelect={onSelect}
                onPin={onPin}
                onMarkUnread={onMarkUnread}
                onMute={onMute}
                onDelete={onDelete}
                onAddToGroup={onAddToGroup}
              />
            ))
          ) : (
            <div className="empty-conversation-hint">
              <p className="hint-text">Bắt đầu trò chuyện với bạn bè của bạn</p>
            </div>
          )}
        </div>
      </div>
    );
  },
);

export default ConversationList;
