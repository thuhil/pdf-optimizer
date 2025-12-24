import React, { useState } from 'react';
import { X, Download, FileDown, Settings2, FileText, Loader2 } from 'lucide-react';

interface ExportModalProps {
  onClose: () => void;
  onExport: (filename: string, quality: number) => void;
  isProcessing: boolean;
}

const ExportModal: React.FC<ExportModalProps> = ({ onClose, onExport, isProcessing }) => {
  const [filename, setFilename] = useState('document_architect.pdf');
  const [quality, setQuality] = useState(0.8);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalName = filename.trim();
    if (!finalName.toLowerCase().endsWith('.pdf')) {
        finalName += '.pdf';
    }
    onExport(finalName, quality);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FileDown className="text-primary" size={24} />
                Export PDF
            </h3>
            <button onClick={onClose} disabled={isProcessing} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                <X size={24} />
            </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            {/* Filename Input */}
            <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FileText size={16} />
                    Filename
                </label>
                <input 
                    type="text" 
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    placeholder="document.pdf"
                    required
                />
            </div>

            {/* Quality Slider */}
            <div className="space-y-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Settings2 size={16} />
                        Image Quality
                    </label>
                    <span className="text-sm font-mono font-medium text-primary bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded">
                        {Math.round(quality * 100)}%
                    </span>
                </div>
                
                <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={quality}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                    <span>Low Size</span>
                    <span>High Quality</span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                <button 
                    type="button" 
                    onClick={onClose}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                    Cancel
                </button>
                <button 
                    type="submit" 
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                >
                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                    {isProcessing ? 'Exporting...' : 'Export'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ExportModal;