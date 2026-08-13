import React from 'react';
import { ActiveSession, Question, UserProgress } from '../types';
import { Bookmark, CheckCircle2, XCircle, LogOut, Clock, AlertTriangle } from 'lucide-react';
import { formatInterval } from '../utils/storage';

export interface QuizScreenProps {
  session: ActiveSession;
  progress: UserProgress;
  examRemainingSeconds: number | null;
  onSelectOption: (idx: number) => void;
  onSubmitAnswer: () => void;
  onNextQuestion: () => void;
  onToggleBookmark: () => void;
  onExitQuiz: () => void;
  onReportError?: () => void;
}

export const QuizScreen: React.FC<QuizScreenProps> = ({
  session,
  progress,
  examRemainingSeconds,
  onSelectOption,
  onSubmitAnswer,
  onNextQuestion,
  onToggleBookmark,
  onExitQuiz,
  onReportError,
}) => {
  const { questions, currentIndex, selectedOption, answered, answers, mode } = session;
  const currentQ: Question | undefined = questions[currentIndex];
  const total = questions.length;

  if (!currentQ) return null;

  const isBookmarked = progress.bookmarkIds.includes(currentQ.id);
  const isTestMode = mode === 'test';
  const letters = ['A', 'B', 'C', 'D'];

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const currentAnswerLog = answers.find((a) => a.question.id === currentQ.id);
  const isAnswerCorrect = currentAnswerLog?.correct === 1;

  // SR Card preview info if in SR mode
  const srCard = progress.srCards[currentQ.id];

  return (
    <main className="max-w-[480px] mx-auto px-4 pb-20 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-[#1cb0f6] text-white rounded-2xl p-4 border-b-4 border-[#1899d6] mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-spin" style={{ animationDuration: '6s' }} aria-hidden="true">🦉</span>
          <div>
            <div className="text-[10px] font-black tracking-wider text-[#ddf4ff] uppercase font-mono">
              {session.customTitle || 'Simulim Provimi'}
            </div>
            <div className="text-sm font-black text-white flex items-center gap-2">
              <span>{isTestMode ? 'Testim Kombëtar' : mode === 'sr' ? 'Spaced Repetition' : 'Stërvitje Klinike'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {examRemainingSeconds !== null && (
            <div className={`px-3 py-1.5 rounded-xl font-mono font-black text-sm flex items-center gap-1.5 ${
              examRemainingSeconds <= 60 ? 'bg-rose-600 text-white animate-pulse' : examRemainingSeconds <= 300 ? 'bg-[#ff9600] text-white border-b-2 border-[#e27a00]' : 'bg-[#1899d6] text-white'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(examRemainingSeconds)}</span>
            </div>
          )}

          <div className="bg-[#1279ab] px-3 py-1.5 rounded-xl font-mono text-xs text-[#ddf4ff] font-black">
            <span className="text-white text-sm font-black">{currentIndex + 1}</span> / {total}
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

      {/* Question Card */}
      <div className="duo-card p-5 mb-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-black text-[#1cb0f6] dark:text-[#7bd3ff] uppercase tracking-wider font-mono">
            Pyetja {currentIndex + 1}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleBookmark}
              aria-label={isBookmarked ? 'Hiq shënimin' : 'Shëno pyetjen'}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all select-none ${
                isBookmarked
                  ? 'bg-[#ffc800] border-b-4 border-[#e6b000] text-slate-900 active:translate-y-[2px] active:border-b-0'
                  : 'bg-[#3c4d5c] dark:bg-slate-700 border-b-4 border-[#25303b] dark:border-slate-800 text-white hover:bg-[#4c5e6f] active:translate-y-[2px] active:border-b-0'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-slate-900 text-slate-900' : 'text-white'}`} />
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

            <button
              type="button"
              onClick={onExitQuiz}
              aria-label="Dil nga sesioni"
              className="px-5 py-2 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-b-4 text-rose-500 font-black text-sm transition-all active:translate-y-[2px] active:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              ✕ Dil
            </button>
          </div>
        </div>

        {mode === 'sr' && (
          <div className="flex flex-wrap gap-2 items-center text-[11px] text-slate-500 dark:text-slate-400 mb-3 bg-[#f1f3f4] dark:bg-slate-800/60 p-2.5 rounded-xl font-mono">
            <span className="bg-[#1cb0f6]/10 text-[#1cb0f6] dark:text-[#7bd3ff] px-2 py-0.5 rounded-md font-black">
              🧠 {srCard?.reps ? 'Rishikim' : 'Karta e Re'}
            </span>
            <span>⏱ Intervali paraprak: {srCard ? formatInterval(srCard.interval) : 'nesër'}</span>
            <span>Reps: {srCard?.reps || 0}</span>
          </div>
        )}

        <p className="text-base font-extrabold text-slate-900 dark:text-slate-100 leading-relaxed select-none">
          {currentQ.text}
        </p>

        {/* Render Figure/Diagram if available */}
        {currentQ.svgMarkup && (
          <div className="mt-4 p-4 bg-white border-2 border-slate-200 rounded-2xl flex flex-col items-center justify-center overflow-hidden text-slate-950 shadow-xs">
            <div 
              className="w-full flex items-center justify-center svg-container [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-56 [&>svg]:mx-auto"
              dangerouslySetInnerHTML={{ __html: currentQ.svgMarkup }}
            />
            <div className="mt-2 text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-wider">
              Figurë Vektoriale (Diagramë)
            </div>
          </div>
        )}
        {currentQ.imageUrl && (
          <div className="mt-4 p-4 bg-white border-2 border-slate-200 rounded-2xl flex flex-col items-center justify-center overflow-hidden text-slate-950 shadow-xs">
            <img
              src={currentQ.imageUrl}
              alt="Diagrama e pyetjes"
              referrerPolicy="no-referrer"
              className="max-h-56 object-contain rounded-lg shadow-xs"
            />
            <div className="mt-2 text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-wider">
              Figurë Diagnostike / Optike
            </div>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-col gap-3.5 mb-6">
        {currentQ.options.map((optText, idx) => {
          let btnClass = 'duo-option-btn';

          if (selectedOption === idx && !answered) {
            btnClass += ' duo-option-btn-selected scale-[1.01]';
          }

          if (answered) {
            if (idx === currentQ.answer) {
              btnClass += ' duo-option-btn-correct scale-[1.01]';
            } else if (selectedOption === idx && idx !== currentQ.answer) {
              btnClass += ' duo-option-btn-incorrect';
            } else {
              btnClass += ' opacity-40';
            }
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={answered}
              onClick={() => onSelectOption(idx)}
              className={`w-full p-4 text-left text-sm flex items-start gap-3.5 transition-all select-none ${btnClass}`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs font-mono border-2 shrink-0 mt-0.5 transition-colors ${
                selectedOption === idx && !answered
                  ? 'bg-[var(--duo-blue)] text-white border-[var(--duo-blue)]'
                  : answered && idx === currentQ.answer
                  ? 'bg-[var(--duo-green)] text-white border-[var(--duo-green)]'
                  : answered && selectedOption === idx
                  ? 'bg-[var(--duo-red)] text-white border-[var(--duo-red)]'
                  : 'duo-option-badge-unselected'
              }`}>
                {letters[idx]}
              </span>
              <span className="flex-1 leading-relaxed pt-0.5 font-bold">{optText}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback Bar when answered */}
      {answered && (
        <div className={`p-5 rounded-2xl mb-6 flex items-start gap-4 border-2 shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-200 ${
          isAnswerCorrect
            ? 'bg-[var(--comfort-green-bg)] border-[var(--comfort-green-border)] text-[var(--comfort-green-text)]'
            : 'bg-[var(--comfort-red-bg)] border-[var(--comfort-red-border)] text-[var(--comfort-red-text)]'
        }`}>
          {isAnswerCorrect ? (
            <CheckCircle2 className="w-6 h-6 text-[var(--duo-green)] shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-6 h-6 text-[var(--duo-red)] shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs leading-relaxed">
            <div className="font-black text-base mb-1">
              {isAnswerCorrect ? 'Shkëlqyeshëm! 🎉' : 'Gabim!'}
            </div>
            {!isAnswerCorrect && (
              <div className="mb-1 font-extrabold text-xs">
                Përgjigja e saktë është: <strong className="underline">{letters[currentQ.answer]}. {currentQ.options[currentQ.answer]}</strong>
              </div>
            )}
            <div className="opacity-90 font-bold">
              Zgjidh më poshtë për të parë shpjegimin dhe analizën klinike.
            </div>
          </div>
        </div>
      )}

      {/* Action CTA Button */}
      {!answered ? (
        <button
          type="button"
          disabled={selectedOption === null}
          onClick={onSubmitAnswer}
          className="w-full py-4 duo-btn-blue text-base select-none disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:border-slate-300 dark:disabled:border-slate-900 disabled:text-slate-400"
        >
          Konfirmo Përgjigjen
        </button>
      ) : (
        <button
          type="button"
          onClick={onNextQuestion}
          className={`w-full py-4 text-base select-none ${
            isAnswerCorrect ? 'duo-btn-green' : 'duo-btn-blue'
          }`}
        >
          {isTestMode && currentIndex === total - 1 ? 'Përfundo Testimin ✓' : '📖 Shiko Shpjegimin →'}
        </button>
      )}
    </main>
  );
};
