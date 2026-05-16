import api from "./api.service";

class ConversationService {
  async getConversations() {
    const response = await api.get("/conversations", {
      params: { _t: Date.now() },
    });
    const data = response.data.data || response.data;
    // Đảm bảo adminId luôn được giữ nguyên
    return Array.isArray(data)
      ? data.map((conv) => ({
          ...conv,
          adminId: conv.adminId || null,
          moderators: conv.moderators || [],
        }))
      : data;
  }

  async createPrivate(participantId) {
    const response = await api.post("/conversations/private", {
      participantId,
    });
    return response.data.data || response.data;
  }

  async createGroup(name, participantIds, avatar = "", description = "") {
    const response = await api.post("/conversations/group", {
      name,
      participantIds,
      avatar,
      description,
    });
    return response.data.data || response.data;
  }

  async getConversation(conversationId) {
    const response = await api.get(`/conversations/${conversationId}`);
    return response.data.data || response.data;
  }

  async updateGroupInfo(conversationId, info) {
    const response = await api.patch(`/conversations/${conversationId}`, info);
    return response.data.data || response.data;
  }

  async deleteGroup(conversationId) {
    const response = await api.delete(`/conversations/${conversationId}`);
    return response.data.data || response.data;
  }

  async addMembers(conversationId, memberIds) {
    const response = await api.post(
      `/conversations/${conversationId}/add-members`,
      { memberIds },
    );
    return response.data.data || response.data;
  }

  async removeMember(conversationId, userId) {
    const response = await api.delete(
      `/conversations/${conversationId}/participants/${userId}`,
    );
    return response.data.data || response.data;
  }

  async leaveGroup(conversationId) {
    const response = await api.post(`/conversations/${conversationId}/leave`);
    return response.data.data || response.data;
  }

  async updatePermissions(conversationId, permissions) {
    const response = await api.patch(
      `/conversations/${conversationId}/permissions`,
      {
        permissions,
      },
    );
    return response.data.data || response.data;
  }

  async addModerator(conversationId, userId) {
    const response = await api.post(
      `/conversations/${conversationId}/moderators`,
      {
        userId,
      },
    );
    return response.data.data || response.data;
  }

  async removeModerator(conversationId, userId) {
    const response = await api.delete(
      `/conversations/${conversationId}/moderators/${userId}`,
    );
    return response.data.data || response.data;
  }

  async transferOwnership(conversationId, newAdminId) {
    const response = await api.post(
      `/conversations/${conversationId}/transfer`,
      {
        newAdminId,
      },
    );
    return response.data.data || response.data;
  }

  async togglePin(conversationId) {
    const response = await api.post(`/conversations/${conversationId}/pin`);
    return response.data.data || response.data;
  }

  async toggleMute(conversationId, mutedUntil = null) {
    const response = await api.post(`/conversations/${conversationId}/mute`, {
      mutedUntil,
    });
    return response.data.data || response.data;
  }

  async toggleBlock(conversationId) {
    const response = await api.post(`/conversations/${conversationId}/block`);
    return response.data.data || response.data;
  }

  async toggleArchive(conversationId) {
    const response = await api.post(`/conversations/${conversationId}/archive`);
    return response.data.data || response.data;
  }
  async deleteConversation(conversationId) {
    const response = await api.delete(`/conversations/${conversationId}`);
    return response.data.data || response.data;
  }

  async markAllAsRead(conversationId) {
    const response = await api.post(
      `/conversations/${conversationId}/mark-read`,
    );
    return response.data.data || response.data;
  }
}

export default new ConversationService();
