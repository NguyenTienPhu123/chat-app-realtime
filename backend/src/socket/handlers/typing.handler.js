const User = require("../../models/User.model");

module.exports = (io, socket) => {
  socket.on("typing:start", async ({ conversationId }) => {
    if (!socket.userId) return;

    const user = await User.findById(socket.userId)
      .select("name avatar")
      .lean();
    socket.to(`conversation:${conversationId}`).emit("typing:start", {
      userId: socket.userId,
      name: user?.name || "Ai đó",
      avatar: user?.avatar || "",
      conversationId,
    });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    if (!socket.userId) return;

    socket.to(`conversation:${conversationId}`).emit("typing:stop", {
      userId: socket.userId,
      conversationId,
    });
  });
};
