import React, { useState, useMemo, useEffect } from 'react';
import { Question, Category, Topic, UserProgress } from '../types';
import { 
  Search, 
  Bookmark, 
  ChevronDown, 
  ChevronUp, 
  Brain, 
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  BookMarked
} from 'lucide-react';

interface ErrorJournalProps {
  questions: Question[];
  categories: Category[];
  topics: Topic[];
  progress: UserProgress;
  onToggleBookmark: (qId: string) => void;
  onStartQuizWithQuestions: (questions: Question[]) => void;
  onStartWrongCorrectionMode?: () => void;
}

export const ErrorJournal: React.FC<ErrorJournalProps> = ({
  questions,
  categories,
  topics,
  progress,
  onToggleBookmark,
  onStartQuizWithQuestions,
  onStartWrongCorrectionMode
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string | 'all'>('all');
  const [filterMode, setFilterMode] = useState<'active' | 'all'>('active'); // active = in wrongIds, all = any history in wrongCounts
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  
  // Lazy loading state
  const [visibleCount, setVisibleCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Map topics for quick lookup
  const topicMap = useMemo(() => {
    const map: Record<string, string> = {};
    topics.forEach(t => {
      map[t.id] = t.name;
    });
    return map;
  }, [topics]);

  // Map categories for quick lookup
  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach(c => {
      map[c.id] = c;
    });
    return map;
  }, [categories]);

  // Get wrong counts from progress safely
  const wrongCounts = useMemo(() => {
    return progress.wrongCounts || {};
  }, [progress.wrongCounts]);

  // Build the dataset of wrong questions with their counts
  const wrongQuestionsData = useMemo(() => {
    // Collect all question IDs that have been answered wrong
    const allWrongIds = new Set<string>();
    
    // 1. Add questions from wrongIds (currently active wrong questions)
    progress.wrongIds.forEach(id => allWrongIds.add(id));
    
    // 2. Add questions from wrongCounts keys
    Object.keys(wrongCounts).forEach(id => {
      if (wrongCounts[id] > 0) {
        allWrongIds.add(id);
      }
    });

    const data = questions
      .filter(q => allWrongIds.has(q.id))
      .map(q => ({
        question: q,
        failCount: wrongCounts[q.id] || 1,
        isActive: progress.wrongIds.includes(q.id)
      }));

    // Sort by fail count descending (most frequently failed first), then active state, then ID
    return data.sort((a, b) => {
      if (b.failCount !== a.failCount) {
        return b.failCount - a.failCount;
      }
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      return 0;
    });
  }, [questions, progress.wrongIds, wrongCounts]);

  // Filter wrong questions based on user selections
  const filteredWrongQuestions = useMemo(() => {
    return wrongQuestionsData.filter(item => {
      const q = item.question;
      
      // Status filter
      if (filterMode === 'active' && !item.isActive) {
        return false;
      }

      // Category filter
      if (selectedCatId !== 'all' && q.catId !== selectedCatId) {
        return false;
      }

      // Search query
      const matchesSearch = 
        q.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
        q.options.some(opt => opt.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (q.exp && q.exp.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesSearch;
    });
  }, [wrongQuestionsData, filterMode, selectedCatId, searchQuery]);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(10);
  }, [searchQuery, selectedCatId, filterMode]);

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => prev + 15);
      setIsLoadingMore(false);
    }, 300);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedQuestionId(prev => prev === id ? null : id);
  };

  const handlePracticeQuestion = (q: Question) => {
    // Start a 1-question custom session
    onStartQuizWithQuestions([q]);
  };

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <div className="duo-card p-5 space-y-5 border-t-4 border-t-rose-500 bg-gradient-to-b from-rose-500/5 to-transparent">
      {/* Header section with book/journal style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl p-2 bg-rose-500/10 text-rose-500 rounded-2xl border-2 border-rose-500/15">📓</span>
          <div className="text-left">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider font-mono">
              Ditari i Gabimeve (Error Journal)
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">Identifikoni dhe rishikoni boshllëqet tuaja kryesore në njohuri</p>
          </div>
        </div>

        {/* Start practice button */}
        {progress.wrongIds.length > 0 && (
          <button
            type="button"
            onClick={onStartWrongCorrectionMode}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl text-xs border-b-4 border-rose-700 active:translate-y-[2px] active:border-b-0 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Korrigjo Gabimet ({progress.wrongIds.length})
          </button>
        )}
      </div>

      {/* Filter Options */}
      <div className="space-y-3">
        {/* Toggle buttons for Active vs History */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/40 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setFilterMode('active')}
            className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all font-mono ${
              filterMode === 'active'
                ? 'bg-white dark:bg-slate-700 text-rose-500 shadow-sm border-b-2 border-rose-500/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            ⚠️ Gabimet Aktive ({progress.wrongIds.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all font-mono ${
              filterMode === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 shadow-sm border-b-2 border-slate-500/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            📚 Të gjitha Gabimet Historike ({wrongQuestionsData.length})
          </button>
        </div>

        {/* Category filters & search */}
        <div className="flex flex-col md:flex-row gap-2">
          {/* Search bar */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Kërko pyetjen ose shpjegimin mjekësor..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-500/5 hover:bg-slate-500/10 focus:bg-white dark:focus:bg-slate-800/80 text-xs font-bold rounded-2xl border-2 border-slate-200/40 dark:border-slate-800/80 focus:border-rose-500/50 focus:outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Category dropdown */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedCatId('all')}
              className={`px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl border-2 transition-all font-mono ${
                selectedCatId === 'all'
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 border-slate-800 dark:border-slate-200 shadow-sm'
                  : 'bg-slate-500/5 border-slate-200/40 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-500/10'
              }`}
            >
              Të gjitha
            </button>
            {categories.map(cat => {
              const countInCat = filteredWrongQuestions.filter(item => item.question.catId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl border-2 transition-all font-mono flex items-center gap-1.5 ${
                    selectedCatId === cat.id
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-slate-500/5 border-slate-200/40 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-500/10'
                  }`}
                  style={selectedCatId === cat.id ? { backgroundColor: cat.color } : {}}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Questions list container */}
      <div className="space-y-3.5">
        {filteredWrongQuestions.length === 0 ? (
          <div className="p-8 text-center bg-emerald-500/5 border-2 border-dashed border-emerald-500/25 rounded-3xl space-y-2">
            <span className="text-3xl block">🎉</span>
            <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono">
              Ditari juaj është i pastër!
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold max-w-sm mx-auto">
              {filterMode === 'active' 
                ? 'Nuk keni asnjë gabim aktiv aktualisht. Çdo pyetje e gabuar është korrigjuar me sukses!' 
                : 'Nuk keni asnjë gabim të regjistruar në sistem. Vazhdoni punën e shkëlqyer!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredWrongQuestions.slice(0, visibleCount).map((item, index) => {
              const q = item.question;
              const cat = categoryMap[q.catId] || { name: 'Mjekësi', color: '#64748B' };
              const isExpanded = expandedQuestionId === q.id;
              const isBookmarked = progress.bookmarkIds.includes(q.id);

              return (
                <div
                  key={q.id}
                  className={`border-2 rounded-2xl transition-all ${
                    isExpanded
                      ? 'bg-slate-500/5 border-slate-300 dark:border-slate-700'
                      : 'border-slate-200/40 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Card Header (clickable to toggle) */}
                  <div
                    onClick={() => handleToggleExpand(q.id)}
                    className="p-3.5 flex items-start justify-between gap-3 cursor-pointer select-none text-left"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Meta Tags */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="px-2 py-0.5 text-[8px] font-black rounded-md text-white font-mono uppercase tracking-wide shrink-0"
                          style={{ backgroundColor: cat.color }}
                        >
                          {cat.name}
                        </span>
                        {q.topicId && topicMap[q.topicId] && (
                          <span className="px-1.5 py-0.5 text-[8px] font-black rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 truncate max-w-[120px] font-mono uppercase tracking-wide">
                            {topicMap[q.topicId]}
                          </span>
                        )}
                        {/* Fail Count Warning Badge */}
                        <span className={`px-2 py-0.5 text-[8px] font-black rounded-md font-mono uppercase tracking-wider shrink-0 flex items-center gap-0.5 ${
                          item.failCount >= 3 
                            ? 'bg-rose-500 text-white animate-pulse' 
                            : 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                        }`}>
                          ❌ {item.failCount}x gabuar
                        </span>
                        {!item.isActive && (
                          <span className="px-1.5 py-0.5 text-[8px] font-black rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono uppercase tracking-wider">
                            Korrigjuar
                          </span>
                        )}
                      </div>

                      {/* Question Short Text */}
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 leading-normal line-clamp-2">
                        {q.text}
                      </p>
                    </div>

                    {/* Action controls (expand indicator & bookmark toggle) */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onToggleBookmark(q.id)}
                        className={`p-1.5 rounded-xl border transition-colors ${
                          isBookmarked
                            ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                            : 'bg-slate-500/5 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                        }`}
                        title={isBookmarked ? 'Hiqe nga të shënuarat' : 'Shëno pyetjen'}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleExpand(q.id)}
                        className="p-1.5 bg-slate-500/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Card Expanded Content */}
                  {isExpanded && (
                    <div className="px-3.5 pb-4 border-t border-slate-200/40 dark:border-slate-800 pt-3 text-left space-y-3.5 animate-in slide-in-from-top-1 duration-150">
                      {/* Render Figure/Diagram if available */}
                      {q.svgMarkup && (
                        <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center overflow-hidden max-w-full text-slate-950 shadow-xs">
                          <span className="text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-wider mb-2 self-start">Visualizimi (Diagramë):</span>
                          <div 
                            className="w-full flex items-center justify-center svg-container [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-48 [&>svg]:mx-auto"
                            dangerouslySetInnerHTML={{ __html: q.svgMarkup }}
                          />
                        </div>
                      )}
                      {q.imageUrl && (
                        <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center overflow-hidden max-w-full text-slate-950 shadow-xs">
                          <span className="text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-wider mb-2 self-start">Visualizimi:</span>
                          <img
                            src={q.imageUrl}
                            alt="Diagrama e pyetjes"
                            referrerPolicy="no-referrer"
                            className="max-h-48 object-contain rounded-lg"
                          />
                        </div>
                      )}

                      {/* Options listing */}
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">Alternativat:</span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {q.options.map((opt, optIdx) => {
                            const isCorrect = optIdx === q.answer;
                            return (
                              <div
                                key={optIdx}
                                className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2 border ${
                                  isCorrect
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-white dark:bg-slate-800 border-slate-200/50 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black font-mono border ${
                                  isCorrect
                                    ? 'bg-emerald-500 text-white border-emerald-600'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'
                                }`}>
                                  {letters[optIdx]}
                                </span>
                                <span className="flex-1 leading-snug">{opt}</span>
                                {isCorrect && <span className="text-[9px] font-black uppercase text-emerald-600 tracking-wider font-mono">Zgjidhje</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Explanation details */}
                      {q.exp && (
                        <div className="p-3 bg-slate-500/5 rounded-xl border border-slate-200/10 space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono block">Shpjegimi Klinik:</span>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold leading-relaxed whitespace-pre-line">
                            {q.exp}
                          </p>
                        </div>
                      )}

                      {/* Quick Practice Actions */}
                      <div className="flex items-center justify-between gap-4 pt-1">
                        <div className="text-[9px] text-slate-400 font-bold font-mono">
                          ID: #{q.id.toUpperCase()}
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePracticeQuestion(q)}
                          className="px-3.5 py-1.5 bg-[#1cb0f6] hover:bg-[#1899d6] text-white font-black rounded-lg text-[10px] border-b-2 border-[#1588c1] active:translate-y-[1px] active:border-b-0 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Praktiko vetëm këtë pyetje
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Load more button */}
        {filteredWrongQuestions.length > visibleCount && (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="w-full py-2.5 bg-slate-500/5 hover:bg-slate-500/10 text-slate-500 dark:text-slate-400 text-xs font-black rounded-2xl border border-slate-200/30 dark:border-slate-800 active:translate-y-[1px] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isLoadingMore ? (
              <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              'Ngarko më shumë pyetje'
            )}
          </button>
        )}
      </div>
    </div>
  );
};
