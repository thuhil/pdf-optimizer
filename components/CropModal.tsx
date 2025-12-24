import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Area } from 'react-easy-crop';
import { Sparkles, Check, X, Loader2, Crop } from 'lucide-react';
import { getAutoCropSuggestion } from '../services/geminiService';
import { PixelCrop, CropArea } from '../types';

interface CropModalProps {
  imageUrl: string;
  initialCrop?: CropArea;
  onConfirm: (pixelCrop: PixelCrop, percentCrop: CropArea, quality: number) => void;
  onCancel: () => void;
}

const CropModal: React.FC<CropModalProps> = ({ imageUrl, initialCrop, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [quality, setQuality] = useState(0.9);
  const [isAutoCropping, setIsAutoCropping] = useState(false);
  
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);
  const [croppedAreaPercent, setCroppedAreaPercent] = useState<CropArea | null>(initialCrop || null);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPercent({
        x: croppedArea.x,
        y: croppedArea.y,
        width: croppedArea.width,
        height: croppedArea.height
    });
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleAutoCrop = async () => {
    setIsAutoCropping(true);
    try {
        const suggestion = await getAutoCropSuggestion(imageUrl);
        if (suggestion) {
            const img = new Image();
            img.src = imageUrl;
            await img.decode();
            
            const pxCrop = {
                x: (suggestion.x / 100) * img.naturalWidth,
                y: (suggestion.y / 100) * img.naturalHeight,
                width: (suggestion.width / 100) * img.naturalWidth,
                height: (suggestion.height / 100) * img.naturalHeight,
            };
            
            const calculatedZoom = Math.min(3, 100 / Math.max(suggestion.width, suggestion.height));
            setZoom(calculatedZoom);
            setCroppedAreaPixels(pxCrop);
            setCroppedAreaPercent(suggestion);

            alert("Auto-crop suggestion applied! You can refine the selection before clicking 'Apply'.");
            
        } else {
            alert("No document edges detected.");
        }
    } catch (e) {
        console.error("Auto-crop error", e);
        alert("Auto-crop failed. Please adjust manually.");
    } finally {
        setIsAutoCropping(false);
    }
  };

  const handleSave = () => {
    if (croppedAreaPixels && croppedAreaPercent) {
        onConfirm(croppedAreaPixels, croppedAreaPercent, quality);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-gray-900 rounded-lg overflow-hidden flex flex-col shadow-2xl m-4 transition-colors duration-200">
        <div className="p-4 flex justify-between items-center bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-gray-800 dark:text-white font-semibold text-lg flex items-center gap-2">
            <Crop className="text-primary" size={20} />
            Crop Image
          </h3>
          <button onClick={onCancel} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="relative flex-1 bg-gray-100 dark:bg-black">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            objectFit="contain"
          />
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-col xl:flex-row items-center justify-between gap-4">
            
            <div className="flex flex-col sm:flex-row gap-6 w-full xl:w-auto">
                {/* Zoom Control */}
                <div className="flex items-center gap-3">
                     <span className="text-gray-600 dark:text-gray-400 text-sm font-medium w-12">Zoom</span>
                     <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-label="Zoom"
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-32 sm:w-48 accent-primary h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Quality Control */}
                <div className="flex items-center gap-3">
                    <span className="text-gray-600 dark:text-gray-400 text-sm font-medium flex items-center gap-1 w-12" title="JPEG Quality">
                        Quality
                    </span>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            value={quality}
                            min={0.1}
                            max={1.0}
                            step={0.1}
                            aria-label="Quality"
                            onChange={(e) => setQuality(Number(e.target.value))}
                            className="w-32 sm:w-48 accent-emerald-500 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{Math.round(quality * 100)}%</span>
                    </div>
                </div>
            </div>

            <div className="flex gap-3 w-full xl:w-auto mt-2 xl:mt-0">
                <button 
                    onClick={handleAutoCrop}
                    disabled={isAutoCropping}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md font-medium transition-all shadow-md active:scale-95 whitespace-nowrap"
                >
                    {isAutoCropping ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                    <span>Magic Crop</span>
                </button>
                <button 
                    onClick={handleSave}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium transition-all shadow-md active:scale-95 whitespace-nowrap"
                >
                    <Check size={18} />
                    <span>Apply</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CropModal;