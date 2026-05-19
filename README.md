# Chat App – Ứng dụng Nhắn Tin Thời Gian Thực

Ứng dụng web nhắn tin trực tuyến hỗ trợ chat cá nhân và nhóm, xây dựng bằng ReactJS, Node.js và Socket.IO.

---

## Tính năng

- Nhắn tin cá nhân và nhóm theo thời gian thực
- Gọi video 1-1 và gọi nhóm (WebRTC)
- Gửi file, hình ảnh, ghi âm giọng nói
- Reply, reaction emoji, ghim và đánh dấu tin nhắn
- Tìm kiếm tin nhắn
- Đăng ký, đăng nhập với xác thực JWT
- Giao diện Dark / Light theme
- Hiển thị trạng thái online / offline

---

## Tech Stack

| Thành phần | Công nghệ                      |
| ---------- | ------------------------------ |
| Frontend   | ReactJS, Vite, CSS             |
| Backend    | Node.js, Express.js, Socket.IO |
| Database   | MongoDB                        |
| Realtime   | Socket.IO, WebRTC              |
| DevOps     | Docker, Docker Compose, Nginx  |

---

## Yêu cầu

- [Docker](https://www.docker.com/) và Docker Compose
- Git

---

## Cách chạy

### 1. Clone repo

```bash
git clone https://github.com/NguyenTienPhu123/chat-app-realtime.git
cd chat-app-realtime
```

### 2. Tạo file môi trường

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Mở `backend/.env` và điền các thông tin sau:

```
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
```

### 3. Chạy bằng Docker

```bash
docker-compose up --build
```

Sau khi chạy xong:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

---

## Cấu trúc thư mục

```
chat-app-realtime/
├── frontend/         # ReactJS
│   └── src/
├── backend/          # Node.js + Express
│   └── src/
│       ├── controllers/
│       ├── models/
│       ├── routes/
│       └── socket/
├── infrastructure/   # Nginx config
└── docker-compose.yml
```

---

## Screenshots

> Cập nhật sau khi deploy

---

## Thành viên nhóm

| Tên              | Vai trò           |
| ---------------- | ----------------- |
| Nguyễn Tiến Phú  | Frontend, Backend |
| [Tên thành viên] | [Vai trò]         |

---

## Liên hệ

Nguyễn Tiến Phú – [tienphunguyen283@gmail.com](mailto:tienphunguyen283@gmail.com)
