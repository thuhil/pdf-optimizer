import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  RotateCw,
  Sun,
  Moon,
  Check,
  X,
  LayoutGrid
} from 'lucide-react';

import FileUpload from './components/FileUpload';
import CropModal from './components/CropModal';
import OCRModal from './components/OCRModal';
import TableModal from './components/TableModal';
import MultiTableModal, { TableExtractionResult } from './components/MultiTableModal';
import ExportModal from './components/ExportModal';
import ConfirmModal from './components/ConfirmModal';
import { convertPdfToImages, cropImage, generatePdfFromPages, downloadPdf, getImageDimensions } from './services/pdfService';
import { extractTextWithOCR, extractTableData, getAutoCropSuggestion } from './services/geminiService';
import { PageData, AppState, PixelCrop, CropArea } from './types';

type GridSize = 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [isProcessing, setIsProcessing] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Grid Size State
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);

  // History Management
  const [history, setHistory] = useState<PageData[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const pages = history[historyIndex];

  // Theme initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Grid Size Initialization
  useEffect(() => {
    const savedGrid = localStorage.getItem('gridSize');
    if (savedGrid && ['extra-small', 'small', 'medium', 'large', 'extra-large'].includes(savedGrid)) {
        setGridSize(savedGrid as GridSize);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleGridChange = (size: GridSize) => {
      setGridSize(size);
      localStorage.setItem('gridSize', size);
      setIsGridMenuOpen(false);
  };

  const getGridClass = () => {
      switch(gridSize) {
          case 'extra-small': return "grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3";
          case 'small': return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4";
          case 'medium': return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6";
          case 'large': return "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6";
          case 'extra-large': return "grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-8";
          default: return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6";
      }
  };

  // TRACKING BLOBS: Use a ref to track all created blobs for safe cleanup on unmount
  const createdBlobsRef = useRef<Set<string>>(new Set());

  const registerBlob = (url: string) => {
      if (url.startsWith('blob:')) {
          createdBlobsRef.current.add(url);
      }
      return url;
  };

  // Robust Cleanup: Only run when the component unmounts
  useEffect(() => {
    return () => {
        createdBlobsRef.current.forEach(url => URL.revokeObjectURL(url));
        createdBlobsRef.current.clear();
    };
  }, []);

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

  // Multi-Table State
  const [multiTableResults, setMultiTableResults] = useState<TableExtractionResult[] | null>(null);
  const [isMultiTableLoading, setIsMultiTableLoading] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isAutoCroppingAll, setIsAutoCroppingAll] = useState(false);

  // Helper to check for pending crops
  const hasPendingCrops = pages.some(p => p.crop && !p.croppedUrl);

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (appState !== AppState.EDITOR) return;
          if (cropTargetId || ocrTargetId || tableTargetId || isExportModalOpen || isResetModalOpen || multiTableResults) return;

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
  }, [appState, cropTargetId, ocrTargetId, tableTargetId, isExportModalOpen, isResetModalOpen, multiTableResults, handleUndo, handleRedo]);


  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true);
    const newPages: PageData[] = [];

    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          const imageUrls = await convertPdfToImages(file);
          imageUrls.forEach(url => {
            newPages.push({ id: uuidv4(), originalUrl: registerBlob(url) });
          });
        } else if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          newPages.push({ id: uuidv4(), originalUrl: registerBlob(url) });
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

  const handleConfirmCrop = async (pixelCrop: PixelCrop, percentCrop: CropArea, quality: number) => {
    if (!cropTargetId) return;
    const pageIndex = pages.findIndex(p => p.id === cropTargetId);
    if (pageIndex === -1) return;
    
    const page = pages[pageIndex];
    try {
        const croppedUrl = await cropImage(page.originalUrl, pixelCrop, quality);
        
        const updatedPages = [...pages];
        updatedPages[pageIndex] = {
            ...page,
            croppedUrl: registerBlob(croppedUrl),
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
                
                // Set the suggestion but do NOT apply the crop yet (clear croppedUrl if exists)
                // This puts the page in "pending review" state
                return { ...page, crop: suggestion, croppedUrl: undefined };
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

  const handleApplyCrops = async () => {
    setIsProcessing(true);
    try {
        const updatedPages = await Promise.all(pages.map(async (page) => {
            if (page.crop && !page.croppedUrl) {
                try {
                    const dims = await getImageDimensions(page.originalUrl);
                    const pixelCrop = {
                        x: (page.crop.x / 100) * dims.width,
                        y: (page.crop.y / 100) * dims.height,
                        width: (page.crop.width / 100) * dims.width,
                        height: (page.crop.height / 100) * dims.height,
                    };
                    const croppedUrl = await cropImage(page.originalUrl, pixelCrop, 0.9);
                    return { ...page, croppedUrl: registerBlob(croppedUrl) };
                } catch (e) {
                    console.error(`Failed to crop page ${page.id}`, e);
                    return page;
                }
            }
            return page;
        }));
        pushHistory(updatedPages);
    } catch(e) {
        console.error("Apply crops failed", e);
        alert("Failed to apply some crops.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDiscardCrops = () => {
     const updatedPages = pages.map(page => {
        if (page.crop && !page.croppedUrl) {
            return { ...page, crop: undefined }; // Remove the suggestion, revert to original
        }
        return page;
    });
    pushHistory(updatedPages);
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

  const handleExtractAllTables = async () => {
    if (pages.length === 0) return;
    setIsMultiTableLoading(true);
    
    try {
        const results: TableExtractionResult[] = await Promise.all(pages.map(async (page, index) => {
            const imageToUse = page.croppedUrl || page.originalUrl;
            try {
                const csv = await extractTableData(imageToUse);
                
                if (csv === "ERROR") {
                    return { pageId: page.id, pageNumber: index + 1, status: 'error', csvData: null };
                }
                if (!csv || csv.includes("NO_TABLES")) {
                    return { pageId: page.id, pageNumber: index + 1, status: 'no_table', csvData: null };
                }

                return { pageId: page.id, pageNumber: index + 1, status: 'success', csvData: csv };

            } catch (e) {
                return { pageId: page.id, pageNumber: index + 1, status: 'error', csvData: null };
            }
        }));
        
        setMultiTableResults(results);

    } catch (e) {
        console.error("Bulk table extraction failed", e);
        alert("Failed to process tables.");
    } finally {
        setIsMultiTableLoading(false);
    }
  };

  const handleOpenExport = () => {
      if (pages.length === 0) return;
      setIsExportModalOpen(true);
  };

  const handleFinalExport = async (filename: string, quality: number) => {
    setIsProcessing(true);
    try {
        const pdfBytes = await generatePdfFromPages(pages, quality);
        if (pdfBytes.length > 0) {
            downloadPdf(pdfBytes, filename);
            setIsExportModalOpen(false);
        }
    } catch (e) {
        console.error("Export error:", e);
        alert("Failed to export PDF.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleResetRequest = () => {
    setIsResetModalOpen(true);
  };

  const handleResetConfirm = () => {
      createdBlobsRef.current.forEach(url => URL.revokeObjectURL(url));
      createdBlobsRef.current.clear();
      
      setHistory([[]]);
      setHistoryIndex(0);
      setAppState(AppState.UPLOAD);
      setIsResetModalOpen(false);
  };

  const cropTargetPage = pages.find(p => p.id === cropTargetId);

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="text-primary" />
            <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">Gemini PDF Architect</h1>
          </div>
          <div className="flex items-center gap-3">
             {appState === AppState.EDITOR && (
                 <div className="relative">
                    <button
                        onClick={() => setIsGridMenuOpen(!isGridMenuOpen)}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Change Grid Size"
                    >
                        <LayoutGrid size={20} />
                    </button>
                    {isGridMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsGridMenuOpen(false)}></div>
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 py-1 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                                {['extra-small', 'small', 'medium', 'large', 'extra-large'].map((size) => (
                                    <button
                                        key={size}
                                        onClick={() => handleGridChange(size as GridSize)}
                                        className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors
                                            ${gridSize === size ? 'text-primary font-medium bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
                                        `}
                                    >
                                        <span className="capitalize">{size.replace('-', ' ')}</span>
                                        {gridSize === size && <Check size={14} />}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                 </div>
             )}
             <button onClick={toggleTheme} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
             </button>
             {appState === AppState.EDITOR && (
                 <>
                    <div className="flex items-center gap-1 mr-2 border-r pr-2 border-gray-300 dark:border-gray-600">
                        <button onClick={handleUndo} disabled={historyIndex === 0 || isProcessing || isAutoCroppingAll || isMultiTableLoading} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white disabled:opacity-30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Undo (Ctrl+Z)"><RotateCcw size={18} /></button>
                        <button onClick={handleRedo} disabled={historyIndex === history.length - 1 || isProcessing || isAutoCroppingAll || isMultiTableLoading} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white disabled:opacity-30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Redo (Ctrl+Y)"><RotateCw size={18} /></button>
                    </div>
                    <button onClick={handleResetRequest} className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition px-3 py-2">Start Over</button>
                    
                    {hasPendingCrops ? (
                        <div className="flex items-center gap-2 animate-in fade-in duration-300">
                             <button onClick={handleDiscardCrops} disabled={isProcessing} className="flex items-center gap-1 px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg font-medium transition-colors border border-red-200 dark:border-red-800">
                                <X size={16} />
                                <span className="hidden sm:inline">Discard</span>
                            </button>
                            <button onClick={handleApplyCrops} disabled={isProcessing} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-sm animate-pulse-once">
                                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                <span>Apply Crops</span>
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleAutoCropAll} disabled={isAutoCroppingAll || isProcessing || isMultiTableLoading} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg font-medium transition-colors disabled:opacity-50">
                            {isAutoCroppingAll ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                            <span className="hidden sm:inline">{isAutoCroppingAll ? 'Scanning...' : 'Auto Crop All'}</span>
                        </button>
                    )}

                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

                    <button 
                        onClick={handleExtractAllTables} 
                        disabled={isProcessing || isAutoCroppingAll || hasPendingCrops || isMultiTableLoading} 
                        className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 px-3 py-2 rounded-lg font-medium shadow-sm transition-all active:scale-95 disabled:opacity-70"
                        title="Scan all pages for tables"
                    >
                        {isMultiTableLoading ? <Loader2 className="animate-spin" size={18} /> : <TableIcon size={18} />}
                        <span className="hidden xl:inline">Scan Tables</span>
                    </button>

                    <button onClick={handleOpenExport} disabled={isProcessing || isAutoCroppingAll || hasPendingCrops || isMultiTableLoading} className="flex items-center gap-2 bg-primary hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-medium shadow-md transition-all active:scale-95 disabled:opacity-70">
                        {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Download size={18} />}
                        {isProcessing ? 'Processing...' : 'Export PDF'}
                    </button>
                 </>
             )}
          </div>
        </div>
      </header>

      <main className="flex-1 bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-200">
        <div className="max-w-7xl mx-auto h-full">
            {appState === AppState.UPLOAD && (
                <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] animate-in fade-in duration-500">
                     {isProcessing ? (
                        <div className="text-center">
                            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4"/>
                            <p className="text-lg text-gray-600 dark:text-gray-300">Preparing Workspace...</p>
                        </div>
                     ) : (
                        <FileUpload onFilesSelected={handleFilesSelected} />
                     )}
                </div>
            )}
            {appState === AppState.EDITOR && (
                <div className={`grid ${getGridClass()} pb-20 ${isAutoCroppingAll || isMultiTableLoading ? 'pointer-events-none opacity-80' : ''}`}>
                    {pages.map((page, index) => (
                        <div key={page.id} className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col relative">
                            <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-900 relative overflow-hidden">
                                <img src={page.croppedUrl || page.originalUrl} alt={`Page ${index + 1}`} className="w-full h-full object-contain" />
                                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md z-20">Page {index + 1}</div>
                                {page.ocrText && <div className="absolute top-2 right-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 z-20"><Type size={10} /> OCR</div>}
                                
                                {/* Suggestion Overlay */}
                                {page.crop && !page.croppedUrl && (
                                    <div 
                                        className="absolute border-2 border-primary border-dashed bg-primary/20 z-10 pointer-events-none transition-all duration-300"
                                        style={{
                                            left: `${page.crop.x}%`,
                                            top: `${page.crop.y}%`,
                                            width: `${page.crop.width}%`,
                                            height: `${page.crop.height}%`
                                        }}
                                    >
                                        <div className="absolute -top-6 right-0 bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">AI Suggestion</div>
                                    </div>
                                )}
                            </div>
                            <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around items-center gap-1 z-20">
                                <button onClick={() => handleOpenCrop(page.id)} className={`p-2 rounded-lg transition-colors ${page.crop && !page.croppedUrl ? 'text-primary bg-primary/10 hover:bg-primary/20 ring-1 ring-primary' : 'text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700'}`} title="Crop">
                                    <Crop size={18} />
                                </button>
                                <button onClick={() => handleOpenOCR(page.id)} className="p-2 hover:bg-indigo-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors" title="OCR">
                                    {isOcrLoading && ocrTargetId === page.id ? <Loader2 className="animate-spin" size={18} /> : <Type size={18} />}
                                </button>
                                <button onClick={() => handleExtractTable(page.id)} className="p-2 hover:bg-indigo-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors" title="Table">
                                    {isTableLoading && tableTargetId === page.id ? <Loader2 className="animate-spin" size={18} /> : <TableIcon size={18} />}
                                </button>
                                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                                <button onClick={() => handleDeletePage(page.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors" title="Delete"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                    <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-primary dark:hover:border-primary hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer bg-white dark:bg-gray-800">
                        <label className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                                <Plus className="text-gray-400 dark:text-gray-500" />
                            </div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Add Page</span>
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
      {multiTableResults && (
        <MultiTableModal results={multiTableResults} onClose={() => setMultiTableResults(null)} />
      )}
      {isExportModalOpen && (
          <ExportModal onClose={() => setIsExportModalOpen(false)} onExport={handleFinalExport} isProcessing={isProcessing} />
      )}
      {isResetModalOpen && (
        <ConfirmModal
          title="Start Over?"
          message="Are you sure you want to clear all pages and start over? All unsaved progress will be lost."
          onConfirm={handleResetConfirm}
          onCancel={() => setIsResetModalOpen(false)}
          confirmText="Start Over"
          isDestructive={true}
        />
      )}
    </div>
  );
}

export default App;