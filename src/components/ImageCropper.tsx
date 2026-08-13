import React, { useState, useRef, useEffect } from 'react';
import { Crop, Maximize, RotateCw, RotateCcw, Check, X, Sliders } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onCrop: (croppedBase64: string, cropPercent?: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
  initialCrop?: { x: number; y: number; width: number; height: number };
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
  imageSrc,
  onCrop,
  onCancel,
  initialCrop,
}) => {
  // Store the physically-rotated version of the image
  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);
  
  // Crop area represented as percentages (0 to 100)
  const [crop, setCrop] = useState(() => initialCrop || { x: 15, y: 15, width: 70, height: 70 });
  const [aspectRatio, setAspectRatio] = useState<'free' | '1:1' | '4:3' | '16:9'>('free');
  const [showSliders, setShowSliders] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; cropX: number; cropY: number } | null>(null);
  const resizeStartRef = useRef<{
    handle: string;
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  // Synchronize state if external imageSrc changes
  useEffect(() => {
    setCurrentImageSrc(imageSrc);
  }, [imageSrc]);

  // Apply aspect ratio constraints if selected
  useEffect(() => {
    if (aspectRatio === 'free') return;

    let targetRatio = 1;
    if (aspectRatio === '1:1') targetRatio = 1;
    else if (aspectRatio === '4:3') targetRatio = 4 / 3;
    else if (aspectRatio === '16:9') targetRatio = 16 / 9;

    if (imageRef.current) {
      const imgWidth = imageRef.current.clientWidth;
      const imgHeight = imageRef.current.clientHeight;
      if (imgWidth && imgHeight) {
        const imgRatio = imgWidth / imgHeight;
        const newHeightPercent = (crop.width * imgRatio) / targetRatio;
        
        if (crop.y + newHeightPercent > 100) {
          const adjustedHeight = 100 - crop.y;
          const adjustedWidth = (adjustedHeight * targetRatio) / imgRatio;
          setCrop(prev => ({ 
            ...prev, 
            width: Math.min(adjustedWidth, 100 - crop.x), 
            height: adjustedHeight 
          }));
        } else {
          setCrop(prev => ({ ...prev, height: Math.min(newHeightPercent, 100) }));
        }
      }
    }
  }, [aspectRatio]);

  // Handle Dragging the entire Crop Box
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = {
      x: clientX,
      y: clientY,
      cropX: crop.x,
      cropY: crop.y,
    };

    e.preventDefault();
  };

  // Handle resizing from corners or edges
  const handleResizeStart = (handle: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    resizeStartRef.current = {
      handle,
      cropX: crop.x,
      cropY: crop.y,
      cropW: crop.width,
      cropH: crop.height,
      clientX,
      clientY,
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e && e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      } else {
        return;
      }

      // 1. Handling Crop Window Movement (Panning)
      if (dragStartRef.current && imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        const deltaX = ((clientX - dragStartRef.current.x) / rect.width) * 100;
        const deltaY = ((clientY - dragStartRef.current.y) / rect.height) * 100;

        let nextX = dragStartRef.current.cropX + deltaX;
        let nextY = dragStartRef.current.cropY + deltaY;

        if (nextX < 0) nextX = 0;
        if (nextY < 0) nextY = 0;
        if (nextX + crop.width > 100) nextX = 100 - crop.width;
        if (nextY + crop.height > 100) nextY = 100 - crop.height;

        setCrop(prev => ({ ...prev, x: nextX, y: nextY }));
      }

      // 2. Handling Bounding Box Resizing
      if (resizeStartRef.current && imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        const deltaX = ((clientX - resizeStartRef.current.clientX) / rect.width) * 100;
        const deltaY = ((clientY - resizeStartRef.current.clientY) / rect.height) * 100;

        const { handle, cropX, cropY, cropW, cropH } = resizeStartRef.current;
        let newX = cropX;
        let newY = cropY;
        let newW = cropW;
        let newH = cropH;

        // East / West edges
        if (handle.includes('e')) {
          newW = Math.max(5, Math.min(100 - cropX, cropW + deltaX));
        }
        if (handle.includes('w')) {
          const maxDeltaX = cropW - 5;
          const actualDelta = Math.max(-cropX, Math.min(maxDeltaX, deltaX));
          newX = cropX + actualDelta;
          newW = cropW - actualDelta;
        }
        
        // North / South edges
        if (handle.includes('s')) {
          newH = Math.max(5, Math.min(100 - cropY, cropH + deltaY));
        }
        if (handle.includes('n')) {
          const maxDeltaY = cropH - 5;
          const actualDelta = Math.max(-cropY, Math.min(maxDeltaY, deltaY));
          newY = cropY + actualDelta;
          newH = cropH - actualDelta;
        }

        // Apply locked aspect ratio constraints
        if (aspectRatio !== 'free') {
          let ratio = 1;
          if (aspectRatio === '1:1') ratio = 1;
          else if (aspectRatio === '4:3') ratio = 4 / 3;
          else if (aspectRatio === '16:9') ratio = 16 / 9;

          const imgRatio = rect.width / rect.height;

          if (handle === 'e' || handle === 'w' || handle.includes('e') || handle.includes('w')) {
            newH = (newW * imgRatio) / ratio;
            if (newY + newH > 100) {
              newH = 100 - newY;
              newW = (newH * ratio) / imgRatio;
              if (handle.includes('w')) {
                newX = cropX + (cropW - newW);
              }
            }
          } else {
            newW = (newH * ratio) / imgRatio;
            if (newX + newW > 100) {
              newW = 100 - newX;
              newH = (newW * imgRatio) / ratio;
              if (handle.includes('n')) {
                newY = cropY + (cropH - newH);
              }
            }
          }
        }

        setCrop({
          x: Math.max(0, Math.min(95, newX)),
          y: Math.max(0, Math.min(95, newY)),
          width: Math.max(5, Math.min(100, newW)),
          height: Math.max(5, Math.min(100, newH))
        });
      }
    };

    const handleEnd = () => {
      dragStartRef.current = null;
      resizeStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [crop, aspectRatio]);

  // Execute Canvas Cropping
  const handleCropConfirm = () => {
    if (!imageRef.current) return;

    const originalImg = new Image();
    originalImg.src = currentImageSrc;
    originalImg.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const sourceX = (crop.x / 100) * originalImg.naturalWidth;
      const sourceY = (crop.y / 100) * originalImg.naturalHeight;
      const sourceW = (crop.width / 100) * originalImg.naturalWidth;
      const sourceH = (crop.height / 100) * originalImg.naturalHeight;

      canvas.width = sourceW;
      canvas.height = sourceH;
      
      // Paint white background to prevent black background when exporting transparent images to JPEG
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sourceW, sourceH);
      
      ctx.drawImage(originalImg, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
      onCrop(croppedBase64, crop);
    };
  };

  // Physically rotate the image 90 degrees clockwise on a canvas
  const handleRotate90 = () => {
    const img = new Image();
    img.src = currentImageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Swapping width and height for 90 degrees rotation
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;

      // Paint white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const rotatedBase64 = canvas.toDataURL('image/jpeg', 0.85);
      setCurrentImageSrc(rotatedBase64);

      // Rotate the crop box clockwise to match
      setCrop(prev => {
        const nextX = Math.max(0, Math.min(95, 100 - (prev.y + prev.height)));
        const nextY = Math.max(0, Math.min(95, prev.x));
        const nextWidth = Math.max(5, Math.min(100, prev.height));
        const nextHeight = Math.max(5, Math.min(100, prev.width));
        return { x: nextX, y: nextY, width: nextWidth, height: nextHeight };
      });
    };
  };

  // Reset work zone back to original image & crop
  const handleReset = () => {
    setCurrentImageSrc(imageSrc);
    setCrop(initialCrop || { x: 15, y: 15, width: 70, height: 70 });
    setAspectRatio('free');
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh] text-slate-800 dark:text-slate-100">
      {/* Aspect Ratio Toolbar */}
      <div className="flex flex-wrap gap-2 justify-between items-center bg-slate-100 dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 mb-4 shrink-0">
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] font-black uppercase text-slate-400 font-mono mr-1 flex items-center gap-1">
            <Maximize className="w-3 h-3 text-sky-500" /> Proporcioni:
          </span>
          {(['free', '1:1', '4:3', '16:9'] as const).map(ratio => (
            <button
              key={ratio}
              type="button"
              onClick={() => setAspectRatio(ratio)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                aspectRatio === ratio
                  ? 'bg-sky-500 text-white border-sky-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {ratio === 'free' ? 'I lirë' : ratio}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={handleRotate90}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-850 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
            title="Rrotullo imazhin 90° djathtas"
          >
            <RotateCw className="w-3.5 h-3.5 text-amber-500" /> Rrotullo 90°
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-850 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
            title="Rikthe në fillim"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" /> Rikthe
          </button>

          <button
            type="button"
            onClick={() => setShowSliders(!showSliders)}
            className={`p-1.5 rounded-lg border text-[10px] font-black uppercase flex items-center gap-1 transition-colors cursor-pointer ${
              showSliders 
                ? 'bg-indigo-500 text-white border-indigo-600' 
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> {showSliders ? 'Fshih Sliders' : 'Saktësi'}
          </button>
        </div>
      </div>

      {/* Editor Main Canvas Container */}
      <div className="relative flex-1 bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center p-4 border border-slate-800 min-h-[260px] md:min-h-[340px]">
        {/* We use overflow-hidden here to contain the giant crop box shadow clipping boundary */}
        <div ref={containerRef} className="relative select-none max-w-full max-h-full overflow-hidden rounded-md flex items-center justify-center">
          {/* Main Visual Image */}
          <img
            ref={imageRef}
            src={currentImageSrc}
            alt="Për prerje"
            draggable={false}
            className="max-h-[50vh] max-w-full object-contain rounded-md select-none transition-all duration-150"
          />

          {/* Transparent highlighted lit cropping region (Uses Box Shadow overlay for perfect contrast & no lags) */}
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            style={{
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${crop.width}%`,
              height: `${crop.height}%`,
            }}
            className="absolute border-2 border-dashed border-sky-400 cursor-move shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] rounded-xs z-20"
          >
            {/* Fine grids inside the crop zone */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-35 pointer-events-none">
              <div className="border-r border-b border-white/60" />
              <div className="border-r border-b border-white/60" />
              <div className="border-b border-white/60" />
              <div className="border-r border-b border-white/60" />
              <div className="border-r border-b border-white/60" />
              <div className="border-b border-white/60" />
              <div className="border-r border-white/60" />
              <div className="border-r border-white/60" />
              <div />
            </div>

            {/* Corner Resize Handles */}
            <div
              onMouseDown={(e) => handleResizeStart('nw', e)}
              onTouchStart={(e) => handleResizeStart('nw', e)}
              className="resize-handle absolute -top-1.5 -left-1.5 w-4 h-4 bg-white border-2 border-sky-500 rounded-full cursor-nwse-resize shadow-md z-30 hover:scale-125 transition-transform"
            />
            <div
              onMouseDown={(e) => handleResizeStart('ne', e)}
              onTouchStart={(e) => handleResizeStart('ne', e)}
              className="resize-handle absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-sky-500 rounded-full cursor-nesw-resize shadow-md z-30 hover:scale-125 transition-transform"
            />
            <div
              onMouseDown={(e) => handleResizeStart('sw', e)}
              onTouchStart={(e) => handleResizeStart('sw', e)}
              className="resize-handle absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-white border-2 border-sky-500 rounded-full cursor-nesw-resize shadow-md z-30 hover:scale-125 transition-transform"
            />
            <div
              onMouseDown={(e) => handleResizeStart('se', e)}
              onTouchStart={(e) => handleResizeStart('se', e)}
              className="resize-handle absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-sky-500 rounded-full cursor-nwse-resize shadow-md z-30 hover:scale-125 transition-transform"
            />

            {/* Edge Resize Handles */}
            <div
              onMouseDown={(e) => handleResizeStart('n', e)}
              onTouchStart={(e) => handleResizeStart('n', e)}
              className="resize-handle absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-white border border-sky-500 rounded-full cursor-ns-resize shadow-md z-30 hover:scale-110 transition-transform"
              title="Resizo lart"
            />
            <div
              onMouseDown={(e) => handleResizeStart('s', e)}
              onTouchStart={(e) => handleResizeStart('s', e)}
              className="resize-handle absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-white border border-sky-500 rounded-full cursor-ns-resize shadow-md z-30 hover:scale-110 transition-transform"
              title="Resizo poshtë"
            />
            <div
              onMouseDown={(e) => handleResizeStart('w', e)}
              onTouchStart={(e) => handleResizeStart('w', e)}
              className="resize-handle absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-8 bg-white border border-sky-500 rounded-full cursor-ew-resize shadow-md z-30 hover:scale-110 transition-transform"
              title="Resizo majtas"
            />
            <div
              onMouseDown={(e) => handleResizeStart('e', e)}
              onTouchStart={(e) => handleResizeStart('e', e)}
              className="resize-handle absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-8 bg-white border border-sky-500 rounded-full cursor-ew-resize shadow-md z-30 hover:scale-110 transition-transform"
              title="Resizo djathtas"
            />
          </div>
        </div>
      </div>

      {/* Sliding Precision Controls */}
      {showSliders && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0 text-xs">
          <div className="space-y-2">
            <div className="flex justify-between font-bold text-slate-500">
              <span>Pozicioni Horizontal (X):</span>
              <span className="font-mono text-sky-500">{Math.round(crop.x)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max={100 - crop.width}
              value={crop.x}
              onChange={(e) => setCrop(prev => ({ ...prev, x: parseInt(e.target.value) }))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />

            <div className="flex justify-between font-bold text-slate-500">
              <span>Pozicioni Vertikal (Y):</span>
              <span className="font-mono text-sky-500">{Math.round(crop.y)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max={100 - crop.height}
              value={crop.y}
              onChange={(e) => setCrop(prev => ({ ...prev, y: parseInt(e.target.value) }))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between font-bold text-slate-500">
              <span>Gjerësia (Width):</span>
              <span className="font-mono text-indigo-500">{Math.round(crop.width)}%</span>
            </div>
            <input
              type="range"
              min="5"
              max={100 - crop.x}
              value={crop.width}
              onChange={(e) => {
                const w = parseInt(e.target.value);
                setCrop(prev => ({ ...prev, width: w }));
              }}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />

            <div className="flex justify-between font-bold text-slate-500">
              <span>Lartësia (Height):</span>
              <span className="font-mono text-indigo-500">{Math.round(crop.height)}%</span>
            </div>
            <input
              type="range"
              min="5"
              max={100 - crop.y}
              value={crop.height}
              onChange={(e) => {
                const h = parseInt(e.target.value);
                setCrop(prev => ({ ...prev, height: h }));
              }}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Actions confirmation footer */}
      <div className="flex gap-3 justify-end mt-4 pt-3 border-t border-slate-150 dark:border-slate-850 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border-2 border-b-4 border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 text-xs font-black transition-all flex items-center gap-1.5 active:translate-y-[1px] cursor-pointer"
        >
          <X className="w-4 h-4" /> Anulo
        </button>
        <button
          type="button"
          onClick={handleCropConfirm}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-b-4 border-emerald-700 active:translate-y-[1px] text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Check className="w-4 h-4" /> Ruaj dhe Prit Imazhin ✂️
        </button>
      </div>
    </div>
  );
};
