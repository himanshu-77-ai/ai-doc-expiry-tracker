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
  Calendar
} from "lucide-react";
import { getDynamicStatus } from "../lib/utils";

interface ReportsViewProps {
  documents: any[];
  isSendingReport: boolean;
  onSendReport: () => void;
  reportSettings: any;
  onSaveReportSettings: () => void;
  setReportSettings: (settings: any) => void;
  isSavingSettings: boolean;
  expiryInterval: number;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  documents,
  isSendingReport,
  onSendReport,
  reportSettings,
  onSaveReportSettings,
  setReportSettings,
  isSavingSettings,
  expiryInterval
}) => {
  const stats = {
    total: documents.length,
    active: documents.filter(d => (d.status === 'Renewed' ? 'Safe' : getDynamicStatus(d.expiryDate, expiryInterval)) === 'Safe').length,
    soon: documents.filter(d => d.status !== 'Renewed' && getDynamicStatus(d.expiryDate, expiryInterval) === 'Expiring Soon').length,
    expired: documents.filter(d => d.status !== 'Renewed' && getDynamicStatus(d.expiryDate, expiryInterval) === 'Expired').length,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gray-900">Status Reports</h2>
          <p className="text-gray-500 font-medium">Analyze your document visibility and expiry trends.</p>
        </div>
        <button 
          onClick={onSendReport}
          disabled={isSendingReport}
          className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50"
        >
          {isSendingReport ? <Loader2 className="animate-spin" size={20} /> : <Mail size={20} />}
          Email Me Full Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Asset Items", value: stats.total, color: "blue", icon: FileText },
          { label: "Secured & Active", value: stats.active, color: "green", icon: CheckCircle2 },
          { label: "Expiring items", value: stats.soon, color: "amber", icon: Clock },
          { label: "Critical Expiry", value: stats.expired, color: "red", icon: BarChart3 },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center mb-6`}>
              <stat.icon size={24} />
            </div>
            <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">{stat.label}</p>
            <p className="text-4xl font-black mt-2 text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold">Reporting Schedule</h3>
            <Calendar className="text-blue-600" />
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Frequency</label>
                <select 
                  value={reportSettings.frequency}
                  onChange={(e) => setReportSettings({ ...reportSettings, frequency: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="none">Paused (No Auto-Reports)</option>
                  <option value="daily">Every Morning</option>
                  <option value="weekly">Every Monday</option>
                  <option value="monthly">1st of Month</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Preferred Time</label>
                <input 
                  type="time" 
                  value={reportSettings.time}
                  onChange={(e) => setReportSettings({ ...reportSettings, time: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
            </div>
            <button 
              onClick={onSaveReportSettings}
              disabled={isSavingSettings}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              {isSavingSettings ? <Loader2 className="animate-spin" size={20} /> : "Save Report Schedule"}
            </button>
          </div>
        </div>

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
