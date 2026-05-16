import React from "react";

// OnlineIcon
export const OnlineIcon = ({ size = 12 }) => (
  <div
    style={{
      width: size,
      height: size,
      background: "#31a24c",
      borderRadius: "50%",
      border: "2px solid white",
    }}
  />
);

// TypingIcon
export const TypingIcon = ({ size = 18 }) => (
  <span style={{ fontSize: size }}>💬</span>
);

// SeenIcon
export const SeenIcon = ({ size = 14, color = "#0084ff" }) => (
  <span style={{ fontSize: size, color }}>✓✓</span>
);

// DeliveredIcon
export const DeliveredIcon = ({ size = 14, color = "white" }) => (
  <span style={{ fontSize: size, color }}>✓✓</span>
);

// SentIcon
export const SentIcon = ({ size = 14, color = "white" }) => (
  <span style={{ fontSize: size, color }}>✓</span>
);

// SendingIcon
export const SendingIcon = ({ size = 14, color = "white" }) => (
  <span style={{ fontSize: size, color }}>⏳</span>
);

// PinBadgeIcon
export const PinBadgeIcon = ({ size = 18 }) => (
  <span style={{ fontSize: size }}>📌</span>
);

// HeartIcon
export const HeartIcon = ({ size = 16 }) => (
  <span style={{ fontSize: size }}>❤️</span>
);
