import React, { useState, useEffect, useCallback, useMemo } from "react";
import ConversationList from "../../components/sidebar/ConversationList";
import MessageList from "../../components/chat/MessageList";
import MessageInput from "../../components/chat/MessageInput";
import ChatHeader from "../../components/chat/ChatHeader";
import ConversationInfo from "../../components/chat/ConversationInfo";
import { useAuth } from "../../hooks/useAuth";
import { useSocket } from "../../hooks/useSocket";
import { useContext } from "react";
import { SocketContext } from "../../contexts/SocketContext";
import conversationService from "../../services/conversation.service";
import StarredMessages from "../../components/chat/StarredMessages";
import ForwardModal from "../../components/chat/ForwardModal";
import CreateGroupModal from "../../components/chat/CreateGroupModal";
import AddMemberModal from "../../components/chat/AddMemberModal";
import AddFriend from "../../components/sidebar/AddFriend";
import ContactsPage from "./ContactsPage";
import { useWebRTC } from "../../hooks/useWebRTC";
import CallModal from "../../components/chat/CallModal";
import GroupCallModal from "../../components/chat/GroupCallModal";
import GroupAvatar from "../../components/chat/GroupAvatar";

import { SearchIcon, AddIcon, CheckIcon } from "../../icons";
import api from "../../services/api.service";
import "./ChatPage.css";
import UserAvatar from "../../components/chat/UserAvatar";
import ProfileModal from "../../components/chat/ProfileModal";
import SettingsModal from "../../components/chat/SettingsModal";

// ── Sidebar Icons (SVG thuần) ──────────────────────────────
const SidebarChatIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ display: "block", flexShrink: 0 }}
  >
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
    <path d="M7 9h10v2H7zm0-3h10v2H7zm0 6h7v2H7z" />
  </svg>
);

const SidebarContactsIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ display: "block", flexShrink: 0 }}
  >
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const SidebarStarIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ display: "block", flexShrink: 0 }}
  >
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </svg>
);

const SidebarSettingsIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ display: "block", flexShrink: 0 }}
  >
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </svg>
);
// 🎨 WELCOME CAROUSEL DATA
const WELCOME_SLIDES = [
  {
    id: 1,
    icon: "💬",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    title: "Nhắn tin nhanh chóng",
    description: "Gửi tin nhắn, hình ảnh và video với tốc độ cao",
  },
  {
    id: 2,
    icon: "👥",
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    title: "Tạo nhóm chat",
    description: "Trò chuyện nhóm với bạn bè dễ dàng",
  },
  {
    id: 3,
    icon: "📞",
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    title: "Gọi thoại & video",
    description: "Kết nối qua cuộc gọi chất lượng cao",
  },
  {
    id: 4,
    icon: "🔒",
    gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    title: "Bảo mật tuyệt đối",
    description: "Tin nhắn được mã hóa đầu-cuối",
  },
  {
    id: 5,
    icon: "📎",
    gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    title: "Chia sẻ file",
    description: "Gửi nhận file không giới hạn",
  },
];

const ChatPage = () => {
  const { user, logout, login } = useAuth();
  const { socket } = useSocket();
  const { pendingFriendRequests } = useContext(SocketContext);
  // THÊM startGroupCall vào đây
  const { startCall, startGroupCall } = useWebRTC();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("messages");
  const [showInfoSidebar, setShowInfoSidebar] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMarkReadDialog, setShowMarkReadDialog] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editMessage, setEditMessage] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [showStarred, setShowStarred] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all"); // all | unread
  const [addToGroupConversation, setAddToGroupConversation] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [currentMessages, setCurrentMessages] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [previewUser, setPreviewUser] = useState(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [friendReqSent, setFriendReqSent] = useState(false);
  const optimisticRef = React.useRef(null);
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`search_history_${user?._id}`) || "[]",
      );
    } catch {
      return [];
    }
  });
  const [searchRef] = useState(React.createRef());

  const [wallpaperMap, setWallpaperMap] = useState({});

  // Re-render khi biệt danh thay đổi
  const [, setNicknameVersion] = useState(0);
  useEffect(() => {
    const handler = () => setNicknameVersion((v) => v + 1);
    window.addEventListener("nickname:changed", handler);
    return () => window.removeEventListener("nickname:changed", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const { conversationId: cid, wallpaper: wp } = e.detail;
      setWallpaperMap((prev) => ({ ...prev, [cid]: wp || "" }));
    };
    window.addEventListener("wallpaper:changed", handler);
    return () => window.removeEventListener("wallpaper:changed", handler);
  }, []);

  // 🎨 CAROUSEL STATE
  const [currentSlide, setCurrentSlide] = useState(0);

  // ── Helper lưu danh sách conv đã xóa vào localStorage ──
  const DELETED_KEY = `deleted_conversations_${user?._id}`;

  const DISSOLVED_KEY = `dissolved_conversations_${user?._id}`;

  const getDissolvedIds = () => {
    try {
      return JSON.parse(localStorage.getItem(DISSOLVED_KEY) || "[]");
    } catch {
      return [];
    }
  };

  const addDissolvedId = (convId) => {
    const ids = getDissolvedIds();
    if (!ids.includes(convId)) {
      localStorage.setItem(DISSOLVED_KEY, JSON.stringify([...ids, convId]));
    }
  };

  const getDeletedIds = () => {
    try {
      return JSON.parse(localStorage.getItem(DELETED_KEY) || "[]");
    } catch {
      return [];
    }
  };

  const addDeletedId = (convId) => {
    const ids = getDeletedIds();
    if (!ids.includes(convId)) {
      localStorage.setItem(DELETED_KEY, JSON.stringify([...ids, convId]));
    }
  };

  const removeDeletedId = (convId) => {
    const ids = getDeletedIds();
    localStorage.setItem(
      DELETED_KEY,
      JSON.stringify(ids.filter((id) => id !== convId)),
    );
  };

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await conversationService.getConversations();
      const deletedIds = getDeletedIds();
      const dissolvedIds = getDissolvedIds();
      const manualUnreadIds = JSON.parse(
        localStorage.getItem(`manual_unread_${user?._id}`) || "[]",
      );
      const marked = (data || []).map((c) => {
        if (deletedIds.includes(c._id))
          return { ...c, isDeleted: true, lastMessage: null, unreadCount: 0 };
        if (dissolvedIds.includes(c._id))
          return { ...c, isDissolved: true, unreadCount: 0 };
        return { ...c, isManualUnread: manualUnreadIds.includes(c._id) };
      });
      setConversations(marked);
    } catch (err) {
      console.error("Load conversations error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ✅ Join tất cả conversation rooms để nhận real-time updates
  // useEffect(() => {
  //   if (!socket || conversations.length === 0) return;
  //   conversations.forEach((conv) => {
  //     socket.emit("conversation:join", conv._id);
  //   });
  // }, [socket, conversations.length]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      const convId =
        typeof msg.conversationId === "object"
          ? msg.conversationId?._id?.toString()
          : msg.conversationId?.toString();

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id?.toString() === convId);
        if (idx === -1) {
          loadConversations();
          return prev;
        }

        if (prev[idx].isDissolved) return prev;
        const updated = [...prev];
        const conv = { ...updated[idx] };

        if (conv.isDeleted) {
          conv.isDeleted = false;
          removeDeletedId(conv._id); // ✅ xóa khỏi localStorage
        }

        conv.lastMessage = {
          _id: msg._id,
          content: msg.content,
          type: msg.type,
          senderId: msg.senderId,
          createdAt: msg.createdAt,
          fileName: msg.fileName,
          fileUrl: msg.fileUrl,
          images: msg.images,
          caption: msg.caption,
          voiceDuration: msg.voiceDuration,
          isRecalled: msg.isRecalled,
          callType: msg.callType,
          callStatus: msg.callStatus,
          callDuration: msg.callDuration,
          changerId: msg.changerId,
          changerName: msg.changerName,
          subType: msg.subType,
          isEdited: msg.isEdited,
        };

        if (selectedConversation?._id?.toString() !== convId) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        }

        updated.splice(idx, 1);
        updated.unshift(conv);
        return updated;
      });
    };

    const handleNewConversation = (conv) => {
      if (conv?.isDissolved) return;

      // Xóa khỏi deletedIds nếu có — trường hợp kết bạn lại sau khi đã xóa hội thoại
      removeDeletedId(conv._id);

      setConversations((prev) => {
        // Nếu đã tồn tại nhưng bị đánh dấu isDeleted → khôi phục
        const idx = prev.findIndex((c) => c._id === conv._id);
        if (idx !== -1) {
          if (prev[idx].isDeleted) {
            const updated = [...prev];
            updated[idx] = { ...conv, isDeleted: false };
            return updated;
          }
          return prev;
        }
        return [conv, ...prev];
      });

      // Cập nhật selectedConversation nếu đang ở preview
      setSelectedConversation((prev) => {
        if (prev?.isPreview) {
          const previewReceiverId = prev._id?.replace("preview_", "");
          const isMatch = conv.participants?.some(
            (p) => (p._id || p)?.toString() === previewReceiverId,
          );
          if (isMatch) return { ...conv, isPreview: false };
        }
        return prev;
      });
    };

    const reload = () => loadConversations();

    // ✅ Dùng functional update, KHÔNG đọc state cũ trực tiếp
    const handleStatusChanged = ({ userId, status }) => {
      const id = userId.toString();
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (status === "online") {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    };

    // ✅ REPLACE hoàn toàn - đây là danh sách chính xác từ server
    const handleUsersOnline = (userIds) => {
      setOnlineUsers((prev) => {
        const next = new Set(userIds.map((id) => id.toString()));
        // Giữ lại các user đã online trong prev, merge với list mới
        prev.forEach((id) => next.add(id));
        return next;
      });
    };

    socket.on("message:new", handleNewMessage);

    const handleLastMessage = ({
      conversationId,
      lastMessage,
      reactTargetUserId,
    }) => {
      setConversations((prev) => {
        const idx = prev.findIndex(
          (c) => c._id?.toString() === conversationId?.toString(),
        );
        if (idx === -1) return prev;

        const c = prev[idx];
        if (c.isDissolved) return prev;

        const myId = user?._id?.toString();
        const senderId =
          lastMessage?.senderId?._id?.toString() ||
          lastMessage?.senderId?.toString();
        const isFromMe = senderId === myId;
        const isOpenConv =
          selectedConversation?._id?.toString() === conversationId?.toString();

        // Giữ nguyên unreadCount hiện tại, KHÔNG tăng ở đây
        // vì message:new đã tăng rồi. Chỉ tăng cho reaction được target vào mình
        const isSelfReaction =
          lastMessage?.type === "reaction" &&
          (lastMessage?.senderId?._id?.toString() === myId ||
            lastMessage?.senderId?.toString() === myId);

        const shouldIncreaseUnread =
          !isSelfReaction &&
          reactTargetUserId &&
          reactTargetUserId === myId &&
          !isOpenConv;

        const updatedConv = {
          ...c,
          lastMessage,
          // Chỉ thay đổi unreadCount khi là reaction target vào mình
          // Các trường hợp khác giữ nguyên unreadCount đã được message:new cập nhật
          unreadCount: shouldIncreaseUnread
            ? (c.unreadCount || 0) + 1
            : c.unreadCount,
        };

        const next = [...prev];
        next.splice(idx, 1);
        next.unshift(updatedConv);
        return next;
      });
    };

    socket.on("conversation:lastMessage", handleLastMessage);
    socket.on("conversation:updated", reload);
    socket.on("conversation:new", handleNewConversation);

    const handleConversationUpdatedInfo = (conv) => {
      // Không cập nhật conversation đã giải tán
      setConversations((prev) => {
        const existing = prev.find((c) => c._id === conv._id);
        if (existing?.isDissolved) return prev;
        return prev; // tiếp tục xử lý bên dưới
      });

      const mergeConv = (old, updated) => {
        const mergeParticipants = (newList, oldList) => {
          if (!newList) return oldList;
          return newList.map((np) => {
            if (np.name) return np;
            const old = oldList?.find(
              (op) => (op._id || op)?.toString() === (np._id || np)?.toString(),
            );
            return old?.name
              ? old
              : { ...np, name: np.email?.split("@")[0] || "Người dùng" };
          });
        };

        return {
          ...old,
          ...updated,
          // Luôn ưu tiên giữ adminId đã populate (object có _id, name)
          // chỉ update nếu conv mới có adminId dạng object populate đầy đủ
          adminId:
            updated.adminId &&
            typeof updated.adminId === "object" &&
            updated.adminId._id
              ? updated.adminId
              : old.adminId,
          moderators: updated.moderators || old.moderators,
          participants: mergeParticipants(
            updated.participants,
            old.participants,
          ),
        };
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c._id !== conv._id) return c;
          if (c.isDissolved) return c; // không cập nhật nhóm đã giải tán
          return mergeConv(c, conv);
        }),
      );

      if (selectedConversation?._id === conv._id) {
        setSelectedConversation((prev) => {
          if (prev?.isDissolved) return prev;
          return mergeConv(prev, conv);
        });
      }
    };

    const handlePrivacyChanged = ({ userId, allowMessagesFrom }) => {
      if (
        otherUserIdRef.current &&
        otherUserIdRef.current === userId?.toString()
      ) {
        if (isFriendWithRef.current === true) {
          setIsBlockedStranger(false);
          return;
        }
        setIsBlockedStranger(allowMessagesFrom === "contacts");
      }
    };

    socket.on("user:privacy_changed", handlePrivacyChanged);

    socket.on("conversation:updated_info", handleConversationUpdatedInfo);

    // Đồng bộ wallpaper map khi nhận socket
    socket.on(
      "conversation:wallpaper_changed",
      ({ conversationId: cid, wallpaper: wp }) => {
        setWallpaperMap((prev) => ({ ...prev, [cid]: wp || "" }));
      },
    );

    // Bạn rời nhóm
    socket.on("group:you_left", ({ conversationId }) => {
      setConversations((prev) => prev.filter((c) => c._id !== conversationId));
      setSelectedConversation((prev) =>
        prev?._id === conversationId ? null : prev,
      );
    });

    socket.on("conversation:kicked", ({ conversationId }) => {
      setConversations((prev) => prev.filter((c) => c._id !== conversationId));
      setSelectedConversation((prev) =>
        prev?._id === conversationId ? null : prev,
      );
    });

    socket.on("group:dissolved_self", ({ conversationId }) => {
      addDeletedId(conversationId); // ← người giải tán: lưu vào deleted
      setConversations((prev) => prev.filter((c) => c._id !== conversationId));
      setSelectedConversation((prev) =>
        prev?._id === conversationId ? null : prev,
      );
      setCurrentMessages([]);
    });

    // Thành viên còn lại → chỉ cập nhật trạng thái, KHÔNG đóng sidebar
    socket.on(
      "group:dissolved",
      ({ conversationId, dissolverName, groupName }) => {
        const dissolvedMsg = {
          _id: `dissolved_${Date.now()}`,
          type: "system",
          content: `${dissolverName} đã giải tán nhóm`,
          senderId: null,
          createdAt: new Date().toISOString(),
        };
        setConversations((prev) =>
          prev.map((c) =>
            c._id !== conversationId
              ? c
              : {
                  ...c,
                  isDissolved: true,
                  lastMessage: dissolvedMsg,
                  // Xóa unreadCount để không tăng thêm
                  unreadCount: c.unreadCount || 0,
                },
          ),
        );
        setSelectedConversation((prev) =>
          prev?._id !== conversationId ? prev : { ...prev, isDissolved: true },
        );
      },
    );

    // Thành viên khác rời nhóm → cập nhật adminId nếu có đổi trưởng
    socket.on(
      "group:member_left",
      ({ conversationId, userId: leftUserId, newAdminId }) => {
        setConversations((prev) =>
          prev.map((c) => {
            if (c._id !== conversationId) return c;
            return {
              ...c,
              participants: (c.participants || []).filter(
                (p) => (p._id || p).toString() !== leftUserId,
              ),
              ...(newAdminId ? { adminId: newAdminId } : {}),
            };
          }),
        );
        if (selectedConversation?._id === conversationId) {
          setSelectedConversation((prev) => ({
            ...prev,
            participants: (prev.participants || []).filter(
              (p) => (p._id || p).toString() !== leftUserId,
            ),
            ...(newAdminId ? { adminId: newAdminId } : {}),
          }));
        }
      },
    );
    socket.on("user:status_changed", handleStatusChanged);
    socket.on("users:online", handleUsersOnline);

    // Thêm vào trong useEffect socket (cùng chỗ với các socket.on khác)
    socket.on("friend:request_accepted", ({ fromUser, withUserId }) => {
      const fromId = fromUser?._id?.toString();
      const withId = withUserId?.toString();
      const currentOtherId = otherUserIdRef.current;

      if (
        currentOtherId &&
        (currentOtherId === fromId || currentOtherId === withId)
      ) {
        setIsFriendWith(true);
        setIsBlockedStranger(false);
        setFriendReqSent(false);
        window.dispatchEvent(new CustomEvent("friend:list_changed"));
      }

      // Xóa khỏi deletedIds trước khi reload để conversation hiện lại
      const deletedIds = getDeletedIds();
      // Reload conversations để lấy conversation mới
      loadConversations().then?.(() => {
        // Sau khi load xong, xóa flag deleted cho conversation với người này
      });

      // Xóa tất cả deleted conversation liên quan đến fromUser hoặc withUserId
      try {
        const stored = JSON.parse(localStorage.getItem(DELETED_KEY) || "[]");
        // Không thể biết convId ở đây nên reload sạch
        localStorage.removeItem(DELETED_KEY);
      } catch {}

      loadConversations();
    });

    socket.on("friend:request_rejected", ({ fromUserId }) => {
      const other = getOtherUser();
      if (other?._id?.toString() === fromUserId?.toString()) {
        setIsFriendWith(false); // quay về false, banner hiện lại nút Kết bạn
      }
    });

    socket.on("conversation:id_updated", ({ oldId, newId }) => {
      setSelectedConversation((prev) => {
        if (prev?._id === oldId) {
          return { ...prev, _id: newId, isPreview: false };
        }
        return prev;
      });
      loadConversations();
    });

    socket.on(
      "conversation:read_by",
      ({ conversationId, userId: readerId }) => {
        // Nếu người đọc không phải mình thì cập nhật status tin nhắn cuối
        if (readerId === user?._id?.toString()) return;
        if (selectedConversation?._id?.toString() !== conversationId) return;
        // Dispatch event để MessageBubble cập nhật readBy
        window.dispatchEvent(
          new CustomEvent("messages:read_by", {
            detail: { conversationId, readerId },
          }),
        );
      },
    );

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("conversation:updated", reload);
      socket.off("conversation:new", handleNewConversation);
      socket.off("user:status_changed", handleStatusChanged);
      socket.off("users:online", handleUsersOnline);
      socket.off("conversation:updated_info", handleConversationUpdatedInfo);
      socket.off("conversation:wallpaper_changed");
      socket.off("group:you_left");
      socket.off("group:dissolved_self");
      socket.off("group:dissolved");
      socket.off("group:member_left");
      socket.off("conversation:lastMessage", handleLastMessage);
      socket.off("user:privacy_changed", handlePrivacyChanged);
      socket.off("conversation:id_updated");
      socket.off("friend:request_accepted");
      socket.off("conversation:read_by");
      socket.off("conversation:kicked");
    };
  }, [socket, loadConversations, selectedConversation]);

  // 🎨 AUTO-SLIDE EVERY 5 SECONDS
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % WELCOME_SLIDES.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  // Thêm useEffect này vào ChatPage
  useEffect(() => {
    const handleFriendRemoved = (e) => {
      const { friendId, conversationId } = e.detail;

      // Xóa conversation khỏi danh sách
      setConversations((prev) => prev.filter((c) => c._id !== conversationId));

      // Nếu đang mở conversation đó thì đóng lại
      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(null);
      }

      // Xóa biệt danh
      localStorage.removeItem(`nickname_${conversationId}`);
      localStorage.removeItem(`nickname_user_${friendId}`);
    };

    window.addEventListener("friend:removed", handleFriendRemoved);
    return () =>
      window.removeEventListener("friend:removed", handleFriendRemoved);
  }, [selectedConversation]);

  useEffect(() => {
    const handleFriendAccepted = (e) => {
      const { fromUserId } = e.detail || {};
      // Xóa tất cả deletedIds để conversation hiện lại
      // (không biết convId nên reload sạch conversations từ server)
      loadConversations();
    };
    window.addEventListener("friend:accepted", handleFriendAccepted);
    return () =>
      window.removeEventListener("friend:accepted", handleFriendAccepted);
  }, [loadConversations]);

  // Thay toàn bộ useEffect handler user:avatar_updated:
  useEffect(() => {
    const handler = (e) => {
      const { userId, avatar } = e.detail;

      // Cập nhật conversations
      setConversations((prev) =>
        prev.map((conv) => ({
          ...conv,
          participants: conv.participants?.map((p) =>
            p._id?.toString() === userId ? { ...p, avatar } : p,
          ),
        })),
      );

      // Cập nhật selectedConversation
      setSelectedConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants?.map((p) =>
            p._id?.toString() === userId ? { ...p, avatar } : p,
          ),
        };
      });

      // ✅ THÊM: Nếu là chính mình thì cập nhật AuthContext
      if (userId === user?._id?.toString()) {
        const storage = localStorage.getItem("currentUser")
          ? localStorage
          : sessionStorage;
        const stored = JSON.parse(storage.getItem("currentUser") || "{}");
        const newUser = { ...stored, avatar };
        storage.setItem("currentUser", JSON.stringify(newUser));
        const token =
          localStorage.getItem("accessToken") ||
          sessionStorage.getItem("accessToken");
        const expiresAt =
          localStorage.getItem("accessTokenExpiresAt") ||
          sessionStorage.getItem("accessTokenExpiresAt");
        login({ user: newUser, token, expiresAt: Number(expiresAt) });
      }
    };

    window.addEventListener("user:avatar_updated", handler);
    return () => window.removeEventListener("user:avatar_updated", handler);
  }, [user?._id, login]);

  // Luôn lấy từ conversations list để đảm bảo real-time
  const currentConversation =
    conversations.find((c) => c._id === selectedConversation?._id) ||
    selectedConversation;

  const getHeaderName = () => {
    if (!currentConversation) return "";
    if (currentConversation.type === "mydoc") return "My Document";
    if (currentConversation.type === "group") return currentConversation.name;
    const other = currentConversation.participants?.find(
      (p) => p._id !== user?._id,
    );
    const nickname = localStorage.getItem(`nickname_user_${other?._id}`) || "";
    return nickname || other?.name || "Unknown";
  };

  const getHeaderAvatar = () => {
    if (!currentConversation) return "";
    if (currentConversation.type === "mydoc") return "";
    if (currentConversation.type === "group") return currentConversation.avatar;
    const other = currentConversation.participants?.find(
      (p) => p._id !== user?._id,
    );
    return (
      other?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=default"
    );
  };

  const getOtherUser = () => {
    if (
      !currentConversation ||
      currentConversation.type === "group" ||
      currentConversation.type === "mydoc"
    )
      return null;
    return currentConversation.participants?.find((p) => p._id !== user?._id);
  };

  const [isFriendWith, setIsFriendWith] = useState(null); // null=loading, true/false
  const [sendingFriendReq, setSendingFriendReq] = useState(false);
  const otherUserIdRef = React.useRef(null);
  const isFriendWithRef = React.useRef(null);
  const [isBlockedStranger, setIsBlockedStranger] = useState(false);

  useEffect(() => {
    isFriendWithRef.current = isFriendWith;
  }, [isFriendWith]);

  const otherUserId = getOtherUser()?._id?.toString();
  // Nếu chưa kết bạn → luôn hiển thị offline
  const isOtherOnline =
    otherUserId && isFriendWith === true ? onlineUsers.has(otherUserId) : false;

  useEffect(() => {
    if (
      !currentConversation ||
      currentConversation.type !== "private" ||
      currentConversation.type === "mydoc"
    ) {
      setIsFriendWith(null);
      return;
    }
    const other = getOtherUser();
    if (!other) return;
    api
      .get("/auth/friends")
      .then((res) => {
        const friends = res.data?.data?.friends || [];
        const isFriend = friends.some(
          (f) => (f._id || f)?.toString() === other._id?.toString(),
        );
        setIsFriendWith(isFriend);
        if (isFriend) setIsBlockedStranger(false); // THÊM DÒNG NÀY
      })
      .catch(() => setIsFriendWith(null));
  }, [selectedConversation?._id]);

  useEffect(() => {
    // THÊM: nếu đã là bạn bè thì không check privacy
    if (isFriendWith === true) {
      setIsBlockedStranger(false);
      return;
    }
    if (
      !currentConversation ||
      currentConversation.type !== "private" ||
      isFriendWith !== false
    ) {
      setIsBlockedStranger(false);
      return;
    }
    const other = getOtherUser();
    if (!other) return;
    api
      .get(`/auth/users/${other._id}/privacy`)
      .then((res) => {
        const allow = res.data?.data?.allowMessagesFrom;
        setIsBlockedStranger(allow === "contacts");
      })
      .catch(() => setIsBlockedStranger(false));
  }, [selectedConversation?._id, isFriendWith]);

  useEffect(() => {
    otherUserIdRef.current = getOtherUser()?._id?.toString();
  }, [selectedConversation?._id]);

  // THAY 2 HÀM CŨ - hỗ trợ cả 1-1 và nhóm
  const handleVoiceCall = () => {
    if (currentConversation?.isPreview) return;
    if (currentConversation?.type === "group") {
      startGroupCall(
        selectedConversation._id,
        "voice",
        currentConversation.name || "Nhóm",
      );
      return;
    }
    const otherUser = getOtherUser();
    if (!otherUser) return;
    startCall(otherUser, selectedConversation._id, "voice");
  };

  const handleVideoCall = () => {
    if (currentConversation?.isPreview) return;
    if (currentConversation?.type === "group") {
      startGroupCall(
        selectedConversation._id,
        "video",
        currentConversation.name || "Nhóm",
      );
      return;
    }
    const otherUser = getOtherUser();
    if (!otherUser) return;
    startCall(otherUser, selectedConversation._id, "video");
  };

  const handleToggleInfo = () => {
    setShowInfoSidebar(!showInfoSidebar);
  };

  const handleCreateGroup = () => {
    setShowCreateGroup(true);
  };

  const handleSelectConversation = (conversation) => {
    sessionStorage.removeItem(`marked_read_${conversation._id}`);
    setFriendReqSent(false);
    setShowMessageSearch(false);
    setShowInfoSidebar(true);
    // Xóa manual unread khi đọc
    const key = `manual_unread_${user?._id}`;
    const stored = JSON.parse(localStorage.getItem(key) || "[]");
    localStorage.setItem(
      key,
      JSON.stringify(stored.filter((id) => id !== conversation._id)),
    );
    setConversations((prev) =>
      prev.map((c) =>
        c._id === conversation._id
          ? { ...c, unreadCount: 0, isManualUnread: false }
          : c,
      ),
    );
    // Chỉ reset unread trong state local, KHÔNG emit conversation:read ở đây
    // MessageList sẽ emit khi user thực sự scroll đọc
    setSelectedConversation({
      ...conversation,
      unreadCount: 0,
      isManualUnread: false,
    });
    setPinnedMessage(null);
    setReplyTo(null);
    setEditMessage(null);
  };

  const handleJumpToMessage = (conversationId, messageId) => {
    const conv = conversations.find((c) => c._id === conversationId);
    if (conv) {
      handleSelectConversation(conv);
      setTimeout(() => {
        const el = document.getElementById(`message-${messageId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("highlight");
          setTimeout(() => el.classList.remove("highlight"), 2000);
        }
      }, 500);
    }
  };

  const handlePinConversation = async (conversation) => {
    try {
      let isPinned = !conversation.isPinned;
      try {
        const result = await conversationService.togglePin(conversation._id);
        isPinned = result.isPinned;
      } catch {}

      setConversations((prev) => {
        const updated = prev.map((c) =>
          c._id === conversation._id ? { ...c, isPinned } : c,
        );
        return [
          ...updated.filter((c) => c.isPinned),
          ...updated.filter((c) => !c.isPinned),
        ];
      });
    } catch (err) {
      console.error("Pin error:", err);
    }
  };

  const handleMarkUnread = (conversation) => {
    const key = `manual_unread_${user?._id}`;
    const stored = JSON.parse(localStorage.getItem(key) || "[]");
    const isCurrentlyUnread = conversation.isManualUnread;
    const updated = isCurrentlyUnread
      ? stored.filter((id) => id !== conversation._id)
      : [...new Set([...stored, conversation._id])];
    localStorage.setItem(key, JSON.stringify(updated));

    setConversations((prev) =>
      prev.map((c) =>
        c._id === conversation._id
          ? { ...c, isManualUnread: !c.isManualUnread }
          : c,
      ),
    );
  };

  const handleMuteConversation = async (conversation, mutedUntil) => {
    try {
      const result = await conversationService.toggleMute(
        conversation._id,
        mutedUntil,
      );
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversation._id ? { ...c, isMuted: !c.isMuted } : c,
        ),
      );
    } catch (err) {
      alert("Mute ERROR: " + err.message);
      console.error("Mute error:", err);
    }
  };

  const handleDeleteConversation = async (conversation) => {
    try {
      await conversationService.deleteConversation(conversation._id);
    } catch (err) {
      console.error("Delete error:", err);
    }

    // ✅ Lưu vào localStorage để persist qua reload
    addDeletedId(conversation._id);

    // Đánh dấu isDeleted
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c._id === conversation._id
          ? { ...c, isDeleted: true, lastMessage: null, unreadCount: 0 }
          : c,
      );

      // Nếu đang mở conversation bị xóa → chuyển sang conversation gần nhất
      if (selectedConversation?._id === conversation._id) {
        // Lấy danh sách các conversation còn lại (chưa bị xóa)
        const remaining = updated.filter((c) => !c.isDeleted);
        // Tìm vị trí của conversation vừa xóa trong danh sách gốc
        const deletedIdx = prev.findIndex((c) => c._id === conversation._id);

        // Ưu tiên conversation ngay phía trên (index nhỏ hơn)
        let next = null;
        for (let i = deletedIdx - 1; i >= 0; i--) {
          if (!prev[i].isDeleted) {
            next = prev[i];
            break;
          }
        }
        // Nếu không có phía trên → lấy phía dưới
        if (!next) {
          for (let i = deletedIdx + 1; i < prev.length; i++) {
            if (!prev[i].isDeleted) {
              next = prev[i];
              break;
            }
          }
        }

        if (next) {
          // Dùng setTimeout để đợi state conversations cập nhật xong
          setTimeout(() => {
            handleSelectConversation(next);
          }, 0);
        } else {
          setSelectedConversation(null);
        }
      }

      return updated;
    });
  };

  const handleAddToGroup = (conversation) => {
    setAddToGroupConversation(conversation);
  };

  const handleMarkAllRead = () => {
    setConversations((prev) =>
      prev.map((c) => ({ ...c, unreadCount: 0, isManualUnread: false })),
    );
    setShowMarkReadDialog(false);
    setShowMoreMenu(false);
  };

  const handleSelectFromSearch = (conversation) => {
    // Lưu vào lịch sử tìm kiếm
    const name =
      conversation.name ||
      conversation.participants?.find((p) => p._id !== user?._id)?.name ||
      "";
    const historyItem = {
      _id: conversation._id,
      name,
      avatar: conversation.avatar || "",
    };

    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h._id !== conversation._id);
      const updated = [historyItem, ...filtered].slice(0, 8);
      localStorage.setItem(
        `search_history_${user?._id}`,
        JSON.stringify(updated),
      );
      return updated;
    });

    // Mở conversation nhưng KHÔNG thay đổi danh sách
    setShowSearchDropdown(false);
    setSearchText("");
    handleSelectConversation(conversation);
  };

  const handleRemoveHistory = (e, id) => {
    e.stopPropagation();
    setSearchHistory((prev) => {
      const updated = prev.filter((h) => h._id !== id);
      localStorage.setItem(
        `search_history_${user?._id}`,
        JSON.stringify(updated),
      );
      return updated;
    });
  };

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conv) => {
        if (conv.isDeleted) return false;
        if (activeFilter === "unread") {
          const lastSenderId =
            conv.lastMessage?.senderId?._id?.toString() ||
            conv.lastMessage?.senderId?.toString();
          if (!(conv.unreadCount > 0) || lastSenderId === user?._id?.toString())
            return false;
        }
        return true;
      }),
    [conversations, activeFilter, user?._id],
  );

  // Thêm helper function này trong ChatPage, trước return
  const getConvDisplayInfo = (conv) => {
    if (conv.type === "group") {
      return {
        name: conv.name || "Nhóm",
        avatar: null, // null = dùng GroupAvatar
        participants: conv.participants || [],
        isGroup: true,
      };
    }
    const other = conv.participants?.find(
      (p) => p._id?.toString() !== user?._id?.toString(),
    );
    const nickname = localStorage.getItem(`nickname_user_${other?._id}`) || "";
    return {
      name: nickname || other?.name || "Unknown",
      avatar:
        other?.avatar ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${other?._id}`,
      participants: [],
      isGroup: false,
    };
  };

  const handleMessageSent = (msg) => {
    setConversations((prev) => {
      const idx = prev.findIndex(
        (c) => c._id?.toString() === msg.conversationId?.toString(),
      );
      if (idx === -1) return prev;
      const updated = [...prev];
      const conv = { ...updated[idx] };
      conv.lastMessage = {
        _id: msg._id,
        content: msg.content,
        type: msg.type,
        senderId: msg.senderId,
        createdAt: msg.createdAt,
      };
      updated.splice(idx, 1);
      updated.unshift(conv);
      return updated;
    });
  };

  return (
    <div
      className={`chat-page-zalo ${selectedConversation ? "has-active-chat" : ""}`}
    >
      {/* LEFT SIDEBAR */}
      <div className="left-sidebar-simple">
        <div className="sidebar-avatar-section">
          <div
            className="sidebar-user-avatar-wrap"
            onClick={() => setShowProfile(true)}
            title={user?.name}
          >
            <UserAvatar name={user?.name} avatar={user?.avatar} size={40} />
            <span className="sidebar-online-dot" />
          </div>
        </div>
        <div className="sidebar-divider" />
        <div className="sidebar-main-icons">
          <button
            className={`sidebar-icon-btn ${activeTab === "messages" ? "active" : ""}`}
            onClick={() => setActiveTab("messages")}
            data-tooltip="Tin nhắn"
          >
            <SidebarChatIcon />
          </button>

          <button
            className={`sidebar-icon-btn ${activeTab === "contacts" ? "active" : ""}`}
            onClick={() => setActiveTab("contacts")}
            data-tooltip="Danh bạ"
          >
            <SidebarContactsIcon />
          </button>

          <button
            className={`sidebar-icon-btn ${showStarred ? "active" : ""}`}
            onClick={() => setShowStarred(true)}
            data-tooltip="Tin nhắn đã đánh dấu"
          >
            <SidebarStarIcon />
          </button>
        </div>

        <div className="sidebar-settings-section">
          <button
            className="sidebar-icon-btn"
            data-tooltip="Cài đặt"
            onClick={() => setShowSettings(true)}
          >
            <SidebarSettingsIcon />
          </button>
        </div>
      </div>

      {/* MIDDLE PANEL */}
      <div
        className="middle-panel-zalo"
        style={{ display: activeTab === "contacts" ? "none" : "flex" }}
      >
        <div className="middle-panel-header-zalo">
          <div className="search-box-bright" style={{ position: "relative" }}>
            <SearchIcon size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              onBlur={() => setTimeout(() => setShowSearchDropdown(false), 150)}
            />
            {searchText && (
              <button
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#999",
                  padding: 0,
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSearchText("");
                }}
              >
                ✕
              </button>
            )}

            {showSearchDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  right: 0,
                  background: "#fff",
                  borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                  zIndex: 1000,
                  maxHeight: 360,
                  overflowY: "auto",
                  padding: "8px 0",
                }}
              >
                {searchText.trim() ? (
                  <>
                    {conversations
                      .filter((c) => {
                        const name =
                          c.name ||
                          c.participants?.find(
                            (p) => p._id?.toString() !== user?._id?.toString(),
                          )?.name ||
                          "";
                        return name
                          .toLowerCase()
                          .includes(searchText.toLowerCase());
                      })
                      .slice(0, 8)
                      .map((conv) => {
                        const info = getConvDisplayInfo(conv);
                        return (
                          <div
                            key={conv._id}
                            onMouseDown={() => handleSelectFromSearch(conv)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 16px",
                              cursor: "pointer",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "#f0f2f5")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                          >
                            <SearchIcon
                              size={14}
                              style={{ color: "#999", flexShrink: 0 }}
                            />
                            {info.isGroup ? (
                              <div
                                style={{ width: 32, height: 32, flexShrink: 0 }}
                              >
                                <GroupAvatar
                                  participants={info.participants}
                                  size={32}
                                />
                              </div>
                            ) : (
                              <UserAvatar
                                name={info.name}
                                avatar={info.avatar}
                                size={32}
                                style={{ flexShrink: 0 }}
                              />
                            )}
                            <span
                              style={{
                                fontSize: 14,
                                color: "#1c1e21",
                                flex: 1,
                              }}
                            >
                              {info.name}
                            </span>
                          </div>
                        );
                      })}
                    {conversations.filter((c) => {
                      const name =
                        c.name ||
                        c.participants?.find(
                          (p) => p._id?.toString() !== user?._id?.toString(),
                        )?.name ||
                        "";
                      return name
                        .toLowerCase()
                        .includes(searchText.toLowerCase());
                    }).length === 0 && (
                      <div
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          color: "#999",
                          fontSize: 13,
                        }}
                      >
                        Không tìm thấy kết quả
                      </div>
                    )}
                  </>
                ) : searchHistory.length > 0 ? (
                  <>
                    <div
                      style={{
                        padding: "6px 16px 4px",
                        fontSize: 12,
                        color: "#999",
                        fontWeight: 600,
                      }}
                    >
                      Tìm kiếm gần đây
                    </div>
                    {searchHistory.map((item) => {
                      const conv = conversations.find(
                        (c) => c._id === item._id,
                      );
                      const info = conv ? getConvDisplayInfo(conv) : null;
                      return (
                        <div
                          key={item._id}
                          onMouseDown={() =>
                            conv && handleSelectFromSearch(conv)
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 16px",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#f0f2f5")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          {info?.isGroup ? (
                            <div
                              style={{ width: 32, height: 32, flexShrink: 0 }}
                            >
                              <GroupAvatar
                                participants={info.participants}
                                size={32}
                              />
                            </div>
                          ) : (
                            <UserAvatar
                              name={info?.name || item.name}
                              avatar={info?.avatar || item.avatar}
                              size={32}
                              style={{ flexShrink: 0 }}
                            />
                          )}
                          <span
                            style={{ fontSize: 14, color: "#1c1e21", flex: 1 }}
                          >
                            {info?.name || item.name}
                          </span>
                          <button
                            onMouseDown={(e) =>
                              handleRemoveHistory(e, item._id)
                            }
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#bbb",
                              fontSize: 14,
                              padding: "0 4px",
                              flexShrink: 0,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </>
                ) : null}
              </div>
            )}
          </div>

          <div className="header-actions-zalo">
            <button
              className={`header-icon-btn-round ${showAddFriend ? "active" : ""}`}
              onClick={() => setShowAddFriend((v) => !v)}
              data-tooltip="Thêm bạn / Lời mời"
              style={{ position: "relative" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              {/* Badge lời mời */}
              {pendingFriendRequests?.length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    background: "#e53935",
                    color: "#fff",
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  {pendingFriendRequests.length}
                </span>
              )}
            </button>
            <button
              className="header-icon-btn-round"
              onClick={handleCreateGroup}
              data-tooltip="Tạo nhóm"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </button>
          </div>
        </div>

        {showAddFriend && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowAddFriend(false)}
          >
            <div
              style={{
                background: "var(--bg-primary,#fff)",
                borderRadius: 12,
                width: 420,
                maxWidth: "90vw",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border-color,#e4e6eb)",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 16 }}>Kết bạn</span>
                <button
                  onClick={() => setShowAddFriend(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 20,
                    cursor: "pointer",
                    color: "var(--text-secondary,#888)",
                  }}
                >
                  ✕
                </button>
              </div>
              <AddFriend
                onConversationCreated={(conv) => {
                  setConversations((prev) => {
                    const exists = prev.some((c) => c._id === conv._id);
                    return exists ? prev : [conv, ...prev];
                  });
                  setShowAddFriend(false);
                }}
                conversations={conversations}
                onStartChat={(conv) => {
                  setShowAddFriend(false);
                  setActiveTab("messages");
                  handleSelectConversation(conv);
                }}
                onViewProfile={(u) => {
                  setShowAddFriend(false);
                  setActiveTab("messages");
                  // Tạo conversation giả để hiển thị đúng layout
                  setSelectedConversation({
                    _id: `preview_${u._id}`,
                    type: "private",
                    isPreview: true,
                    participants: [
                      u,
                      {
                        _id: user?._id,
                        name: user?.name,
                        avatar: user?.avatar,
                      },
                    ],
                  });
                  setIsFriendWith(false);
                  setPreviewUser(u);
                }}
              />
            </div>
          </div>
        )}

        <div className="tabs-filter-row">
          <div className="conversation-tabs-large">
            <button
              className={`tab-btn-large ${activeFilter === "all" ? "active" : ""}`}
              onClick={() => setActiveFilter("all")}
            >
              Tất cả
            </button>
            <button
              className={`tab-btn-large ${activeFilter === "unread" ? "active" : ""}`}
              onClick={() => setActiveFilter("unread")}
            >
              Chưa đọc
              {conversations.filter((c) => {
                const lastSenderId =
                  c.lastMessage?.senderId?._id?.toString() ||
                  c.lastMessage?.senderId?.toString();
                return (
                  c.unreadCount > 0 && lastSenderId !== user?._id?.toString()
                );
              }).length > 0 && (
                <span className="tab-unread-count">
                  {
                    conversations.filter((c) => {
                      const lastSenderId =
                        c.lastMessage?.senderId?._id?.toString() ||
                        c.lastMessage?.senderId?.toString();
                      return (
                        c.unreadCount > 0 &&
                        lastSenderId !== user?._id?.toString()
                      );
                    }).length
                  }
                </span>
              )}
            </button>
          </div>

          <div className="filter-actions">
            <div className="more-menu-container">
              <button
                className="more-options-btn"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                title="Thêm"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>

              {showMoreMenu && (
                <>
                  <div
                    className="menu-backdrop"
                    onClick={() => setShowMoreMenu(false)}
                  ></div>
                  <div className="more-dropdown-menu">
                    <button
                      className="menu-item"
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowMarkReadDialog(true);
                      }}
                    >
                      <CheckIcon size={18} />
                      <span>Đánh dấu đã đọc</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <ConversationList
          conversations={filteredConversations}
          selectedId={selectedConversation?._id}
          onSelect={handleSelectConversation}
          loading={loading}
          onPin={handlePinConversation}
          onMarkUnread={handleMarkUnread}
          onMute={handleMuteConversation}
          onDelete={handleDeleteConversation}
          onAddToGroup={handleAddToGroup}
        />
      </div>

      {/* RIGHT PANEL - CONTACTS */}
      {activeTab === "contacts" && (
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gridColumn: "2 / -1",
          }}
        >
          <ContactsPage
            onlineUsers={onlineUsers}
            onStartChat={(friend) => {
              const conv = conversations.find(
                (c) =>
                  c.type === "private" &&
                  c.participants?.some((p) => (p._id || p) === friend._id),
              );
              if (conv) {
                setActiveTab("messages");
                handleSelectConversation(conv);
              } else {
                setActiveTab("messages");
              }
            }}
          />
        </div>
      )}

      {/* RIGHT PANEL - CHAT */}
      <div
        className={`right-panel ${showInfoSidebar ? "with-info-sidebar" : ""}`}
        style={{ display: activeTab === "contacts" ? "none" : undefined }}
      >
        {selectedConversation ? (
          <>
            <ChatHeader
              name={getHeaderName()}
              avatar={getHeaderAvatar()}
              status={isOtherOnline ? "online" : "offline"}
              isGroup={selectedConversation.type === "group"}
              isMyDoc={selectedConversation.type === "mydoc"}
              memberCount={selectedConversation.participants?.length}
              participants={currentConversation.participants || []}
              onVoiceCall={handleVoiceCall}
              onVideoCall={handleVideoCall}
              onToggleInfo={handleToggleInfo}
              showInfoSidebar={showInfoSidebar}
              onSearch={() => setShowMessageSearch(true)}
              onAddMember={() => setShowAddMember(true)}
              isDissolved={!!currentConversation?.isDissolved}
              isPreview={!!currentConversation?.isPreview}
              onBack={() => setSelectedConversation(null)}
            />

            {/* Banner chưa kết bạn */}
            {currentConversation?.type === "private" &&
              isFriendWith === false && (
                <div
                  style={{
                    background: "#fff8e1",
                    borderBottom: "1px solid #ffe082",
                    padding: "8px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 13,
                    color: "#5d4037",
                    flexShrink: 0,
                  }}
                >
                  <span>
                    Bạn và <strong>{getHeaderName()}</strong> chưa kết bạn. Hãy
                    kết bạn để trở thành bạn bè.
                  </span>
                  <button
                    onClick={async () => {
                      const other = getOtherUser();
                      if (!other) return;
                      setSendingFriendReq(true);
                      try {
                        await api.post("/auth/friends/send-request", {
                          targetUserId: other._id,
                        });
                        setFriendReqSent(true); // dùng state riêng, KHÔNG đổi isFriendWith
                      } catch (e) {
                        alert(e.response?.data?.message || "Lỗi gửi lời mời");
                      } finally {
                        setSendingFriendReq(false);
                      }
                    }}
                    disabled={sendingFriendReq || friendReqSent}
                    style={{
                      background: "#1a73e8",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      flexShrink: 0,
                      marginLeft: 12,
                    }}
                  >
                    {friendReqSent
                      ? "Đã gửi lời mời"
                      : sendingFriendReq
                        ? "Đang gửi..."
                        : "Kết bạn"}
                  </button>
                </div>
              )}

            {pinnedMessage && (
              <div
                className="pinned-bar"
                onClick={() => {
                  if (pinnedMessage?._id) {
                    const el = document.getElementById(
                      `message-${pinnedMessage._id}`,
                    );
                    if (el) {
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                      el.classList.add("highlight");
                      setTimeout(() => el.classList.remove("highlight"), 2000);
                    }
                  }
                }}
              >
                <div className="pinned-bar-line" />
                <div className="pinned-bar-content">
                  <span className="pinned-bar-label">
                    📌{" "}
                    {(() => {
                      const sid =
                        pinnedMessage.senderId?._id?.toString() ||
                        (typeof pinnedMessage.senderId === "string"
                          ? pinnedMessage.senderId
                          : null);
                      return (
                        (sid && localStorage.getItem(`nickname_user_${sid}`)) ||
                        pinnedMessage.senderId?.name ||
                        "Người dùng"
                      );
                    })()}
                  </span>
                  <span className="pinned-bar-text">
                    {pinnedMessage.type === "text"
                      ? pinnedMessage.content
                      : pinnedMessage.type === "image" ||
                          pinnedMessage.type === "images"
                        ? "[Hình ảnh]"
                        : pinnedMessage.type === "file"
                          ? `[File] ${pinnedMessage.fileName || ""}`
                          : pinnedMessage.type === "voice"
                            ? "[Tin nhắn thoại]"
                            : "[Tin nhắn]"}
                  </span>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </div>
            )}
            <MessageList
              key={selectedConversation._id}
              isDissolved={currentConversation?.isDissolved}
              conversationId={selectedConversation._id}
              participants={currentConversation?.participants || []}
              wallpaper={
                wallpaperMap[selectedConversation?._id] !== undefined
                  ? wallpaperMap[selectedConversation?._id]
                  : localStorage.getItem(
                      `wallpaper_${selectedConversation?._id}`,
                    ) || ""
              }
              conversationName={getHeaderName()}
              isGroup={selectedConversation.type === "group"}
              onReply={(msg) => setReplyTo(msg)}
              onEdit={(msg) => setEditMessage(msg)}
              onPinnedChange={(msg) => setPinnedMessage(msg)}
              searchQuery={messageSearchQuery}
              showSearch={showMessageSearch}
              onCloseSearch={() => setShowMessageSearch(false)}
              onMessagesLoaded={(msgs) => setCurrentMessages(msgs)}
              onOptimisticRef={optimisticRef}
            />

            <MessageInput
              conversationId={selectedConversation._id}
              disabled={
                currentConversation?.isDissolved
                  ? "dissolved"
                  : isBlockedStranger === true
                    ? "blocked_stranger"
                    : currentConversation?.isPreview &&
                        isBlockedStranger === null
                      ? "preview"
                      : false
              }
              blockedByName={getHeaderName()}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              editMessage={editMessage}
              onCancelEdit={() => setEditMessage(null)}
              currentUser={user}
              onOptimisticMessage={(msg) => optimisticRef.current?.(msg)}
              onMessageSent={handleMessageSent}
            />
          </>
        ) : (
          <div className="welcome-carousel-container">
            <div className="carousel-wrapper">
              {/* SLIDES */}
              <div
                className="slides-container"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {WELCOME_SLIDES.map((slide) => (
                  <div key={slide.id} className="slide">
                    <div
                      className="slide-icon"
                      style={{ background: slide.gradient }}
                    >
                      <span>{slide.icon}</span>
                    </div>
                    <h2 className="slide-title">{slide.title}</h2>
                    <p className="slide-description">{slide.description}</p>
                  </div>
                ))}
              </div>

              {/* DOTS INDICATOR */}
              <div className="dots-indicator">
                {WELCOME_SLIDES.map((_, index) => (
                  <button
                    key={index}
                    className={`dot ${index === currentSlide ? "active" : ""}`}
                    onClick={() => setCurrentSlide(index)}
                    aria-label={`Đến slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* BRANDING */}
            <div className="welcome-branding">
              <p>Bắt đầu trò chuyện ngay bây giờ</p>
            </div>
          </div>
        )}
      </div>

      {/* INFO SIDEBAR */}
      {showInfoSidebar && selectedConversation && activeTab !== "contacts" && (
        <ConversationInfo
          dimmed={showMessageActions}
          conversation={currentConversation}
          otherUser={getOtherUser()}
          isGroup={currentConversation.type === "group"}
          isMyDoc={currentConversation.type === "mydoc"}
          onClose={handleToggleInfo}
          onVoiceCall={handleVoiceCall}
          onVideoCall={handleVideoCall}
          messages={currentMessages}
          socket={socket}
          conversationId={selectedConversation._id}
          onMessageClick={(msgId) => {
            const el = document.getElementById(`message-${msgId}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("highlight");
              setTimeout(() => el.classList.remove("highlight"), 2000);
            }
          }}
          onMute={handleMuteConversation}
          onDelete={handleDeleteConversation}
          onPin={handlePinConversation}
          status={isOtherOnline ? "online" : "offline"}
          isDissolved={!!currentConversation?.isDissolved}
          isPreview={!!currentConversation?.isPreview}
        />
      )}

      {/* MARK ALL READ DIALOG */}
      {showMarkReadDialog && (
        <>
          <div
            className="dialog-backdrop"
            onClick={() => setShowMarkReadDialog(false)}
          ></div>
          <div className="confirmation-dialog">
            <div className="dialog-content">
              <h3>Đánh dấu đã đọc</h3>
              <p>
                Toàn bộ tin nhắn sẽ được đánh dấu là đã đọc. Bạn có muốn tiếp
                tục?
              </p>
              <div className="dialog-actions">
                <button
                  className="btn-cancel"
                  onClick={() => setShowMarkReadDialog(false)}
                >
                  Không
                </button>
                <button className="btn-confirm" onClick={handleMarkAllRead}>
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showStarred && (
        <StarredMessages
          onClose={() => setShowStarred(false)}
          onJumpToMessage={handleJumpToMessage}
        />
      )}
      {addToGroupConversation && (
        <ForwardModal
          message={{
            _id: addToGroupConversation._id,
            type: "text",
            content: "Thêm vào nhóm",
          }}
          onClose={() => setAddToGroupConversation(null)}
          onSuccess={() => setAddToGroupConversation(null)}
          title="Thêm vào nhóm"
        />
      )}
      {showCreateGroup && (
        <CreateGroupModal
          currentUser={user}
          onClose={() => setShowCreateGroup(false)}
          onSuccess={() => {
            setShowCreateGroup(false);
            loadConversations();
          }}
        />
      )}
      {showAddMember && selectedConversation && (
        <AddMemberModal
          conversation={currentConversation}
          onClose={() => setShowAddMember(false)}
          currentUser={user}
        />
      )}

      {/* CALL MODALS */}
      <CallModal />
      <GroupCallModal />
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default ChatPage;
