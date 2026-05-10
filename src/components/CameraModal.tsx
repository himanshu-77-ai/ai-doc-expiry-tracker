import React, { useState, useCallback } from "react";
import { X, Camera, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleUserMedia = useCallback(() => {
    setIsLoading(false);
    setCameraError(null);
  }, []);

  const handleUserMediaError = useCallback((err: string | DOMException) => {
    setIsLoading(false);
    const msg = typeof err === 'string' ? err : err.message;
    if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
      setCameraError("Camera permission denied. Please allow camera access in your browser settings and try again.");
    } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
      setCameraError("No camera found on this device. Please use the 'Upload File' option instead.");
    } else if (msg.includes('NotReadable') || msg.includes('TrackStart')) {
      setCameraError("Camera is in use by another application. Please close other apps using the camera and try again.");
    } else {
      setCameraError(`Camera error: ${msg}. Please use the 'Upload File' option instead.`);
    }
  }, []);

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

        <div className="flex-1 bg-black relative min-h-[300px] flex items-center justify-center">
          {cameraError ? (
            <div className="p-8 text-center space-y-4">
              <AlertTriangle size={48} className="mx-auto text-yellow-400" />
              <p className="text-white text-sm max-w-sm">{cameraError}</p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-white text-gray-800 rounded-xl font-semibold text-sm hover:bg-gray-100 transition"
              >
                Use Upload Instead
              </button>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <div className="text-center space-y-3">
                    <Camera size={40} className="mx-auto text-white animate-pulse" />
                    <p className="text-white text-sm">Starting camera...</p>
                  </div>
                </div>
              )}
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.9}
                className="w-full h-full object-cover"
                videoConstraints={{
                  facingMode: { ideal: "environment" },
                  width: { ideal: 1280 },
                  height: { ideal: 720 }
                }}
                onUserMedia={handleUserMedia}
                onUserMediaError={handleUserMediaError}
                mirrored={false}
              />
            </>
          )}
        </div>

        {!cameraError && (
          <div className="p-8 flex flex-col items-center gap-3">
            <button
              onClick={onCapture}
              disabled={isLoading}
              className="w-20 h-20 bg-white border-8 border-blue-600 rounded-full shadow-xl hover:scale-105 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Capture photo"
            />
            <p className="text-gray-400 text-xs">Tap to capture document</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
