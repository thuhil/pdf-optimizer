import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-gray-200 dark:border-gray-700 transform transition-all scale-100">
        <div className="p-6 text-center">
            <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 ${isDestructive ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                <AlertTriangle size={28} />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">{title}</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                {message}
            </p>
            
            <div className="flex gap-3">
                <button 
                    onClick={onCancel}
                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
                >
                    {cancelText}
                </button>
                <button 
                    onClick={onConfirm}
                    className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium shadow-md transition-all active:scale-95 outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                        isDestructive 
                        ? 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 focus:ring-red-500' 
                        : 'bg-primary hover:bg-indigo-700 focus:ring-primary'
                    }`}
                >
                    {confirmText}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;