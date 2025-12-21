import React, { useCallback } from 'react';
import { Upload, FileText, Image as ImageIcon } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFilesSelected(files);
    },
    [onFilesSelected]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="w-full max-w-3xl mx-auto h-96 border-4 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center bg-white hover:bg-gray-50 transition-colors cursor-pointer group"
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-blue-100 rounded-full scale-150 opacity-0 group-hover:opacity-50 transition-opacity duration-500"></div>
        <Upload className="w-16 h-16 text-primary relative z-10" />
      </div>
      
      <h3 className="text-2xl font-bold text-gray-800 mb-2">Drag & Drop Files</h3>
      <p className="text-gray-500 mb-8 text-center max-w-md">
        Upload PDF documents or Images (JPG, PNG) to start editing, cropping, and extracting text.
      </p>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer font-medium">
            <FileText size={20} />
            <span>Choose PDF</span>
            <input type="file" accept=".pdf" className="hidden" onChange={handleChange} multiple />
        </label>
        
        <label className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-lg shadow-sm hover:border-primary hover:text-primary transition-all cursor-pointer font-medium">
            <ImageIcon size={20} />
            <span>Choose Images</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleChange} multiple />
        </label>
      </div>
    </div>
  );
};

export default FileUpload;
