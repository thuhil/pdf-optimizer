import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { PageData } from '../types';

// Handle potential default export structure from ESM CDN or bundler
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Initialize PDF.js worker
try {
  if (pdfjs.GlobalWorkerOptions) {
      // Hardcode the worker URL to match your package.json version (5.4.449)
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.449/build/pdf.worker.min.js`;
  }
} catch (e) {
  console.error("Failed to set PDF worker source", e);
}

export const convertPdfToImages = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Use the resolved pdfjs object to get the document
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
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
    // If croppedUrl exists, use it, otherwise use originalUrl
    const sourceUrl = page.croppedUrl || page.originalUrl;
    const imageBytes = await fetch(sourceUrl).then((res) => res.arrayBuffer());
    
    let pdfImage;
    // We try embedding as JPG first (most common for photos/scans)
    try {
        pdfImage = await pdfDoc.embedJpg(imageBytes);
    } catch (e) {
        // Fallback to PNG if JPG embedding fails
        try {
            pdfImage = await pdfDoc.embedPng(imageBytes);
        } catch (e2) {
             console.error("Failed to embed image", e2);
             continue;
        }
    }

    const pageDims = pdfImage.scale(1);
    // Add page matching image dimensions
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
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

// Helper to crop an image on client side before sending to PDF or displaying
export const cropImage = (imageSrc: string, pixelCrop: { x: number, y: number, width: number, height: number }): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    // Ensure crossOrigin is anonymous for local blob/data urls if needed
    image.setAttribute('crossOrigin', 'anonymous');
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