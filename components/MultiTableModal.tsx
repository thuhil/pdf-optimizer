import React from 'react';
import { X, FileSpreadsheet, Layers, FileText, AlertTriangle, CheckCircle, Ban } from 'lucide-react';
import * as XLSX from 'xlsx';

export interface TableExtractionResult {
  pageId: string;
  pageNumber: number;
  status: 'success' | 'no_table' | 'error';
  csvData: string | null;
}

interface MultiTableModalProps {
  results: TableExtractionResult[];
  onClose: () => void;
}

const MultiTableModal: React.FC<MultiTableModalProps> = ({ results, onClose }) => {
  const successfulTables = results.filter(r => r.status === 'success' && r.csvData);
  const failedTables = results.filter(r => r.status === 'error');
  const noTables = results.filter(r => r.status === 'no_table');

  // Helper: Parse CSV string into 2D array
  const parseCSV = (csv: string): string[][] => {
    return csv.trim().split('\n').map(row => row.split(',').map(cell => cell.replace(/^"|"$/g, '').trim()));
  };

  const handleDownloadMultiSheet = () => {
    const wb = XLSX.utils.book_new();
    
    successfulTables.forEach((table) => {
      if (!table.csvData) return;
      const data = parseCSV(table.csvData);
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, `Page ${table.pageNumber}`);
    });

    XLSX.writeFile(wb, 'extracted_tables_multisheet.xlsx');
  };

  const getMergedData = (): string[][] => {
    // 1. Collect all unique headers
    const allHeaders = new Set<string>();
    const tableDataMap: { headers: string[], rows: string[][] }[] = [];

    successfulTables.forEach(table => {
      if (!table.csvData) return;
      const parsed = parseCSV(table.csvData);
      if (parsed.length === 0) return;

      const headers = parsed[0];
      headers.forEach(h => allHeaders.add(h));
      tableDataMap.push({
        headers: headers,
        rows: parsed.slice(1) // Data rows excluding header
      });
    });

    const masterHeaders = Array.from(allHeaders);
    const finalData: string[][] = [masterHeaders];

    // 2. Map existing rows to master headers
    tableDataMap.forEach(table => {
      table.rows.forEach(row => {
        const newRow = masterHeaders.map(header => {
          const index = table.headers.indexOf(header);
          return index !== -1 ? row[index] || '' : ''; // Fill with data or blank
        });
        finalData.push(newRow);
      });
    });

    return finalData;
  };

  const handleDownloadMergedExcel = () => {
    const data = getMergedData();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Merged Data');
    XLSX.writeFile(wb, 'extracted_tables_merged.xlsx');
  };

  const handleDownloadMergedCSV = () => {
    const data = getMergedData();
    const ws = XLSX.utils.aoa_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'extracted_tables_merged.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col m-4 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Layers className="text-primary" size={24} />
                Bulk Table Extraction
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={24} />
            </button>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
            {/* Status Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800 text-center">
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{successfulTables.length}</div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-300 uppercase tracking-wide font-semibold mt-1">Found</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-800 text-center">
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{noTables.length}</div>
                    <div className="text-xs text-amber-700 dark:text-amber-300 uppercase tracking-wide font-semibold mt-1">No Tables</div>
                </div>
                 <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800 text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{failedTables.length}</div>
                    <div className="text-xs text-red-700 dark:text-red-300 uppercase tracking-wide font-semibold mt-1">Errors</div>
                </div>
            </div>

            {/* Detailed List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-500 dark:text-gray-400">
                    Extraction Details
                </div>
                <div className="max-h-48 overflow-y-auto">
                    {results.map((r) => (
                        <div key={r.pageId} className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Page {r.pageNumber}</span>
                            <div className="flex items-center gap-2">
                                {r.status === 'success' && <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full"><CheckCircle size={12}/> Success</span>}
                                {r.status === 'no_table' && <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-full"><Ban size={12}/> No Table</span>}
                                {r.status === 'error' && <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-full"><AlertTriangle size={12}/> Unrecognized</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {failedTables.length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200 mb-6">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <p>Some pages contained data that was not recognizable as a table. These pages will be skipped in the export.</p>
                </div>
            )}

            {successfulTables.length === 0 ? (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    No tables were found to export.
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">Export Options:</p>
                    
                    <button 
                        onClick={handleDownloadMultiSheet}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-primary dark:hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-600 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-md text-green-700 dark:text-green-400 group-hover:text-primary group-hover:bg-indigo-50 dark:group-hover:text-primary-300 dark:group-hover:bg-indigo-900/30 transition-colors">
                                <Layers size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-semibold text-gray-800 dark:text-white">Excel Workbook (Multiple Sheets)</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Creates a separate sheet for each page</div>
                            </div>
                        </div>
                    </button>

                    <button 
                        onClick={handleDownloadMergedExcel}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-primary dark:hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-600 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                             <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-md text-green-700 dark:text-green-400 group-hover:text-primary group-hover:bg-indigo-50 dark:group-hover:text-primary-300 dark:group-hover:bg-indigo-900/30 transition-colors">
                                <FileSpreadsheet size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-semibold text-gray-800 dark:text-white">Merged Excel Sheet</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Combines all data into one sheet, aligning similar headers</div>
                            </div>
                        </div>
                    </button>

                    <button 
                        onClick={handleDownloadMergedCSV}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-primary dark:hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-600 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                             <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded-md text-gray-600 dark:text-gray-300 group-hover:text-primary group-hover:bg-indigo-50 dark:group-hover:text-primary-300 dark:group-hover:bg-indigo-900/30 transition-colors">
                                <FileText size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-semibold text-gray-800 dark:text-white">Merged CSV File</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Combines all data into a single CSV file</div>
                            </div>
                        </div>
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default MultiTableModal;
