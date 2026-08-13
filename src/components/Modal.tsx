import React, { useEffect, useRef } from 'react';

export interface ModalButton {
  label: string;
  variant?: 'primary' | 'danger' | 'cancel';
  onClick: () => void;
}

export interface ModalProps {
  isOpen: boolean;
  title: string;
  body: string;
  inputValue?: string;
  inputPlaceholder?: string;
  onInputChange?: (val: string) => void;
  buttons: ModalButton[];
  onClose: () => void;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  body,
  inputValue,
  inputPlaceholder,
  onInputChange,
  buttons,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputPlaceholder !== undefined) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, inputPlaceholder]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9980] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="generalModal"
        className="bg-white dark:bg-slate-900 border-2 border-b-8 border-slate-300 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-black text-slate-950 dark:text-white tracking-tight mb-2.5">
          {title}
        </h3>
        <p className="text-sm text-slate-800 dark:text-slate-200 font-bold leading-relaxed mb-6 whitespace-pre-wrap">
          {body}
        </p>

        {inputPlaceholder !== undefined && (
          <div className="mb-6">
            <input
              ref={inputRef}
              type="text"
              value={inputValue || ''}
              onChange={(e) => onInputChange?.(e.target.value)}
              placeholder={inputPlaceholder}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {buttons.map((btn, idx) => {
            let cls = 'bg-slate-100 dark:bg-slate-800 border-2 border-b-4 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700';
            if (btn.variant === 'primary') {
              cls = 'bg-sky-500 text-white hover:bg-sky-600 border-2 border-b-4 border-sky-700 shadow-sm';
            } else if (btn.variant === 'danger') {
              cls = 'bg-rose-500 text-white hover:bg-rose-600 border-2 border-b-4 border-rose-700 shadow-sm';
            }
            return (
              <button
                key={idx}
                type="button"
                onClick={btn.onClick}
                className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all active:translate-y-[2px] active:border-b-2 ${cls}`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
