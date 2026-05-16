// Tạo màu nền ngẫu nhiên nhưng đảm bảo đọc được chữ trắng
const AVATAR_COLORS = [
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

export const getAvatarColor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const getAvatarInitial = (name = "") => {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  // Lấy chữ cái đầu tiên của từ đầu tiên
  return trimmed[0].toUpperCase();
};

// Tạo data URL svg avatar từ tên
export const generateTextAvatar = (name = "", size = 100) => {
  const initial = getAvatarInitial(name);
  const bg = getAvatarColor(name);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${bg}" rx="${size / 2}"/>
      <text x="50%" y="50%" dy="0.35em" 
        text-anchor="middle" 
        font-family="Arial, sans-serif" 
        font-size="${size * 0.42}" 
        font-weight="600"
        fill="white">${initial}</text>
    </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};
