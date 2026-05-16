import { useContext } from "react";
import { WebRTCContext } from "../contexts/WebRTCContext";

export const useWebRTC = () => {
  const ctx = useContext(WebRTCContext);
  if (!ctx) throw new Error("useWebRTC must be used within WebRTCProvider");
  return ctx;
};
