import React, { useEffect, useRef, useState, useCallback } from "react";
import { useWebRTC } from "../../hooks/useWebRTC";
import { useAuth } from "../../hooks/useAuth";
import UserAvatar from "../chat/UserAvatar";
import "./GroupCallModal.css";

const BASE_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.includes("dicebear")) return null;
  if (avatar.startsWith("http")) return avatar;
  if (avatar.startsWith("/uploads")) return `${BASE_URL}${avatar}`;
  return null;
};

const getNickname = (userId) => {
  if (!userId) return null;
  return localStorage.getItem(`nickname_user_${userId}`) || null;
};

const AVATAR_COLORS = [
  "#1abc9c","#2ecc71","#3498db","#9b59b6","#e67e22",
  "#e74c3c","#1a73e8","#e91e63","#009688","#ff5722",
  "#607d8b","#795548","#f44336","#673ab7","#2196f3",
];

const getAvatarColor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const fmt = (s) => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
};

const DraggableDialog = ({ children, className = "", minimized }) => {
  const [pos, setPos] = useState(null);
  const dragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const ref = useRef(null);

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
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const style = minimized
    ? { position: "fixed", right: 16, bottom: 16, left: "auto", top: "auto", transform: "none" }
    : pos
      ? { position: "fixed", left: pos.x, top: pos.y, transform: "none" }
      : {};

  return (
    <div ref={ref} className={`gc-dialog ${className}`} style={style} onMouseDown={onMouseDown}>
      {children}
    </div>
  );
};

const DevicePicker = ({ kind, devices, currentId, onSelect, onClose, alignRight }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const title = kind === "audioinput" ? "🎙 Chọn micro" : kind === "audiooutput" ? "🔊 Chọn loa" : "📷 Chọn camera";
  return (
    <div className={`gc-device-picker ${alignRight ? "gc-device-picker--right" : ""}`} ref={ref}>
      <div className="gc-device-picker-title">{title}</div>
      {devices.length === 0 && <div className="gc-device-empty">Không tìm thấy thiết bị</div>}
      {devices.map((d) => (
        <button
          key={d.deviceId}
          className={`gc-device-item ${d.deviceId === currentId ? "active" : ""}`}
          onClick={() => { onSelect(d.deviceId); onClose(); }}
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

const DeviceCtrlGroup = ({ mainBtn, arrowTitle, showPicker, onTogglePicker, picker, label, alignRight }) => (
  <div className="gc-ctrl-group">
    <div className="gc-ctrl-with-arrow">
      {mainBtn}
      <button className="gc-arrow-btn" onClick={onTogglePicker} title={arrowTitle}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {showPicker && (
        <div className={`gc-device-picker-wrap ${alignRight ? "gc-device-picker-wrap--right" : ""}`}>
          {picker}
        </div>
      )}
    </div>
    <span className="gc-ctrl-label">{label}</span>
  </div>
);

// ── BUG FIX: Banner hiển thị cho tất cả participant nhận yêu cầu đổi loại gọi ──
const GroupTypeChangeBanner = ({ pendingTypeChange, onAccept, onReject }) => {
  if (!pendingTypeChange) return null;
  const { requester, newCallType } = pendingTypeChange;
  return (
    <div className="gc-type-change-banner">
      <div className="gc-type-change-banner-info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, color: "#facc15" }}>
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
        </svg>
        <span>
          <strong>
            {(() => {
              const id = requester?.userId?.toString?.();
              return (id && localStorage.getItem(`nickname_user_${id}`)) || requester?.name || "Ai đó";
            })()}
          </strong>{" "}
          muốn chuyển sang {newCallType === "video" ? "gọi video" : "gọi thoại"}
        </span>
      </div>
      <div className="gc-type-change-banner-actions">
        <button className="gc-type-change-btn gc-type-change-btn--reject" onClick={onReject}>
          Từ chối
        </button>
        <button className="gc-type-change-btn gc-type-change-btn--accept" onClick={onAccept}>
          Chấp nhận
        </button>
      </div>
    </div>
  );
};

// ── Video tile ────────────────────────────────────────────────────────────────
const ParticipantTile = ({ participant, isSelf, localVideoRef, isPinned, onPin, displayName, callType }) => {
  const videoRef = useRef(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (isSelf) return;
    if (!videoRef.current) return;
    if (participant.stream) {
      videoRef.current.srcObject = participant.stream;
      videoRef.current.play().catch(() => {});
    }
  }, [participant.stream, participant.isCameraOff, isSelf]);

  useEffect(() => {
    if (isSelf || !videoRef.current || !participant.stream) return;
    const stream = participant.stream;
    const onAddTrack = () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    };
    stream.addEventListener("addtrack", onAddTrack);
    return () => stream.removeEventListener("addtrack", onAddTrack);
  }, [participant.stream, isSelf]);

  // BUG FIX: showVideo phải check callType đúng, không dùng logic sai cũ
  const showVideo =
    callType === "video" &&
    (isSelf
      ? !participant.isCameraOff
      : !!(participant.stream && !participant.isCameraOff));

  return (
    <div
      className={`gc-tile ${isPinned ? "gc-tile--pinned" : ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {showVideo ? (
        isSelf ? (
          <video ref={localVideoRef} autoPlay muted playsInline className="gc-video" />
        ) : (
          <video ref={videoRef} autoPlay playsInline className="gc-video" />
        )
      ) : (
        <div className="gc-avatar-placeholder">
          <UserAvatar name={participant.name} avatar={participant.avatar} size={64} />
        </div>
      )}
      {hover && (
        <button
          className={`gc-pin-btn ${isPinned ? "pinned" : ""}`}
          onClick={() => onPin(participant.userId)}
          title={isPinned ? "Bỏ ghim" : "Ghim"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        </button>
      )}
      <div className="gc-tile-footer">
        {isPinned && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#facc15" style={{ marginRight: 3 }}>
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        )}
        <span className="gc-tile-name">{displayName}</span>
        {participant.isMuted && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.75)">
            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
          </svg>
        )}
      </div>
    </div>
  );
};

const GroupCallModal = () => {
  const {
    groupCallState,
    groupCallType,
    groupCallName,
    groupParticipants,
    groupCallDuration,
    groupIsMuted,
    groupIsCameraOff,
    incomingGroupCall,
    onGroupLocalVideoMount,
    leaveGroupCall,
    acceptGroupCall,
    declineGroupCall,
    toggleGroupMute,
    toggleGroupCamera,
    switchGroupCallType,
    groupPeersRef,
    groupLocalStreamRef,
    groupPendingTypeChange,
    acceptGroupTypeChange,
    rejectGroupTypeChange,
  } = useWebRTC();

  const [minimized, setMinimized] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSwitchingType, setIsSwitchingType] = useState(false);
  const shareStreamRef = useRef(null);
  const [pinnedUserId, setPinnedUserId] = useState(null);

  const { user } = useAuth();

  // ── Nickname map ──────────────────────────────────────────────────────────
  const [nicknames, setNicknames] = useState({});

  useEffect(() => {
    const map = {};
    groupParticipants.forEach((p) => {
      if (!p.isSelf) {
        map[p.userId] = localStorage.getItem(`nickname_user_${p.userId}`) || "";
      }
    });
    setNicknames(map);
  }, [groupParticipants]);

  useEffect(() => {
    const handler = (e) => {
      const { userId, nickname } = e.detail || {};
      if (userId) setNicknames((prev) => ({ ...prev, [userId]: nickname || "" }));
    };
    window.addEventListener("nickname:changed", handler);
    return () => window.removeEventListener("nickname:changed", handler);
  }, []);

  const getDisplayName = (p) => {
    if (p.isSelf) return "Bạn";
    return nicknames[p.userId] || p.name;
  };

  const isActive = groupCallState === "calling" || groupCallState === "connected";
  const isConnected = groupCallState === "connected";
  const isVideo = groupCallType === "video";

  // BUG FIX: mở rộng lại khi có cuộc gọi mới
  useEffect(() => {
    if (isActive) setMinimized(false);
  }, [isActive]);

  const miniCamRef = useRef(null);

  const [micDevices, setMicDevices] = useState([]);
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [currentMicId, setCurrentMicId] = useState("default");
  const [currentSpeakerId, setCurrentSpeakerId] = useState("default");
  const [currentCameraId, setCurrentCameraId] = useState("default");
  const [showMicPicker, setShowMicPicker] = useState(false);
  const [showSpeakerPicker, setShowSpeakerPicker] = useState(false);
  const [showCamPicker, setShowCamPicker] = useState(false);

  const allTiles = [...groupParticipants.values()];
  const count = allTiles.length;

  const tiles = pinnedUserId
    ? [
        ...allTiles.filter((p) => p.userId === pinnedUserId),
        ...allTiles.filter((p) => p.userId !== pinnedUserId),
      ]
    : allTiles;

  const gridClass = pinnedUserId
    ? count <= 2 ? "gc-grid--pinned-2" : count <= 4 ? "gc-grid--pinned-4" : "gc-grid--pinned-many"
    : count <= 1 ? "gc-grid--1"
    : count === 2 ? "gc-grid--2"
    : count === 3 ? "gc-grid--3"
    : count === 4 ? "gc-grid--4"
    : count <= 6 ? "gc-grid--6"
    : "gc-grid--many";

  const dialogSize =
    count <= 2 ? "gc-dialog--sm" : count <= 4 ? "gc-dialog--md" : "gc-dialog--lg";

  useEffect(() => {
    if (!isActive) return;
    const load = () => {
      navigator.mediaDevices.enumerateDevices().then((devs) => {
        setMicDevices(devs.filter((d) => d.kind === "audioinput"));
        setSpeakerDevices(devs.filter((d) => d.kind === "audiooutput"));
        setCameraDevices(devs.filter((d) => d.kind === "videoinput"));
      }).catch(() => {});
    };
    load();
    navigator.mediaDevices.addEventListener?.("devicechange", load);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", load);
  }, [isActive]);

  useEffect(() => {
    if (!minimized || !miniCamRef.current || !groupLocalStreamRef?.current) return;
    miniCamRef.current.srcObject = groupLocalStreamRef.current;
  }, [minimized, groupLocalStreamRef]);

  const closeAllPickers = () => {
    setShowMicPicker(false);
    setShowSpeakerPicker(false);
    setShowCamPicker(false);
  };

  const handleLeave = useCallback(() => {
    if (shareStreamRef.current) {
      shareStreamRef.current.getTracks().forEach((t) => t.stop());
      shareStreamRef.current = null;
    }
    leaveGroupCall();
  }, [leaveGroupCall]);

  // ── BUG FIX: Switch voice ↔ video với proper error handling ──────────────
  const handleSwitchCallType = useCallback(async () => {
    if (isSwitchingType) return;
    const newType = isVideo ? "voice" : "video";
    setIsSwitchingType(true);
    try {
      await switchGroupCallType(newType);
    } catch (e) {
      console.error("switchGroupCallType error:", e);
      setIsSwitchingType(false);
    }
    // Timeout 15s nếu không có phản hồi
    if (newType === "voice") {
      setIsSwitchingType(false);
    } else {
      setTimeout(() => setIsSwitchingType(false), 15000);
    }
  }, [isVideo, switchGroupCallType, isSwitchingType]);

  // Reset khi type thực sự thay đổi
  useEffect(() => {
    setIsSwitchingType(false);
  }, [groupCallType]);

  // Reset khi pending bị xóa (từ chối)
  useEffect(() => {
    if (!groupPendingTypeChange) {
      setIsSwitchingType(false);
    }
  }, [groupPendingTypeChange]);

  const changeMic = useCallback(async (deviceId) => {
    setCurrentMicId(deviceId);
    if (!groupLocalStreamRef?.current) return;
    try {
      const ns = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } }, video: false });
      const [nt] = ns.getAudioTracks();
      groupPeersRef?.current?.forEach((peer) => {
        const s = peer.getSenders().find((x) => x.track?.kind === "audio");
        if (s && nt) s.replaceTrack(nt).catch(() => {});
      });
      const ot = groupLocalStreamRef.current.getAudioTracks()[0];
      if (ot) { groupLocalStreamRef.current.removeTrack(ot); ot.stop(); }
      if (nt) groupLocalStreamRef.current.addTrack(nt);
    } catch (e) {}
  }, [groupLocalStreamRef, groupPeersRef]);

  const changeSpeaker = useCallback((deviceId) => {
    setCurrentSpeakerId(deviceId);
    document.querySelectorAll("audio,video").forEach((el) => {
      if (el.setSinkId) el.setSinkId(deviceId).catch(() => {});
    });
  }, []);

  const changeCamera = useCallback(async (deviceId) => {
    setCurrentCameraId(deviceId);
    if (!groupLocalStreamRef?.current) return;
    try {
      const ns = await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: deviceId } } });
      const [nt] = ns.getVideoTracks();
      groupPeersRef?.current?.forEach((peer) => {
        const s = peer.getSenders().find((x) => x.track?.kind === "video");
        if (s && nt) s.replaceTrack(nt).catch(() => {});
      });
      const ot = groupLocalStreamRef.current.getVideoTracks()[0];
      if (ot) { groupLocalStreamRef.current.removeTrack(ot); ot.stop(); }
      if (nt) groupLocalStreamRef.current.addTrack(nt);
    } catch (e) {}
  }, [groupLocalStreamRef, groupPeersRef]);

  const restoreGroupCamera = useCallback(async () => {
    try {
      const cs = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const [ct] = cs.getVideoTracks();
      groupPeersRef?.current?.forEach((peer) => {
        const s = peer.getSenders().find((x) => x.track?.kind === "video");
        if (s) s.replaceTrack(ct).catch(() => {});
      });
      if (groupLocalStreamRef?.current) {
        const ot = groupLocalStreamRef.current.getVideoTracks()[0];
        if (ot) { groupLocalStreamRef.current.removeTrack(ot); ot.stop(); }
        groupLocalStreamRef.current.addTrack(ct);
      }
    } catch (e) {}
  }, [groupPeersRef, groupLocalStreamRef]);

  const toggleShare = useCallback(async () => {
    if (isSharing) {
      if (shareStreamRef.current) {
        shareStreamRef.current.getTracks().forEach((t) => t.stop());
        shareStreamRef.current = null;
      }
      await restoreGroupCamera();
      setIsSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        shareStreamRef.current = stream;
        const [st] = stream.getVideoTracks();
        groupPeersRef?.current?.forEach((peer) => {
          const s = peer.getSenders().find((x) => x.track?.kind === "video");
          if (s) s.replaceTrack(st).catch(() => {});
        });
        if (groupLocalStreamRef?.current) {
          const ot = groupLocalStreamRef.current.getVideoTracks()[0];
          if (ot) groupLocalStreamRef.current.removeTrack(ot);
          groupLocalStreamRef.current.addTrack(st);
        }
        setIsSharing(true);
        st.onended = async () => {
          shareStreamRef.current = null;
          setIsSharing(false);
          await restoreGroupCamera();
        };
      } catch (e) {}
    }
  }, [isSharing, groupPeersRef, groupLocalStreamRef, restoreGroupCamera]);

  const handlePin = useCallback((userId) => {
    setPinnedUserId((prev) => (prev === userId ? null : userId));
  }, []);

  // ── Incoming ──────────────────────────────────────────────────────────────
  if (incomingGroupCall && groupCallState === "idle") {
    return (
      <>
        <div className="gc-backdrop" />
        <div className="gc-incoming-wrapper">
          <div className="gc-incoming-modal">
            <div className="gc-incoming-icon">
              {incomingGroupCall.callType === "video" ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              )}
            </div>
            <h3 className="gc-incoming-title">
              {incomingGroupCall.callType === "video" ? "Cuộc gọi video nhóm" : "Cuộc gọi thoại nhóm"}
            </h3>
            <p className="gc-incoming-group">{incomingGroupCall.groupName}</p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <UserAvatar
                name={(() => {
                  const info = incomingGroupCall.callerInfo;
                  const id = (info?.userId || info?._id || info?.id)?.toString?.();
                  return (id && localStorage.getItem(`nickname_user_${id}`)) || info?.name;
                })()}
                avatar={incomingGroupCall.callerInfo?.avatar}
                size={56}
              />
              <p className="gc-incoming-caller">
                {(() => {
                  const info = incomingGroupCall.callerInfo;
                  const id = (info?.userId || info?._id || info?.id)?.toString?.();
                  return (id && localStorage.getItem(`nickname_user_${id}`)) || info?.name;
                })()}{" "}
                đang gọi
              </p>
            </div>
            <div className="gc-incoming-actions">
              <div className="gc-incoming-btn-wrap">
                {/* BUG FIX: declineGroupCall phải được gọi trực tiếp */}
                <button className="gc-btn-decline" onClick={declineGroupCall}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path
                      d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"
                      transform="rotate(135,12,12)"
                    />
                  </svg>
                </button>
                <span className="gc-incoming-label gc-incoming-label--red">Từ chối</span>
              </div>
              <div className="gc-incoming-btn-wrap">
                {/* BUG FIX: acceptGroupCall phải được gọi trực tiếp */}
                <button className="gc-btn-accept" onClick={acceptGroupCall}>
                  {incomingGroupCall.callType === "video" ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </svg>
                  )}
                </button>
                <span className="gc-incoming-label gc-incoming-label--green">Tham gia</span>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!isActive) return null;

  // ── Minimized ─────────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <DraggableDialog className="gc-dialog--mini" minimized>
        <div className="gc-mini-bar">
          {isVideo && (
            <div className="gc-mini-cam-wrap">
              <video ref={miniCamRef} autoPlay muted playsInline className="gc-mini-cam-video" />
            </div>
          )}
          <div className="gc-mini-info">
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: isVideo ? "rgba(59,130,246,0.25)" : "rgba(74,222,128,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={isVideo ? "#93c5fd" : "#4ade80"}>
                {isVideo ? (
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                ) : (
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                )}
              </svg>
            </div>
            <div>
              <div className="gc-mini-name">{groupCallName}</div>
              <div className="gc-mini-status">{isConnected ? fmt(groupCallDuration) : "Đang kết nối..."}</div>
            </div>
          </div>
          <div className="gc-mini-actions">
            <button className="gc-mini-btn" onClick={toggleGroupMute} title={groupIsMuted ? "Bật mic" : "Tắt mic"}>
              {groupIsMuted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#f87171">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.75)">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                </svg>
              )}
            </button>
            <button className="gc-mini-btn gc-mini-btn--end" onClick={handleLeave}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" transform="rotate(135,12,12)" />
              </svg>
            </button>
            <button className="gc-mini-btn gc-mini-btn--expand" onClick={() => setMinimized(false)} title="Mở rộng">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
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
      <div className="gc-backdrop" />
      <DraggableDialog className={`${dialogSize} ${isVideo ? "gc-dialog--video" : "gc-dialog--voice"}`}>
        <div className="gc-header">
          <div className="gc-header-left">
            <span className="gc-type-badge">
              {isVideo ? (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg> Video</>
              ) : (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg> Thoại</>
              )}
            </span>
            <span className="gc-group-name">{groupCallName}</span>
            <span className="gc-member-count">{count} người</span>
          </div>
          <div className="gc-header-right">
            {isConnected ? (
              <span className="gc-duration">{fmt(groupCallDuration)}</span>
            ) : (
              <span className="gc-status-text">Đang kết nối...</span>
            )}
            <button className="gc-header-btn" onClick={() => setMinimized(true)} title="Thu nhỏ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            </button>
          </div>
        </div>

        {/* BUG FIX: Banner đổi loại gọi — hiện với tất cả người nhận yêu cầu */}
        {groupPendingTypeChange && (
          <GroupTypeChangeBanner
            pendingTypeChange={groupPendingTypeChange}
            onAccept={acceptGroupTypeChange}
            onReject={rejectGroupTypeChange}
          />
        )}

        <div className={`gc-grid ${gridClass}`} onClick={closeAllPickers}>
          {tiles.map((p) => (
            <ParticipantTile
              key={p.userId}
              participant={p}
              isSelf={p.isSelf}
              localVideoRef={p.isSelf ? onGroupLocalVideoMount : null}
              isPinned={pinnedUserId === p.userId}
              onPin={handlePin}
              displayName={getDisplayName(p)}
              callType={groupCallType}
            />
          ))}
          {count === 0 && <div className="gc-waiting">Đang chờ người tham gia...</div>}
        </div>

        {/* ── Controls ── */}
        <div className="gc-controls">
          {/* Mic */}
          <DeviceCtrlGroup
            label={groupIsMuted ? "Bật mic" : "Tắt mic"}
            arrowTitle="Chọn micro"
            showPicker={showMicPicker}
            onTogglePicker={(e) => {
              e.stopPropagation();
              setShowMicPicker((p) => !p);
              setShowSpeakerPicker(false);
              setShowCamPicker(false);
            }}
            mainBtn={
              <button className={`gc-ctrl-btn ${groupIsMuted ? "active" : ""}`} onClick={toggleGroupMute}>
                {groupIsMuted ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  </svg>
                )}
              </button>
            }
            picker={
              <DevicePicker
                kind="audioinput" devices={micDevices} currentId={currentMicId}
                onSelect={changeMic} onClose={() => setShowMicPicker(false)}
              />
            }
          />

          {/* Camera */}
          {isVideo && (
            <DeviceCtrlGroup
              label={groupIsCameraOff ? "Bật cam" : "Tắt cam"}
              arrowTitle="Chọn camera"
              showPicker={showCamPicker}
              onTogglePicker={(e) => {
                e.stopPropagation();
                setShowCamPicker((p) => !p);
                setShowMicPicker(false);
                setShowSpeakerPicker(false);
              }}
              mainBtn={
                <button className={`gc-ctrl-btn ${groupIsCameraOff ? "active" : ""}`} onClick={toggleGroupCamera}>
                  {groupIsCameraOff ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                      <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                    </svg>
                  )}
                </button>
              }
              picker={
                <DevicePicker
                  kind="videoinput" devices={cameraDevices} currentId={currentCameraId}
                  onSelect={changeCamera} onClose={() => setShowCamPicker(false)}
                />
              }
            />
          )}

          {/* Speaker */}
          <DeviceCtrlGroup
            label="Loa"
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
              <button className="gc-ctrl-btn" onClick={() => {}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              </button>
            }
            picker={
              <DevicePicker
                kind="audiooutput" devices={speakerDevices} currentId={currentSpeakerId}
                onSelect={changeSpeaker} onClose={() => setShowSpeakerPicker(false)} alignRight
              />
            }
          />

          {isConnected && <div className="gc-ctrl-divider" />}

          {/* BUG FIX: Chuyển voice → video, disabled khi đang pending */}
          {isConnected && !isVideo && (
            <div className="gc-ctrl-group">
              <button
                className={`gc-ctrl-btn gc-ctrl-btn--switch ${isSwitchingType ? "active" : ""} gc-ctrl-btn--switch-to-video`}
                onClick={handleSwitchCallType}
                disabled={isSwitchingType || !!groupPendingTypeChange}
                title={isSwitchingType ? "Đang chờ xác nhận..." : "Chuyển sang gọi video"}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
              </button>
              <span className="gc-ctrl-label">
                {isSwitchingType ? "Đang chờ..." : "Gọi video"}
              </span>
            </div>
          )}

          {/* Screen share */}
          {isVideo && isConnected && (
            <div className="gc-ctrl-group">
              <button className={`gc-ctrl-btn ${isSharing ? "active" : ""}`} onClick={toggleShare}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6zm8 8l-4-4h3V7h2v3h3l-4 4z" />
                </svg>
              </button>
              <span className="gc-ctrl-label">{isSharing ? "Dừng chia sẻ" : "Màn hình"}</span>
            </div>
          )}

          <div className="gc-ctrl-divider" />

          {/* End call */}
          <div className="gc-ctrl-group">
            <button className="gc-ctrl-btn gc-ctrl-btn--end" onClick={handleLeave}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path
                  d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"
                  transform="rotate(135,12,12)"
                />
              </svg>
            </button>
            <span className="gc-ctrl-label gc-ctrl-label--red">Rời cuộc gọi</span>
          </div>
        </div>
      </DraggableDialog>
    </>
  );
};

export default GroupCallModal;