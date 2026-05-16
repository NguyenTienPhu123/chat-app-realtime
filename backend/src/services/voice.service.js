const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

class VoiceService {
  constructor() {
    this.uploadDir = path.join(__dirname, "../../uploads/voice");
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  // Generate waveform data from audio file
  async generateWaveform(audioPath, samples = 50) {
    try {
      // Using ffmpeg to extract audio data
      // This is a simplified version - you may need ffmpeg installed
      // Alternative: use web-based solution on frontend

      // For now, return dummy waveform
      const waveform = Array.from(
        { length: samples },
        () => Math.random() * 100,
      );

      return waveform;
    } catch (error) {
      console.error("Waveform generation error:", error);
      return Array(50).fill(50); // Default flat waveform
    }
  }

  // Get audio duration
  async getAudioDuration(audioPath) {
    try {
      // Using ffprobe to get duration
      // ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 input.mp3

      // For now, return 0 - implement with ffmpeg if available
      return 0;
    } catch (error) {
      console.error("Duration extraction error:", error);
      return 0;
    }
  }

  // Compress audio file
  async compressAudio(inputPath, outputPath) {
    try {
      // Using ffmpeg to compress
      // ffmpeg -i input.wav -codec:a libmp3lame -qscale:a 2 output.mp3

      // For now, just copy file
      fs.copyFileSync(inputPath, outputPath);

      return outputPath;
    } catch (error) {
      console.error("Audio compression error:", error);
      throw error;
    }
  }

  // Validate audio file
  isValidAudioFile(file) {
    const allowedTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "audio/m4a",
    ];

    return allowedTypes.includes(file.mimetype);
  }

  // Get file size limit (10MB)
  getMaxFileSize() {
    return 10 * 1024 * 1024; // 10MB
  }
}

module.exports = new VoiceService();
