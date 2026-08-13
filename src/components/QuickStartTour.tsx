import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, BookOpen, Brain, Target, Award, ArrowRight, ArrowLeft, 
  X, Check, BookMarked, HelpCircle, Flame, Star, Shield, Play 
} from 'lucide-react';
import { Category, Topic, Question, UserProgress } from '../types';

interface QuickStartTourProps {
  isOpen: boolean;
  onClose: () => void;
  onStartPractice: (count: number) => void;
  progress: UserProgress;
}

export const QuickStartTour: React.FC<QuickStartTourProps> = ({
  isOpen,
  onClose,
  onStartPractice,
  progress,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  // Interactive mini-question state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  
  // Simulated Spaced Repetition rating state
  const [smRating, setSmRating] = useState<number | null>(null);

  if (!isOpen) return null;

  const stepsCount = 6;

  // Real clinical-style basic science question matching our seed database structure
  const demoQuestion = {
    text: "[Rasti Klinik #324]: Gjatë analizës së parametrave në lidhje me \"Citologjia dhe Biologjia Qelizore\", cili është roli ose ndikimi parësor fiziologjik i komponentit \"retikulumi endoplazmatik\"?",
    options: [
      "A) Rregullon aktivitetin direkt trans-membranor të qelizës duke rritur homeostazën sistemike.",
      "B) Sintetizon dhe palos proteinat si dhe kryen transportin e lipideve qelizore.",
      "C) Shërben si një marker sekondar për matjen e saktë të metabolizmit të përgjithshëm.",
      "D) Nxit zbërthimin e shpejtë të elementit pa patur ndikim të drejtpërdrejtë mjekësor."
    ],
    correctAnswer: 1, // index 1 (Option B)
    explanation: "Retikulumi endoplazmatik (kokrrizor dhe i lëmuar) është organelë qendrore ku bëhet sinteza, palosja dhe modifikimi i proteinave të destinuara për sekretim ose për membranën qelizore, si dhe sinteza e lipideve dhe detoksifikimi qelizor."
  };

  const handleOptionClick = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    setIsAnswered(true);
  };

  const resetDemoQuestion = () => {
    setSelectedOption(null);
    setIsAnswered(false);
    setIsBookmarked(false);
    setSmRating(null);
  };

  const handleNextStep = () => {
    if (currentStep < stepsCount - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleCompleteTour();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleCompleteTour = () => {
    try {
      localStorage.setItem('nsp_quickstart_completed', 'true');
    } catch (e) {
      console.warn("localStorage setItem 'nsp_quickstart_completed' failed", e);
    }
    onClose();
  };

  const handleActionPractice = () => {
    try {
      localStorage.setItem('nsp_quickstart_completed', 'true');
    } catch (e) {
      console.warn("localStorage setItem 'nsp_quickstart_completed' failed", e);
    }
    onClose();
    onStartPractice(10); // Start 10-question practice mode
  };

  // Steps definitions
  const steps = [
    // Step 0: Welcome & Vision
    {
      title: "Mirë se vini në Mjek Hyrje! 🩺",
      subtitle: "Udhëzuesi i Shpejtë",
      content: (
        <div className="space-y-4 text-center py-2" id="tour-step-0">
          <div className="relative flex justify-center py-4">
            <div className="absolute w-20 h-20 bg-sky-500/15 rounded-full animate-ping" />
            <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-sky-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg shadow-sky-500/20">
              🩺
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Gati për të Shkëlqyer në Provim?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold max-w-sm mx-auto">
              Mjek Hyrje është platforma juaj inteligjente për përgatitjen e provimit të pranimit në Mjekësi. Këtu do të gjeni një bankë të plotë me saktësisht <span className="text-sky-600 font-bold">7,000 pyetje</span> shkencore të detajuara nga lëndët kyçe: <span className="font-bold">Kimia, Biologjia, dhe Fizika</span>.
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3 text-left">
            <span className="text-xl">✨</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold leading-normal">
              Nuk keni nevojë për materiale apo libra të rëndë. Çdo gjë që ju duhet për provimin tuaj mjekësor është e organizuar këtu në mënyrë interaktive!
            </p>
          </div>
        </div>
      )
    },
    // Step 1: Study Modes Walkthrough
    {
      title: "Mënyrat e Studimit (7 Mënyra) 🎓",
      subtitle: "Si të studioni sot?",
      content: (
        <div className="space-y-3.5 text-left py-1" id="tour-step-1">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center font-bold mb-3 max-w-sm mx-auto">
            Zgjidhni formën e praktikimit sipas nevojave tuaja të studimit:
          </p>
          
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl flex gap-3.5 shadow-sm">
            <span className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center text-xl shrink-0">📝</span>
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">Simulimi i Provimit</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 leading-normal">
                Saktësisht 50 pyetje të përzgjedhura në kohë reale me limit prej 60 minutash, ashtu si provimi juaj real.
              </p>
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl flex gap-3.5 shadow-sm">
            <span className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xl shrink-0">🎓</span>
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">Stërvitja sipas Kapitujve</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 leading-normal">
                Praktikoni pyetje të filtruara sipas kapitujve dhe temave nga Kimia, Biologjia dhe Fizika pa limit kohor.
              </p>
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl flex gap-3.5 shadow-sm">
            <span className="w-10 h-10 rounded-xl bg-violet-500 text-white flex items-center justify-center text-xl shrink-0">🧠</span>
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">Memorizimi SM-2 (Spaced Repetition)</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 leading-normal">
                Sistemi përsërit pyetjet e vështira në intervale kohe inteligjente për t'i kaluar në kujtesën tuaj afatgjatë.
              </p>
            </div>
          </div>
        </div>
      )
    },
    // Step 2: Interactive Practice Demo Question
    {
      title: "Provoni një Pyetje Shkencore! 💡",
      subtitle: "Eksperiencë interaktive",
      content: (
        <div className="space-y-3.5 text-left py-1" id="tour-step-2">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold text-center">
            Më poshtë është një pyetje tipike biologjike. Provoni të klikoni mbi opsionin e saktë (Opsioni B):
          </p>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/80">
            <div className="flex justify-between items-start gap-2 mb-2">
              <span className="text-[10px] font-black text-sky-600 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-md font-mono">BIOLOGJI QELIZORE</span>
              <button 
                type="button"
                onClick={() => setIsBookmarked(!isBookmarked)}
                className={`p-1 rounded-lg transition-colors ${isBookmarked ? 'text-amber-500 bg-amber-500/10' : 'text-slate-400 hover:text-slate-600'}`}
                title="Shëno pyetjen"
              >
                <BookMarked className="w-4 h-4 fill-current" />
              </button>
            </div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
              {demoQuestion.text}
            </h4>
          </div>

          <div className="space-y-2">
            {demoQuestion.options.map((opt, idx) => {
              const isCorrect = idx === demoQuestion.correctAnswer;
              const isSelected = idx === selectedOption;
              
              let cardStyle = "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40";
              let badgeStyle = "bg-slate-100 dark:bg-slate-800 text-slate-500";
              
              if (isAnswered) {
                if (isCorrect) {
                  // correct option turns green
                  cardStyle = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 font-semibold";
                  badgeStyle = "bg-emerald-500 text-white";
                } else if (isSelected) {
                  // incorrect clicked option turns red
                  cardStyle = "border-rose-500 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300";
                  badgeStyle = "bg-rose-500 text-white";
                } else {
                  cardStyle = "opacity-40 border-slate-200 dark:border-slate-850";
                }
              }

              let extraClass = "tour-option-btn";
              if (isAnswered) {
                if (isCorrect) {
                  extraClass += " tour-option-correct";
                } else if (isSelected) {
                  extraClass += " tour-option-incorrect";
                } else {
                  extraClass += " tour-option-muted";
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleOptionClick(idx)}
                  disabled={isAnswered}
                  className={`w-full text-left p-3 border-2 border-b-4 rounded-2xl flex items-center gap-3 transition-all text-xs ${cardStyle} ${extraClass}`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${badgeStyle}`}>
                    {isAnswered && isCorrect ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                  </span>
                  <span className="leading-snug">{opt}</span>
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl text-[11px] text-emerald-800 dark:text-emerald-300 font-bold leading-normal text-center"
            >
              {selectedOption === demoQuestion.correctAnswer ? "🎉 Shkëlqyer! Përgjigje e saktë!" : "🩹 U zbulua përgjigja e saktë! Çdo gabim ju bën më të fortë."}
            </motion.div>
          )}
        </div>
      )
    },
    // Step 3: Explanation & Spaced Repetition Scheduling
    {
      title: "Shpjegime Shkencore & SM-2 🧠",
      subtitle: "Si funksionon memorizimi?",
      content: (
        <div className="space-y-3.5 text-left py-1" id="tour-step-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold text-center">
            Pasi i përgjigjeni një pyetjeje, ju shfaqet sqarimi akademik i plotë:
          </p>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 max-h-[140px] overflow-y-auto">
            <h5 className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              📝 Sqarimi Shkencor:
            </h5>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
              {demoQuestion.explanation}
            </p>
          </div>

          <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl space-y-2">
            <h5 className="text-[11px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1">
              🧠 Vlerësimi Spaced Repetition (SM-2):
            </h5>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-bold">
              Zgjidhni sa e lehtë apo e vështirë ishte pyetja për të rregulluar kohën e rishikimit:
            </p>
            
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: "E Vështirë", value: 1, delay: "+1 ditë" },
                { label: "Mesatare", value: 3, delay: "+4 ditë" },
                { label: "E Lehtë", value: 5, delay: "+10 ditë" }
              ].map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setSmRating(r.value)}
                  className={`py-2 px-1.5 border-2 border-b-4 rounded-xl text-center transition-all ${
                    smRating === r.value
                      ? 'bg-violet-600 border-violet-800 text-white font-black scale-102 tour-rating-btn-selected'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold tour-rating-btn-unselected'
                  }`}
                >
                  <span className="text-[10px] block leading-none font-bold">{r.label}</span>
                  <span className={`text-[9px] block mt-1 font-mono font-bold ${smRating === r.value ? 'text-violet-200' : 'text-slate-400'}`}>
                    {r.delay}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    },
    // Step 4: Readiness Score & Badges
    {
      title: "Modeli i Parashikimit të Pikëve 📊",
      subtitle: "Përparimi dhe Arritjet",
      content: (
        <div className="space-y-4 text-center py-2" id="tour-step-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold max-w-xs mx-auto leading-relaxed">
            Te sektori i Statistikave, sistemi përdor performancën tuaj në të gjitha 7,000 pyetjet për të llogaritur modelin e parashikimit të pikëve:
          </p>

          <div className="duo-card p-4 text-left max-w-sm mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono block mb-1">Modeli i Parashikimit të Pikëve</span>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-black text-emerald-500">I Përgatitur Shkëlqyeshëm 📊</h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Saktësia Mesatare · Mbulimi i Bankës</p>
              </div>
              <span className="text-2xl font-black font-mono text-emerald-500 shrink-0">82.5%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mt-3 p-0.5">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '82%' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
            <div className="p-2 border-2 border-b-4 border-amber-500 bg-amber-500/5 rounded-2xl flex items-center gap-2.5">
              <span className="text-xl">🔥</span>
              <div className="text-left leading-none">
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 block">Dita e Serisë</span>
                <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">Mbroje Serinë Ditore</span>
              </div>
            </div>
            
            <div className="p-2 border-2 border-b-4 border-sky-500 bg-sky-500/5 rounded-2xl flex items-center gap-2.5">
              <span className="text-xl">🏆</span>
              <div className="text-left leading-none">
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 block">Badges (Arritjet)</span>
                <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">4 Nivele të ndryshme</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Step 5: Completed / Action
    {
      title: "Gati për Sukses! 🚀",
      subtitle: "Mirë se erdhët zyrtarisht!",
      content: (
        <div className="space-y-4 text-center py-2" id="tour-step-5">
          <div className="text-5xl animate-bounce">🏆</div>
          <div className="space-y-2">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Udhëzuesi Përfundoi!</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold max-w-sm mx-auto">
              Tani keni një pamje të plotë se si Mjek Hyrje do t'ju ndihmojë të përvetësoni 7,000 pyetjet e pranimit për Kimi, Biologji dhe Fizikë. 
            </p>
          </div>

          <div className="p-4 bg-sky-500/5 border border-sky-500/20 rounded-3xl max-w-sm mx-auto space-y-3">
            <span className="text-xs font-black text-sky-600 dark:text-sky-400 block">ZGJIDHNI HAPIN E PARË:</span>
            
            <button
              type="button"
              onClick={handleActionPractice}
              className="w-full py-3 bg-[#58cc02] hover:bg-[#4eb502] text-white font-black rounded-2xl border-b-4 border-[#3a8501] active:translate-y-[2px] active:border-b-0 text-xs flex items-center justify-center gap-2 transition-all shadow-sm tour-action-green-btn"
            >
              <Play className="w-4 h-4 fill-current text-white" /> Nis Stërvitje të Shpejtë (10 pyetje)
            </button>
          </div>
        </div>
      )
    }
  ];

  const currentTourStep = steps[currentStep];

  return (
    <AnimatePresence>
      <div 
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-[9990]"
      >
        <motion.div 
          id="quickStartTourModal"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", duration: 0.35 }}
          className="bg-[#edf5ff] border-2 border-[#cbdff7] rounded-3xl p-6 w-full max-w-[440px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] md:max-h-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress Indicator Dots */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-1">
              {[...Array(stepsCount)].map((_, i) => (
                <div 
                  key={i} 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === currentStep 
                      ? 'w-6 bg-sky-500' 
                      : i < currentStep 
                        ? 'w-2 bg-sky-400/50' 
                        : 'w-2 bg-slate-200 dark:bg-slate-800'
                  }`} 
                />
              ))}
            </div>
            
            <button
              type="button"
              onClick={handleCompleteTour}
              className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors text-slate-400 hover:text-slate-600 tour-close-btn"
              title="Mbyll udhëzuesin"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Header */}
          <div className="mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-sky-500 font-mono block">
              {currentTourStep.subtitle}
            </span>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mt-0.5 leading-tight">
              {currentTourStep.title}
            </h2>
          </div>

          {/* Step Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto pr-1 py-1 min-h-[300px] flex flex-col justify-center">
            {currentTourStep.content}
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-900 gap-3">
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="flex items-center gap-1.5 px-4 py-3 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all active:translate-y-[2px] active:border-b-0 active:border-b-2 tour-back-btn"
              >
                <ArrowLeft className="w-4 h-4" /> Mbrapa
              </button>
            ) : (
              <div /> // Spacer
            )}

            <button
              type="button"
              onClick={handleNextStep}
              className="flex items-center gap-1.5 px-5 py-3 bg-sky-500 hover:bg-sky-400 text-white font-black text-xs rounded-2xl border-b-4 border-sky-700 active:translate-y-[2px] active:border-b-0 active:border-b-2 transition-all shadow-md shadow-sky-500/10 tour-primary-btn"
            >
              {currentStep === stepsCount - 1 ? (
                <>Përfundo ✓</>
              ) : (
                <>Vazhdo <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
