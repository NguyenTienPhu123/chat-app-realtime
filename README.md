# 💬 Real-time Chat Application

Ứng dụng nhắn tin thời gian thực hỗ trợ chat cá nhân, nhóm,
gọi video và chia sẻ file.

## ✨ Tính năng

- Nhắn tin thời gian thực (Socket.IO)
- Gọi video 1-1 và nhóm (WebRTC)
- Gửi file, hình ảnh, voice message
- Reaction, reply, pin, star tin nhắn
- Tìm kiếm tin nhắn
- Dark/Light theme
- Xác thực JWT + Refresh token
- Rate limiting, bảo mật

## 🛠 Tech Stack

| Layer    | Công nghệ                       |
| -------- | ------------------------------- |
| Frontend | ReactJS, Vite, Socket.IO Client |
| Backend  | Node.js, Express, Socket.IO     |
| Database | MongoDB, Redis (cache)          |
| DevOps   | Docker, Nginx                   |
| Auth     | JWT, bcrypt                     |

## 📸 Screenshots

[Chèn 3-4 ảnh chụp màn hình app vào đây]

## ⚙️ Cách chạy với Docker

git clone https://github.com/bạn/chat-app.git
cd chat-app
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Điền thông tin vào file .env

docker-compose up --build

## 👥 Thành viên nhóm

- Nguyễn Tiến Phú — Frontend, Backend
- [Tên thành viên khác] — [Vai trò]
