import { useState, useEffect, useCallback } from "react";
import { useSocket } from "./useSocket";

export const useTyping = (conversationId) => {
  const { socket } = useSocket();
  const [typingUsers, setTypingUsers] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const handleTypingUpdate = ({ conversationId: convId, users }) => {
      if (convId === conversationId) {
        setTypingUsers(users);
      }
    };

    socket.on("typing:update", handleTypingUpdate);

    return () => {
      socket.off("typing:update", handleTypingUpdate);
    };
  }, [socket, conversationId]);

  const startTyping = useCallback(() => {
    socket?.emit("typing:start", { conversationId });
  }, [socket, conversationId]);

  const stopTyping = useCallback(() => {
    socket?.emit("typing:stop", { conversationId });
  }, [socket, conversationId]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
  };
};
