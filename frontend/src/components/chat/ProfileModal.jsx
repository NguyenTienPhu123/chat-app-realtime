import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import UserAvatar from "./UserAvatar";
import api from "../../services/api.service";
import "./ProfileModal.css";

// ── Profile Icons (SVG tự làm) ──────────────────────────────────
const IconName = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconMail = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);
const IconPhone = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const IconBirth = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
  </svg>
);
const IconGender = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="11" r="4" />
    <path d="M12 15v6M9 18h6" />
    <path d="M17 3h4v4" />
    <path d="m21 3-5.2 5.2" />
  </svg>
);
const IconBio = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);
const IconDate = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);
const IconCamera = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const ProfileModal = ({ onClose }) => {
  const { user, login } = useAuth();
  const [tab, setTab] = useState("info"); // info | edit
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    bio: user?.bio || "",
    gender: user?.gender || "",
    birthDate: user?.birthDate ? user.birthDate.slice(0, 10) : "",
  });
  // Fetch profile mới nhất từ API khi mở modal
  useEffect(() => {
    if (!user?._id) return;
    api
      .get(`/auth/users/${user._id}`)
      .then((res) => {
        const fresh = res.data?.data || res.data;
        if (!fresh) return;
        // Cập nhật lại AuthContext với data mới nhất
        const storage = localStorage.getItem("currentUser")
          ? localStorage
          : sessionStorage;
        const stored = JSON.parse(storage.getItem("currentUser") || "{}");
        const newUser = { ...stored, ...fresh };
        storage.setItem("currentUser", JSON.stringify(newUser));
        const token =
          localStorage.getItem("accessToken") ||
          sessionStorage.getItem("accessToken");
        const expiresAt =
          localStorage.getItem("accessTokenExpiresAt") ||
          sessionStorage.getItem("accessTokenExpiresAt");
        login({ user: newUser, token, expiresAt: Number(expiresAt) });
        // Cập nhật form
        setForm({
          name: fresh.name || "",
          phone: fresh.phone || "",
          bio: fresh.bio || "",
          gender: fresh.gender || "",
          birthDate: fresh.birthDate ? fresh.birthDate.slice(0, 10) : "",
        });
      })
      .catch(() => {});
  }, [user?._id]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef();

  // Kiểm tra có thể đổi tên không (chỉ được đổi 1 lần / 15 ngày)
  const lastNameChange = user?.lastNameChange
    ? new Date(user.lastNameChange)
    : null;
  const canChangeName =
    !lastNameChange ||
    Date.now() - lastNameChange.getTime() > 15 * 24 * 3600 * 1000;
  const daysLeft = lastNameChange
    ? Math.ceil(
        15 - (Date.now() - lastNameChange.getTime()) / (24 * 3600 * 1000),
      )
    : 0;

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        phone: form.phone,
        bio: form.bio,
        gender: form.gender,
        birthDate: form.birthDate,
      };
      if (canChangeName && form.name !== user?.name) {
        payload.name = form.name;
      }
      const res = await api.patch("/auth/profile", payload);
      const updated = res.data?.data || res.data;

      // Đọc storage hiện tại
      const storage = localStorage.getItem("currentUser")
        ? localStorage
        : sessionStorage;

      const stored = JSON.parse(storage.getItem("currentUser") || "{}");
      const newUser = { ...stored, ...updated };

      // Ghi lại user mới vào storage
      storage.setItem("currentUser", JSON.stringify(newUser));

      // Cập nhật AuthContext đúng cách — giữ nguyên token và expiresAt
      const token =
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("accessToken");
      const expiresAt =
        localStorage.getItem("accessTokenExpiresAt") ||
        sessionStorage.getItem("accessTokenExpiresAt");
      login({ user: newUser, token, expiresAt: Number(expiresAt) });

      setMsg("Cập nhật thành công!");
      setTab("info");
    } catch (err) {
      setMsg(err.response?.data?.message || "Lỗi cập nhật");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await api.patch("/auth/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updated = res.data?.data || res.data;

      const storage = localStorage.getItem("currentUser")
        ? localStorage
        : sessionStorage;
      const stored = JSON.parse(storage.getItem("currentUser") || "{}");
      const newUser = { ...stored, ...updated };
      storage.setItem("currentUser", JSON.stringify(newUser));

      const token =
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("accessToken");
      const expiresAt =
        localStorage.getItem("accessTokenExpiresAt") ||
        sessionStorage.getItem("accessTokenExpiresAt");
      login({ user: newUser, token, expiresAt: Number(expiresAt) });
      window.dispatchEvent(
        new CustomEvent("user:avatar_updated", {
          detail: { userId: updated._id || stored._id, avatar: updated.avatar },
        }),
      );
    } catch (err) {
      alert("Upload ảnh thất bại");
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="profile-modal-header">
          <span>Thông tin cá nhân</span>
          <button className="profile-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Avatar lớn */}
        <div className="profile-avatar-section">
          <div style={{ position: "relative", display: "inline-block" }}>
            <UserAvatar
              name={user?.name}
              avatar={user?.avatar}
              size={90}
              style={{ border: "3px solid #e4e6eb" }}
            />
            <button
              className="profile-avatar-edit-btn"
              onClick={() => fileRef.current?.click()}
              title="Đổi ảnh đại diện"
            >
              {avatarUploading ? (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : (
                <IconCamera />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
          </div>
          <h3 className="profile-name">{user?.name}</h3>
          <span className="profile-email">{user?.email}</span>
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          <button
            className={tab === "info" ? "active" : ""}
            onClick={() => setTab("info")}
          >
            Thông tin
          </button>
          <button
            className={tab === "edit" ? "active" : ""}
            onClick={() => setTab("edit")}
          >
            Chỉnh sửa
          </button>
        </div>

        {/* Tab: Info */}
        {tab === "info" && (
          <div className="profile-info-list">
            <div className="profile-info-row">
              <span className="pir-label">
                <IconName /> Tên
              </span>
              <span className="pir-value">{user?.name || "—"}</span>
            </div>
            <div className="profile-info-row">
              <span className="pir-label">
                <IconMail /> Email
              </span>
              <span className="pir-value">{user?.email || "—"}</span>
            </div>
            <div className="profile-info-row">
              <span className="pir-label">
                <IconPhone /> SĐT
              </span>
              <span className="pir-value">
                {user?.phone || "Chưa cập nhật"}
              </span>
            </div>
            <div className="profile-info-row">
              <span className="pir-label">
                <IconBirth /> Ngày sinh
              </span>
              <span className="pir-value">
                {user?.birthDate
                  ? new Date(user.birthDate).toLocaleDateString("vi-VN")
                  : "Chưa cập nhật"}
              </span>
            </div>
            <div className="profile-info-row">
              <span className="pir-label">
                <IconGender /> Giới tính
              </span>
              <span className="pir-value">
                {user?.gender === "male"
                  ? "Nam"
                  : user?.gender === "female"
                    ? "Nữ"
                    : "Chưa cập nhật"}
              </span>
            </div>
            <div className="profile-info-row">
              <span className="pir-label">
                <IconBio /> Giới thiệu
              </span>
              <span className="pir-value">{user?.bio || "Chưa cập nhật"}</span>
            </div>
            <div className="profile-info-row">
              <span className="pir-label">
                <IconDate /> Tham gia
              </span>
              <span className="pir-value">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("vi-VN")
                  : "—"}
              </span>
            </div>
          </div>
        )}

        {/* Tab: Edit */}
        {tab === "edit" && (
          <div className="profile-edit-form">
            {/* Tên */}
            <div className="pef-field">
              <label>Tên hiển thị</label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                disabled={!canChangeName}
                placeholder="Tên của bạn"
              />
              {!canChangeName && (
                <span className="pef-hint">
                  ⏳ Còn {daysLeft} ngày mới được đổi tên
                </span>
              )}
              {canChangeName && (
                <span className="pef-hint">
                  ⚠️ Chỉ được đổi tên 1 lần / 15 ngày
                </span>
              )}
            </div>

            {/* SĐT */}
            <div className="pef-field">
              <label>Số điện thoại</label>
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="0xxxxxxxxx"
              />
            </div>

            {/* Ngày sinh */}
            <div className="pef-field">
              <label>Ngày sinh</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, birthDate: e.target.value }))
                }
              />
            </div>

            {/* Giới tính */}
            <div className="pef-field">
              <label>Giới tính</label>
              <select
                value={form.gender}
                onChange={(e) =>
                  setForm((p) => ({ ...p, gender: e.target.value }))
                }
              >
                <option value="">Chưa chọn</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>

            {/* Bio */}
            <div className="pef-field">
              <label>Giới thiệu</label>
              <textarea
                value={form.bio}
                onChange={(e) =>
                  setForm((p) => ({ ...p, bio: e.target.value }))
                }
                placeholder="Một vài dòng về bạn..."
                rows={3}
              />
            </div>

            {msg && (
              <div
                className={`pef-msg ${msg.includes("thành") ? "success" : "error"}`}
              >
                {msg}
              </div>
            )}

            <button
              className="pef-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;
