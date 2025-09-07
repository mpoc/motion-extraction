"use client";

import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  getFirstEncodableVideoCodec,
  QUALITY_HIGH,
  Input,
  BlobSource,
  ALL_FORMATS
} from "mediabunny";
import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Film, RotateCcw, Play } from "lucide-react";
import { Inter, JetBrains_Mono } from "next/font/google";
import clsx from "clsx";
import { useVideoStore } from "../store/videoStore";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

export default function Home() {
  const {
    isDragging,
    isProcessing,
    progress,
    selectedFile,
    videoUrl,
    frameOffset,
    setIsDragging,
    setProgress,
    setSelectedFile,
    setFrameOffset,
    clearFile,
    reset,
    startProcessing,
    finishProcessing,
    canUpload,
    canProcess,
    canClear,
    canAdjustSettings
  } = useVideoStore();

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processVideo = async (file: File) => {
    startProcessing();

    try {
      // Extract frame rate using MediaBunny
      const input = new Input({
        source: new BlobSource(file),
        formats: ALL_FORMATS,
      });

      const tracks = await input.getTracks();
      const videoTrack = tracks.find(track => track.isVideoTrack());

      if (!videoTrack) {
        throw new Error('No video track found in the file.');
      }

      const packetStats = await videoTrack.computePacketStats();
      const frameRate = packetStats.averagePacketRate; // This is the actual FPS

      console.log(`Extracted frame rate: ${frameRate} fps`);

      // __Decision: Using video elements for decoding instead of ffmpeg__
      const videoUrl = URL.createObjectURL(file);

      // Create and setup source videos
      const sourceVideo = document.createElement('video');
      const offsetVideo = document.createElement('video');
      sourceVideo.src = videoUrl;
      offsetVideo.src = videoUrl;
      sourceVideo.muted = true;
      offsetVideo.muted = true;

      // Wait for videos to load metadata
      await Promise.all([
        new Promise((resolve) => sourceVideo.addEventListener('loadedmetadata', resolve, { once: true })),
        new Promise((resolve) => offsetVideo.addEventListener('loadedmetadata', resolve, { once: true }))
      ]);

      const width = sourceVideo.videoWidth;
      const height = sourceVideo.videoHeight;
      const frameDuration = 1 / frameRate;

      // Create OffscreenCanvas for compositing
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d', { alpha: false })!;

      // Setup mediabunny output
      const output = new Output({
        target: new BufferTarget(),
        format: new Mp4OutputFormat(),
      });

      const videoCodec = await getFirstEncodableVideoCodec(output.format.getSupportedVideoCodecs(), {
        width,
        height,
      });

      if (!videoCodec) {
        throw new Error('Your browser doesn\'t support video encoding.');
      }

      const canvasSource = new CanvasSource(canvas, {
        codec: videoCodec,
        bitrate: QUALITY_HIGH,
      });

      output.addVideoTrack(canvasSource, { frameRate });
      await output.start();

      const totalFrames = Math.floor(sourceVideo.duration * frameRate);

      // __Decision: Using requestVideoFrameCallback if available, otherwise setTimeout__
      for (let frame = 0; frame < totalFrames; frame++) {
        const currentTime = frame / frameRate;
        const offsetTime = Math.max(0, currentTime - (frameOffset / frameRate));

        // Seek both videos
        sourceVideo.currentTime = currentTime;
        offsetVideo.currentTime = offsetTime;

        // Wait for seek to complete
        await Promise.all([
          new Promise((resolve) => sourceVideo.addEventListener('seeked', resolve, { once: true })),
          new Promise((resolve) => offsetVideo.addEventListener('seeked', resolve, { once: true }))
        ]);

        // Clear canvas
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // Draw original video (A)
        ctx.drawImage(sourceVideo, 0, 0, width, height);

        // __Decision: Using canvas filter for color inversion instead of pixel manipulation__
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.5;
        ctx.filter = 'invert(1)';

        // Draw inverted, offset video (B) with 50% opacity
        ctx.drawImage(offsetVideo, 0, 0, width, height);
        ctx.restore();

        // Add frame to output
        await canvasSource.add(currentTime, frameDuration);

        // Update progress
        setProgress((frame / totalFrames) * 100);
      }

      canvasSource.close();
      await output.finalize();

      // Create result video URL
      const resultBlob = new Blob([output.target.buffer!], { type: output.format.mimeType });
      const resultUrl = URL.createObjectURL(resultBlob);

      // Cleanup
      URL.revokeObjectURL(videoUrl);
      sourceVideo.remove();
      offsetVideo.remove();

      finishProcessing(resultUrl);

    } catch (error) {
      console.error('Error processing video:', error);
      alert('Error processing video: ' + error);
      finishProcessing(''); // Reset processing state on error
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!canUpload()) return;

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (canUpload()) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    if (canUpload() && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUpload()) return;

    const file = e.target.files?.[0];
    if (file?.type.startsWith("video/")) {
      setSelectedFile(file);
    }
  };

  const handleProcessVideo = async () => {
    if (canProcess() && selectedFile) {
      await processVideo(selectedFile);
    }
  };

  const handleReset = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    reset();
  };

  const handleClearFile = () => {
    if (canClear()) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      clearFile();
    }
  };  return (
    <div className={clsx(
      "min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-8",
      inter.variable,
      jetbrainsMono.variable,
      "font-sans"
    )}>
      <AnimatePresence mode="wait">
        <motion.div
          key="processor"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full max-w-2xl"
        >
          {videoUrl ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <div className="rounded-lg overflow-hidden shadow-2xl bg-black">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleReset}
                className={clsx(
                  "w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-lg",
                  "transition-all duration-200 shadow-md hover:shadow-lg",
                  "flex items-center justify-center gap-2 font-medium",
                  "bg-gradient-to-b from-gray-800 to-gray-900"
                )}
              >
                <RotateCcw className="w-4 h-4" />
                Process another video
              </motion.button>
            </motion.div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Upload Section */}
                <motion.div
                  animate={{
                    scale: isDragging ? 1.02 : 1,
                    borderColor: isDragging ? "#111827" : "#d1d5db",
                  }}
                  transition={{ duration: 0.2 }}
                  className={clsx(
                    "border-2 border-dashed rounded-xl p-12 text-center",
                    "transition-all duration-200 bg-white/50 backdrop-blur-sm",
                    "shadow-sm hover:shadow-md",
                    canUpload() && "cursor-pointer hover:border-gray-400",
                    !canUpload() && "opacity-60"
                  )}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={handleClick}
                >
                  <div className="text-gray-600">
                    {selectedFile ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-3"
                      >
                        <Film className="w-12 h-12 mx-auto text-green-600" />
                        <div>
                          <p className="font-medium text-gray-700">{selectedFile.name}</p>
                          <p className="text-sm text-gray-500">
                            {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Ready to process
                          </p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4"
                      >
                        <Upload className="w-16 h-16 mx-auto text-gray-400" strokeWidth={1.5} />
                        <div>
                          <p className="text-lg font-medium text-gray-700">
                            {isProcessing ? "Processing..." : "Drop video file or click to browse"}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {isProcessing ? "Please wait..." : "MP4, MOV, or WebM"}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                {/* Frame Offset Controls */}
                <div className="bg-white/50 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label htmlFor="frameOffset" className="text-sm font-medium text-gray-700">
                        Frame Offset
                      </label>
                      <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {frameOffset} frames
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        id="frameOffset"
                        type="range"
                        min="1"
                        max="60"
                        value={frameOffset}
                        onChange={(e) => setFrameOffset(parseInt(e.target.value))}
                        disabled={!canAdjustSettings()}
                        className={clsx(
                          "w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer",
                          "focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50",
                          !canAdjustSettings() && "opacity-50 cursor-not-allowed"
                        )}
                        style={{
                          background: `linear-gradient(to right, #374151 0%, #374151 ${((frameOffset - 1) / 59) * 100}%, #e5e7eb ${((frameOffset - 1) / 59) * 100}%, #e5e7eb 100%)`
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>1</span>
                        <span>60</span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500">
                      Higher offset extracts slower motion
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {selectedFile && (
                    <motion.button
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ scale: canClear() ? 1.01 : 1 }}
                      whileTap={{ scale: canClear() ? 0.99 : 1 }}
                      onClick={handleClearFile}
                      disabled={!canClear()}
                      className={clsx(
                        "flex-1 py-3 rounded-lg transition-all duration-200",
                        "flex items-center justify-center gap-2 font-medium",
                        canClear()
                          ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      )}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Clear File
                    </motion.button>
                  )}

                  <motion.button
                    whileHover={{ scale: canProcess() ? 1.01 : 1 }}
                    whileTap={{ scale: canProcess() ? 0.99 : 1 }}
                    onClick={handleProcessVideo}
                    disabled={!canProcess()}
                    className={clsx(
                      "py-3 rounded-lg transition-all duration-200",
                      "flex items-center justify-center gap-2 font-medium",
                      selectedFile ? "flex-1" : "w-full",
                      canProcess()
                        ? "bg-gradient-to-b from-gray-800 to-gray-900 text-white shadow-md hover:shadow-lg hover:bg-gray-800"
                        : "bg-gray-400 text-gray-200 cursor-not-allowed"
                    )}
                  >
                    <Play className="w-4 h-4" />
                    {isProcessing
                      ? 'Processing...'
                      : selectedFile
                        ? 'Process Video'
                        : 'Select a video file first'
                    }
                  </motion.button>
                </div>

                {/* Processing Progress */}
                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-white/50 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-gray-200"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-gray-500 animate-pulse" />
                        <p className="text-sm font-medium text-gray-700">Processing video...</p>
                      </div>
                      <div className="space-y-2">
                        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full"
                            initial={{ width: "0%" }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Frame offset: {frameOffset}</span>
                          <span className="font-mono">{progress.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
