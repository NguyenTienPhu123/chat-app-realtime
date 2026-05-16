import React, { useEffect, useState, useRef } from "react";
import MessageActions from "./MessageActions";
import { useAuth } from "../../hooks/useAuth";
import { useSocket } from "../../hooks/useSocket";
import { useWebRTC } from "../../hooks/useWebRTC";
import { formatMessageTime } from "../../utils/date.util";
import FilePreview from "./FilePreview";
import CallMessage from "./CallMessage";
import UserAvatar from "./UserAvatar";

import {
  PinBadgeIcon,
  DeliveredIcon,
  SentIcon,
  SendingIcon,
} from "../../icons";
import "./MessageBubble.css";

const REACTIONS = ["👍", "❤️", "😂", "😢", "😮", "😡"];

const MessageBubble = ({
  message,
  showAvatar,
  isLastInGroup,
  isLastMessage,
  isLastOwnMessage,
  isGroup,
  onImageClick,
  onReply,
  onEdit,
  onForward,
  onPin,
  isSelectMode,
  isSelected,
  onSelect,
  onEnterSelectMode,
  conversationId,
  participants = [],
}) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { startCall } = useWebRTC();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showReactionPopup, setShowReactionPopup] = useState(false);
  const [readBy, setReadBy] = useState(message.readBy || []);
  const hasEmittedRead = useRef(false); // ✅ chống emit nhiều lần

  useEffect(() => {
    setReadBy(message.readBy || []);
  }, [message.readBy]);

  const [showReactionModal, setShowReactionModal] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const reactionTimerRef = useRef(null);
  const dropdownRef = useRef(null);

  const handleImageCopy = async (e, imageUrl) => {
    e.preventDefault();
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const getSenderId = (senderData) => {
    if (!senderData) return null;
    if (typeof senderData === "object" && senderData._id)
      return String(senderData._id);
    return String(senderData);
  };

  const messageSenderId = getSenderId(message.senderId);
  const currentUserId = String(user?._id);
  const isOwn = messageSenderId === currentUserId;

  // ✅ Emit read - chỉ emit 1 lần duy nhất khi component mount
  useEffect(() => {
    if (isOwn) return;
    if (hasEmittedRead.current) return;
    if (!socket?.connected) return;

    hasEmittedRead.current = true;
    socket.emit("message:status", {
      messageId: message._id.toString(),
      status: "read",
    });
  }, [socket?.connected]);

  // Nếu đã có readBy thì coi như đã read ngay từ đầu
  const [currentStatus, setCurrentStatus] = useState(() => {
    const readers = (message.readBy || []).filter((r) => {
      const uid = r.userId?._id?.toString() || r.userId?.toString();
      return uid && uid !== String(user?._id);
    });
    if (readers.length > 0) return "read";
    // Nếu status từ server đã là delivered hoặc read thì dùng luôn
    if (message.status === "delivered" || message.status === "read") {
      return message.status;
    }
    return message.status || "sent";
  });

  useEffect(() => {
    // Kiểm tra readBy trước
    const readers = (message.readBy || []).filter((r) => {
      const uid = r.userId?._id?.toString() || r.userId?.toString();
      return uid && uid !== String(user?._id);
    });
    if (readers.length > 0) {
      setCurrentStatus("read");
      return;
    }
    const statusPriority = { sending: 0, sent: 1, delivered: 2, read: 3 };
    setCurrentStatus((prev) => {
      const newPriority = statusPriority[message.status] ?? 0;
      const prevPriority = statusPriority[prev] ?? 0;
      return newPriority > prevPriority ? message.status : prev;
    });
  }, [message.status, message.readBy]);

  // Lắng nghe readBy updates từ socket
  useEffect(() => {
    if (!socket || !isOwn) return;
    const handleStatusUpdate = ({ messageId, status, readBy: newReader }) => {
      if (messageId !== message._id.toString()) return;

      if (status === "read" && newReader) {
        setReadBy((prev) => {
          const exists = prev.some(
            (r) =>
              (r.userId?._id || r.userId)?.toString() ===
              newReader.userId?.toString(),
          );
          if (exists) return prev;
          return [...prev, newReader];
        });
        // Nhảy thẳng lên read, bỏ qua delivered
        setCurrentStatus("read");
      }
      if (status === "delivered") {
        setCurrentStatus((prev) => (prev === "read" ? "read" : "delivered"));
      }
    };
    socket.on("message:status", handleStatusUpdate);
    return () => socket.off("message:status", handleStatusUpdate);
  }, [socket, message._id, isOwn]);

  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e) => {
      if (!e.target.closest(".message-inline-actions")) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown]);

  const handleReaction = (emoji) => {
    if (socket?.connected) {
      socket.emit("message:reaction:add", { messageId: message._id, emoji });
    }
    setShowReactionPopup(false);
  };

  const handleCopy = async () => {
    const baseURL =
      import.meta.env.VITE_API_URL?.replace("/api", "") ||
      "http://localhost:5000";

    const buildUrl = (url) => {
      if (!url) return "";
      const fullUrl = url.startsWith("http") ? url : `${baseURL}${url}`;
      return encodeURI(decodeURI(fullUrl));
    };

    try {
      if (message.type === "text") {
        if (message.content)
          await navigator.clipboard.writeText(message.content);
      } else if (
        (message.type === "image" || message.type === "images") &&
        (message.fileUrl || message.images?.[0]?.url)
      ) {
        const rawUrl =
          message.type === "image" ? message.fileUrl : message.images[0].url;
        const fetchUrl = buildUrl(rawUrl);
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Fetch failed");
        const blob = await response.blob();
        const imgBitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = imgBitmap.width;
        canvas.height = imgBitmap.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imgBitmap, 0, 0);
        canvas.toBlob(async (pngBlob) => {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": pngBlob }),
          ]);
        }, "image/png");
      } else if (message.caption) {
        await navigator.clipboard.writeText(message.caption);
      } else if (message.fileName) {
        await navigator.clipboard.writeText(message.fileName);
      }
    } catch (err) {
      console.error("Copy error:", err);
    }
    setShowDropdown(false);
  };

  const handleDelete = () => {
    if (window.confirm("Xóa tin nhắn này?")) {
      if (socket?.connected)
        socket.emit("message:delete", { messageId: message._id });
    }
    setShowDropdown(false);
  };

  const handleRecall = () => {
    if (window.confirm("Thu hồi tin nhắn này?")) {
      if (socket?.connected)
        socket.emit("message:recall", { messageId: message._id });
    }
    setShowDropdown(false);
  };

  const renderTextWithLinks = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) =>
      part.match(urlRegex) ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="message-link"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  };

  const renderReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return null;

    const reactionCounts = {};
    message.reactions.forEach((r) => {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
    });

    const totalCount = message.reactions.length;
    const emojis = Object.keys(reactionCounts).slice(0, 3);

    return (
      <>
        <div
          className="reaction-summary"
          onClick={() => setShowReactionModal(true)}
        >
          <span className="reaction-emojis">
            {emojis.map((e) => (
              <span key={e}>{e}</span>
            ))}
          </span>
          <span className="reaction-total">{totalCount}</span>
        </div>
        {showReactionModal && (
          <div
            className="reaction-modal-backdrop"
            onClick={() => setShowReactionModal(false)}
          >
            <div
              className="reaction-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="reaction-modal-header">
                <span>Biểu cảm</span>
                <button onClick={() => setShowReactionModal(false)}>✕</button>
              </div>
              <div className="reaction-modal-body">
                <div className="reaction-modal-sidebar">
                  <div className="reaction-filter-item active">
                    Tất cả <span>{totalCount}</span>
                  </div>
                  {Object.entries(reactionCounts).map(([emoji, count]) => (
                    <div key={emoji} className="reaction-filter-item">
                      {emoji} <span>{count}</span>
                    </div>
                  ))}
                </div>
                <div className="reaction-modal-list">
                  {message.reactions.map((r, i) => (
                    <div key={i} className="reaction-user-item">
                      <UserAvatar
                        name={r.userId?.name}
                        avatar={r.userId?.avatar}
                        size={32}
                        className="reaction-user-avatar"
                      />
                      <span className="reaction-user-name">
                        {r.userId?.name || "Unknown"}
                      </span>
                      <span className="reaction-user-emojis">
                        {message.reactions
                          .filter(
                            (x) =>
                              (x.userId?._id || x.userId)?.toString() ===
                              (r.userId?._id || r.userId)?.toString(),
                          )
                          .map((x, j) => (
                            <span key={j}>{x.emoji}</span>
                          ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderReplyPreview = () => {
    if (!message.replyTo) return null;
    const replyMsg = message.replyTo;

    if (replyMsg.type === "images") return null;

    const getFullUrl = (url) => {
      if (!url) return "";
      if (url.startsWith("http")) return url;
      return `http://localhost:5000${url}`;
    };

    const showThumbnail = replyMsg.type === "image" && replyMsg.fileUrl;

    const replyText = () => {
      if (replyMsg.type === "image") {
        return replyMsg.caption || replyMsg.content || "";
      }
      if (replyMsg.type === "file")
        return "[File] " + (replyMsg.fileName || "");
      if (replyMsg.type === "voice") return "[Tin nhắn thoại]";
      if (replyMsg.type === "video") return "[Video]";
      return replyMsg.content || "";
    };

    return (
      <div
        className="reply-preview"
        onClick={() => {
          const el = document.getElementById(`message-${replyMsg._id}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("highlight");
            setTimeout(() => el.classList.remove("highlight"), 2000);
          }
        }}
      >
        <div className="reply-line"></div>
        {showThumbnail && (
          <img
            src={getFullUrl(replyMsg.fileUrl)}
            alt=""
            style={{
              width: 36,
              height: 36,
              borderRadius: 4,
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        )}
        <div className="reply-content">
          <span className="reply-sender">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ marginRight: 4, opacity: 0.7 }}
            >
              <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
            </svg>
            {(() => {
              const senderId =
                replyMsg.senderId?._id?.toString() ||
                replyMsg.senderId?.toString();
              return (
                localStorage.getItem(`nickname_user_${senderId}`) ||
                replyMsg.senderName ||
                replyMsg.senderId?.name ||
                "Người dùng"
              );
            })()}
          </span>
          <span className="reply-text">
            {showThumbnail
              ? "[Hình ảnh]" + (replyText() ? " " + replyText() : "")
              : replyText()}
          </span>
        </div>
      </div>
    );
  };

  const [showReadList, setShowReadList] = useState(false);

  const renderStatusBar = () => {
    if (!isOwn || !isLastOwnMessage) return null;

    const readers = (readBy || []).map((r) => {
      const uid = r.userId?._id?.toString() || r.userId?.toString() || r.userId;
      const realName = r.userId?.name || r.name || "Đã xem";
      return {
        userId: uid,
        avatar: r.userId?.avatar || r.avatar || "",
        name: localStorage.getItem(`nickname_user_${uid}`) || realName,
      };
    });

    const otherReaders = readers.filter((r) => r.userId !== currentUserId);

    return (
      <div className="message-status-bar" style={{ position: "relative" }}>
        {otherReaders.length > 0 && (
          <div className="status-item-read">
            <div
              className="status-avatars"
              onClick={() => setShowReadList((v) => !v)}
              style={{ cursor: "pointer" }}
            >
              {otherReaders.slice(0, 5).map((reader, idx) => (
                <div
                  key={idx}
                  className="status-avatar-wrap"
                  style={{ position: "relative", display: "inline-block" }}
                  title={reader.name}
                >
                  <UserAvatar
                    name={reader.name}
                    avatar={reader.avatar}
                    size={18}
                    className="status-avatar-large"
                    style={{
                      marginLeft: idx > 0 ? 0 : 0,
                      zIndex: otherReaders.length - idx,
                      display: "block",
                    }}
                  />
                </div>
              ))}
              {otherReaders.length > 5 && (
                <span className="status-more">+{otherReaders.length - 5}</span>
              )}
            </div>

            {/* Popup danh sách đã xem */}
            {showReadList && (
              <>
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 999,
                  }}
                  onClick={() => setShowReadList(false)}
                />
                <div className="read-list-popup">
                  <div className="read-list-header">
                    <span>Đã xem ({otherReaders.length})</span>
                    <button onClick={() => setShowReadList(false)}>✕</button>
                  </div>
                  <div className="read-list-body">
                    {otherReaders.map((reader, idx) => (
                      <div key={idx} className="read-list-item">
                        <UserAvatar
                          name={reader.name}
                          avatar={reader.avatar}
                          size={32}
                        />
                        <span>{reader.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {otherReaders.length === 0 && currentStatus === "delivered" && (
          <div className="status-item status-delivered">
            <DeliveredIcon />
            <span className="status-text">Đã nhận</span>
          </div>
        )}
        {otherReaders.length === 0 && currentStatus === "sent" && (
          <div className="status-item status-sent">
            <SentIcon />
            <span className="status-text">Đã gửi</span>
          </div>
        )}
        {otherReaders.length === 0 && currentStatus === "sending" && (
          <div className="status-item status-sending">
            <SendingIcon />
            <span className="status-text">Đang gửi...</span>
          </div>
        )}
      </div>
    );
  };

  const dropdownActions = isOwn
    ? [
        {
          label: "Trả lời",
          onClick: () => {
            onReply && onReply(message);
            setShowDropdown(false);
          },
        },
        {
          label: "Chia sẻ",
          onClick: () => {
            onForward && onForward(message);
            setShowDropdown(false);
          },
        },
        ...(["text", "image", "images"].includes(message.type)
          ? [{ label: "Sao chép", onClick: handleCopy }]
          : []),
        {
          label: "Ghim tin nhắn",
          onClick: () => {
            onPin && onPin(message);
            setShowDropdown(false);
          },
        },
        { label: "Đánh dấu tin nhắn", onClick: () => setShowDropdown(false) },
        { label: "Chọn nhiều tin nhắn", onClick: () => setShowDropdown(false) },
        { label: "Xem chi tiết", onClick: () => setShowDropdown(false) },
        { label: "Thu hồi", onClick: handleRecall, danger: true },
        { label: "Xóa chỉ ở phía tôi", onClick: handleDelete, danger: true },
      ]
    : [
        {
          label: "Trả lời",
          onClick: () => {
            onReply && onReply(message);
            setShowDropdown(false);
          },
        },
        {
          label: "Chia sẻ",
          onClick: () => {
            onForward && onForward(message);
            setShowDropdown(false);
          },
        },
        ...(message.type === "text"
          ? [{ label: "Sao chép", onClick: handleCopy }]
          : []),
        {
          label: "Ghim tin nhắn",
          onClick: () => {
            onPin && onPin(message);
            setShowDropdown(false);
          },
        },
        { label: "Đánh dấu tin nhắn", onClick: () => setShowDropdown(false) },
        { label: "Chọn nhiều tin nhắn", onClick: () => setShowDropdown(false) },
        { label: "Xem chi tiết", onClick: () => setShowDropdown(false) },
        { label: "Xóa chỉ ở phía tôi", onClick: handleDelete, danger: true },
      ];

  // ── System message (giữ nguyên) ────────────────────────────────────────────
  if (message.type === "system") {
    const personalizeContent = (content) => {
      if (!content || !user?.name) return content;
      let result = content;
      const userName = user.name;
      // Phải kiểm tra chính xác: sau tên phải là " đã " chứ không phải ký tự khác
      const exactPrefix = userName + " đã ";
      if (result.startsWith(exactPrefix)) {
        result = "Bạn đã " + result.slice(exactPrefix.length);
      }
      // Thay tên ở giữa câu — cũng phải đảm bảo khớp đúng từ
      result = result.replace(
        new RegExp(
          `(^| )${userName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( )`,
          "g",
        ),
        (match, before, after) => {
          // Nếu đây là chính mình thì thay bằng "Bạn"
          return before + "Bạn" + after;
        },
      );
      return result;
    };

    const renderSystemContent = (content) => {
      if (!content) return null;

      let displayContent = content;

      const getNickByUserId = (uid) => {
        if (!uid) return "";
        return localStorage.getItem(`nickname_user_${uid}`) || "";
      };

      if (message.changerId) {
        const isMe = message.changerId === user?._id?.toString();
        const nick1 = !isMe ? getNickByUserId(message.changerId) : "";
        const name1 = isMe
          ? "Bạn"
          : nick1 || message.changerName || "Người dùng";

        // Có targetId: 2 tên trong câu
        if (message.targetId) {
          const isMe2 = message.targetId === user?._id?.toString();
          const nick2 = !isMe2 ? getNickByUserId(message.targetId) : "";
          const name2 = isMe2
            ? "Bạn"
            : nick2 || message.targetName || "Người dùng";

          // Tách phần giữa 2 tên từ content gốc
          // VD: "A đã chuyển quyền trưởng nhóm cho B"
          // VD: "A đã bầu B làm phó nhóm"
          // VD: "A đã xóa phó nhóm B"
          const rawName1 = message.changerName || "";
          const rawName2 = message.targetName || "";
          let middle = content;
          if (rawName1 && rawName2) {
            const afterName1 = content.slice(rawName1.length);
            const beforeName2 = afterName1.slice(
              0,
              afterName1.lastIndexOf(rawName2),
            );
            const afterName2 = afterName1.slice(
              afterName1.lastIndexOf(rawName2) + rawName2.length,
            );
            return (
              <span>
                <strong>{name1}</strong>
                {beforeName2}
                <strong>{name2}</strong>
                {afterName2}
              </span>
            );
          }
        }

        // Chỉ 1 tên
        const daIdx = content.indexOf(" đã ");
        const duocIdx = content.indexOf(" được ");
        const splitIdx =
          daIdx !== -1 && duocIdx !== -1
            ? Math.min(daIdx, duocIdx)
            : daIdx !== -1
              ? daIdx
              : duocIdx;

        if (splitIdx === -1)
          return (
            <span>
              <strong>{name1}</strong>
            </span>
          );
        return (
          <span>
            <strong>{name1}</strong>
            {content.slice(splitIdx)}
          </span>
        );
      } else {
        let temp = content;
        const myName = user?.name || "";

        // Thay tên mình ở giữa câu — chỉ khi đứng trước động từ hành động
        if (
          myName &&
          (temp.includes(` ${myName} thêm `) ||
            temp.includes(` ${myName} mời `) ||
            temp.includes(` ${myName} xóa `) ||
            temp.includes(` ${myName} bầu `) ||
            temp.includes(` ${myName} kick `))
        ) {
          temp = temp.replace(` ${myName} `, " Bạn ");
        }

        // Thay tên mình ở đầu câu — chỉ khi sau tên là " đã " hoặc " được "
        if (
          myName &&
          (temp.startsWith(myName + " đã ") ||
            temp.startsWith(myName + " được "))
        ) {
          temp = "Bạn" + temp.slice(myName.length);
        }

        // Thay tên người khác bằng biệt danh nếu có
        for (const p of participants) {
          const pid = p._id?.toString();
          const pName = p.name || "";
          if (!pid || !pName || pid === user?._id?.toString()) continue;
          const nick = getNickByUserId(pid);
          if (!nick) continue;
          // Đầu câu
          if (temp.startsWith(pName + " ")) {
            temp = nick + temp.slice(pName.length);
          }
          // Giữa câu có dấu cách 2 bên
          if (temp.includes(` ${pName} `)) {
            temp = temp.replace(` ${pName} `, ` ${nick} `);
          }
          // Cuối câu
          if (temp.endsWith(` ${pName}`)) {
            temp = temp.slice(0, temp.length - pName.length - 1) + ` ${nick}`;
          }
        }

        displayContent = temp;
      }

      // Tìm vị trí tách: " đã " hoặc " được "
      const daIdx = displayContent.indexOf(" đã ");
      const duocIdx = displayContent.indexOf(" được ");

      // Ưu tiên vị trí xuất hiện sớm hơn
      const splitIdx =
        daIdx !== -1 && duocIdx !== -1
          ? Math.min(daIdx, duocIdx)
          : daIdx !== -1
            ? daIdx
            : duocIdx;

      if (splitIdx === -1) {
        return <span>{displayContent}</span>;
      }

      const namePart = displayContent.slice(0, splitIdx);
      const afterName = displayContent.slice(splitIdx); // " đã ..." hoặc " được ..."

      // Kiểm tra có tên thứ 2 không (sau " được " hoặc " bởi ")
      const secondSplitMatch = afterName.match(
        /^( được )(.+?)( thêm | mời | xóa | bầu | kick | vào | ra )/,
      );

      if (secondSplitMatch) {
        const connector = secondSplitMatch[1]; // " được "
        const name2 = secondSplitMatch[2]; // "Nguyễn Tiến Phú"
        const verb = secondSplitMatch[3]; // " thêm "
        const rest = afterName.slice(
          connector.length + name2.length + verb.length - 0,
        );
        // Tính phần còn lại chính xác
        const restFinal = afterName.slice(connector.length + name2.length);

        return (
          <span style={{ display: "inline" }}>
            <strong style={{ fontWeight: 700, display: "inline" }}>
              {namePart}
            </strong>
            {connector}
            <strong style={{ fontWeight: 700, display: "inline" }}>
              {name2}
            </strong>
            {restFinal}
          </span>
        );
      }

      // Chỉ có 1 tên
      return (
        <span style={{ display: "inline" }}>
          <strong style={{ fontWeight: 700, display: "inline" }}>
            {namePart}
          </strong>
          {afterName}
        </span>
      );
    };

    return (
      <div className="system-message">
        <span>
          {message.addedUserAvatar && (
            <UserAvatar
              name={message.changerName || ""}
              avatar={message.addedUserAvatar}
              size={18}
              style={{ flexShrink: 0, marginRight: 4 }}
            />
          )}
          {renderSystemContent(message.content)}
        </span>
      </div>
    );
  }

  // ── Call message (MỚI THÊM) ────────────────────────────────────────────────
  if (message.type === "call") {
    const convId =
      typeof message.conversationId === "object"
        ? message.conversationId?._id
        : message.conversationId || conversationId;

    return (
      <div
        className={`message-bubble ${isOwn ? "own" : "other"} ${showAvatar ? "show-avatar-gap" : ""}`}
        style={{ background: "transparent", boxShadow: "none" }}
      >
        {!isOwn && showAvatar && (
          <UserAvatar
            name={message.senderId?.name}
            avatar={message.senderId?.avatar}
            size={36}
            className="message-avatar"
          />
        )}
        {!isOwn && !showAvatar && <div className="message-avatar-spacer" />}

        <div className="message-content">
          <CallMessage
            message={message}
            isSelf={isOwn}
            onCallBack={() => {
              if (!convId) return;
              let target;
              if (isOwn) {
                // Tìm người kia trong participants
                target = participants?.find(
                  (p) => p._id?.toString() !== user?._id?.toString(),
                );
              } else {
                target = {
                  _id: message.senderId?._id || message.senderId,
                  name: message.senderId?.name || "Người dùng",
                  avatar: message.senderId?.avatar || "",
                };
              }
              if (!target) return;
              startCall(target, convId, message.callType || "voice");
            }}
          />
          {isLastInGroup && (
            <span
              className="message-time-inline"
              style={{
                marginTop: 2,
                display: "block",
                textAlign: isOwn ? "right" : "left",
              }}
            >
              {formatMessageTime(message.createdAt)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Normal message (giữ nguyên hoàn toàn) ─────────────────────────────────
  return (
    <div
      className={`message-bubble ${isOwn ? "own" : "other"} ${showAvatar ? "show-avatar-gap" : ""} ${!isLastInGroup ? "hide-time" : ""} ${message.reactions?.length > 0 ? "has-reactions" : ""} ${isSelected ? "selected" : ""}`}
      onClick={isSelectMode ? () => onSelect?.(message) : undefined}
      onContextMenu={(e) => {
        if (isSelectMode) return;
        e.preventDefault();
        setDropdownPosition({ x: e.clientX, y: e.clientY });
        setShowDropdown(true);
      }}
    >
      {isSelectMode && (
        <div className={`message-checkbox ${isSelected ? "checked" : ""}`}>
          {isSelected && <span>✓</span>}
        </div>
      )}
      {!isOwn && showAvatar && (
        <UserAvatar
          name={message.senderId?.name}
          avatar={message.senderId?.avatar}
          size={36}
          className="message-avatar"
        />
      )}
      {!isOwn && !showAvatar && <div className="message-avatar-spacer" />}

      <div className="message-content">
        <div className="message-like-wrapper">
          <div
            className={`message-body ${message.type === "image" || message.type === "video" || message.type === "images" ? "media-message" : ""} ${(message.type === "image" || message.type === "images") && isLastMessage ? "media-message-last" : ""}`}
          >
            {renderReplyPreview()}
            {message.type !== "text" && message.type !== "voice" && (
              <div className="media-with-caption">
                {!isOwn && isGroup && showAvatar && (
                  <span className="message-sender-media">
                    {localStorage.getItem(
                      `nickname_user_${message.senderId?._id}`,
                    ) || message.senderId?.name}
                  </span>
                )}
                <FilePreview message={message} onImageClick={onImageClick} />
                {message.caption && (
                  <div className="caption-text">
                    {renderTextWithLinks(message.caption)}
                  </div>
                )}
              </div>
            )}

            {message.type === "voice" && (
              <div className="voice-message">
                <audio controls src={message.fileUrl} />
                <span className="voice-duration">
                  {message.voiceDuration
                    ? `${Math.floor(message.voiceDuration / 60)}:${String(message.voiceDuration % 60).padStart(2, "0")}`
                    : "0:00"}
                </span>
              </div>
            )}

            {message.type === "text" && (
              <p className="message-text">
                {!isOwn && isGroup && showAvatar && (
                  <span className="message-sender-inline">
                    {localStorage.getItem(
                      `nickname_user_${message.senderId?._id}`,
                    ) || message.senderId?.name}
                  </span>
                )}
                {renderTextWithLinks(message.content)}
                {message.isEdited && (
                  <span className="edited-label"> (đã sửa)</span>
                )}
              </p>
            )}

            <div className="message-meta-inline">
              <span className="message-time-inline">
                {formatMessageTime(message.createdAt)}
              </span>
            </div>
          </div>

          <div
            className={`message-inline-actions ${showDropdown ? "show" : ""}`}
          >
            {message.type !== "images" && (
              <button
                className="inline-action-btn"
                title="Trả lời"
                onClick={() => onReply && onReply(message)}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                </svg>
              </button>
            )}

            <button
              className="inline-action-btn"
              title="Chia sẻ"
              onClick={() => onForward && onForward(message)}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" />
              </svg>
            </button>

            <div className="more-btn-wrapper">
              <button
                className="inline-action-btn"
                title="Thêm"
                onClick={() => {
                  setShowDropdown(true);
                  window.dispatchEvent(new CustomEvent("messageActionsOpen"));
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
            </div>

            {showDropdown && (
              <MessageActions
                message={message}
                isOwn={isOwn}
                currentUserId={currentUserId}
                onClose={() => {
                  setShowDropdown(false);
                  window.dispatchEvent(new CustomEvent("messageActionsClose"));
                }}
                onReply={() => onReply?.(message)}
                onEdit={() => onEdit?.(message)}
                onForward={() => onForward?.(message)}
                onPin={() => onPin?.(message)}
                onStar={() => {
                  socket?.emit("message:star", { messageId: message._id });
                }}
                onDelete={() => {
                  if (socket?.connected)
                    socket.emit("message:delete", { messageId: message._id });
                }}
                onRecall={() => {
                  if (socket?.connected)
                    socket.emit("message:recall", { messageId: message._id });
                }}
                onReact={(emoji) => {
                  if (socket?.connected)
                    socket.emit("message:reaction:add", {
                      messageId: message._id,
                      emoji,
                    });
                }}
                onSelectMode={() => {
                  onEnterSelectMode?.();
                  setShowDropdown(false);
                }}
                onRemoveReact={() => {
                  if (socket?.connected)
                    socket.emit("message:reaction:remove", {
                      messageId: message._id,
                    });
                }}
              />
            )}
          </div>

          <button
            className="message-like-btn"
            onMouseEnter={() => {
              clearTimeout(reactionTimerRef.current);
              setShowReactionPopup(true);
            }}
            onMouseLeave={() => {
              reactionTimerRef.current = setTimeout(
                () => setShowReactionPopup(false),
                300,
              );
            }}
          >
            {(() => {
              const myReaction = message.reactions?.find(
                (r) =>
                  (r.userId?._id || r.userId)?.toString() === currentUserId,
              );
              return myReaction ? myReaction.emoji : "👍";
            })()}
          </button>

          {showReactionPopup && (
            <div
              className="reaction-popup"
              onMouseEnter={() => clearTimeout(reactionTimerRef.current)}
              onMouseLeave={() => {
                reactionTimerRef.current = setTimeout(
                  () => setShowReactionPopup(false),
                  300,
                );
              }}
            >
              {REACTIONS.map((emoji) => (
                <span
                  key={emoji}
                  className="reaction-option"
                  onClick={() => handleReaction(emoji)}
                  title={emoji}
                >
                  {emoji}
                </span>
              ))}
              {message.reactions?.some(
                (r) =>
                  (r.userId?._id || r.userId)?.toString() === currentUserId,
              ) && (
                <span
                  className="reaction-remove-btn"
                  onClick={() => {
                    if (socket?.connected) {
                      socket.emit("message:reaction:remove", {
                        messageId: message._id,
                      });
                    }
                    setShowReactionPopup(false);
                  }}
                  title="Xóa cảm xúc"
                >
                  ✕
                </span>
              )}
            </div>
          )}
        </div>
        {renderReactions()}
        {renderStatusBar()}
      </div>
    </div>
  );
};

export default MessageBubble;
