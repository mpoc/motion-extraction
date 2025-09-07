"use client";

import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  getFirstEncodableVideoCodec,
  QUALITY_HIGH
} from "mediabunny";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Film, RotateCcw } from "lucide-react";
import { Inter, JetBrains_Mono } from "next/font/google";
import clsx from "clsx";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState(0);

  // __Assumption: Using two video elements for frame offset handling__
  const sourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const offsetVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const processVideo = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);

    try {
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
      const frameRate = 30; // __Assumption: 30fps, could be extracted from metadata if needed__
      const frameOffset = 10;
      const frameDuration = 1 / frameRate;

      // Create canvas for compositing
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
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
      setVideoUrl(resultUrl);

      // Cleanup
      URL.revokeObjectURL(videoUrl);
      sourceVideo.remove();
      offsetVideo.remove();

    } catch (error) {
      console.error('Error processing video:', error);
      alert('Error processing video: ' + error);
    }

    setIsProcessing(false);
    setProgress(0);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      await processVideo(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    if (!isProcessing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.type.startsWith("video/")) {
      await processVideo(file);
    }
  };

  return (
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
          {!videoUrl ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <motion.div
                animate={{
                  scale: isDragging ? 1.02 : 1,
                  borderColor: isDragging ? "#111827" : "#d1d5db",
                }}
                transition={{ duration: 0.2 }}
                className={clsx(
                  "border-2 border-dashed rounded-xl p-16 text-center",
                  "transition-all duration-200 bg-white/50 backdrop-blur-sm",
                  "shadow-sm hover:shadow-md",
                  !isProcessing && "cursor-pointer hover:border-gray-400"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleClick}
              >
                <div className="text-gray-600">
                  {isProcessing ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      <Film className="w-12 h-12 mx-auto text-gray-400 animate-pulse" />
                      <p className="font-medium text-gray-700">Processing video...</p>
                      <div className="w-full max-w-xs mx-auto space-y-2">
                        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                          <motion.div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full"
                            initial={{ width: "0%" }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <p className="text-sm text-gray-500 font-mono">{progress.toFixed(1)}%</p>
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
                        <p className="text-lg font-medium text-gray-700">Drop video file or click to browse</p>
                        <p className="text-sm text-gray-500 mt-1">MP4, MOV, or WebM</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </>
          ) : (
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
                onClick={() => setVideoUrl(null)}
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
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
