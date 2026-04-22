import React from "react";
import { 
  BarChart3, 
  FileText, 
  Clock, 
  AlertTriangle, 
  ShieldCheck,
  Plus,
  ArrowRight,
  TrendingUp,
  Bell
} from "lucide-react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { Document } from "../types";
import { cn } from "../lib/utils";

interface DashboardViewProps {
  stats: {
    total: number;
    safe: number;
    expiring: number;
    expired: number;
  };
  upcomingDocuments: Document[];
  onScanClick: () => void;
  onRenew: (doc: Document) => void;
  getStatus: (date: string) => string;
  configStatus?: any;
  onTabChange?: (tab: string) => void;
}

export function DashboardView({ 
  stats, 
  upcomingDocuments, 
  onScanClick, 
  onRenew,
  getStatus,
  configStatus,
  onTabChange
}: DashboardViewProps) {
  return (
    <div className="space-y-8 pb-12">
      {/* System Status Banner (if issues exist) */}
      {configStatus && (!configStatus.smtp || !configStatus.db || !configStatus.gemini) && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle size={20} />
            <div>
              <p className="font-bold text-sm">System configuration issues detected.</p>
              <p className="text-xs opacity-80">Some features like automated emails or AI scanning may be limited. Check settings for details.</p>
            </div>
          </div>
          <button 
            onClick={() => onTabChange?.("settings")}
            className="text-xs font-bold bg-red-100 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors"
          >
            Fix in Settings
          </button>
        </div>
      )}
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-[2.5rem] p-8 lg:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[100px] rounded-full -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-6 max-w-2xl">
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            Review your <span className="text-blue-400">critical</span> document lifecycle.
          </h1>
          <p className="text-blue-100/80 text-lg font-medium">
            Manage, track and secure your identity documents with AI-powered scanning and smart reminders.
          </p>
          <button 
            onClick={onScanClick}
            className="bg-white text-gray-900 px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-blue-50 transition-all shadow-xl shadow-blue-500/20 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform" />
            Scan New Document
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Asset Items", value: stats.total, color: "blue", icon: FileText },
          { label: "Secured & Active", value: stats.safe, color: "green", icon: ShieldCheck },
          { label: "Expiring items", value: stats.expiring, color: "amber", icon: Clock },
          { label: "Critical Expiry", value: stats.expired, color: "red", icon: AlertTriangle },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110",
              stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
              stat.color === 'green' ? "bg-green-50 text-green-600" :
              stat.color === 'amber' ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
            )}>
              <stat.icon size={24} />
            </div>
            <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">{stat.label}</p>
            <p className="text-4xl font-black mt-1 text-gray-900 tracking-tight">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reminders Section */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Bell className="text-blue-600" size={20} />
              Upcoming Reminders
            </h3>
            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold">
              {upcomingDocuments.length} Action Required
            </span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[500px] p-4 lg:p-8 space-y-4">
            {upcomingDocuments.map(doc => (
              <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-6 bg-white border border-gray-100 rounded-3xl hover:border-blue-200 transition-all group">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                  getStatus(doc.expiryDate) === 'Expired' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                )}>
                  <Bell size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-gray-900 text-lg leading-tight">{doc.title}</p>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight",
                      getStatus(doc.expiryDate) === 'Expired' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {getStatus(doc.expiryDate)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Expires on {format(new Date(doc.expiryDate), 'MMM dd, yyyy')}</p>
                </div>
                <button 
                  onClick={() => onRenew(doc)}
                  className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg shadow-gray-200"
                >
                  Review Now
                </button>
              </div>
            ))}
            {upcomingDocuments.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck size={40} />
                </div>
                <h4 className="text-xl font-bold text-gray-900">All Safe!</h4>
                <p className="text-gray-500 max-w-xs mx-auto">None of your documents are expiring soon or expired. Great job staying organized!</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Insights */}
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
            <TrendingUp size={64} className="absolute bottom-4 right-4 text-white/10 group-hover:scale-110 transition-transform" />
            <div className="relative z-10 space-y-4">
              <h3 className="text-2xl font-bold">Smart Analysis</h3>
              <p className="text-indigo-100 text-sm leading-relaxed opacity-90">
                AI is analyzing your document patterns to predict upcoming renewal costs and tasks.
              </p>
              <div className="pt-4 flex gap-2">
                <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold backdrop-blur-sm">PREDICTIVE</span>
                <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold backdrop-blur-sm">BETA</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
              <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                <Clock size={14} />
              </div>
            </div>
            <div className="space-y-4">
              {upcomingDocuments.slice(0, 3).map((doc, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                  <p className="text-xs font-medium text-gray-600">
                    <span className="font-bold text-gray-900">{doc.title}</span> needs attention soon.
                  </p>
                </div>
              ))}
              {upcomingDocuments.length === 0 && (
                <p className="text-xs text-gray-400 italic">No recent critical events tracked.</p>
              )}
            </div>
            <button className="w-full py-3 bg-gray-50 border border-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2 group">
              View Activity Log
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
