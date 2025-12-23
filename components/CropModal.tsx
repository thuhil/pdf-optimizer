
import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Area } from 'react-easy-crop';
// Added Crop to the list of imported icons from lucide-react
import { Sparkles, Check, X, Loader2, Crop } from 'lucide-react';
import { getAutoCropSuggestion } from '../services/geminiService';
import { PixelCrop, CropArea } from '../types';

interface CropModalProps {
  imageUrl: string;
  initialCrop?: CropArea;
  onConfirm: (pixelCrop: PixelCrop, percentCrop: CropArea) => void;
  onCancel: () => void;
}

const CropModal: React.FC<CropModalProps> = ({ imageUrl, initialCrop, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
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
            
            // Note: Programmatically moving react-easy-crop precisely from % bounds is complex
            // without knowing the cropper container dimensions.
            // We set the internal selection state and zoom to an appropriate level for the user to see.
            const calculatedZoom = Math.min(3, 100 / Math.max(suggestion.width, suggestion.height));
            setZoom(calculatedZoom);
            setCroppedAreaPixels(pxCrop);
            setCroppedAreaPercent(suggestion);

            // We let the user see the box (it will auto-adjust zoom if possible) 
            // and click Apply themselves to confirm.
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
        onConfirm(croppedAreaPixels, croppedAreaPercent);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[80vh] bg-gray-900 rounded-lg overflow-hidden flex flex-col shadow-2xl m-4">
        <div className="p-4 flex justify-between items-center bg-gray-800 border-b border-gray-700">
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            <Crop className="text-primary" size={20} />
            Crop Image
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white transition p-1 hover:bg-gray-700 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="relative flex-1 bg-black">
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

        <div className="p-4 bg-gray-800 border-t border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
                 <span className="text-gray-400 text-sm font-medium">Zoom</span>
                 <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 sm:w-48 accent-primary h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
                <button 
                    onClick={handleAutoCrop}
                    disabled={isAutoCropping}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md font-medium transition-all shadow-md active:scale-95"
                >
                    {isAutoCropping ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                    <span>Magic Crop</span>
                </button>
                <button 
                    onClick={handleSave}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium transition-all shadow-md active:scale-95"
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
