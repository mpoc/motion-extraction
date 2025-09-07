import { create } from 'zustand';

type VideoState = {
  // UI States
  isDragging: boolean;
  isProcessing: boolean;
  progress: number;

  // File States
  selectedFile?: File;
  videoUrl?: string;

  // Configuration
  frameOffset: number;

  // Actions
  setIsDragging: (isDragging: boolean) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setProgress: (progress: number) => void;
  setSelectedFile: (file?: File) => void;
  setVideoUrl: (url?: string) => void;
  setFrameOffset: (offset: number) => void;

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
  selectedFile: undefined,
  videoUrl: undefined,
  frameOffset: 10,

  // Basic Actions
  setIsDragging: (isDragging) => set({ isDragging }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setProgress: (progress) => set({ progress }),
  setSelectedFile: (selectedFile) => set({ selectedFile }),
  setVideoUrl: (videoUrl) => set({ videoUrl }),
  setFrameOffset: (frameOffset) => set({ frameOffset }),

  // Compound Actions
  clearFile: () => set({
    selectedFile: undefined,
    isDragging: false
  }),

  reset: () => set({
    selectedFile: undefined,
    videoUrl: undefined,
    frameOffset: 10,
    progress: 0,
    isProcessing: false,
    isDragging: false
  }),

  startProcessing: () => set({
    isProcessing: true,
    progress: 0,
    isDragging: false
  }),

  finishProcessing: (videoUrl) => set({
    isProcessing: false,
    progress: 0,
    videoUrl
  }),

  backToSettings: () => set({
    videoUrl: undefined,
    progress: 0,
    isProcessing: false
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
