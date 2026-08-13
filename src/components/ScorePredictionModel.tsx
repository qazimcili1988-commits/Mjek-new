import React, { useState, useMemo } from 'react';
import { UserProgress, Question, Category } from '../types';
import { 
  Sparkles, Brain, AlertCircle, TrendingUp, Info, 
  Activity, Flame, BookOpen, Star, Target, CheckCircle2, 
  ChevronDown, ChevronUp, ArrowRight
} from 'lucide-react';

interface ScorePredictionModelProps {
  progress: UserProgress;
  questions: Question[];
  categories?: Category[];
  memoryHealth: {
    healthScore: number;
    longTermCount: number;
    riskCount: number;
    dueCount: number;
    stableCount: number;
    totalStudied: number;
  };
}

export const ScorePredictionModel: React.FC<ScorePredictionModelProps> = ({
  progress,
  questions,
  categories = [],
  memoryHealth,
}) => {
  // Simulator states
  const [spacedRepetitionChecked, setSpacedRepetitionChecked] = useState<boolean>(true);
  const [extraQuestionsToSolve, setExtraQuestionsToSolve] = useState<number>(0);
  const [anxietyLevel, setAnxietyLevel] = useState<number>(20); // 0% to 100%
  const [examSimulationsDone, setExamSimulationsDone] = useState<number>(0);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [isSimulatorExpanded, setIsSimulatorExpanded] = useState<boolean>(false);
  
  // Interactive Grade Target Planner state
  const [targetGrade, setTargetGrade] = useState<number>(9); // Default target is Nota 9

  const totalQuestions = questions.length || 500;
  const totalDone = progress.totalDone;
  const totalCorrect = progress.totalCorrect;

  // Bayesian smoothed accuracy
  const priorAlpha = 15;
  const priorAccuracy = 55;
  const smoothedAccuracy = totalDone > 0
    ? ((totalCorrect + (priorAlpha * (priorAccuracy / 100))) / (totalDone + priorAlpha)) * 100
    : priorAccuracy;

  const baseCoverage = totalQuestions > 0 ? Math.min(100, (totalDone / Math.min(totalQuestions, 500)) * 100) : 0;
  const baseRetention = memoryHealth.healthScore || 50;

  // Subject performance analysis (Strengths & Weaknesses)
  const subjectAnalysis = useMemo(() => {
    if (!categories || categories.length === 0) return { strengths: [], weaknesses: [], untouched: [] };
    
    const analyzed = categories.map(c => {
      const stat = progress.catStats[c.id];
      const done = stat?.done || 0;
      const correct = stat?.correct || 0;
      const accuracy = done > 0 ? (correct / done) * 100 : null;
      return { id: c.id, name: c.name, done, correct, accuracy };
    });

    const untouched = analyzed.filter(x => x.done === 0);
    const completed = analyzed.filter(x => x.done > 0);

    const strengths = [...completed]
      .filter(x => x.accuracy !== null && x.accuracy >= 65 && x.done >= 3)
      .sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));

    const weaknesses = [...completed]
      .filter(x => x.accuracy !== null && (x.accuracy < 65 || x.done < 3))
      .sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0));

    return { strengths, weaknesses, untouched };
  }, [categories, progress.catStats]);

  // Algorithmic Prediction calculation
  const prediction = useMemo(() => {
    const simulatedCoverage = Math.min(
      100,
      totalQuestions > 0
        ? ((totalDone + extraQuestionsToSolve) / Math.min(totalQuestions, 500)) * 100
        : 0
    );

    const srBoost = spacedRepetitionChecked ? 15 : 0;
    const simulatedRetention = Math.min(100, baseRetention + srBoost);
    const enduranceBoost = Math.min(8, examSimulationsDone * 1.5);
    const anxietyPenalty = (anxietyLevel / 100) * 10;

    let blindspotPenalty = 0;
    let untouchedCount = 0;
    if (categories && categories.length > 0) {
      categories.forEach(c => {
        const stat = progress.catStats[c.id];
        if (!stat || (stat.done || 0) === 0) {
          untouchedCount++;
        }
      });
      blindspotPenalty = Math.min(15, untouchedCount * 3);
    }

    const rawPredictedScore =
      (smoothedAccuracy * 0.55) +
      (simulatedRetention * 0.25) +
      (simulatedCoverage * 0.20) +
      enduranceBoost -
      anxietyPenalty -
      blindspotPenalty;

    const score = Math.max(10, Math.min(100, Math.round(rawPredictedScore)));

    let gradeLabel = 'Nota 5 (Nën Prag)';
    let gradeColor = 'text-rose-600 dark:text-rose-400';
    let gradeBg = 'bg-rose-50 dark:bg-rose-950/20';
    let gradeBorder = 'border-rose-100 dark:border-rose-900/50';
    let description = '';

    if (score >= 90) {
      gradeLabel = 'Nota 10 (Shkëlqyeshëm)';
      gradeColor = 'text-emerald-600 dark:text-emerald-400';
      gradeBg = 'bg-emerald-50 dark:bg-emerald-950/20';
      gradeBorder = 'border-emerald-100 dark:border-emerald-900/50';
      description = 'Keni treguar saktësi absolute dhe kujtesë të shkëlqyer. Jeni plotësisht gati për rezultat maksimal!';
    } else if (score >= 80) {
      gradeLabel = 'Nota 9 (Shumë Mirë)';
      gradeColor = 'text-sky-600 dark:text-sky-400';
      gradeBg = 'bg-sky-50 dark:bg-sky-950/20';
      gradeBorder = 'border-sky-100 dark:border-sky-900/50';
      description = 'Njohuri klinike shumë të forta. Keni saktësi të lartë dhe mundësi të mëdha për notë elitare.';
    } else if (score >= 68) {
      gradeLabel = 'Nota 8 (Mirë)';
      gradeColor = 'text-amber-600 dark:text-amber-400';
      gradeBg = 'bg-amber-50 dark:bg-amber-950/20';
      gradeBorder = 'border-amber-100 dark:border-amber-900/50';
      description = 'Performancë solide. Kaloni provimin me siguri, por mbani fokusin te kategoritë e mbetura.';
    } else if (score >= 55) {
      gradeLabel = 'Nota 6-7 (Kalues)';
      gradeColor = 'text-teal-600 dark:text-teal-400';
      gradeBg = 'bg-teal-50 dark:bg-teal-950/20';
      gradeBorder = 'border-teal-100 dark:border-teal-900/50';
      description = 'Jeni në zonën e kalueshmërisë. Rekomandohet të rritni saktësinë për të mënjanuar rreziqet.';
    } else {
      gradeLabel = 'Nota 5 (Nën Prag)';
      gradeColor = 'text-rose-600 dark:text-rose-400';
      gradeBg = 'bg-rose-50 dark:bg-rose-950/20';
      gradeBorder = 'border-rose-100 dark:border-rose-900/50';
      description = 'Vlerësimi aktual është nën pragun e kalimit (55 pikë). Nevojitet më shumë stërvitje.';
    }

    return {
      score,
      gradeLabel,
      gradeColor,
      gradeBg,
      gradeBorder,
      description,
      simulatedCoverage: Math.round(simulatedCoverage),
      simulatedRetention: Math.round(simulatedRetention),
      untouchedCount,
    };
  }, [
    smoothedAccuracy,
    baseRetention,
    totalDone,
    extraQuestionsToSolve,
    spacedRepetitionChecked,
    examSimulationsDone,
    anxietyLevel,
    totalQuestions,
    categories,
    progress.catStats,
  ]);

  // Personal recommendations list (simplified action steps)
  const recommendations = useMemo(() => {
    const list = [];

    // 1. Minimum limit of questions
    if (totalDone < 15) {
      list.push({
        text: `Zgjidhni të paktën 30 pyetje (keni kryer vetëm ${totalDone}) për të stabilizuar parashikimin tuaj mjekësor.`,
        type: 'Hapi i Parë',
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30'
      });
    }

    // 2. Weak categories
    if (subjectAnalysis.weaknesses.length > 0) {
      const weak = subjectAnalysis.weaknesses[0];
      list.push({
        text: `Kategorisë "${weak.name}" i duhet përmirësim (saktësia është ${Math.round(weak.accuracy || 0)}%). Bëni një kuiz të shënjestruar.`,
        type: 'Fokus',
        color: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30'
      });
    }

    // 3. Untouched areas
    if (subjectAnalysis.untouched.length > 0) {
      const label = subjectAnalysis.untouched[0].name;
      list.push({
        text: `Nuk keni nisur ende kategorinë "${label}". Zgjidhni disa pyetje për të hequr penalizimin akademik.`,
        type: 'Zonë e Verbër',
        color: 'text-indigo-600 dark:text-indigo-400',
        bg: 'bg-indigo-50/50 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30'
      });
    }

    // 4. Memory Health
    if (memoryHealth.dueCount > 0) {
      list.push({
        text: `Keni ${memoryHealth.dueCount} pyetje të prapambetura për rishikim në sistemin Spaced Repetition. Kryejini ato për të mos humbur pikët.`,
        type: 'Rishikim',
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30'
      });
    }

    // Default if excellent
    if (list.length === 0) {
      list.push({
        text: 'Sipas të dhënave, keni një përgatitje të shkëlqyer klinike! Vazhdoni kështu për të garantuar Notën 10.',
        type: 'Formë Elitare',
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30'
      });
    }

    return list;
  }, [totalDone, subjectAnalysis, memoryHealth.dueCount]);

  const isLowData = totalDone < 10;

  return (
    <div className="bg-white dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
      
      {/* Header with Title and info helper */}
      <div className="flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 font-sans">
              Parashikuesi i Pikëve
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium font-sans">
              Modeli Akademik i Provimit Shtetëror
            </p>
          </div>
        </div>
        
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <Info className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Info Help Banner */}
      {showInfo && (
        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-150 dark:border-slate-800 rounded-xl text-left text-[10.5px] text-slate-500 dark:text-slate-400 space-y-1 animate-in fade-in duration-100 leading-relaxed font-sans">
          <p className="font-bold text-indigo-600 dark:text-indigo-400">Si kalkulohet nota?</p>
          <p>
            Ky algoritëm analizon saktësinë tuaj mjekësore (55%), kujtesën aktive afatgjatë (25%) dhe sa përqind të bankës së pyetjeve keni mbuluar (20%). Penalizoheni nëse nuk keni hapur ende ndonjë kategori të rëndësishme.
          </p>
        </div>
      )}

      {/* Main Score Widget (Highly Intuitive & Beautifully Simplified) */}
      <div className="bg-slate-50/50 dark:bg-slate-900/10 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-4.5 flex items-center gap-4.5 text-left">
        {/* Score Pill */}
        <div className="w-18 h-18 rounded-2xl bg-indigo-500 flex flex-col items-center justify-center shrink-0 shadow-md shadow-indigo-500/10 text-white">
          <span className="text-2xl font-black font-mono leading-none tracking-tight">
            {prediction.score}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider opacity-90 mt-1">
            pikë
          </span>
        </div>

        {/* Verdict & Details */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center text-[11px] font-bold ${prediction.gradeColor}`}>
              {prediction.gradeLabel}
            </span>
          </div>
          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            {prediction.description}
          </p>
        </div>
      </div>

      {/* Simple Personal Todo Plan (Instead of heavy neon cards) */}
      <div className="text-left space-y-2">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 font-sans">
          Si të rritni pikët (Lista e Veprimit)
        </h4>
        
        <div className="space-y-1.5">
          {recommendations.map((rec, idx) => (
            <div 
              key={idx} 
              className={`flex items-start gap-2.5 p-3 border rounded-xl transition-all ${rec.bg}`}
            >
              <div className="mt-0.5 shrink-0">
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono block opacity-80" style={{ color: 'inherit' }}>
                  {rec.type}
                </span>
                <p className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-250 leading-normal">
                  {rec.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Planner & Simulator (Now beautifully collapsed and simplified) */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setIsSimulatorExpanded(!isSimulatorExpanded)}
          className="w-full py-2 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold rounded-xl text-[10.5px] border border-slate-200/60 dark:border-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1"
        >
          {isSimulatorExpanded ? (
            <>Fshih Simulatorin <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>Simulo Objektivin e Notës & Faktorët <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      </div>

      {isSimulatorExpanded && (
        <div className="space-y-4 pt-3 border-t border-slate-150 dark:border-slate-800 animate-in fade-in duration-150 text-left">
          
          {/* Objective Goal Planner */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Synimi im për provim:
              </label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                {[8, 9, 10].map((grade) => (
                  <button
                    key={grade}
                    onClick={() => setTargetGrade(grade)}
                    className={`px-2.5 py-0.5 text-[10px] font-black rounded-md transition-all cursor-pointer ${
                      targetGrade === grade
                        ? 'bg-indigo-500 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Nota {grade}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated sliders */}
            <div className="bg-slate-50/50 dark:bg-slate-900/10 p-3 rounded-xl border border-slate-150 dark:border-slate-800 space-y-3 text-[10.5px]">
              
              {/* Spaced repetition toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">Përsëritja e Rregullt (SM-2)</span>
                  <span className="text-[9px] text-slate-400">Shton +15% më shumë retencion</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSpacedRepetitionChecked(!spacedRepetitionChecked)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-all cursor-pointer ${
                    spacedRepetitionChecked ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all ${spacedRepetitionChecked ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Extra Qs range */}
              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Mbulimi i Bankës</span>
                  <span className="text-sky-500">+{extraQuestionsToSolve} pyetje</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, Math.min(300, totalQuestions - totalDone))}
                  step="10"
                  value={extraQuestionsToSolve}
                  onChange={(e) => setExtraQuestionsToSolve(Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              {/* Simulations done range */}
              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Simulime të Plota</span>
                  <span className="text-purple-500">{examSimulationsDone} provime</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={examSimulationsDone}
                  onChange={(e) => setExamSimulationsDone(Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
