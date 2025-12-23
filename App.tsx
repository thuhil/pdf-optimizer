import React, { useState, useEffect, useCallback } from 'react';
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
  Maximize2,
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
  
  // Derived state for rendering
  const pages = history[historyIndex];

  // Helper to push new state to history
  const pushHistory = (newPages: PageData[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newPages);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = useCallback(() => {
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          if (history[newIndex].length === 0) {
              setAppState(AppState.UPLOAD);
          } else {
              setAppState(AppState.EDITOR);
          }
      }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
      if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          if (history[newIndex].length > 0) {
              setAppState(AppState.EDITOR);
          }
      }
  }, [historyIndex, history]);

  // Modals
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [ocrTargetId, setOcrTargetId] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<string>('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  // Table Extraction State
  const [tableTargetId, setTableTargetId] = useState<string | null>(null);
  const [tableResult, setTableResult] = useState<string>('');
  const [isTableLoading, setIsTableLoading] = useState(false);

  // Auto Crop All State
  const [isAutoCroppingAll, setIsAutoCroppingAll] = useState(false);

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (appState !== AppState.EDITOR) return;
          if (cropTargetId || ocrTargetId || tableTargetId) return;

          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
              e.preventDefault();
              if (e.shiftKey) {
                  handleRedo();
              } else {
                  handleUndo();
              }
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
              e.preventDefault();
              handleRedo();
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState, cropTargetId, ocrTargetId, tableTargetId, handleUndo, handleRedo]);


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
      
      const updatedPages = [...pages, ...newPages];
      pushHistory(updatedPages);
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
    const updatedPages = pages.filter(p => p.id !== id);
    pushHistory(updatedPages);
    if (updatedPages.length === 0) {
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
        
        pushHistory(updatedPages);
        setCropTargetId(null);
    } catch (e) {
        console.error("Crop failed", e);
    }
  };

  // Auto Crop All Handler
  const handleAutoCropAll = async () => {
    if (pages.length === 0) return;
    setIsAutoCroppingAll(true);

    try {
        const updatedPages = await Promise.all(pages.map(async (page) => {
            try {
                // 1. Get Suggestion from Gemini
                const suggestion = await getAutoCropSuggestion(page.originalUrl);
                
                if (!suggestion) return page; // No valid suggestion found, return original

                // 2. Get Dimensions to convert % to pixels
                const dims = await getImageDimensions(page.originalUrl);

                // 3. Calculate Pixel Crop
                const pixelCrop = {
                    x: (suggestion.x / 100) * dims.width,
                    y: (suggestion.y / 100) * dims.height,
                    width: (suggestion.width / 100) * dims.width,
                    height: (suggestion.height / 100) * dims.height,
                };

                // 4. Crop Image
                const croppedUrl = await cropImage(page.originalUrl, pixelCrop);

                return {
                    ...page,
                    croppedUrl: croppedUrl,
                    crop: suggestion
                };

            } catch (err) {
                console.error(`Failed to auto-crop page ${page.id}`, err);
                return page; // Return original on error
            }
        }));

        pushHistory(updatedPages);

    } catch (e) {
        console.error("Auto Crop All Failed", e);
        alert("Some pages could not be auto-cropped.");
    } finally {
        setIsAutoCroppingAll(false);
    }
  };

  // OCR Handlers
  const handleOpenOCR = async (id: string) => {
    const page = pages.find(p => p.id === id);
    if (!page) return;
    
    if (page.ocrText) {
        setOcrResult(page.ocrText);
        setOcrTargetId(id);
        return;
    }

    setIsOcrLoading(true);
    const imageToUse = page.croppedUrl || page.originalUrl;
    
    try {
        // Set loading target to show spinner on specific button
        setOcrTargetId(id); 
        
        const text = await extractTextWithOCR(imageToUse);
        setOcrResult(text);
        
        const updatedPages = pages.map(p => p.id === id ? { ...p, ocrText: text } : p);
        pushHistory(updatedPages);
        
    } catch (e) {
        alert("OCR Failed");
        setOcrTargetId(null);
    } finally {
        setIsOcrLoading(false);
    }
  };

  // Table Extraction Handler
  const handleExtractTable = async (id: string) => {
    const page = pages.find(p => p.id === id);
    if (!page) return;

    setIsTableLoading(true);
    setTableTargetId(id); // used to show loading state

    const imageToUse = page.croppedUrl || page.originalUrl;

    try {
        const csv = await extractTableData(imageToUse);
        
        if (!csv || csv.includes("NO_TABLES") || csv === "ERROR") {
            alert("No tables were detected in this image.");
            setTableTargetId(null);
        } else {
            setTableResult(csv);
        }
    } catch (e) {
        console.error("Table extraction failed", e);
        alert("Failed to extract table.");
        setTableTargetId(null);
    } finally {
        setIsTableLoading(false);
    }
  };

  // Export
  const handleExportPdf = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    try {
        const pdfBytes = await generatePdfFromPages(pages);
        if (pdfBytes.length > 0) {
            downloadPdf(pdfBytes, 'modified_document.pdf');
        } else {
            alert("Generated PDF is empty. Please ensure images are valid.");
        }
    } catch (e) {
        console.error("Export Error:", e);
        alert("Failed to generate PDF. Check console for details.");
    } finally {
        setIsProcessing(false);
    }
  };

  const reset = () => {
    setHistory([[]]);
    setHistoryIndex(0);
    setAppState(AppState.UPLOAD);
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
                <div className="flex items-center gap-1 mr-2 border-r pr-2 border-gray-300">
                    <button 
                        onClick={handleUndo} 
                        disabled={historyIndex === 0 || isProcessing || isAutoCroppingAll}
                        className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors rounded-lg hover:bg-gray-100"
                        title="Undo (Ctrl+Z)"
                    >
                        <RotateCcw size={18} />
                    </button>
                    <button 
                        onClick={handleRedo}
                        disabled={historyIndex === history.length - 1 || isProcessing || isAutoCroppingAll}
                        className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors rounded-lg hover:bg-gray-100"
                        title="Redo (Ctrl+Y)"
                    >
                        <RotateCw size={18} />
                    </button>
                </div>

                <button onClick={reset} className="text-sm font-medium text-gray-500 hover:text-red-500 transition px-3 py-2">
                    Start Over
                </button>
                
                <button 
                    onClick={handleAutoCropAll}
                    disabled={isAutoCroppingAll || isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isAutoCroppingAll ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                    <span className="hidden sm:inline">{isAutoCroppingAll ? 'Processing...' : 'Auto Crop All'}</span>
                </button>

                <button 
                    onClick={handleExportPdf}
                    disabled={isProcessing || isAutoCroppingAll}
                    className="flex items-center gap-2 bg-primary hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-medium shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Download size={18} />}
                    {isProcessing ? 'Processing...' : 'Export PDF'}
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
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20 ${isAutoCroppingAll ? 'pointer-events-none opacity-80' : ''}`}>
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
                            <div className="p-3 bg-white border-t flex justify-around items-center gap-1">
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

                                <button 
                                    onClick={() => handleExtractTable(page.id)}
                                    className="p-2 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded-lg transition-colors"
                                    title="Extract Table to Excel"
                                >
                                    {isTableLoading && tableTargetId === page.id ? (
                                        <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                        <TableIcon size={18} />
                                    )}
                                </button>

                                <div className="w-px h-6 bg-gray-200 mx-1"></div>
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
      
      {tableTargetId && !isTableLoading && tableResult && (
        <TableModal 
            csvData={tableResult}
            onClose={() => {
                setTableTargetId(null);
                setTableResult('');
            }}
        />
      )}
    </div>
  );
}

export default App;