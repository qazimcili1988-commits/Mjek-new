import React, { useState, useEffect } from 'react';
import { Category, Topic } from '../types';
import { GraduationCap, BookOpen, Layers } from 'lucide-react';

export interface TrainPickerModalProps {
  isOpen: boolean;
  categories: Category[];
  topics: Topic[];
  totalQuestionsCount: number;
  getQuestionCountForScope: (catId: string | null, topicId: string | null) => number;
  initialCount: number;
  onClose: () => void;
  onStart: (catId: string | null, topicId: string | null, count: number) => void;
}

export const TrainPickerModal: React.FC<TrainPickerModalProps> = ({
  isOpen,
  categories,
  topics,
  totalQuestionsCount,
  getQuestionCountForScope,
  initialCount,
  onClose,
  onStart,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState<number>(initialCount || 15);

  const activeTopics = selectedCatId
    ? topics.filter((t) => t.catId === selectedCatId)
    : [];

  const availableCount = getQuestionCountForScope(selectedCatId, selectedTopicId);

  // Compute preset lists dynamically
  const rawPresets = [5, 10, 15, 20, 30, 50];
  const presets = rawPresets.filter((p) => p <= availableCount);

  if (availableCount > 0 && !presets.includes(availableCount) && availableCount < 50) {
    presets.push(availableCount);
  }
  presets.sort((a, b) => a - b);

  // Auto-clamp or adjust selected count when category/topic changes
  useEffect(() => {
    if (availableCount === 0) return;
    if (selectedCount > availableCount) {
      // clamp to max available or nearest preset
      const fallback = presets[presets.length - 1] || availableCount;
      setSelectedCount(fallback);
    } else if (selectedCount < 5 && availableCount >= 5) {
      setSelectedCount(5);
    } else if (availableCount > 0 && !presets.includes(selectedCount)) {
      // Find closest preset or fallback to available
      const closest = presets.reduce((prev, curr) => 
        Math.abs(curr - selectedCount) < Math.abs(prev - selectedCount) ? curr : prev
      , presets[0] || availableCount);
      setSelectedCount(closest);
    }
  }, [selectedCatId, selectedTopicId, availableCount]);

  if (!isOpen) return null;

  const selectedCategoryObj = categories.find((c) => c.id === selectedCatId);
  const selectedTopicObj = topics.find((t) => t.id === selectedTopicId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9980] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="trainPickerModal"
        className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 border-b-8 rounded-3xl p-6 w-full max-w-md shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-5 h-5 text-[#58cc02]" />
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Stërvitje e Thjeshtë
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed font-bold">
          Mësoni me shpjegime klinike pas çdo pyetjeje. Filtroni sipas degës apo temës suaj të preferuar.
        </p>

        {/* SELECT: Category */}
        <div className="mb-4">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 block mb-1.5 uppercase tracking-widest font-mono">
            Kategoria (Dega)
          </label>
          <div className="relative">
            <select
              value={selectedCatId || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCatId(val || null);
                setSelectedTopicId(null);
              }}
              className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500 dark:focus:border-sky-500 transition-all appearance-none cursor-pointer"
            >
              <option value="">Të gjitha kategoritë ({totalQuestionsCount} pyetje)</option>
              {categories.map((cat) => {
                const count = getQuestionCountForScope(cat.id, null);
                if (count === 0) return null;
                return (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({count} pyetje)
                  </option>
                );
              })}
            </select>
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-xs text-slate-400 font-bold">
              ▼
            </div>
          </div>
        </div>

        {/* SELECT: Topic */}
        {selectedCatId && activeTopics.length > 0 && (
          <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-150">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 block mb-1.5 uppercase tracking-widest font-mono">
              Tema specifike <span className="font-normal text-slate-400 lowercase">(opsionale)</span>
            </label>
            <div className="relative">
              <select
                value={selectedTopicId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTopicId(val || null);
                }}
                className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500 dark:focus:border-sky-500 transition-all appearance-none cursor-pointer"
              >
                <option value="">Të gjitha temat e kësaj kategorie</option>
                {activeTopics.map((topic) => {
                  const count = getQuestionCountForScope(selectedCatId, topic.id);
                  if (count === 0) return null;
                  return (
                    <option key={topic.id} value={topic.id}>
                      {topic.name} ({count} pyetje)
                    </option>
                  );
                })}
              </select>
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
                <BookOpen className="w-4 h-4 text-slate-400" />
              </div>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-xs text-slate-400 font-bold">
                ▼
              </div>
            </div>
          </div>
        )}

        {/* PRESETS: Question count */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
              Numri i pyetjeve
            </span>
            <span className="text-xs font-black text-[#58cc02] dark:text-[#6ee7b7] font-mono">
              {availableCount} në dispozicion
            </span>
          </div>

          {availableCount === 0 ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/20 text-center text-xs text-rose-600 dark:text-rose-400 font-bold">
              Nuk ka pyetje të disponueshme për këtë kombinim.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {presets.map((n) => {
                const isSel = selectedCount === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelectedCount(n)}
                    className={`py-2.5 rounded-2xl font-black text-sm font-mono tabular-nums transition-all border-2 border-b-4 active:scale-95 active:translate-y-[2px] active:border-b-2 ${
                      isSel
                        ? 'border-[#46a302] bg-[#58cc02] text-white'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Scope info badge */}
        {availableCount > 0 && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-6 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-left font-bold leading-normal">
            📚 Duke stërvitur me{' '}
            <span className="text-slate-800 dark:text-white font-extrabold font-mono text-xs">
              {selectedCount}
            </span>{' '}
            pyetje nga{' '}
            <span className="text-[#58cc02] dark:text-[#6ee7b7] font-extrabold">
              {selectedTopicId && selectedTopicObj
                ? `tema "${selectedTopicObj.name}"`
                : selectedCatId && selectedCategoryObj
                ? `kategoria "${selectedCategoryObj.name}"`
                : 'të gjitha kategoritë'}
            </span>
            .
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-800 border-b-4 hover:bg-slate-50 dark:hover:bg-slate-800 font-black text-sm text-slate-500 transition-all active:translate-y-[2px] active:border-b-0"
          >
            Anulo
          </button>
          <button
            type="button"
            disabled={availableCount === 0}
            onClick={() => onStart(selectedCatId, selectedTopicId, selectedCount)}
            className="flex-[2] py-3 rounded-2xl bg-[#58cc02] hover:bg-[#46a302] disabled:opacity-40 text-white font-black text-sm border-2 border-b-4 border-[#3d8c02] transition-all active:translate-y-[2px] active:border-b-0 shadow-sm"
          >
            Fillo Stërvitjen →
          </button>
        </div>
      </div>
    </div>
  );
};
