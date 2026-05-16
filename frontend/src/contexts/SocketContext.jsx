import React, { createContext, useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../hooks/useAuth";
import { playSound } from "../utils/sound.util";

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated, logout, refreshSession } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [pendingFriendRequests, setPendingFriendRequests] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !user?._id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    if (socketRef.current && socketRef.current._userId === user._id) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const token =
      localStorage.getItem("accessToken") ||
      sessionStorage.getItem("accessToken");
    if (!token) return;

    const socketURL =
      import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
    const newSocket = io(socketURL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket._userId = user._id;
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setConnected(true);
      const hideOnline = localStorage.getItem("hide_online_status") === "1";
      if (!hideOnline) {
        newSocket.emit("user:online");
      } else {
        newSocket.emit("user:hide_online");
      }
    });

    newSocket.on("disconnect", () => {
      setConnected(false);
    });

    // Lắng nghe thay đổi setting ẩn online từ SettingsModal
    const handleHideOnlineChange = (e) => {
      const hide = e.detail;
      if (hide) {
        newSocket.emit("user:hide_online");
      } else {
        newSocket.emit("user:online");
      }
    };
    window.addEventListener(
      "privacy:hide_online_changed",
      handleHideOnlineChange,
    );

    newSocket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    newSocket.on("connect_error", async (error) => {
      const message = String(error?.message || "").toLowerCase();
      if (
        message.includes("authentication") ||
        message.includes("invalid") ||
        message.includes("expired")
      ) {
        const refreshed = await refreshSession();
        if (!refreshed) {
          logout();
          return;
        }
        newSocket.auth = {
          token:
            localStorage.getItem("accessToken") ||
            sessionStorage.getItem("accessToken"),
        };
        newSocket.connect();
      }
    });

    // Lắng nghe lời mời kết bạn đến
    newSocket.on("friend:request_received", ({ fromUser }) => {
      setPendingFriendRequests((prev) => {
        const exists = prev.some((r) => r._id === fromUser._id);
        if (exists) return prev;
        return [...prev, fromUser];
      });
    });

    // Lắng nghe khi lời mời được chấp nhận
    newSocket.on("friend:request_accepted", ({ fromUser }) => {
      console.log(`${fromUser.name} đã chấp nhận lời mời kết bạn`);
    });

    // Lắng nghe cập nhật thành viên nhóm
    newSocket.on("conversation:updated_info", (data) => {
      window.dispatchEvent(
        new CustomEvent("conversation:updated_info", { detail: data }),
      );
    });
    newSocket.on("conversation:kicked", (data) => {
      window.dispatchEvent(
        new CustomEvent("conversation:kicked", { detail: data }),
      );
    });
    // Thêm vào trong useEffect, sau các newSocket.on khác
    newSocket.on("friend:removed", ({ friendId, conversationId }) => {
      window.dispatchEvent(
        new CustomEvent("friend:removed", {
          detail: { friendId, conversationId },
        }),
      );
    });
    newSocket.on("user:avatar_updated", ({ userId, avatar }) => {
      window.dispatchEvent(
        new CustomEvent("user:avatar_updated", { detail: { userId, avatar } }),
      );
    });

    newSocket.on(
      "conversation:wallpaper_updated",
      ({ conversationId, wallpaper }) => {
        localStorage.setItem(`wallpaper_${conversationId}`, wallpaper || "");
        window.dispatchEvent(
          new CustomEvent("wallpaper:changed", {
            detail: { conversationId, wallpaper: wallpaper || "" },
          }),
        );
      },
    );

    newSocket.on("message:new", (msg) => {
      const senderId =
        typeof msg.senderId === "object" ? msg.senderId?._id : msg.senderId;
      if (senderId && senderId?.toString() !== user?._id?.toString()) {
        const notifyMessage = localStorage.getItem("notify_message") !== "0";
        if (notifyMessage) playSound("message");
      }
    });

    return () => {
      window.removeEventListener(
        "privacy:hide_online_changed",
        handleHideOnlineChange,
      );
    };
  }, [user?._id, isAuthenticated, logout, refreshSession]);

  const joinConversation = (conversationId) => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit("conversation:join", conversationId);
    }
  };

  const leaveConversation = (conversationId) => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit("conversation:leave", conversationId);
    }
  };

  const clearFriendRequest = (userId) => {
    setPendingFriendRequests((prev) => prev.filter((r) => r._id !== userId));
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        joinConversation,
        leaveConversation,
        pendingFriendRequests,
        clearFriendRequest,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
