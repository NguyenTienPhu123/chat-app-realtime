import React, { useEffect, useRef } from "react";
import "./ReactionPicker.css";

const ReactionPicker = ({ onSelect, onClose }) => {
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const reactions = [
    "👍",
    "❤️",
    "😂",
    "😮",
    "😢",
    "😡",
    "🔥",
    "🎉",
    "👏",
    "💯",
    "🙏",
    "👀",
    "😍",
    "🤔",
    "😊",
    "🤗",
    "😎",
    "🥳",
  ];

  return (
    <div className="reaction-picker-overlay">
      <div className="reaction-picker" ref={pickerRef}>
        <div className="reaction-grid">
          {reactions.map((emoji) => (
            <button
              key={emoji}
              className="reaction-emoji"
              onClick={() => onSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReactionPicker;
