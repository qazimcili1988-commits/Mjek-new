import React, { useState } from 'react';
import { Category, QuizMode, Topic } from '../types';
import { BookOpen, Globe, Target } from 'lucide-react';

export interface CustomQuizModalProps {
  isOpen: boolean;
  categories: Category[];
  topics: Topic[];
  totalQuestionsCount: number;
  getQuestionCountForScope: (catId: string | null, topicId: string | null) => number;
  onClose: () => void;
  onStart: (catId: string | null, topicId: string | null, count: number, subMode: QuizMode) => void;
}

export const CustomQuizModal: React.FC<CustomQuizModalProps> = ({
  isOpen,
  categories,
  topics,
  totalQuestionsCount,
  getQuestionCountForScope,
  onClose,
  onStart,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [subMode, setSubMode] = useState<QuizMode>('test');

  if (!isOpen) return null;

  const activeTopics = selectedCatId
    ? topics.filter((t) => t.catId === selectedCatId)
    : [];

  const availableCount = getQuestionCountForScope(selectedCatId, selectedTopicId);

  const scopeName = selectedTopicId
    ? `temën "${topics.find((t) => t.id === selectedTopicId)?.name || ''}"`
    : selectedCatId
    ? `kategorinë "${categories.find((c) => c.id === selectedCatId)?.name || ''}"`
    : 'të gjitha kategoritë';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9980] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="customQuizModal"
        className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 border-b-8 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-5 h-5 text-sky-500" />
          <h2 className="text-xl font-black text-slate-950 dark:text-white tracking-tight">
            Quiz i Personalizuar
          </h2>
        </div>
        <p className="text-xs text-slate-650 dark:text-slate-300 mb-5 font-bold leading-normal">
          Zgjidh kategorinë ose temën (opsionale) për të filluar përgatitjen e plotë.
        </p>

        {/* Category picker */}
        <div className="mb-5">
          <label className="text-xs font-black text-slate-600 dark:text-slate-300 block mb-2 uppercase tracking-wider font-mono">
            Kategoria
          </label>
          <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => {
                setSelectedCatId(null);
                setSelectedTopicId(null);
              }}
              className={`flex items-center gap-3 p-3 rounded-2xl border-2 border-b-4 text-left transition-all active:translate-y-[2px] active:border-b-2 ${
                selectedCatId === null
                  ? 'border-sky-400 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 font-black'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:bg-slate-100/80 text-slate-850 dark:text-slate-200'
              }`}
            >
              <Globe className="w-4 h-4 text-sky-500 shrink-0" />
              <span className="flex-1 text-sm font-bold truncate">Të gjitha kategoritë</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-black font-mono">
                {totalQuestionsCount} pyetje
              </span>
            </button>

            {categories.map((cat) => {
              const catQCount = getQuestionCountForScope(cat.id, null);
              if (catQCount === 0) return null;
              const isSelected = selectedCatId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCatId(cat.id);
                    setSelectedTopicId(null);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-2xl border-2 border-b-4 text-left transition-all active:translate-y-[2px] active:border-b-2 ${
                    isSelected
                      ? 'border-sky-400 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 font-black'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:bg-slate-100/80 text-slate-850 dark:text-slate-200'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color || '#3B82F6' }}
                  />
                  <span className="flex-1 text-sm font-bold truncate">{cat.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-black font-mono">
                    {catQCount} pyetje
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Topic picker */}
        {selectedCatId && activeTopics.length > 0 && (
          <div className="mb-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <label className="text-xs font-black text-slate-600 dark:text-slate-300 block mb-2 uppercase tracking-wider font-mono">
              Tema <span className="font-normal text-slate-500">(opsionale)</span>
            </label>
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setSelectedTopicId(null)}
                className={`flex items-center gap-2.5 p-2.5 rounded-2xl border-2 border-b-4 text-left text-xs transition-all active:translate-y-[2px] active:border-b-2 ${
                  selectedTopicId === null
                    ? 'border-sky-400 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 font-black'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:bg-slate-100/80 text-slate-800 dark:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span className="flex-1 font-bold truncate">Të gjitha temat brenda kategorisë</span>
              </button>

              {activeTopics.map((topic) => {
                const topicQCount = getQuestionCountForScope(selectedCatId, topic.id);
                if (topicQCount === 0) return null;
                const isSel = selectedTopicId === topic.id;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl border-2 border-b-4 text-left text-xs transition-all active:translate-y-[2px] active:border-b-2 ${
                      isSel
                        ? 'border-sky-400 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 font-black'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:bg-slate-100/80 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-sky-500/60 shrink-0" />
                    <span className="flex-1 font-semibold truncate">{topic.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black font-mono">
                      {topicQCount}p
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="mb-6">
          <label className="text-xs font-black text-slate-600 dark:text-slate-300 block mb-2 uppercase tracking-wider font-mono">
            Lloji i sesionit
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSubMode('test')}
              className={`p-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border-2 border-b-4 transition-all active:translate-y-[2px] active:border-b-2 ${
                subMode === 'test'
                  ? 'border-sky-500 bg-sky-500 hover:bg-sky-600 text-white shadow-sm'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:bg-slate-100/80 text-slate-800 dark:text-slate-200'
              }`}
            >
              <span>📝</span> Testim (pa pauzë)
            </button>
            <button
              type="button"
              onClick={() => setSubMode('train')}
              className={`p-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border-2 border-b-4 transition-all active:translate-y-[2px] active:border-b-2 ${
                subMode === 'train'
                  ? 'border-sky-500 bg-sky-500 hover:bg-sky-600 text-white shadow-sm'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:bg-slate-100/80 text-slate-800 dark:text-slate-200'
              }`}
            >
              <span>🎓</span> Stërvitje (me shpjegim)
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-850 dark:text-slate-200 mb-6 bg-sky-500/10 p-3.5 rounded-2xl border-2 border-sky-400/30 font-extrabold leading-relaxed">
          💡 {availableCount} pyetje në total nga {scopeName}. Do të zhvillohen të gjitha pyetjet (nga 1 deri në {availableCount}).
        </div>

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
            onClick={() => onStart(selectedCatId, selectedTopicId, availableCount, subMode)}
            className="flex-[2] py-3 rounded-2xl bg-[#58cc02] hover:bg-[#46a302] disabled:opacity-50 text-white font-black text-sm border-2 border-b-4 border-[#3d8c02] transition-all active:translate-y-[2px] active:border-b-0 shadow-sm flex items-center justify-center gap-2"
          >
            Fillo Kuizin →
          </button>
        </div>
      </div>
    </div>
  );
};
