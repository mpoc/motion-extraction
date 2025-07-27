"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Film, Loader2, RotateCcw } from "lucide-react";
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
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState(0);
  const useMultiThreaded = false;

  const load = async () => {
    setIsLoading(true);
    const baseURL = `https://unpkg.com/@ffmpeg/core${useMultiThreaded ? "-mt" : ""}@0.12.10/dist/umd`;
    const ffmpeg = ffmpegRef.current;
    ffmpeg.on("log", ({ message }) => {
      console.log("FFmpeg log:", message);
    });
    ffmpeg.on("progress", (progressEvent) => {
      console.log("Progress:", progressEvent);
      setProgress(progressEvent.progress * 100);
    });
    // toBlobURL is used to bypass CORS issue, urls with the same
    // domain can be used directly.
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      workerURL: useMultiThreaded ? await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript") : undefined,
    });
    setLoaded(true);
    setIsLoading(false);
  };

  const processVideo = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    const ffmpeg = ffmpegRef.current;

    await ffmpeg.writeFile("input.mp4", await fetchFile(file));
    const threads = useMultiThreaded ? ["-threads", "4"] : [];
    // Invert colors using negate filter
    // await ffmpeg.exec(["-i", "input.mp4", "-vf", "negate", "-c:a", "copy", ...threads, "output.mp4"]);
    await ffmpeg.exec([
      "-i", "input.mp4",
      // "-filter_complex", "[0:v]split[a][b];[b]setpts=PTS+(10/FR/TB),negate,format=rgba,colorchannelmixer=aa=0.5[c];[a][c]overlay=eof_action=pass",
      "-filter_complex", "[0:v]split[a][b];[b]setpts=PTS+(10/FR/TB),negate,format=rgba,colorchannelmixer=aa=0.5[c];[a][c]overlay=eof_action=pass,eq=brightness=-0.5",
      // ...threads,
      "output.mp4"
    ]);

    const data = await ffmpeg.readFile("output.mp4");
    // @ts-expect-error as Uint8Array
    const url = URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: "video/mp4" }));
    setVideoUrl(url);
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

  return (
    <div className={clsx(
      "min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-8",
      inter.variable,
      jetbrainsMono.variable,
      "font-sans"
    )}>
      <AnimatePresence mode="wait">
        {!loaded ? (
          <motion.button
            key="load"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={clsx(
              "flex items-center gap-3 bg-gray-900 hover:bg-gray-800",
              "text-white px-8 py-4 rounded-lg transition-all duration-200",
              "shadow-lg hover:shadow-xl transform hover:-translate-y-0.5",
              "bg-gradient-to-b from-gray-800 to-gray-900"
            )}
            onClick={load}
          >
            <span className="font-medium">Initialize FFmpeg</span>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <Loader2 className="w-5 h-5 animate-spin" />
              </motion.div>
            )}
          </motion.button>
        ) : (
          <motion.div
            key="processor"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-2xl"
          >
            {!videoUrl ? (
              <motion.div
                animate={{
                  scale: isDragging ? 1.02 : 1,
                  borderColor: isDragging ? "#111827" : "#d1d5db"
                }}
                transition={{ duration: 0.2 }}
                className={clsx(
                  "border-2 border-dashed rounded-xl p-16 text-center",
                  "transition-all duration-200 bg-white/50 backdrop-blur-sm",
                  "shadow-sm hover:shadow-md"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
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
                        <p className="text-lg font-medium text-gray-700">Drop video file</p>
                        <p className="text-sm text-gray-500 mt-1">MP4, MOV, or WebM</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
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
        )}
      </AnimatePresence>
    </div>
  );
}
