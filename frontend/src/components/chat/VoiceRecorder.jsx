import React, { useState, useRef, useEffect } from "react";
import "./VoiceRecorder.css";

const VoiceRecorder = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioURL, setAudioURL] = useState(null);
  const [waveform, setWaveform] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    startRecording();
    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Generate waveform animation
      generateWaveform();
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  };

  const generateWaveform = () => {
    const animate = () => {
      const newWaveform = Array.from({ length: 30 }, () => Math.random() * 100);
      setWaveform(newWaveform);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
  };

  const handleSend = () => {
    if (audioChunksRef.current.length === 0) return;

    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, {
      type: "audio/webm",
    });

    onSend(audioFile, duration, waveform);
  };

  const handleCancel = () => {
    stopRecording();
    if (audioURL) URL.revokeObjectURL(audioURL);
    onCancel();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="voice-recorder">
      <div className="recording-indicator">
        <div className={`recording-dot ${isRecording ? "pulse" : ""}`}></div>
        <span className="recording-time">{formatDuration(duration)}</span>
      </div>

      <div className="waveform-container">
        {waveform.map((height, index) => (
          <div
            key={index}
            className="waveform-bar"
            style={{ height: `${height}%` }}
          ></div>
        ))}
      </div>

      {audioURL && <audio controls src={audioURL} className="audio-preview" />}

      <div className="recorder-actions">
        <button className="cancel-recording-btn" onClick={handleCancel}>
          <span>✕</span>
          <span>Cancel</span>
        </button>

        {!isRecording && audioURL && (
          <button className="send-recording-btn" onClick={handleSend}>
            <span>➤</span>
            <span>Send</span>
          </button>
        )}

        {isRecording && (
          <button className="stop-recording-btn" onClick={stopRecording}>
            <span>⏹</span>
            <span>Stop</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceRecorder;
