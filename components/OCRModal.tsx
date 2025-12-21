import React from 'react';
import { X, Copy, Check } from 'lucide-react';

interface OCRModalProps {
  text: string;
  onClose: () => void;
}

const OCRModal: React.FC<OCRModalProps> = ({ text, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b">
            <h3 className="text-xl font-bold text-gray-800">Extracted Text</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
            </button>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
            <div className="bg-white p-4 rounded-lg border shadow-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono text-sm">
                {text}
            </div>
        </div>

        <div className="p-5 border-t flex justify-end">
            <button 
                onClick={handleCopy}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
            >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy Text'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default OCRModal;
