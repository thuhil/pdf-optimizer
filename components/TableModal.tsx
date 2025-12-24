import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, Copy, Check } from 'lucide-react';
import * as XLSX from 'xlsx';

interface TableModalProps {
  csvData: string;
  onClose: () => void;
}

const TableModal: React.FC<TableModalProps> = ({ csvData, onClose }) => {
  const [copied, setCopied] = useState(false);
  
  const handleDownloadCSV = () => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.setAttribute('download', 'extracted_table.csv');
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
        if (document.body.contains(link)) {
            document.body.removeChild(link);
        }
        window.URL.revokeObjectURL(url);
    }, 2000);
  };

  const handleDownloadExcel = () => {
    try {
        const wb = XLSX.read(csvData, { type: 'string' });
        XLSX.writeFile(wb, 'extracted_table.xlsx');
    } catch (e) {
        console.error("Excel export failed", e);
        alert("Could not generate Excel file. Downloading CSV instead.");
        handleDownloadCSV();
    }
  };

  const handleCopy = async () => {
    try {
        await navigator.clipboard.writeText(csvData);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    } catch (err) {
        console.error("Failed to copy", err);
        alert("Failed to copy to clipboard");
    }
  };

  // Simple preview parser
  const renderPreview = () => {
    if (!csvData) return <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>;
    
    const rows = csvData.trim().split('\n').map(row => {
        // Handle basic CSV parsing (splitting by comma, ignoring quotes for simplicity in preview)
        return row.split(',').map(cell => cell.replace(/^"|"$/g, ''));
    });

    if (rows.length === 0) return <p className="text-gray-500 dark:text-gray-400 text-center py-8">Empty table</p>;

    return (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        {rows[0].map((header, i) => (
                            <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 last:border-r-0">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {rows.slice(1).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            {row.map((cell, j) => (
                                <td key={j} className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col m-4 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg">
                    <FileSpreadsheet className="text-emerald-600 dark:text-emerald-400" size={20} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Extracted Table Data</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={24} />
            </button>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
            {renderPreview()}
        </div>

        <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end gap-3 flex-wrap">
            <button 
                onClick={handleCopy}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg font-medium transition-all shadow-sm ${
                    copied 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400 dark:ring-emerald-900' 
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
                title="Copy raw CSV data to clipboard"
            >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy Table'}
            </button>

            <div className="h-auto w-px bg-gray-300 dark:bg-gray-600 mx-1 hidden sm:block"></div>
            
            <button 
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors shadow-sm"
            >
                <Download size={18} />
                Download CSV
            </button>
            <button 
                onClick={handleDownloadExcel}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
            >
                <FileSpreadsheet size={18} />
                Download Excel
            </button>
        </div>
      </div>
    </div>
  );
};

export default TableModal;