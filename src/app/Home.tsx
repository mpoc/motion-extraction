"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { useRef, useState } from "react";

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState(0);
  const useMultiThreaded = true;

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
    await ffmpeg.exec(["-i", "input.mp4", "-vf", "negate", "-c:a", "copy", ...threads, "output.mp4"]);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-8">
      {!loaded ? (
        <button
          className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-lg transition-all duration-200 shadow-lg"
          onClick={load}
        >
          Load ffmpeg
          {isLoading && (
            <span className="animate-spin">
              <svg
                viewBox="0 0 1024 1024"
                focusable="false"
                data-icon="loading"
                width="1em"
                height="1em"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M988 548c-19.9 0-36-16.1-36-36 0-59.4-11.6-117-34.6-171.3a440.45 440.45 0 00-94.3-139.9 437.71 437.71 0 00-139.9-94.3C629 83.6 571.4 72 512 72c-19.9 0-36-16.1-36-36s16.1-36 36-36c69.1 0 136.2 13.5 199.3 40.3C772.3 66 827 103 874 150c47 47 83.9 101.8 109.7 162.7 26.7 63.1 40.2 130.2 40.2 199.3.1 19.9-16 36-35.9 36z"></path>
              </svg>
            </span>
          )}
        </button>
      ) : (
        <div className="w-full max-w-2xl">
          {!videoUrl ? (
            <div
              className={`border-2 border-dashed rounded-xl p-16 text-center transition-all duration-200 ${
                isDragging
                  ? "border-gray-900 bg-gray-100 scale-105"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="text-gray-600">
                {isProcessing ? (
                  <>
                    <div className="animate-spin w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full mx-auto mb-4"></div>
                    <p className="mb-4">Processing video...</p>
                    <div className="w-full max-w-xs mx-auto">
                      <progress
                        value={progress}
                        max={100}
                        className="w-full h-2 [&::-webkit-progress-bar]:rounded-md [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-value]:rounded-md [&::-webkit-progress-value]:bg-gray-900 [&::-moz-progress-bar]:rounded-md [&::-moz-progress-bar]:bg-gray-900"
                      />
                      <p className="text-sm text-gray-500 mt-2">{progress.toFixed(1)}%</p>
                    </div>
                  </>
                ) : (
                  <>
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p>Drop video here</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full rounded-lg shadow-lg"
              />
              <button
                onClick={() => setVideoUrl(null)}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-lg transition-all duration-200"
              >
                Process another video
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
