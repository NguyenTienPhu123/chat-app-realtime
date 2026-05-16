import React, { useState, useEffect, useRef } from "react";
import { formatMessageTime } from "../../utils/date.util";
import "./ImageLightbox.css";

const ImageLightbox = ({
  message,
  allImages = [],
  conversationName,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const sidebarRef = useRef(null);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const index = allImages.findIndex(
      (img) => img._id === message._id || img.fileUrl === message.fileUrl,
    );
    setCurrentIndex(index >= 0 ? index : 0);
  }, [allImages]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.2 : 0.2;
      // ✅ MIN = 1 (100%), MAX = 5
      setScale((prev) => Math.min(Math.max(prev + delta, 1), 5));
    };

    window.addEventListener("keydown", handleKeyDown);
    const imgContainer = containerRef.current;
    if (imgContainer) {
      imgContainer.addEventListener("wheel", handleWheel, { passive: false });
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (imgContainer) {
        imgContainer.removeEventListener("wheel", handleWheel);
      }
    };
  }, [currentIndex, scale]);

  const currentMessage = allImages[currentIndex] || message;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetTransform();
    }
  };

  const handleNext = () => {
    if (currentIndex < allImages.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetTransform();
    }
  };

  // ✅ ZOOM: Min = 1 (100%)
  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.2, 5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.2, 1));

  const resetTransform = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // ✅ KIỂM TRA GIỚI HẠN KÉO
  const checkBoundary = (newX, newY) => {
    if (!imageRef.current || !containerRef.current) return { x: 0, y: 0 };

    const img = imageRef.current;
    const container = containerRef.current;

    const imgWidth = img.offsetWidth * scale;
    const imgHeight = img.offsetHeight * scale;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    // ✅ Chỉ cho kéo nếu ảnh lớn hơn container
    let boundedX = newX;
    let boundedY = newY;

    if (imgWidth > containerWidth) {
      const maxX = (imgWidth - containerWidth) / 2;
      boundedX = Math.min(Math.max(newX, -maxX), maxX);
    } else {
      boundedX = 0; // ✅ Ảnh nhỏ hơn → giữ giữa
    }

    if (imgHeight > containerHeight) {
      const maxY = (imgHeight - containerHeight) / 2;
      boundedY = Math.min(Math.max(newY, -maxY), maxY);
    } else {
      boundedY = 0;
    }

    return { x: boundedX, y: boundedY };
  };

  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || scale <= 1) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    // ✅ KIỂM TRA GIỚI HẠN
    const bounded = checkBoundary(newX, newY);
    setPosition(bounded);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // ✅ SNAP VỀ VỊ TRÍ HỢP LỆ khi thả chuột
    setPosition((prev) => checkBoundary(prev.x, prev.y));
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragStart, scale]);

  // ✅ Reset position khi zoom thay đổi
  useEffect(() => {
    if (scale === 1) {
      setPosition({ x: 0, y: 0 });
    } else {
      setPosition((prev) => checkBoundary(prev.x, prev.y));
    }
  }, [scale]);

  useEffect(() => {
    if (!sidebarRef.current) return;
    const activeItem = sidebarRef.current.querySelector(
      ".sidebar-image-item.active",
    );
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: "auto", block: "nearest" });
    }
  }, [currentIndex]);
  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    const baseURL =
      import.meta.env.VITE_API_URL?.replace("/api", "") ||
      "http://localhost:5000";
    return `${baseURL}${url}`;
  };

  // ✅ DOWNLOAD ẢNH ĐÚNG TÊN
  const handleDownload = async () => {
    try {
      const response = await fetch(getFullUrl(currentMessage.fileUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = currentMessage.fileName || "image.jpg"; // ✅ TÊN GỐC
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  // ✅ MỞ ẢNH Ở TAB MỚI - HIỂN THỊ TÊN FILE
  const handleOpenNew = () => {
    const baseURL =
      import.meta.env.VITE_API_URL?.replace("/api", "") ||
      "http://localhost:5000";
    const url = `${baseURL}/api/files/view/${currentMessage._id}`;
    window.open(url, "_blank");
  };

  return (
    <div className="lightbox-fullscreen" onClick={onClose}>
      <div className="lightbox-layout" onClick={(e) => e.stopPropagation()}>
        {/* ✅ MAIN IMAGE - FULL MÀN HÌNH */}
        <div className="lightbox-main">
          {/* ✅ INFO BÊN TRÁI */}
          <div className="lightbox-info">
            <span className="lightbox-sender">
              {currentMessage.senderId?.name || conversationName}
            </span>
            <span className="lightbox-time">
              {(() => {
                const d = new Date(currentMessage.createdAt);
                const now = new Date();
                const today = new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  now.getDate(),
                );
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const msgDate = new Date(
                  d.getFullYear(),
                  d.getMonth(),
                  d.getDate(),
                );

                let dateLabel;
                if (msgDate.getTime() === today.getTime()) {
                  dateLabel = "Hôm nay";
                } else if (msgDate.getTime() === yesterday.getTime()) {
                  dateLabel = "Hôm qua";
                } else {
                  dateLabel = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                }

                const hours = String(d.getHours()).padStart(2, "0");
                const mins = String(d.getMinutes()).padStart(2, "0");
                return `${dateLabel} lúc ${hours}:${mins}`;
              })()}
            </span>
          </div>

          {/* ✅ ACTIONS BÊN PHẢI */}
          <div className="lightbox-top-controls">
            <button
              onClick={handleOpenNew}
              className="lightbox-btn"
              title="Mở tab mới"
            >
              ↗
            </button>
            <button
              onClick={resetTransform}
              className="lightbox-btn"
              title="Reset"
            >
              ⟲
            </button>
            <button
              onClick={handleDownload}
              className="lightbox-btn"
              title="Tải xuống"
            >
              ⬇
            </button>
            <button
              onClick={onClose}
              className="lightbox-btn-close"
              title="Đóng"
            >
              ✕
            </button>
          </div>

          {/* Image */}
          <div
            ref={containerRef}
            className="lightbox-image-container"
            onMouseDown={handleMouseDown}
            style={{
              cursor:
                scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
            }}
          >
            <img
              ref={imageRef}
              src={getFullUrl(currentMessage.fileUrl)}
              alt={currentMessage.fileName}
              style={{
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                transition: isDragging ? "none" : "transform 0.2s ease",
              }}
              className="lightbox-main-image"
              draggable={false}
            />
          </div>

          {/* Bottom controls */}
          <div className="lightbox-bottom-controls">
            <div className="lightbox-zoom">
              <button
                onClick={handleZoomOut}
                className="zoom-btn"
                disabled={scale <= 1}
              >
                −
              </button>
              <span className="zoom-level">{Math.round(scale * 100)}%</span>
              <button
                onClick={handleZoomIn}
                className="zoom-btn"
                disabled={scale >= 5}
              >
                +
              </button>
            </div>

            <div className="lightbox-nav">
              <button
                onClick={handlePrev}
                className="nav-btn"
                disabled={currentIndex === 0}
              >
                ‹
              </button>
              <span className="nav-counter">
                {currentIndex + 1} / {allImages.length}
              </span>
              <button
                onClick={handleNext}
                className="nav-btn"
                disabled={currentIndex === allImages.length - 1}
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* ✅ SIDEBAR - DANH SÁCH ẢNH */}
        <div className="lightbox-sidebar">
          <div className="sidebar-title">Ảnh ({allImages.length})</div>
          <div className="sidebar-images" ref={sidebarRef}>
            {allImages.map((img, idx) => {
              const d = new Date(img.createdAt);
              const now = new Date();
              const today = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
              );
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              const msgDate = new Date(
                d.getFullYear(),
                d.getMonth(),
                d.getDate(),
              );

              let dateLabel;
              if (msgDate.getTime() === today.getTime()) dateLabel = "Hôm nay";
              else if (msgDate.getTime() === yesterday.getTime())
                dateLabel = "Hôm qua";
              else
                dateLabel = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

              const prevImg = allImages[idx - 1];
              let showLabel = false;
              if (!prevImg) {
                showLabel = true;
              } else {
                const pd = new Date(prevImg.createdAt);
                const prevDate = new Date(
                  pd.getFullYear(),
                  pd.getMonth(),
                  pd.getDate(),
                );
                showLabel = prevDate.getTime() !== msgDate.getTime();
              }

              return (
                <React.Fragment key={img._id}>
                  {showLabel && (
                    <div className="sidebar-date-group">{dateLabel}</div>
                  )}
                  <div
                    className={`sidebar-image-item ${idx === currentIndex ? "active" : ""}`}
                    onClick={() => {
                      setCurrentIndex(idx);
                      resetTransform();
                    }}
                  >
                    <img
                      src={getFullUrl(img.fileUrl)}
                      alt={img.fileName}
                      className="sidebar-thumbnail"
                    />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageLightbox;
