import React, { useEffect, useRef, useState, useCallback } from "react";
import { useWebRTC } from "../../hooks/useWebRTC";
import "./CallModal.css";
import { useAuth } from "../../hooks/useAuth";
import UserAvatar from "../chat/UserAvatar";

const BASE_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith("http")) return avatar;
  if (avatar.startsWith("/uploads")) return `${BASE_URL}${avatar}`;
  return avatar;
};

const fmt = (s) => {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
};

const DraggableDialog = ({ children, className = "", minimized }) => {
  const [pos, setPos] = useState(null);
  const dragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const ref = useRef(null);
  const { user } = useAuth();

  const onMouseDown = useCallback((e) => {
    if (e.target.closest("button") || e.target.closest("video")) return;
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    dragging.current = true;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startPos.current = { x: rect.left, y: rect.top };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      setPos({
        x: startPos.current.x + (e.clientX - startMouse.current.x),
        y: startPos.current.y + (e.clientY - startMouse.current.y),
      });
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const style = minimized
    ? {
        position: "fixed",
        right: 16,
        bottom: 16,
        left: "auto",
        top: "auto",
        transform: "none",
      }
    : pos
      ? { position: "fixed", left: pos.x, top: pos.y, transform: "none" }
      : {};

  return (
    <div
      ref={ref}
      className={`call-dialog ${className}`}
      style={style}
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  );
};

const QualityBar = ({ quality }) => {
  const c = { good: "#4ade80", fair: "#facc15", poor: "#f87171" };
  return (
    <div className="call-quality">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="quality-bar"
          style={{
            height: i * 4 + 4,
            background:
              (quality === "poor" && i > 1) || (quality === "fair" && i > 2)
                ? "rgba(255,255,255,0.15)"
                : c[quality],
          }}
        />
      ))}
    </div>
  );
};

const CtrlBtn = ({
  onClick,
  active,
  size = 52,
  children,
  variant = "default",
  title,
  disabled,
}) => (
  <button
    className={`call-ctrl-btn call-ctrl-btn--${variant} ${active ? "active" : ""}`}
    style={{ width: size, height: size, opacity: disabled ? 0.5 : 1 }}
    onClick={onClick}
    title={title}
    disabled={disabled}
  >
    {children}
  </button>
);

const DevicePicker = ({
  kind,
  devices,
  currentId,
  onSelect,
  onClose,
  alignRight,
}) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div
      className={`call-device-picker ${alignRight ? "call-device-picker--right" : ""}`}
      ref={ref}
    >
      <div className="call-device-picker-title">
        {kind === "audioinput"
          ? "🎙 Chọn micro"
          : kind === "audiooutput"
            ? "🔊 Chọn loa"
            : "📷 Chọn camera"}
      </div>
      {devices.length === 0 && (
        <div className="call-device-empty">Không tìm thấy thiết bị</div>
      )}
      {devices.map((d) => (
        <button
          key={d.deviceId}
          className={`call-device-item ${d.deviceId === currentId ? "active" : ""}`}
          onClick={() => {
            onSelect(d.deviceId);
            onClose();
          }}
        >
          {d.deviceId === currentId ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#1976d2">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          ) : (
            <span style={{ width: 12, display: "inline-block" }} />
          )}
          <span>{d.label || `Thiết bị ${d.deviceId.slice(0, 8)}`}</span>
        </button>
      ))}
    </div>
  );
};

const DeviceCtrlGroup = ({
  mainBtn,
  arrowTitle,
  picker,
  showPicker,
  onTogglePicker,
  label,
  alignRight,
}) => (
  <div className="call-ctrl-group">
    <div className="call-ctrl-with-arrow">
      {mainBtn}
      <button
        className="call-arrow-btn"
        onClick={onTogglePicker}
        title={arrowTitle}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {showPicker && (
        <div
          className={`call-device-picker-wrap ${alignRight ? "call-device-picker-wrap--right" : ""}`}
        >
          {picker}
        </div>
      )}
    </div>
    <span className="call-ctrl-label">{label}</span>
  </div>
);

// ── Pending type change notification banner ───────────────────────────────────
const TypeChangeBanner = ({
  pendingTypeChange,
  remoteUserName,
  onAccept,
  onReject,
}) => {
  if (!pendingTypeChange) return null;
  const { newCallType } = pendingTypeChange;
  return (
    <div className="call-type-change-banner">
      <div className="call-type-change-banner-info">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ flexShrink: 0, color: "#facc15" }}
        >
          {newCallType === "video" ? (
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
          ) : (
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          )}
        </svg>
        <span>
          {remoteUserName} muốn chuyển sang{" "}
          {newCallType === "video" ? "gọi video" : "gọi thoại"}. Bạn có muốn{" "}
          {newCallType === "video" ? "mở camera" : "tắt camera"} không?
        </span>
      </div>
      <div className="call-type-change-banner-actions">
        <button
          className="call-type-change-btn call-type-change-btn--reject"
          onClick={onReject}
        >
          Từ chối
        </button>
        <button
          className="call-type-change-btn call-type-change-btn--accept"
          onClick={onAccept}
        >
          Chấp nhận
        </button>
      </div>
    </div>
  );
};

const CallModal = () => {
  const { user } = useAuth();
  const {
    callState,
    callType,
    remoteUser,
    isMuted,
    isCameraOff,
    isSpeakerOff,
    callDuration,
    isRemoteVideoOff,
    isRemoteMuted,
    connectionQuality,
    onRemoteVideoMount,
    onLocalVideoMount,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    localStreamRef,
    peerRef,
    pendingTypeChange,
    requestCallTypeChange,
    acceptCallTypeChange,
    rejectCallTypeChange,
    isTransitioning,
  } = useWebRTC();

  const [minimized, setMinimized] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isRequestingTypeChange, setIsRequestingTypeChange] = useState(false);
  const shareStreamRef = useRef(null);
  const prevVideoTrackRef = useRef(null);
  const miniVideoRef = useRef(null);

  // FIX: Chỉ giữ ref cho calling (người gọi preview camera trước khi kết nối)
  // Bỏ ringingLocalVideoRef vì KHÔNG preview camera khi ringing để tránh conflict thiết bị
  const callingLocalVideoRef = useRef(null);

  useEffect(() => {
    if (callState !== "idle") setMinimized(false);
  }, [callState]);

  // Mount local video cho người gọi (calling state)
  useEffect(() => {
    if (callType !== "video") return;
    if (callState === "calling" && callingLocalVideoRef.current) {
      onLocalVideoMount(callingLocalVideoRef.current);
    }
  }, [callState, callType, onLocalVideoMount]);

  // FIX: KHÔNG preview camera khi ringing để tránh conflict "Device in use"
  // Khi người nhận bấm chấp nhận, acceptCall sẽ tự xin quyền camera mới

  const [micDevices, setMicDevices] = useState([]);
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [currentMicId, setCurrentMicId] = useState("default");
  const [currentSpeakerId, setCurrentSpeakerId] = useState("default");
  const [currentCameraId, setCurrentCameraId] = useState("default");
  const [showMicPicker, setShowMicPicker] = useState(false);
  const [showSpeakerPicker, setShowSpeakerPicker] = useState(false);
  const [showCamPicker, setShowCamPicker] = useState(false);

  const [remoteNickname, setRemoteNickname] = useState(() =>
    remoteUser?._id
      ? localStorage.getItem(`nickname_user_${remoteUser._id}`) || ""
      : "",
  );

  useEffect(() => {
    if (remoteUser?._id) {
      setRemoteNickname(
        localStorage.getItem(`nickname_user_${remoteUser._id}`) || "",
      );
    }
  }, [remoteUser?._id]);

  useEffect(() => {
    const handler = (e) => {
      const { userId, nickname } = e.detail || {};
      if (userId === remoteUser?._id) {
        setRemoteNickname(nickname || "");
      }
    };
    window.addEventListener("nickname:changed", handler);
    return () => window.removeEventListener("nickname:changed", handler);
  }, [remoteUser?._id]);

  useEffect(() => {
    if (callState === "idle") return;
    const load = () => {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devs) => {
          setMicDevices(devs.filter((d) => d.kind === "audioinput"));
          setSpeakerDevices(devs.filter((d) => d.kind === "audiooutput"));
          setCameraDevices(devs.filter((d) => d.kind === "videoinput"));
        })
        .catch(() => {});
    };
    load();
    navigator.mediaDevices.addEventListener?.("devicechange", load);
    return () =>
      navigator.mediaDevices.removeEventListener?.("devicechange", load);
  }, [callState]);

  useEffect(() => {
    if (!minimized || !miniVideoRef.current || !localStreamRef?.current) return;
    miniVideoRef.current.srcObject = localStreamRef.current;
  }, [minimized, localStreamRef]);

  const closeAllPickers = useCallback(() => {
    setShowMicPicker(false);
    setShowSpeakerPicker(false);
    setShowCamPicker(false);
  }, []);

  const stopAllLocalTracks = useCallback(() => {
    if (shareStreamRef.current) {
      shareStreamRef.current.getTracks().forEach((t) => t.stop());
      shareStreamRef.current = null;
    }
    if (localStreamRef?.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
  }, [localStreamRef]);

  const handleEndCall = useCallback(() => {
    stopAllLocalTracks();
    endCall();
  }, [endCall, stopAllLocalTracks]);

  const handleRejectCall = useCallback(() => {
    stopAllLocalTracks();
    rejectCall();
  }, [rejectCall, stopAllLocalTracks]);

  const handleRequestTypeChange = useCallback(async () => {
    if (isRequestingTypeChange) return;
    const newType = callType === "video" ? "voice" : "video";
    setIsRequestingTypeChange(true);
    try {
      await requestCallTypeChange(newType);
    } catch (e) {
      console.error("requestCallTypeChange error:", e);
      setIsRequestingTypeChange(false);
    }
    setTimeout(() => setIsRequestingTypeChange(false), 15000);
  }, [callType, requestCallTypeChange, isRequestingTypeChange]);

  useEffect(() => {
    setIsRequestingTypeChange(false);
  }, [callType]);

  useEffect(() => {
    if (!pendingTypeChange) {
      setIsRequestingTypeChange(false);
    }
  }, [pendingTypeChange]);

  const changeMic = useCallback(
    async (deviceId) => {
      setCurrentMicId(deviceId);
      if (!localStreamRef?.current || !peerRef?.current) return;
      try {
        const ns = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId } },
          video: false,
        });
        const [nt] = ns.getAudioTracks();
        const sender = peerRef.current
          .getSenders()
          .find((s) => s.track?.kind === "audio");
        if (sender && nt) await sender.replaceTrack(nt);
        const ot = localStreamRef.current.getAudioTracks()[0];
        if (ot) {
          localStreamRef.current.removeTrack(ot);
          ot.stop();
        }
        if (nt) localStreamRef.current.addTrack(nt);
      } catch (e) {
        console.warn("changeMic:", e);
      }
    },
    [localStreamRef, peerRef],
  );

  const changeSpeaker = useCallback((deviceId) => {
    setCurrentSpeakerId(deviceId);
    document.querySelectorAll("audio,video").forEach((el) => {
      if (el.setSinkId) el.setSinkId(deviceId).catch(() => {});
    });
  }, []);

  const changeCamera = useCallback(
    async (deviceId) => {
      setCurrentCameraId(deviceId);
      if (!localStreamRef?.current || !peerRef?.current) return;
      try {
        const ns = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { deviceId: { exact: deviceId } },
        });
        const [nt] = ns.getVideoTracks();
        const sender = peerRef.current
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender && nt) await sender.replaceTrack(nt);
        const ot = localStreamRef.current.getVideoTracks()[0];
        if (ot) {
          localStreamRef.current.removeTrack(ot);
          ot.stop();
        }
        if (nt) localStreamRef.current.addTrack(nt);
        const lv = document.querySelector(".call-local-video");
        if (lv) lv.srcObject = localStreamRef.current;
      } catch (e) {
        console.warn("changeCamera:", e);
      }
    },
    [localStreamRef, peerRef],
  );

  const restoreCamera = useCallback(async () => {
    try {
      const cs = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      const [ct] = cs.getVideoTracks();
      if (peerRef?.current) {
        const sender = peerRef.current
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(ct);
      }
      if (localStreamRef?.current) {
        const ot = localStreamRef.current.getVideoTracks()[0];
        if (ot) {
          localStreamRef.current.removeTrack(ot);
          ot.stop();
        }
        localStreamRef.current.addTrack(ct);
      }
    } catch (e) {}
  }, [peerRef, localStreamRef]);

  const toggleShare = useCallback(async () => {
    if (isSharing) {
      if (shareStreamRef.current) {
        shareStreamRef.current.getTracks().forEach((t) => t.stop());
        shareStreamRef.current = null;
      }
      await restoreCamera();
      setIsSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        shareStreamRef.current = stream;
        const [st] = stream.getVideoTracks();
        prevVideoTrackRef.current =
          localStreamRef?.current?.getVideoTracks()[0] || null;
        if (peerRef?.current) {
          const sender = peerRef.current
            .getSenders()
            .find((s) => s.track?.kind === "video");
          if (sender) await sender.replaceTrack(st);
        }
        if (localStreamRef?.current) {
          const ot = localStreamRef.current.getVideoTracks()[0];
          if (ot) localStreamRef.current.removeTrack(ot);
          localStreamRef.current.addTrack(st);
        }
        setIsSharing(true);
        st.onended = async () => {
          shareStreamRef.current = null;
          setIsSharing(false);
          await restoreCamera();
        };
      } catch (e) {}
    }
  }, [isSharing, localStreamRef, peerRef, restoreCamera]);

  if (callState === "idle") return null;

  const isVideo = callType === "video";
  const isConnected = callState === "connected";
  const isCalling = callState === "calling";
  const isRinging = callState === "ringing";
  const displayName = remoteNickname || remoteUser?.name;
  const statusText = isCalling
    ? "Đang gọi..."
    : isRinging
      ? `Cuộc gọi ${isVideo ? "video" : "thoại"} đến`
      : isConnected
        ? fmt(callDuration)
        : "";

  // ── MINIMIZED ─────────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <DraggableDialog className="call-dialog--mini" minimized>
        <div className="call-mini-bar">
          {isVideo && isConnected && (
            <div className="call-mini-cam-wrap">
              <video
                ref={miniVideoRef}
                autoPlay
                muted
                playsInline
                className="call-mini-cam-video"
              />
            </div>
          )}
          <div className="call-mini-bar-info">
            <UserAvatar
              name={displayName}
              avatar={remoteUser?.avatar}
              size={36}
              className="call-mini-avatar"
            />
            <div>
              <div className="call-mini-name">{displayName}</div>
              <div
                className={`call-mini-status ${isConnected ? "connected" : ""}`}
              >
                {isConnected ? fmt(callDuration) : statusText}
              </div>
            </div>
          </div>
          <div className="call-mini-actions">
            <button
              className="call-mini-btn"
              onClick={toggleMute}
              title={isMuted ? "Bật mic" : "Tắt mic"}
            >
              {isMuted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#f87171">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="rgba(255,255,255,0.8)"
                >
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                </svg>
              )}
            </button>
            <button
              className="call-mini-btn call-mini-btn--end"
              onClick={isRinging ? handleRejectCall : handleEndCall}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path
                  d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"
                  transform="rotate(135,12,12)"
                />
              </svg>
            </button>
            <button
              className="call-mini-btn call-mini-btn--expand"
              onClick={() => setMinimized(false)}
              title="Mở rộng"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="rgba(255,255,255,0.7)"
              >
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            </button>
          </div>
        </div>
      </DraggableDialog>
    );
  }

  return (
    <>
      <div className="call-backdrop" />
      <DraggableDialog
        className={isVideo ? "call-dialog--video" : "call-dialog--voice"}
      >
        <div className="call-dialog-header">
          <span className="call-dialog-type">
            {isVideo ? (
              <>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>{" "}
                Gọi video
              </>
            ) : (
              <>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>{" "}
                Gọi thoại
              </>
            )}
          </span>
          <button
            className="call-header-btn"
            onClick={() => setMinimized(true)}
            title="Thu nhỏ"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
            </svg>
          </button>
        </div>

        {/* Type change request banner (receiver side) */}
        {pendingTypeChange && (
          <TypeChangeBanner
            pendingTypeChange={pendingTypeChange}
            remoteUserName={displayName || "Đối phương"}
            onAccept={acceptCallTypeChange}
            onReject={rejectCallTypeChange}
          />
        )}

        {/* ── VIDEO AREA ── */}
        {isVideo && (
          <div className="call-video-area">
            {isConnected && !isRemoteVideoOff ? (
              <video
                ref={onRemoteVideoMount}
                autoPlay
                playsInline
                className="call-remote-video"
              />
            ) : isConnected ? (
              <div className="call-video-placeholder">
                <UserAvatar
                  name={displayName}
                  avatar={remoteUser?.avatar}
                  size={100}
                  className="call-video-avatar"
                />
                <p className="call-video-status">Camera đã tắt</p>
              </div>
            ) : (
              // FIX: Khi calling → hiện preview camera của người gọi
              // Khi ringing → chỉ hiện avatar + status, KHÔNG preview camera
              // để tránh conflict "Device in use" khi acceptCall xin quyền
              isCalling ? (
                <div className="call-video-calling-wrap">
                  <video
                    ref={callingLocalVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="call-remote-video"
                  />
                  <div className="call-video-overlay">
                    <span className="call-video-name">{displayName}</span>
                    <span className="call-video-status-overlay">
                      {statusText}
                    </span>
                  </div>
                </div>
              ) : (
                // Ringing: hiện avatar thay vì preview camera
                <div className="call-video-placeholder">
                  <UserAvatar
                    name={displayName}
                    avatar={remoteUser?.avatar}
                    size={100}
                    className="call-video-avatar"
                  />
                  <p className="call-video-status">{statusText}</p>
                </div>
              )
            )}
            {isConnected && (
              <div className="call-local-pip">
                {!isCameraOff ? (
                  <video
                    ref={onLocalVideoMount}
                    autoPlay
                    muted
                    playsInline
                    className="call-local-video"
                  />
                ) : (
                  <div
                    className="call-local-off"
                    style={{ overflow: "hidden" }}
                  >
                    <UserAvatar
                      name={user?.name}
                      avatar={user?.avatar}
                      size={80}
                      style={{ width: "100%", height: "100%", borderRadius: 0 }}
                    />
                  </div>
                )}
              </div>
            )}
            {isConnected && (
              <div
                className="call-video-overlay"
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span
                  className="call-video-name"
                  style={{
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                  }}
                >
                  {displayName}
                </span>
                <span
                  className="call-video-dur"
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 13,
                    textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                  }}
                >
                  {fmt(callDuration)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── VOICE AREA ── */}
        {!isVideo && (
          <div className="call-voice-body">
            {isTransitioning && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "inherit",
                  zIndex: 10,
                  color: "#fff",
                  fontSize: 14,
                }}
              >
                Đang chuyển sang gọi video...
              </div>
            )}
            <UserAvatar
              name={displayName}
              avatar={remoteUser?.avatar}
              size={80}
              className="call-voice-avatar"
            />
            <h3 className="call-voice-name">{displayName}</h3>
            <div className="call-voice-status">
              {isConnected ? (
                <>
                  <QualityBar quality={connectionQuality} />
                  <span className="call-voice-dur">{statusText}</span>
                </>
              ) : (
                <span>{statusText}</span>
              )}
              {isRemoteMuted && (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="#f87171"
                  style={{ marginLeft: 6 }}
                >
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* ── CONTROLS ── */}
        <div className="call-controls" onClick={closeAllPickers}>
          {/* ── RINGING: nút từ chối + chấp nhận ── */}
          {isRinging && (
            <>
              <div className="call-ctrl-group">
                <CtrlBtn onClick={handleRejectCall} variant="end" size={56}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path
                      d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"
                      transform="rotate(135,12,12)"
                    />
                  </svg>
                </CtrlBtn>
                <span className="call-ctrl-label call-ctrl-label--red">
                  Từ chối
                </span>
              </div>
              <div className="call-ctrl-group">
                <CtrlBtn onClick={acceptCall} variant="accept" size={56}>
                  {isVideo ? (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="white"
                    >
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                    </svg>
                  ) : (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="white"
                    >
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </svg>
                  )}
                </CtrlBtn>
                <span className="call-ctrl-label call-ctrl-label--green">
                  Chấp nhận
                </span>
              </div>
            </>
          )}

          {/* ── CALLING / CONNECTED: controls đầy đủ ── */}
          {(isCalling || isConnected) && (
            <>
              {/* Mic */}
              <DeviceCtrlGroup
                label={isMuted ? "Bật mic" : "Tắt mic"}
                arrowTitle="Chọn micro"
                showPicker={showMicPicker}
                onTogglePicker={(e) => {
                  e.stopPropagation();
                  setShowMicPicker((p) => !p);
                  setShowSpeakerPicker(false);
                  setShowCamPicker(false);
                }}
                mainBtn={
                  <CtrlBtn onClick={toggleMute} active={isMuted}>
                    {isMuted ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                      </svg>
                    ) : (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                      </svg>
                    )}
                  </CtrlBtn>
                }
                picker={
                  <DevicePicker
                    kind="audioinput"
                    devices={micDevices}
                    currentId={currentMicId}
                    onSelect={changeMic}
                    onClose={() => setShowMicPicker(false)}
                  />
                }
              />

              {/* Camera (video only) */}
              {isVideo && (
                <DeviceCtrlGroup
                  label={isCameraOff ? "Bật cam" : "Tắt cam"}
                  arrowTitle="Chọn camera"
                  showPicker={showCamPicker}
                  onTogglePicker={(e) => {
                    e.stopPropagation();
                    setShowCamPicker((p) => !p);
                    setShowMicPicker(false);
                    setShowSpeakerPicker(false);
                  }}
                  mainBtn={
                    <CtrlBtn onClick={toggleCamera} active={isCameraOff}>
                      {isCameraOff ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                          <line
                            x1="2"
                            y1="2"
                            x2="22"
                            y2="22"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                        </svg>
                      )}
                    </CtrlBtn>
                  }
                  picker={
                    <DevicePicker
                      kind="videoinput"
                      devices={cameraDevices}
                      currentId={currentCameraId}
                      onSelect={changeCamera}
                      onClose={() => setShowCamPicker(false)}
                    />
                  }
                />
              )}

              {/* Speaker */}
              <DeviceCtrlGroup
                label={isSpeakerOff ? "Bật loa" : "Tắt loa"}
                arrowTitle="Chọn loa"
                showPicker={showSpeakerPicker}
                alignRight
                onTogglePicker={(e) => {
                  e.stopPropagation();
                  setShowSpeakerPicker((p) => !p);
                  setShowMicPicker(false);
                  setShowCamPicker(false);
                }}
                mainBtn={
                  <CtrlBtn onClick={toggleSpeaker} active={isSpeakerOff}>
                    {isSpeakerOff ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    )}
                  </CtrlBtn>
                }
                picker={
                  <DevicePicker
                    kind="audiooutput"
                    devices={speakerDevices}
                    currentId={currentSpeakerId}
                    onSelect={changeSpeaker}
                    onClose={() => setShowSpeakerPicker(false)}
                    alignRight
                  />
                }
              />

              {/* Screen share (video + connected only) */}
              {isVideo && isConnected && (
                <div className="call-ctrl-group">
                  <CtrlBtn
                    onClick={toggleShare}
                    active={isSharing}
                    title="Chia sẻ màn hình"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6zm8 8l-4-4h3V7h2v3h3l-4 4z" />
                    </svg>
                  </CtrlBtn>
                  <span className="call-ctrl-label">
                    {isSharing ? "Dừng chia sẻ" : "Màn hình"}
                  </span>
                </div>
              )}

              {isConnected && <div className="call-ctrl-divider" />}

              {/* Chuyển sang video — chỉ hiện khi voice */}
              {isConnected && !isVideo && (
                <div className="call-ctrl-group">
                  <button
                    className={`call-ctrl-btn call-ctrl-btn--switch ${isRequestingTypeChange ? "active" : ""} call-ctrl-btn--switch-to-video`}
                    onClick={handleRequestTypeChange}
                    disabled={isRequestingTypeChange || !!pendingTypeChange}
                    title={
                      isRequestingTypeChange
                        ? "Đang chờ đối phương xác nhận..."
                        : "Chuyển sang gọi video"
                    }
                    style={{ width: 50, height: 50 }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                    </svg>
                  </button>
                  <span className="call-ctrl-label">
                    {isRequestingTypeChange ? "Đang chờ..." : "Gọi video"}
                  </span>
                </div>
              )}

              <div className="call-ctrl-divider" />

              {/* End call */}
              <div className="call-ctrl-group">
                <CtrlBtn onClick={handleEndCall} variant="end" size={56}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path
                      d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"
                      transform="rotate(135,12,12)"
                    />
                  </svg>
                </CtrlBtn>
                <span className="call-ctrl-label call-ctrl-label--red">
                  Kết thúc
                </span>
              </div>
            </>
          )}
        </div>
      </DraggableDialog>
    </>
  );
};

export default CallModal;