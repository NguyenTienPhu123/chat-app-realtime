import React, { useState, useRef, useEffect } from "react";
import { useSocket } from "../../hooks/useSocket";
import messageService from "../../services/message.service";
import ReplyPreview from "./ReplyPreview";
import VoiceRecorder from "./VoiceRecorder";
import {
  EmojiIcon,
  AttachIcon,
  ImageIcon,
  MicIcon,
  SendIcon,
  CheckIcon,
  CloseIcon,
} from "../../icons";
import "./MessageInput.css";

const MessageInput = ({
  conversationId,
  replyTo,
  onCancelReply,
  editMessage,
  onCancelEdit,
  disabled = false,
  blockedByName = "Người đó",
  onOptimisticMessage,
  currentUser,
  onMessageSent,
}) => {
  const [message, setMessage] = useState(() => {
    return sessionStorage.getItem(`draft_${conversationId}`) || "";
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const archiveInputRef = useRef(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const textareaRef = useRef(null);

  const { socket } = useSocket();

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current);
      if (socket?.connected) {
        socket.emit("typing:stop", { conversationId });
      }
    };
  }, [conversationId]);
  const [isDragging, setIsDragging] = useState(false);

  const quickEmojis = ["😊", "😂", "❤️", "👍", "🎉", "🔥", "😍", "👏"];

  useEffect(() => {
    if (editMessage) {
      setMessage(editMessage.content || "");
      textareaRef.current?.focus();
    }
  }, [editMessage]);
  // Reset message khi chuyển conversation, restore draft
  useEffect(() => {
    const draft = sessionStorage.getItem(`draft_${conversationId}`) || "";
    setMessage(draft);
    // Auto focus
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }, [conversationId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current);
      if (socket?.connected) {
        socket.emit("typing:stop", { conversationId });
      }
    };
  }, [conversationId]);
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newFiles = files.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : "file",
      preview: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
    }));

    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  // Paste ảnh từ clipboard
  // Paste ảnh từ clipboard
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files = [];
    let hasImageFile = false;
    let imageUrls = [];

    // ✅ 1. Kiểm tra file ảnh trực tiếp
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        hasImageFile = true;
        const file = item.getAsFile();
        if (file) {
          files.push({
            file,
            name: file.name || `image_${Date.now()}.png`,
            size: file.size,
            type: "image",
            preview: URL.createObjectURL(file),
          });
        }
      } else if (item.kind === "string" && item.type === "text/plain") {
        // ✅ 2. Kiểm tra text URL
        await new Promise((resolve) => {
          item.getAsString((text) => {
            // Kiểm tra nếu là URL ảnh
            if (
              text.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i) ||
              text.includes("/uploads/image/")
            ) {
              imageUrls.push(text);
            }
            resolve();
          });
        });
      }
    }

    // ✅ 3. Nếu có file ảnh trực tiếp → Dùng luôn
    if (hasImageFile && files.length > 0) {
      e.preventDefault();
      setSelectedFiles((prev) => [...prev, ...files]);
      return;
    }

    // ✅ 4. Nếu có URL ảnh → Tải về và convert thành File
    if (imageUrls.length > 0) {
      e.preventDefault(); // Chặn paste text

      for (const url of imageUrls) {
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          const fileName =
            url.split("/").pop().split("?")[0] || `image_${Date.now()}.jpg`;
          const file = new File([blob], fileName, { type: blob.type });

          files.push({
            file,
            name: fileName,
            size: file.size,
            type: "image",
            preview: URL.createObjectURL(file),
          });
        } catch (err) {
          console.error("Failed to fetch image:", err);
        }
      }

      if (files.length > 0) {
        setSelectedFiles((prev) => [...prev, ...files]);
      }
    }
  };

  // Kéo thả file
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    const newFiles = files.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : "file",
      preview: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
    }));
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => {
      const file = prev[index];
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const typingTimerRef = useRef(null);

  const handleMessageChange = (e) => {
    const value = e.target.value;
    setMessage(value);
    sessionStorage.setItem(`draft_${conversationId}`, value);

    if (!socket?.connected) return;

    // ✅ Nếu ô trống → stop ngay lập tức
    if (!value.trim()) {
      clearTimeout(typingTimerRef.current);
      socket.emit("typing:stop", { conversationId });
      return;
    }

    socket.emit("typing:start", { conversationId });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId });
    }, 5000);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (sending) return;

    if (editMessage) {
      if (!message.trim()) {
        alert("Message cannot be empty");
        return;
      }

      try {
        setSending(true);
        clearTimeout(typingTimerRef.current);
        if (socket?.connected) {
          socket.emit("typing:stop", { conversationId });
        }
        await messageService.editMessage(editMessage._id, message.trim());
        setMessage("");
        sessionStorage.removeItem(`draft_${conversationId}`);
        onCancelEdit?.();
      } catch (error) {
        console.error("Edit message error:", error);
        console.error("Failed to edit message");
      } finally {
        setSending(false);
      }
      return;
    }

    if (!message.trim() && selectedFiles.length === 0) return;

    try {
      setSending(true);
      clearTimeout(typingTimerRef.current);
      if (socket?.connected) {
        socket.emit("typing:stop", { conversationId });
      }
      const imageFiles = selectedFiles.filter((f) => f.type === "image");
      const shouldSendTextSeparately = imageFiles.length !== 1;

      if (message.trim() && shouldSendTextSeparately) {
        const optimisticId = `optimistic_${Date.now()}`;
        const optimisticMsg = {
          _id: optimisticId,
          conversationId,
          content: message.trim(),
          type: "text",
          senderId: {
            _id: currentUser?._id,
            name: currentUser?.name,
            avatar: currentUser?.avatar,
          },
          createdAt: new Date().toISOString(),
          status: "sent", // Hiện luôn delivered
          replyTo: replyTo || null,
          reactions: [],
          readBy: [],
        };
        onOptimisticMessage?.(optimisticMsg);
        onMessageSent?.(optimisticMsg);

        if (socket?.connected) {
          socket.emit("message:send", {
            conversationId,
            content: message.trim(),
            replyToId: replyTo?._id || null,
            optimisticId,
          });
        } else {
          // Mạng lỗi → đổi về sending
          onOptimisticMessage?.({ ...optimisticMsg, status: "sending" });
          await messageService.sendText(
            conversationId,
            message.trim(),
            replyTo?._id || null,
          );
        }
        setMessage("");
        sessionStorage.removeItem(`draft_${conversationId}`);
        onCancelReply?.();
      }

      if (selectedFiles.length > 0) {
        const imageFiles = selectedFiles.filter((f) => f.type === "image");
        const otherFiles = selectedFiles.filter((f) => f.type !== "image");

        if (imageFiles.length === 1) {
          // 1 ảnh: gửi kèm caption luôn
          await messageService.sendFile(
            conversationId,
            imageFiles[0].file,
            "image",
            message.trim(), // ← caption
            replyTo?._id || null,
          );
          setMessage("");
          sessionStorage.removeItem(`draft_${conversationId}`); // ← clear text vì đã gửi kèm ảnh
          onCancelReply?.();
        } else if (imageFiles.length > 1) {
          // Nhiều ảnh: gửi ảnh trước (không kèm text)
          await messageService.sendImages(
            conversationId,
            imageFiles.map((f) => f.file),
            "",
            replyTo?._id || null,
          );
          // Text gửi riêng (đã gửi ở trên rồi nên không cần gửi lại)
        }

        for (const fileData of otherFiles) {
          await messageService.sendFile(
            conversationId,
            fileData.file,
            fileData.type,
            "",
            replyTo?._id || null,
          );
        }

        selectedFiles.forEach((f) => {
          if (f.preview) URL.revokeObjectURL(f.preview);
        });
        setSelectedFiles([]);
        setMessage(""); // ← đảm bảo clear text
        sessionStorage.removeItem(`draft_${conversationId}`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (imageInputRef.current) imageInputRef.current.value = "";
        onCancelReply?.();
      }
    } catch (error) {
      console.error("Send message error:", error);
      if (error?.response?.status === 413) {
        console.error("File quá lớn");
      } else {
        console.error("Gửi tin nhắn thất bại");
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiClick = (emoji) => {
    setMessage(message + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleVoiceSend = async (audioFile, duration, waveform) => {
    try {
      setSending(true);
      await messageService.sendVoice(
        conversationId,
        audioFile,
        duration,
        waveform,
      );
      setShowVoiceRecorder(false);
    } catch (error) {
      console.error("Send voice error:", error);
      alert("Failed to send voice message");
    } finally {
      setSending(false);
    }
  };

  if (disabled === "blocked_stranger") {
    return (
      <div
        style={{
          padding: "14px 16px",
          background: "var(--bg-secondary, #f8fafc)",
          borderTop: "1px solid #e4e6eb",
          textAlign: "center",
          fontSize: 13,
          color: "#94a3b8",
          flexShrink: 0,
        }}
      >
        {blockedByName} đã chặn người lạ trò chuyện. Hãy kết bạn để trò chuyện
        với nhau.
      </div>
    );
  }

  if (disabled === "preview") {
    return (
      <div
        style={{
          padding: "14px 16px",
          background: "var(--bg-secondary, #f8fafc)",
          borderTop: "1px solid #e4e6eb",
          textAlign: "center",
          fontSize: 13,
          color: "#94a3b8",
          flexShrink: 0,
        }}
      >
        Kết bạn để có thể nhắn tin với nhau.
      </div>
    );
  }

  if (disabled === true || disabled === "dissolved") {
    return (
      <div
        style={{
          padding: "14px 16px",
          background: "var(--bg-secondary, #f8fafc)",
          borderTop: "1px solid #e4e6eb",
          textAlign: "center",
          fontSize: 13,
          color: "#94a3b8",
          flexShrink: 0,
        }}
      >
        Nhóm đã bị giải tán — không thể gửi tin nhắn
      </div>
    );
  }

  {
    /* Lightbox xem ảnh tạm */
  }
  {
    lightboxSrc && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={() => setLightboxSrc(null)}
      >
        <img
          src={lightboxSrc}
          style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: 32,
            cursor: "pointer",
          }}
          onClick={() => setLightboxSrc(null)}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <>
      {lightboxSrc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: 32,
              cursor: "pointer",
            }}
            onClick={() => setLightboxSrc(null)}
          >
            ✕
          </button>
        </div>
      )}

      {showVoiceRecorder && (
        <div className="voice-recorder-overlay">
          <VoiceRecorder
            onSend={handleVoiceSend}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        </div>
      )}

      <div
        className={`message-input-container ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {replyTo && <ReplyPreview message={replyTo} onCancel={onCancelReply} />}

        {editMessage && (
          <div className="edit-preview-bar">
            <span className="edit-icon">✏️</span>
            <span className="edit-label">Editing message</span>
            <button className="cancel-edit-btn" onClick={onCancelEdit}>
              <CloseIcon size={20} />
            </button>
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="file-preview-bar">
            <div className="file-preview-list">
              {selectedFiles.map((fileData, index) => (
                <div key={index} className="file-preview-item">
                  {fileData.type === "image" && fileData.preview ? (
                    <div
                      className="preview-image-wrapper"
                      style={{ cursor: "pointer" }}
                      onClick={() => setLightboxSrc(fileData.preview)}
                    >
                      <img
                        src={fileData.preview}
                        alt="Preview"
                        className="preview-thumbnail"
                      />
                      <span className="preview-type-badge">Ảnh</span>
                    </div>
                  ) : fileData.type === "video" ? (
                    <div className="file-icon-preview video">
                      <span>🎥</span>
                      <span className="preview-type-label">Video</span>
                    </div>
                  ) : (
                    <div className="file-icon-preview doc">
                      <span>
                        {fileData.name.endsWith(".pdf")
                          ? "📕"
                          : fileData.name.endsWith(".doc") ||
                              fileData.name.endsWith(".docx")
                            ? "📝"
                            : fileData.name.endsWith(".xls") ||
                                fileData.name.endsWith(".xlsx")
                              ? "📊"
                              : fileData.name.endsWith(".zip") ||
                                  fileData.name.endsWith(".rar") ||
                                  fileData.name.endsWith(".7z")
                                ? "🗜️"
                                : "📄"}
                      </span>
                      <span className="preview-type-label">
                        {fileData.name.split(".").pop().toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="file-details">
                    <div className="file-name-preview" title={fileData.name}>
                      {fileData.name.length > 20
                        ? fileData.name.substring(0, 17) +
                          "..." +
                          fileData.name.split(".").pop()
                        : fileData.name}
                    </div>
                    <div className="file-size-preview">
                      {fileData.size < 1024 * 1024
                        ? (fileData.size / 1024).toFixed(1) + " KB"
                        : (fileData.size / 1024 / 1024).toFixed(2) + " MB"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="remove-file-btn"
                    title="Xóa"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>
              ))}

              {/* Nút thêm file */}
              <div
                className="file-preview-item add-more-btn"
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 80,
                  border: "2px dashed #ccc",
                  borderRadius: 8,
                  padding: 8,
                  color: "#888",
                  fontSize: 24,
                }}
                onClick={() => {
                  const hasImage = selectedFiles.some(
                    (f) => f.type === "image",
                  );
                  const hasArchive = selectedFiles.some(
                    (f) =>
                      f.name.endsWith(".zip") ||
                      f.name.endsWith(".rar") ||
                      f.name.endsWith(".7z"),
                  );
                  if (hasImage) imageInputRef.current?.click();
                  else if (hasArchive) archiveInputRef.current?.click();
                  else fileInputRef.current?.click();
                }}
              >
                <span>+</span>
                <span style={{ fontSize: 11, marginTop: 4 }}>Thêm</span>
              </div>
            </div>
          </div>
        )}

        {showEmojiPicker && (
          <div className="emoji-picker-dropdown">
            <div className="emoji-grid">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-btn"
                  onClick={() => handleEmojiClick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <form className="message-input-form" onSubmit={handleSendMessage}>
          <button
            type="button"
            className="input-icon-btn"
            onClick={() => archiveInputRef.current?.click()}
            title="Gửi file nén (.zip, .rar)"
            disabled={sending || editMessage}
          >
            🗜️
          </button>

          <button
            type="button"
            className="input-icon-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Đính kèm file"
            disabled={sending || editMessage}
          >
            <AttachIcon size={24} />
          </button>

          <button
            type="button"
            className="input-icon-btn"
            onClick={() => imageInputRef.current?.click()}
            title="Gửi hình ảnh"
            disabled={sending || editMessage}
          >
            <ImageIcon size={24} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            style={{ display: "none" }}
            accept=".pdf,.doc,.docx,.txt"
            multiple
          />

          <input
            ref={imageInputRef}
            type="file"
            onChange={handleFileSelect}
            style={{ display: "none" }}
            accept="image/*,video/*"
            multiple
          />

          <input
            ref={archiveInputRef}
            type="file"
            onChange={handleFileSelect}
            style={{ display: "none" }}
            accept=".zip,.rar,.7z"
            multiple
          />

          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleMessageChange}
            onKeyPress={handleKeyPress}
            onPaste={handlePaste}
            placeholder={editMessage ? "Edit message..." : "Aa"}
            className="message-textarea"
            rows="1"
            disabled={sending}
            autoFocus
          />

          {!message.trim() && selectedFiles.length === 0 && !editMessage && (
            <button
              type="button"
              className="input-icon-btn voice-btn-trigger"
              onClick={() => setShowVoiceRecorder(true)}
              title="Tin nhắn thoại"
              disabled={sending}
            >
              <MicIcon size={24} />
            </button>
          )}

          {(message.trim() || selectedFiles.length > 0 || editMessage) && (
            <button
              type="submit"
              className="send-btn-modern"
              disabled={
                (!message.trim() && selectedFiles.length === 0) || sending
              }
              title={editMessage ? "Lưu" : "Gửi"}
            >
              {sending ? (
                <div className="spinner-send"></div>
              ) : editMessage ? (
                <CheckIcon size={20} />
              ) : (
                <SendIcon size={20} />
              )}
            </button>
          )}
        </form>
      </div>
    </>
  );
};

export default MessageInput;
