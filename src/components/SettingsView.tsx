import React from "react";
import { 
  Loader2, 
  RefreshCw, 
  Check, 
  Copy, 
  Clock, 
  Save, 
  ShieldCheck, 
  CreditCard,
  AlertTriangle,
  Bell,
  Camera,
  Globe
} from "lucide-react";
import { User, Document } from "../types";
import { format } from "date-fns";

interface SettingsViewProps {
  user: User;
  configStatus: any;
  isRefreshingStatus: boolean;
  onRefreshStatus: () => void;
  copiedError: boolean;
  onCopyError: () => void;
  isSendingEmail: boolean;
  onSendTestEmail: () => void;
  isTriggeringReminders: boolean;
  onTriggerReminders: () => void;
  isSendingReport: boolean;
  onSendReport: () => void;
  reportSettings: any;
  setReportSettings: React.Dispatch<React.SetStateAction<any>>;
  isSavingSettings: boolean;
  onSaveReportSettings: () => void;
  expiryInterval: number;
  setExpiryInterval: (val: number) => void;
  upiSettings: any;
  setUpiSettings: React.Dispatch<React.SetStateAction<any>>;
  isSavingUpi: boolean;
  onSaveUpiSettings: () => void;
  onSaveProfile: (data: { displayName: string, expiryInterval: number, photoFile?: File }) => Promise<void>;
  isSavingProfile: boolean;
  recentDocuments: Document[];
  isTestingStorage: boolean;
  onTestStorage: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  configStatus,
  isRefreshingStatus,
  onRefreshStatus,
  copiedError,
  onCopyError,
  isSendingEmail,
  onSendTestEmail,
  isTriggeringReminders,
  onTriggerReminders,
  isSendingReport,
  onSendReport,
  reportSettings,
  setReportSettings,
  isSavingSettings,
  onSaveReportSettings,
  expiryInterval,
  setExpiryInterval,
  upiSettings,
  setUpiSettings,
  isSavingUpi,
  onSaveUpiSettings,
  onSaveProfile,
  isSavingProfile,
  recentDocuments,
  isTestingStorage,
  onTestStorage
}) => {
  const [name, setName] = React.useState(user.displayName || "");
  const [profileFile, setProfileFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    onSaveProfile({ 
      displayName: name, 
      expiryInterval,
      photoFile: profileFile || undefined 
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
          <ShieldCheck className="text-blue-600" />
          Account Settings
        </h2>
        <div className="space-y-8">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <img 
                src={previewUrl || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=0D8ABC&color=fff`} 
                alt="Profile" 
                className="w-20 h-20 rounded-2xl border border-gray-100 object-cover shadow-sm" 
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                <Camera size={20} className="text-white" />
              </div>
            </div>
            <div>
              <p className="font-bold text-lg">{user.displayName}</p>
              <p className="text-gray-500">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase tracking-wider">{user.plan || 'Free'} Plan</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-gray-100 text-left">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Full Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Email Address</label>
              <input type="email" defaultValue={user.email || ""} disabled className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 font-medium" />
            </div>
          </div>
          
          <div className="pt-4 flex justify-between items-center">
            <button 
              disabled={isSavingProfile}
              onClick={handleSaveProfile}
              className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-gray-200"
            >
              {isSavingProfile ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save Account Settings
            </button>
            <p className="text-xs text-gray-400 italic">User data is stored securely in encrypted Firestore buckets.</p>
          </div>

          <div className="pt-8 border-t border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Document Tracking</h3>
                <p className="text-sm text-gray-500">How would you like to be notified about expiries?</p>
              </div>
              <Bell className="text-blue-600" />
            </div>
            <div className="bg-gray-50 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <p className="font-bold text-gray-900">Custom Expiry Interval</p>
                <p className="text-xs text-gray-500">Starts notifying you X days before a document expires.</p>
              </div>
              <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
                <input 
                  type="number" 
                  value={expiryInterval}
                  onChange={(e) => setExpiryInterval(parseInt(e.target.value) || 0)}
                  className="w-20 text-center font-bold outline-none text-blue-600 text-lg"
                />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-l pl-4 border-gray-100">Days</span>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Email Integration (Gmail)</h3>
              <div className="flex items-center gap-3">
                <button 
                  disabled={isRefreshingStatus}
                  onClick={onRefreshStatus}
                  className="text-xs font-bold text-blue-600 hover:underline disabled:opacity-50 flex items-center gap-1"
                >
                  <RefreshCw size={12} className={isRefreshingStatus ? "animate-spin" : ""} />
                  {isRefreshingStatus ? "Refreshing..." : "Refresh Status"}
                </button>
                {configStatus && (
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${configStatus.smtp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${configStatus.smtp ? 'bg-green-600' : 'bg-red-600'}`} />
                      SMTP: {configStatus.smtp ? 'Connected' : 'Not Configured'}
                    </span>
                    <div className="group relative flex items-center gap-2">
                      <span 
                        onClick={() => {
                          if (configStatus.dbError) {
                            const errorText = `DATABASE DIAGNOSTICS:\n\nConnection Type: ${configStatus.connectionType || 'Unknown'}\n\nError Message:\n${configStatus.dbError}`;
                            console.log(errorText);
                            alert(errorText);
                          }
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer ${configStatus.db ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${configStatus.db ? 'bg-green-600' : 'bg-red-600'}`} />
                        Database: {configStatus.db ? (configStatus.connectionType === 'REST API (Fallback)' ? 'Connected (Fallback)' : 'Connected') : 'Error (Click to see)'}
                      </span>
                      
                      {configStatus.dbError && (
                        <button
                          onClick={onCopyError}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors flex items-center gap-1 text-[10px] font-bold"
                        >
                          {copiedError ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                          {copiedError ? "Copied!" : "Copy Error"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-blue-50 p-6 rounded-2xl mb-6 text-sm text-blue-700 space-y-3">
              <p className="font-bold text-base">Configuration Required:</p>
              <p>To enable automated emails and invites, you must add these to your <strong>Secrets</strong> panel:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li><strong>SMTP_USER</strong>: Your Gmail address</li>
                <li><strong>SMTP_PASS</strong>: Your Gmail <strong>App Password</strong></li>
              </ul>
            </div>
            <div className="flex flex-wrap gap-4">
              <button 
                disabled={isSendingEmail}
                onClick={onSendTestEmail}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSendingEmail ? <Loader2 className="animate-spin" size={18} /> : "Send Test Email"}
              </button>

              <button 
                disabled={isTriggeringReminders}
                onClick={onTriggerReminders}
                className="px-6 py-3 border border-blue-200 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isTriggeringReminders ? <Loader2 className="animate-spin" size={18} /> : "Run Expiry Check Now"}
              </button>

              <button 
                disabled={isSendingReport}
                onClick={onSendReport}
                className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg shadow-gray-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSendingReport ? <Loader2 className="animate-spin" size={18} /> : "Send Full Status Report"}
              </button>

              <button 
                disabled={isTestingStorage}
                onClick={onTestStorage}
                className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isTestingStorage ? <Loader2 className="animate-spin" size={18} /> : <Globe size={18} />}
                Test Storage Connection
              </button>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Report Schedule</h3>
                <p className="text-sm text-gray-500">Automatically receive document status reports in your inbox.</p>
              </div>
              <Clock size={20} className="text-blue-600" />
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Frequency</label>
                  <select 
                    value={reportSettings.frequency}
                    onChange={(e) => setReportSettings(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="none">Paused (No Auto-Reports)</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Preferred Time</label>
                  <input 
                    type="time"
                    value={reportSettings.time}
                    onChange={(e) => setReportSettings(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={onSaveReportSettings}
                  disabled={isSavingSettings}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingSettings ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Schedule
                </button>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Payment Settings (Admin)</h3>
                <p className="text-sm text-gray-500">Configure your UPI details for receiving payments.</p>
              </div>
              <CreditCard size={20} className="text-orange-600" />
            </div>

            <div className="bg-orange-50 p-6 rounded-2xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">UPI ID</label>
                  <input 
                    type="text"
                    placeholder="e.g. yourname@upi"
                    value={upiSettings.upiId}
                    onChange={(e) => setUpiSettings(prev => ({ ...prev, upiId: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Display Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. AI Tracker Admin"
                    value={upiSettings.upiName}
                    onChange={(e) => setUpiSettings(prev => ({ ...prev, upiName: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={onSaveUpiSettings}
                  disabled={isSavingUpi}
                  className="px-6 py-2 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingUpi ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Payment Details
                </button>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Recent Upload Diagnostics</h3>
                <p className="text-sm text-gray-500">Verify that your documents and images are reaching the cloud.</p>
              </div>
              <ShieldCheck size={20} className="text-green-600" />
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-medium text-gray-500">
                <thead className="bg-gray-50 uppercase text-[10px] tracking-wider text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Document</th>
                    <th className="px-4 py-3">Uploaded</th>
                    <th className="px-4 py-3">Image Status</th>
                    <th className="px-4 py-3">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 italic">
                  {recentDocuments.slice(0, 5).map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-900 line-clamp-1">{doc.title}</td>
                      <td className="px-4 py-3">
                        {doc.createdAt && (doc.createdAt as any).toDate 
                          ? format( (doc.createdAt as any).toDate(), 'MMM dd, HH:mm')
                          : 'Recent'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full ${doc.fileUrl ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {doc.fileUrl ? 'IMAGE SAVED' : 'NO IMAGE'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {doc.fileUrl && (
                          <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View</a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {recentDocuments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No documents uploaded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
