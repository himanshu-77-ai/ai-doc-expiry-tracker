import React from "react";
import { 
  FileText, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit
} from "lucide-react";
import { format } from "date-fns";
import { Document } from "../types";

interface DocumentCardProps {
  doc: Document;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ doc, onClick, onDelete, onEdit }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Safe': return 'bg-green-50 text-green-600 border-green-100';
      case 'Expiring Soon': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Expired': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Safe': return <ShieldCheck size={14} />;
      case 'Expiring Soon': return <Clock size={14} />;
      case 'Expired': return <AlertTriangle size={14} />;
      default: return null;
    }
  };

  return (
    <div 
      onClick={onClick}
      className="group bg-white p-5 rounded-3xl border border-gray-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer relative overflow-hidden"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getStatusColor(doc.status)} bg-opacity-10`}>
          <FileText size={24} className={doc.status === 'Safe' ? 'text-green-600' : doc.status === 'Expired' ? 'text-red-600' : 'text-amber-600'} />
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit size={16} />
          </button>
          <button 
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">{doc.title}</h3>
        <p className="text-xs text-gray-500 font-medium">{doc.category}</p>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Expires On</p>
          <p className="text-sm font-bold text-gray-700">{format(new Date(doc.expiryDate), 'MMM dd, yyyy')}</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight flex items-center gap-1.5 border ${getStatusColor(doc.status)}`}>
          {getStatusIcon(doc.status)}
          {doc.status}
        </div>
      </div>
    </div>
  );
};
