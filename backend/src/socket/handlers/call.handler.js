/**
 * call.handler.js
 * WebRTC signaling: 1-1 call + group call (mesh)
 * - Group call notification bằng cách load participants từ MongoDB nếu không có trong store
 * - writeGroupCallLog async để load conv từ MongoDB khi cần
 * - endGroupCallRoom async
 */

const groupCallRooms = {};
const pendingCalls = new Map();

const handler = (io, socket, store) => {
  // ── Helper: lấy danh sách participants của conversation ──────────────────
  const getConversationParticipants = async (conversationId) => {
    const conv = store.CONVERSATIONS[conversationId];
    if (conv && conv.participants && conv.participants.length > 0) {
      return { conv, participants: conv.participants };
    }

    try {
      const mongoose = require("mongoose");
      if (mongoose.connection.readyState === 1) {
        const Conversation = require("../models/Conversation.model");
        const dbConv = await Conversation.findById(conversationId).lean();
        if (dbConv) {
          store.CONVERSATIONS[conversationId] = {
            _id: conversationId,
            type: dbConv.type || "group",
            name: dbConv.name || "Nhóm",
            participants: dbConv.participants.map((p) =>
              p?._id?.toString ? p._id.toString() : p.toString()
            ),
            isActive: true,
            createdAt: dbConv.createdAt,
            updatedAt: dbConv.updatedAt,
            lastMessage: dbConv.lastMessage || null,
          };
          return {
            conv: store.CONVERSATIONS[conversationId],
            participants: store.CONVERSATIONS[conversationId].participants,
          };
        }
      }
    } catch (e) {
      console.error("getConversationParticipants MongoDB error:", e);
    }
    return { conv: null, participants: [] };
  };

  // ── Helper: broadcast room status ─────────────────────────────────────────
  const broadcastRoomStatus = async (conversationId) => {
    const room = groupCallRooms[conversationId];
    const { conv, participants } = await getConversationParticipants(conversationId);
    if (!conv) return;

    const isActive = room && room.participants.size >= 1;
    const statusData = {
      conversationId,
      isActive,
      callType: room?.callType || null,
      participantCount: room?.participants.size || 0,
      participants: room
        ? [...room.participants.values()].map((p) => ({
            userId: p.userId,
            name: p.name,
            avatar: p.avatar,
          }))
        : [],
    };

    participants.forEach((member) => {
      const mId =
        typeof member === "object"
          ? member._id?.toString() || member.toString()
          : member.toString();
      io.to(`user:${mId}`).emit("group-call:room-status", statusData);
    });
    io.to(`conversation:${conversationId}`).emit(
      "group-call:room-status",
      statusData,
    );
  };

  // ── Helper: write call log when room ends ─────────────────────────────────
  const writeGroupCallLog = async (conversationId, room, statusOverride = null) => {
    let conv = store.CONVERSATIONS[conversationId];
    if (!conv) {
      try {
        const mongoose = require("mongoose");
        if (mongoose.connection.readyState === 1) {
          const Conversation = require("../models/Conversation.model");
          const dbConv = await Conversation.findById(conversationId).lean();
          if (dbConv) {
            store.CONVERSATIONS[conversationId] = {
              _id: conversationId,
              type: dbConv.type || "group",
              name: dbConv.name || "Nhóm",
              participants: dbConv.participants.map((p) =>
                p?._id?.toString ? p._id.toString() : p.toString()
              ),
              isActive: true,
              createdAt: dbConv.createdAt,
              updatedAt: dbConv.updatedAt,
              lastMessage: dbConv.lastMessage || null,
            };
            conv = store.CONVERSATIONS[conversationId];
          }
        }
      } catch (e) {
        console.error("writeGroupCallLog MongoDB error:", e);
      }
    }

    if (!conv) {
      console.warn(`⚠️ writeGroupCallLog: conv ${conversationId} not found, skipping log`);
      return;
    }
    if (room.logWritten) return;
    room.logWritten = true;

    const duration = room.connectedAt
      ? Math.floor((Date.now() - room.connectedAt) / 1000)
      : 0;

    const status = statusOverride || (duration > 0 ? "completed" : "missed");

    const formatDur = (s) => {
      if (!s || s <= 0) return null;
      const m = Math.floor(s / 60),
        sec = s % 60;
      return m > 0 ? `${m} phút ${sec} giây` : `${sec} giây`;
    };

    const label =
      room.callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại";
    let content;
    switch (status) {
      case "completed":
        content = formatDur(duration)
          ? `${label} • ${formatDur(duration)}`
          : label;
        break;
      case "missed":
        content = `${label} không được trả lời`;
        break;
      default:
        content = label;
    }

    const callMsg = {
      _id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      conversationId,
      type: "call",
      callType: room.callType,
      callStatus: status,
      callDirection: "outgoing",
      callDuration: duration,
      content,
      senderId: {
        _id: room.callerId,
        name: room.callerName,
        avatar: room.callerAvatar,
      },
      createdAt: new Date(),
      reactions: [],
    };

    if (!store.MESSAGES[conversationId]) store.MESSAGES[conversationId] = [];
    store.MESSAGES[conversationId].push(callMsg);

    conv.lastMessage = {
      _id: callMsg._id,
      type: "call",
      callType: room.callType,
      callStatus: status,
      content: callMsg.content,
      senderId: callMsg.senderId,
      createdAt: callMsg.createdAt,
    };

    io.to(`conversation:${conversationId}`).emit("message:new", callMsg);
    io.to(`conversation:${conversationId}`).emit("conversation:lastMessage", {
      conversationId,
      lastMessage: conv.lastMessage,
    });

    console.log(
      `📋 Group call log written: conv:${conversationId}, status:${status}, duration:${duration}s, caller:${room.callerName}`,
    );
  };

  // ── Helper: end group call room (write log + notify) ──────────────────────
  const endGroupCallRoom = async (conversationId, room, statusOverride = null) => {
    await writeGroupCallLog(conversationId, room, statusOverride);
    io.to(`call:${conversationId}`).emit("group-call:ended", {
      conversationId,
    });
    delete groupCallRooms[conversationId];
    console.log(`🗑️ Group call room ended & deleted: ${conversationId}`);
    broadcastRoomStatus(conversationId);
  };

  // ════════════════════════════════════════════════════════════
  // 1-1 CALL
  // ════════════════════════════════════════════════════════════

  socket.on("call:initiate", (data) => {
    const { to, conversationId, callType, offer, callerInfo } = data;
    if (!socket.userId || !to) return;

    const payload = {
      from: socket.userId,
      conversationId,
      callType,
      offer,
      callerInfo: {
        _id: callerInfo?._id || socket.userId,
        name:
          callerInfo?.name || store.USERS[socket.userId]?.name || "Người dùng",
        avatar: callerInfo?.avatar || store.USERS[socket.userId]?.avatar || "",
      },
    };

    io.to(`user:${to}`).emit("call:incoming", payload);

    const targetRoom = io.sockets.adapter.rooms.get(`user:${to}`);
    const isTargetOnline = targetRoom && targetRoom.size > 0;

    if (!isTargetOnline) {
      if (pendingCalls.has(to)) {
        clearTimeout(pendingCalls.get(to).timerId);
      }
      const timerId = setTimeout(() => pendingCalls.delete(to), 40000);
      pendingCalls.set(to, { payload, timestamp: Date.now(), timerId });
      console.log(`📞 Pending call saved for offline user: ${to}`);
    }
  });

  socket.on("call:answer", (data) => {
    const { to, answer } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("call:answered", { from: socket.userId, answer });
  });

  socket.on("call:ice-candidate", (data) => {
    const { to, candidate } = data;
    if (!socket.userId || !to || !candidate) return;
    io.to(`user:${to}`).emit("call:ice-candidate", {
      from: socket.userId,
      candidate,
    });
  });

  socket.on("call:reject", (data) => {
    const { to, reason } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("call:rejected", {
      from: socket.userId,
      reason: reason || "rejected",
    });
  });

  socket.on("call:end", (data) => {
    const { to } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("call:ended", { from: socket.userId });
  });

  socket.on("call:cancel", (data) => {
    const { to } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("call:cancelled", { from: socket.userId });
    if (pendingCalls.has(to)) {
      clearTimeout(pendingCalls.get(to).timerId);
      pendingCalls.delete(to);
      console.log(`❌ Pending call cancelled for user: ${to}`);
    }
  });

  socket.on("call:media-state", (data) => {
    const { to, conversationId, isMuted, isCameraOff } = data;
    if (!socket.userId) return;
    if (to) {
      io.to(`user:${to}`).emit("call:media-state", {
        from: socket.userId,
        isMuted,
        isCameraOff,
      });
    } else if (conversationId) {
      socket.to(`call:${conversationId}`).emit("call:media-state", {
        from: socket.userId,
        isMuted,
        isCameraOff,
      });
    }
  });

  // ── 1-1: upgrade/downgrade call type ──────────────────────────────────────
  socket.on("call:type-change-request", (data) => {
    const { to, newCallType, offer } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("call:type-change-request", {
      from: socket.userId,
      newCallType,
      offer,
    });
  });

  socket.on("call:type-change-accept", (data) => {
    const { to, newCallType, offer, cameraOff } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("call:type-change-accept", {
      from: socket.userId,
      newCallType,
      offer,
      cameraOff,
    });
  });

  socket.on("call:type-change-answer", (data) => {
    const { to, answer } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("call:type-change-answer", {
      from: socket.userId,
      answer,
    });
  });

  socket.on("call:type-change-reject", (data) => {
    const { to } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("call:type-change-reject", {
      from: socket.userId,
    });
  });

  socket.on("call:renegotiate", (data) => {
    const { to, offer } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("call:renegotiate", {
      from: socket.userId,
      offer,
    });
  });

  socket.on("call:renegotiate-answer", (data) => {
    const { to, answer } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("call:renegotiate-answer", {
      from: socket.userId,
      answer,
    });
  });

  // ── Group call: renegotiation ──────────────────────────────────────────────
  socket.on("group-call:renegotiate-offer", (data) => {
    const { to, conversationId, offer } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("group-call:renegotiate-offer", {
      from: socket.userId,
      conversationId,
      offer,
    });
  });

  socket.on("group-call:renegotiate-answer", (data) => {
    const { to, conversationId, answer } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("group-call:renegotiate-answer", {
      from: socket.userId,
      conversationId,
      answer,
    });
  });

  socket.on("group-call:type-change-request", (data) => {
    const { conversationId, newCallType } = data;
    if (!socket.userId || !conversationId) return;
    const room = groupCallRooms[conversationId];
    if (!room) return;

    const requester = store.USERS[socket.userId];
    const requesterInfo = {
      userId: socket.userId,
      name: requester?.name || "Người dùng",
      avatar: requester?.avatar || "",
    };

    socket.to(`call:${conversationId}`).emit("group-call:type-change-request", {
      conversationId,
      newCallType,
      requester: requesterInfo,
    });
  });

  socket.on("group-call:type-change-accept", (data) => {
    const { conversationId, newCallType, to } = data;
    if (!socket.userId || !conversationId) return;
    if (to) {
      io.to(`user:${to}`).emit("group-call:type-change-accepted", {
        conversationId,
        newCallType,
        from: socket.userId,
      });
    }
  });

  socket.on("group-call:type-change-reject", (data) => {
    const { conversationId, to } = data;
    if (!socket.userId || !conversationId) return;
    if (to) {
      io.to(`user:${to}`).emit("group-call:type-change-rejected", {
        conversationId,
        from: socket.userId,
      });
    }
  });

  socket.on("group-call:type-change", (data) => {
    const { conversationId, newCallType } = data;
    if (!socket.userId || !conversationId) return;
    const room = groupCallRooms[conversationId];
    if (!room) return;
    room.callType = newCallType;
    io.to(`call:${conversationId}`).emit("group-call:type-changed", {
      conversationId,
      newCallType,
      changedBy: socket.userId,
    });
    broadcastRoomStatus(conversationId);
  });

  // ════════════════════════════════════════════════════════════
  // GROUP CALL
  // ════════════════════════════════════════════════════════════

  socket.on("group-call:join", async (data) => {
    const { conversationId, callType, callerInfo } = data;
    if (!socket.userId || !conversationId) return;

    const roomKey = `call:${conversationId}`;
    socket.join(roomKey);

    if (!groupCallRooms[conversationId]) {
      groupCallRooms[conversationId] = {
        callType,
        participants: new Map(),
        startedAt: Date.now(),
        connectedAt: null,
        declinedCount: 0,
        totalInvited: 0,
        logWritten: false,
        callerId: socket.userId,
        callerName:
          callerInfo?.name || store.USERS[socket.userId]?.name || "Người dùng",
        callerAvatar:
          callerInfo?.avatar || store.USERS[socket.userId]?.avatar || "",
      };
    }

    const room = groupCallRooms[conversationId];

    // Load user info từ MongoDB nếu không có trong store
    let callerName = callerInfo?.name || store.USERS[socket.userId]?.name;
    let callerAvatar = callerInfo?.avatar || store.USERS[socket.userId]?.avatar || "";
    if (!callerName) {
      try {
        const mongoose = require("mongoose");
        if (mongoose.connection.readyState === 1) {
          const User = require("../models/User.model");
          const dbUser = await User.findById(socket.userId).select("name avatar").lean();
          if (dbUser) {
            callerName = dbUser.name;
            callerAvatar = dbUser.avatar || "";
            store.USERS[socket.userId] = {
              ...store.USERS[socket.userId],
              name: dbUser.name,
              avatar: dbUser.avatar,
            };
          }
        }
      } catch (e) {}
    }
    callerName = callerName || "Người dùng";

    const participantInfo = {
      userId: socket.userId,
      name: callerName,
      avatar: callerAvatar,
      socketId: socket.id,
    };

    const existingParticipants = [...room.participants.values()];
    room.participants.set(socket.userId, participantInfo);

    if (room.participants.size === 2 && !room.connectedAt) {
      room.connectedAt = Date.now();
    }

    console.log(
      `👥 Group call join: ${socket.userId} → conv:${conversationId}, members: ${room.participants.size}`,
    );

    socket.emit("group-call:existing-participants", {
      conversationId,
      callType: room.callType,
      participants: existingParticipants,
    });

    socket.to(roomKey).emit("group-call:participant-joined", {
      conversationId,
      participant: participantInfo,
    });

    // Notify group members khi người đầu tiên join
    if (room.participants.size === 1) {
      const { conv, participants } = await getConversationParticipants(conversationId);
      if (conv) {
        room.totalInvited = participants.length - 1;
        room.declinedCount = 0;

        if (room.callerName === "Người dùng" && callerName !== "Người dùng") {
          room.callerName = callerName;
          room.callerAvatar = callerAvatar;
        }

        participants.forEach((member) => {
          const mId =
            typeof member === "object"
              ? member._id?.toString() || member.toString()
              : member.toString();
          if (mId !== socket.userId) {
            io.to(`user:${mId}`).emit("group-call:incoming", {
              conversationId,
              callType: room.callType,
              callerInfo: participantInfo,
              groupName: conv.name || "Nhóm",
            });
            console.log(`📣 Sent group-call:incoming to user:${mId} for conv:${conversationId}`);
          }
        });
      } else {
        console.warn(`⚠️ Conversation ${conversationId} not found in store or MongoDB`);
      }
    }

    broadcastRoomStatus(conversationId);
  });

  socket.on("group-call:offer", (data) => {
    const { to, conversationId, offer } = data;
    if (!socket.userId || !to) return;
    const caller = store.USERS[socket.userId];
    io.to(`user:${to}`).emit("group-call:offer", {
      from: socket.userId,
      conversationId,
      offer,
      callerInfo: {
        userId: socket.userId,
        name: caller?.name || "Người dùng",
        avatar: caller?.avatar || "",
      },
    });
  });

  socket.on("group-call:answer", (data) => {
    const { to, conversationId, answer } = data;
    if (!socket.userId || !to) return;
    io.to(`user:${to}`).emit("group-call:answer", {
      from: socket.userId,
      conversationId,
      answer,
    });
  });

  socket.on("group-call:ice-candidate", (data) => {
    const { to, conversationId, candidate } = data;
    if (!socket.userId || !to || !candidate) return;
    io.to(`user:${to}`).emit("group-call:ice-candidate", {
      from: socket.userId,
      conversationId,
      candidate,
    });
  });

  socket.on("group-call:leave", async (data) => {
    const { conversationId } = data;
    if (!socket.userId || !conversationId) return;

    const roomKey = `call:${conversationId}`;
    socket.leave(roomKey);

    const room = groupCallRooms[conversationId];
    if (!room) return;

    const wasOnlyOne =
      room.participants.size === 1 && room.participants.has(socket.userId);
    room.participants.delete(socket.userId);

    console.log(
      `👋 Group call leave: ${socket.userId}, remaining: ${room.participants.size}`,
    );

    io.to(roomKey).emit("group-call:participant-left", {
      conversationId,
      userId: socket.userId,
    });

    if (room.participants.size === 0) {
      await endGroupCallRoom(conversationId, room);

      if (wasOnlyOne) {
        const { participants } = await getConversationParticipants(conversationId);
        participants.forEach((member) => {
          const mId =
            typeof member === "object"
              ? member._id?.toString() || member.toString()
              : member.toString();
          if (mId !== socket.userId) {
            io.to(`user:${mId}`).emit("group-call:cancelled", {
              conversationId,
            });
          }
        });
      }
    } else if (room.participants.size === 1) {
      console.log(
        `⚠️ Only 1 participant left in conv:${conversationId} — ending group call`,
      );
      await endGroupCallRoom(conversationId, room);
    }

    broadcastRoomStatus(conversationId);
  });

  socket.on("group-call:decline", async (data) => {
    const { conversationId } = data;
    if (!socket.userId || !conversationId) return;
    const roomKey = `call:${conversationId}`;
    io.to(roomKey).emit("group-call:participant-declined", {
      conversationId,
      userId: socket.userId,
    });

    const room = groupCallRooms[conversationId];
    if (!room) return;

    if (room.participants.size === 1) {
      room.declinedCount = (room.declinedCount || 0) + 1;

      if (room.totalInvited === 0) {
        const { participants } = await getConversationParticipants(conversationId);
        room.totalInvited = Math.max(participants.length - 1, 1);
      }

      console.log(
        `👎 Decline ${room.declinedCount}/${room.totalInvited} for conv:${conversationId}`,
      );

      if (room.totalInvited > 0 && room.declinedCount >= room.totalInvited) {
        console.log(`❌ All declined for conv:${conversationId} — ending call`);
        await endGroupCallRoom(conversationId, room, "missed");
        io.to(roomKey).emit("group-call:all-declined", { conversationId });
      }
    }
  });

  socket.on("group-call:query-status", (data) => {
    const { conversationId } = data;
    if (!conversationId) return;
    const room = groupCallRooms[conversationId];
    socket.emit("group-call:room-status", {
      conversationId,
      isActive: !!(room && room.participants.size >= 1),
      callType: room?.callType || null,
      participantCount: room?.participants.size || 0,
      participants: room
        ? [...room.participants.values()].map((p) => ({
            userId: p.userId,
            name: p.name,
            avatar: p.avatar,
          }))
        : [],
    });
  });

  // Disconnect → auto-leave all group call rooms
  socket.on("disconnect", async () => {
    for (const [convId, room] of Object.entries(groupCallRooms)) {
      if (!room.participants.has(socket.userId)) continue;

      const wasOnlyOne = room.participants.size === 1;
      room.participants.delete(socket.userId);
      io.to(`call:${convId}`).emit("group-call:participant-left", {
        conversationId: convId,
        userId: socket.userId,
      });

      if (room.participants.size === 0) {
        await endGroupCallRoom(convId, room);
        if (wasOnlyOne) {
          const { participants } = await getConversationParticipants(convId);
          participants.forEach((member) => {
            const mId =
              typeof member === "object"
                ? member._id?.toString() || member.toString()
                : member.toString();
            if (mId !== socket.userId)
              io.to(`user:${mId}`).emit("group-call:cancelled", {
                conversationId: convId,
              });
          });
        }
      } else if (room.participants.size === 1) {
        console.log(
          `⚠️ Disconnect: only 1 left in conv:${convId} — ending group call`,
        );
        await endGroupCallRoom(convId, room);
      }

      broadcastRoomStatus(convId);
    }
  });

  // ════════════════════════════════════════════════════════════
  // CALL LOG  (1-1 only)
  // ════════════════════════════════════════════════════════════

  socket.on("call:log", (data) => {
    const {
      conversationId,
      callType,
      direction,
      status,
      duration,
      callerId,
      callerName,
      callerAvatar,
    } = data;
    if (!socket.userId || !conversationId) return;
    const conv = store.CONVERSATIONS[conversationId];
    if (!conv) return;

    if (conv.type === "group") {
      console.log(
        `⏭ call:log skipped for group conv:${conversationId} (server-managed)`,
      );
      return;
    }

    const logUserId = callerId || socket.userId;
    const logUser = store.USERS[logUserId];
    const logName = callerName || logUser?.name || "Người dùng";
    const logAvatar = callerAvatar || logUser?.avatar || "";

    const formatDur = (s) => {
      if (!s || s <= 0) return null;
      const m = Math.floor(s / 60),
        sec = s % 60;
      return m > 0 ? `${m} phút ${sec} giây` : `${sec} giây`;
    };

    const buildContent = () => {
      const label = callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại";
      const dur = formatDur(duration);
      switch (status) {
        case "completed":
          return dur ? `${label} • ${dur}` : label;
        case "missed":
          return direction === "outgoing"
            ? `${label} không được trả lời`
            : "Cuộc gọi nhỡ";
        case "cancelled":
          return direction === "outgoing"
            ? `Bạn đã hủy ${label.toLowerCase()}`
            : `${label} đã bị hủy`;
        case "rejected":
          return direction === "outgoing"
            ? `${label} bị từ chối`
            : `Bạn đã từ chối ${label.toLowerCase()}`;
        default:
          return label;
      }
    };

    const callMsg = {
      _id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      conversationId,
      type: "call",
      callType,
      callStatus: status,
      callDirection: direction,
      callDuration: duration || 0,
      content: buildContent(),
      senderId: {
        _id: logUserId,
        name: logName,
        avatar: logAvatar,
      },
      createdAt: new Date(),
      reactions: [],
    };

    if (!store.MESSAGES[conversationId]) store.MESSAGES[conversationId] = [];
    store.MESSAGES[conversationId].push(callMsg);

    conv.lastMessage = {
      _id: callMsg._id,
      type: "call",
      callType,
      callStatus: status,
      content: callMsg.content,
      senderId: callMsg.senderId,
      createdAt: callMsg.createdAt,
    };

    io.to(`conversation:${conversationId}`).emit("message:new", callMsg);
    io.to(`conversation:${conversationId}`).emit("conversation:lastMessage", {
      conversationId,
      lastMessage: conv.lastMessage,
    });
  });
};

handler.pendingCalls = pendingCalls;
module.exports = handler;