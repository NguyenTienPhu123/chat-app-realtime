import React, { useState, useEffect } from "react";
import "./FilePreview.css";

const ImageRow = ({
  indexes,
  images,
  height,
  maxWidth,
  getFullUrl,
  onImageClick,
  count,
}) => {
  const [dims, setDims] = useState(null);

  useEffect(() => {
    const promises = indexes.map((imgIdx) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 1, h: 1 });
        img.src = getFullUrl(images[imgIdx]?.url);
      });
    });

    Promise.all(promises).then((sizes) => {
      if (indexes.length === 1) {
        // Luôn chiếm full maxWidth, height theo tỉ lệ gốc
        const ratio = sizes[0].w / sizes[0].h;
        const w = maxWidth;
        const h = w / ratio;
        setDims([{ w, h }]);
      } else {
        // Nhiều ảnh: chiều cao bằng nhau, width theo tỉ lệ
        const TARGET_HEIGHT = 200;
        const gap = 2 * (indexes.length - 1);

        // Width mỗi ảnh nếu height = TARGET_HEIGHT
        const naturalWidths = sizes.map((s) => (s.w / s.h) * TARGET_HEIGHT);
        const totalNaturalWidth = naturalWidths.reduce((a, b) => a + b, 0);

        // Scale để vừa maxWidth
        const scale = (maxWidth - gap) / totalNaturalWidth;
        const finalHeight = TARGET_HEIGHT * scale;
        const finalWidths = naturalWidths.map((w) => w * scale);

        setDims(
          finalWidths.map((w) => ({
            w: Math.floor(w),
            h: Math.floor(finalHeight),
          })),
        );
      }
    });
  }, [indexes.join(",")]);

  if (!dims) return null;

  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {indexes.map((imgIdx, i) => {
        const img = images[imgIdx];
        if (!img) return null;
        const isLast = false;
        const { w, h } = dims[i] || { w: 200, h: 200 };

        return (
          <div
            key={imgIdx}
            style={{
              width: `${w}px`,
              height: `${h}px`,
              position: "relative",
              overflow: "hidden",
              cursor: "pointer",
              flexShrink: 0,
              borderRadius: "4px",
            }}
            onClick={() => onImageClick(img)}
            onMouseEnter={(e) => {
              e.currentTarget.querySelector(".grid-img-overlay").style.opacity =
                "1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.querySelector(".grid-img-overlay").style.opacity =
                "0";
            }}
          >
            <img
              src={getFullUrl(img.url)}
              alt={img.fileName || `Image ${imgIdx + 1}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "fill",
                display: "block",
              }}
              onCopy={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.clipboardData.clearData(); // ✅ XÓA HẾT DATA CŨ
                fetch(getFullUrl(img.url))
                  .then((res) => res.blob())
                  .then((blob) => createImageBitmap(blob))
                  .then((imgBitmap) => {
                    const canvas = document.createElement("canvas");
                    canvas.width = imgBitmap.width;
                    canvas.height = imgBitmap.height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(imgBitmap, 0, 0);
                    canvas.toBlob(async (pngBlob) => {
                      await navigator.clipboard.write([
                        new ClipboardItem({ "image/png": pngBlob }),
                      ]);
                    }, "image/png");
                  });
              }}
            />
            <div
              className="grid-img-overlay"
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.25)",
                opacity: 0,
                transition: "opacity 0.2s",
                pointerEvents: "none",
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
const FilePreview = ({ message, onImageClick }) => {
  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    const baseURL =
      import.meta.env.VITE_API_URL?.replace("/api", "") ||
      "http://localhost:5000";
    return `${baseURL}${url}`;
  };
  const handleImageCopy = async (e, imageUrl) => {
    e.preventDefault();
    e.stopPropagation();
    e.clipboardData?.clearData();
    try {
      const response = await fetch(getFullUrl(imageUrl));
      const blob = await response.blob();
      const imgBitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = imgBitmap.width;
      canvas.height = imgBitmap.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(imgBitmap, 0, 0);
      canvas.toBlob(async (pngBlob) => {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob }),
        ]);
      }, "image/png");
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };
  const formatFileSize = (bytes) => {
    if (!bytes) return "0 KB";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(2)} KB`;
  };

  // ✅ DOWNLOAD FILE ĐÚNG TÊN
  const handleDownload = async (e) => {
    e.stopPropagation();

    try {
      const response = await fetch(getFullUrl(message.fileUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = message.fileName || "download"; // ✅ DÙNG TÊN TỪ DATABASE
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      // Fallback: dùng <a> tag thông thường
      const link = document.createElement("a");
      link.href = getFullUrl(message.fileUrl);
      link.download = message.fileName || "download";
      link.click();
    }
  };
  if (message.type === "images") {
    const count = message.images?.length || 0;
    const FIXED_HEIGHT = 220;

    const getRows = (count) => {
      if (count === 1) return [[0]];
      if (count === 2) return [[0, 1]];
      if (count === 3) return [[0], [1, 2]];
      if (count === 4)
        return [
          [0, 1],
          [2, 3],
        ];
      if (count === 5)
        return [
          [0, 1],
          [2, 3, 4],
        ];
      if (count === 6)
        return [
          [0, 1, 2],
          [3, 4, 5],
        ];
      if (count === 7)
        return [
          [0, 1, 2],
          [3, 4],
          [5, 6],
        ];
      if (count === 8)
        return [
          [0, 1, 2],
          [3, 4, 5],
          [6, 7],
        ];
      if (count === 9)
        return [
          [0, 1, 2],
          [3, 4, 5],
          [6, 7, 8],
        ];
      // 10 ảnh trở lên: chia hàng 3 ảnh
      const rows = [];
      for (let i = 0; i < count; i += 3) {
        rows.push(
          Array.from({ length: Math.min(3, count - i) }, (_, j) => i + j),
        );
      }
      return rows;
    };

    const rows = getRows(count); // bỏ Math.min(count, 4)
    const MAX_WIDTH = 480;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          borderRadius: "12px",
          overflow: "hidden",
          maxWidth: `${MAX_WIDTH}px`,
        }}
      >
        {rows.map((rowIndexes, rowIdx) => {
          // Tính width từng ảnh dựa trên tỉ lệ thực tế
          // Dùng padding-top trick để giữ tỉ lệ
          return (
            <ImageRow
              key={rowIdx}
              indexes={rowIndexes}
              images={message.images}
              height={FIXED_HEIGHT}
              maxWidth={MAX_WIDTH}
              getFullUrl={getFullUrl}
              onImageClick={(img) =>
                onImageClick({
                  ...message,
                  _id: message._id + "_" + img.url,
                  fileUrl: img.url,
                  fileName: img.fileName,
                })
              }
              count={count}
            />
          );
        })}
      </div>
    );
  }
  if (message.type === "image") {
    return (
      <div
        style={{ cursor: "pointer", borderRadius: "8px", overflow: "hidden" }}
        onClick={() => onImageClick(message)}
      >
        <img
          src={getFullUrl(message.fileUrl)}
          alt={message.fileName || "image"}
          style={{
            maxWidth: "300px",
            maxHeight: "300px",
            display: "block",
            objectFit: "contain",
          }}
          onCopy={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.clipboardData.clearData(); // ✅ XÓA URL
            handleImageCopy(e, message.fileUrl);
          }}
        />
      </div>
    );
  }
  if (message.type === "video") {
    return (
      <div className="file-preview video-preview">
        <video
          src={getFullUrl(message.fileUrl)}
          controls
          className="preview-video"
        />
      </div>
    );
  }

  if (message.type === "file") {
    return (
      <div className="file-preview file-item">
        <div className="file-icon">
          {message.fileName?.endsWith(".pdf") && "📄"}
          {message.fileName?.endsWith(".doc") && "📝"}
          {message.fileName?.endsWith(".docx") && "📝"}
          {message.fileName?.endsWith(".xls") && "📊"}
          {message.fileName?.endsWith(".xlsx") && "📊"}
          {message.fileName?.endsWith(".zip") && "🗜️"}
          {!message.fileName?.match(/\.(pdf|docx?|xlsx?|zip)$/i) && "📎"}
        </div>
        <div className="file-info">
          <div className="file-name">{message.fileName || "Unknown file"}</div>
          <div className="file-size">{formatFileSize(message.fileSize)}</div>
        </div>
        <button
          onClick={handleDownload}
          className="download-btn"
          title={`Tải xuống ${message.fileName}`}
        >
          ⬇
        </button>
      </div>
    );
  }

  return null;
};

export default FilePreview;
