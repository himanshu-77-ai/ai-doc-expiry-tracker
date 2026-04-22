import React from "react";
import { 
  X, 
  Loader2, 
  FileUp, 
  Camera, 
  ShieldCheck, 
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Document } from "../types";

import { useDropzone } from "react-dropzone";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileUpload: (files: File[]) => void;
  isScanning: boolean;
  scannedData: any;
  onSave: (data: any) => Promise<void>;
  isSaving: boolean;
  saveStage: 'idle' | 'preparing' | 'uploading' | 'database';
  uploadProgress: number;
  selectedFile: File | null;
  setIsCameraOpen: (open: boolean) => void;
  setScannedData: (data: any) => void;
  error?: string | null;
  setError?: (err: string | null) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onFileUpload,
  isScanning,
  scannedData,
  onSave,
  isSaving,
  saveStage,
  uploadProgress,
  selectedFile,
  setIsCameraOpen,
  setScannedData,
  error,
  setError
}) => {
  const [manualFormData, setManualFormData] = React.useState({
    title: "",
    category: "Other",
    expiryDate: "",
    issueDate: "",
    documentNumber: "",
    summary: ""
  });

  React.useEffect(() => {
    if (!isOpen) {
      setManualFormData({
        title: "",
        category: "Other",
        expiryDate: "",
        issueDate: "",
        documentNumber: "",
        summary: ""
      });
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (scannedData) {
      setManualFormData({
        title: scannedData.title || "",
        category: scannedData.category || "Other",
        expiryDate: scannedData.expiryDate || "",
        issueDate: scannedData.issueDate || "",
        documentNumber: scannedData.documentNumber || "",
        summary: scannedData.summary || ""
      });
    }
  }, [scannedData]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(manualFormData);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFileUpload,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
      >
        <div className="p-4 lg:p-8 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl lg:text-2xl font-bold">Add New Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        <div className="p-4 lg:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} />
                <p className="text-sm font-medium">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="hover:bg-red-100 p-1 rounded">
                <X size={16} />
              </button>
            </div>
          )}
          
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${
              isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50 hover:border-blue-400"
            }`}
          >
            <input {...getInputProps()} />
            {isScanning ? (
              <div className="text-center space-y-4 py-8">
                <Loader2 size={48} className="mx-auto text-blue-600 animate-spin" />
                <div className="space-y-1">
                  <p className="font-bold text-lg">AI is scanning...</p>
                  <p className="text-gray-500 text-sm">Extracting information</p>
                </div>
                <p className="text-xs text-blue-600 font-medium">You can still fill the form below manually</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                <div className="relative flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-gray-200 bg-gray-50 rounded-2xl hover:border-blue-400 cursor-pointer transition-all">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                    <FileUp size={20} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm">Upload File</p>
                    <p className="text-gray-500 text-[10px]">Drag & drop or click</p>
                  </div>
                </div>
                <div 
                  onClick={(e) => { e.stopPropagation(); setIsCameraOpen(true); }}
                  className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-gray-200 bg-gray-50 rounded-2xl hover:border-blue-400 cursor-pointer transition-all"
                >
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                    <Camera size={20} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm">Take Photo</p>
                    <p className="text-gray-500 text-[10px]">Use your camera</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {scannedData && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-blue-900 flex items-center gap-2">
                  <ShieldCheck size={18} />
                  AI Scanned Details
                </h3>
                <div className="flex items-center gap-2">
                  {scannedData.fileUrl && (
                    <button 
                      onClick={() => window.open(scannedData.fileUrl, '_blank')}
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      View Image
                    </button>
                  )}
                  <button 
                    onClick={() => setScannedData(null)}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-blue-600 text-[10px] font-bold uppercase">Title</p>
                  <p className="font-bold text-blue-900">{scannedData.title || 'Not found'}</p>
                </div>
                <div>
                  <p className="text-blue-600 text-[10px] font-bold uppercase">Expiry</p>
                  <p className="font-bold text-blue-900">{scannedData.expiryDate || 'Not found'}</p>
                </div>
                <div>
                  <p className="text-blue-600 text-[10px] font-bold uppercase">Doc Number</p>
                  <p className="font-bold text-blue-900">{scannedData.documentNumber || 'Not found'}</p>
                </div>
                <div>
                  <p className="text-blue-600 text-[10px] font-bold uppercase">Category</p>
                  <p className="font-bold text-blue-900">{scannedData.category || 'Other'}</p>
                </div>
              </div>
              {scannedData.summary && (
                <div className="pt-2 border-t border-blue-100">
                  <p className="text-blue-900 text-xs italic">"{scannedData.summary}"</p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Document Title</label>
                <input 
                  required 
                  value={manualFormData.title}
                  onChange={(e) => setManualFormData({...manualFormData, title: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="e.g. Passport" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Category</label>
                <select 
                  value={manualFormData.category}
                  onChange={(e) => setManualFormData({...manualFormData, category: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="Identity">Identity</option>
                  <option value="License">License</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Invoice">Invoice</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Expiry Date</label>
                <input 
                  type="date" 
                  required 
                  value={manualFormData.expiryDate}
                  onChange={(e) => setManualFormData({...manualFormData, expiryDate: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Issue Date (Optional)</label>
                <input 
                  type="date" 
                  value={manualFormData.issueDate}
                  onChange={(e) => setManualFormData({...manualFormData, issueDate: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Document Number</label>
                <input 
                  value={manualFormData.documentNumber}
                  onChange={(e) => setManualFormData({...manualFormData, documentNumber: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="e.g. ABC123456" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Summary</label>
                <input 
                  value={manualFormData.summary}
                  onChange={(e) => setManualFormData({...manualFormData, summary: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="Short description" 
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isSaving || isScanning}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 relative overflow-hidden"
            >
              {isSaving && uploadProgress > 0 && uploadProgress < 100 && (
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="absolute left-0 top-0 bottom-0 bg-white/20 z-0"
                />
              )}
              <div className="relative z-10 flex items-center justify-center gap-2">
                {isSaving ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {saveStage === 'preparing' && "Processing Image..."}
                    {saveStage === 'uploading' && `Uploading ${Math.round(uploadProgress)}%...`}
                    {saveStage === 'database' && "Synchronizing..."}
                    {saveStage === 'idle' && "Connecting..."}
                  </>
                ) : (
                  "Save Document"
                )}
              </div>
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
