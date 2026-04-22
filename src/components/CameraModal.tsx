import React from "react";
import { X, Camera } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Webcam from "react-webcam";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  webcamRef: React.RefObject<Webcam>;
  onCapture: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  webcamRef,
  onCapture
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold">Capture Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 bg-black relative min-h-[400px]">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="w-full h-full object-cover"
            videoConstraints={{ facingMode: "environment" }}
          />
        </div>
        <div className="p-8 flex justify-center">
          <button 
            onClick={onCapture}
            className="w-20 h-20 bg-white border-8 border-blue-600 rounded-full shadow-xl hover:scale-105 transition-transform"
          />
        </div>
      </motion.div>
    </div>
  );
};
