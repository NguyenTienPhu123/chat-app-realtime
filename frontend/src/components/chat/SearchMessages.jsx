import React, { useState, useEffect } from "react";
import messageService from "../../services/message.service";
import { formatMessageTime } from "../../utils/date.util";
import "./SearchMessages.css";

const SearchMessages = ({ conversationId, onClose, onMessageClick }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (query.trim()) {
        handleSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [query]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const data = await messageService.searchMessages(conversationId, query);
      setResults(data);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const highlightText = (text, query) => {
    if (!text || !query) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index}>{part}</mark>
      ) : (
        <span key={index}>{part}</span>
      ),
    );
  };

  const getMessagePreview = (message) => {
    if (message.type === "text") {
      return message.content;
    }
    if (message.caption) {
      return message.caption;
    }
    if (message.fileName) {
      return message.fileName;
    }
    return `${message.type} message`;
  };

  return (
    <div className="search-messages-overlay">
      <div className="search-messages-modal">
        <div className="search-header">
          <input
            type="text"
            className="search-input"
            placeholder="Search messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button className="close-search-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="search-results">
          {loading && (
            <div className="search-loading">
              <div className="spinner"></div>
              <span>Searching...</span>
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="no-results">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#65676b"
                strokeWidth="1.5"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p>Không tìm thấy tin nhắn</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="results-list">
              <div className="results-count">
                {results.length} {results.length === 1 ? "result" : "results"}{" "}
                found
              </div>
              {results.map((message) => (
                <div
                  key={message._id}
                  className="result-item"
                  onClick={() => {
                    onMessageClick(message._id);
                    onClose();
                  }}
                >
                  <div className="result-sender">
                    <img
                      src={
                        message.senderId?.avatar ||
                        "https://api.dicebear.com/7.x/avataaars/svg?seed=default"
                      }
                      alt={message.senderId?.name}
                      className="result-avatar"
                    />
                    <span className="result-name">
                      {message.senderId?.name}
                    </span>
                    <span className="result-time">
                      {formatMessageTime(message.createdAt)}
                    </span>
                  </div>
                  <div className="result-content">
                    {highlightText(getMessagePreview(message), query)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!query && (
            <div className="search-placeholder">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#65676b"
                strokeWidth="1.5"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p>Nhập từ khóa để tìm tin nhắn</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchMessages;
