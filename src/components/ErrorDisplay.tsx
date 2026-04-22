import React from "react";
import { X } from "lucide-react";

interface ErrorDisplayProps {
  error: string | null;
  setError: (err: string | null) => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, setError }) => {
  if (!error) return null;

  return (
    <div className="max-w-6xl mx-auto mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
          <X size={18} />
        </div>
        <p className="font-medium text-sm">{error}</p>
      </div>
      <button onClick={() => setError(null)} className="p-2 hover:bg-red-100 rounded-lg transition-colors">
        <X size={18} />
      </button>
    </div>
  );
};
