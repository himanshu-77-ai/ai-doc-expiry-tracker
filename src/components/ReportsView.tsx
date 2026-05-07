import React from "react";
import { 
  BarChart3, 
  FileText, 
  TrendingUp, 
  Clock, 
  Download,
  Mail,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { getDynamicStatus } from "../lib/utils";

interface ReportsViewProps {
  documents: any[];
  isSendingReport: boolean;
  onSendReport: () => void;
  expiryInterval: number;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  documents,
  isSendingReport,
  onSendReport,
  expiryInterval
}) => {
  const stats = {
    total: documents.length,
    active: documents.filter(d => {
      const computed = getDynamicStatus(d.expiryDate, expiryInterval);
      // Renewed counts as safe ONLY if not actually expired
      if (d.status === 'Renewed' && computed !== 'Expired') return true;
      return computed === 'Safe';
    }).length,
    soon: documents.filter(d => {
      return getDynamicStatus(d.expiryDate, expiryInterval) === 'Expiring Soon';
    }).length,
    expired: documents.filter(d => {
      return getDynamicStatus(d.expiryDate, expiryInterval) === 'Expired';
    }).length,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gray-900">Status Reports</h2>
          <p className="text-gray-500 font-medium">Analyze your document visibility and expiry trends.</p>
        </div>
        <button 
          onClick={onSendReport}
          disabled={isSendingReport}
          className="w-full sm:w-auto bg-gray-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-50"
        >
          {isSendingReport ? <Loader2 className="animate-spin" size={20} /> : <Mail size={20} />}
          Email Me Full Report
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Asset Items", value: stats.total, color: "blue", icon: FileText },
          { label: "Secured & Active", value: stats.active, color: "green", icon: CheckCircle2 },
          { label: "Expiring items", value: stats.soon, color: "amber", icon: Clock },
          { label: "Critical Expiry", value: stats.expired, color: "red", icon: BarChart3 },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center mb-6`}>
              <stat.icon size={24} />
            </div>
            <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">{stat.label}</p>
            <p className="text-4xl font-black mt-2 text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2rem] text-white shadow-xl shadow-blue-200 flex flex-col justify-between">
          <div className="space-y-4">
            <TrendingUp size={48} className="opacity-50" />
            <h3 className="text-2xl font-bold">Insights coming soon</h3>
            <p className="text-blue-100 opacity-80 leading-relaxed">
              We're building advanced AI insights to help you predict expiry risks and optimize your document management strategy.
            </p>
          </div>
          <div className="flex items-center gap-4 pt-8">
            <div className="px-4 py-2 bg-white/10 rounded-xl text-sm font-bold backdrop-blur-sm border border-white/10">
              V2 Prediction
            </div>
            <div className="px-4 py-2 bg-white/10 rounded-xl text-sm font-bold backdrop-blur-sm border border-white/10">
              Risk Score
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
