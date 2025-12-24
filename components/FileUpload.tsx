import React, { useCallback, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, AlertCircle, X } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragging to false if we're leaving the main container
    // checks if the related target (element entered) is outside the current target
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setErrorMessage(null);

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 0) return;

      const validFiles: File[] = [];
      const invalidFiles: string[] = [];

      droppedFiles.forEach(file => {
        // Robust check for PDF and Images
        if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
          validFiles.push(file);
        } else {
          invalidFiles.push(file.name);
        }
      });

      if (invalidFiles.length > 0) {
        setErrorMessage(
          `Skipped ${invalidFiles.length} unsupported file${invalidFiles.length > 1 ? 's' : ''} (${invalidFiles.slice(0, 2).join(', ')}${invalidFiles.length > 2 ? '...' : ''}). Only PDF and Image files are supported.`
        );
      }

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [onFilesSelected]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setErrorMessage(null);
      const files = Array.from(e.target.files);
      onFilesSelected(files);
    }
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      className={`w-full max-w-3xl mx-auto h-96 border-4 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer group relative overflow-hidden
        ${
          isDragging
            ? 'border-primary bg-indigo-50 dark:bg-indigo-900/20 scale-[1.01] shadow-xl'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
        }
      `}
    >
      {/* Error Message Toast */}
      {errorMessage && (
        <div 
          className="absolute top-4 left-4 right-4 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg flex items-start gap-3 shadow-md z-30 animate-in slide-in-from-top-2 fade-in duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="flex-1 text-sm font-medium">{errorMessage}</div>
          <button 
            onClick={() => setErrorMessage(null)} 
            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-200 transition-colors p-0.5 rounded-md hover:bg-red-100 dark:hover:bg-red-800/50"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Dragging Overlay Indicator */}
      {isDragging && (
         <div className="absolute inset-0 bg-primary/5 z-20 flex items-center justify-center pointer-events-none">
             <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-200">
                 <Upload className="text-primary w-8 h-8 animate-bounce" />
                 <span className="text-xl font-bold text-primary">Release to Upload</span>
             </div>
         </div>
      )}

      <div className={`relative mb-6 transition-transform duration-300 ${isDragging ? 'scale-110' : 'scale-100'}`}>
        <div className={`absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded-full scale-150 transition-opacity duration-500 ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}></div>
        <Upload className={`w-16 h-16 relative z-10 transition-colors ${isDragging ? 'text-primary' : 'text-primary/80 group-hover:text-primary'}`} />
      </div>
      
      <h3 className={`text-2xl font-bold mb-2 transition-colors ${isDragging ? 'text-primary' : 'text-gray-800 dark:text-gray-100'}`}>
        {isDragging ? 'Drop Files Now' : 'Drag & Drop Files'}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-8 text-center max-w-md px-6 leading-relaxed">
        Upload <span className="font-medium text-gray-700 dark:text-gray-300">PDF documents</span> or <span className="font-medium text-gray-700 dark:text-gray-300">Images</span> (JPG, PNG) to start editing, cropping, and extracting text.
      </p>

      <div className="flex gap-4 z-10" onClick={(e) => e.stopPropagation()}>
        <label className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer font-medium active:scale-95">
            <FileText size={20} />
            <span>Choose PDF</span>
            <input type="file" accept=".pdf" className="hidden" onChange={handleChange} multiple />
        </label>
        
        <label className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm hover:border-primary hover:text-primary dark:hover:text-primary-400 transition-all cursor-pointer font-medium active:scale-95">
            <ImageIcon size={20} />
            <span>Choose Images</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleChange} multiple />
        </label>
      </div>
    </div>
  );
};

export default FileUpload;