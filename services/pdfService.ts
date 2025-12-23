import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { PageData } from '../types';

// Handle potential default export structure from ESM CDN or bundler
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Initialize PDF.js worker
try {
  // Use a specific version for the worker to match the installed package (5.4.449)
  if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.449/build/pdf.worker.min.js`;
  }
} catch (e) {
  console.error("Failed to set PDF worker source", e);
}

// Helper: Convert any image to safe JPEG bytes for PDF embedding
// This handles WebP, HEIC (if browser supports), and ensures clean headers
const convertToJpegBytes = async (imageUrl: string): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Only set crossOrigin if strictly necessary (e.g. not data uri) to avoid tainting local blobs unnecessarily
    if (!imageUrl.startsWith('data:')) {
        img.crossOrigin = "anonymous";
    }

    // Safety timeout to prevent infinite hanging if image never loads
    const timeoutId = setTimeout(() => {
        reject(new Error("Image load timed out"));
    }, 5000);

    img.onload = () => {
      clearTimeout(timeoutId);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context missing'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
            reject(new Error('Blob creation failed'));
            return;
        }
        blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer))).catch(reject);
      }, 'image/jpeg', 0.9);
    };

    img.onerror = (e) => {
        clearTimeout(timeoutId);
        console.error("Image load error", e);
        reject(new Error('Image load failed during conversion'));
    };
    
    img.src = imageUrl;
  });
};

export const convertPdfToImages = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Use the resolved pdfjs object to get the document
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });

  // Add timeout protection against hanging worker
  const pdf = await Promise.race([
      loadingTask.promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("PDF worker timed out")), 15000))
  ]) as any;

  const imageUrls: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // High scale for better quality
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) continue;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // render task
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    
    // Cast to any to bypass strict type checking if types mismatch between local definitions and CDN
    await page.render(renderContext as any).promise;

    const imageUrl = canvas.toDataURL('image/jpeg', 0.8);
    imageUrls.push(imageUrl);
  }

  return imageUrls;
};

export const generatePdfFromPages = async (pages: PageData[]): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();

  for (const page of pages) {
    const sourceUrl = page.croppedUrl || page.originalUrl;
    let pdfImage;

    // Try direct embedding first (Fastest)
    try {
        const imageBytes = await fetch(sourceUrl).then((res) => res.arrayBuffer());
        try {
            pdfImage = await pdfDoc.embedJpg(imageBytes);
        } catch (e) {
            // If JPG fails, try PNG
            try {
                pdfImage = await pdfDoc.embedPng(imageBytes);
            } catch (e2) {
                // If both fail, throw to trigger fallback
                throw new Error("Format not supported directly");
            }
        }
    } catch (directError) {
        // Fallback: Convert to JPEG using Canvas (Robust)
        // This fixes issues with WebP, or images with weird headers
        try {
            const safeBytes = await convertToJpegBytes(sourceUrl);
            pdfImage = await pdfDoc.embedJpg(safeBytes);
        } catch (fallbackError) {
             console.error("Failed to embed image:", fallbackError);
             continue; // Skip this page if it's completely unreadable
        }
    }

    if (!pdfImage) continue;

    const pageDims = pdfImage.scale(1);
    const pdfPage = pdfDoc.addPage([pageDims.width, pageDims.height]);
    pdfPage.drawImage(pdfImage, {
      x: 0,
      y: 0,
      width: pageDims.width,
      height: pageDims.height,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
};

export const downloadPdf = (data: Uint8Array, filename: string) => {
  const blob = new Blob([data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  
  // Appending to body is required for Firefox and some other browsers
  document.body.appendChild(a);
  a.click();
  
  // Robust cleanup: Delay removal significantly to allow download to register
  setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      window.URL.revokeObjectURL(url);
  }, 2000);
};

// Helper to crop an image on client side before sending to PDF or displaying
export const cropImage = (imageSrc: string, pixelCrop: { x: number, y: number, width: number, height: number }): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    // Ensure crossOrigin is anonymous for local blob/data urls if needed
    if (!imageSrc.startsWith('data:')) {
        image.setAttribute('crossOrigin', 'anonymous');
    }
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No context'));
        return;
      }

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    image.onerror = (e) => reject(e);
  });
};

export const getImageDimensions = (url: string): Promise<{width: number, height: number}> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (!url.startsWith('data:')) {
            img.crossOrigin = "anonymous";
        }
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = reject;
        img.src = url;
    });
};