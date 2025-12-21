export interface PageData {
  id: string;
  originalUrl: string; // The source image (blob url)
  croppedUrl?: string; // The edited version (blob url)
  thumbnailUrl?: string; // Small preview
  crop?: CropArea; // Saved crop state
  ocrText?: string; // Extracted text
  isProcessing?: boolean;
}

export interface CropArea {
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
}

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  EDITOR = 'EDITOR',
  PREVIEW = 'PREVIEW'
}

export interface AutoCropResult {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] standard Gemini detection
  label?: string;
}
