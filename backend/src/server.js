const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs");
const upload = require("./middlewares/upload.middleware");

dotenv.config();

const { connectDB } = require("./config/database.config");
const authRoutes = require("./routes/auth.routes");
const authMiddleware = require("./middlewares/auth.middleware");

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/uploads", express.static("uploads"));
app.use("/api/auth", authRoutes);

const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const pubClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
});
const subClient = pubClient.duplicate();

const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
});

Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log("✓ Socket.IO Redis Adapter enabled");
  })
  .catch((err) => {
    console.error("✗ Redis Adapter failed, running without it:", err.message);
  });

app.set("io", io);

const store = require("./inMemoryStore");

// ===== CONVERSATIONS =====
const convRouter = express.Router();
convRouter.use(authMiddleware);

// ✅ Route cụ thể TRƯỚC, route có :param SAU
convRouter.get("/", async (req, res) => {
  const userId = req.user.id;

  try {
    // Lấy friends từ MongoDB và tạo conversation trong store nếu chưa có
    const User = require("./models/User.model");
    const me = await User.findById(userId).populate(
      "friends",
      "_id name email avatar status",
    );

    if (me && me.friends && me.friends.length > 0) {
      for (const friend of me.friends) {
        const friendId = friend._id.toString();

        // Đồng bộ friend vào store.USERS
        store.USERS[friendId] = {
          _id: friendId,
          name: friend.name,
          email: friend.email,
          avatar: friend.avatar,
          status: friend.status || "offline",
        };
        store.USERS[userId] = {
          _id: userId,
          name: me.name,
          email: me.email,
          avatar: me.avatar,
          status: me.status || "offline",
        };

        // Tạo conversation nếu chưa có
        const exists = Object.values(store.CONVERSATIONS).find(
          (c) =>
            c.type === "private" &&
            c.participants.includes(userId) &&
            c.participants.includes(friendId),
        );

        if (!exists) {
          // Tìm hoặc tạo trong MongoDB
          const Conversation = require("./models/Conversation.model");
          let dbConv = await Conversation.findOne({
            type: "private",
            participants: { $all: [userId, friendId] },
          });
          if (!dbConv) {
            dbConv = await Conversation.create({
              type: "private",
              participants: [userId, friendId],
              isActive: true,
            });
          }
          const convId = dbConv._id.toString();
          store.CONVERSATIONS[convId] = {
            _id: convId,
            type: "private",
            participants: [userId, friendId],
            isActive: true,
            createdAt: dbConv.createdAt,
            updatedAt: dbConv.updatedAt,
            lastMessage: null,
          };
          store.MESSAGES[convId] = [];
        }
      }
    }
  } catch (e) {
    console.error("Sync friends to store error:", e);
  }

  // Load group conversations từ MongoDB
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState === 1) {
      const Conversation = require("./models/Conversation.model");
      const Message = require("./models/Message.model");

      const dbConvs = await Conversation.find({
        participants: userId,
        isActive: true,
      })
        .populate("participants", "_id name email avatar status")
        .lean();

      for (const dbConv of dbConvs) {
        const convId = dbConv._id.toString();
        if (!store.CONVERSATIONS[convId]) {
          // Sync participants vào store.USERS
          dbConv.participants.forEach((p) => {
            const pid = p._id.toString();
            store.USERS[pid] = {
              _id: pid,
              name: p.name,
              email: p.email,
              avatar: p.avatar || "",
              status: store.USERS[pid]?.status || "offline",
            };
          });

          // Lấy lastMessage
          let lastMessage = null;
          if (dbConv.lastMessage) {
            const lastMsg = await Message.findById(dbConv.lastMessage)
              .populate("senderId", "name avatar")
              .lean();
            if (lastMsg) {
              lastMessage = {
                _id: lastMsg._id.toString(),
                content: lastMsg.content,
                type: lastMsg.type,
                senderId: lastMsg.senderId,
                createdAt: lastMsg.createdAt,
                fileName: lastMsg.fileName,
                fileUrl: lastMsg.fileUrl, // ← thêm
                caption: lastMsg.caption, // ← thêm
                images: lastMsg.images, // ← thêm
              };
            }
          }

          store.CONVERSATIONS[convId] = {
            _id: convId,
            type: dbConv.type,
            name: dbConv.name || "",
            avatar: dbConv.avatar || "",
            participants: dbConv.participants.map((p) => p._id.toString()),
            adminId: dbConv.adminId?.toString(),
            moderators: (dbConv.moderators || []).map((m) => m.toString()),
            isActive: true,
            isDissolved: dbConv.isDissolved || false,
            createdAt: dbConv.createdAt,
            updatedAt: dbConv.updatedAt,
            lastMessage,
            deletedFor: dbConv.deletedFor
              ? Object.fromEntries(dbConv.deletedFor)
              : {},
            deletedAt: dbConv.deletedFor
              ? Object.fromEntries(
                  [...dbConv.deletedFor.entries()].map(([k, v]) => [
                    k,
                    v.toISOString(),
                  ]),
                )
              : {},
          };
          store.MESSAGES[convId] = store.MESSAGES[convId] || [];
        } else {
          // LUÔN cập nhật lastMessage từ DB mỗi khi load
          if (dbConv.lastMessage) {
            try {
              const lastMsg = await Message.findById(dbConv.lastMessage)
                .populate("senderId", "name avatar")
                .lean();
              if (lastMsg) {
                store.CONVERSATIONS[convId].lastMessage = {
                  _id: lastMsg._id.toString(),
                  content: lastMsg.content,
                  type: lastMsg.type,
                  senderId: lastMsg.senderId,
                  createdAt: lastMsg.createdAt,
                  fileName: lastMsg.fileName,
                  fileUrl: lastMsg.fileUrl,
                  caption: lastMsg.caption,
                  images: lastMsg.images,
                  voiceDuration: lastMsg.voiceDuration,
                  isRecalled: lastMsg.isRecalled,
                };
              }
            } catch (e) {}
          }
        }
      }

      // Tạo MyDoc nếu chưa có trong DB
      const myDocExists = await Conversation.findOne({
        type: "mydoc",
        participants: userId,
      });
      if (!myDocExists) {
        const newMyDoc = await Conversation.create({
          type: "mydoc",
          participants: [userId],
          name: "My Document",
          isActive: true,
        });
        const myDocId = newMyDoc._id.toString();
        store.CONVERSATIONS[myDocId] = {
          _id: myDocId,
          type: "mydoc",
          name: "My Document",
          participants: [userId],
          isActive: true,
          createdAt: newMyDoc.createdAt,
          updatedAt: newMyDoc.updatedAt,
          lastMessage: null,
        };
        store.MESSAGES[myDocId] = [];
      } else {
        const myDocId = myDocExists._id.toString();
        if (!store.CONVERSATIONS[myDocId]) {
          store.CONVERSATIONS[myDocId] = {
            _id: myDocId,
            type: "mydoc",
            name: "My Document",
            participants: [userId],
            isActive: true,
            createdAt: myDocExists.createdAt,
            updatedAt: myDocExists.updatedAt,
            lastMessage: null,
          };
          store.MESSAGES[myDocId] = [];
        }
      }
    }
  } catch (e) {
    console.error("Sync MongoDB conversations error:", e);
  }

  try {
    const conversationService = require("./services/conversation.service");
    const dbConversations =
      await conversationService.getUserConversations(userId);
    res.json({ success: true, data: dbConversations });
  } catch (e) {
    console.error("getUserConversations error:", e);
    const conversations = store.getUserConversations(userId).filter((conv) => {
      const deletedAt = conv.deletedAt?.[userId] || conv.deletedFor?.[userId];
      if (!deletedAt) return true;
      // Nếu có tin nhắn mới sau khi xóa → hiện lại
      const msgs = store.MESSAGES[conv._id] || [];
      const hasNewMsg = msgs.some(
        (m) => new Date(m.createdAt) > new Date(deletedAt),
      );
      return hasNewMsg;
    });
    res.json({ success: true, data: conversations });
  }
});

convRouter.post("/private", (req, res) => {
  const { participantId } = req.body;
  const userId = req.user.id;
  const conv = Object.values(store.CONVERSATIONS).find(
    (c) =>
      c.participants.includes(userId) && c.participants.includes(participantId),
  );
  if (conv)
    return res.json({
      success: true,
      data: store.getConversationById(conv._id, userId),
    });
  res.status(400).json({ success: false, message: "Cannot create" });
});

convRouter.post("/group", async (req, res) => {
  const { name, participantIds, avatar } = req.body;
  const userId = req.user.id;

  if (!name || !participantIds || participantIds.length < 1) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin" });
  }

  try {
    const Conversation = require("./models/Conversation.model");
    const allParticipants = [
      userId,
      ...participantIds.filter((id) => id !== userId),
    ];

    const conversation = await Conversation.create({
      type: "group",
      name,
      participants: allParticipants,
      adminId: userId,
      ...(avatar ? { avatar } : {}),
    });

    await conversation.populate("participants", "name avatar email");

    // ✅ Đồng bộ TẤT CẢ participants vào store.USERS kể cả người chưa kết bạn
    conversation.participants.forEach((p) => {
      const pid = p._id.toString();
      store.USERS[pid] = {
        _id: pid,
        name: p.name,
        email: p.email,
        avatar: p.avatar || "",
        status: store.USERS[pid]?.status || "offline",
      };
    });

    const convId = conversation._id.toString();

    store.CONVERSATIONS[convId] = {
      _id: convId,
      type: "group",
      name,
      avatar: avatar || "",
      participants: allParticipants,
      adminId: userId,
      isActive: true,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessage: null,
    };

    store.MESSAGES[convId] = [];

    // ✅ Emit real-time cho tất cả thành viên
    allParticipants.forEach((participantId) => {
      io.to(`user:${participantId}`).emit("conversation:new", {
        ...conversation.toObject(),
        _id: convId,
      });
      io.sockets.sockets.forEach((s) => {
        if (s.userId === participantId?.toString()) {
          s.join(`conversation:${convId}`);
        }
      });
    });

    res.json({ success: true, data: conversation });
  } catch (err) {
    console.error("Create group error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Route có :param ở SAU
convRouter.get("/:id", (req, res) => {
  const conv = store.getConversationById(req.params.id, req.user.id);
  if (!conv)
    return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: conv });
});

const uploadMiddleware = require("./middlewares/upload.middleware");
convRouter.patch(
  "/:id",
  uploadMiddleware.single("groupAvatar"),
  async (req, res) => {
    const convId = req.params.id;
    const userId = req.user.id;

    let conv = store.CONVERSATIONS[convId];
    if (!conv) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    if (conv.isDissolved) {
      return res
        .status(403)
        .json({ success: false, message: "Nhóm đã bị giải tán" });
    }

    const { name } = req.body;
    let avatar = req.body.avatar;

    // Upload file nếu có
    if (req.file) {
      const path = require("path");
      const ext = path.extname(req.file.originalname) || ".jpg";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      const uploadDir = path.join(__dirname, "../uploads/image");
      fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
      avatar = `/uploads/image/${filename}`;
    }

    // Cập nhật store
    if (name) conv.name = name;
    if (avatar !== undefined) conv.avatar = avatar;

    // Cập nhật MongoDB
    try {
      const Conversation = require("./models/Conversation.model");
      await Conversation.findByIdAndUpdate(convId, {
        ...(name ? { name } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
      });
    } catch (err) {
      console.error("Update group MongoDB error:", err);
    }

    // Emit system message nếu đổi avatar
    if (req.file || (avatar && avatar !== conv.avatar)) {
      const changer = store.USERS[userId];
      const changerName = changer?.name || "Người dùng";
      const Message = require("./models/Message.model");
      const savedAvatarMsg = await Message.create({
        conversationId: convId,
        type: "system",
        content: `${changerName} đã thay đổi ảnh đại diện nhóm`,
        changerId: userId,
        changerName,
        senderId: null,
        reactions: [],
      });
      await require("./models/Conversation.model").findByIdAndUpdate(convId, {
        lastMessage: savedAvatarMsg._id,
      });
      const sysMsg = {
        _id: savedAvatarMsg._id.toString(),
        conversationId: convId,
        type: "system",
        content: savedAvatarMsg.content,
        changerId: userId,
        changerName,
        senderId: null,
        createdAt: savedAvatarMsg.createdAt,
        reactions: [],
      };
      if (!store.MESSAGES[convId]) store.MESSAGES[convId] = [];
      store.MESSAGES[convId].push(sysMsg);

      conv.lastMessage = {
        _id: sysMsg._id,
        type: "system",
        content: sysMsg.content,
        changerId: userId,
        changerName,
        senderId: null,
        createdAt: sysMsg.createdAt,
      };

      io.to(`conversation:${convId}`).emit("message:system", sysMsg);
      io.to(`conversation:${convId}`).emit("conversation:lastMessage", {
        conversationId: convId,
        lastMessage: conv.lastMessage,
      });
    }

    // Emit updated info cho tất cả
    // Emit updated info
    io.to(`conversation:${convId}`).emit("conversation:updated_info", {
      _id: convId,
      name: conv.name,
      avatar: conv.avatar,
      adminId: conv.adminId,
      moderators: conv.moderators,
      participants: conv.participants,
    });

    // Emit system message khi đổi tên nhóm
    if (name) {
      const changer = store.USERS[userId];
      const changerName = changer?.name || "Người dùng";
      const Message = require("./models/Message.model");
      const savedNameMsg = await Message.create({
        conversationId: convId,
        type: "system",
        content: `${changerName} đã đổi tên nhóm thành "${name}"`,
        changerId: userId,
        changerName,
        senderId: null,
        reactions: [],
      });
      await require("./models/Conversation.model").findByIdAndUpdate(convId, {
        lastMessage: savedNameMsg._id,
      });
      const sysMsg = {
        _id: savedNameMsg._id.toString(),
        conversationId: convId,
        type: "system",
        content: savedNameMsg.content,
        changerId: userId,
        changerName,
        senderId: null,
        createdAt: savedNameMsg.createdAt,
        reactions: [],
      };
      if (!store.MESSAGES[convId]) store.MESSAGES[convId] = [];
      store.MESSAGES[convId].push(sysMsg);

      io.to(`conversation:${convId}`).emit("message:system", sysMsg);

      conv.lastMessage = {
        _id: sysMsg._id,
        type: "system",
        subType: "group_renamed",
        content: sysMsg.content,
        changerId: userId,
        changerName,
        senderId: null,
        createdAt: sysMsg.createdAt,
      };
      io.to(`conversation:${convId}`).emit("conversation:lastMessage", {
        conversationId: convId,
        lastMessage: conv.lastMessage,
      });
    }

    res.json({ success: true, data: conv });
  },
);

convRouter.patch("/:id/wallpaper", async (req, res) => {
  const convId = req.params.id;
  const { wallpaper } = req.body;
  const userId = req.user.id;

  const conv = store.CONVERSATIONS[convId];
  if (!conv) return res.status(404).json({ success: false });
  if (!conv.participants.includes(userId))
    return res.status(403).json({ success: false });
  if (conv.isDissolved)
    return res
      .status(403)
      .json({ success: false, message: "Nhóm đã bị giải tán" });

  // Lưu wallpaper vào store (để broadcast cho người khác qua socket)
  conv.wallpaper = wallpaper || null;

  // Lấy tên user từ MongoDB
  let changerName = "Người dùng";
  let changerAvatar = "";
  try {
    const User = require("./models/User.model");
    const dbUser = await User.findById(userId).select("name avatar").lean();
    if (dbUser) {
      changerName = dbUser.name || "Người dùng";
      changerAvatar = dbUser.avatar || "";
      store.USERS[userId] = {
        ...store.USERS[userId],
        name: changerName,
        avatar: changerAvatar,
      };
    }
  } catch (e) {
    const storeUser = store.USERS[userId];
    changerName = storeUser?.name || "Người dùng";
    changerAvatar = storeUser?.avatar || "";
  }

  const isSet = wallpaper && wallpaper !== "";
  const wallpaperContent = isSet
    ? `${changerName} đã thay đổi ảnh nền cuộc hội thoại`
    : `${changerName} đã xóa ảnh nền cuộc hội thoại`;

  // Lưu system message vào MongoDB
  const Message = require("./models/Message.model");
  const savedWpMsg = await Message.create({
    conversationId: convId,
    type: "system",
    subType: "wallpaper_changed",
    content: wallpaperContent,
    changerId: userId,
    changerName,
    senderId: null,
    reactions: [],
  });
  await require("./models/Conversation.model").findByIdAndUpdate(convId, {
    lastMessage: savedWpMsg._id,
  });

  const sysMsg = {
    _id: savedWpMsg._id.toString(),
    conversationId: convId,
    type: "system",
    subType: "wallpaper_changed",
    content: wallpaperContent,
    changerId: userId,
    changerName,
    wallpaper: isSet ? wallpaper : "",
    addedUserAvatar: changerAvatar,
    senderId: null,
    createdAt: savedWpMsg.createdAt,
    reactions: [],
  };

  if (!store.MESSAGES[convId]) store.MESSAGES[convId] = [];
  store.MESSAGES[convId].push(sysMsg);

  conv.lastMessage = {
    _id: sysMsg._id,
    type: "system",
    subType: "wallpaper_changed",
    content: wallpaperContent,
    changerId: userId,
    changerName,
    senderId: null,
    createdAt: sysMsg.createdAt,
  };

  // Emit system message (thông báo ở giữa chat)
  io.to(`conversation:${convId}`).emit("message:system", sysMsg);

  // Emit wallpaper_changed cho TẤT CẢ người trong phòng kể cả người gửi
  // Kèm theo wallpaper thật để người khác lưu vào localStorage của họ
  io.to(`conversation:${convId}`).emit("conversation:wallpaper_changed", {
    conversationId: convId,
    wallpaper: isSet ? wallpaper : null,
    changerId: userId,
  });

  io.to(`conversation:${convId}`).emit("conversation:lastMessage", {
    conversationId: convId,
    lastMessage: conv.lastMessage,
  });

  res.json({ success: true, wallpaper: conv.wallpaper });
});

convRouter.post("/:id/pin", (req, res) => {
  const conv = store.CONVERSATIONS[req.params.id];
  if (!conv)
    return res.status(404).json({ success: false, message: "Not found" });
  conv.isPinned = !conv.isPinned;
  res.json({ success: true, data: { isPinned: conv.isPinned } });
});

convRouter.post("/:id/mute", (req, res) => {
  const conv = store.CONVERSATIONS[req.params.id];
  if (!conv)
    return res.status(404).json({ success: false, message: "Not found" });
  conv.isMuted = !conv.isMuted;
  conv.mutedUntil = req.body.mutedUntil || null;
  res.json({ success: true, data: { isMuted: conv.isMuted } });
});

convRouter.post("/:id/add-members", async (req, res) => {
  const convId = req.params.id;
  const { memberIds, adderName } = req.body;
  const userId = req.user.id;

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "memberIds required" });
  }

  // ✅ Tìm trong store trước, không có thì tìm MongoDB
  let conv = store.CONVERSATIONS[convId];

  if (!conv) {
    try {
      const Conversation = require("./models/Conversation.model");
      const dbConv = await Conversation.findById(convId).populate(
        "participants",
        "_id name email avatar status",
      );
      if (!dbConv) {
        return res
          .status(404)
          .json({ success: false, message: "Conversation not found" });
      }
      // Đồng bộ participants vào store.USERS
      dbConv.participants.forEach((p) => {
        const uid = p._id.toString();
        store.USERS[uid] = {
          _id: uid,
          name: p.name,
          email: p.email,
          avatar: p.avatar,
          status: p.status || "offline",
        };
      });
      store.CONVERSATIONS[convId] = {
        _id: convId,
        type: dbConv.type,
        name: dbConv.name,
        participants: dbConv.participants.map((p) => p._id.toString()),
        adminId: dbConv.adminId?.toString(),
        isActive: true,
        createdAt: dbConv.createdAt,
        updatedAt: dbConv.updatedAt,
        lastMessage: null,
      };
      store.MESSAGES[convId] = store.MESSAGES[convId] || [];
      conv = store.CONVERSATIONS[convId];
    } catch (err) {
      console.error("Sync conversation from MongoDB error:", err);
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }
  }
  if (conv.type !== "group") return res.status(400).json({ success: false });

  const adder = store.USERS[userId];
  const adderDisplayName = adder?.name || adderName || "Người dùng";
  const newMembers = [];

  memberIds.forEach((memberId) => {
    if (!conv.participants.includes(memberId)) {
      conv.participants.push(memberId);
      if (!store.MESSAGES[convId]) store.MESSAGES[convId] = [];
      newMembers.push(memberId);
    }
  });

  // Fetch tất cả user mới từ MongoDB trước để đảm bảo có name
  const mongoose = require("mongoose");
  if (mongoose.connection.readyState === 1) {
    const User = require("./models/User.model");
    const dbUsers = await User.find({ _id: { $in: newMembers } })
      .select("_id name email avatar status")
      .lean();
    dbUsers.forEach((dbUser) => {
      const uid = dbUser._id.toString();
      store.USERS[uid] = {
        _id: uid,
        name: dbUser.name,
        email: dbUser.email,
        avatar: dbUser.avatar,
        status: dbUser.status || "offline",
      };
    });
  }

  // Tạo tin nhắn hệ thống cho mỗi người được thêm
  for (const memberId of newMembers) {
    const addedUser = store.USERS[memberId];
    const Message = require("./models/Message.model");
    const savedAddMsg = await Message.create({
      conversationId: convId,
      type: "system",
      content: `${addedUser?.name || "Người dùng"} được ${adderDisplayName} thêm vào nhóm`,
      changerId: userId,
      changerName: adderDisplayName,
      targetId: memberId,
      targetName: addedUser?.name || "Người dùng",
      senderId: null,
      reactions: [],
    });
    await require("./models/Conversation.model").findByIdAndUpdate(convId, {
      lastMessage: savedAddMsg._id,
    });
    const sysMsg = {
      _id: savedAddMsg._id.toString(),
      conversationId: convId,
      type: "system",
      content: savedAddMsg.content,
      changerId: userId,
      changerName: adderDisplayName,
      targetId: memberId,
      targetName: addedUser?.name || "Người dùng",
      addedUserAvatar: addedUser?.avatar || null,
      senderId: null,
      createdAt: savedAddMsg.createdAt,
      reactions: [],
    };
    store.MESSAGES[convId].push(sysMsg);

    // Emit tin nhắn hệ thống realtime
    io.to(`conversation:${convId}`).emit("message:system", sysMsg);

    // Thêm member mới vào room
    io.sockets.sockets.forEach((s) => {
      if (s.userId === memberId) {
        s.join(`conversation:${convId}`);
      }
    });

    // Gửi conversation mới cho member vừa được thêm
    const memberConv = store.getConversationById(convId, memberId);
    io.to(`user:${memberId}`).emit("conversation:new", memberConv);
  }

  // Emit cập nhật conversation cho tất cả thành viên hiện tại
  // Lấy tin nhắn system cuối cùng để hiện sidebar
  // ✅ Lưu participants mới vào MongoDB
  try {
    const Conversation = require("./models/Conversation.model");
    await Conversation.findByIdAndUpdate(convId, {
      $addToSet: { participants: { $each: newMembers } },
    });
  } catch (err) {
    console.error("Failed to persist new members to MongoDB:", err);
  }

  // Emit cập nhật conversation cho tất cả thành viên hiện tại
  // Lấy tin nhắn system cuối cùng để hiện sidebar
  const lastSysMsg = store.MESSAGES[convId]
    .filter((m) => m.type === "system")
    .at(-1);

  if (lastSysMsg) {
    conv.lastMessage = {
      _id: lastSysMsg._id,
      type: "system",
      content: lastSysMsg.content,
      senderId: null,
      createdAt: lastSysMsg.createdAt,
    };
  }

  // Emit cập nhật conversation cho tất cả thành viên hiện tại
  conv.participants.forEach((pid) => {
    const updatedConv = store.getConversationById(convId, pid);

    // Đảm bảo participants có đủ name từ store.USERS
    const enrichedParticipants = conv.participants.map((p) => {
      const u = store.USERS[p] || store.USERS[p?.toString()];
      return {
        _id: p,
        name: u?.name || "",
        avatar: u?.avatar || "",
        email: u?.email || "",
      };
    });

    io.to(`user:${pid}`).emit("conversation:updated_info", {
      ...updatedConv,
      participants: enrichedParticipants,
    });
  });

  // Emit lastMessage để sidebar cập nhật
  io.to(`conversation:${convId}`).emit("conversation:lastMessage", {
    conversationId: convId,
    lastMessage: conv.lastMessage,
  });

  res.json({ success: true });
});

// ✅ Chuyển quyền trưởng nhóm
convRouter.post("/:id/transfer", async (req, res) => {
  const convId = req.params.id;
  const { newAdminId } = req.body;
  const userId = req.user.id;

  if (!newAdminId) {
    return res
      .status(400)
      .json({ success: false, message: "newAdminId required" });
  }

  // Tìm trong store, nếu không có thì load từ MongoDB
  let conv = store.CONVERSATIONS[convId];
  if (!conv) {
    try {
      const Conversation = require("./models/Conversation.model");
      const dbConv = await Conversation.findById(convId);
      if (!dbConv)
        return res
          .status(404)
          .json({ success: false, message: "Không tìm thấy nhóm" });
      store.CONVERSATIONS[convId] = {
        _id: convId,
        type: dbConv.type,
        name: dbConv.name,
        participants: dbConv.participants.map((p) => p.toString()),
        adminId: dbConv.adminId?.toString(),
        moderators: (dbConv.moderators || []).map((m) => m.toString()),
        isActive: true,
        createdAt: dbConv.createdAt,
        updatedAt: dbConv.updatedAt,
        lastMessage: null,
      };
      store.MESSAGES[convId] = store.MESSAGES[convId] || [];
      conv = store.CONVERSATIONS[convId];
    } catch (err) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhóm" });
    }
  }

  // Chỉ trưởng nhóm hiện tại mới được chuyển quyền
  const currentAdmin = conv.adminId?.toString
    ? conv.adminId.toString()
    : conv.adminId;
  if (currentAdmin !== userId) {
    return res.status(403).json({
      success: false,
      message: "Chỉ trưởng nhóm mới được chuyển quyền",
    });
  }

  if (!conv.participants.includes(newAdminId)) {
    return res
      .status(400)
      .json({ success: false, message: "Người này không trong nhóm" });
  }

  // Cập nhật store
  conv.adminId = newAdminId;
  // Xóa newAdminId khỏi moderators nếu có
  if (conv.moderators) {
    conv.moderators = conv.moderators.filter(
      (m) => m.toString() !== newAdminId,
    );
  }

  // Lưu vào MongoDB
  try {
    const Conversation = require("./models/Conversation.model");
    await Conversation.findByIdAndUpdate(convId, {
      adminId: newAdminId,
      $pull: { moderators: newAdminId },
    });
  } catch (err) {
    console.error("Transfer ownership MongoDB error:", err);
  }

  // Tạo system message
  const oldAdmin = store.USERS[userId];
  const newAdmin = store.USERS[newAdminId];
  const Message = require("./models/Message.model");
  const savedTransferMsg = await Message.create({
    conversationId: convId,
    type: "system",
    content: `${oldAdmin?.name || "Người dùng"} đã chuyển quyền trưởng nhóm cho ${newAdmin?.name || "Người dùng"}`,
    changerId: userId,
    changerName: oldAdmin?.name || "Người dùng",
    targetId: newAdminId,
    targetName: newAdmin?.name || "Người dùng",
    senderId: null,
    reactions: [],
  });
  await require("./models/Conversation.model").findByIdAndUpdate(convId, {
    lastMessage: savedTransferMsg._id,
  });
  const sysMsg = {
    _id: savedTransferMsg._id.toString(),
    conversationId: convId,
    type: "system",
    content: savedTransferMsg.content,
    changerId: userId,
    changerName: oldAdmin?.name || "Người dùng",
    targetId: newAdminId,
    targetName: newAdmin?.name || "Người dùng",
    senderId: null,
    createdAt: savedTransferMsg.createdAt,
    reactions: [],
  };
  if (!store.MESSAGES[convId]) store.MESSAGES[convId] = [];
  store.MESSAGES[convId].push(sysMsg);

  conv.lastMessage = {
    _id: sysMsg._id,
    type: "system",
    content: sysMsg.content,
    senderId: null,
    createdAt: sysMsg.createdAt,
  };

  // Emit realtime cho cả phòng
  io.to(`conversation:${convId}`).emit("message:system", sysMsg);
  io.to(`conversation:${convId}`).emit("conversation:admin_changed", {
    conversationId: convId,
    newAdminId,
    oldAdminId: userId,
  });
  io.to(`conversation:${convId}`).emit("conversation:lastMessage", {
    conversationId: convId,
    lastMessage: conv.lastMessage,
  });

  res.json({ success: true, data: { adminId: newAdminId } });
});

// ✅ Thêm phó nhóm
convRouter.post("/:id/moderators", async (req, res) => {
  const convId = req.params.id;
  const { userId: targetUserId } = req.body;
  const userId = req.user.id;

  let conv = store.CONVERSATIONS[convId];
  if (!conv) {
    try {
      const Conversation = require("./models/Conversation.model");
      const dbConv = await Conversation.findById(convId);
      if (!dbConv)
        return res
          .status(404)
          .json({ success: false, message: "Không tìm thấy nhóm" });
      store.CONVERSATIONS[convId] = {
        _id: convId,
        type: dbConv.type,
        name: dbConv.name,
        participants: dbConv.participants.map((p) => p.toString()),
        adminId: dbConv.adminId?.toString(),
        moderators: (dbConv.moderators || []).map((m) => m.toString()),
        isActive: true,
        createdAt: dbConv.createdAt,
        updatedAt: dbConv.updatedAt,
        lastMessage: null,
      };
      store.MESSAGES[convId] = store.MESSAGES[convId] || [];
      conv = store.CONVERSATIONS[convId];
    } catch (err) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhóm" });
    }
  }

  const currentAdmin = conv.adminId?.toString
    ? conv.adminId.toString()
    : conv.adminId;
  if (currentAdmin !== userId) {
    return res.status(403).json({
      success: false,
      message: "Chỉ trưởng nhóm mới được bầu phó nhóm",
    });
  }
  if (!conv.participants.includes(targetUserId)) {
    return res
      .status(400)
      .json({ success: false, message: "Người này không trong nhóm" });
  }

  if (!conv.moderators) conv.moderators = [];
  if (!conv.moderators.includes(targetUserId)) {
    conv.moderators.push(targetUserId);
  }

  try {
    const Conversation = require("./models/Conversation.model");
    await Conversation.findByIdAndUpdate(convId, {
      $addToSet: { moderators: targetUserId },
    });
  } catch (err) {
    console.error("Add moderator MongoDB error:", err);
  }

  let adder = store.USERS[userId];
  let target = store.USERS[targetUserId];
  try {
    const User = require("./models/User.model");
    if (!adder?.name) {
      const db = await User.findById(userId).select("name avatar").lean();
      if (db) {
        adder = db;
        store.USERS[userId] = { ...store.USERS[userId], ...db };
      }
    }
    if (!target?.name) {
      const db = await User.findById(targetUserId).select("name avatar").lean();
      if (db) {
        target = db;
        store.USERS[targetUserId] = { ...store.USERS[targetUserId], ...db };
      }
    }
  } catch (e) {}
  const Message = require("./models/Message.model");
  const savedModMsg = await Message.create({
    conversationId: convId,
    type: "system",
    content: `${adder?.name || "Người dùng"} đã bầu ${target?.name || "Người dùng"} làm phó nhóm`,
    changerId: userId,
    changerName: adder?.name || "Người dùng",
    targetId: targetUserId,
    targetName: target?.name || "Người dùng",
    senderId: null,
    reactions: [],
  });
  await require("./models/Conversation.model").findByIdAndUpdate(convId, {
    lastMessage: savedModMsg._id,
  });
  const sysMsg = {
    _id: savedModMsg._id.toString(),
    conversationId: convId,
    type: "system",
    content: savedModMsg.content,
    changerId: userId,
    changerName: adder?.name || "Người dùng",
    targetId: targetUserId,
    targetName: target?.name || "Người dùng",
    senderId: null,
    createdAt: savedModMsg.createdAt,
    reactions: [],
  };
  if (!store.MESSAGES[convId]) store.MESSAGES[convId] = [];
  store.MESSAGES[convId].push(sysMsg);
  conv.lastMessage = {
    _id: sysMsg._id,
    type: "system",
    content: sysMsg.content,
    senderId: null,
    createdAt: sysMsg.createdAt,
  };

  io.to(`conversation:${convId}`).emit("message:system", sysMsg);
  io.to(`conversation:${convId}`).emit("conversation:moderator_added", {
    conversationId: convId,
    moderatorId: targetUserId,
  });
  io.to(`conversation:${convId}`).emit("conversation:lastMessage", {
    conversationId: convId,
    lastMessage: conv.lastMessage,
  });

  res.json({ success: true, data: { moderators: conv.moderators } });
});

// ✅ Xóa phó nhóm
convRouter.delete("/:id/moderators/:targetId", async (req, res) => {
  const convId = req.params.id;
  const targetUserId = req.params.targetId;
  const userId = req.user.id;

  let conv = store.CONVERSATIONS[convId];
  if (!conv) {
    try {
      const Conversation = require("./models/Conversation.model");
      const dbConv = await Conversation.findById(convId);
      if (!dbConv)
        return res
          .status(404)
          .json({ success: false, message: "Không tìm thấy nhóm" });
      store.CONVERSATIONS[convId] = {
        _id: convId,
        type: dbConv.type,
        name: dbConv.name,
        participants: dbConv.participants.map((p) => p.toString()),
        adminId: dbConv.adminId?.toString(),
        moderators: (dbConv.moderators || []).map((m) => m.toString()),
        isActive: true,
        createdAt: dbConv.createdAt,
        updatedAt: dbConv.updatedAt,
        lastMessage: null,
      };
      store.MESSAGES[convId] = store.MESSAGES[convId] || [];
      conv = store.CONVERSATIONS[convId];
    } catch (err) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhóm" });
    }
  }

  const currentAdmin = conv.adminId?.toString
    ? conv.adminId.toString()
    : conv.adminId;
  if (currentAdmin !== userId) {
    return res.status(403).json({
      success: false,
      message: "Chỉ trưởng nhóm mới được xóa phó nhóm",
    });
  }

  conv.moderators = (conv.moderators || []).filter(
    (m) => m.toString() !== targetUserId,
  );

  try {
    const Conversation = require("./models/Conversation.model");
    await Conversation.findByIdAndUpdate(convId, {
      $pull: { moderators: targetUserId },
    });
  } catch (err) {
    console.error("Remove moderator MongoDB error:", err);
  }

  const remover = store.USERS[userId];
  const target = store.USERS[targetUserId];
  const Message = require("./models/Message.model");
  const savedRemModMsg = await Message.create({
    conversationId: convId,
    type: "system",
    content: `${remover?.name || "Người dùng"} đã xóa phó nhóm ${target?.name || "Người dùng"}`,
    changerId: userId,
    changerName: remover?.name || "Người dùng",
    targetId: targetUserId,
    targetName: target?.name || "Người dùng",
    senderId: null,
    reactions: [],
  });
  await require("./models/Conversation.model").findByIdAndUpdate(convId, {
    lastMessage: savedRemModMsg._id,
  });
  const sysMsg = {
    _id: savedRemModMsg._id.toString(),
    conversationId: convId,
    type: "system",
    content: savedRemModMsg.content,
    changerId: userId,
    changerName: remover?.name || "Người dùng",
    targetId: targetUserId,
    targetName: target?.name || "Người dùng",
    senderId: null,
    createdAt: savedRemModMsg.createdAt,
    reactions: [],
  };
  if (!store.MESSAGES[convId]) store.MESSAGES[convId] = [];
  store.MESSAGES[convId].push(sysMsg);
  conv.lastMessage = {
    _id: sysMsg._id,
    type: "system",
    content: sysMsg.content,
    senderId: null,
    createdAt: sysMsg.createdAt,
  };

  io.to(`conversation:${convId}`).emit("message:system", sysMsg);
  io.to(`conversation:${convId}`).emit("conversation:moderator_removed", {
    conversationId: convId,
    moderatorId: targetUserId,
  });
  io.to(`conversation:${convId}`).emit("conversation:lastMessage", {
    conversationId: convId,
    lastMessage: conv.lastMessage,
  });

  res.json({ success: true, data: { moderators: conv.moderators } });
});

// ✅ Xóa thành viên khỏi nhóm
convRouter.delete("/:id/participants/:userId", async (req, res) => {
  const convId = req.params.id;
  const targetUserId = req.params.userId;
  const userId = req.user.id;

  let conv = store.CONVERSATIONS[convId];
  if (!conv) {
    try {
      const Conversation = require("./models/Conversation.model");
      const dbConv = await Conversation.findById(convId);
      if (!dbConv)
        return res
          .status(404)
          .json({ success: false, message: "Không tìm thấy nhóm" });
      store.CONVERSATIONS[convId] = {
        _id: convId,
        type: dbConv.type,
        name: dbConv.name,
        participants: dbConv.participants.map((p) => p.toString()),
        adminId: dbConv.adminId?.toString(),
        moderators: (dbConv.moderators || []).map((m) => m.toString()),
        isActive: true,
        createdAt: dbConv.createdAt,
        updatedAt: dbConv.updatedAt,
        lastMessage: null,
      };
      store.MESSAGES[convId] = store.MESSAGES[convId] || [];
      conv = store.CONVERSATIONS[convId];
    } catch (err) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhóm" });
    }
  }

  const currentAdmin = conv.adminId?.toString
    ? conv.adminId.toString()
    : conv.adminId;
  if (currentAdmin !== userId) {
    return res.status(403).json({
      success: false,
      message: "Chỉ trưởng nhóm mới được xóa thành viên",
    });
  }

  if (!conv.participants.includes(targetUserId)) {
    return res
      .status(400)
      .json({ success: false, message: "Thành viên không trong nhóm" });
  }

  // Xóa khỏi participants và moderators
  conv.participants = conv.participants.filter(
    (p) => p.toString() !== targetUserId,
  );
  conv.moderators = (conv.moderators || []).filter(
    (m) => m.toString() !== targetUserId,
  );

  // Lưu vào MongoDB
  try {
    const Conversation = require("./models/Conversation.model");
    await Conversation.findByIdAndUpdate(convId, {
      $pull: { participants: targetUserId, moderators: targetUserId },
    });
  } catch (err) {
    console.error("Kick member MongoDB error:", err);
  }

  let kicker = store.USERS[userId];
  let target = store.USERS[targetUserId];

  // Fetch từ MongoDB nếu store chưa có
  try {
    const User = require("./models/User.model");
    if (!kicker?.name) {
      const dbKicker = await User.findById(userId).select("name avatar").lean();
      if (dbKicker) {
        kicker = { name: dbKicker.name, avatar: dbKicker.avatar };
        store.USERS[userId] = { ...store.USERS[userId], ...kicker };
      }
    }
    if (!target?.name) {
      const dbTarget = await User.findById(targetUserId)
        .select("name avatar")
        .lean();
      if (dbTarget) {
        target = { name: dbTarget.name, avatar: dbTarget.avatar };
        store.USERS[targetUserId] = { ...store.USERS[targetUserId], ...target };
      }
    }
  } catch (e) {}
  const Message = require("./models/Message.model");
  const savedKickMsg = await Message.create({
    conversationId: convId,
    type: "system",
    content: `${kicker?.name || "Người dùng"} đã xóa ${target?.name || "thành viên"} khỏi nhóm`,
    changerId: userId,
    changerName: kicker?.name || "Người dùng",
    targetId: targetUserId,
    targetName: target?.name || "thành viên",
    senderId: null,
    reactions: [],
  });
  await require("./models/Conversation.model").findByIdAndUpdate(convId, {
    lastMessage: savedKickMsg._id,
  });
  const sysMsg = {
    _id: savedKickMsg._id.toString(),
    conversationId: convId,
    type: "system",
    content: savedKickMsg.content,
    changerId: userId,
    changerName: kicker?.name || "Người dùng",
    targetId: targetUserId,
    targetName: target?.name || "thành viên",
    senderId: null,
    createdAt: savedKickMsg.createdAt,
    reactions: [],
  };
  if (!store.MESSAGES[convId]) store.MESSAGES[convId] = [];
  store.MESSAGES[convId].push(sysMsg);
  conv.lastMessage = {
    _id: sysMsg._id,
    type: "system",
    content: sysMsg.content,
    senderId: null,
    createdAt: sysMsg.createdAt,
  };

  io.to(`conversation:${convId}`).emit("message:system", sysMsg);
  io.to(`conversation:${convId}`).emit("group:member_left", {
    conversationId: convId,
    userId: targetUserId,
  });
  io.to(`user:${targetUserId}`).emit("group:you_left", {
    conversationId: convId,
  });
  io.to(`conversation:${convId}`).emit("conversation:lastMessage", {
    conversationId: convId,
    lastMessage: conv.lastMessage,
  });

  res.json({ success: true });
});

// ✅ Rời khỏi nhóm
convRouter.post("/:id/leave", async (req, res) => {
  const convId = req.params.id;
  const userId = req.user.id;

  let conv = store.CONVERSATIONS[convId];
  if (!conv) {
    try {
      const Conversation = require("./models/Conversation.model");
      const dbConv = await Conversation.findById(convId).populate(
        "participants",
        "_id name email avatar",
      );
      if (!dbConv)
        return res
          .status(404)
          .json({ success: false, message: "Không tìm thấy nhóm" });
      store.CONVERSATIONS[convId] = {
        _id: convId,
        type: dbConv.type,
        name: dbConv.name,
        participants: dbConv.participants.map((p) => p._id.toString()),
        adminId: dbConv.adminId?.toString(),
        moderators: (dbConv.moderators || []).map((m) => m.toString()),
        isActive: true,
        createdAt: dbConv.createdAt,
        updatedAt: dbConv.updatedAt,
        lastMessage: null,
      };
      store.MESSAGES[convId] = store.MESSAGES[convId] || [];
      conv = store.CONVERSATIONS[convId];
    } catch (err) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhóm" });
    }
  }

  if (!conv.participants.includes(userId))
    return res
      .status(403)
      .json({ success: false, message: "Bạn không trong nhóm" });

  let leavingUser = null;
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState === 1) {
      const User = require("./models/User.model");
      const dbUser = await User.findById(userId)
        .select("_id name email avatar")
        .lean();
      if (dbUser) {
        leavingUser = {
          _id: dbUser._id.toString(),
          name: dbUser.name,
          email: dbUser.email,
          avatar: dbUser.avatar,
        };
        // Cập nhật lại store với tên mới nhất từ MongoDB
        store.USERS[userId] = leavingUser;
      }
    }
  } catch (e) {
    console.error("Lookup leaving user error:", e);
    // Fallback về store nếu MongoDB lỗi
    leavingUser = store.USERS[userId];
  }
  const isAdmin = conv.adminId?.toString() === userId;
  const isModerator = (conv.moderators || [])
    .map((m) => m.toString())
    .includes(userId);

  // Xóa khỏi participants và moderators
  conv.participants = conv.participants.filter((p) => p.toString() !== userId);
  conv.moderators = (conv.moderators || []).filter(
    (m) => m.toString() !== userId,
  );

  // Nếu là trưởng nhóm → chuyển quyền
  let newAdminId = conv.adminId;
  if (isAdmin) {
    if (conv.moderators.length > 0) {
      // Có phó nhóm → phó lên trưởng
      newAdminId = conv.moderators[0];
      conv.moderators = conv.moderators.slice(1);
    } else if (conv.participants.length > 0) {
      // Random 1 người
      const randomIdx = Math.floor(Math.random() * conv.participants.length);
      newAdminId = conv.participants[randomIdx];
    } else {
      newAdminId = null;
    }
    conv.adminId = newAdminId;
  }

  // Lưu vào MongoDB
  try {
    const Conversation = require("./models/Conversation.model");
    await Conversation.findByIdAndUpdate(convId, {
      $pull: { participants: userId, moderators: userId },
      ...(isAdmin && newAdminId ? { adminId: newAdminId } : {}),
    });
  } catch (err) {
    console.error("Leave group MongoDB error:", err);
  }

  // System message
  const Message = require("./models/Message.model");
  const savedLeaveMsg = await Message.create({
    conversationId: convId,
    type: "system",
    content: `${leavingUser?.name || "Người dùng"} đã rời khỏi nhóm`,
    changerId: userId,
    changerName: leavingUser?.name || "Người dùng",
    senderId: null,
    reactions: [],
  });
  await require("./models/Conversation.model").findByIdAndUpdate(convId, {
    lastMessage: savedLeaveMsg._id,
  });
  const sysMsg = {
    _id: savedLeaveMsg._id.toString(),
    conversationId: convId,
    type: "system",
    content: savedLeaveMsg.content,
    changerId: userId,
    changerName: leavingUser?.name || "Người dùng",
    senderId: null,
    createdAt: savedLeaveMsg.createdAt,
    reactions: [],
  };
  if (!store.MESSAGES[convId]) store.MESSAGES[convId] = [];
  store.MESSAGES[convId].push(sysMsg);
  conv.lastMessage = {
    _id: sysMsg._id,
    type: "system",
    content: sysMsg.content,
    senderId: null,
    createdAt: sysMsg.createdAt,
  };

  // Emit cho các thành viên còn lại
  io.to(`conversation:${convId}`).emit("message:system", sysMsg);
  io.to(`conversation:${convId}`).emit("conversation:lastMessage", {
    conversationId: convId,
    lastMessage: conv.lastMessage,
  });
  io.to(`conversation:${convId}`).emit("group:member_left", {
    conversationId: convId,
    userId,
    newAdminId: isAdmin ? newAdminId : null,
  });

  // Emit riêng cho người rời để xóa nhóm khỏi danh sách của họ
  io.to(`user:${userId}`).emit("group:you_left", { conversationId: convId });

  res.json({ success: true });
});

// ✅ Giải tán nhóm
convRouter.post("/:id/dissolve", async (req, res) => {
  const convId = req.params.id;
  const userId = req.user.id;

  let conv = store.CONVERSATIONS[convId];
  if (!conv) {
    try {
      const Conversation = require("./models/Conversation.model");
      const dbConv = await Conversation.findById(convId);
      if (!dbConv)
        return res
          .status(404)
          .json({ success: false, message: "Không tìm thấy nhóm" });
      store.CONVERSATIONS[convId] = {
        _id: convId,
        type: dbConv.type,
        name: dbConv.name,
        participants: dbConv.participants.map((p) => p.toString()),
        adminId: dbConv.adminId?.toString(),
        moderators: (dbConv.moderators || []).map((m) => m.toString()),
        isActive: true,
        createdAt: dbConv.createdAt,
        updatedAt: dbConv.updatedAt,
        lastMessage: null,
      };
      store.MESSAGES[convId] = store.MESSAGES[convId] || [];
      conv = store.CONVERSATIONS[convId];
    } catch (err) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhóm" });
    }
  }

  const isAdmin = conv.adminId?.toString() === userId;
  const isModerator = (conv.moderators || [])
    .map((m) => m.toString())
    .includes(userId);
  if (!isAdmin && !isModerator)
    return res
      .status(403)
      .json({ success: false, message: "Không có quyền giải tán nhóm" });

  let dissolver = null;
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState === 1) {
      const User = require("./models/User.model");
      const dbDissolver = await User.findById(userId)
        .select("_id name email avatar")
        .lean();
      if (dbDissolver) {
        dissolver = {
          _id: dbDissolver._id.toString(),
          name: dbDissolver.name,
          email: dbDissolver.email,
          avatar: dbDissolver.avatar,
        };
        store.USERS[userId] = dissolver;
      }
    }
  } catch (e) {
    dissolver = store.USERS[userId];
  }
  const groupName = conv.name;
  const allMembers = [...conv.participants];

  // System message thông báo
  const Message = require("./models/Message.model");
  const savedDissolveMsg = await Message.create({
    conversationId: convId,
    type: "system",
    content: `${dissolver?.name || "Người dùng"} đã giải tán nhóm "${groupName}"`,
    changerId: userId,
    changerName: dissolver?.name || "Người dùng",
    senderId: null,
    reactions: [],
  });
  await require("./models/Conversation.model").findByIdAndUpdate(convId, {
    lastMessage: savedDissolveMsg._id,
    isActive: false,
    isDissolved: true,
  });
  const sysMsg = {
    _id: savedDissolveMsg._id.toString(),
    conversationId: convId,
    type: "system",
    content: savedDissolveMsg.content,
    changerId: userId,
    changerName: dissolver?.name || "Người dùng",
    senderId: null,
    createdAt: savedDissolveMsg.createdAt,
    reactions: [],
  };
  if (!store.MESSAGES[convId]) store.MESSAGES[convId] = [];
  store.MESSAGES[convId].push(sysMsg);
  conv.lastMessage = {
    _id: sysMsg._id,
    type: "system",
    content: sysMsg.content,
    senderId: null,
    createdAt: sysMsg.createdAt,
  };
  conv.isActive = false;
  conv.isDissolved = true;
  conv.dissolvedBy = userId;

  // Emit system message cho tất cả thành viên (trừ người giải tán)
  const remainingMembers = allMembers.filter((p) => p.toString() !== userId);
  remainingMembers.forEach((pid) => {
    io.to(`user:${pid}`).emit("message:system", sysMsg);
    io.to(`user:${pid}`).emit("conversation:lastMessage", {
      conversationId: convId,
      lastMessage: conv.lastMessage,
    });
    io.to(`user:${pid}`).emit("group:dissolved", {
      conversationId: convId,
      groupName,
      dissolverName: dissolver?.name || "Người dùng",
      dissolverId: userId,
    });
  });

  // Xóa toàn bộ tin nhắn trong store
  store.MESSAGES[convId] = [];

  // Emit riêng cho người giải tán → xóa khỏi danh sách
  io.to(`user:${userId}`).emit("group:dissolved_self", {
    conversationId: convId,
  });

  // Emit cho các thành viên còn lại → chỉ thông báo, không xóa
  allMembers
    .filter((pid) => pid.toString() !== userId.toString())
    .forEach((pid) => {
      io.to(`user:${pid}`).emit("group:dissolved", {
        conversationId: convId,
        groupName,
        dissolverName: dissolver?.name || "Người dùng",
        dissolverId: userId,
        lastMessage: {
          _id: `dissolved_${Date.now()}`,
          type: "system",
          content: `${dissolver?.name || "Người dùng"} đã giải tán nhóm`,
          senderId: null,
          createdAt: new Date().toISOString(),
        },
      });
    });

  res.json({ success: true });
});

// ✅ MỚI - chỉ đánh dấu user này đã xóa, không xóa thật
convRouter.delete("/:id", async (req, res) => {
  const convId = req.params.id;
  const userId = req.user.id;

  const conv = store.CONVERSATIONS[convId];
  if (!conv) return res.status(404).json({ success: false });

  if (!conv.deletedFor) conv.deletedFor = [];
  if (!conv.deletedFor.includes(userId)) {
    conv.deletedFor.push(userId);
  }

  if (!conv.deletedAt) conv.deletedAt = {};
  conv.deletedAt[userId] = new Date().toISOString();
  store.MESSAGES[convId] = [];

  // Persist vào MongoDB
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState === 1) {
      const Conversation = require("./models/Conversation.model");
      await Conversation.findByIdAndUpdate(convId, {
        $set: {
          [`deletedFor.${userId}`]: new Date(),
        },
      });
    }
  } catch (e) {
    console.error("Persist deletedFor error:", e);
  }

  res.json({ success: true });
});

// ← MOUNT Ở ĐÂY, SAU KHI ĐÃ ĐỊNH NGHĨA HẾT CÁC ROUTE
app.use("/api/conversations", convRouter);

// ===== MESSAGES =====
const msgRouter = express.Router();
msgRouter.use(authMiddleware);

msgRouter.get("/:conversationId/pinned", (req, res) => {
  const pinned = store.getPinnedMessages(req.params.conversationId);
  res.json({ success: true, data: pinned });
});

msgRouter.get("/:conversationId/search", (req, res) => {
  const q = req.query.query || req.query.q || "";
  const results = store.searchMessages(req.params.conversationId, q);
  res.json({ success: true, data: results });
});

// ✅ MỚI - filter tin nhắn theo thời điểm user xóa
msgRouter.get("/:conversationId", async (req, res) => {
  const { conversationId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const userId = req.user.id;

  try {
    const mongoose = require("mongoose");
    const isValidId = mongoose.Types.ObjectId.isValid(conversationId);

    if (isValidId && mongoose.connection.readyState === 1) {
      // Load từ MongoDB
      const Message = require("./models/Message.model");
      const conv = store.CONVERSATIONS[conversationId];
      const deletedAt = conv?.deletedAt?.[userId] || null;

      const query = {
        conversationId,
        isDeleted: false,
        deletedFor: { $ne: userId },
        ...(deletedAt ? { createdAt: { $gt: new Date(deletedAt) } } : {}),
      };

      const total = await Message.countDocuments(query);
      const messages = await Message.find(query)
        .sort({ createdAt: 1 })
        .skip(Math.max(0, total - page * limit))
        .limit(limit)
        .populate("senderId", "name avatar email")
        .populate("readBy.userId", "name avatar")
        .lean();

      // Sync vào store để socket hoạt động
      if (!store.MESSAGES[conversationId]) store.MESSAGES[conversationId] = [];
      messages.forEach((m) => {
        const exists = store.MESSAGES[conversationId].find(
          (sm) => sm._id?.toString() === m._id?.toString(),
        );
        if (!exists) {
          store.MESSAGES[conversationId].push({
            ...m,
            _id: m._id.toString(),
          });
        }
      });

      return res.json({
        success: true,
        data: {
          messages: messages.map((m) => ({
            ...m,
            _id: m._id.toString(),
            readBy: (m.readBy || []).map((r) => ({
              userId: r.userId?._id?.toString() || r.userId?.toString(),
              avatar: r.userId?.avatar || "",
              name: r.userId?.name || "",
              readAt: r.readAt,
            })),
          })),
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        },
      });
    }
  } catch (e) {
    console.error("Load messages from MongoDB error:", e);
  }

  // Fallback: dùng store
  const conv = store.CONVERSATIONS[conversationId];
  const deletedAt = conv?.deletedAt?.[userId] || null;
  const allMsgs = store.MESSAGES[conversationId] || [];
  const filtered = deletedAt
    ? allMsgs.filter((m) => new Date(m.createdAt) > new Date(deletedAt))
    : allMsgs;
  const visibleMsgs = filtered.filter((m) => {
    if (!m.deletedFor) return true;
    return !m.deletedFor.includes(userId);
  });
  const total = visibleMsgs.length;
  const start = Math.max(0, total - page * limit);
  const end = total - (page - 1) * limit;
  const slice = visibleMsgs.slice(start, end);
  res.json({
    success: true,
    data: {
      messages: slice,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

msgRouter.post("/:conversationId/mark-read", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const msgSvc = require("./services/message.service");
    await msgSvc.markAllAsRead(conversationId, userId);

    // Emit cho chính user này (các tab khác)
    io.to(`user:${userId}`).emit("conversation:marked_read", {
      conversationId,
    });

    // THÊM: Emit cho tất cả người trong conversation biết user đã đọc
    const User = require("./models/User.model");
    const reader = await User.findById(userId).select("name avatar").lean();
    io.to(`conversation:${conversationId}`).emit("conversation:read_by", {
      conversationId,
      userId,
      name: reader?.name || "",
      avatar: reader?.avatar || "",
    });

    res.json({ success: true });
  } catch (err) {
    console.error("markAllAsRead error:", err);
    res.json({ success: true });
  }
});

msgRouter.post("/:messageId/forward", (req, res) => {
  const { messageId } = req.params;
  const { conversationIds } = req.body;
  const userId = req.user.id;

  if (!conversationIds || !Array.isArray(conversationIds)) {
    return res
      .status(400)
      .json({ success: false, message: "conversationIds required" });
  }

  // Tìm tin nhắn gốc trong store
  let originalMsg = null;
  for (const msgs of Object.values(store.MESSAGES)) {
    const found = msgs.find((m) => m._id === messageId);
    if (found) {
      originalMsg = found;
      break;
    }
  }

  if (!originalMsg) {
    return res
      .status(404)
      .json({ success: false, message: "Message not found" });
  }

  const forwarded = [];
  for (const convId of conversationIds) {
    const conv = store.CONVERSATIONS[convId];
    if (!conv || !conv.participants.includes(userId)) continue;

    const msgData = {
      type: originalMsg.type,
      content: originalMsg.content,
      caption: originalMsg.caption,
      fileUrl: originalMsg.fileUrl,
      fileName: originalMsg.fileName,
      fileSize: originalMsg.fileSize,
      images: originalMsg.images,
      voiceDuration: originalMsg.voiceDuration,
      waveform: originalMsg.waveform,
      forwardedFrom: { messageId: originalMsg._id },
    };

    const newMsg = store.createMessage(convId, userId, msgData);
    const userInfo = store.USERS[userId];
    const normalizedMsg = {
      ...newMsg,
      senderId: {
        _id: userId,
        name: userInfo?.name || "",
        avatar: userInfo?.avatar || "",
      },
    };

    io.to(`conversation:${convId}`).emit("message:new", normalizedMsg);
    forwarded.push(normalizedMsg);
  }

  res.json({ success: true, data: forwarded });
});

// ✅ SEND FILE/IMAGE
msgRouter.post("/", upload.any(), async (req, res) => {
  const userId = req.user.id;
  const { conversationId, type, caption } = req.body;

  if (!conversationId) {
    return res
      .status(400)
      .json({ success: false, message: "conversationId required" });
  }

  const conv = store.CONVERSATIONS[conversationId];
  if (!conv || !conv.participants.includes(userId)) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  const files = req.files || [];
  let msgData = { type: type || "file", caption: caption || "" };
  const BASE_URL =
    process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

  const saveFileToDisk = (file, folder) => {
    const ext = require("path").extname(file.originalname) || "";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const dir = require("path").join(__dirname, `../uploads/${folder}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(require("path").join(dir, filename), file.buffer);
    return { filename, url: `${BASE_URL}/uploads/${folder}/${filename}` };
  };

  if (type === "images" && files.length > 0) {
    msgData.images = files.map((f) => {
      const { url } = saveFileToDisk(f, "image");
      return { url, fileName: f.originalname, fileSize: f.size };
    });
  } else if (files.length > 0) {
    const f = files[0];
    let folder = "file";
    if (type === "image") folder = "image";
    else if (type === "video") folder = "video";
    else if (type === "voice") folder = "voice";
    const { url } = saveFileToDisk(f, folder);
    msgData.fileUrl = url;
    msgData.fileName = f.originalname;
    msgData.fileSize = f.size;
  }

  const msg = store.createMessage(conversationId, userId, msgData);

  // Lưu vào MongoDB để persist qua restart
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState === 1) {
      const Message = require("./models/Message.model");
      await Message.create({
        _id: msg._id.startsWith("msg_") ? undefined : msg._id,
        conversationId,
        senderId: userId,
        type: msgData.type,
        content: msgData.content || "",
        caption: msgData.caption || "",
        fileUrl: msgData.fileUrl,
        fileName: msgData.fileName,
        fileSize: msgData.fileSize,
        images: msgData.images,
        voiceDuration: msgData.voiceDuration,
        waveform: msgData.waveform,
      });
      // Cập nhật lastMessage trong Conversation
      const Conversation = require("./models/Conversation.model");
      await Conversation.findByIdAndUpdate(
        conversationId,
        { $set: { lastMessage: msg._id } },
        { timestamps: true },
      ).catch(() => {});
    }
  } catch (e) {
    console.error("Persist file message to MongoDB error:", e);
  }

  // Normalize senderId thành object giống text message
  const userInfo = store.USERS[userId];
  const normalizedMsg = {
    ...msg,
    senderId: {
      _id: userId,
      name: userInfo?.name || "",
      avatar: userInfo?.avatar || "",
      email: userInfo?.email || "",
    },
  };

  io.to(`conversation:${conversationId}`).emit("message:new", normalizedMsg);

  // Emit lastMessage để sidebar cập nhật ngay lập tức
  io.to(`conversation:${conversationId}`).emit("conversation:lastMessage", {
    conversationId,
    lastMessage: {
      _id: msg._id,
      content: msgData.content || msgData.caption || "",
      type: msgData.type,
      senderId: {
        _id: userId,
        name: userInfo?.name || "",
        avatar: userInfo?.avatar || "",
      },
      createdAt: msg.createdAt,
      fileName: msgData.fileName,
      fileUrl: msgData.fileUrl,
      images: msgData.images,
      caption: msgData.caption,
      voiceDuration: msgData.voiceDuration,
    },
  });

  const room = io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
  if (room && room.size > 1) {
    store.updateMessageStatus(msg._id, conversationId, "delivered");
    io.to(`conversation:${conversationId}`).emit("message:status", {
      messageId: msg._id,
      status: "delivered",
    });
  }

  res.json({ success: true, data: msg });
});

const messageRoutes = require("./routes/messages.routes");
app.use("/api/messages", messageRoutes);

// ===== FILES =====
const fileRouter = express.Router();
fileRouter.use(authMiddleware);
fileRouter.post("/upload", upload.any(), (req, res) => {
  const files = req.files || [];
  const urls = files.map((f) => ({
    url: `http://localhost:${PORT}/uploads/${f.destination.split("/").pop()}/${f.filename}`,
    fileName: f.originalname,
    fileSize: f.size,
  }));
  res.json({ success: true, data: urls.length === 1 ? urls[0] : urls });
});
app.use("/api/files", fileRouter);

// ===== SOCKET =====
const socketHandler = require("./socket/socket-index");
socketHandler(io, store);

app.get("/api/health", (req, res) => res.json({ status: "OK" }));
app.get("/", (req, res) => res.json({ message: "Chat API - In Memory Mode" }));
app.use((req, res) =>
  res
    .status(404)
    .json({ success: false, message: "Not found", path: req.path }),
);

const PORT = process.env.PORT || 5000;

// Khoi dong backend sau khi ket noi MongoDB thanh cong de route auth co the su dung du lieu that.
const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ Socket.IO ready`);
    console.log(
      `✓ CORS enabled for: ${process.env.CORS_ORIGIN || "http://localhost:5173"}`,
    );
    console.log(`✓ In-memory mode: 4 users, 6 conversations ready`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `✗ Port ${PORT} is already in use. Please free the port or use a different one.`,
      );
      process.exit(1);
    }
    throw err;
  });
};

startServer();

module.exports = { app, server, io };
