import React from "react";

const BASE_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

const getAvatarSrc = (avatar) => {
  if (!avatar) return null;
  // Bỏ qua avatar giả (dicebear, default-avatar)
  if (avatar.includes("dicebear")) return null;
  if (avatar.includes("/default-avatar")) return null;
  if (avatar.startsWith("/uploads")) return `${BASE_URL}${avatar}`;
  if (avatar.startsWith("http")) return avatar;
  return null;
};

const getInitial = (name) => {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
};

const COLORS = [
  "#1abc9c",
  "#2ecc71",
  "#3498db",
  "#9b59b6",
  "#e67e22",
  "#e74c3c",
  "#1a73e8",
  "#e91e63",
  "#009688",
  "#ff5722",
  "#607d8b",
  "#795548",
  "#f44336",
  "#673ab7",
  "#2196f3",
];

const getColor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
};

const GroupAvatar = ({ participants = [], size = 48, nicknames = {} }) => {
  const count = participants.length;
  const small = size / 2 - 2;

  const AvatarImg = ({ p, style }) => {
    const src = getAvatarSrc(p.avatar);
    const displayName = nicknames[p._id?.toString()] || p.name || "";
    if (src) {
      return (
        <img
          src={src}
          alt={displayName}
          onError={(e) => {
            e.target.style.display = "none";
          }}
          style={{
            position: "absolute",
            width: small,
            height: small,
            borderRadius: "50%",
            objectFit: "cover",
            border: "1.5px solid white",
            ...style,
          }}
        />
      );
    }
    return (
      <div
        style={{
          position: "absolute",
          width: small,
          height: small,
          borderRadius: "50%",
          background: getColor(displayName),
          border: "1.5px solid white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: small * 0.42,
          fontFamily: "Arial, sans-serif",
          userSelect: "none",
          ...style,
        }}
      >
        {getInitial(displayName)}
      </div>
    );
  };

  if (count === 0) return null;

  if (count === 1) {
    return (
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        <AvatarImg
          p={participants[0]}
          style={{ top: 0, left: 0, width: size, height: size }}
        />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        <AvatarImg p={participants[0]} style={{ top: 0, left: 0 }} />
        <AvatarImg p={participants[1]} style={{ bottom: 0, right: 0 }} />
      </div>
    );
  }

  if (count === 3) {
    return (
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        <AvatarImg
          p={participants[0]}
          style={{ top: 0, left: size / 2 - small / 2 }}
        />
        <AvatarImg p={participants[1]} style={{ bottom: 0, left: 0 }} />
        <AvatarImg p={participants[2]} style={{ bottom: 0, right: 0 }} />
      </div>
    );
  }

  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <AvatarImg p={participants[0]} style={{ top: 0, left: 0 }} />
      <AvatarImg p={participants[1]} style={{ top: 0, right: 0 }} />
      <AvatarImg p={participants[2]} style={{ bottom: 0, left: 0 }} />
      <div
        style={{
          position: "absolute",
          width: small,
          height: small,
          borderRadius: "50%",
          background: "#e4e6eb",
          border: "1.5px solid white",
          bottom: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: small * 0.35,
          fontWeight: 700,
          color: "#65676b",
        }}
      >
        +{count - 3}
      </div>
    </div>
  );
};

export default GroupAvatar;
