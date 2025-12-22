import React from 'react';
import { X, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface TableModalProps {
  csvData: string;
  onClose: () => void;
}

const TableModal: React.FC<TableModalProps> = ({ csvData, onClose }) => {
  
  const handleDownloadCSV = () => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'extracted_table.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // Simple preview parser
  const renderPreview = () => {
    if (!csvData) return <p>No data</p>;
    
    const rows = csvData.trim().split('\n').map(row => {
        // Handle basic CSV parsing (splitting by comma, ignoring quotes for simplicity in preview)
        // For a robust preview, we might use a library, but basic split is okay for a quick check
        // Or better: use XLSX utils to convert to JSON for preview
        return row.split(',').map(cell => cell.replace(/^"|"$/g, ''));
    });

    if (rows.length === 0) return <p>Empty table</p>;

    return (
        <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        {rows[0].map((header, i) => (
                            <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r last:border-r-0">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {rows.slice(1).map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td key={j} className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 border-r last:border-r-0">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b">
            <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-secondary" />
                <h3 className="text-xl font-bold text-gray-800">Extracted Table Data</h3>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
            </button>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
            {renderPreview()}
        </div>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
            <button 
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors"
            >
                <Download size={18} />
                Download CSV
            </button>
            <button 
                onClick={handleDownloadExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm"
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