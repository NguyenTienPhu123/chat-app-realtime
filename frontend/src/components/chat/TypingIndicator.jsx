import React, { useState, useEffect, useRef } from "react";
import { useSocket } from "../../hooks/useSocket";
import "./TypingIndicator.css";

const TypingIndicator = ({ conversationId, isGroup }) => {
  const { socket } = useSocket();
  const [typingUsers, setTypingUsers] = useState([]);
  const timersRef = useRef({});

  useEffect(() => {
    if (!socket) return;

    const handleTypingStart = ({ userId, name, conversationId: convId }) => {
      if (convId !== conversationId) return;

      setTypingUsers((prev) => {
        const exists = prev.find((u) => u.userId === userId);
        if (exists) return prev;
        return [...prev, { userId, name: name || "Ai đó" }];
      });

      // Reset timer mỗi lần nhận typing:start
      clearTimeout(timersRef.current[userId]);
      timersRef.current[userId] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
      }, 5000);
    };

    const handleTypingStop = ({ userId, conversationId: convId }) => {
      if (convId !== conversationId) return;
      clearTimeout(timersRef.current[userId]);
      delete timersRef.current[userId];
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
    };

    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [socket, conversationId]);

  // Clear khi đổi conversation
  useEffect(() => {
    setTypingUsers([]);
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
  }, [conversationId]);

  if (typingUsers.length === 0) return null;

  const label = `${typingUsers.map((u) => u.name).join(", ")} đang soạn tin nhắn`;

  return (
    <div className="typing-indicator">
      <div className="typing-bubble">
        <span className="typing-dot"></span>
        <span className="typing-dot"></span>
        <span className="typing-dot"></span>
      </div>
      <span className="typing-label">{label}</span>
    </div>
  );
};

export default TypingIndicator;
