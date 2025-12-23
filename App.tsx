import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  Trash2, 
  Crop, 
  Type, 
  Download, 
  Plus, 
  FileCheck,
  Loader2,
  Table as TableIcon,
  Sparkles,
  RotateCcw,
  RotateCw
} from 'lucide-react';

import FileUpload from './components/FileUpload';
import CropModal from './components/CropModal';
import OCRModal from './components/OCRModal';
import TableModal from './components/TableModal';
import { convertPdfToImages, cropImage, generatePdfFromPages, downloadPdf, getImageDimensions } from './services/pdfService';
import { extractTextWithOCR, extractTableData, getAutoCropSuggestion } from './services/geminiService';
import { PageData, AppState, PixelCrop, CropArea } from './types';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // History Management
  const [history, setHistory] = useState<PageData[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const pages = history[historyIndex];

  // Revoke blob URLs helper to prevent memory leaks
  const cleanupBlobs = useCallback((pageList: PageData[]) => {
    pageList.forEach(p => {
        if (p.originalUrl.startsWith('blob:')) URL.revokeObjectURL(p.originalUrl);
        if (p.croppedUrl?.startsWith('blob:')) URL.revokeObjectURL(p.croppedUrl);
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
        history.forEach(cleanupBlobs);
    };
  }, [history, cleanupBlobs]);

  const pushHistory = (newPages: PageData[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newPages);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = useCallback(() => {
      if (historyIndex > 0) {
          const nextIndex = historyIndex - 1;
          setHistoryIndex(nextIndex);
          if (history[nextIndex].length === 0) setAppState(AppState.UPLOAD);
      }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
      if (historyIndex < history.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setAppState(AppState.EDITOR);
      }
  }, [historyIndex, history]);

  // Modals
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [ocrTargetId, setOcrTargetId] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<string>('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  const [tableTargetId, setTableTargetId] = useState<string | null>(null);
  const [tableResult, setTableResult] = useState<string>('');
  const [isTableLoading, setIsTableLoading] = useState(false);

  const [isAutoCroppingAll, setIsAutoCroppingAll] = useState(false);

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (appState !== AppState.EDITOR) return;
          if (cropTargetId || ocrTargetId || tableTargetId) return;

          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
              e.preventDefault();
              if (e.shiftKey) handleRedo(); else handleUndo();
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
              e.preventDefault();
              handleRedo();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState, cropTargetId, ocrTargetId, tableTargetId, handleUndo, handleRedo]);


  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true);
    const newPages: PageData[] = [];

    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          const imageUrls = await convertPdfToImages(file);
          imageUrls.forEach(url => {
            newPages.push({ id: uuidv4(), originalUrl: url });
          });
        } else if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          newPages.push({ id: uuidv4(), originalUrl: url });
        }
      }
      pushHistory([...pages, ...newPages]);
      setAppState(AppState.EDITOR);
    } catch (error) {
      console.error("Error processing files", error);
      alert("Error loading documents. Please ensure the file is valid.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePage = (id: string) => {
    const updatedPages = pages.filter(p => p.id !== id);
    pushHistory(updatedPages);
    if (updatedPages.length === 0) setAppState(AppState.UPLOAD);
  };

  const handleOpenCrop = (id: string) => setCropTargetId(id);

  const handleConfirmCrop = async (pixelCrop: PixelCrop, percentCrop: CropArea) => {
    if (!cropTargetId) return;
    const pageIndex = pages.findIndex(p => p.id === cropTargetId);
    if (pageIndex === -1) return;
    
    const page = pages[pageIndex];
    try {
        const croppedUrl = await cropImage(page.originalUrl, pixelCrop);
        // Clean up previous cropped blob for this session if it existed
        if (page.croppedUrl?.startsWith('blob:')) URL.revokeObjectURL(page.croppedUrl);
        
        const updatedPages = [...pages];
        updatedPages[pageIndex] = {
            ...page,
            croppedUrl: croppedUrl,
            crop: percentCrop
        };
        pushHistory(updatedPages);
        setCropTargetId(null);
    } catch (e) {
        console.error("Crop failed", e);
    }
  };

  const handleAutoCropAll = async () => {
    if (pages.length === 0) return;
    setIsAutoCroppingAll(true);
    try {
        const updatedPages = await Promise.all(pages.map(async (page) => {
            try {
                const suggestion = await getAutoCropSuggestion(page.originalUrl);
                if (!suggestion) return page;
                const dims = await getImageDimensions(page.originalUrl);
                const pixelCrop = {
                    x: (suggestion.x / 100) * dims.width,
                    y: (suggestion.y / 100) * dims.height,
                    width: (suggestion.width / 100) * dims.width,
                    height: (suggestion.height / 100) * dims.height,
                };
                const croppedUrl = await cropImage(page.originalUrl, pixelCrop);
                if (page.croppedUrl?.startsWith('blob:')) URL.revokeObjectURL(page.croppedUrl);
                return { ...page, croppedUrl: croppedUrl, crop: suggestion };
            } catch (err) {
                return page;
            }
        }));
        pushHistory(updatedPages);
    } catch (e) {
        alert("Some pages could not be auto-cropped.");
    } finally {
        setIsAutoCroppingAll(false);
    }
  };

  const handleOpenOCR = async (id: string) => {
    const page = pages.find(p => p.id === id);
    if (!page) return;
    if (page.ocrText) {
        setOcrResult(page.ocrText);
        setOcrTargetId(id);
        return;
    }
    setIsOcrLoading(true);
    setOcrTargetId(id);
    const imageToUse = page.croppedUrl || page.originalUrl;
    try {
        const text = await extractTextWithOCR(imageToUse);
        setOcrResult(text);
        const updatedPages = pages.map(p => p.id === id ? { ...p, ocrText: text } : p);
        pushHistory(updatedPages);
    } catch (e) {
        alert("OCR Extraction failed.");
        setOcrTargetId(null);
    } finally {
        setIsOcrLoading(false);
    }
  };

  const handleExtractTable = async (id: string) => {
    const page = pages.find(p => p.id === id);
    if (!page) return;
    setIsTableLoading(true);
    setTableTargetId(id);
    const imageToUse = page.croppedUrl || page.originalUrl;
    try {
        const csv = await extractTableData(imageToUse);
        if (!csv || csv.includes("NO_TABLES") || csv === "ERROR") {
            alert("No table structure detected on this page.");
            setTableTargetId(null);
        } else {
            setTableResult(csv);
        }
    } catch (e) {
        alert("Table extraction failed.");
        setTableTargetId(null);
    } finally {
        setIsTableLoading(false);
    }
  };

  const handleExportPdf = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    try {
        const pdfBytes = await generatePdfFromPages(pages);
        if (pdfBytes.length > 0) downloadPdf(pdfBytes, 'document_architect.pdf');
    } catch (e) {
        alert("Failed to export PDF.");
    } finally {
        setIsProcessing(false);
    }
  };

  const reset = () => {
    if (confirm("Clear all pages and start over?")) {
        history.forEach(cleanupBlobs);
        setHistory([[]]);
        setHistoryIndex(0);
        setAppState(AppState.UPLOAD);
    }
  };

  const cropTargetPage = pages.find(p => p.id === cropTargetId);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="text-primary" />
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">Gemini PDF Architect</h1>
          </div>
          {appState === AppState.EDITOR && (
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 mr-2 border-r pr-2 border-gray-300">
                    <button onClick={handleUndo} disabled={historyIndex === 0 || isProcessing || isAutoCroppingAll} className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-30 rounded-lg hover:bg-gray-100" title="Undo (Ctrl+Z)"><RotateCcw size={18} /></button>
                    <button onClick={handleRedo} disabled={historyIndex === history.length - 1 || isProcessing || isAutoCroppingAll} className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-30 rounded-lg hover:bg-gray-100" title="Redo (Ctrl+Y)"><RotateCw size={18} /></button>
                </div>
                <button onClick={reset} className="text-sm font-medium text-gray-500 hover:text-red-500 transition px-3 py-2">Start Over</button>
                <button onClick={handleAutoCropAll} disabled={isAutoCroppingAll || isProcessing} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium transition-colors disabled:opacity-50">
                    {isAutoCroppingAll ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                    <span className="hidden sm:inline">{isAutoCroppingAll ? 'Processing...' : 'Auto Crop All'}</span>
                </button>
                <button onClick={handleExportPdf} disabled={isProcessing || isAutoCroppingAll} className="flex items-center gap-2 bg-primary hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-medium shadow-md transition-all active:scale-95 disabled:opacity-70">
                    {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Download size={18} />}
                    {isProcessing ? 'Processing...' : 'Export PDF'}
                </button>
             </div>
          )}
        </div>
      </header>

      <main className="flex-1 bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto h-full">
            {appState === AppState.UPLOAD && (
                <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] animate-in fade-in duration-500">
                     {isProcessing ? (
                        <div className="text-center">
                            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4"/>
                            <p className="text-lg text-gray-600">Preparing Workspace...</p>
                        </div>
                     ) : (
                        <FileUpload onFilesSelected={handleFilesSelected} />
                     )}
                </div>
            )}
            {appState === AppState.EDITOR && (
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20 ${isAutoCroppingAll ? 'pointer-events-none opacity-80' : ''}`}>
                    {pages.map((page, index) => (
                        <div key={page.id} className="group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all border border-gray-200 overflow-hidden flex flex-col">
                            <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden">
                                <img src={page.croppedUrl || page.originalUrl} alt={`Page ${index + 1}`} className="w-full h-full object-contain p-2" />
                                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">Page {index + 1}</div>
                                {page.ocrText && <div className="absolute top-2 right-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1"><Type size={10} /> OCR</div>}
                            </div>
                            <div className="p-3 bg-white border-t flex justify-around items-center gap-1">
                                <button onClick={() => handleOpenCrop(page.id)} className="p-2 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded-lg transition-colors" title="Crop"><Crop size={18} /></button>
                                <button onClick={() => handleOpenOCR(page.id)} className="p-2 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded-lg transition-colors" title="OCR">
                                    {isOcrLoading && ocrTargetId === page.id ? <Loader2 className="animate-spin" size={18} /> : <Type size={18} />}
                                </button>
                                <button onClick={() => handleExtractTable(page.id)} className="p-2 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded-lg transition-colors" title="Table">
                                    {isTableLoading && tableTargetId === page.id ? <Loader2 className="animate-spin" size={18} /> : <TableIcon size={18} />}
                                </button>
                                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                                <button onClick={() => handleDeletePage(page.id)} className="p-2 hover:bg-red-50 text-gray-600 hover:text-red-500 rounded-lg transition-colors" title="Delete"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                    <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-300 rounded-xl hover:border-primary hover:bg-indigo-50/50 transition-all cursor-pointer">
                        <label className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                <Plus className="text-gray-400" />
                            </div>
                            <span className="text-sm font-medium text-gray-500">Add Page</span>
                            <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files && handleFilesSelected(Array.from(e.target.files))} />
                        </label>
                    </div>
                </div>
            )}
        </div>
      </main>

      {cropTargetId && cropTargetPage && (
        <CropModal imageUrl={cropTargetPage.originalUrl} initialCrop={cropTargetPage.crop} onConfirm={handleConfirmCrop} onCancel={() => setCropTargetId(null)} />
      )}
      {ocrTargetId && !isOcrLoading && (
        <OCRModal text={ocrResult} onClose={() => setOcrTargetId(null)} />
      )}
      {tableTargetId && !isTableLoading && tableResult && (
        <TableModal csvData={tableResult} onClose={() => { setTableTargetId(null); setTableResult(''); }} />
      )}
    </div>
  );
}

export default App;