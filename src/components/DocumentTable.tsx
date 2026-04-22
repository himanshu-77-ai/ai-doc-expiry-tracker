import React from "react";
import { 
  Search, 
  Filter, 
  ChevronRight, 
  FileText, 
  Clock, 
  AlertTriangle, 
  ShieldCheck,
  Download,
  Trash2,
  Edit,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { Document } from "../types";
import { cn, getDynamicStatus } from "../lib/utils";

interface DocumentTableProps {
  documents: Document[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  onEdit: (doc: Document) => void;
  onDelete: (id: string) => void;
  onView: (doc: Document) => void;
  expiryInterval?: number;
}

export const DocumentTable: React.FC<DocumentTableProps> = ({
  documents,
  searchQuery,
  setSearchQuery,
  filterCategory,
  setFilterCategory,
  onEdit,
  onDelete,
  onView,
  expiryInterval
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Safe': return 'bg-green-50 text-green-600 border-green-100';
      case 'Renewed': return 'bg-green-100 text-green-700 border-green-200';
      case 'Expiring Soon': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Expired': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const categories = ["All", "Identity", "License", "Insurance", "Invoice", "Other"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search documents..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                filterCategory === cat 
                  ? "bg-gray-900 text-white shadow-lg" 
                  : "bg-white text-gray-500 border border-gray-100 hover:border-gray-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Document</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Expiry Date</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documents.map((doc) => {
                const currentStatus = doc.status === 'Renewed' ? 'Renewed' : getDynamicStatus(doc.expiryDate, expiryInterval);
                const statusClasses = getStatusColor(currentStatus);
                
                return (
                  <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        statusClasses, "bg-opacity-10"
                      )}>
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{doc.title}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{doc.documentNumber || 'No Number'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm font-bold text-gray-600">{doc.category}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900">{format(new Date(doc.expiryDate), 'MMM dd, yyyy')}</span>
                      <span className="text-[10px] text-gray-400 font-bold">{format(new Date(doc.expiryDate), 'EEEE')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border",
                      statusClasses
                    )}>
                      {(currentStatus === 'Safe' || currentStatus === 'Renewed') ? <ShieldCheck size={12} /> : currentStatus === 'Expired' ? <AlertTriangle size={12} /> : <Clock size={12} />}
                      {currentStatus}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-end gap-2">
                      {(doc.fileUrl || doc.fileData) && (
                        <button 
                          onClick={() => doc.fileUrl ? window.open(doc.fileUrl, '_blank') : onView(doc)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="View Document"
                        >
                          <ExternalLink size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => onEdit(doc)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => onDelete(doc.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                        <FileText size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-gray-900">No documents found</p>
                        <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
