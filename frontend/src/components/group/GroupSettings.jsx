import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import conversationService from "../../services/conversation.service";
import UserAvatar from "../chat/UserAvatar";
import "./GroupSettings.css";

const GroupSettings = ({ conversation, onClose, onUpdate }) => {
  const { user } = useAuth();
  const [groupInfo, setGroupInfo] = useState({
    name: conversation.name || "",
    description: conversation.description || "",
  });
  const [permissions, setPermissions] = useState(
    conversation.permissions || {},
  );
  const [members, setMembers] = useState(conversation.participants || []);
  const [loading, setLoading] = useState(false);

  const currentUserId = user?._id?.toString();

  const adminId =
    conversation.adminId?._id?.toString() ||
    conversation.adminId?.toString?.() ||
    conversation.adminId;

  const isAdmin = adminId === currentUserId;

  const isModerator = conversation.moderators?.some((m) => {
    const mid = m._id?.toString() || m?.toString();
    return mid === currentUserId;
  });

  const handleUpdateInfo = async () => {
    if (!isAdmin && !isModerator) return;
    setLoading(true);
    try {
      await conversationService.updateGroupInfo(conversation._id, groupInfo);
      onUpdate?.();
    } catch (error) {
      alert(error.message || "Cập nhật thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      await conversationService.updatePermissions(
        conversation._id,
        permissions,
      );
      onUpdate?.();
    } catch (error) {
      alert(error.message || "Cập nhật quyền thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!isAdmin) {
      alert("Chỉ trưởng nhóm mới có quyền xóa thành viên");
      return;
    }
    if (!window.confirm(`Xóa ${memberName} khỏi nhóm?`)) return;
    try {
      await conversationService.removeMember(conversation._id, memberId);
      setMembers((prev) =>
        prev.filter((m) => (m._id?.toString() || m) !== memberId),
      );
      onUpdate?.();
    } catch (error) {
      alert(error.message || "Xóa thành viên thất bại");
    }
  };

  const handleToggleModerator = async (memberId) => {
    if (!isAdmin) return;
    const isMod = conversation.moderators?.some(
      (m) => (m._id?.toString() || m?.toString()) === memberId,
    );
    try {
      if (isMod) {
        await conversationService.removeModerator(conversation._id, memberId);
      } else {
        await conversationService.addModerator(conversation._id, memberId);
      }
      onUpdate?.();
    } catch (error) {
      alert(error.message || "Thao tác thất bại");
    }
  };

  const handleLeaveGroup = async () => {
    if (isAdmin) {
      alert("Trưởng nhóm phải chuyển quyền trước khi rời nhóm");
      return;
    }
    if (!window.confirm("Bạn có chắc muốn rời nhóm?")) return;
    try {
      await conversationService.leaveGroup(conversation._id);
      onClose();
    } catch (error) {
      alert(error.message || "Rời nhóm thất bại");
    }
  };

  return (
    <div className="group-settings-overlay">
      <div className="group-settings-modal">
        <div className="settings-header">
          <h2>Cài đặt nhóm</h2>
          <button className="close-settings-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-content">
          {/* Thông tin nhóm */}
          {(isAdmin || isModerator) && (
            <section className="settings-section">
              <h3>Thông tin nhóm</h3>
              <div className="form-group">
                <label>Tên nhóm</label>
                <input
                  type="text"
                  value={groupInfo.name}
                  onChange={(e) =>
                    setGroupInfo({ ...groupInfo, name: e.target.value })
                  }
                  placeholder="Nhập tên nhóm"
                />
              </div>
              <div className="form-group">
                <label>Mô tả</label>
                <textarea
                  value={groupInfo.description}
                  onChange={(e) =>
                    setGroupInfo({ ...groupInfo, description: e.target.value })
                  }
                  placeholder="Nhập mô tả nhóm"
                  rows="3"
                />
              </div>
              <button
                className="save-btn"
                onClick={handleUpdateInfo}
                disabled={loading}
              >
                Lưu thay đổi
              </button>
            </section>
          )}

          {/* Quyền nhóm - chỉ admin */}
          {isAdmin && (
            <section className="settings-section">
              <h3>Quyền nhóm</h3>
              {[
                {
                  key: "onlyAdminCanSendMessages",
                  label: "Chỉ trưởng nhóm được gửi tin",
                },
                {
                  key: "onlyAdminCanAddMembers",
                  label: "Chỉ trưởng nhóm được thêm thành viên",
                },
                {
                  key: "onlyAdminCanPinMessages",
                  label: "Chỉ trưởng nhóm được ghim tin nhắn",
                },
              ].map(({ key, label }) => (
                <div className="permission-item" key={key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions[key] || false}
                      onChange={(e) =>
                        setPermissions({
                          ...permissions,
                          [key]: e.target.checked,
                        })
                      }
                    />
                    {label}
                  </label>
                </div>
              ))}
              <button
                className="save-btn"
                onClick={handleUpdatePermissions}
                disabled={loading}
              >
                Cập nhật quyền
              </button>
            </section>
          )}

          {/* Danh sách thành viên */}
          <section className="settings-section">
            <h3>Thành viên ({members.length})</h3>
            <div className="members-list">
              {members.map((member) => {
                const memberId = member._id?.toString() || member;
                const memberName =
                  localStorage.getItem(`nickname_user_${memberId}`) ||
                  member.name ||
                  "Người dùng";
                const memberAvatar = member.avatar || "";
                const memberEmail = member.email || "";

                const memberIsAdmin = memberId === adminId;
                const memberIsMod = conversation.moderators?.some(
                  (m) => (m._id?.toString() || m?.toString()) === memberId,
                );
                const isMe = memberId === currentUserId;

                return (
                  <div key={memberId} className="member-item">
                    <UserAvatar
                      name={memberName}
                      avatar={memberAvatar}
                      size={40}
                      className="member-avatar"
                    />
                    <div className="member-info">
                      <span className="member-name">
                        {memberName}
                        {isMe && (
                          <span
                            style={{
                              color: "var(--color-text-secondary)",
                              fontSize: 12,
                              marginLeft: 6,
                            }}
                          >
                            (Bạn)
                          </span>
                        )}
                      </span>
                      <span className="member-role">
                        {memberIsAdmin && "Trưởng nhóm"}
                        {!memberIsAdmin && memberIsMod && "Phó nhóm"}
                        {!memberIsAdmin && !memberIsMod && "Thành viên"}
                      </span>
                      {memberEmail && (
                        <span
                          className="member-email"
                          style={{
                            fontSize: 11,
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {memberEmail}
                        </span>
                      )}
                    </div>

                    {/* Chỉ admin mới thấy nút kick, không hiện với chính mình và không hiện với admin */}
                    {isAdmin && !memberIsAdmin && !isMe && (
                      <div className="member-actions">
                        <button
                          className="action-btn"
                          onClick={() => handleToggleModerator(memberId)}
                          title={
                            memberIsMod ? "Hủy phó nhóm" : "Bổ nhiệm phó nhóm"
                          }
                        >
                          {memberIsMod ? "Hủy phó" : "Bổ nhiệm phó"}
                        </button>
                        <button
                          className="action-btn danger"
                          onClick={() =>
                            handleRemoveMember(memberId, memberName)
                          }
                          title="Xóa khỏi nhóm"
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Rời nhóm - chỉ thành viên thường và phó nhóm */}
          {!isAdmin && (
            <section className="settings-section">
              <button className="leave-group-btn" onClick={handleLeaveGroup}>
                Rời nhóm
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupSettings;
