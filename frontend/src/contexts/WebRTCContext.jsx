import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";
import { playSound, stopSound, playRingtoneBeep } from "../utils/sound.util";

export const WebRTCContext = createContext(null);

// ─── ICE Servers (STUN + TURN từ Metered) ────────────────────────────────────
const METERED_API_KEY = "2b187419aa92d5a0b6d8a576a68db2594dc5";
const METERED_API_URL = `https://chat-app2005.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`;

// Cache iceServers để không fetch lại mỗi lần tạo peer
let cachedIceServers = null;

const getIceServers = async () => {
  if (cachedIceServers) return cachedIceServers;
  try {
    const res = await fetch(METERED_API_URL);
    const turnServers = await res.json();
    cachedIceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      ...turnServers,
    ];
  } catch (e) {
    console.warn("TURN fetch failed, dùng STUN dự phòng:", e);
    cachedIceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
  }
  return cachedIceServers;
};
// ─────────────────────────────────────────────────────────────────────────────

export const WebRTCProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  // ─── 1-1 Call State ───────────────────────────────────────────────────────
  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState(null);
  const [callDirection, setCallDirection] = useState(null);
  const [remoteUser, setRemoteUser] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("good");

  const [pendingTypeChange, setPendingTypeChange] = useState(null);

  // ─── Group Call State ─────────────────────────────────────────────────────
  const [groupCallState, setGroupCallState] = useState("idle");
  const [groupCallType, setGroupCallType] = useState(null);
  const [groupCallConvId, setGroupCallConvId] = useState(null);
  const [groupCallName, setGroupCallName] = useState("");
  const [groupParticipants, setGroupParticipants] = useState(new Map());
  const [groupCallDuration, setGroupCallDuration] = useState(0);
  const [groupIsMuted, setGroupIsMuted] = useState(false);
  const [groupIsCameraOff, setGroupIsCameraOff] = useState(false);
  const [incomingGroupCall, setIncomingGroupCall] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [groupPendingTypeChange, setGroupPendingTypeChange] = useState(null);

  // ─── 1-1 Refs ─────────────────────────────────────────────────────────────
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const durationTimerRef = useRef(null);
  const ringtoneRef = useRef(null);
  const audioCtxRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const isRemoteDescSetRef = useRef(false);
  const isMutedRef = useRef(false);
  const isCameraOffRef = useRef(false);
  const callInfoRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const callTypeRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingTypeChangeOfferRef = useRef(null);

  // ─── Group Call Refs ──────────────────────────────────────────────────────
  const groupPeersRef = useRef(new Map());
  const groupLocalStreamRef = useRef(null);
  const groupLocalVideoRef = useRef(null);
  const groupDurationTimerRef = useRef(null);
  const groupStartTimeRef = useRef(null);
  const groupConvIdRef = useRef(null);
  const groupCallTypeRef = useRef(null);
  const groupIsMutedRef = useRef(false);
  const groupIsCameraOffRef = useRef(false);
  const groupPendingICERef = useRef(new Map());
  const groupRemoteDescRef = useRef(new Map());
  const groupIsLeavingRef = useRef(false);
  const groupCallerIdRef = useRef(null);
  const groupCallerNameRef = useRef(null);
  const groupCallerAvatarRef = useRef(null);
  const groupTypeChangeRequesterRef = useRef(null);

  // ─── Refs để track state trong closures tránh stale capture ──────────────
  const groupCallStateRef = useRef("idle");
  const callStateRef = useRef("idle");

  useEffect(() => {
    groupCallStateRef.current = groupCallState;
  }, [groupCallState]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // ════════════════════════════════════════════════════════════
  // RINGTONE / TIMER helpers
  // ════════════════════════════════════════════════════════════

  const playRingtone = useCallback((loop = true) => {
    try {
      const notifyCall = localStorage.getItem("notify_call") !== "0";
      if (!notifyCall) return;
      if (ringtoneRef.current) return;
      playRingtoneBeep();
      if (loop) ringtoneRef.current = setInterval(playRingtoneBeep, 2400);
    } catch (e) {}
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      clearInterval(ringtoneRef.current);
      ringtoneRef.current = null;
    }
    audioCtxRef.current = null;
    stopSound("calling");
  }, []);

  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) return;
    if (!callStartTimeRef.current) {
      callStartTimeRef.current = Date.now();
      setCallDuration(0);
    }
    durationTimerRef.current = setInterval(() => {
      setCallDuration(
        Math.floor((Date.now() - callStartTimeRef.current) / 1000),
      );
    }, 500);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }, []);

  const closePeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.oniceconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    pendingCandidatesRef.current = [];
    isRemoteDescSetRef.current = false;
  }, []);

  const attachRemoteStream = useCallback((stream) => {
    remoteStreamRef.current = stream;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, []);

  const onRemoteVideoMount = useCallback((el) => {
    remoteVideoRef.current = el;
    if (el && remoteStreamRef.current) {
      el.srcObject = remoteStreamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const onLocalVideoMount = useCallback((el) => {
    localVideoRef.current = el;
    if (el && localStreamRef.current) el.srcObject = localStreamRef.current;
  }, []);

  const emitCallLog = useCallback(
    (status) => {
      if (!socket || !callInfoRef.current) return;
      const {
        remoteUser: ru,
        conversationId: convId,
        callType: ct,
        direction,
      } = callInfoRef.current;
      if (!convId || !ru) return;
      const duration = callStartTimeRef.current
        ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
        : 0;
      const callerId = direction === "outgoing" ? user?._id : ru._id;
      const callerName = direction === "outgoing" ? user?.name : ru.name;
      const callerAvatar = direction === "outgoing" ? user?.avatar : ru.avatar;
      socket.emit("call:log", {
        conversationId: convId,
        callType: ct,
        direction,
        status,
        duration,
        remoteUserId: ru._id,
        callerId,
        callerName,
        callerAvatar,
      });
    },
    [socket, user],
  );

  const resetCall = useCallback(
    (status = null) => {
      if (status) emitCallLog(status);
      stopLocalStream();
      closePeer();
      stopRingtone();
      stopDurationTimer();
      callStartTimeRef.current = null;
      callInfoRef.current = null;
      callTypeRef.current = null;
      pendingOfferRef.current = null;
      pendingTypeChangeOfferRef.current = null;
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.muted = false;
      }
      remoteStreamRef.current = null;
      isMutedRef.current = false;
      isCameraOffRef.current = false;
      setCallState("idle");
      setCallType(null);
      setCallDirection(null);
      setRemoteUser(null);
      setConversationId(null);
      setIsMuted(false);
      setIsCameraOff(false);
      setIsSpeakerOff(false);
      setCallDuration(0);
      setIsRemoteVideoOff(false);
      setIsRemoteMuted(false);
      setPendingTypeChange(null);
    },
    [stopLocalStream, closePeer, stopRingtone, stopDurationTimer, emitCallLog],
  );

  // ─── createPeer (async, dùng getIceServers) ───────────────────────────────
  const createPeer = useCallback(
    async (targetUserId) => {
      try {
        const iceServers = await getIceServers();
        const peer = new RTCPeerConnection({ iceServers });

        peer.onicecandidate = (e) => {
          if (e.candidate && socket && targetUserId) {
            socket.emit("call:ice-candidate", {
              to: targetUserId,
              candidate: e.candidate,
            });
          }
        };

        peer.ontrack = (e) => {
          let stream = e.streams?.[0];
          if (!stream) {
            stream = remoteStreamRef.current || new MediaStream();
            stream.addTrack(e.track);
          }
          attachRemoteStream(stream);
        };

        peer.onconnectionstatechange = () => {
          const state = peer.connectionState;
          if (state === "connected") {
            setCallState("connected");
            stopRingtone();
            stopSound("calling");
            startDurationTimer();
            if (callTimeoutRef.current) {
              clearTimeout(callTimeoutRef.current);
              callTimeoutRef.current = null;
            }
            if (remoteStreamRef.current) {
              attachRemoteStream(remoteStreamRef.current);
            }
          } else if (state === "failed" || state === "disconnected") {
            setConnectionQuality("poor");
          } else if (state === "closed") {
            resetCall("completed");
          }
        };

        peer.oniceconnectionstatechange = () => {
          const state = peer.iceConnectionState;
          if (state === "checking") {
            setConnectionQuality("fair");
          } else if (state === "connected" || state === "completed") {
            setConnectionQuality("good");
            if (remoteStreamRef.current) {
              attachRemoteStream(remoteStreamRef.current);
            }
          } else if (state === "failed") {
            setConnectionQuality("poor");
          }
        };

        return peer;
      } catch (error) {
        console.error("Failed to create RTCPeerConnection:", error);
        return null;
      }
    },
    [socket, stopRingtone, startDurationTimer, resetCall, attachRemoteStream],
  );

  const getUserMedia = useCallback(async (type) => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
      },
      video:
        type === "video"
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            }
          : false,
    });
    return stream;
  }, []);

  const flushPendingCandidates = useCallback(async () => {
    if (!peerRef.current) return;
    for (const c of pendingCandidatesRef.current) {
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {}
    }
    pendingCandidatesRef.current = [];
  }, []);

  const startCall = useCallback(
    async (targetUser, convId, type = "voice") => {
      if (callState !== "idle" || !socket) return;
      try {
        setCallState("calling");
        setCallType(type);
        callTypeRef.current = type;
        setCallDirection("outgoing");
        setRemoteUser(targetUser);
        setConversationId(convId);
        callInfoRef.current = {
          remoteUser: targetUser,
          conversationId: convId,
          callType: type,
          direction: "outgoing",
        };
        const stream = await getUserMedia(type);
        localStreamRef.current = stream;
        isMutedRef.current = false;
        isCameraOffRef.current = false;
        if (localVideoRef.current && type === "video")
          localVideoRef.current.srcObject = stream;

        const peer = await createPeer(targetUser._id);
        peerRef.current = peer;
        stream.getTracks().forEach((t) => peer.addTrack(t, stream));
        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: type === "video",
        });
        await peer.setLocalDescription(offer);
        socket.emit("call:initiate", {
          to: targetUser._id,
          conversationId: convId,
          callType: type,
          offer,
          callerInfo: {
            _id: user?._id,
            name: user?.name,
            avatar: user?.avatar,
          },
        });
        const notifyCall = localStorage.getItem("notify_call") !== "0";
        if (notifyCall) {
          playSound("calling");
        }
        callTimeoutRef.current = setTimeout(() => {
          socket.emit("call:cancel", {
            to: targetUser._id,
            conversationId: convId,
          });
          resetCall("missed");
        }, 40000);
      } catch (err) {
        resetCall();
        alert(
          err.name === "NotAllowedError"
            ? "Vui lòng cấp quyền truy cập " +
                (type === "video" ? "camera và " : "") +
                "microphone."
            : "Không thể bắt đầu cuộc gọi: " + err.message,
        );
      }
    },
    [callState, socket, getUserMedia, createPeer, user, resetCall],
  );

  const acceptCall = useCallback(
    async (offer, callerInfo, convId, type) => {
      if (!socket) return;
      try {
        stopRingtone();
        playSound("accept");

        closePeer();

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }

        await new Promise((resolve) => setTimeout(resolve, 300));

        setCallState("connecting");
        setCallType(type);
        callTypeRef.current = type;
        setCallDirection("incoming");
        setRemoteUser(callerInfo);
        setConversationId(convId);
        callInfoRef.current = {
          remoteUser: callerInfo,
          conversationId: convId,
          callType: type,
          direction: "incoming",
        };

        const stream = await getUserMedia(type);
        localStreamRef.current = stream;
        isMutedRef.current = false;
        isCameraOffRef.current = false;
        if (localVideoRef.current && type === "video")
          localVideoRef.current.srcObject = stream;

        const peer = await createPeer(callerInfo._id);
        peerRef.current = peer;
        isRemoteDescSetRef.current = false;

        stream.getTracks().forEach((t) => peer.addTrack(t, stream));

        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        isRemoteDescSetRef.current = true;
        await flushPendingCandidates();

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("call:answer", { to: callerInfo._id, answer });

        setCallState("connected");
        startDurationTimer();
      } catch (err) {
        console.error("acceptCall error:", err);
        resetCall();
        if (err.name === "NotAllowedError") {
          alert("Vui lòng cấp quyền truy cập " + (type === "video" ? "camera và " : "") + "microphone để nhận cuộc gọi.");
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          alert("Thiết bị camera/microphone đang được sử dụng bởi ứng dụng khác. Vui lòng đóng các ứng dụng khác và thử lại.");
        } else {
          alert("Không thể nhận cuộc gọi: " + err.message);
        }
      }
    },
    [
      socket,
      stopRingtone,
      closePeer,
      getUserMedia,
      createPeer,
      flushPendingCandidates,
      startDurationTimer,
      resetCall,
    ],
  );

  const rejectCall = useCallback(
    (callerId) => {
      if (!socket) return;
      socket.emit("call:reject", {
        to: callerId,
        conversationId: callInfoRef.current?.conversationId,
      });
      stopRingtone();
      resetCall("rejected");
    },
    [socket, stopRingtone, resetCall],
  );

  const endCall = useCallback(() => {
    if (!socket || !callInfoRef.current?.remoteUser) return;
    socket.emit("call:end", {
      to: callInfoRef.current.remoteUser._id,
      conversationId: callInfoRef.current.conversationId,
    });
    playSound("hangup");
    resetCall("completed");
  }, [socket, resetCall]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getAudioTracks();
    if (!tracks.length) return;
    isMutedRef.current = !isMutedRef.current;
    tracks.forEach((t) => {
      t.enabled = !isMutedRef.current;
    });
    setIsMuted(isMutedRef.current);
    if (socket && callInfoRef.current?.remoteUser)
      socket.emit("call:media-state", {
        to: callInfoRef.current.remoteUser._id,
        isMuted: isMutedRef.current,
      });
  }, [socket]);

  const toggleCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getVideoTracks();

    if (isCameraOffRef.current && tracks.length === 0) {
      try {
        const ns = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: false,
        });
        const [vt] = ns.getVideoTracks();
        if (peerRef.current) {
          const sender = peerRef.current
            .getSenders()
            .find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(vt);
          } else {
            peerRef.current.addTrack(vt, localStreamRef.current);
            const offer = await peerRef.current.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await peerRef.current.setLocalDescription(offer);
            socket.emit("call:renegotiate", {
              to: callInfoRef.current?.remoteUser?._id,
              offer,
            });
          }
        }
        localStreamRef.current.addTrack(vt);
        isCameraOffRef.current = false;
        setIsCameraOff(false);
        if (socket && callInfoRef.current?.remoteUser)
          socket.emit("call:media-state", {
            to: callInfoRef.current.remoteUser._id,
            isCameraOff: false,
          });
      } catch (e) {
        console.error("toggleCamera (bật mới):", e);
      }
      return;
    }

    if (!tracks.length) return;
    isCameraOffRef.current = !isCameraOffRef.current;
    tracks.forEach((t) => {
      t.enabled = !isCameraOffRef.current;
    });
    setIsCameraOff(isCameraOffRef.current);
    if (socket && callInfoRef.current?.remoteUser)
      socket.emit("call:media-state", {
        to: callInfoRef.current.remoteUser._id,
        isCameraOff: isCameraOffRef.current,
      });
  }, [socket, peerRef]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOff((prev) => {
      const next = !prev;
      if (remoteAudioRef.current) remoteAudioRef.current.muted = next;
      if (remoteVideoRef.current) remoteVideoRef.current.muted = next;
      return next;
    });
  }, []);

  // ══════════════════════════════════════════════════════════════
  // 1-1 CALL TYPE CHANGE (voice → video)
  // ══════════════════════════════════════════════════════════════

  const requestCallTypeChange = useCallback(
    async (newCallType) => {
      if (
        !socket ||
        !callInfoRef.current?.remoteUser ||
        callState !== "connected"
      )
        return;
      if (newCallType === callTypeRef.current) return;

      if (newCallType === "video") {
        setIsTransitioning(true);
        try {
          const ns = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            },
            audio: false,
          });
          const [vt] = ns.getVideoTracks();
          if (peerRef.current)
            peerRef.current.addTrack(vt, localStreamRef.current);
          localStreamRef.current?.addTrack(vt);
          isCameraOffRef.current = false;
          setIsCameraOff(false);

          if (peerRef.current) {
            const offer = await peerRef.current.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await peerRef.current.setLocalDescription(offer);
            socket.emit("call:type-change-request", {
              to: callInfoRef.current.remoteUser._id,
              newCallType,
              offer,
            });
          }

          callTypeRef.current = "video";
          setCallType("video");
          if (callInfoRef.current) callInfoRef.current.callType = "video";
          setIsTransitioning(false);
        } catch (err) {
          setIsTransitioning(false);
          alert(
            err.name === "NotAllowedError"
              ? "Vui lòng cấp quyền truy cập camera."
              : "Không thể bật camera: " + err.message,
          );
        }
      }
    },
    [socket, callState, peerRef, localStreamRef],
  );

  const acceptCallTypeChange = useCallback(async () => {
    if (!pendingTypeChange || !socket || !peerRef.current) return;
    const { newCallType, from } = pendingTypeChange;
    setPendingTypeChange(null);
    if (newCallType !== "video") return;

    try {
      const ns = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });
      const [vt] = ns.getVideoTracks();
      peerRef.current.addTrack(vt, localStreamRef.current);
      localStreamRef.current.addTrack(vt);
      if (localVideoRef.current)
        localVideoRef.current.srcObject = localStreamRef.current;

      const pendingOffer = pendingTypeChangeOfferRef.current;
      if (pendingOffer) {
        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(pendingOffer),
        );
        pendingTypeChangeOfferRef.current = null;
      }

      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socket.emit("call:type-change-accept", {
        to: from,
        newCallType,
        offer: answer,
      });

      callTypeRef.current = newCallType;
      setCallType(newCallType);
      isCameraOffRef.current = false;
      setIsCameraOff(false);
      if (callInfoRef.current) callInfoRef.current.callType = newCallType;
    } catch (e) {
      console.error("acceptCallTypeChange:", e);
    }
  }, [pendingTypeChange, socket]);

  const rejectCallTypeChange = useCallback(async () => {
    if (!pendingTypeChange || !socket) return;
    const { from } = pendingTypeChange;
    setPendingTypeChange(null);

    const pendingOffer = pendingTypeChangeOfferRef.current;
    if (pendingOffer && peerRef.current) {
      try {
        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(pendingOffer),
        );
        pendingTypeChangeOfferRef.current = null;
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit("call:type-change-accept", {
          to: from,
          newCallType: "video",
          offer: answer,
          cameraOff: true,
        });
      } catch (e) {}
    } else {
      socket.emit("call:type-change-reject", { to: from });
    }

    callTypeRef.current = "video";
    setCallType("video");
    isCameraOffRef.current = true;
    setIsCameraOff(true);
    if (callInfoRef.current) callInfoRef.current.callType = "video";
  }, [pendingTypeChange, socket]);

  // ════════════════════════════════════════════════════════════
  // GROUP CALL LOGIC
  // ════════════════════════════════════════════════════════════

  // ─── createGroupPeer (async, dùng getIceServers) ──────────────────────────
  const createGroupPeer = useCallback(
    async (targetUserId) => {
      const iceServers = await getIceServers();
      const peer = new RTCPeerConnection({ iceServers });

      peer.onicecandidate = (e) => {
        if (e.candidate && socket)
          socket.emit("group-call:ice-candidate", {
            to: targetUserId,
            conversationId: groupConvIdRef.current,
            candidate: e.candidate,
          });
      };

      peer.ontrack = (e) => {
        const stream =
          e.streams?.[0] ||
          (() => {
            const s = new MediaStream();
            s.addTrack(e.track);
            return s;
          })();

        if (e.track.kind === "audio") {
          let audioEl = document.getElementById(`group-audio-${targetUserId}`);
          if (!audioEl) {
            audioEl = document.createElement("audio");
            audioEl.id = `group-audio-${targetUserId}`;
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            audioEl.style.display = "none";
            document.body.appendChild(audioEl);
          }
          audioEl.srcObject = stream;
          audioEl.muted = false;
          audioEl.volume = 1.0;
          audioEl.play().catch(() => {});
        }

        setGroupParticipants((prev) => {
          const next = new Map(prev);
          const p = next.get(targetUserId);
          if (p) next.set(targetUserId, { ...p, stream });
          return next;
        });
      };

      peer.onconnectionstatechange = () => {
        const s = peer.connectionState;
        if (s === "connected") {
          stopSound("calling");
          setGroupCallState("connected");
          if (!groupStartTimeRef.current) {
            groupStartTimeRef.current = Date.now();
            groupDurationTimerRef.current = setInterval(
              () => setGroupCallDuration((p) => p + 1),
              1000,
            );
          }
        } else if (s === "failed" || s === "closed") {
          setGroupParticipants((prev) => {
            const next = new Map(prev);
            next.delete(targetUserId);
            return next;
          });
          groupPeersRef.current.delete(targetUserId);
          const audioEl = document.getElementById(`group-audio-${targetUserId}`);
          if (audioEl) audioEl.remove();
        }
      };

      return peer;
    },
    [socket],
  );

  const getGroupMedia = useCallback(async (type) => {
    if (groupLocalStreamRef.current) {
      const tracks = groupLocalStreamRef.current.getTracks();
      const allLive = tracks.length > 0 && tracks.every((t) => t.readyState === "live");
      if (allLive) return groupLocalStreamRef.current;
      tracks.forEach((t) => t.stop());
      groupLocalStreamRef.current = null;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
      },
      video:
        type === "video"
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            }
          : false,
    });
    groupLocalStreamRef.current = stream;
    return stream;
  }, []);

  const addTracksToGroupPeer = useCallback((peer) => {
    if (!groupLocalStreamRef.current) return;
    groupLocalStreamRef.current.getTracks().forEach((t) => {
      const existingSenders = peer.getSenders();
      const alreadyAdded = existingSenders.some((s) => s.track === t);
      if (!alreadyAdded) {
        peer.addTrack(t, groupLocalStreamRef.current);
      }
    });
  }, []);

  const flushGroupICE = useCallback(async (targetUserId) => {
    const peer = groupPeersRef.current.get(targetUserId);
    if (!peer) return;
    const pending = groupPendingICERef.current.get(targetUserId) || [];
    for (const c of pending) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {}
    }
    groupPendingICERef.current.set(targetUserId, []);
  }, []);

  const startGroupCall = useCallback(
    async (convId, type, convName, isJoining = false) => {
      if (groupCallState !== "idle" || callState !== "idle" || !socket) return;
      try {
        if (isJoining && groupLocalStreamRef.current) {
          groupLocalStreamRef.current.getTracks().forEach((t) => t.stop());
          groupLocalStreamRef.current = null;
        }

        const stream = await getGroupMedia(type);
        groupConvIdRef.current = convId;
        groupCallTypeRef.current = type;
        groupIsMutedRef.current = false;
        groupIsCameraOffRef.current = false;
        if (!groupCallerIdRef.current) {
          groupCallerIdRef.current = user?._id;
          groupCallerNameRef.current = user?.name;
          groupCallerAvatarRef.current = user?.avatar;
        }

        setGroupCallState("calling");
        setGroupCallType(type);
        setGroupCallConvId(convId);
        setGroupCallName(convName || "Nhóm");
        setGroupCallDuration(0);
        setGroupIsMuted(false);
        setGroupIsCameraOff(false);

        setGroupParticipants(
          new Map([
            [
              user?._id,
              {
                userId: user?._id,
                name: user?.name,
                avatar: user?.avatar,
                stream,
                isMuted: false,
                isCameraOff: false,
                isSelf: true,
              },
            ],
          ]),
        );

        socket.emit("group-call:join", {
          conversationId: convId,
          callType: type,
          callerInfo: {
            _id: user?._id,
            name: user?.name,
            avatar: user?.avatar,
          },
        });

        if (!isJoining) {
          const notifyCall = localStorage.getItem("notify_call") !== "0";
          if (notifyCall) {
            playSound("calling");
          }
        }
      } catch (err) {
        setGroupCallState("idle");
        alert(
          err.name === "NotAllowedError"
            ? "Vui lòng cấp quyền truy cập " +
                (type === "video" ? "camera và " : "") +
                "microphone."
            : "Không thể bắt đầu cuộc gọi: " + err.message,
        );
      }
    },
    [groupCallState, callState, socket, user, getGroupMedia],
  );

  const cleanupGroupCall = useCallback(() => {
    stopSound("calling");

    groupPeersRef.current.forEach((peer) => {
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.close();
    });
    groupPeersRef.current.clear();
    groupPendingICERef.current.clear();
    groupRemoteDescRef.current.clear();

    if (groupLocalStreamRef.current) {
      groupLocalStreamRef.current.getTracks().forEach((t) => t.stop());
      groupLocalStreamRef.current = null;
    }

    document.querySelectorAll("[id^='group-audio-']").forEach((el) => el.remove());

    if (groupDurationTimerRef.current) {
      clearInterval(groupDurationTimerRef.current);
      groupDurationTimerRef.current = null;
    }
    groupStartTimeRef.current = null;
    groupConvIdRef.current = null;
    groupCallTypeRef.current = null;
    groupIsMutedRef.current = false;
    groupIsCameraOffRef.current = false;
    groupIsLeavingRef.current = false;
    groupCallerIdRef.current = null;
    groupCallerNameRef.current = null;
    groupCallerAvatarRef.current = null;
    groupTypeChangeRequesterRef.current = null;

    setGroupCallState("idle");
    setGroupCallType(null);
    setGroupCallConvId(null);
    setGroupCallName("");
    setGroupParticipants(new Map());
    setGroupCallDuration(0);
    setGroupIsMuted(false);
    setGroupIsCameraOff(false);
    setGroupPendingTypeChange(null);
  }, []);

  const leaveGroupCall = useCallback(() => {
    if (!socket || !groupConvIdRef.current) return;
    if (groupIsLeavingRef.current) return;
    groupIsLeavingRef.current = true;

    socket.emit("group-call:leave", { conversationId: groupConvIdRef.current });
    playSound("hangup");
    cleanupGroupCall();
  }, [socket, cleanupGroupCall]);

  const declineGroupCall = useCallback(() => {
    if (!socket || !incomingGroupCall) return;
    socket.emit("group-call:decline", {
      conversationId: incomingGroupCall.conversationId,
    });
    stopRingtone();
    setIncomingGroupCall(null);
  }, [socket, incomingGroupCall, stopRingtone]);

  const acceptGroupCall = useCallback(async () => {
    if (!incomingGroupCall) return;
    const {
      conversationId: convId,
      callType: type,
      groupName,
    } = incomingGroupCall;
    stopRingtone();
    playSound("accept");
    setIncomingGroupCall(null);
    await startGroupCall(convId, type, groupName, true);
  }, [incomingGroupCall, startGroupCall, stopRingtone]);

  const toggleGroupMute = useCallback(() => {
    if (!groupLocalStreamRef.current) return;
    const tracks = groupLocalStreamRef.current.getAudioTracks();
    if (!tracks.length) return;
    groupIsMutedRef.current = !groupIsMutedRef.current;
    tracks.forEach((t) => {
      t.enabled = !groupIsMutedRef.current;
    });
    setGroupIsMuted(groupIsMutedRef.current);
    setGroupParticipants((prev) => {
      const next = new Map(prev);
      const me = next.get(user?._id);
      if (me) next.set(user?._id, { ...me, isMuted: groupIsMutedRef.current });
      return next;
    });
    if (socket && groupConvIdRef.current)
      socket.emit("call:media-state", {
        conversationId: groupConvIdRef.current,
        isMuted: groupIsMutedRef.current,
      });
  }, [socket, user?._id]);

  const toggleGroupCamera = useCallback(async () => {
    if (!groupLocalStreamRef.current) return;
    const tracks = groupLocalStreamRef.current.getVideoTracks();

    if (groupIsCameraOffRef.current && tracks.length === 0) {
      try {
        const ns = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: false,
        });
        const [vt] = ns.getVideoTracks();
        groupLocalStreamRef.current.addTrack(vt);

        for (const [peerId, peer] of groupPeersRef.current) {
          try {
            peer.addTrack(vt, groupLocalStreamRef.current);
            const offer = await peer.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await peer.setLocalDescription(offer);
            socket.emit("group-call:renegotiate-offer", {
              to: peerId,
              conversationId: groupConvIdRef.current,
              offer,
            });
          } catch (e) {}
        }

        groupIsCameraOffRef.current = false;
        setGroupIsCameraOff(false);
        setGroupParticipants((prev) => {
          const next = new Map(prev);
          const me = next.get(user?._id);
          if (me)
            next.set(user?._id, {
              ...me,
              isCameraOff: false,
              stream: groupLocalStreamRef.current,
            });
          return next;
        });

        if (socket && groupConvIdRef.current)
          socket.emit("call:media-state", {
            conversationId: groupConvIdRef.current,
            isCameraOff: false,
          });
      } catch (e) {
        console.error("toggleGroupCamera (bật mới):", e);
      }
      return;
    }

    if (!tracks.length) return;

    groupIsCameraOffRef.current = !groupIsCameraOffRef.current;
    tracks.forEach((t) => {
      t.enabled = !groupIsCameraOffRef.current;
    });
    setGroupIsCameraOff(groupIsCameraOffRef.current);

    setGroupParticipants((prev) => {
      const next = new Map(prev);
      const me = next.get(user?._id);
      if (me)
        next.set(user?._id, {
          ...me,
          isCameraOff: groupIsCameraOffRef.current,
        });
      return next;
    });
    if (socket && groupConvIdRef.current)
      socket.emit("call:media-state", {
        conversationId: groupConvIdRef.current,
        isCameraOff: groupIsCameraOffRef.current,
      });
  }, [socket, user?._id]);

  // ══════════════════════════════════════════════════════════════
  // GROUP CALL TYPE SWITCH
  // ══════════════════════════════════════════════════════════════

  const switchGroupCallType = useCallback(
    async (newCallType) => {
      if (
        !socket ||
        !groupConvIdRef.current ||
        groupCallTypeRef.current === newCallType
      )
        return;

      if (newCallType === "voice") {
        try {
          const vtracks = groupLocalStreamRef.current?.getVideoTracks() || [];
          vtracks.forEach((t) => {
            t.stop();
            groupLocalStreamRef.current?.removeTrack(t);
          });

          for (const [peerId, peer] of groupPeersRef.current) {
            try {
              peer
                .getSenders()
                .filter((s) => s.track?.kind === "video")
                .forEach((s) => {
                  try {
                    peer.removeTrack(s);
                  } catch (e) {}
                });
              const offer = await peer.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false,
              });
              await peer.setLocalDescription(offer);
              socket.emit("group-call:renegotiate-offer", {
                to: peerId,
                conversationId: groupConvIdRef.current,
                offer,
              });
            } catch (e) {
              console.error("switchGroupCallType (voice) to", peerId, e);
            }
          }

          groupIsCameraOffRef.current = false;
          setGroupIsCameraOff(false);
          groupCallTypeRef.current = "voice";
          setGroupCallType("voice");

          socket.emit("group-call:type-change", {
            conversationId: groupConvIdRef.current,
            newCallType: "voice",
          });
        } catch (e) {
          console.error("switchGroupCallType (voice→):", e);
        }
      } else {
        try {
          const ns = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            },
            audio: false,
          });
          const [vt] = ns.getVideoTracks();
          groupLocalStreamRef.current?.addTrack(vt);

          for (const [peerId, peer] of groupPeersRef.current) {
            try {
              peer.addTrack(vt, groupLocalStreamRef.current);
              const offer = await peer.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
              });
              await peer.setLocalDescription(offer);
              socket.emit("group-call:renegotiate-offer", {
                to: peerId,
                conversationId: groupConvIdRef.current,
                offer,
              });
            } catch (e) {
              console.error("switchGroupCallType (video) offer to", peerId, e);
            }
          }

          setGroupParticipants((prev) => {
            const next = new Map(prev);
            const me = next.get(user?._id);
            if (me)
              next.set(user?._id, {
                ...me,
                isCameraOff: false,
                stream: groupLocalStreamRef.current,
              });
            return next;
          });
          setGroupIsCameraOff(false);
          groupIsCameraOffRef.current = false;

          groupCallTypeRef.current = "video";
          setGroupCallType("video");

          socket.emit("group-call:type-change-request", {
            conversationId: groupConvIdRef.current,
            newCallType: "video",
          });
        } catch (e) {
          console.error("switchGroupCallType (→video):", e);
          alert(
            e.name === "NotAllowedError"
              ? "Vui lòng cấp quyền truy cập camera."
              : "Không thể chuyển đổi loại cuộc gọi.",
          );
        }
      }
    },
    [socket, user?._id],
  );

  const acceptGroupTypeChange = useCallback(async () => {
    if (!groupPendingTypeChange || !socket) return;
    const { newCallType, requesterId } = groupPendingTypeChange;
    setGroupPendingTypeChange(null);
    groupTypeChangeRequesterRef.current = null;

    if (newCallType === "video") {
      try {
        const ns = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: false,
        });
        const [vt] = ns.getVideoTracks();
        groupLocalStreamRef.current?.addTrack(vt);

        for (const [peerId, peer] of groupPeersRef.current) {
          try {
            peer.addTrack(vt, groupLocalStreamRef.current);
            const offer = await peer.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await peer.setLocalDescription(offer);
            socket.emit("group-call:renegotiate-offer", {
              to: peerId,
              conversationId: groupConvIdRef.current,
              offer,
            });
          } catch (e) {}
        }

        setGroupParticipants((prev) => {
          const next = new Map(prev);
          const me = next.get(user?._id);
          if (me)
            next.set(user?._id, {
              ...me,
              isCameraOff: false,
              stream: groupLocalStreamRef.current,
            });
          return next;
        });

        groupIsCameraOffRef.current = false;
        setGroupIsCameraOff(false);
      } catch (e) {
        console.error("acceptGroupTypeChange camera:", e);
        groupIsCameraOffRef.current = true;
        setGroupIsCameraOff(true);
      }

      groupCallTypeRef.current = "video";
      setGroupCallType("video");

      socket.emit("group-call:type-change-accept", {
        conversationId: groupConvIdRef.current,
        newCallType: "video",
        to: requesterId,
      });
    }
  }, [groupPendingTypeChange, socket, user?._id]);

  const rejectGroupTypeChange = useCallback(async () => {
    if (!groupPendingTypeChange || !socket) return;
    const { requesterId } = groupPendingTypeChange;
    setGroupPendingTypeChange(null);
    groupTypeChangeRequesterRef.current = null;

    groupCallTypeRef.current = "video";
    setGroupCallType("video");
    groupIsCameraOffRef.current = true;
    setGroupIsCameraOff(true);

    setGroupParticipants((prev) => {
      const next = new Map(prev);
      const me = next.get(user?._id);
      if (me) next.set(user?._id, { ...me, isCameraOff: true });
      return next;
    });

    for (const [peerId, peer] of groupPeersRef.current) {
      try {
        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await peer.setLocalDescription(offer);
        socket.emit("group-call:renegotiate-offer", {
          to: peerId,
          conversationId: groupConvIdRef.current,
          offer,
        });
      } catch (e) {
        console.error("rejectGroupTypeChange renegotiate:", e);
      }
    }

    socket.emit("group-call:type-change-reject", {
      conversationId: groupConvIdRef.current,
      to: requesterId,
    });
  }, [groupPendingTypeChange, socket, user?._id, groupPeersRef]);

  const onGroupLocalVideoMount = useCallback((el) => {
    groupLocalVideoRef.current = el;
    if (el && groupLocalStreamRef.current) {
      el.srcObject = groupLocalStreamRef.current;
    }
  }, []);

  // ════════════════════════════════════════════════════════════
  // useEffect RIÊNG cho incoming group call
  // Dùng refs (groupCallStateRef, callStateRef) để tránh stale closure
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!socket) return;

    const handleIncomingGroupCall = (data) => {
      if (groupCallStateRef.current !== "idle" || callStateRef.current !== "idle") {
        console.log("📵 Group call incoming ignored — already in a call");
        return;
      }
      if (data?.callerInfo?._id) {
        data = {
          ...data,
          callerInfo: {
            ...data.callerInfo,
            _id: data.callerInfo._id?.toString?.() || data.callerInfo._id,
          },
        };
      }
      console.log("🔔 group-call:incoming received:", data);
      setIncomingGroupCall(data);
      playRingtone(true);
    };

    const handleGroupCallCancelled = ({ conversationId: convId }) => {
      setIncomingGroupCall((prev) => {
        if (prev?.conversationId === convId) {
          stopRingtone();
          return null;
        }
        return prev;
      });
    };

    socket.on("group-call:incoming", handleIncomingGroupCall);
    socket.on("group-call:cancelled", handleGroupCallCancelled);

    return () => {
      socket.off("group-call:incoming", handleIncomingGroupCall);
      socket.off("group-call:cancelled", handleGroupCallCancelled);
    };
  }, [socket, playRingtone, stopRingtone]);

  // ─── Group Call Socket Listeners ──────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleParticipantJoined = async ({
      conversationId: convId,
      participant,
    }) => {
      if (convId !== groupConvIdRef.current) return;
      if (participant.userId === user?._id) return;

      setGroupParticipants((prev) => {
        const next = new Map(prev);
        if (!next.has(participant.userId))
          next.set(participant.userId, {
            ...participant,
            stream: null,
            isMuted: false,
            isCameraOff: false,
          });
        return next;
      });

      try {
        if (groupPeersRef.current.has(participant.userId)) {
          const oldPeer = groupPeersRef.current.get(participant.userId);
          oldPeer.close();
          groupPeersRef.current.delete(participant.userId);
        }

        const peer = await createGroupPeer(participant.userId);
        groupPeersRef.current.set(participant.userId, peer);
        groupRemoteDescRef.current.set(participant.userId, false);
        addTracksToGroupPeer(peer);

        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: groupCallTypeRef.current === "video",
        });
        await peer.setLocalDescription(offer);
        socket.emit("group-call:offer", {
          to: participant.userId,
          conversationId: convId,
          offer,
        });
      } catch (e) {
        console.error("Group offer error:", e);
      }
    };

    const handleExistingParticipants = async ({
      conversationId: convId,
      participants,
    }) => {
      if (convId !== groupConvIdRef.current) return;

      setGroupParticipants((prev) => {
        const next = new Map(prev);
        participants.forEach((p) => {
          if (!next.has(p.userId))
            next.set(p.userId, {
              ...p,
              stream: null,
              isMuted: false,
              isCameraOff: false,
            });
        });
        return next;
      });
    };

    const handleGroupOffer = async ({
      from,
      conversationId: convId,
      offer,
      callerInfo,
    }) => {
      if (convId !== groupConvIdRef.current) return;

      try {
        let peer = groupPeersRef.current.get(from);
        if (!peer) {
          peer = await createGroupPeer(from);
          groupPeersRef.current.set(from, peer);
          groupRemoteDescRef.current.set(from, false);
          addTracksToGroupPeer(peer);
        }

        if (callerInfo) {
          setGroupParticipants((prev) => {
            const next = new Map(prev);
            if (!next.has(from))
              next.set(from, {
                userId: from,
                name: callerInfo.name,
                avatar: callerInfo.avatar,
                stream: null,
                isMuted: false,
                isCameraOff: false,
              });
            return next;
          });
        }

        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        groupRemoteDescRef.current.set(from, true);
        await flushGroupICE(from);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("group-call:answer", {
          to: from,
          conversationId: convId,
          answer,
        });
      } catch (e) {
        console.error("Group answer error:", e);
      }
    };

    const handleGroupAnswer = async ({
      from,
      conversationId: convId,
      answer,
    }) => {
      if (convId !== groupConvIdRef.current) return;
      const peer = groupPeersRef.current.get(from);
      if (!peer) return;
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
        groupRemoteDescRef.current.set(from, true);
        await flushGroupICE(from);
      } catch (e) {
        console.error("Group answer set error:", e);
      }
    };

    const handleGroupICE = async ({
      from,
      conversationId: convId,
      candidate,
    }) => {
      if (convId !== groupConvIdRef.current) return;
      const peer = groupPeersRef.current.get(from);
      if (!peer) return;
      if (groupRemoteDescRef.current.get(from)) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {}
      } else {
        const pending = groupPendingICERef.current.get(from) || [];
        pending.push(candidate);
        groupPendingICERef.current.set(from, pending);
      }
    };

    const handleGroupRenegotiateOffer = async ({
      from,
      conversationId: convId,
      offer,
    }) => {
      if (convId !== groupConvIdRef.current) return;
      const peer = groupPeersRef.current.get(from);
      if (!peer) return;
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("group-call:renegotiate-answer", {
          to: from,
          conversationId: convId,
          answer,
        });
      } catch (e) {
        console.error("Group renegotiate offer error:", e);
      }
    };

    const handleGroupRenegotiateAnswer = async ({
      from,
      conversationId: convId,
      answer,
    }) => {
      if (convId !== groupConvIdRef.current) return;
      const peer = groupPeersRef.current.get(from);
      if (!peer) return;
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
        setTimeout(() => {
          const receivers = peer.getReceivers();
          const videoReceiver = receivers.find(
            (r) => r.track?.kind === "video",
          );
          if (!videoReceiver) return;
          setGroupParticipants((prev) => {
            const next = new Map(prev);
            const p = next.get(from);
            if (!p) return prev;
            let stream = p.stream;
            if (stream) {
              const existingVideo = stream.getVideoTracks();
              if (existingVideo.length === 0) {
                stream.addTrack(videoReceiver.track);
              }
              const newStream = new MediaStream(stream.getTracks());
              next.set(from, { ...p, stream: newStream, isCameraOff: false });
            }
            return next;
          });
        }, 500);
      } catch (e) {
        console.error("Group renegotiate answer error:", e);
      }
    };

    const handleParticipantLeft = ({ conversationId: convId, userId }) => {
      if (convId !== groupConvIdRef.current) return;
      const peer = groupPeersRef.current.get(userId);
      if (peer) {
        peer.close();
        groupPeersRef.current.delete(userId);
      }
      groupRemoteDescRef.current.delete(userId);
      groupPendingICERef.current.delete(userId);
      const audioEl = document.getElementById(`group-audio-${userId}`);
      if (audioEl) audioEl.remove();

      setGroupParticipants((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        const remaining = [...next.values()];
        const onlyMe = remaining.length === 1 && remaining[0].isSelf;
        const noOne = remaining.length === 0;
        if ((onlyMe || noOne) && !groupIsLeavingRef.current) {
          setTimeout(() => {
            if (groupConvIdRef.current) {
              socket.emit("group-call:leave", {
                conversationId: groupConvIdRef.current,
              });
              cleanupGroupCall();
            }
          }, 500);
        }
        return next;
      });
    };

    const handleGroupMediaState = ({ from, isMuted, isCameraOff }) => {
      setGroupParticipants((prev) => {
        const next = new Map(prev);
        const p = next.get(from);
        if (p) {
          next.set(from, {
            ...p,
            isMuted: isMuted !== undefined ? isMuted : p.isMuted,
            isCameraOff:
              isCameraOff !== undefined ? isCameraOff : p.isCameraOff,
          });
        }
        return next;
      });
    };

    const handleGroupAllDeclined = ({ conversationId: convId }) => {
      if (convId !== groupConvIdRef.current) return;
      if (!groupIsLeavingRef.current) {
        leaveGroupCall();
      }
    };

    const handleGroupTypeChangeRequest = ({
      conversationId: convId,
      newCallType,
      requester,
    }) => {
      if (convId !== groupConvIdRef.current) return;
      if (newCallType !== "video") return;
      groupTypeChangeRequesterRef.current = requester?.userId;
      setGroupPendingTypeChange({
        newCallType,
        requester,
        requesterId: requester?.userId,
      });
    };

    const handleGroupTypeChangeAccepted = ({
      conversationId: convId,
      from,
    }) => {
      if (convId !== groupConvIdRef.current) return;
      console.log(`✅ Participant ${from} accepted group type change`);
    };

    const handleGroupTypeChangeRejected = ({
      conversationId: convId,
      from,
    }) => {
      if (convId !== groupConvIdRef.current) return;
      console.log(`❌ Participant ${from} rejected group type change`);
    };

    const handleGroupTypeChanged = ({
      conversationId: convId,
      newCallType,
      changedBy,
    }) => {
      if (convId !== groupConvIdRef.current) return;

      if (newCallType === "voice" && changedBy !== user?._id) {
        const vtracks = groupLocalStreamRef.current?.getVideoTracks() || [];
        vtracks.forEach((t) => {
          t.stop();
          groupLocalStreamRef.current?.removeTrack(t);
        });

        groupPeersRef.current.forEach(async (peer, peerId) => {
          try {
            peer
              .getSenders()
              .filter((s) => s.track?.kind === "video")
              .forEach((s) => {
                try {
                  peer.removeTrack(s);
                } catch (e) {}
              });
            const offer = await peer.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: false,
            });
            await peer.setLocalDescription(offer);
            socket.emit("group-call:renegotiate-offer", {
              to: peerId,
              conversationId: convId,
              offer,
            });
          } catch (e) {}
        });

        groupIsCameraOffRef.current = false;
        setGroupIsCameraOff(false);
        setGroupPendingTypeChange(null);
      }

      groupCallTypeRef.current = newCallType;
      setGroupCallType(newCallType);
    };

    const handleGroupCallEnded = ({ conversationId: convId }) => {
      if (convId !== groupConvIdRef.current) return;
      if (!groupIsLeavingRef.current) {
        cleanupGroupCall();
      }
    };

    socket.on("group-call:participant-joined", handleParticipantJoined);
    socket.on("group-call:existing-participants", handleExistingParticipants);
    socket.on("group-call:offer", handleGroupOffer);
    socket.on("group-call:answer", handleGroupAnswer);
    socket.on("group-call:ice-candidate", handleGroupICE);
    socket.on("group-call:renegotiate-offer", handleGroupRenegotiateOffer);
    socket.on("group-call:renegotiate-answer", handleGroupRenegotiateAnswer);
    socket.on("group-call:participant-left", handleParticipantLeft);
    socket.on("group-call:all-declined", handleGroupAllDeclined);
    socket.on("group-call:type-change-request", handleGroupTypeChangeRequest);
    socket.on("group-call:type-change-accepted", handleGroupTypeChangeAccepted);
    socket.on("group-call:type-change-rejected", handleGroupTypeChangeRejected);
    socket.on("group-call:type-changed", handleGroupTypeChanged);
    socket.on("group-call:ended", handleGroupCallEnded);
    socket.on("call:media-state", handleGroupMediaState);

    return () => {
      socket.off("group-call:participant-joined", handleParticipantJoined);
      socket.off("group-call:existing-participants", handleExistingParticipants);
      socket.off("group-call:offer", handleGroupOffer);
      socket.off("group-call:answer", handleGroupAnswer);
      socket.off("group-call:ice-candidate", handleGroupICE);
      socket.off("group-call:renegotiate-offer", handleGroupRenegotiateOffer);
      socket.off("group-call:renegotiate-answer", handleGroupRenegotiateAnswer);
      socket.off("group-call:participant-left", handleParticipantLeft);
      socket.off("group-call:all-declined", handleGroupAllDeclined);
      socket.off("group-call:type-change-request", handleGroupTypeChangeRequest);
      socket.off("group-call:type-change-accepted", handleGroupTypeChangeAccepted);
      socket.off("group-call:type-change-rejected", handleGroupTypeChangeRejected);
      socket.off("group-call:type-changed", handleGroupTypeChanged);
      socket.off("group-call:ended", handleGroupCallEnded);
      socket.off("call:media-state", handleGroupMediaState);
    };
  }, [
    socket,
    user?._id,
    createGroupPeer,
    addTracksToGroupPeer,
    flushGroupICE,
    playRingtone,
    leaveGroupCall,
    stopRingtone,
    cleanupGroupCall,
  ]);

  // ─── 1-1 Call Socket Listeners ────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      if (callState !== "idle" || groupCallState !== "idle") {
        socket.emit("call:reject", { to: data.callerInfo._id, reason: "busy" });
        return;
      }
      setCallState("ringing");
      setCallType(data.callType);
      callTypeRef.current = data.callType;
      setCallDirection("incoming");
      setRemoteUser(data.callerInfo);
      setConversationId(data.conversationId);
      pendingOfferRef.current = data.offer;
      callInfoRef.current = {
        remoteUser: data.callerInfo,
        conversationId: data.conversationId,
        callType: data.callType,
        direction: "incoming",
      };
      playRingtone(true);
      callTimeoutRef.current = setTimeout(() => {
        socket.emit("call:reject", {
          to: data.callerInfo._id,
          reason: "no-answer",
          conversationId: data.conversationId,
        });
        resetCall("missed");
      }, 40000);
    };

    const handleCallAnswered = async (data) => {
      if (!peerRef.current) return;
      stopRingtone();
      stopSound("calling");
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      try {
        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer),
        );
        isRemoteDescSetRef.current = true;
        await flushPendingCandidates();
        setCallState("connected");
        startDurationTimer();
      } catch (e) {
        console.error("handleCallAnswered:", e);
      }
    };

    const handleIceCandidate = async (data) => {
      if (!peerRef.current) return;
      if (isRemoteDescSetRef.current) {
        try {
          await peerRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate),
          );
        } catch (e) {}
      } else {
        pendingCandidatesRef.current.push(data.candidate);
      }
    };

    const handleCallRejected = (data) => {
      stopRingtone();
      stopSound("calling");
      if (data?.reason === "busy")
        alert(
          `${callInfoRef.current?.remoteUser?.name || "Người dùng"} đang trong cuộc gọi khác.`,
        );
      resetCall(null);
    };

    const handleCallEnded = () => resetCall(null);
    const handleCallCancelled = () => {
      stopRingtone();
      resetCall(null);
    };

    const handleMediaState = (data) => {
      if (data.conversationId && data.conversationId === groupConvIdRef.current)
        return;
      if (data.isMuted !== undefined) setIsRemoteMuted(data.isMuted);
      if (data.isCameraOff !== undefined) setIsRemoteVideoOff(data.isCameraOff);
    };

    const handleTypeChangeRequest = async ({
      from,
      newCallType,
      offer,
      isRenegotiate,
    }) => {
      if (from !== callInfoRef.current?.remoteUser?._id) return;

      if (isRenegotiate && offer && peerRef.current) {
        try {
          await peerRef.current.setRemoteDescription(
            new RTCSessionDescription(offer),
          );
          const answer = await peerRef.current.createAnswer();
          await peerRef.current.setLocalDescription(answer);
          socket.emit("call:type-change-answer", { to: from, answer });
          setIsRemoteVideoOff(false);
        } catch (e) {
          console.error("renegotiate:", e);
        }
        return;
      }

      pendingTypeChangeOfferRef.current = offer || null;
      setPendingTypeChange({ newCallType, from });
    };

    const handleTypeChangeAccept = async ({
      from,
      newCallType,
      offer,
      cameraOff,
    }) => {
      if (!peerRef.current) return;
      try {
        if (newCallType === "video" && !cameraOff) {
          const ns = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            },
            audio: false,
          });
          const [vt] = ns.getVideoTracks();
          peerRef.current.addTrack(vt, localStreamRef.current);
          localStreamRef.current.addTrack(vt);
          if (localVideoRef.current)
            localVideoRef.current.srcObject = localStreamRef.current;
        }

        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(offer),
        );
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit("call:type-change-answer", { to: from, answer });

        callTypeRef.current = newCallType;
        setCallType(newCallType);
        if (callInfoRef.current) callInfoRef.current.callType = newCallType;

        if (cameraOff) setIsRemoteVideoOff(true);
      } catch (e) {
        console.error("type-change-accept handler:", e);
      }
    };

    const handleTypeChangeAnswer = async ({ answer }) => {
      if (!peerRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
      } catch (e) {}
    };

    const handleTypeChangeReject = () => {
      setPendingTypeChange(null);
      callTypeRef.current = "video";
      setCallType("video");
      if (callInfoRef.current) callInfoRef.current.callType = "video";
      setIsRemoteVideoOff(true);
    };

    const handleRenegotiate = async ({ from, offer }) => {
      if (!peerRef.current) return;
      if (from !== callInfoRef.current?.remoteUser?._id) return;
      try {
        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(offer),
        );
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit("call:renegotiate-answer", { to: from, answer });
        setIsRemoteVideoOff(false);
      } catch (e) {
        console.error("handleRenegotiate:", e);
      }
    };

    const handleRenegotiateAnswer = async ({ answer }) => {
      if (!peerRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
      } catch (e) {}
    };

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:answered", handleCallAnswered);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:rejected", handleCallRejected);
    socket.on("call:ended", handleCallEnded);
    socket.on("call:cancelled", handleCallCancelled);
    socket.on("call:media-state", handleMediaState);
    socket.on("call:type-change-request", handleTypeChangeRequest);
    socket.on("call:type-change-accept", handleTypeChangeAccept);
    socket.on("call:type-change-answer", handleTypeChangeAnswer);
    socket.on("call:type-change-reject", handleTypeChangeReject);
    socket.on("call:renegotiate", handleRenegotiate);
    socket.on("call:renegotiate-answer", handleRenegotiateAnswer);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:answered", handleCallAnswered);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:rejected", handleCallRejected);
      socket.off("call:ended", handleCallEnded);
      socket.off("call:cancelled", handleCallCancelled);
      socket.off("call:media-state", handleMediaState);
      socket.off("call:type-change-request", handleTypeChangeRequest);
      socket.off("call:type-change-accept", handleTypeChangeAccept);
      socket.off("call:type-change-answer", handleTypeChangeAnswer);
      socket.off("call:type-change-reject", handleTypeChangeReject);
      socket.off("call:renegotiate", handleRenegotiate);
      socket.off("call:renegotiate-answer", handleRenegotiateAnswer);
    };
  }, [
    socket,
    callState,
    groupCallState,
    playRingtone,
    stopRingtone,
    resetCall,
    flushPendingCandidates,
    startDurationTimer,
  ]);

  const handleAcceptCall = useCallback(() => {
    if (!socket || !callInfoRef.current) return;
    const offer = pendingOfferRef.current;
    if (!offer) return;
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    const {
      remoteUser: ru,
      conversationId: convId,
      callType: ct,
    } = callInfoRef.current;
    acceptCall(offer, ru, convId, ct);
  }, [socket, acceptCall]);

  return (
    <WebRTCContext.Provider
      value={{
        // 1-1 call
        callState,
        callType,
        callDirection,
        remoteUser,
        conversationId,
        isMuted,
        isCameraOff,
        isSpeakerOff,
        callDuration,
        isRemoteVideoOff,
        isRemoteMuted,
        connectionQuality,
        localVideoRef,
        remoteVideoRef,
        remoteAudioRef,
        isTransitioning,
        onRemoteVideoMount,
        onLocalVideoMount,
        startCall,
        acceptCall: handleAcceptCall,
        rejectCall: () => rejectCall(callInfoRef.current?.remoteUser?._id),
        endCall,
        toggleMute,
        toggleCamera,
        toggleSpeaker,
        resetCall,
        // 1-1 type change
        pendingTypeChange,
        requestCallTypeChange,
        acceptCallTypeChange,
        rejectCallTypeChange,
        // refs
        localStreamRef,
        peerRef,
        // group call
        groupCallState,
        groupCallType,
        groupCallConvId,
        groupCallName,
        groupParticipants,
        groupCallDuration,
        groupIsMuted,
        groupIsCameraOff,
        incomingGroupCall,
        groupLocalVideoRef,
        onGroupLocalVideoMount,
        startGroupCall,
        leaveGroupCall,
        acceptGroupCall,
        declineGroupCall,
        toggleGroupMute,
        toggleGroupCamera,
        switchGroupCallType,
        // group call type change consent
        groupPendingTypeChange,
        acceptGroupTypeChange,
        rejectGroupTypeChange,
        // refs
        groupPeersRef,
        groupLocalStreamRef,
      }}
    >
      {children}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        muted={false}
        style={{ display: "none" }}
      />
    </WebRTCContext.Provider>
  );
};