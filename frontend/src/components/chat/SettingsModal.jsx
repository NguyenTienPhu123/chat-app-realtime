import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import api from "../../services/api.service";
import "./SettingsModal.css";

const IcAccount = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);
const IcPrivacy = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IcNotify = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const IcLogout = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const SETTINGS_MENU = [
  { id: "account", Icon: IcAccount, label: "Tài khoản" },
  { id: "privacy", Icon: IcPrivacy, label: "Quyền riêng tư" },
  { id: "notify", Icon: IcNotify, label: "Thông báo" },
];

const SettingsModal = ({ onClose }) => {
  const { logout, user, login } = useAuth();
  const [active, setActive] = useState("account");
  const [hideOnline, setHideOnline] = useState(
    () => localStorage.getItem("hide_online_status") === "1",
  );
  const [allowMsg, setAllowMsg] = useState(
    () => localStorage.getItem("allow_messages_from") || "everyone",
  );
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: "error", text: "Mật khẩu xác nhận không khớp" });
      return;
    }
    setPwLoading(true);
    try {
      await api.put("/auth/change-password", {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwMsg({ type: "success", text: "Đổi mật khẩu thành công!" });
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => {
        setShowChangePw(false);
        setPwMsg(null);
      }, 1500);
    } catch (err) {
      setPwMsg({
        type: "error",
        text: err.response?.data?.message || "Lỗi đổi mật khẩu",
      });
    } finally {
      setPwLoading(false);
    }
  };

  const renderContent = () => {
    switch (active) {
      case "account":
        return (
          <div className="settings-content-panel">
            <h3>Tài khoản</h3>
            <p className="settings-desc">
              Quản lý thông tin tài khoản của bạn.
            </p>
            <div className="settings-item">
              <span>Đổi mật khẩu</span>
              <button
                className="settings-action-btn"
                onClick={() => {
                  setShowChangePw(!showChangePw);
                  setPwMsg(null);
                }}
              >
                {showChangePw ? "Đóng" : "Thay đổi"}
              </button>
            </div>
            {showChangePw && (
              <div className="settings-form-box">
                <input
                  className="settings-input"
                  type="password"
                  placeholder="Mật khẩu hiện tại"
                  value={pwForm.currentPassword}
                  autoComplete="new-password"
                  onChange={(e) =>
                    setPwForm((p) => ({
                      ...p,
                      currentPassword: e.target.value,
                    }))
                  }
                />
                <input
                  className="settings-input"
                  type="password"
                  placeholder="Mật khẩu mới (chữ hoa, thường, số, 8+ ký tự)"
                  value={pwForm.newPassword}
                  autoComplete="new-password"
                  disabled={!pwForm.currentPassword}
                  onChange={(e) =>
                    setPwForm((p) => ({ ...p, newPassword: e.target.value }))
                  }
                />
                <input
                  className="settings-input"
                  type="password"
                  placeholder="Xác nhận mật khẩu mới"
                  value={pwForm.confirmPassword}
                  autoComplete="new-password"
                  disabled={!pwForm.newPassword}
                  onChange={(e) =>
                    setPwForm((p) => ({
                      ...p,
                      confirmPassword: e.target.value,
                    }))
                  }
                />
                {pwMsg && (
                  <p className={`settings-msg ${pwMsg.type}`}>{pwMsg.text}</p>
                )}
                <button
                  className="settings-submit-btn"
                  onClick={handleChangePassword}
                  disabled={pwLoading}
                >
                  {pwLoading ? "Đang xử lý..." : "Xác nhận đổi mật khẩu"}
                </button>
              </div>
            )}
            <div className="settings-item danger">
              <span>Đăng xuất khỏi tất cả thiết bị</span>
              <button className="settings-action-btn danger" onClick={logout}>
                Đăng xuất
              </button>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div className="settings-content-panel">
            <h3>Quyền riêng tư</h3>
            <div className="settings-item">
              <div>
                <div>Ai có thể nhắn tin cho tôi</div>
                <div style={{ fontSize: 12, color: "#999" }}>
                  {allowMsg === "everyone" ? "Tất cả mọi người" : "Chỉ bạn bè"}
                </div>
              </div>
              <select
                value={allowMsg}
                onChange={async (e) => {
                  const val = e.target.value;
                  setAllowMsg(val);
                  localStorage.setItem("allow_messages_from", val);
                  try {
                    await api.put("/auth/privacy-settings", {
                      allowMessagesFrom: val,
                    });
                  } catch {}
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1.5px solid var(--border-color, #e4e6eb)",
                  fontSize: 13,
                  background: "var(--bg-primary, #fff)",
                  color: "var(--text-primary, #222)",
                  cursor: "pointer",
                }}
              >
                <option value="everyone">Tất cả mọi người</option>
                <option value="contacts">Chỉ bạn bè</option>
              </select>
            </div>
            <SettingsToggle
              label="Ẩn trạng thái online"
              defaultOn={hideOnline}
              onChange={(val) => {
                setHideOnline(val);
                localStorage.setItem("hide_online_status", val ? "1" : "0");
                window.dispatchEvent(
                  new CustomEvent("privacy:hide_online_changed", {
                    detail: val,
                  }),
                );
              }}
            />
          </div>
        );

      case "notify":
        return (
          <div className="settings-content-panel">
            <h3>Thông báo</h3>
            <SettingsToggle
              label="Thông báo tin nhắn mới"
              sublabel="Phát âm thanh khi nhận tin nhắn"
              defaultOn={localStorage.getItem("notify_message") !== "0"}
              onChange={(val) =>
                localStorage.setItem("notify_message", val ? "1" : "0")
              }
            />
            <SettingsToggle
              label="Thông báo cuộc gọi"
              sublabel="Phát âm thanh khi có cuộc gọi đến"
              defaultOn={localStorage.getItem("notify_call") !== "0"}
              onChange={(val) =>
                localStorage.setItem("notify_call", val ? "1" : "0")
              }
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-sidebar">
          <div className="settings-sidebar-title">Cài đặt</div>
          {SETTINGS_MENU.map((item) => (
            <button
              key={item.id}
              className={`settings-menu-item ${active === item.id ? "active" : ""}`}
              onClick={() => setActive(item.id)}
            >
              <span className="smi-icon">
                <item.Icon />
              </span>
              <span>{item.label}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="settings-logout-btn" onClick={logout}>
            <IcLogout /> Đăng xuất
          </button>
        </div>
        <div className="settings-body">
          <button className="settings-close-btn" onClick={onClose}>
            ✕
          </button>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

const SettingsToggle = ({
  label,
  sublabel,
  defaultOn = true,
  inline = false,
  onChange,
}) => {
  const [on, setOn] = useState(defaultOn);
  if (inline)
    return (
      <div
        className={`toggle-switch ${on ? "on" : ""}`}
        onClick={() =>
          setOn((v) => {
            onChange?.(!v);
            return !v;
          })
        }
      >
        <div className="toggle-knob" />
      </div>
    );
  return (
    <div className="settings-item">
      <div>
        <div>{label}</div>
        {sublabel && (
          <div style={{ fontSize: 12, color: "#999" }}>{sublabel}</div>
        )}
      </div>
      <div
        className={`toggle-switch ${on ? "on" : ""}`}
        onClick={() =>
          setOn((v) => {
            onChange?.(!v);
            return !v;
          })
        }
      >
        <div className="toggle-knob" />
      </div>
    </div>
  );
};

export default SettingsModal;
