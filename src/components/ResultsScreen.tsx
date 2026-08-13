import React from 'react';
import { ActiveSession, AnswerLog, UserProgress } from '../types';
import { CheckCircle, XCircle, ArrowRight, RefreshCw, BookOpen, RotateCcw, Home, Award } from 'lucide-react';
import { getQuestions } from '../utils/storage';

export interface ResultsScreenProps {
  session: ActiveSession;
  progress: UserProgress;
  onRestartWrong: () => void;
  onSwitchToTrain: () => void;
  onGoHome: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  session,
  progress,
  onRestartWrong,
  onSwitchToTrain,
  onGoHome,
}) => {
  const { answers, mode } = session;
  const total = answers.length;
  const correctCount = answers.filter((a) => a.correct === 1).length;
  const wrongCount = total - correctCount;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const passed = pct >= 70;

  const letters = ['A', 'B', 'C', 'D'];

  // Motivational message
  const getMotivationalMsg = () => {
    if (pct >= 90) return 'Performancë e shkëlqyer! Je absolutisht gati për provimin kombëtar.';
    if (pct >= 80) return 'Rezultat shumë i mirë! Me këtë saktësi kalon me sukses çdo provim.';
    if (pct >= 70) return 'Kaluat! Ke arritur pragun minimal të kalueshmërisë, por vazhdo të rishikosh.';
    if (pct >= 50) return 'Vazhdo stërvitjen — po bën progres, por të duhet më shumë siguri në teori.';
    return 'Mos u dorëzo — çdo gabim është një mundësi për të mësuar shpjegimin klinik.';
  };

  // SR Session statistics
  const getSRStatsSummary = () => {
    if (mode !== 'sr') return null;
    const hist = progress.history || [];
    const todayStr = new Date().toDateString();
    const todayDone = hist.filter((h) => h.date === todayStr).reduce((s, h) => s + h.done, 0);
    return {
      todayDone,
    };
  };

  const srSummary = getSRStatsSummary();

  return (
    <div className="max-w-md mx-auto px-4 py-8 pb-24" id="resultsScreen" role="main" aria-label="Rezultatet e sesionit">
      {/* HEADER */}
      <div className="text-center mb-8">
        <span className="text-5xl block mb-4 animate-bounce" style={{ animationDuration: '2.5s' }} role="img" aria-hidden="true">
          {pct >= 80 ? '🦉' : pct >= 70 ? '🎉' : pct >= 50 ? '📚' : '😓'}
        </span>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Sesioni Përfundoi</h1>
        <p className="text-xs font-black uppercase tracking-wider text-slate-400 mt-1.5 font-mono">
          Raundi: <span className="text-[#1cb0f6]">{mode === 'sr' ? 'Spaced Repetition' : mode === 'wrong' ? 'Korrigjim Gabimesh' : mode === 'bookmarks' ? 'Të Shënuara' : mode}</span>
        </p>
        <p className="text-sm italic text-slate-600 dark:text-slate-300 mt-4 px-4 font-bold leading-relaxed">
          "{getMotivationalMsg()}"
        </p>
      </div>

      {/* CIRCULAR PROGRESS */}
      <div className="flex justify-center mb-8">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 110 110">
            <circle
              cx="55"
              cy="55"
              r="44"
              className="stroke-[#e5e5e5] dark:stroke-slate-800"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="55"
              cy="55"
              r="44"
              stroke={pct >= 70 ? '#58cc02' : pct >= 50 ? '#ff9600' : '#ff4b4b'}
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={276}
              strokeDashoffset={276 - (pct / 100) * 276}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{pct}%</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mt-0.5">Saktësia</span>
          </div>
        </div>
      </div>

      {/* STATS CHIPS */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="duo-card p-4 text-center">
          <span className="text-3xl font-black text-[#58cc02] block">{correctCount}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-black font-mono">Saktë</span>
        </div>
        <div className="duo-card p-4 text-center">
          <span className="text-3xl font-black text-[#ff4b4b] block">{wrongCount}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-black font-mono">Gabim</span>
        </div>
      </div>

      {/* SR Mode Summary if applicable */}
      {srSummary && (
        <div className="duo-card p-4 mb-6 text-center border-[#1cb0f6]/30 bg-[#ddf4ff]/40 dark:bg-[#1cb0f6]/10">
          <span className="text-xs font-black text-[#1cb0f6] uppercase tracking-wider block mb-1 font-mono">
            🧠 Progresi Spaced Repetition sot
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
            Sot keni rishikuar <strong className="font-extrabold font-mono text-[#1cb0f6]">{answers.length}</strong> pyetje të vjetra dhe të reja. Sistemi do të përcaktojë intervalet e ardhshme automatikisht sipas vlerësimit tuaj.
          </p>
        </div>
      )}

      {/* RECOMMENDED FOR STUDY ACTIONS */}
      {!passed && mode !== 'wrong' && (
        <div className="duo-card p-5 mb-6 border-[#ff9600]/30 bg-[#fff5e6]/30 dark:bg-[#ff9600]/10">
          <h4 className="text-xs font-black text-[#ff9600] uppercase tracking-wider mb-1 flex items-center gap-1.5 font-mono">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Këshillë: Përdor Stërvitjen</span>
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed mb-3.5">
            Rezultati yt është nën 70%. Stërvitja të jep shpjegimin pas çdo pyetjeje — ideale për të ndërtuar njohuritë klinike.
          </p>
          <button
            type="button"
            onClick={onSwitchToTrain}
            className="w-full py-3 duo-btn-orange text-xs text-white"
          >
            Fillo Modalitetin Stërvitje
          </button>
        </div>
      )}

      {/* Repeat incorrect questions */}
      {wrongCount > 0 && (
        <div className="duo-card p-5 mb-6 border-[#ff9600]/30 bg-[#fff5e6]/30 dark:bg-[#ff9600]/10">
          <h4 className="text-xs font-black text-[#ff9600] uppercase tracking-wider mb-1 flex items-center gap-1.5 font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '5s' }} />
            <span>Përmirëso Gabimet ({wrongCount})</span>
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed mb-3.5">
            Mënyra më e shpejtë për të mësuar është rishikimi i menjëhershëm i pyetjeve të gabuara të këtij raundi.
          </p>
          <button
            type="button"
            onClick={onRestartWrong}
            className="w-full py-3 duo-btn-orange text-xs text-white"
          >
            Ripërsërit Pyetjet e Gabuara
          </button>
        </div>
      )}

      {/* REVIEW LIST */}
      <div className="mb-8">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3.5 font-mono">Rishiko Pyetjet e Raundit</h3>
        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          {answers.map((ans: AnswerLog, i: number) => {
            return (
              <div
                key={ans.question.id}
                className={`duo-card p-4 border-l-8 ${
                  ans.correct
                    ? 'border-l-[var(--duo-green)] border-[var(--duo-green)]/20'
                    : 'border-l-[var(--duo-red)] border-[var(--duo-red)]/20'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md ${
                    ans.correct ? 'bg-[var(--comfort-green-bg)] text-[var(--comfort-green-text)]' : 'bg-[var(--comfort-red-bg)] text-[var(--comfort-red-text)]'
                  }`}>
                    P{i + 1}
                  </span>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 leading-relaxed">
                    {ans.question.text}
                  </div>
                </div>

                <div className="space-y-1 pl-7">
                  <div className={`text-xs font-bold ${ans.correct ? 'text-[var(--comfort-green-text)]' : 'text-[var(--comfort-red-text)]'}`}>
                    {ans.correct ? '✓' : '✗'} Përgjigja jote: {letters[ans.selected]}. {ans.question.options[ans.selected]}
                  </div>
                  {!ans.correct && (
                    <div className="text-xs font-black text-[var(--comfort-green-text)]">
                      ✓ E sakta: {letters[ans.question.answer]}. {ans.question.options[ans.question.answer]}
                    </div>
                  )}
                </div>

                {/* Explanation */}
                <div className="mt-3 pl-7 border-t border-dashed border-slate-200 dark:border-slate-800 pt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold italic">
                  <strong>Shpjegimi:</strong> {ans.question.exp}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CORE ACTION GO HOME */}
      <button
        type="button"
        onClick={onGoHome}
        className="w-full py-4 duo-btn-blue text-base flex items-center justify-center gap-2 select-none"
      >
        <Home className="w-4 h-4" /> Kthehu në Fillim
      </button>
    </div>
  );
};
