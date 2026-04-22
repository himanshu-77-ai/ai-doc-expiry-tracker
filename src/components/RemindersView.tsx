import React from "react";
import { Bell, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { Document } from "../types";
import { cn } from "../lib/utils";

interface RemindersViewProps {
  documents: Document[];
  expiryInterval: number;
  setExpiryInterval: (val: number) => void;
  getStatus: (date: string) => string;
  isTriggeringReminders: boolean;
  onTriggerReminders: () => void;
  onRenew: (doc: Document) => void;
}

export function RemindersView({ 
  documents, 
  expiryInterval, 
  setExpiryInterval, 
  getStatus,
  isTriggeringReminders,
  onTriggerReminders,
  onRenew
}: RemindersViewProps) {
  const reminderDocs = documents.filter(d => getStatus(d.expiryDate) !== 'Safe' && d.status !== 'Renewed');
  const renewedDocs = documents.filter(d => d.status === 'Renewed');

  const getStatusUI = (status: string) => {
    switch (status) {
      case 'Expired': return { color: "bg-red-50 text-red-600", label: "Expired" };
      case 'Expiring Soon': return { color: "bg-amber-50 text-amber-600", label: "Expiring Soon" };
      case 'Renewed': return { color: "bg-green-50 text-green-600", label: "Renewed" };
      default: return { color: "bg-blue-50 text-blue-600", label: "Safe" };
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-gray-900">Notification Settings</h2>
            <p className="text-gray-500">Manage how you receive document alerts.</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Bell size={24} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-gray-100">
            <div className="space-y-1">
              <p className="font-bold text-gray-900">Email Reminders</p>
              <p className="text-sm text-gray-500">Receive auto-emails before document expiry</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-gray-100">
            <div className="space-y-1">
              <p className="font-bold text-gray-900">Expiry Interval</p>
              <p className="text-sm text-gray-500">How many days before expiry to notify you</p>
            </div>
            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-gray-200 shadow-sm">
              <input 
                type="number" 
                value={expiryInterval}
                onChange={(e) => setExpiryInterval(parseInt(e.target.value) || 0)}
                className="w-16 text-center font-bold outline-none"
              />
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest pr-2">Days</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 bg-gray-50/50">
          <h3 className="text-xl font-black text-gray-900">Upcoming Reminders</h3>
        </div>
        <div className="p-8 space-y-4">
          {reminderDocs.map(doc => {
            const ui = getStatusUI(getStatus(doc.expiryDate));
            return (
              <div key={doc.id} className="flex items-center gap-6 p-6 bg-white border border-gray-100 rounded-3xl hover:border-blue-200 transition-all group">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                  ui.color
                )}>
                  <Bell size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-lg">{doc.title} is {ui.label.toLowerCase()}</p>
                  <p className="text-sm text-gray-500 font-medium">Expires on {format(new Date(doc.expiryDate), 'MMMM dd, yyyy')}</p>
                </div>
                <button 
                  onClick={() => onRenew(doc)}
                  className="px-6 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all"
                >
                  Renew Now
                </button>
              </div>
            );
          })}
          {renewedDocs.map(doc => (
            <div key={doc.id} className="flex items-center gap-6 p-6 bg-green-50/30 border border-green-100 rounded-3xl group opacity-80">
              <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-lg">{doc.title}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-green-600 uppercase tracking-tight">Status: Renewed</span>
                  <p className="text-sm text-gray-500 font-medium">• Expires on {format(new Date(doc.expiryDate), 'MMMM dd, yyyy')}</p>
                </div>
              </div>
              <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <ShieldCheck size={16} />
              </div>
            </div>
          ))}
          {reminderDocs.length === 0 && renewedDocs.length === 0 && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck size={32} />
              </div>
              <p className="font-bold text-gray-900">All documents are safe!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
