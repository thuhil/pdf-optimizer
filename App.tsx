import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  Trash2, 
  Crop, 
  Type, 
  Download, 
  Plus, 
  FileCheck,
  ArrowLeft,
  Loader2,
  Maximize2
} from 'lucide-react';

import FileUpload from './components/FileUpload';
import CropModal from './components/CropModal';
import OCRModal from './components/OCRModal';
import { convertPdfToImages, cropImage, generatePdfFromPages, downloadPdf } from './services/pdfService';
import { extractTextWithOCR } from './services/geminiService';
import { PageData, AppState, PixelCrop, CropArea } from './types';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [pages, setPages] = useState<PageData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  
  // Modals
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [ocrTargetId, setOcrTargetId] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<string>('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  // Handle Files Input
  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true);
    const newPages: PageData[] = [];

    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          const imageUrls = await convertPdfToImages(file);
          imageUrls.forEach(url => {
            newPages.push({
              id: uuidv4(),
              originalUrl: url,
            });
          });
        } else if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          newPages.push({
            id: uuidv4(),
            originalUrl: url,
          });
        }
      }
      
      setPages(prev => [...prev, ...newPages]);
      setAppState(AppState.EDITOR);
    } catch (error) {
      console.error("Error processing files", error);
      alert("Error processing files. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Page
  const handleDeletePage = (id: string) => {
    setPages(prev => prev.filter(p => p.id !== id));
    if (pages.length <= 1) {
        setAppState(AppState.UPLOAD);
    }
  };

  // Crop Handlers
  const handleOpenCrop = (id: string) => {
    setCropTargetId(id);
  };

  const handleConfirmCrop = async (pixelCrop: PixelCrop, percentCrop: CropArea) => {
    if (!cropTargetId) return;
    
    // Find page
    const pageIndex = pages.findIndex(p => p.id === cropTargetId);
    if (pageIndex === -1) return;
    
    const page = pages[pageIndex];
    
    try {
        const croppedUrl = await cropImage(page.originalUrl, pixelCrop);
        
        const updatedPages = [...pages];
        updatedPages[pageIndex] = {
            ...page,
            croppedUrl: croppedUrl,
            crop: percentCrop
        };
        
        setPages(updatedPages);
        setCropTargetId(null);
    } catch (e) {
        console.error("Crop failed", e);
    }
  };

  // OCR Handlers
  const handleOpenOCR = async (id: string) => {
    const page = pages.find(p => p.id === id);
    if (!page) return;
    
    // If we already have OCR text, just show it. 
    // Usually OCR is expensive/slow so we might want to cache it.
    if (page.ocrText) {
        setOcrResult(page.ocrText);
        setOcrTargetId(id);
        return;
    }

    setIsOcrLoading(true);
    // Determine which image to use (cropped or original)
    const imageToUse = page.croppedUrl || page.originalUrl;
    
    try {
        // Optimistically show modal with loading state?
        // Or show loader on button? Let's show loader on button mostly, but here we block.
        setOcrTargetId(id); // Open modal but show loading inside? 
        // Better: Wait for text then show modal.
        
        const text = await extractTextWithOCR(imageToUse);
        setOcrResult(text);
        
        // Save to state
        setPages(prev => prev.map(p => p.id === id ? { ...p, ocrText: text } : p));
        
    } catch (e) {
        alert("OCR Failed");
        setOcrTargetId(null);
    } finally {
        setIsOcrLoading(false);
    }
  };

  // Export
  const handleExportPdf = async () => {
    setIsProcessing(true);
    try {
        const pdfBytes = await generatePdfFromPages(pages);
        downloadPdf(pdfBytes, 'modified_document.pdf');
    } catch (e) {
        console.error(e);
        alert("Failed to generate PDF");
    } finally {
        setIsProcessing(false);
    }
  };

  const reset = () => {
    if(confirm("Are you sure? All changes will be lost.")) {
        setPages([]);
        setAppState(AppState.UPLOAD);
    }
  }

  // --- RENDER ---

  const cropTargetPage = pages.find(p => p.id === cropTargetId);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="text-primary" />
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">Gemini PDF Architect</h1>
          </div>
          
          {appState === AppState.EDITOR && (
             <div className="flex items-center gap-3">
                <button onClick={reset} className="text-sm font-medium text-gray-500 hover:text-red-500 transition px-3 py-2">
                    Start Over
                </button>
                <button 
                    onClick={handleExportPdf}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-primary hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-medium shadow-md transition-all active:scale-95 disabled:opacity-70"
                >
                    {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Download size={18} />}
                    Export PDF
                </button>
             </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto h-full">
            
            {appState === AppState.UPLOAD && (
                <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] animate-in fade-in zoom-in duration-500">
                     {isProcessing ? (
                        <div className="text-center">
                            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4"/>
                            <p className="text-lg text-gray-600">Processing Documents...</p>
                        </div>
                     ) : (
                        <FileUpload onFilesSelected={handleFilesSelected} />
                     )}
                </div>
            )}

            {appState === AppState.EDITOR && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                    {pages.map((page, index) => (
                        <div key={page.id} className="group relative bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-200 overflow-hidden flex flex-col">
                            {/* Image Preview */}
                            <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden">
                                <img 
                                    src={page.croppedUrl || page.originalUrl} 
                                    alt={`Page ${index + 1}`}
                                    className="w-full h-full object-contain p-2"
                                />
                                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                                    Page {index + 1}
                                </div>
                                {page.ocrText && (
                                    <div className="absolute top-2 right-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm flex items-center gap-1">
                                        <Type size={10} /> OCR Ready
                                    </div>
                                )}
                            </div>

                            {/* Actions Toolbar */}
                            <div className="p-3 bg-white border-t flex justify-around items-center gap-2">
                                <button 
                                    onClick={() => handleOpenCrop(page.id)}
                                    className="p-2 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded-lg transition-colors tooltip"
                                    title="Crop & Resize"
                                >
                                    <Crop size={18} />
                                </button>
                                <button 
                                    onClick={() => handleOpenOCR(page.id)}
                                    className="p-2 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded-lg transition-colors"
                                    title="Extract Text (AI)"
                                >
                                    {isOcrLoading && ocrTargetId === page.id ? (
                                        <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                        <Type size={18} />
                                    )}
                                </button>
                                <div className="w-px h-6 bg-gray-200"></div>
                                <button 
                                    onClick={() => handleDeletePage(page.id)}
                                    className="p-2 hover:bg-red-50 text-gray-600 hover:text-red-500 rounded-lg transition-colors"
                                    title="Delete Page"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    {/* Add Page Button */}
                    <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-300 rounded-xl hover:border-primary hover:bg-indigo-50/50 transition-all cursor-pointer">
                        <label className="cursor-pointer flex flex-col items-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-white transition-colors">
                                <Plus className="text-gray-400 group-hover:text-primary" />
                            </div>
                            <span className="text-sm font-medium text-gray-500">Add Page</span>
                            <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files && handleFilesSelected(Array.from(e.target.files))} />
                        </label>
                    </div>
                </div>
            )}
        </div>
      </main>

      {/* Modals */}
      {cropTargetId && cropTargetPage && (
        <CropModal 
            imageUrl={cropTargetPage.originalUrl}
            initialCrop={cropTargetPage.crop}
            onConfirm={handleConfirmCrop}
            onCancel={() => setCropTargetId(null)}
        />
      )}

      {ocrTargetId && !isOcrLoading && (
        <OCRModal 
            text={ocrResult}
            onClose={() => setOcrTargetId(null)}
        />
      )}
    </div>
  );
}

export default App;
