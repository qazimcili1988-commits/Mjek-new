import React, { useState, useMemo, useEffect } from 'react';
import { Question, Category, Topic, UserProgress } from '../types';
import { 
  Search, 
  Bookmark, 
  Trash2, 
  Play, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface BookmarksTabProps {
  questions: Question[];
  categories: Category[];
  topics: Topic[];
  progress: UserProgress;
  onToggleBookmark: (qId: string) => void;
  onStartQuizWithQuestions: (questions: Question[]) => void;
}

export const BookmarksTab: React.FC<BookmarksTabProps> = ({
  questions,
  categories,
  topics,
  progress,
  onToggleBookmark,
  onStartQuizWithQuestions
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string | 'all'>('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  
  // Lazy loading state
  const [visibleCount, setVisibleCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Get all bookmarked questions
  const bookmarkedQuestions = useMemo(() => {
    return questions.filter(q => progress.bookmarkIds.includes(q.id));
  }, [questions, progress.bookmarkIds]);

  // Categories present in bookmarks for fast filtering
  const activeCategories = useMemo(() => {
    const ids = new Set(bookmarkedQuestions.map(q => q.catId));
    return categories.filter(c => ids.has(c.id));
  }, [bookmarkedQuestions, categories]);

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

  // Filtered bookmarks
  const filteredQuestions = useMemo(() => {
    return bookmarkedQuestions.filter(q => {
      const matchesSearch = q.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            q.options.some(opt => opt.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            (q.exp && q.exp.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCat = selectedCatId === 'all' || q.catId === selectedCatId;
      return matchesSearch && matchesCat;
    });
  }, [bookmarkedQuestions, searchQuery, selectedCatId]);

  // Reset lazy load limit when filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [searchQuery, selectedCatId]);

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    // Simulate a brief, ultra-smooth transition for natural comfort feel
    setTimeout(() => {
      setVisibleCount(prev => prev + 15);
      setIsLoadingMore(false);
    }, 400);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedQuestionId(prev => prev === id ? null : id);
  };

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <div className="space-y-5 animate-in fade-in duration-200" id="bookmarksView">
      {/* Header section with summary */}
      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-2 border-amber-500/20 rounded-3xl p-5 shadow-sm text-slate-800 dark:text-slate-100">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xl border-b-2 border-amber-600 shadow-sm shrink-0">🔖</span>
          <div>
            <h2 className="text-lg font-black tracking-tight leading-none mb-1">Pyetjet e Ruajtura</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Koleksioni juaj i personalizuar për rishikim mjekësor</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 bg-white/60 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800 text-xs font-bold">
          <span className="text-slate-500 dark:text-slate-400">Total pyetje të shënuara:</span>
          <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black px-2.5 py-1 rounded-xl font-mono text-sm">
            {bookmarkedQuestions.length}
          </span>
        </div>
      </div>

      {bookmarkedQuestions.length === 0 ? (
        <div className="duo-card p-8 text-center flex flex-col items-center justify-center space-y-3 border-dashed border-2">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl">🔖</div>
          <h3 className="font-black text-slate-700 dark:text-slate-300">Nuk keni asnjë pyetje të shënuar</h3>
          <p className="text-xs text-slate-400 max-w-xs font-bold leading-relaxed">
            Gjatë zgjidhjes së kuizeve, shtypni butonin <strong className="text-slate-500 dark:text-slate-300">"Shëno"</strong> në cepin e sipërm djathtas për të ruajtur pyetjet e vështira këtu.
          </p>
        </div>
      ) : (
        <>
          {/* Filters & Search Area */}
          <div className="space-y-3.5">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Kërko pyetje ose përmbajtje..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:outline-none focus:border-[var(--duo-blue)] text-sm font-bold text-slate-700 dark:text-slate-100 shadow-sm transition-all"
              />
              <Search className="absolute left-4 top-3.5 w-4.5 h-4.5 text-slate-400" />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-3 text-xs font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Fshi
                </button>
              )}
            </div>

            {/* Category Filter Pills (Duolingo Style) */}
            {activeCategories.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 font-mono flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Filtro sipas kategorisë:
                </span>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCatId('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all ${
                      selectedCatId === 'all'
                        ? 'bg-[var(--duo-blue)] text-white border-[var(--duo-blue)] border-b-4'
                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    Të gjitha ({bookmarkedQuestions.length})
                  </button>
                  {activeCategories.map(cat => {
                    const count = bookmarkedQuestions.filter(q => q.catId === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCatId(cat.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all ${
                          selectedCatId === cat.id
                            ? 'bg-[var(--duo-blue)] text-white border-[var(--duo-blue)] border-b-4'
                            : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {cat.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Quiz Action Button */}
          {filteredQuestions.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onStartQuizWithQuestions(filteredQuestions)}
                className="w-full duo-btn-green py-3.5 text-sm font-black text-white flex items-center justify-center gap-2 shadow-sm"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Nis Kuiz me këto Pyetje ({Math.min(20, filteredQuestions.length)})</span>
              </button>
              <p className="text-[10px] text-center text-slate-400 font-bold mt-1.5">
                Sistemi do të zgjedhë deri në 20 pyetje të rastësishme nga lista e filtruar.
              </p>
            </div>
          )}

          {/* Structured Lists of Bookmarks */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1 font-mono">
              Lista e Pyetjeve ({filteredQuestions.length})
            </h3>

            {filteredQuestions.length === 0 ? (
              <div className="duo-card p-6 text-center text-slate-400 text-xs font-bold">
                Asnjë pyetje nuk përputhet me kriteret e kërkimit ose filtrit.
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredQuestions.slice(0, visibleCount).map((q, idx) => {
                  const isExpanded = expandedQuestionId === q.id;
                  const cat = categoryMap[q.catId];
                  const topicName = topicMap[q.topicId] || 'E përgjithshme';
                  
                  return (
                    <div 
                      key={q.id}
                      className="duo-card p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      {/* Top Header of Card */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {cat && (
                            <span 
                              className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md border text-white"
                              style={{ backgroundColor: cat.color, borderColor: cat.color }}
                            >
                              {cat.name}
                            </span>
                          )}
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono max-w-[150px] truncate">
                            {topicName}
                          </span>
                        </div>
                        
                        {/* Bookmark quick toggle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleBookmark(q.id);
                          }}
                          className="text-amber-500 hover:text-red-500 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Hiq nga të shënuarat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Question Text */}
                      <div 
                        onClick={() => handleToggleExpand(q.id)}
                        className="cursor-pointer group flex items-start justify-between gap-3 text-slate-800 dark:text-slate-100"
                      >
                        <span className="text-xs font-bold leading-relaxed text-left flex-1 group-hover:text-[var(--duo-blue)] transition-colors">
                          {idx + 1}. {q.text}
                        </span>
                        <div className="shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 mt-0.5">
                          {isExpanded ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
                        </div>
                      </div>

                      {/* Expandable Answers and Explanation */}
                      {isExpanded && (
                        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in slide-in-from-top-2 duration-200">
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

                          {/* Options Grid */}
                          <div className="grid grid-cols-1 gap-2">
                            {q.options.map((opt, oIdx) => {
                              const isCorrect = oIdx === q.answer;
                              return (
                                <div
                                  key={oIdx}
                                  className={`p-3 rounded-xl border-2 text-xs font-bold text-left flex items-start gap-2.5 transition-colors ${
                                    isCorrect 
                                      ? 'bg-[var(--comfort-green-bg)] border-[var(--comfort-green-border)] text-[var(--comfort-green-text)] font-extrabold'
                                      : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] border shrink-0 mt-0.5 ${
                                    isCorrect
                                      ? 'bg-[var(--duo-green)] text-white border-[var(--duo-green)]'
                                      : 'bg-slate-200/50 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
                                  }`}>
                                    {letters[oIdx]}
                                  </span>
                                  <span className="flex-1 mt-0.5">{opt}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Explanation Block */}
                          {q.exp && (
                            <div className="bg-[var(--comfort-blue-bg)] border border-[var(--comfort-blue-border)] rounded-xl p-3 text-xs text-[var(--comfort-blue-text)] leading-relaxed">
                              <div className="font-black flex items-center gap-1.5 mb-1 text-xs uppercase tracking-wider font-mono">
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Sqarimi Shkencor</span>
                              </div>
                              <p className="font-medium text-slate-700 dark:text-slate-300 font-sans mt-1">
                                {q.exp}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Lazy Load Trigger Button */}
            {visibleCount < filteredQuestions.length && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 border-b-4 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 active:translate-y-[2px] active:border-b-0 transition-all inline-flex items-center gap-2 shadow-sm"
                >
                  {isLoadingMore ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                      <span>Duke ngarkuar...</span>
                    </>
                  ) : (
                    <>
                      <span>Ngarko më shumë pyetje</span>
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                        +{Math.min(15, filteredQuestions.length - visibleCount)} left
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
