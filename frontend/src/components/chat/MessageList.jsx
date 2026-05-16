import React, { useState, useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ImageLightbox from "./ImageLightbox";
import SearchMessages from "./SearchMessages";
import PinnedMessages from "./PinnedMessages";
import ForwardModal from "./ForwardModal";
import { useSocket } from "../../hooks/useSocket";
import messageService from "../../services/message.service";
import { useAuth } from "../../hooks/useAuth";
import "./MessageList.css";
import MultiSelectBar from "./MultiSelectBar";
import { flushSync } from "react-dom";
import {
  formatDateSeparator,
  isDifferentDay,
  formatMessageTime,
} from "../../utils/date.util";
import { useWebRTC } from "../../hooks/useWebRTC";

const MessageList = ({
  conversationId,
  conversationName,
  onReply,
  onEdit,
  showSearch,
  onCloseSearch,
  showPinned,
  onClosePinned,
  isGroup,
  onPinnedChange,
  searchQuery = "",
  onMessagesLoaded,
  wallpaper: wallpaperProp = "",
  isDissolved = false,
  participants = [],
  onOptimisticRef,
}) => {
  const { socket, joinConversation } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const prevConvIdRef = useRef(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const { user } = useAuth();
  const pendingDeletedRef = useRef([]);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [copyToastCount, setCopyToastCount] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [readByMap, setReadByMap] = useState({});
  const [blockedNotice, setBlockedNotice] = useState(null);

  const [nicknameVersion, setNicknameVersion] = useState(0);
  useEffect(() => {
    const handler = () => setNicknameVersion((v) => v + 1);
    window.addEventListener("nickname:changed", handler);
    return () => window.removeEventListener("nickname:changed", handler);
  }, []);

  const scroll = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "instant",
      block: "end",
    });
  };

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  const addOptimisticMessage = (msg) => {
    setMessages((prev) => {
      const exists = prev.some((m) => m._id === msg._id);
      if (exists) return prev;
      return [...prev, msg];
    });
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  };

  // Expose ra ngoài qua ref
  useEffect(() => {
    if (onOptimisticRef) {
      onOptimisticRef.current = addOptimisticMessage;
    }
  }, [onOptimisticRef]);

  // Scroll xuống cuối khi isReady = true hoặc messages thay đổi
  // Theo dõi khi loading xong → scroll xuống cuối
  const initialScrollDoneRef = useRef(false);

  useEffect(() => {
    initialScrollDoneRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (loading) return;
    if (initialScrollDoneRef.current) return;
    if (!messages.length) return;

    initialScrollDoneRef.current = true;

    const container = messagesContainerRef.current;
    if (!container) return;

    // Scroll nhiều lần để đảm bảo sau khi render xong
    const scroll = () => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "instant",
        block: "end",
      });
    };

    scroll();
    requestAnimationFrame(scroll);
    setTimeout(scroll, 100);
    setTimeout(scroll, 300);
  }, [loading, messages.length, conversationId]);

  const [wallpaper, setWallpaper] = useState(
    () =>
      localStorage.getItem(`wallpaper_${conversationId}`) ||
      wallpaperProp ||
      "",
  );

  // Gộp toàn bộ logic wallpaper vào 1 useEffect duy nhất
  useEffect(() => {
    // Khi đổi conversation: đọc lại từ localStorage trước
    const saved = localStorage.getItem(`wallpaper_${conversationId}`) || "";
    setWallpaper(saved || wallpaperProp || "");

    // Lắng nghe socket (người khác thay đổi)
    const handleSocket = ({
      conversationId: cid,
      wallpaper: wp,
      changerId,
    }) => {
      if (cid !== conversationId) return;

      if (wp) {
        localStorage.setItem(`wallpaper_${cid}`, wp);
      } else {
        localStorage.removeItem(`wallpaper_${cid}`);
      }
      setWallpaper(wp || "");
      window.dispatchEvent(
        new CustomEvent("wallpaper:changed", {
          detail: { conversationId: cid, wallpaper: wp || "" },
        }),
      );
    };

    // Lắng nghe window event (chính mình thay đổi từ ConversationInfo)
    const handleWindow = (e) => {
      if (e.detail.conversationId === conversationId)
        setWallpaper(e.detail.wallpaper || "");
    };

    if (socket) socket.on("conversation:wallpaper_changed", handleSocket);
    window.addEventListener("wallpaper:changed", handleWindow);

    return () => {
      if (socket) socket.off("conversation:wallpaper_changed", handleSocket);
      window.removeEventListener("wallpaper:changed", handleWindow);
    };
  }, [socket, conversationId, wallpaperProp]);

  // ── Banner cuộc gọi đang diễn ra ──────────────────────────────────
  const [activeCallInfo, setActiveCallInfo] = useState(null);
  const { startGroupCall, groupCallState } = useWebRTC();

  // Query trạng thái phòng khi chuyển conversation
  useEffect(() => {
    if (!socket || !conversationId || !isGroup) return;
    socket.emit("group-call:query-status", { conversationId });
  }, [socket, conversationId, isGroup]);

  // Lắng nghe broadcast trạng thái phòng
  useEffect(() => {
    if (!socket || !isGroup) return;
    const handleRoomStatus = (data) => {
      if (data.conversationId !== conversationId) return;
      if (data.isActive) {
        setActiveCallInfo(data);
      } else {
        setActiveCallInfo(null);
      }
    };
    socket.on("group-call:room-status", handleRoomStatus);
    return () => socket.off("group-call:room-status", handleRoomStatus);
  }, [socket, conversationId, isGroup]);

  // ✅ Auto scroll xuống khi bật select mode
  useEffect(() => {
    if (isSelectMode && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 100);
    }
  }, [isSelectMode]);

  useEffect(() => {
    if (!conversationId) return;
    if (prevConvIdRef.current !== conversationId) {
      setMessages([]);
      setLoading(true);
      pendingDeletedRef.current = [];
      prevConvIdRef.current = conversationId;
    }
    joinConversation(conversationId);
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    if (loading) return;
    if (!socket?.connected) return;
    if (!conversationId) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const emitRead = () => {
      const nearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        150;
      if (nearBottom) {
        socket.emit("conversation:read", { conversationId });
      }
    };
    container.addEventListener("scroll", emitRead, { passive: true });
    return () => container.removeEventListener("scroll", emitRead);
  }, [loading, conversationId, socket]);

  useEffect(() => {
    onMessagesLoaded?.(messages);
  }, [messages]);

  const loadMessages = async () => {
    try {
      const data = await messageService.getMessages(conversationId, 1, 50);
      if (data?.messages) {
        const deleted = pendingDeletedRef.current;
        const filtered =
          deleted.length > 0
            ? data.messages.filter((m) => !deleted.includes(m._id))
            : data.messages;

        const pinned =
          data.messages
            .filter((m) => m.isPinned)
            .sort((a, b) => new Date(b.pinnedAt) - new Date(a.pinnedAt))[0] ||
          null;
        onPinnedChange?.(pinned || null);

        setMessages(filtered);
        const initialReadByMap = {};
        filtered.forEach((m) => {
          if (m.readBy && m.readBy.length > 0) {
            initialReadByMap[m._id] = m.readBy;
          }
        });
        setReadByMap(initialReadByMap);
        onMessagesLoaded?.(filtered);
      }
    } catch (err) {
      console.error("Load messages error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      const msgConvId =
        typeof msg.conversationId === "object"
          ? msg.conversationId?._id?.toString()
          : msg.conversationId?.toString();
      if (msgConvId !== conversationId?.toString()) return;

      setMessages((prev) => {
        // Xóa optimistic trùng nội dung nếu có
        const withoutOptimistic = prev.filter((m) => {
          if (!m._id?.startsWith("optimistic_")) return true;
          const sameContent = m.content === msg.content;
          const sameConv =
            m.conversationId === msgConvId ||
            m.conversationId === conversationId;
          return !(sameContent && sameConv);
        });
        const exists = withoutOptimistic.some((m) => m._id === msg._id);
        if (exists) return withoutOptimistic;
        const hadOptimistic = prev.some(
          (m) =>
            m._id?.startsWith("optimistic_") &&
            m.content === msg.content &&
            (m.conversationId === msgConvId ||
              m.conversationId === conversationId),
        );
        const finalMsg = msg; // Giữ nguyên status từ server
        return [...withoutOptimistic, finalMsg];
      });

      scrollToBottom("smooth");
      setTimeout(() => scrollToBottom("smooth"), 100);
    };

    const handleStatusUpdate = ({ messageId, status, readBy }) => {
      console.log("📨 message:status nhận:", { messageId, status, readBy });
      if (status === "read" && readBy) {
        setReadByMap((prev) => {
          const existing = prev[messageId] || [];
          const alreadyExists = existing.some(
            (r) => r.userId === readBy.userId,
          );
          if (alreadyExists) return prev;
          return { ...prev, [messageId]: [...existing, readBy] };
        });
      }
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, status } : m)),
      );
    };

    const handleMessageEdited = ({
      messageId,
      content,
      isEdited,
      editedAt,
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId ? { ...m, content, isEdited, editedAt } : m,
        ),
      );
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    };

    const handleMessageRecalled = ({ messageId, content, isRecalled }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId ? { ...m, content, isRecalled, type: "text" } : m,
        ),
      );
    };
    socket.on("message:recalled", handleMessageRecalled);

    const handleDeletedList = ({ deletedIds }) => {
      pendingDeletedRef.current = deletedIds;
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        return prev.filter((m) => !deletedIds.includes(m._id));
      });
    };
    socket.on("message:deletedList", handleDeletedList);

    const handleMessagePinned = ({ messageId, isPinned, pinnedAt }) => {
      setMessages((prev) => {
        const unpinned = prev.map((m) => ({ ...m, isPinned: false }));
        const updated = unpinned.map((m) =>
          m._id === messageId ? { ...m, isPinned, pinnedAt } : m,
        );
        const pinned = updated.find((m) => m._id === messageId);
        if (pinned) onPinnedChange?.(pinned);
        return updated;
      });
    };

    const handleMessageUnpinned = ({ messageId, isPinned }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, isPinned: false } : m)),
      );
      onPinnedChange?.(null);
    };

    const handleMessageReaction = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions } : m)),
      );
    };

    socket.on("message:new", handleNewMessage);

    const handleSystemMessage = (msg) => {
      const msgConvId =
        typeof msg.conversationId === "object"
          ? msg.conversationId?._id?.toString()
          : msg.conversationId?.toString();
      if (msgConvId !== conversationId?.toString()) return;

      setMessages((prev) => {
        const exists = prev.some((m) => m._id === msg._id);
        if (exists) return prev;
        return [...prev, msg];
      });
      scrollToBottom("smooth");
      setTimeout(() => scrollToBottom("smooth"), 100);
    };
    socket.on("message:system", handleSystemMessage);

    socket.on("message:status", handleStatusUpdate);
    socket.on("message:edited", handleMessageEdited);
    socket.on("message:deleted", handleMessageDeleted);

    const handleUnpinAll = () => {
      setMessages((prev) => prev.map((m) => ({ ...m, isPinned: false })));
      onPinnedChange?.(null);
    };

    socket.on("message:pinned", handleMessagePinned);
    socket.on("message:unpinned", handleMessageUnpinned);
    socket.on("message:unpinall", handleUnpinAll);
    socket.on("message:reaction", handleMessageReaction);

    socket.on("message:error", ({ message: errMsg }) => {
      setBlockedNotice(errMsg);
      setTimeout(() => setBlockedNotice(null), 5000);
    });

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:system", handleSystemMessage);
      socket.off("message:status", handleStatusUpdate);
      socket.off("message:edited", handleMessageEdited);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("message:pinned", handleMessagePinned);
      socket.off("message:unpinned", handleMessageUnpinned);
      socket.off("message:reaction", handleMessageReaction);
      socket.off("message:unpinall", handleUnpinAll);
      socket.off("message:recalled", handleMessageRecalled);
      socket.off("message:deletedList", handleDeletedList);
      socket.off("message:error");
    };
  }, [socket, conversationId]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchIndex(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = messages
      .map((m, i) => ({ ...m, _idx: i }))
      .filter((m) => m.type === "text" && m.content?.toLowerCase().includes(q));
    setSearchResults(results);
    setSearchIndex(0);
    if (results.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`message-${results[0]._id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [searchQuery, messages]);

  const handleSelectMessage = (message) => {
    setSelectedMessages((prev) => {
      const exists = prev.some((m) => m._id === message._id);
      if (exists) return prev.filter((m) => m._id !== message._id);
      return [...prev, message];
    });
  };

  const handleCancelSelect = () => {
    setIsSelectMode(false);
    setSelectedMessages([]);
  };

  const handleCopySelected = async () => {
    const count = selectedMessages.length;
    const items = [];
    for (const m of selectedMessages) {
      if (m.type === "text") items.push(m.content);
      else if (m.type === "image") items.push(`[Ảnh] ${m.fileUrl}`);
      else if (m.type === "images") {
        const urls = (m.images || []).map((img) => img.url).join("\n");
        items.push(`[Ảnh]\n${urls}`);
      } else if (m.type === "file")
        items.push(`[File] ${m.fileName}: ${m.fileUrl}`);
      else if (m.type === "voice") items.push(`[Tin nhắn thoại] ${m.fileUrl}`);
    }
    const text = items.filter(Boolean).join("\n\n");
    await navigator.clipboard.writeText(text);
    setShowCopyToast(true);
    setCopyToastCount(count);
    setTimeout(() => setShowCopyToast(false), 2000);
    handleCancelSelect();
  };

  const handleRecallSelected = () => {
    if (!window.confirm(`Thu hồi ${selectedMessages.length} tin nhắn?`)) return;
    selectedMessages.forEach((m) =>
      socket?.emit("message:recall", { messageId: m._id }),
    );
    handleCancelSelect();
  };

  const handleDeleteSelected = () => {
    if (!window.confirm(`Xóa ${selectedMessages.length} tin nhắn?`)) return;
    selectedMessages.forEach((m) =>
      socket?.emit("message:delete", { messageId: m._id }),
    );
    handleCancelSelect();
  };

  const allImages = messages.flatMap((m) => {
    if (m.type === "image") return [m];
    if (m.type === "images") {
      return (m.images || []).map((img) => ({
        ...m,
        _id: m._id + "_" + img.url,
        fileUrl: img.url,
        fileName: img.fileName,
        fileSize: img.fileSize,
      }));
    }
    return [];
  });

  const handleImageClick = (message) => setLightboxImage(message);

  const handlePin = (message) => {
    if (!socket?.connected) return;
    if (message.isPinned) {
      socket.emit("message:unpin", { messageId: message._id });
      onPinnedChange?.(null);
    } else {
      socket.emit("message:pin", { messageId: message._id });
      onPinnedChange?.(message);
    }
  };

  const handleForward = (message) => setForwardMessage(message);

  const scrollToMessage = (messageId) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("highlight");
      setTimeout(() => element.classList.remove("highlight"), 2000);
    }
  };

  // Helper: lấy tên hiển thị đúng cho system message wallpaper
  // Lấy tên hiển thị cho 1 userId: biệt danh (chỉ người xem hiện tại thấy) hoặc tên thật
  const getDisplayName = (userId, fallbackName) => {
    if (!userId) return fallbackName || "Người dùng";
    const currentUserId = user?._id?.toString();
    const uid = userId?.toString();
    if (uid === currentUserId) return "Bạn";
    const nickname = localStorage.getItem(`nickname_user_${uid}`);
    return nickname || fallbackName || "Người dùng";
  };

  // Render nội dung system message với tên/biệt danh đúng, in đậm
  const renderSystemContent = (message) => {
    const content = message.content || "";
    const currentUserId = user?._id?.toString();
    const currentUserName = user?.name || "";

    const toStr = (v) =>
      v?._id?.toString?.() || v?.toString?.() || (v ? String(v) : null);

    const getDisplayName = (userId, fallbackName) => {
      if (!userId && !fallbackName) return "Người dùng";
      const uid = toStr(userId);
      // Kiểm tra theo userId
      if (uid && uid === currentUserId) return "Bạn";
      // Fallback: kiểm tra theo tên nếu không có userId
      if (!uid && fallbackName && fallbackName === currentUserName)
        return "Bạn";
      const nickname = uid
        ? localStorage.getItem(`nickname_user_${uid}`)
        : null;
      return nickname || fallbackName || "Người dùng";
    };

    if (message.subType === "wallpaper_changed") {
      const name = getDisplayName(
        toStr(message.changerId),
        message.changerName,
      );
      const action =
        message.wallpaper && message.wallpaper !== ""
          ? "đã thay đổi ảnh nền cuộc hội thoại"
          : "đã xóa ảnh nền cuộc hội thoại";
      return `<strong>${name}</strong> ${action}`;
    }

    const changerId = toStr(message.changerId);
    const targetId = toStr(message.targetId);
    const changerName = message.changerName || "";
    const targetName = message.targetName || "";

    // Hàm tách và replace tên trong content theo vị trí
    const replaceByPosition = (text, name1, display1, name2, display2) => {
      const idx1 = text.indexOf(name1);
      const idx2 = text.indexOf(name2);
      if (idx1 === -1 || idx2 === -1) return null;
      if (idx1 < idx2) {
        const before = text.slice(0, idx1);
        const middle = text.slice(idx1 + name1.length, idx2);
        const after = text.slice(idx2 + name2.length);
        return `${before}<strong>${display1}</strong>${middle}<strong>${display2}</strong>${after}`;
      } else {
        const before = text.slice(0, idx2);
        const middle = text.slice(idx2 + name2.length, idx1);
        const after = text.slice(idx1 + name1.length);
        return `${before}<strong>${display2}</strong>${middle}<strong>${display1}</strong>${after}`;
      }
    };

    // Có cả 2 tên
    if (changerName && targetName) {
      const changerDisplay = getDisplayName(changerId, changerName);
      const targetDisplay = getDisplayName(targetId, targetName);
      const result = replaceByPosition(
        content,
        changerName,
        changerDisplay,
        targetName,
        targetDisplay,
      );
      if (result) return result;
    }

    // Chỉ có changerName
    if (changerName) {
      const changerDisplay = getDisplayName(changerId, changerName);
      const idx = content.indexOf(changerName);
      if (idx !== -1) {
        const before = content.slice(0, idx);
        const after = content.slice(idx + changerName.length);
        return `${before}<strong>${changerDisplay}</strong>${after}`;
      }
    }

    // Fallback cuối: thay tên mình trong content bằng "Bạn"
    let result = content;
    if (currentUserName) {
      // Đầu câu
      if (
        result.startsWith(currentUserName + " đã ") ||
        result.startsWith(currentUserName + " được ")
      ) {
        result = "Bạn" + result.slice(currentUserName.length);
      }
      // Giữa câu
      result = result.replace(
        new RegExp(
          `(\\s)${currentUserName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`,
          "g",
        ),
        (_, before, after) => `${before}Bạn${after}`,
      );
      // Cuối câu
      if (result.endsWith(" " + currentUserName)) {
        result =
          result.slice(0, result.length - currentUserName.length - 1) + " Bạn";
      }
    }
    return result;
  };

  if (loading) {
    return (
      <div className="message-list-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (isDissolved) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          color: "#94a3b8",
          background: "var(--bg-secondary, #f8fafc)",
          height: "100%",
        }}
      >
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1.2"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
        <p
          style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#64748b" }}
        >
          Nhóm đã bị giải tán
        </p>
        <p style={{ fontSize: 13, margin: 0, color: "#94a3b8" }}>
          Không có nội dung nào để hiển thị
        </p>
      </div>
    );
  }

  const amIInCall = groupCallState !== "idle";

  return (
    <>
      {/* ── Banner cuộc gọi đang diễn ra ──────────────────────────── */}
      {isGroup && activeCallInfo?.isActive && !amIInCall && (
        <div className="gc-active-banner">
          <div className="gc-active-banner-left">
            {/* Dot pulse — element riêng, không dùng ::before để tránh text dính */}
            <span className="gc-active-banner-dot" />
            {/* Icon loại cuộc gọi */}
            <span className="gc-active-banner-icon">
              {activeCallInfo.callType === "video" ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              )}
            </span>
            <div className="gc-active-banner-info">
              <span className="gc-active-banner-title">
                {activeCallInfo.callType === "video"
                  ? "Cuộc gọi video"
                  : "Cuộc gọi thoại"}{" "}
                đang diễn ra
              </span>
              <span className="gc-active-banner-sub">
                {activeCallInfo.participantCount} người tham gia
                {activeCallInfo.participants?.length > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    {activeCallInfo.participants
                      .slice(0, 2)
                      .map((p) => p.name)
                      .join(", ")}
                    {activeCallInfo.participants.length > 2
                      ? ` +${activeCallInfo.participants.length - 2}`
                      : ""}
                  </>
                )}
              </span>
            </div>
          </div>
          <button
            className="gc-active-banner-join"
            onClick={() =>
              startGroupCall(
                conversationId,
                activeCallInfo.callType,
                conversationName,
              )
            }
          >
            Tham gia
          </button>
        </div>
      )}

      <div
        className={`message-list ${isSelectMode ? "select-mode" : ""}`}
        style={{
          ...(wallpaper
            ? {
                backgroundImage: `url(${wallpaper})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundAttachment: "scroll",
              }
            : {}),
        }}
        ref={messagesContainerRef}
      >
        <div className="message-list-content">
          {messages.map((message, index) => {
            const prev = messages[index - 1];
            const next = messages[index + 1];

            const showDateSep = isDifferentDay(
              prev?.createdAt,
              message.createdAt,
            );

            const SEVEN_MINUTES = 7 * 60 * 1000;
            const timeDiff = prev
              ? new Date(message.createdAt) - new Date(prev.createdAt)
              : SEVEN_MINUTES + 1;
            const showTimeSep = !showDateSep && timeDiff > SEVEN_MINUTES;

            const getTimeSepLabel = (date) => {
              const d = new Date(date);
              const now = new Date();
              const today = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
              );
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              const msgDate = new Date(
                d.getFullYear(),
                d.getMonth(),
                d.getDate(),
              );
              if (msgDate.getTime() === today.getTime()) return "Hôm nay";
              if (msgDate.getTime() === yesterday.getTime()) return "Hôm qua";
              const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
              return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
            };

            const TEN_MINUTES = 7 * 60 * 1000;
            const isSameSender = (a, b) => {
              if (!a || !b) return false;
              const idA = a.senderId?._id?.toString() || a.senderId?.toString();
              const idB = b.senderId?._id?.toString() || b.senderId?.toString();
              return idA === idB;
            };

            const showAvatar =
              !prev ||
              !isSameSender(message, prev) ||
              new Date(message.createdAt) - new Date(prev.createdAt) >
                TEN_MINUTES;

            const isLastInGroup =
              !next ||
              !isSameSender(message, next) ||
              new Date(next.createdAt) - new Date(message.createdAt) >
                TEN_MINUTES;

            return (
              <React.Fragment key={`${message._id}-${nicknameVersion}`}>
                {showDateSep && (
                  <div className="date-separator">
                    <span>
                      <strong>{formatDateSeparator(message.createdAt)}</strong>
                    </span>
                  </div>
                )}
                {showTimeSep && (
                  <div className="date-separator">
                    <span>
                      <strong>{getTimeSepLabel(message.createdAt)}</strong>
                    </span>
                  </div>
                )}
                <div id={`message-${message._id}`}>
                  {message.type === "system" ? (
                    <div className="date-separator">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: renderSystemContent(message),
                        }}
                      />
                    </div>
                  ) : (
                    <MessageBubble
                      message={{
                        ...message,
                        readBy: readByMap[message._id] || message.readBy || [],
                      }}
                      conversationId={conversationId}
                      participants={participants}
                      showAvatar={showAvatar}
                      isLastInGroup={isLastInGroup}
                      isLastOwnMessage={(() => {
                        const currentUserId = user?._id?.toString();
                        const senderId =
                          message.senderId?._id?.toString() ||
                          message.senderId?.toString();
                        if (senderId !== currentUserId) return false;
                        for (let i = messages.length - 1; i >= 0; i--) {
                          const s =
                            messages[i].senderId?._id?.toString() ||
                            messages[i].senderId?.toString();
                          if (s === currentUserId)
                            return messages[i]._id === message._id;
                        }
                        return false;
                      })()}
                      isLastMessage={index === messages.length - 1}
                      isGroup={isGroup}
                      onImageClick={handleImageClick}
                      onReply={onReply}
                      onEdit={onEdit}
                      onForward={handleForward}
                      onPin={handlePin}
                      isSelectMode={isSelectMode}
                      isSelected={selectedMessages.some(
                        (s) => s._id === message._id,
                      )}
                      onSelect={handleSelectMessage}
                      onEnterSelectMode={() => setIsSelectMode(true)}
                    />
                  )}
                </div>
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {blockedNotice && (
        <div
          style={{
            textAlign: "center",
            padding: "10px 20px",
            fontSize: 13,
            color: "#e53935",
            background: "#fff3f3",
            borderTop: "1px solid #ffcdd2",
            flexShrink: 0,
          }}
        >
          🚫 {blockedNotice}
        </div>
      )}

      <TypingIndicator conversationId={conversationId} isGroup={isGroup} />

      {isSelectMode && (
        <MultiSelectBar
          selectedMessages={selectedMessages}
          currentUserId={user?._id?.toString()}
          onCopy={handleCopySelected}
          onForward={() => {
            if (selectedMessages.length > 0)
              setForwardMessage(selectedMessages[0]);
          }}
          onRecall={handleRecallSelected}
          onDelete={handleDeleteSelected}
          onCancel={handleCancelSelect}
        />
      )}

      {lightboxImage && (
        <ImageLightbox
          message={lightboxImage}
          allImages={allImages}
          conversationName={conversationName}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {showSearch && (
        <SearchMessages
          conversationId={conversationId}
          onClose={onCloseSearch}
          onMessageClick={scrollToMessage}
        />
      )}

      {showPinned && (
        <PinnedMessages
          messages={messages}
          onClose={onClosePinned}
          onMessageClick={scrollToMessage}
          onUnpin={(messageId) => socket?.emit("message:unpin", { messageId })}
        />
      )}

      {forwardMessage && (
        <ForwardModal
          message={forwardMessage}
          onClose={() => setForwardMessage(null)}
          onSuccess={() => {}}
        />
      )}

      {showCopyToast && (
        <div className="ma-toast">✓ Đã sao chép {copyToastCount} tin nhắn</div>
      )}
    </>
  );
};

export default MessageList;
