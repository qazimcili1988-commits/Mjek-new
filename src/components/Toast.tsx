import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'warn' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  onClose,
  duration = 3500,
}) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const bgMap = {
    success: 'bg-emerald-800 border-emerald-600',
    warn: 'bg-amber-800 border-amber-600',
    error: 'bg-rose-900 border-rose-700',
    info: 'bg-slate-800 border-slate-600',
  };

  const textStyle = {
    success: { color: '#f0fdf4' }, // very bright mint/green
    warn: { color: '#fffbeb' },    // bright amber
    error: { color: '#fff1f2' },   // bright rose
    info: { color: '#f8fafc' },    // bright clean off-white
  }[type];

  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#4ade80' }} />,
    warn: <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#fbbf24' }} />,
    error: <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#f87171' }} />,
    info: <Info className="w-4 h-4 shrink-0" style={{ color: '#38bdf8' }} />,
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full shadow-xl flex items-center gap-3 text-sm font-semibold z-[9999] border transition-all animate-bounce duration-200 max-w-[90vw] ${bgMap[type]}`}
      style={textStyle}
    >
      {iconMap[type]}
      <span className="truncate">{message}</span>
    </div>
  );
};
