import { create } from 'zustand';

type VideoState = {
  // UI States
  isDragging: boolean;
  isProcessing: boolean;
  progress: number;
  error?: string;

  // File States
  selectedFile?: File;
  videoUrl?: string;
  thumbnail?: string;
  frameRate?: number;

  // Configuration
  frameOffset: number;

  // Actions
  setIsDragging: (isDragging: boolean) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setProgress: (progress: number) => void;
  setSelectedFile: (file?: File) => void;
  setVideoUrl: (url?: string) => void;
  setFrameOffset: (offset: number) => void;
  setThumbnail: (thumbnail?: string) => void;
  setFrameRate: (frameRate?: number) => void;
  setError: (error?: string) => void;

  // Compound Actions
  clearFile: () => void;
  reset: () => void;
  startProcessing: () => void;
  finishProcessing: (videoUrl: string) => void;
  backToSettings: () => void;

  // Computed States
  canUpload: () => boolean;
  canProcess: () => boolean;
  canClear: () => boolean;
  canAdjustSettings: () => boolean;
}

export const useVideoStore = create<VideoState>((set, get) => ({
  // Initial States
  isDragging: false,
  isProcessing: false,
  progress: 0,
  error: undefined,
  selectedFile: undefined,
  videoUrl: undefined,
  thumbnail: undefined,
  frameRate: undefined,
  frameOffset: 10,

  // Basic Actions
  setIsDragging: (isDragging) => set({ isDragging }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setProgress: (progress) => set({ progress }),
  setSelectedFile: (selectedFile) => set({ selectedFile }),
  setVideoUrl: (videoUrl) => set({ videoUrl }),
  setFrameOffset: (frameOffset) => set({ frameOffset }),
  setThumbnail: (thumbnail) => set({ thumbnail }),
  setFrameRate: (frameRate) => set({ frameRate }),
  setError: (error) => set({ error }),

  // Compound Actions
  clearFile: () => set({
    selectedFile: undefined,
    thumbnail: undefined,
    frameRate: undefined,
    isDragging: false,
    error: undefined
  }),

  reset: () => set({
    selectedFile: undefined,
    videoUrl: undefined,
    thumbnail: undefined,
    frameRate: undefined,
    frameOffset: 10,
    progress: 0,
    isProcessing: false,
    isDragging: false,
    error: undefined
  }),

  startProcessing: () => set({
    isProcessing: true,
    progress: 0,
    isDragging: false,
    error: undefined
  }),

  finishProcessing: (videoUrl) => set({
    isProcessing: false,
    progress: 0,
    videoUrl,
    error: undefined
  }),

  backToSettings: () => set({
    videoUrl: undefined,
    progress: 0,
    isProcessing: false,
    error: undefined
  }),

  // Computed States (Business Logic)
  canUpload: () => {
    const state = get();
    return !state.isProcessing && !state.selectedFile;
  },

  canProcess: () => {
    const state = get();
    return !state.isProcessing && !!state.selectedFile;
  },

  canClear: () => {
    const state = get();
    return !state.isProcessing && !!state.selectedFile;
  },

  canAdjustSettings: () => {
    const state = get();
    return !state.isProcessing;
  }
}));
