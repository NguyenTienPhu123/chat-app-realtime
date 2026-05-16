import api from "./api.service";

class MessageService {
  async getMessages(conversationId, page = 1, limit = 50) {
    const response = await api.get(`/messages/${conversationId}`, {
      params: { page, limit },
    });
    return response.data.data || response.data;
  }

  async sendText(conversationId, content, replyToId = null) {
    const response = await api.post("/messages", {
      conversationId,
      content,
      type: "text",
      replyToId,
    });
    return response.data.data || response.data;
  }

  async sendFile(
    conversationId,
    file,
    type = "file",
    caption = "",
    replyToId = null,
  ) {
    const formData = new FormData();
    formData.append("conversationId", conversationId);
    formData.append("type", type);
    formData.append("file", file);

    if (caption.trim()) {
      formData.append("caption", caption.trim());
    }

    if (replyToId) {
      formData.append("replyToId", replyToId);
    }

    const response = await api.post("/messages", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data || response.data;
  }

  async sendVoice(conversationId, audioFile, duration, waveform = []) {
    const formData = new FormData();
    formData.append("conversationId", conversationId);
    formData.append("type", "voice");
    formData.append("file", audioFile);
    formData.append("duration", duration);
    formData.append("waveform", JSON.stringify(waveform));

    const response = await api.post("/messages", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data || response.data;
  }

  async editMessage(messageId, content) {
    const response = await api.patch(`/messages/${messageId}/edit`, {
      content,
    });
    return response.data.data || response.data;
  }

  async forwardMessage(messageId, conversationIds) {
    const response = await api.post(`/messages/${messageId}/forward`, {
      conversationIds,
    });
    return response.data.data || response.data;
  }

  async pinMessage(messageId) {
    const response = await api.post(`/messages/${messageId}/pin`);
    return response.data.data || response.data;
  }

  async unpinMessage(messageId) {
    const response = await api.delete(`/messages/${messageId}/pin`);
    return response.data.data || response.data;
  }

  async getPinnedMessages(conversationId) {
    const response = await api.get(`/messages/${conversationId}/pinned`);
    return response.data.data || response.data;
  }

  async searchMessages(conversationId, query) {
    const response = await api.get(`/messages/${conversationId}/search`, {
      params: { query },
    });
    return response.data.data || response.data;
  }

  async updateStatus(messageId, status) {
    const response = await api.patch(`/messages/${messageId}/status`, {
      status,
    });
    return response.data.data || response.data;
  }

  async markAllAsRead(conversationId) {
    const response = await api.post(`/messages/${conversationId}/mark-read`);
    return response.data.data || response.data;
  }

  async deleteMessage(messageId) {
    const response = await api.delete(`/messages/${messageId}`);
    return response.data.data || response.data;
  }

  async addReaction(messageId, emoji) {
    const response = await api.post(`/messages/${messageId}/reaction`, {
      emoji,
    });
    return response.data.data || response.data;
  }

  async removeReaction(messageId) {
    const response = await api.delete(`/messages/${messageId}/reaction`);
    return response.data.data || response.data;
  }
  async sendImages(conversationId, files, caption = "", replyToId = null) {
    const formData = new FormData();
    formData.append("conversationId", conversationId);
    formData.append("type", "images");
    files.forEach((file) => {
      formData.append("files", file);
    });
    if (caption.trim()) formData.append("caption", caption.trim());
    if (replyToId) formData.append("replyToId", replyToId);
    const response = await api.post("/messages", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data || response.data;
  }
}

export default new MessageService();
