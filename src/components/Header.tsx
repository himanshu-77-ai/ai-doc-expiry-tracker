import React from "react";
import { 
  LayoutDashboard, 
  Download, 
  FileText, 
  Plus 
} from "lucide-react";
import { User } from "../types";

interface HeaderProps {
  user: User;
  setIsSidebarOpen: (open: boolean) => void;
  setIsUploadModalOpen: (open: boolean) => void;
  setManualFormData: (data: any) => void;
  setScannedData: (data: any) => void;
  setSelectedFile: (file: File | null) => void;
  exportToExcel: () => void;
  exportToPDF: () => void;
  docsUsed?: number;
  docLimit?: number;
  plan?: string;
  onUpgradeClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  setIsSidebarOpen,
  setIsUploadModalOpen,
  setManualFormData,
  setScannedData,
  setSelectedFile,
  exportToExcel,
  exportToPDF,
  docsUsed = 0,
  docLimit = 5,
  plan = "free",
  onUpgradeClick
}) => {
  const usagePercent = Math.min((docsUsed / docLimit) * 100, 100);
  const isNearLimit = docsUsed >= docLimit - 1;
  return (
    <header className="h-20 bg-white border-b border-gray-100 px-4 lg:px-12 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-4 lg:hidden">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 hover:bg-gray-50 rounded-xl text-gray-600"
        >
          <LayoutDashboard size={24} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-end gap-3 lg:gap-6">
        <div className="flex items-center gap-2 border-r border-gray-100 pr-3 lg:pr-6">
          <button onClick={exportToExcel} className="p-2.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all" title="Export Excel">
            <Download size={20} />
          </button>
          <button onClick={exportToPDF} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Export PDF">
            <FileText size={20} />
          </button>
        </div>
        
        <button 
          onClick={() => {
            setIsUploadModalOpen(true);
            setManualFormData({
              title: "",
              category: "Other",
              expiryDate: "",
              issueDate: "",
              documentNumber: "",
              summary: ""
            });
            setScannedData(null);
            setSelectedFile(null);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Add Document</span>
        </button>

        {/* Plan badge + doc counter */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider ${
              plan === 'free' ? 'bg-gray-100 text-gray-600' :
              plan === 'monthly' ? 'bg-blue-50 text-blue-600' :
              'bg-purple-50 text-purple-600'
            }`}>{plan}</span>
            <span className={`text-xs font-bold ${isNearLimit ? 'text-red-500' : 'text-gray-500'}`}>
              {docsUsed}/{docLimit} docs
            </span>
            {isNearLimit && (
              <button onClick={onUpgradeClick} className="text-[10px] font-black text-white bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded-full transition-colors">
                Upgrade
              </button>
            )}
          </div>
          <div className="w-24 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${usagePercent}%`}} />
          </div>
        </div>

        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden cursor-pointer shrink-0 shadow-sm">
          <img src={user.photoURL || ""} alt="Profile" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        </div>
      </div>
    </header>
  );
};
