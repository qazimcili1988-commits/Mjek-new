import React from 'react';
import { ActiveSession, Question, UserProgress } from '../types';
import { CheckCircle2, XCircle, BookOpen, ArrowRight, Bookmark, AlertTriangle } from 'lucide-react';
import { formatInterval, sm2Update } from '../utils/storage';

export interface ExplanationScreenProps {
  session: ActiveSession;
  progress: UserProgress;
  onToggleBookmark: () => void;
  onRateSR?: (quality: number) => void;
  onNext: () => void;
  onExit: () => void;
  onReportError?: () => void;
}

export const ExplanationScreen: React.FC<ExplanationScreenProps> = ({
  session,
  progress,
  onToggleBookmark,
  onRateSR,
  onNext,
  onExit,
  onReportError,
}) => {
  const { questions, currentIndex, answers, mode } = session;
  const currentQ: Question | undefined = questions[currentIndex];
  const total = questions.length;

  if (!currentQ) return null;

  const [isExplanationLoaded, setIsExplanationLoaded] = React.useState(false);

  React.useEffect(() => {
    setIsExplanationLoaded(false);
    const timer = setTimeout(() => {
      setIsExplanationLoaded(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  const isBookmarked = progress.bookmarkIds.includes(currentQ.id);
  const currentLog = answers[answers.length - 1];
  const isCorrect = currentLog?.correct === 1;
  const letters = ['A', 'B', 'C', 'D'];
  const isSRMode = mode === 'sr' || mode === 'adaptive';

  // Preview intervals for SM2 rating buttons
  const prevCard = session.pendingSRCard?.prevCard || { interval: 1, ef: 2.5, reps: 0, nextReview: 0, lapses: 0 };
  const intEasy = formatInterval(sm2Update(prevCard, 3, false).interval);
  const intGood = formatInterval(sm2Update(prevCard, 2, false).interval);
  const intHard = formatInterval(sm2Update(prevCard, 1, false).interval);

  return (
    <main className="max-w-[480px] mx-auto px-4 pb-24 animate-in fade-in duration-200">
      {/* Header bar */}
      <div className="flex items-center justify-between py-3 px-1 mb-2">
        <button
          type="button"
          onClick={onExit}
          className="px-4 py-1.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-b-4 text-rose-500 font-black text-xs transition-all active:translate-y-[2px] active:border-b-0"
        >
          ✕ Dil
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleBookmark}
            aria-label={isBookmarked ? 'Hiq shënimin' : 'Shëno pyetjen'}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all select-none ${
              isBookmarked
                ? 'bg-[#ffc800] border-b-4 border-[#e6b000] text-slate-900 active:translate-y-[2px] active:border-b-0'
                : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-b-4 text-slate-500 active:translate-y-[2px] active:border-b-0'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-slate-900 text-slate-900' : ''}`} />
            <span>{isBookmarked ? 'Shënuar' : 'Shëno'}</span>
          </button>

          {onReportError && (
            <button
              type="button"
              onClick={onReportError}
              aria-label="Raporto gabim"
              className="px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 bg-rose-500/10 dark:bg-rose-500/20 border-2 border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 active:translate-y-[2px] transition-all select-none"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Raporto</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 font-mono text-xs font-black text-slate-500 uppercase tracking-wide">
            <span>{isSRMode ? `🧠 ${currentIndex + 1}/${total}` : `${currentIndex + 1}/${total}`}</span>
          </div>
        </div>
      </div>

      {/* Progress track */}
      <div className="w-full h-4 bg-[#e5e5e5] dark:bg-slate-800 rounded-full overflow-hidden mb-5 p-1 border-2 border-slate-200/50 dark:border-slate-800">
        <div
          className="h-full bg-[var(--duo-green)] rounded-full transition-all duration-300 border-r-2 border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)]"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      {/* Result Banner */}
      <div className={`p-5 rounded-2xl mb-4 flex items-center gap-4 border-2 shadow-sm ${
        isCorrect
          ? 'bg-[var(--comfort-green-bg)] border-[var(--comfort-green-border)] text-[var(--comfort-green-text)]'
          : 'bg-[var(--comfort-red-bg)] border-[var(--comfort-red-border)] text-[var(--comfort-red-text)]'
      }`}>
        {isCorrect ? (
          <CheckCircle2 className="w-6 h-6 text-[var(--duo-green)] shrink-0" />
        ) : (
          <XCircle className="w-6 h-6 text-[var(--duo-red)] shrink-0" />
        )}
        <div>
          <h2 className="font-black text-lg tracking-tight">
            {isCorrect ? 'Saktë! 🎉' : 'Gabim'}
          </h2>
          <p className="text-xs font-bold opacity-90">
            {isCorrect ? 'Arsyetimi yt klinik u konfirmua.' : `Zgjodhe opsionin e gabuar.`}
          </p>
        </div>
      </div>

      {/* Correct answer callout */}
      <div className="bg-[#ddf4ff] border-2 border-[#84d8ff] dark:bg-[#1cb0f6]/10 dark:border-[#1cb0f6] rounded-2xl p-4 mb-4 shadow-sm text-[#1899d6] dark:text-[#7bd3ff]">
        <div className="text-[10px] font-black uppercase tracking-wider mb-1 flex items-center gap-1.5 font-mono">
          <span>✓ Përgjigja e saktë</span>
        </div>
        <div className="text-sm font-extrabold leading-relaxed">
          {letters[currentQ.answer]}. {currentQ.options[currentQ.answer]}
        </div>
      </div>

      {/* Render Figure/Diagram if available */}
      {currentQ.svgMarkup && (
        <div className="duo-card p-4 mb-4 bg-white border-2 border-slate-200 rounded-2xl flex flex-col items-center justify-center overflow-hidden text-slate-950 shadow-xs">
          <div className="text-xs font-black uppercase tracking-wider font-mono text-slate-500 mb-3 self-start">
            Visualizimi i Pyetjes 📐
          </div>
          <div 
            className="w-full flex items-center justify-center svg-container [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-56 [&>svg]:mx-auto"
            dangerouslySetInnerHTML={{ __html: currentQ.svgMarkup }}
          />
        </div>
      )}
      {currentQ.imageUrl && (
        <div className="duo-card p-4 mb-4 bg-white border-2 border-slate-200 rounded-2xl flex flex-col items-center justify-center overflow-hidden text-slate-950 shadow-xs">
          <div className="text-xs font-black uppercase tracking-wider font-mono text-slate-500 mb-3 self-start">
            Visualizimi i Pyetjes 📐
          </div>
          <img
            src={currentQ.imageUrl}
            alt="Diagrama e pyetjes"
            referrerPolicy="no-referrer"
            className="max-h-56 object-contain rounded-lg shadow-xs"
          />
        </div>
      )}

      {/* Clinical Rationale Card */}
      <div className="duo-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400">
          <BookOpen className="w-4 h-4 text-[#1cb0f6]" />
          <span className="text-xs font-black uppercase tracking-wider font-mono">
            Shpjegim Klinik
          </span>
        </div>
        {isExplanationLoaded ? (
          <p className="text-sm text-slate-700 dark:text-slate-300 font-bold leading-relaxed whitespace-pre-wrap select-none animate-in fade-in duration-300">
            {currentQ.exp}
          </p>
        ) : (
          <div className="space-y-2 animate-pulse py-2">
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-full" />
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-5/6" />
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-4/5" />
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold font-mono">Duke ngarkuar shpjegimin akademik...</span>
          </div>
        )}
      </div>

      {/* Spaced Repetition Rating Buttons if in SR mode */}
      {isSRMode && onRateSR ? (
        <div className="mb-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* SM-2 Telemetria */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800/80 rounded-xl p-3 mb-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="text-left space-y-0.5">
              <div className="text-[9px] font-black tracking-wider uppercase text-slate-400 font-mono">Statusi i Përsëritjes (SM-2)</div>
              <div className="font-extrabold text-slate-700 dark:text-slate-300">
                {prevCard.reps === 0 ? 'Pyetje e Re 🆕' : `Rishikuar ${prevCard.reps} ${prevCard.reps === 1 ? 'herë' : 'herë'}`}
              </div>
            </div>
            <div className="flex gap-4 text-right">
              <div>
                <span className="text-[9px] font-black block text-slate-400 font-mono">FAKTORI EF</span>
                <span className="font-mono font-black text-slate-700 dark:text-slate-300">{prevCard.ef.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[9px] font-black block text-slate-400 font-mono">INTERVALI</span>
                <span className="font-mono font-black text-slate-700 dark:text-slate-300">{prevCard.interval} {prevCard.interval === 1 ? 'ditë' : 'ditë'}</span>
              </div>
              {prevCard.lapses !== undefined && prevCard.lapses > 0 && (
                <div>
                  <span className="text-[9px] font-black block text-rose-400 font-mono">LAPSUS</span>
                  <span className="font-mono font-black text-rose-500">{prevCard.lapses}⚠️</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs font-black uppercase tracking-wider font-mono text-center text-slate-500 dark:text-slate-400 mb-3">
            {isCorrect ? 'Sa i sigurt ishe në këtë përgjigje?' : 'Sa afër ishe njohurive?'}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {isCorrect ? (
              <>
                <button
                  type="button"
                  onClick={() => onRateSR(3)}
                  className="p-4 duo-btn-green text-center text-xs flex flex-col items-center justify-center gap-0.5"
                >
                  <div className="text-sm font-black">⭐ Lehtë</div>
                  <div className="text-[10px] opacity-90 font-mono mt-0.5">Pas {intEasy}</div>
                </button>

                <button
                  type="button"
                  onClick={() => onRateSR(2)}
                  className="p-4 duo-btn-blue text-center text-xs flex flex-col items-center justify-center gap-0.5"
                >
                  <div className="text-sm font-black">🟢 Mirë</div>
                  <div className="text-[10px] opacity-90 font-mono mt-0.5">Pas {intGood}</div>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onRateSR(1)}
                  className="p-4 duo-btn-orange text-center text-xs flex flex-col items-center justify-center gap-0.5"
                >
                  <div className="text-sm font-black">🟡 Vështirë</div>
                  <div className="text-[10px] opacity-90 font-mono mt-0.5">Pas {intHard}</div>
                </button>

                <button
                  type="button"
                  onClick={() => onRateSR(0)}
                  className="p-4 duo-btn-red text-center text-xs flex flex-col items-center justify-center gap-0.5"
                >
                  <div className="text-sm font-black">🔴 Sërisht</div>
                  <div className="text-[10px] opacity-90 font-mono mt-0.5">nesër</div>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onNext}
          className="w-full py-4 duo-btn-green text-base flex items-center justify-center gap-2 select-none"
        >
          <span>{currentIndex === total - 1 ? 'Përfundo Sesionin ✓' : 'Pyetja Tjetër'}</span>
          {currentIndex !== total - 1 && <ArrowRight className="w-5 h-5" />}
        </button>
      )}
    </main>
  );
};
