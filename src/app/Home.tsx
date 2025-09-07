"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Film, Play, RotateCcw, Upload } from "lucide-react";
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH
} from "mediabunny";
import { Inter, JetBrains_Mono } from "next/font/google";
import Image from "next/image";
import { useRef } from "react";
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
    thumbnail,
    frameRate,
    error,
    setIsDragging,
    setProgress,
    setSelectedFile,
    setFrameOffset,
    setThumbnail,
    setFrameRate,
    setError,
    clearFile,
    reset,
    startProcessing,
    finishProcessing,
    backToSettings,
    canUpload,
    canProcess,
    canClear,
    canAdjustSettings
  } = useVideoStore();

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const generateThumbnail = async (file: File) => {
    console.log('[THUMBNAIL] Starting thumbnail generation for file:', file.name, 'size:', file.size);
    try {
      console.log('[THUMBNAIL] Creating MediaBunny Input...');
      const input = new Input({
        source: new BlobSource(file),
        formats: ALL_FORMATS,
      });

      console.log('[THUMBNAIL] Getting primary video track...');
      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack) {
        console.error('[THUMBNAIL] No video track found');
        throw new Error('File has no video track.');
      }
      console.log('[THUMBNAIL] Video track found:', {
        width: videoTrack.displayWidth,
        height: videoTrack.displayHeight
      });

      // Get frame rate
      console.log('[THUMBNAIL] Computing packet stats...');
      const packetStats = await videoTrack.computePacketStats();
      const frameRate = Math.round(packetStats.averagePacketRate);
      console.log('[THUMBNAIL] Frame rate calculated:', frameRate);
      setFrameRate(frameRate);

      // Generate thumbnail
      console.log('[THUMBNAIL] Creating canvas sink...');
      const THUMBNAIL_SIZE = 400;
      const width = videoTrack.displayWidth > videoTrack.displayHeight
        ? THUMBNAIL_SIZE
        : Math.floor(THUMBNAIL_SIZE * videoTrack.displayWidth / videoTrack.displayHeight);
      const height = videoTrack.displayHeight > videoTrack.displayWidth
        ? THUMBNAIL_SIZE
        : Math.floor(THUMBNAIL_SIZE * videoTrack.displayHeight / videoTrack.displayWidth);

      console.log('[THUMBNAIL] Canvas dimensions:', { width, height, devicePixelRatio: window.devicePixelRatio });
      const sink = new CanvasSink(videoTrack, {
        width: Math.floor(width * window.devicePixelRatio),
        height: Math.floor(height * window.devicePixelRatio),
        fit: 'fill',
      });

      console.log('[THUMBNAIL] Getting first timestamp...');
      const firstTimestamp = await videoTrack.getFirstTimestamp();
      console.log('[THUMBNAIL] First timestamp:', firstTimestamp);

      console.log('[THUMBNAIL] Generating canvas at timestamp...');
      for await (const wrappedCanvas of sink.canvasesAtTimestamps([firstTimestamp])) {
        console.log('[THUMBNAIL] Canvas generated:', !!wrappedCanvas);
        if (wrappedCanvas) {
          const canvas = wrappedCanvas.canvas as HTMLCanvasElement;
          console.log('[THUMBNAIL] Converting canvas to blob...');
          canvas.toBlob((blob) => {
            console.log('[THUMBNAIL] Blob created:', !!blob, blob?.size);
            if (blob) {
              const thumbnailUrl = URL.createObjectURL(blob);
              console.log('[THUMBNAIL] Thumbnail URL created:', thumbnailUrl);
              setThumbnail(thumbnailUrl);
            }
          });
          break;
        }
      }
      console.log('[THUMBNAIL] Thumbnail generation completed');
    } catch (error) {
      console.error('[THUMBNAIL] Error generating thumbnail:', error);
      setError(`Failed to generate thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const processVideo = async (file: File) => {
    console.log('[PROCESS] =================================');
    console.log('[PROCESS] Starting video processing for:', file.name);
    console.log('[PROCESS] File size:', file.size, 'bytes');
    console.log('[PROCESS] File type:', file.type);
    console.log('[PROCESS] Frame offset:', frameOffset);
    console.log('[PROCESS] User agent:', navigator.userAgent);
    console.log('[PROCESS] =================================');

    startProcessing();

    try {
      // Create MediaBunny Input for both tracks
      console.log('[PROCESS] Creating MediaBunny Input...');
      const input = new Input({
        source: new BlobSource(file),
        formats: ALL_FORMATS,
      });

      console.log('[PROCESS] Getting video track...');
      const videoTrack = await input.getPrimaryVideoTrack();
      console.log('[PROCESS] Video track found:', !!videoTrack);

      if (!videoTrack) {
        throw new Error('No video track found in the file.');
      }

      console.log('[PROCESS] Computing packet stats...');
      const packetStats = await videoTrack.computePacketStats();
      const frameRate = packetStats.averagePacketRate; // This is the actual FPS
      console.log('[PROCESS] Extracted frame rate:', frameRate, 'fps');

      const width = videoTrack.displayWidth;
      const height = videoTrack.displayHeight;
      const totalDuration = await input.computeDuration();
      const frameDuration = 1 / frameRate;

      console.log('[PROCESS] Video properties:', { width, height, totalDuration, frameDuration });

      // Create CanvasSinks for both original and offset video streams
      console.log('[PROCESS] Creating CanvasSinks...');
      const sourceSink = new CanvasSink(videoTrack, {
        poolSize: 2,
        fit: 'fill',
      });

      const offsetSink = new CanvasSink(videoTrack, {
        poolSize: 2,
        fit: 'fill',
      });

      // Create OffscreenCanvas for compositing (fallback to regular canvas if not supported)
      console.log('[PROCESS] Checking OffscreenCanvas support...');
      const hasOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
      console.log('[PROCESS] OffscreenCanvas supported:', hasOffscreenCanvas);

      const canvas = hasOffscreenCanvas
        ? new OffscreenCanvas(width, height)
        : (() => {
            console.log('[PROCESS] Creating regular canvas fallback...');
            const regularCanvas = document.createElement('canvas');
            regularCanvas.width = width;
            regularCanvas.height = height;
            return regularCanvas;
          })();

      console.log('[PROCESS] Canvas created:', { width: canvas.width, height: canvas.height });

      const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      console.log('[PROCESS] Canvas context created:', !!ctx);

      // Setup mediabunny output
      console.log('[PROCESS] Setting up MediaBunny output...');
      const output = new Output({
        target: new BufferTarget(),
        format: new Mp4OutputFormat(),
      });

      console.log('[PROCESS] Getting video codec...');
      const videoCodec = await getFirstEncodableVideoCodec(output.format.getSupportedVideoCodecs(), {
        width,
        height,
      });
      console.log('[PROCESS] Video codec found:', !!videoCodec, videoCodec);

      if (!videoCodec) {
        console.error('[PROCESS] No video codec available');
        throw new Error('Your browser doesn\'t support video encoding.');
      }

      console.log('[PROCESS] Creating canvas source...');
      const canvasSource = new CanvasSource(canvas, {
        codec: videoCodec,
        bitrate: QUALITY_HIGH,
      });

      console.log('[PROCESS] Adding video track to output...');
      output.addVideoTrack(canvasSource, { frameRate });

      console.log('[PROCESS] Starting output...');
      await output.start();
      console.log('[PROCESS] Output started successfully');

      const totalFrames = Math.floor(totalDuration * frameRate);
      console.log('[PROCESS] Total frames to process:', totalFrames);

      // Process frames using MediaBunny iterators instead of video element seeking
      console.log('[PROCESS] Starting frame processing loop...');
      for (let frame = 0; frame < totalFrames; frame++) {
        if (frame % 60 === 0) { // Log every 60th frame to avoid spam
          console.log(`[PROCESS] Processing frame ${frame}/${totalFrames} (${((frame/totalFrames)*100).toFixed(1)}%)`);
        }

        const currentTime = frame / frameRate;
        const offsetTime = Math.max(0, currentTime - (frameOffset / frameRate));

        if (frame === 0) {
          console.log('[PROCESS] First frame times:', { currentTime, offsetTime, frameOffset });
        }

        // Get frames at specific timestamps using MediaBunny
        console.log(`[PROCESS] Frame ${frame}: Getting frames at timestamps:`, { currentTime, offsetTime });

        let sourceCanvas: HTMLCanvasElement | null = null;
        let offsetCanvas: HTMLCanvasElement | null = null;

        // Get source frame
        for await (const wrappedCanvas of sourceSink.canvasesAtTimestamps([currentTime])) {
          if (wrappedCanvas) {
            sourceCanvas = wrappedCanvas.canvas as HTMLCanvasElement;
            break;
          }
        }

        // Get offset frame
        for await (const wrappedCanvas of offsetSink.canvasesAtTimestamps([offsetTime])) {
          if (wrappedCanvas) {
            offsetCanvas = wrappedCanvas.canvas as HTMLCanvasElement;
            break;
          }
        }

        if (!sourceCanvas || !offsetCanvas) {
          console.warn(`[PROCESS] Frame ${frame}: Missing canvas - source: ${!!sourceCanvas}, offset: ${!!offsetCanvas}`);
          continue;
        }

        console.log(`[PROCESS] Frame ${frame}: Both frames obtained, compositing...`);

        // Clear canvas
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // Draw original frame (A)
        ctx.drawImage(sourceCanvas, 0, 0, width, height);
        console.log(`[PROCESS] Frame ${frame}: Source frame drawn`);

        // Draw inverted, offset frame (B) with 50% opacity
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.5;
        ctx.filter = 'invert(1)';
        ctx.drawImage(offsetCanvas, 0, 0, width, height);
        ctx.restore();
        console.log(`[PROCESS] Frame ${frame}: Offset frame drawn with filter`);

        // Add frame to output
        console.log(`[PROCESS] Frame ${frame}: Adding frame to canvas source...`);
        await canvasSource.add(currentTime, frameDuration);
        console.log(`[PROCESS] Frame ${frame}: Frame added to output`);

        // Update progress
        const progressPercent = (frame / totalFrames) * 100;
        setProgress(progressPercent);
        console.log(`[PROCESS] Frame ${frame}: Progress updated to ${progressPercent.toFixed(1)}%`);
      }

      console.log('[PROCESS] All frames processed, closing canvas source...');
      canvasSource.close();
      console.log('[PROCESS] Canvas source closed, finalizing output...');
      await output.finalize();
      console.log('[PROCESS] Output finalized');

      // Create result video URL
      console.log('[PROCESS] Creating result blob...');
      const resultBlob = new Blob([output.target.buffer!], { type: output.format.mimeType });
      console.log('[PROCESS] Result blob created:', { size: resultBlob.size, type: resultBlob.type });

      const resultUrl = URL.createObjectURL(resultBlob);
      console.log('[PROCESS] Result URL created:', resultUrl);

      console.log('[PROCESS] =================================');
      console.log('[PROCESS] Video processing completed successfully!');
      console.log('[PROCESS] =================================');
      finishProcessing(resultUrl);

    } catch (error) {
      console.error('[PROCESS] =================================');
      console.error('[PROCESS] ERROR during video processing:', error);
      console.error('[PROCESS] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[PROCESS] =================================');
      setError(`Failed to process video: ${error instanceof Error ? error.message : 'Unknown error'}`);
      finishProcessing(''); // Reset processing state on error
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    console.log('[UI] File drop event triggered');
    e.preventDefault();
    setIsDragging(false);

    if (!canUpload()) {
      console.log('[UI] Upload not allowed, ignoring drop');
      return;
    }

    const file = e.dataTransfer.files[0];
    console.log('[UI] Dropped file:', file?.name, file?.type, file?.size);
    if (!file) {
      console.log('[UI] No file in drop event');
      setError('No file was dropped');
      return;
    }

    if (!file.type.startsWith("video/")) {
      console.log('[UI] Invalid file type:', file.type);
      setError('Please select a valid video file (MP4, MOV, WebM, etc.)');
      return;
    }

    console.log('[UI] Valid video file dropped, proceeding...');
    setError(undefined); // Clear any previous errors
    setSelectedFile(file);
    await generateThumbnail(file);
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
    console.log('[UI] File input change event triggered');
    if (!canUpload()) {
      console.log('[UI] Upload not allowed, ignoring file select');
      return;
    }

    const file = e.target.files?.[0];
    console.log('[UI] Selected file:', file?.name, file?.type, file?.size);
    if (!file) {
      console.log('[UI] No file selected');
      setError('No file was selected');
      return;
    }

    if (!file.type.startsWith("video/")) {
      console.log('[UI] Invalid file type:', file.type);
      setError('Please select a valid video file (MP4, MOV, WebM, etc.)');
      return;
    }

    console.log('[UI] Valid video file selected, proceeding...');
    setError(undefined); // Clear any previous errors
    setSelectedFile(file);
    await generateThumbnail(file);
  };

  const handleProcessVideo = async () => {
    console.log('[UI] Process video button clicked');
    console.log('[UI] Can process:', canProcess());
    console.log('[UI] Selected file:', selectedFile?.name);
    console.log('[UI] Frame offset:', frameOffset);

    if (canProcess() && selectedFile) {
      console.log('[UI] Starting video processing...');
      setError(undefined); // Clear any previous errors
      await processVideo(selectedFile);
    } else {
      console.log('[UI] Cannot process - missing requirements');
    }
  };

  const handleReset = () => {
    console.log('[UI] Reset button clicked');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Clean up thumbnail URL to prevent memory leaks
    if (thumbnail) {
      console.log('[UI] Revoking thumbnail URL');
      URL.revokeObjectURL(thumbnail);
    }
    reset();
  };

  const handleClearFile = () => {
    console.log('[UI] Clear file button clicked');
    if (canClear()) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Clean up thumbnail URL to prevent memory leaks
      if (thumbnail) {
        console.log('[UI] Revoking thumbnail URL');
        URL.revokeObjectURL(thumbnail);
      }
      clearFile();
    } else {
      console.log('[UI] Cannot clear file - not allowed');
    }
  };

  const handleDismissError = () => {
    setError(undefined);
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
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={backToSettings}
                  className={clsx(
                    "flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg",
                    "transition-all duration-200 shadow-md hover:shadow-lg",
                    "flex items-center justify-center gap-2 font-medium",
                    "bg-gradient-to-b from-gray-600 to-gray-700"
                  )}
                >
                  <Play className="w-4 h-4" />
                  Process again
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleReset}
                  className={clsx(
                    "flex-1 bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-lg",
                    "transition-all duration-200 shadow-md hover:shadow-lg",
                    "flex items-center justify-center gap-2 font-medium",
                    "bg-gradient-to-b from-gray-800 to-gray-900"
                  )}
                >
                  <RotateCcw className="w-4 h-4" />
                  Process another video
                </motion.button>
              </div>
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
                {/* Error Alert */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="cursor-pointer"
                    onClick={handleDismissError}
                  >
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}

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
                        {thumbnail ? (
                          <div className="w-16 h-16 mx-auto rounded-lg overflow-hidden border-2 border-green-200">
                            <Image
                              src={thumbnail}
                              alt="Video thumbnail"
                              width={64}
                              height={64}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <Film className="w-12 h-12 mx-auto text-green-600" />
                        )}
                        <div>
                          <p className="font-medium text-gray-700">{selectedFile.name}</p>
                          <p className="text-sm text-gray-500">
                            {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                            {frameRate && ` • ${frameRate} fps`} • Ready to process
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
