import React from "react";

export const PhoneOutgoingIcon = ({ size = 16, color = "#1976d2" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.86 13 19.8 19.8 0 0 1 1.79 4.38 2 2 0 0 1 3.77 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    <polyline points="18,2 22,2 22,6" />
    <line x1="16" y1="4" x2="22" y2="2" />
  </svg>
);

export const PhoneIncomingIcon = ({ size = 16, color = "#43a047" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.86 13 19.8 19.8 0 0 1 1.79 4.38 2 2 0 0 1 3.77 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    <polyline points="16,6 22,6 22,2" />
    <line x1="16" y1="4" x2="22" y2="6" />
  </svg>
);

export const PhoneMissedIcon = ({ size = 16, color = "#e53935" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      stroke={color}
      strokeWidth="2"
      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.86 13 19.8 19.8 0 0 1 1.79 4.38 2 2 0 0 1 3.77 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
    />
    <line x1="2" y1="2" x2="22" y2="22" stroke={color} strokeWidth="2.5" />
  </svg>
);

export const VideoOutgoingIcon = ({ size = 16, color = "#1976d2" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="23,7 16,12 23,17 23,7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    <polyline points="20,1 24,1 24,5" strokeWidth="1.8" />
    <line x1="19" y1="3" x2="24" y2="1" strokeWidth="1.8" />
  </svg>
);

export const VideoIncomingIcon = ({ size = 16, color = "#43a047" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="23,7 16,12 23,17 23,7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    <polyline points="24,19 24,23 20,23" strokeWidth="1.8" />
    <line x1="19" y1="21" x2="24" y2="23" strokeWidth="1.8" />
  </svg>
);

export const VideoMissedIcon = ({ size = 16, color = "#e53935" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 24"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="23,7 16,12 23,17 23,7" stroke={color} strokeWidth="2" />
    <rect
      x="1"
      y="5"
      width="15"
      height="14"
      rx="2"
      ry="2"
      stroke={color}
      strokeWidth="2"
    />
    <line x1="1" y1="5" x2="16" y2="19" stroke={color} strokeWidth="2.5" />
  </svg>
);
