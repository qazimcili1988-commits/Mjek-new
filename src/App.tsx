import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from './store/useAppStore';
import { Category, Topic, Question, UserProgress, ActiveSession, QuizMode, AnswerLog, ActiveTab } from './types';
import {
  getCategories, getTopics, getQuestions, getProgress, saveProgress,
  syncDailyState, getDailyLimit, calculateReadiness, verifyAdminPassword,
  getNewSRCard, sm2Update, getSRDueQuestions, getRandomSubset, preloadQuestions,
  addQuestionReport, getPredictiveStudyLoad, syncWithServerStore
} from './utils/storage';
import { Navbar } from './components/Navbar';
import { Toast } from './components/Toast';
import { Confetti } from './components/Confetti';
import { TrainPickerModal } from './components/TrainPickerModal';
import { CustomQuizModal } from './components/CustomQuizModal';
import { Modal } from './components/Modal';
import { QuizScreen } from './components/QuizScreen';
import { ExplanationScreen } from './components/ExplanationScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { AdminPanel } from './components/AdminPanel';
import { BookmarksTab } from './components/BookmarksTab';
import { ErrorJournal } from './components/ErrorJournal';
import { QuickStartTour } from './components/QuickStartTour';
import { ScorePredictionModel } from './components/ScorePredictionModel';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import {
  Flame, Award, Target, BookOpen, Clock, Heart, ShieldAlert, CheckCircle,
  HelpCircle, ArrowRight, Brain, AlertCircle, BookMarked, Settings, Sparkles, Play, Bell,
  Download, Share, Smartphone, X
} from 'lucide-react';

export default function App() {
  const {
    activeTab, setActiveTab,
    darkMode, setDarkMode,
    progress, setProgress,
    categories, setCategories,
    topics, setTopics,
    questions, setQuestions,
    activeSession, setActiveSession,
    examRemainingSeconds, setExamRemainingSeconds,
    isTrainPickerOpen, setIsTrainPickerOpen,
    isCustomQuizOpen, setIsCustomQuizOpen,
    isQuickStartOpen, setIsQuickStartOpen,
    isExitConfirmOpen, setIsExitConfirmOpen,
    showConfetti, setShowConfetti,
    toast, setToast,
    reportingQuestionId, setReportingQuestionId,
    reportReason, setReportReason,
    isReportModalOpen, setIsReportModalOpen,
    isAdminLoggedIn, setIsAdminLoggedIn,
    isAdminLoginOpen, setIsAdminLoginOpen,
    adminPassword, setAdminPassword,
    adminFailedAttempts, setAdminFailedAttempts,
    adminLockoutRemaining, setAdminLockoutRemaining,
    logoClickCount, setLogoClickCount,
    lastLogoClickTime, setLastLogoClickTime,
    isDbReady, setIsDbReady
  } = useAppStore();

  const [statsSubTab, setStatsSubTab] = useState<'summary' | 'analytics' | 'categories' | 'errors'>('summary');

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nsp_hide_pwa_banner') !== 'true';
    } catch (e) {
      return true;
    }
  });
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);

  useEffect(() => {
    // Check display mode
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
        || (window.navigator as any).standalone 
        || document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Check iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install user choice: ${outcome}`);
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismissPwaBanner = () => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem('nsp_hide_pwa_banner', 'true');
    } catch (e) {
      console.warn('localStorage failed to save dismissed state');
    }
  };

  // Sync state on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        // Force light mode unconditionally
        try {
          setDarkMode(false);
          document.documentElement.setAttribute('data-mode', 'light');
          document.documentElement.classList.remove('dark');
          localStorage.setItem('nsp_mode', 'light');
        } catch (e) {
          console.warn("localStorage setItem 'nsp_mode' failed", e);
        }

        // Set theme attribute
        let theme = 'teal';
        try {
          theme = localStorage.getItem('nsp_theme') || 'teal';
        } catch (e) {
          console.warn("localStorage getItem 'nsp_theme' failed", e);
        }
        document.documentElement.setAttribute('data-theme', theme === 'teal' ? '' : theme);

        // Preload questions asynchronously from IndexedDB/Cache (O(1) startup & virtually unlimited storage)
        let qs: any[] = [];
        try {
          qs = await preloadQuestions();
        } catch (err) {
          console.warn('preloadQuestions error, using getQuestions fallback:', err);
          qs = getQuestions();
        }

        // Sync database caches
        try {
          const cats = getCategories();
          const tops = getTopics();
          setCategories(cats);
          setTopics(tops);
          setQuestions(qs || []);
        } catch (err) {
          console.warn('Error setting initial categories/topics/questions:', err);
        }

        // Background server sync to fetch questions uploaded from Admin Panel across all users
        syncWithServerStore().then((synced) => {
          if (synced) {
            setCategories(synced.categories);
            setTopics(synced.topics);
            setQuestions(synced.questions);
          }
        }).catch((e) => console.warn('Server sync startup error (normal on static host):', e));

        // Sync progress
        try {
          const rawProgress = getProgress();
          const synced = syncDailyState(rawProgress);
          setProgress(synced);
        } catch (err) {
          console.warn('Error syncing progress:', err);
          setProgress(getProgress());
        }

        // Load saved active session
        try {
          const savedSessionStr = localStorage.getItem('nsp_active_session');
          if (savedSessionStr) {
            const savedSession = JSON.parse(savedSessionStr);
            savedSession.isPaused = true;
            setActiveSession(savedSession);
            
            if (savedSession.mode === 'test' && savedSession.examRemainingSeconds !== undefined) {
              setExamRemainingSeconds(savedSession.examRemainingSeconds);
            }
          }
        } catch (e) {
          console.error("Error loading saved session", e);
        }

        // Auto-trigger Quick Start for new users
        let completed = 'false';
        try {
          completed = localStorage.getItem('nsp_quickstart_completed') || 'false';
        } catch (e) {
          console.warn("localStorage getItem 'nsp_quickstart_completed' failed", e);
        }
        if (completed !== 'true') {
          setIsQuickStartOpen(true);
        }
      } catch (globalInitErr) {
        console.error('Fatal initialization error in initApp:', globalInitErr);
      } finally {
        setIsDbReady(true);
      }
    };

    initApp();
  }, []);

  // Periodically fetch any newly uploaded questions from Admin Panel across all connected users
  useEffect(() => {
    const handleSync = async () => {
      const synced = await syncWithServerStore();
      if (synced) {
        setCategories(synced.categories);
        setTopics(synced.topics);
        setQuestions(synced.questions);
      }
    };

    const interval = setInterval(handleSync, 15000);
    window.addEventListener('focus', handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleSync);
    };
  }, [setCategories, setTopics, setQuestions]);

  // Timer countdown for exam (pauses when session is paused)
  useEffect(() => {
    if (examRemainingSeconds === null) return;
    if (activeSession?.isPaused) return;
    if (examRemainingSeconds <= 0) {
      // Auto-submit exam when time runs out
      handleFinishSession();
      return;
    }
    const timer = setTimeout(() => {
      setExamRemainingSeconds((p) => (p !== null ? p - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [examRemainingSeconds, activeSession?.isPaused]);

  // Save active session to localStorage whenever it changes
  useEffect(() => {
    try {
      if (activeSession) {
        const sessionToSave = {
          ...activeSession,
          examRemainingSeconds: examRemainingSeconds !== null ? examRemainingSeconds : undefined
        };
        localStorage.setItem('nsp_active_session', JSON.stringify(sessionToSave));
      } else {
        localStorage.removeItem('nsp_active_session');
      }
    } catch (e) {
      console.warn("localStorage operation failed for nsp_active_session", e);
    }
  }, [activeSession, examRemainingSeconds]);

  // Lockout countdown timer
  useEffect(() => {
    if (adminLockoutRemaining <= 0) return;
    const t = setTimeout(() => {
      setAdminLockoutRemaining((r) => r - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [adminLockoutRemaining]);

  const showToast = (message: string, type: 'success' | 'warn' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const handleToggleDarkMode = () => {
    // Disabled - only dark mode supported
  };

  // Logo sequence handler (7 clicks to unlock Admin)
  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastLogoClickTime > 4000) {
      setLogoClickCount(1);
    } else {
      const nextCount = logoClickCount + 1;
      setLogoClickCount(nextCount);
      if (nextCount >= 7) {
        setLogoClickCount(0);
        if (isAdminLoggedIn) {
          setActiveTab('admin');
          showToast('Keni hyrë në panelin e adminit.', 'info');
        } else {
          setIsAdminLoginOpen(true);
        }
      } else {
        const remaining = 7 - nextCount;
        showToast(`Klikoni edhe ${remaining} herë për të hapur hyrjen e Adminit.`, 'info');
      }
    }
    setLastLogoClickTime(now);
  };

  // Admin login actions
  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLockoutRemaining > 0) {
      showToast(`Jeni të bllokuar. Provoni përsëri pas ${adminLockoutRemaining} sekondash.`, 'error');
      return;
    }

    const correct = verifyAdminPassword(adminPassword);
    if (correct) {
      setIsAdminLoggedIn(true);
      setIsAdminLoginOpen(false);
      setAdminPassword('');
      setAdminFailedAttempts(0);
      setActiveTab('admin');
      showToast('✓ Identifikimi si Admin u krye me sukses!', 'success');
    } else {
      const nextFailures = adminFailedAttempts + 1;
      setAdminFailedAttempts(nextFailures);
      if (nextFailures >= 3) {
        setAdminLockoutRemaining(60);
        showToast('🔒 Shumë tentativa të gabuara. Jeni të bllokuar për 60 sekonda.', 'error');
      } else {
        showToast(`Fjalëkalim i gabuar. Ju mbeten edhe ${3 - nextFailures} tentativa.`, 'warn');
      }
    }
  };

  // Precalculate question counts for ultimate speed (O(1) lookup during renders of custom modals)
  const questionCountsIndex = useMemo(() => {
    const topicCounts: Record<string, number> = {};
    const catCounts: Record<string, number> = {};
    
    // 1. Count by topic and category
    questions.forEach((q) => {
      topicCounts[q.topicId] = (topicCounts[q.topicId] || 0) + 1;
      catCounts[q.catId] = (catCounts[q.catId] || 0) + 1;
    });
    
    return { topicCounts, catCounts };
  }, [questions, topics]);

  const getDoneTodayCount = () => {
    if (!progress) return 0;
    return progress.history
      .filter((h) => h.date === new Date().toDateString())
      .reduce((s, h) => s + h.done, 0);
  };

  // Compute memory health metrics & status
  const memoryHealth = useMemo(() => {
    if (!progress) return { healthScore: 100, longTermCount: 0, riskCount: 0, dueCount: 0, stableCount: 0, totalStudied: 0, chartData: [] };
    
    const srCards = progress.srCards;
    const now = Date.now();
    
    let dueCount = 0;
    let riskCount = 0;
    let longTermCount = 0;
    let stableCount = 0;
    
    Object.keys(srCards).forEach((qId) => {
      const card = srCards[qId];
      const isDue = card.nextReview <= now;
      const isRisk = !isDue && (card.nextReview <= now + 3 * 86400000 || card.ef < 2.1 || card.reps <= 1);
      const isLongTerm = !isDue && !isRisk && (card.interval >= 7 || card.reps >= 3);
      
      if (isDue) {
        dueCount++;
      } else if (isRisk) {
        riskCount++;
      } else if (isLongTerm) {
        longTermCount++;
      } else {
        stableCount++;
      }
    });
    
    const totalStudied = Object.keys(srCards).length;
    let healthScore = 100;
    
    if (totalStudied > 0) {
      const totalPoints = (dueCount * 15) + (riskCount * 55) + (stableCount * 85) + (longTermCount * 100);
      healthScore = Math.round(totalPoints / totalStudied);
    }
    
    const chartData = [
      { name: 'Kujtesa afatgjatë', value: longTermCount, color: '#10B981', desc: 'Njohuri klinike të konsoliduara mirë.' },
      { name: 'Mësim i qëndrueshëm', value: stableCount, color: '#0EA5E9', desc: 'Njohuri aktive në proces forcimi.' },
      { name: 'Në rrezik harrese', value: riskCount, color: '#F97316', desc: 'Sapo të filluara ose me vështirësi të përsëritur.' },
      { name: 'Duhen përsëritur sot', value: dueCount, color: '#EF4444', desc: 'Të planifikuara për rishikim aktiv sot.' }
    ].filter(item => item.value > 0);
    
    if (chartData.length === 0) {
      chartData.push({
        name: 'Pa filluar ende',
        value: 1,
        color: '#94A3B8',
        desc: 'Zgjidhni pyetje për të krijuar kujtesën klinike.'
      });
    }
    
    return {
      healthScore,
      longTermCount,
      riskCount,
      dueCount,
      stableCount,
      totalStudied,
      chartData
    };
  }, [progress]);

  // Get count of questions for scoped custom quizzes
  const getQuestionCountForScope = (catId: string | null, topicId: string | null): number => {
    if (topicId) {
      return questionCountsIndex.topicCounts[topicId] || 0;
    }
    if (catId) {
      return questionCountsIndex.catCounts[catId] || 0;
    }
    return questions.length;
  };

  // SESSION LAUNCHERS
  const startTrainMode = (
    catId: string | null | number,
    topicId: string | null = null,
    count: number = 15
  ) => {
    setIsTrainPickerOpen(false);

    let actualCount = count;
    let actualCatId: string | null = null;
    let actualTopicId: string | null = null;

    if (typeof catId === 'number') {
      actualCount = catId;
    } else {
      actualCatId = catId;
      actualTopicId = topicId;
    }

    let filtered = [...questions];
    if (actualTopicId) {
      filtered = filtered.filter((q) => q.topicId === actualTopicId);
    } else if (actualCatId) {
      filtered = filtered.filter((q) => q.catId === actualCatId);
    }

    // Grab count random questions from filtered using extremely fast O(k) algorithm
    const selected = getRandomSubset(filtered, actualCount);

    if (selected.length === 0) {
      showToast('Nuk ka pyetje të mjaftueshme në bankë.', 'warn');
      return;
    }

    let title = 'Stërvitje e Thjeshtë';
    if (actualTopicId) {
      title = `Stërvitje: ${topics.find((t) => t.id === actualTopicId)?.name || ''}`;
    } else if (actualCatId) {
      title = `Stërvitje: ${categories.find((c) => c.id === actualCatId)?.name || ''}`;
    }

    setActiveSession({
      mode: 'train',
      questions: selected,
      currentIndex: 0,
      selectedOption: null,
      answered: false,
      answers: [],
      customTitle: title,
    });
    setExamRemainingSeconds(null);
  };

  const startTestMode = () => {
    // national exam mode: 50 random questions, 60 min countdown using fast O(k) algorithm
    const selected = getRandomSubset(questions, 50);

    if (selected.length === 0) {
      showToast('Nuk ka pyetje të mjaftueshme në bankë.', 'warn');
      return;
    }

    setActiveSession({
      mode: 'test',
      questions: selected,
      currentIndex: 0,
      selectedOption: null,
      answered: false,
      answers: [],
      customTitle: 'Provimi Kombëtar',
    });
    setExamRemainingSeconds(3600); // 1 hour
  };

  const startCustomQuiz = (catId: string | null, topicId: string | null, count: number, subMode: QuizMode) => {
    setIsCustomQuizOpen(false);
    let filtered = [...questions];
    if (topicId) {
      filtered = filtered.filter((q) => q.topicId === topicId);
    } else if (catId) {
      filtered = filtered.filter((q) => q.catId === catId);
    }

    // Load all matching questions in original database order (no shuffling or capping!)
    const selected = filtered;

    if (selected.length === 0) {
      showToast('Nuk ka pyetje të mjaftueshme për këtë kriter.', 'warn');
      return;
    }

    let title = 'Quiz i Personalizuar';
    if (topicId) title = topics.find((t) => t.id === topicId)?.name || title;
    else if (catId) title = categories.find((c) => c.id === catId)?.name || title;

    setActiveSession({
      mode: subMode,
      questions: selected,
      currentIndex: 0,
      selectedOption: null,
      answered: false,
      answers: [],
      customTitle: title,
    });

    if (subMode === 'test') {
      setExamRemainingSeconds(selected.length * 75); // 75 seconds per question
    } else {
      setExamRemainingSeconds(null);
    }
  };

  const startSpacedRepetitionMode = () => {
    if (!progress) return;
    const due = getSRDueQuestions(questions, progress.srCards);
    if (due.length > 0) {
      setActiveSession({
        mode: 'sr',
        questions: due,
        currentIndex: 0,
        selectedOption: null,
        answered: false,
        answers: [],
        customTitle: 'SM-2 Recall',
      });
      setExamRemainingSeconds(null);
    } else {
      const studiedIds = Object.keys(progress.srCards);
      if (studiedIds.length > 0) {
        // Find questions that match the studiedIds
        const studiedQs = questions.filter((q) => studiedIds.includes(q.id));
        if (studiedQs.length === 0) {
          showToast('⚠️ Pyetjet tuaja të SM-2 nuk u gjetën në databazën e re 7,000 pyetjesh. Filloni stërvitjen që t\'i shtoni ato përsëri!', 'warn');
          return;
        }
        const selected = getRandomSubset(studiedQs, 15); // max 15 per session for early review
        setActiveSession({
          mode: 'sr',
          questions: selected,
          currentIndex: 0,
          selectedOption: null,
          answered: false,
          answers: [],
          customTitle: 'Rishikim i Parakohshëm SM-2',
        });
        setExamRemainingSeconds(null);
        showToast('🔄 Rishikim i Parakohshëm! Po rishikoni 15 pyetjet tuaja aktive të SM-2 para kohës së planifikuar.', 'success');
      } else {
        showToast('💡 Nuk ka pyetje në SM-2! Fillimisht përgjigjuni disa pyetjeve në Stërvitje apo Simulim që t\'i shtoni ato në kujtesë.', 'info');
      }
    }
  };

  const startWrongCorrectionMode = () => {
    if (!progress || progress.wrongIds.length === 0) {
      showToast('Nuk keni asnjë pyetje të gabuar për të korrigjuar!', 'success');
      return;
    }

    const wrongQs = questions.filter((q) => progress.wrongIds.includes(q.id));
    if (wrongQs.length === 0) {
      showToast('⚠️ Pyetjet e gabuara të sesioneve të kaluara nuk u gjetën në databazën e re. Gabimet e reja do të shfaqen këtu!', 'warn');
      return;
    }
    const selected = getRandomSubset(wrongQs, 15); // max 15 per session

    setActiveSession({
      mode: 'wrong',
      questions: selected,
      currentIndex: 0,
      selectedOption: null,
      answered: false,
      answers: [],
      customTitle: 'Korrigjim Gabimesh',
    });
    setExamRemainingSeconds(null);
  };

  const startBookmarksMode = () => {
    if (!progress || progress.bookmarkIds.length === 0) {
      showToast('Nuk keni asnjë pyetje të shënuar.', 'info');
      return;
    }

    const bookmarkedQs = questions.filter((q) => progress.bookmarkIds.includes(q.id));
    if (bookmarkedQs.length === 0) {
      showToast('⚠️ Pyetjet e shënuara nuk u gjetën në databazën e re 7,000 pyetjesh. Ju lutemi shënoni pyetje të reja!', 'warn');
      return;
    }
    const selected = getRandomSubset(bookmarkedQs, 20);

    setActiveSession({
      mode: 'bookmarks',
      questions: selected,
      currentIndex: 0,
      selectedOption: null,
      answered: false,
      answers: [],
      customTitle: 'Të Shënuara',
    });
    setExamRemainingSeconds(null);
  };

  // Launch smart recommended daily session
  const startSmartRecommendedSession = () => {
    if (!progress) return;
    const due = getSRDueQuestions(questions, progress.srCards);
    if (due.length > 0) {
      startSpacedRepetitionMode();
      return;
    }

    // fallback to weak categories
    if (progress.wrongIds.length > 0) {
      startWrongCorrectionMode();
      return;
    }

    // launch default 15-question clinical study session
    startTrainMode(15);
  };

  // Launch a fully optimized, personalized adaptive learning session
  const startAdaptiveSession = (count: number = 15) => {
    if (!progress || questions.length === 0) return;

    // 1. Get due Spaced Repetition questions
    const dueQs = getSRDueQuestions(questions, progress.srCards);

    // 2. Get questions that the user got wrong previously
    const wrongQs = questions.filter((q) => progress.wrongIds.includes(q.id));

    // 3. Find weak categories (accuracy < 70%)
    const weakCatIds = categories
      .map((c) => {
        const stats = progress.catStats[c.id] || { total: 0, correct: 0 };
        const acc = stats.total > 0 ? stats.correct / stats.total : 1.0;
        return { id: c.id, acc, total: stats.total };
      })
      .filter((item) => item.total > 0 && item.acc < 0.7)
      .map((item) => item.id);

    const weakCatQs = questions.filter((q) => weakCatIds.includes(q.catId));

    // 4. Find unattempted questions
    const practicedIds = Object.keys(progress.srCards);
    const unattemptedQs = questions.filter((q) => !practicedIds.includes(q.id) && !progress.wrongIds.includes(q.id));

    // Curate adaptive learning pool
    const selected: Question[] = [];
    const selectedIds = new Set<string>();

    const addFromPool = (pool: Question[], targetCount: number) => {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      let added = 0;
      for (const q of shuffled) {
        if (added >= targetCount) break;
        if (!selectedIds.has(q.id)) {
          selected.push(q);
          selectedIds.add(q.id);
          added++;
        }
      }
    };

    // Split distribution based on memory retention and clinical gaps:
    // - 40% errors / weak concepts (targeted correction)
    // - 30% active recall / spaced repetition (memory reinforcement)
    // - 30% discovery / unattempted clinical cards (expansion)
    const targetWrong = Math.round(count * 0.4);
    const targetSR = Math.round(count * 0.3);
    const targetUnattempted = count - targetWrong - targetSR;

    const wrongAndWeakPool = [...wrongQs, ...weakCatQs];
    addFromPool(wrongAndWeakPool, targetWrong);
    addFromPool(dueQs, targetSR);
    addFromPool(unattemptedQs, targetUnattempted);

    // If still short of the requested count, fill with unattempted or general questions
    if (selected.length < count) {
      const remainingCount = count - selected.length;
      addFromPool(unattemptedQs.length > 0 ? unattemptedQs : questions, remainingCount);
    }

    setActiveSession({
      mode: 'adaptive',
      questions: selected,
      currentIndex: 0,
      selectedOption: null,
      answered: false,
      answers: [],
      customTitle: 'Stërvitje Adaptive',
    });
    setExamRemainingSeconds(null);
    showToast('💡 Sesioni adaptiv u krijua! Fokusuar te pikat tuaja të dobëta dhe rishikimi SM-2.', 'success');
  };

  // SESSION GAMEPLAY LOGIC
  const handleSelectOption = (idx: number) => {
    if (!activeSession || activeSession.answered) return;
    setActiveSession({
      ...activeSession,
      selectedOption: idx,
    });
  };

  const handleSubmitAnswer = () => {
    if (!activeSession || activeSession.selectedOption === null || activeSession.answered) return;

    const currentQ = activeSession.questions[activeSession.currentIndex];
    const isCorr = activeSession.selectedOption === currentQ.answer;

    // Track original card state if SR or Adaptive mode
    let prevCard = null;
    if ((activeSession.mode === 'sr' || activeSession.mode === 'adaptive') && progress) {
      prevCard = progress.srCards[currentQ.id] || getNewSRCard();
    }

    const log: AnswerLog = {
      question: currentQ,
      selected: activeSession.selectedOption,
      correct: isCorr ? 1 : 0,
    };

    setActiveSession({
      ...activeSession,
      answered: true,
      answers: [...activeSession.answers, log],
      pendingSRCard: prevCard ? { qId: currentQ.id, prevCard } : undefined,
    });
  };

  const handleToggleBookmark = (specificId?: string | any) => {
    if (!progress) return;
    
    let qId = '';
    if (specificId && typeof specificId === 'string') {
      qId = specificId;
    } else {
      if (!activeSession) return;
      qId = activeSession.questions[activeSession.currentIndex].id;
    }

    const bIds = [...progress.bookmarkIds];
    const exists = bIds.includes(qId);

    let nextIds = [];
    if (exists) {
      nextIds = bIds.filter((id) => id !== qId);
      showToast('U hoq nga të shënuarat.', 'info');
    } else {
      nextIds = [...bIds, qId];
      showToast('U shtua te pyetjet e shënuara!', 'success');
    }

    const updated = { ...progress, bookmarkIds: nextIds };
    setProgress(updated);
    saveProgress(updated);
  };

  const handleOpenReport = () => {
    if (!activeSession) return;
    const currentQ = activeSession.questions[activeSession.currentIndex];
    if (!currentQ) return;
    setReportingQuestionId(currentQ.id);
    setReportReason('');
    setIsReportModalOpen(true);
  };

  const handleSubmitReport = () => {
    if (!reportingQuestionId) return;
    const qItem = questions.find(q => q.id === reportingQuestionId);
    if (!qItem) return;
    
    const catName = categories.find(c => c.id === qItem.catId)?.name || 'E panjohur';
    const topicName = topics.find(t => t.id === qItem.topicId)?.name || 'E panjohur';
    const cleanReason = reportReason.trim() || 'Dyshues për saktësinë (Kërkon rishikim)';
    
    addQuestionReport(
      reportingQuestionId,
      qItem.text,
      catName,
      topicName,
      cleanReason
    );
    
    showToast('✓ Raporti i gabimit u dërgua te adminët me sukses!', 'success');
    setIsReportModalOpen(false);
    setReportingQuestionId(null);
    setReportReason('');
  };

  // Advanced progress algorithm with achievement milestones and SM-2 feedback
  const handleRateSR = (quality: number) => {
    if (!activeSession || !progress || !activeSession.pendingSRCard) return;
    const { qId, prevCard } = activeSession.pendingSRCard;

    const updatedCard = sm2Update(prevCard, quality);
    const nextSRCards = { ...progress.srCards, [qId]: updatedCard };

    // Update wrong list and wrong counts
    let nextWrongIds = [...progress.wrongIds];
    const nextWrongCounts = { ...(progress.wrongCounts || {}) };
    const correctVal = quality >= 2 ? 1 : 0;
    if (correctVal === 0) {
      if (!nextWrongIds.includes(qId)) nextWrongIds.push(qId);
      nextWrongCounts[qId] = (nextWrongCounts[qId] || 0) + 1;
    } else {
      nextWrongIds = nextWrongIds.filter((id) => id !== qId);
    }

    const updated = {
      ...progress,
      srCards: nextSRCards,
      wrongIds: nextWrongIds,
      wrongCounts: nextWrongCounts,
    };

    setProgress(updated);
    saveProgress(updated);

    // Advance
    advanceQuizWorkflow();
  };

  const handleNextQuestionOrExplanation = () => {
    if (!activeSession) return;
    if (activeSession.mode === 'test') {
      // In test mode, we do not show explanation screens, advance immediately
      advanceQuizWorkflow();
    } else {
      // For study modes, we showed answer preview, now toggle to Explanation screen
      setActiveSession({
        ...activeSession,
        showExplanation: true,
      });
    }
  };

  const advanceQuizWorkflow = () => {
    if (!activeSession) return;
    const { currentIndex, questions: qList } = activeSession;
    if (currentIndex === qList.length - 1) {
      handleFinishSession();
    } else {
      setActiveSession({
        ...activeSession,
        currentIndex: currentIndex + 1,
        selectedOption: null,
        answered: false,
        showExplanation: false,
        pendingSRCard: undefined,
      });
    }
  };

  const handleFinishSession = () => {
    if (!activeSession || !progress) return;
    const { answers, mode } = activeSession;
    const total = answers.length;
    const correctCount = answers.filter((a) => a.correct === 1).length;

    // Advanced progress sync: SM-2, streak preservation, milestones unlocking
    const today = new Date().toDateString();
    let nextStreak = progress.streak;
    let nextLastDate = progress.lastAnswerDate;

    // Update streak if they got at least 3 correct today
    if (correctCount >= 3) {
      if (progress.lastAnswerDate !== today) {
        nextStreak = progress.lastAnswerDate === new Date(Date.now() - 86400000).toDateString() ? progress.streak + 1 : 1;
        nextLastDate = today;
      }
    }

    // Category breakdown updates
    const nextCatStats = { ...progress.catStats };
    answers.forEach((ans) => {
      const q = ans.question;
      const stats = nextCatStats[q.catId] || { total: 0, correct: 0 };
      stats.total++;
      if (ans.correct === 1) stats.correct++;
      nextCatStats[q.catId] = stats;
    });

    // Update wrong list and wrong counts
    let nextWrongIds = [...progress.wrongIds];
    const nextWrongCounts = { ...(progress.wrongCounts || {}) };
    answers.forEach((ans) => {
      const q = ans.question;
      if (ans.correct === 0) {
        if (!nextWrongIds.includes(q.id)) nextWrongIds.push(q.id);
        nextWrongCounts[q.id] = (nextWrongCounts[q.id] || 0) + 1;
      } else {
        if (mode === 'wrong' || mode === 'sr' || mode === 'adaptive') {
          nextWrongIds = nextWrongIds.filter((id) => id !== q.id);
        }
      }
    });

    // Spaced repetition scheduler if in normal train/test mode
    const nextSRCards = { ...progress.srCards };
    if (mode !== 'sr' && mode !== 'adaptive') {
      answers.forEach((ans) => {
        const q = ans.question;
        const currentCard = nextSRCards[q.id] || getNewSRCard();
        // automatic rate quality based on correct response
        const quality = ans.correct === 1 ? 2 : 0;
        nextSRCards[q.id] = sm2Update(currentCard, quality);
      });
    }

    // Milestones checks
    const nextBadges = [...progress.badges];
    const totalD = progress.totalDone + total;
    const totalC = progress.totalCorrect + correctCount;

    if (totalD >= 1 && !nextBadges.includes('badge_1')) nextBadges.push('badge_1');
    if (totalD >= 50 && !nextBadges.includes('badge_50')) nextBadges.push('badge_50');
    if (nextStreak >= 3 && !nextBadges.includes('badge_streak_3')) nextBadges.push('badge_streak_3');
    if (totalC / totalD >= 0.85 && totalD >= 15 && !nextBadges.includes('badge_acc_85')) nextBadges.push('badge_acc_85');

    // Save history
    const nextHistory = [...progress.history];
    nextHistory.push({
      date: today,
      done: total,
      correct: correctCount,
    });

    const updatedProgress: UserProgress = {
      ...progress,
      totalDone: totalD,
      totalCorrect: totalC,
      streak: nextStreak,
      lastAnswerDate: nextLastDate,
      wrongIds: nextWrongIds,
      wrongCounts: nextWrongCounts,
      srCards: nextSRCards,
      catStats: nextCatStats,
      badges: nextBadges,
      history: nextHistory.slice(-30), // keep last 30 days
    };

    setProgress(updatedProgress);
    saveProgress(updatedProgress);

    setActiveSession({
      ...activeSession,
      isFinished: true,
      answers,
    });

    setExamRemainingSeconds(null);

    // Show celebratory confetti if scored highly
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    if (pct >= 80) {
      setShowConfetti(true);
      showToast('🎉 Urime! Rezultat i shkëlqyer klinik!', 'success');
    } else if (pct >= 70) {
      showToast('👍 Shumë mirë! Keni kaluar pragun e saktësisë.', 'success');
    } else {
      showToast('Mbaroi! Rishikoni shpjegimet klinike për t\'u përmirësuar.', 'info');
    }
  };

  const handleExitQuiz = () => {
    setIsExitConfirmOpen(true);
  };

  const handleExitAndSaveProgress = () => {
    if (!activeSession || !progress) return;
    const { answers, mode } = activeSession;
    const total = answers.length;
    if (total === 0) {
      setIsExitConfirmOpen(false);
      setActiveSession(null);
      setExamRemainingSeconds(null);
      showToast('Kuizi u mbyll pa progres, pasi asnjë pyetje nuk u përgjigj.', 'info');
      return;
    }

    const correctCount = answers.filter((a) => a.correct === 1).length;
    const today = new Date().toDateString();
    let nextStreak = progress.streak;
    let nextLastDate = progress.lastAnswerDate;

    if (correctCount >= 3) {
      if (progress.lastAnswerDate !== today) {
        nextStreak = progress.lastAnswerDate === new Date(Date.now() - 86400000).toDateString() ? progress.streak + 1 : 1;
        nextLastDate = today;
      }
    }

    const nextCatStats = { ...progress.catStats };
    answers.forEach((ans) => {
      const q = ans.question;
      const stats = nextCatStats[q.catId] || { total: 0, correct: 0 };
      stats.total++;
      if (ans.correct === 1) stats.correct++;
      nextCatStats[q.catId] = stats;
    });

    let nextWrongIds = [...progress.wrongIds];
    const nextWrongCounts = { ...(progress.wrongCounts || {}) };
    answers.forEach((ans) => {
      const q = ans.question;
      if (ans.correct === 0) {
        if (!nextWrongIds.includes(q.id)) nextWrongIds.push(q.id);
        nextWrongCounts[q.id] = (nextWrongCounts[q.id] || 0) + 1;
      } else {
        if (mode === 'wrong' || mode === 'sr' || mode === 'adaptive') {
          nextWrongIds = nextWrongIds.filter((id) => id !== q.id);
        }
      }
    });

    const nextSRCards = { ...progress.srCards };
    if (mode !== 'sr' && mode !== 'adaptive') {
      answers.forEach((ans) => {
        const q = ans.question;
        const currentCard = nextSRCards[q.id] || getNewSRCard();
        const quality = ans.correct === 1 ? 2 : 0;
        nextSRCards[q.id] = sm2Update(currentCard, quality);
      });
    }

    const nextBadges = [...progress.badges];
    const totalD = progress.totalDone + total;
    const totalC = progress.totalCorrect + correctCount;

    if (totalD >= 1 && !nextBadges.includes('badge_1')) nextBadges.push('badge_1');
    if (totalD >= 50 && !nextBadges.includes('badge_50')) nextBadges.push('badge_50');
    if (nextStreak >= 3 && !nextBadges.includes('badge_streak_3')) nextBadges.push('badge_streak_3');
    if (totalC / totalD >= 0.85 && totalD >= 15 && !nextBadges.includes('badge_acc_85')) nextBadges.push('badge_acc_85');

    const nextHistory = [...progress.history];
    nextHistory.push({
      date: today,
      done: total,
      correct: correctCount,
    });

    const updatedProgress: UserProgress = {
      ...progress,
      totalDone: totalD,
      totalCorrect: totalC,
      streak: nextStreak,
      lastAnswerDate: nextLastDate,
      wrongIds: nextWrongIds,
      wrongCounts: nextWrongCounts,
      srCards: nextSRCards,
      catStats: nextCatStats,
      badges: nextBadges,
      history: nextHistory.slice(-30),
    };

    setProgress(updatedProgress);
    saveProgress(updatedProgress);

    setIsExitConfirmOpen(false);
    setActiveSession(null);
    setExamRemainingSeconds(null);
    showToast(`Progresi u ruajt! Ju u përgjigjët saktë ${correctCount}/${total} pyetjeve.`, 'success');
  };

  // RENDER SELECTION CHANGER
  const getProgressCircleDashOffset = () => {
    if (!progress) return 276;
    const doneToday = progress.history
      .filter((h) => h.date === new Date().toDateString())
      .reduce((s, h) => s + h.done, 0);
    const goal = 20;
    const pct = Math.min(100, Math.round((doneToday / goal) * 100));
    return 276 - (pct / 100) * 276;
  };

  const getModeLabel = (mode: QuizMode) => {
    switch (mode) {
      case 'test': return 'Provim Shtetëror';
      case 'train': return 'Stërvitje e Shpejtë';
      case 'wrong': return 'Ditari i Gabimeve';
      case 'sr': return 'Përsëritje e Rregullt (SM-2)';
      case 'bookmarks': return 'Pyetjet e Ruajtura';
      case 'custom': return 'Kuiz i Personalizuar';
      case 'adaptive': return 'Mënyra Inteligjente Adaptive';
      default: return 'Seancë Studimi';
    }
  };

  if (!progress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-4 border-sky-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-bold font-mono">Duke sinkronizuar të dhënat klinike...</p>
        </div>
      </div>
    );
  }

  // GAMEPLAY RENDER BLOCK OVERRIDE
  if (activeSession && !activeSession.isFinished && !activeSession.isPaused) {
    if (activeSession.showExplanation) {
      return (
        <>
          <ExplanationScreen
            session={activeSession}
            progress={progress}
            onToggleBookmark={() => handleToggleBookmark()}
            onRateSR={activeSession.mode === 'sr' ? handleRateSR : undefined}
            onNext={advanceQuizWorkflow}
            onExit={handleExitQuiz}
            onReportError={handleOpenReport}
          />
          <Modal
            isOpen={isExitConfirmOpen}
            title="Ndërpre kuizin?"
            body="Çfarë dëshironi të bëni me këtë kuiz? Mund të vazhdoni studimin, të pezulloni sesionin për më vonë, ose të dilni duke ruajtur progresin e deritanishëm."
            onClose={() => setIsExitConfirmOpen(false)}
            buttons={[
              {
                label: 'Vazhdo kuizin',
                variant: 'cancel',
                onClick: () => setIsExitConfirmOpen(false),
              },
              {
                label: 'Pezullo kuizin',
                onClick: () => {
                  setIsExitConfirmOpen(false);
                  if (activeSession) {
                    setActiveSession({
                      ...activeSession,
                      isPaused: true,
                    });
                  }
                  setActiveTab('home');
                  showToast('Kuizi u pezullua. Mund ta vazhdoni në çdo kohë nga Kreu.', 'success');
                },
              },
              {
                label: 'Dil dhe ruaj progresin',
                variant: 'primary',
                onClick: handleExitAndSaveProgress,
              },
            ]}
          />
        </>
      );
    }
    return (
      <>
        <QuizScreen
          session={activeSession}
          progress={progress}
          examRemainingSeconds={examRemainingSeconds}
          onSelectOption={handleSelectOption}
          onSubmitAnswer={handleSubmitAnswer}
          onNextQuestion={handleNextQuestionOrExplanation}
          onToggleBookmark={handleToggleBookmark}
          onExitQuiz={handleExitQuiz}
          onReportError={handleOpenReport}
        />
        <Modal
          isOpen={isExitConfirmOpen}
          title="Ndërpre kuizin?"
          body="Çfarë dëshironi të bëni me këtë kuiz? Mund të vazhdoni studimin, të pezulloni sesionin për më vonë, ose të dilni duke ruajtur progresin e deritanishëm."
          onClose={() => setIsExitConfirmOpen(false)}
          buttons={[
            {
              label: 'Vazhdo kuizin',
              variant: 'cancel',
              onClick: () => setIsExitConfirmOpen(false),
            },
            {
              label: 'Pezullo kuizin',
              onClick: () => {
                setIsExitConfirmOpen(false);
                if (activeSession) {
                  setActiveSession({
                    ...activeSession,
                    isPaused: true,
                  });
                }
                setActiveTab('home');
                showToast('Kuizi u pezullua. Mund ta vazhdoni në çdo kohë nga Kreu.', 'success');
              },
            },
            {
              label: 'Dil dhe ruaj progresin',
              variant: 'primary',
              onClick: handleExitAndSaveProgress,
            },
          ]}
        />
      </>
    );
  }

  if (activeSession && activeSession.isFinished) {
    return (
      <ResultsScreen
        session={activeSession}
        progress={progress}
        onRestartWrong={() => {
          setActiveSession(null);
          setTimeout(startWrongCorrectionMode, 100);
        }}
        onSwitchToTrain={() => {
          setActiveSession(null);
          setTimeout(() => startTrainMode(15), 100);
        }}
        onGoHome={() => {
          setActiveSession(null);
          setActiveTab('home');
        }}
      />
    );
  }

  if (!isDbReady || !progress) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[var(--duo-navy)] flex flex-col items-center justify-center p-6 text-center select-none transition-all duration-300">
        <div className="space-y-6 max-w-sm">
          {/* Animated Pulsing heartbeat/medical graphic */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 bg-[var(--duo-blue)]/10 dark:bg-sky-500/10 rounded-full animate-ping duration-1000" />
            <div className="absolute w-16 h-16 bg-[var(--duo-blue)]/25 dark:bg-sky-500/20 rounded-full animate-pulse duration-700" />
            <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-[var(--duo-blue)] text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg border-b-4 border-sky-600 dark:border-sky-850 relative">
              🩺
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Mjek Hyrje</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold max-w-xs leading-relaxed">
              Duke përgatitur bankën klinike me deri në 7k pyetje dhe sqarime...
            </p>
          </div>

          <div className="w-48 mx-auto bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-300/10 relative">
            <div className="h-full bg-gradient-to-r from-sky-400 to-[var(--duo-blue)] rounded-full animate-pulse" style={{ width: '100%' }} />
          </div>
          <span className="text-[9px] text-slate-400 font-mono tracking-wider uppercase font-black">Optimizimi i Shpejtësisë</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-800 dark:text-slate-100 pb-20 select-none">
      {/* Dynamic confetti */}
      <Confetti active={showConfetti} onDone={() => setShowConfetti(false)} />

      {/* Navbar header */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'admin' && !isAdminLoggedIn) {
            setIsAdminLoginOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        progress={progress}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onLogoClick={handleLogoClick}
        dueCount={memoryHealth.dueCount}
      />

      {/* Main tab panel container */}
      <div className="max-w-[480px] mx-auto px-4">
        {/* TAB: SHTËPI */}
        {activeTab === 'home' && (
          <section className="space-y-5 animate-in fade-in duration-200 font-sans text-left" id="homeView">
            
            {/* Clinical Greeting Header */}
            <div className="pb-2 border-b border-slate-150 dark:border-slate-800/80 flex items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 tracking-tight">
                  Mirësevini, Doktor! 🩺
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                  Sot është {new Date().toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long' })}.
                </p>
              </div>
            </div>

            {/* PWA Promotion Banner */}
            {!isStandalone && showInstallBanner && (
              <div className="bg-sky-500/[0.04] dark:bg-sky-500/[0.02] border-2 border-sky-500/15 dark:border-sky-500/10 rounded-2xl p-4 text-left flex gap-4 shadow-xs relative overflow-hidden animate-in slide-in-from-top-2 duration-200">
                <button 
                  onClick={handleDismissPwaBanner}
                  className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Mbyll"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                <div className="w-11 h-11 rounded-xl bg-sky-500/10 dark:bg-sky-500/15 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
                  <Smartphone className="w-5.5 h-5.5" />
                </div>

                <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                  <span className="bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 text-[9px] font-black px-2 py-0.5 rounded-md font-mono uppercase tracking-wider border border-sky-500/10">
                    Aplikacion Mobil (PWA)
                  </span>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Instalo "Mjek Hyrje" në Telefon! 📱
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                    Zgjidhni pyetjet pa pasur nevojë për internet (Offline), më shpejt dhe direkt nga ekrani juaj kryesor.
                  </p>

                  {deferredPrompt ? (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleInstallApp}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Instalo Aplikacionin
                      </button>
                    </div>
                  ) : isIOS ? (
                    <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 rounded-xl p-2.5 mt-2 space-y-1 text-[10px] text-slate-600 dark:text-slate-300">
                      <p className="font-bold text-slate-700 dark:text-slate-200">Si ta instaloni në iOS (iPhone/iPad):</p>
                      <ol className="list-decimal list-inside space-y-1 font-medium">
                        <li>Kliko butonin <span className="inline-flex items-center justify-center bg-slate-100 dark:bg-slate-800 p-1 rounded font-mono font-bold text-[9px]">Share <Share className="w-3 h-3 inline ml-0.5" /></span> në Safari.</li>
                        <li>Zgjidh opsionin <span className="font-bold">"Shto në Ekranin Kryesor"</span> (Add to Home Screen).</li>
                      </ol>
                    </div>
                  ) : (
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 italic mt-1 font-semibold">
                      Për ta instaluar, hapni aplikacionin në Chrome, Edge ose Safari dhe shtypni ikonën e instalimit në shiritin e adresave.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* SM-2 Overdue Questions Simple Notification Banner */}
            {memoryHealth.dueCount > 0 && (
              <div className="bg-rose-500/[0.04] dark:bg-rose-500/[0.02] border-2 border-rose-500/15 dark:border-rose-500/10 rounded-2xl p-4.5 text-left flex gap-4 shadow-xs animate-in slide-in-from-top-3 duration-200">
                <div className="w-11 h-11 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
                  <div className="relative">
                    <Bell className="w-5.5 h-5.5 fill-rose-500/10" />
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full" />
                  </div>
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-[9px] font-black px-2 py-0.5 rounded-md font-mono uppercase tracking-wider border border-rose-500/10">
                      Rishikim i prapambetur
                    </span>
                    <span className="text-[10px] text-rose-500 dark:text-rose-400 font-mono font-bold">
                      {memoryHealth.dueCount} pyetje dëshmojnë prapambetje
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Keni pyetje klinike që presin rishikimin sot!
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                    Algoritmi i Përsëritjes së Programuar (SM-2) ka përcaktuar që {memoryHealth.dueCount} pyetje kanë arritur pikën e harresës. Rishikojini tani për të rikthyer shëndetin e kujtesës në 100%!
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={startSpacedRepetitionMode}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-[10.5px] font-bold rounded-lg transition-all cursor-pointer shadow-xs"
                    >
                      🧠 Rishiko Tani Pyetjet <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Active Session Resume Card */}
            {activeSession && !activeSession.isFinished && activeSession.isPaused && (
              <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900/50 rounded-2xl p-4 text-left flex gap-3.5 shadow-xs animate-in slide-in-from-top-3 duration-200">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                  <Play className="w-5 h-5 fill-indigo-600/10" />
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[9px] font-black px-2 py-0.5 rounded-md font-mono uppercase tracking-wider">
                      Kuiz në progres
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-semibold">
                      {activeSession.answers.length}/{activeSession.questions.length} pyetje
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    Vazhdo kuizin e fundit: {activeSession.customTitle || getModeLabel(activeSession.mode)}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                    Keni mbetur te pyetja {activeSession.currentIndex + 1} e këtij sesioni. Klikoni butonin më poshtë për të vazhduar pikërisht ku e keni lënë.
                  </p>
                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSession({
                          ...activeSession,
                          isPaused: false
                        });
                      }}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-xs"
                    >
                      Vazhdo Kuizin <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSession(null);
                        setExamRemainingSeconds(null);
                        showToast('Kuizi i ndërprerë u fshi.', 'warn');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                    >
                      Anulo
                    </button>
                  </div>
                </div>
              </div>
            )}



            {/* Highly Visible Guidance / Quick Tour Card */}
            <div className="bg-sky-50 dark:bg-sky-950/25 border border-sky-150 dark:border-sky-900/50 rounded-2xl p-4 text-left flex gap-3 shadow-xs">
              <span className="text-xl shrink-0 mt-0.5">💡</span>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Keni nevojë për udhëzim në platformë?
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                  Mësoni si të përdorni mjetet, si funksionon metoda Spaced Repetition (SM-2) dhe si të maksimizoni saktësinë tuaj mjekësore.
                </p>
                <button
                  type="button"
                  onClick={() => setIsQuickStartOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-xs mt-1"
                >
                  🚀 Nis Turin e Shpejtë të Platformës
                </button>
              </div>
            </div>

            {/* Today's Recommended Study Card with Massive Direct Quiz Buttons */}
            <div className="bg-white dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold tracking-wider uppercase text-sky-600 dark:text-sky-400 font-mono block">
                    Qëllimi Ditor
                  </span>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                    Stërvitja e Rekomanduar ✨
                  </h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                    Zgjidhni të paktën 20 pyetje në ditë për të krijuar memorie të fortë klinike.
                  </p>
                </div>

                {/* Progress Circle Ring */}
                <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 110 110">
                    <circle cx="55" cy="55" r="44" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="8" fill="none" />
                    <circle
                      cx="55"
                      cy="55"
                      r="44"
                      className="stroke-sky-500"
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={276}
                      strokeDashoffset={getProgressCircleDashOffset()}
                    />
                  </svg>
                  <span className="absolute text-[9px] font-bold font-mono text-slate-800 dark:text-slate-300">
                    {Math.min(100, Math.round((getDoneTodayCount() / 20) * 100))}%
                  </span>
                </div>
              </div>

              {/* Central Direct Action Buttons */}
              <div className="space-y-2.5 pt-1.5">
                <button
                  type="button"
                  onClick={startSmartRecommendedSession}
                  className="w-full py-3.5 bg-[#58cc02] hover:bg-[#46a302] active:scale-[0.98] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-md shadow-green-500/10 cursor-pointer"
                >
                  ▶ Nis një Kuiz të Shpejtë (20 Pyetje)
                </button>
                
                <button
                  type="button"
                  onClick={() => setActiveTab('modes')}
                  className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 active:scale-[0.98] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-md shadow-sky-500/10 cursor-pointer"
                >
                  🎯 Fillo Kuizin (Mënyrat e Studimit)
                </button>
              </div>
            </div>

            {/* Clean Minimalist Microstats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800/80 p-3 rounded-xl text-center shadow-xs">
                <span className="text-base font-bold text-slate-900 dark:text-slate-100 block font-mono">
                  {progress.totalDone}
                </span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block font-sans mt-0.5">
                  Zgjidhur
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800/80 p-3 rounded-xl text-center shadow-xs">
                <span className="text-base font-bold text-sky-600 dark:text-sky-400 block font-mono">
                  {progress.totalDone > 0 ? Math.round((progress.totalCorrect / progress.totalDone) * 100) : 0}%
                </span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block font-sans mt-0.5">
                  Saktësia
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800/80 p-3 rounded-xl text-center shadow-xs">
                <span className="text-base font-bold text-amber-600 dark:text-amber-400 block font-mono">
                  🔥 {progress.streak} d
                </span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block font-sans mt-0.5">
                  Seria
                </span>
              </div>
            </div>

          </section>
        )}

        {/* TAB: STATISTIKA */}
        {activeTab === 'stats' && (
          <section className="space-y-5 animate-in fade-in duration-200 font-sans text-left" id="statsView">
            
            {/* Segmented Sub-tabs selector */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100/80 dark:bg-slate-900/40 rounded-2xl border border-slate-200/40 dark:border-slate-800/60 shadow-xs">
              <button
                type="button"
                onClick={() => setStatsSubTab('summary')}
                className={`py-2 text-[10px] font-black rounded-xl transition-all cursor-pointer ${
                  statsSubTab === 'summary'
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-350'
                }`}
              >
                Përmbledhje
              </button>
              <button
                type="button"
                onClick={() => setStatsSubTab('analytics')}
                className={`py-2 text-[10px] font-black rounded-xl transition-all cursor-pointer ${
                  statsSubTab === 'analytics'
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-350'
                }`}
              >
                Analitikë
              </button>
              <button
                type="button"
                onClick={() => setStatsSubTab('categories')}
                className={`py-2 text-[10px] font-black rounded-xl transition-all cursor-pointer ${
                  statsSubTab === 'categories'
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-350'
                }`}
              >
                Kategoritë
              </button>
              <button
                type="button"
                onClick={() => setStatsSubTab('errors')}
                className={`py-2 text-[10px] font-black rounded-xl transition-all cursor-pointer ${
                  statsSubTab === 'errors'
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-350'
                }`}
              >
                Gabimet ({progress.wrongIds.length})
              </button>
            </div>

            {/* SUBTAB CONTENT: SUMMARY */}
            {statsSubTab === 'summary' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Readiness Card */}
                {(() => {
                  const r = calculateReadiness(progress, questions.length);
                  return (
                    <div className="bg-white dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block mb-1.5">Statusi i Përgatitjes</span>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-base font-bold tracking-tight" style={{ color: r.color }}>
                            {r.label}
                          </h3>
                          <p className="text-xs text-slate-400 font-semibold mt-1">
                            Saktësia ({r.acc}%) dhe Mbulimi ({r.coverage}%)
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-2xl font-bold font-mono tracking-tight" style={{ color: r.color }}>
                            {r.score}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-4">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${r.score}%`, backgroundColor: r.color }} />
                      </div>
                    </div>
                  );
                })()}

                {/* AI Score Prediction Model */}
                {progress && (
                  <ScorePredictionModel
                    progress={progress}
                    questions={questions}
                    categories={categories}
                    memoryHealth={memoryHealth}
                  />
                )}


              </div>
            )}

            {/* SUBTAB CONTENT: ANALYTICS */}
            {statsSubTab === 'analytics' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Memory Health Chart Widget */}
                {(() => {
                  const { healthScore, longTermCount, riskCount, dueCount, stableCount, totalStudied, chartData } = memoryHealth;
                  
                  // Find the category status label
                  let statusLabel = 'Fillestar';
                  let statusColor = 'text-slate-400';
                  if (healthScore >= 95) {
                    statusLabel = 'Legjendare 🏆';
                    statusColor = 'text-emerald-500';
                  } else if (healthScore >= 85) {
                    statusLabel = 'E Shkëlqyer 🧪';
                    statusColor = 'text-sky-500';
                  } else if (healthScore >= 70) {
                    statusLabel = 'E Qëndrueshme 👍';
                    statusColor = 'text-amber-500';
                  } else {
                    statusLabel = 'Në Rrezik Rënie ⚠️';
                    statusColor = 'text-rose-500';
                  }

                  return (
                    <div className="bg-white dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans block mb-1">
                          Kujtesa Aktive & Retencioni
                        </span>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                          Shëndeti i Memories Klinike
                        </h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-normal">
                          Përqindja e njohurive të mbrojtura nga kurba e harresës.
                        </p>
                      </div>

                      {/* Donut Chart & Score container */}
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2 bg-slate-50/50 dark:bg-slate-900/10 p-4 border border-slate-150 dark:border-slate-800/85 rounded-xl">
                        <div className="relative w-[180px] h-[180px] flex items-center justify-center shrink-0 select-none">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={75}
                                paddingAngle={totalStudied > 0 ? 3 : 0}
                                dataKey="value"
                              >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white p-3 rounded-xl text-[11px] shadow-xl border border-slate-700/50 max-w-[180px] text-left">
                                        <p className="font-bold" style={{ color: data.color }}>{data.name}</p>
                                        <p className="font-semibold text-slate-200 mt-1">{data.value} pyetje</p>
                                        <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">{data.desc}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>

                          {/* Absolutly-centered donut label */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                            <span className="text-2xl font-bold font-mono tracking-tighter text-slate-800 dark:text-slate-100 leading-none">
                              {healthScore}%
                            </span>
                            <span className="text-[8px] font-bold uppercase text-slate-400 tracking-wider mt-1 block">
                              Shëndeti
                            </span>
                            <span className={`text-[9px] font-bold ${statusColor} mt-0.5 font-mono uppercase tracking-wide`}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>

                        {/* Quick list of metrics */}
                        <div className="flex-1 w-full text-left space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                              Totali i Studiuar:
                            </span>
                            <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                              {totalStudied} pyetje
                            </span>
                          </div>

                          <div className="space-y-2">
                            {/* Kujtesa Afatgjatë */}
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-start gap-1.5 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-none">Kujtesa afatgjatë</p>
                                  <p className="text-[8px] text-slate-400 font-semibold leading-normal mt-0.5">Të mbrojtura plotësisht</p>
                                </div>
                              </div>
                              <span className="text-xs font-bold font-mono text-[#10B981] shrink-0">
                                {longTermCount} ({totalStudied > 0 ? Math.round((longTermCount / totalStudied) * 100) : 0}%)
                              </span>
                            </div>

                            {/* Mësim i Qëndrueshëm */}
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-start gap-1.5 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9] mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-none">Mësim i qëndrueshëm</p>
                                  <p className="text-[8px] text-slate-400 font-semibold leading-normal mt-0.5">Në rritje saktësie</p>
                                </div>
                              </div>
                              <span className="text-xs font-bold font-mono text-[#0EA5E9] shrink-0">
                                {stableCount} ({totalStudied > 0 ? Math.round((stableCount / totalStudied) * 100) : 0}%)
                              </span>
                            </div>

                            {/* Në Rrezik Harrese */}
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-start gap-1.5 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-none">Rrezik harrese</p>
                                  <p className="text-[8px] text-slate-400 font-semibold leading-normal mt-0.5">Sapo të filluara/fragile</p>
                                </div>
                              </div>
                              <span className="text-xs font-bold font-mono text-[#F97316] shrink-0">
                                {riskCount} ({totalStudied > 0 ? Math.round((riskCount / totalStudied) * 100) : 0}%)
                              </span>
                            </div>

                            {/* Duhen Përsëritur Sot */}
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-start gap-1.5 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-none">Për t'u përsëritur sot</p>
                                  <p className="text-[8px] text-slate-400 font-semibold leading-normal mt-0.5">Zbehen po nuk u rishikuan</p>
                                </div>
                              </div>
                              <span className="text-xs font-bold font-mono text-[#EF4444] shrink-0">
                                {dueCount} ({totalStudied > 0 ? Math.round((dueCount / totalStudied) * 100) : 0}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Motivational button if there are pending reviews */}
                      {dueCount > 0 ? (
                        <button
                          type="button"
                          onClick={startSpacedRepetitionMode}
                          className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-[0.98] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          🧠 Rishiko Tani {dueCount} Pyetjet e Sotme (+ Rrit Shëndetin)
                        </button>
                      ) : totalStudied > 0 ? (
                        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl text-center text-[11px] font-semibold leading-relaxed">
                          🎉 Përsosuri! Kujtesa juaj klinike është e rishikuar plotësisht për sot! Shëndeti i memories po shkëlqen.
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50/50 dark:bg-slate-900/20 border border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-center text-[11px] font-semibold leading-relaxed">
                          💡 Nuk ka ende asnjë pyetje të studiuar. Fillo një stërvitje që të ndërtosh kujtesën klinike!
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Simple SVGBars chart representing activity history */}
                <div className="bg-white dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 font-sans">
                    Aktiviteti i Studimit (7 ditët e fundit)
                  </h3>
                  <div className="flex items-end justify-between h-24 pt-4 px-2">
                    {[...Array(7)].map((_, i) => {
                      const d = new Date(Date.now() - (6 - i) * 86400000).toDateString();
                      const logs = progress.history.filter((h) => h.date === d);
                      const count = logs.reduce((s, h) => s + h.done, 0);
                      const height = Math.min(100, Math.max(8, (count / 30) * 100));
                      return (
                        <div key={i} className="flex flex-col items-center flex-1 gap-1.5">
                          <div className="relative w-4 bg-slate-100 dark:bg-slate-800/80 rounded-full h-16 flex flex-col justify-end overflow-hidden group">
                            <div
                              className="w-full bg-[#0ea5e9] rounded-full hover:opacity-90 transition-all"
                              style={{ height: `${height}%` }}
                            />
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1 py-0.5 rounded font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                              {count}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 font-sans">
                            {new Date(d).toLocaleDateString('sq', { weekday: 'narrow' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CARD: RADAR CHART - Saktësia sipas Disciplinave Mjekësore */}
                {progress && categories && categories.length > 0 && (
                  <div className="bg-white dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans block mb-1">
                        Analiza e Kompetencave
                      </span>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                        Saktësia sipas Disciplinave Mjekësore
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-normal">
                        Saktësia e përgjigjeve tuaja e krahasuar sipas lëndëve kryesore mjekësore.
                      </p>
                    </div>

                    {(() => {
                      const radarData = categories.map((c) => {
                        const stats = progress.catStats[c.id] || { total: 0, correct: 0 };
                        const acc = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                        return {
                          subject: c.name.length > 18 ? c.name.substring(0, 16) + "..." : c.name,
                          saktësia: acc,
                          total: stats.total,
                          correct: stats.correct,
                        };
                      });

                      const hasAnyActivity = radarData.some(d => d.total > 0);

                      return (
                        <div className="space-y-4">
                          <div className="w-full h-[280px] flex items-center justify-center py-2 bg-slate-50/50 dark:bg-slate-900/10 p-4 border border-slate-150 dark:border-slate-800/85 rounded-xl overflow-hidden">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                                <PolarAngleAxis
                                  dataKey="subject"
                                  tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                                />
                                <PolarRadiusAxis
                                  angle={30}
                                  domain={[0, 100]}
                                  tick={{ fill: '#94a3b8', fontSize: 8 }}
                                  stroke="#cbd5e1"
                                />
                                <Radar
                                  name="Saktësia"
                                  dataKey="saktësia"
                                  stroke="#0ea5e9"
                                  fill="#0ea5e9"
                                  fillOpacity={0.2}
                                />
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white p-3 rounded-xl text-[11px] shadow-xl border border-slate-700/50 max-w-[180px] text-left">
                                          <p className="font-bold text-sky-400">{data.subject}</p>
                                          <p className="font-semibold text-slate-200 mt-1">Saktësia: {data.saktësia}%</p>
                                          <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">
                                            Zgjidhur: {data.total} pyetje ({data.correct} të sakta)
                                          </p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>

                          {!hasAnyActivity && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/20 border border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-center text-[11px] font-semibold leading-relaxed">
                              💡 <span className="font-bold text-sky-500">Këshillë:</span> Saktësia do të shfaqet në kohë reale pasi të keni zgjidhur pyetje në secilën disiplinë mjekësore.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* CARD: STUDY FORECAST GRAPH ("Studimet e radhës") */}
                {progress && (
                  <div className="bg-white dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans block mb-1">
                        Parashikimi i Ngarkesës
                      </span>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                        Studimet e Radhës (7 ditët e ardhshme)
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-normal">
                        Parashikimi i sasisë së pyetjeve të rishikimit për ditët në vijim sipas algoritmit SM-2.
                      </p>
                    </div>

                    {(() => {
                      const points = getPredictiveStudyLoad(questions, progress.srCards);
                      const totalPredicted = points.reduce((s, p) => Math.max(s, p.count), 0);
                      
                      return (
                        <div className="space-y-4">
                          <div className="flex items-end justify-between h-32 pt-6 px-2 bg-slate-50/50 dark:bg-slate-900/10 p-4 border border-slate-150 dark:border-slate-800/85 rounded-xl">
                            {points.map((p, i) => {
                              const height = totalPredicted > 0 ? Math.min(100, Math.max(8, (p.count / totalPredicted) * 100)) : 8;
                              return (
                                <div key={i} className="flex flex-col items-center flex-1 gap-1.5 group relative">
                                  <div className="relative w-5 bg-slate-100 dark:bg-slate-800 rounded-full h-20 flex flex-col justify-end overflow-hidden">
                                    <div
                                      className="w-full bg-[#0ea5e9] rounded-full hover:opacity-90 transition-all cursor-pointer"
                                      style={{ height: `${height}%` }}
                                    />
                                  </div>
                                  
                                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-lg border border-slate-700/30 z-10 pointer-events-none">
                                    {p.count} pyetje
                                  </div>

                                  <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 font-sans">
                                    {p.dateStr}
                                  </span>
                                  <span className="text-[8px] font-semibold text-slate-400 font-sans uppercase tracking-tight truncate max-w-[45px]">
                                    {p.dayName.substring(2)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="bg-sky-50/50 dark:bg-sky-950/20 rounded-xl p-3 border border-sky-100 dark:border-sky-950/40 text-[10px] leading-relaxed text-slate-600 dark:text-slate-400 font-semibold text-center">
                            💡 <span className="font-bold text-sky-600 dark:text-sky-400">Këshillë:</span> Në ditën me ngarkesën më të lartë ({totalPredicted} pyetje), planifikoni paraprakisht të paktën 15-20 minuta studim për të parandaluar mbingarkesën!
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB CONTENT: CATEGORIES */}
            {statsSubTab === 'categories' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Category level and statistics breakdown with Expert Progress */}
                <div className="bg-white dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans">Nivelet sipas Kategorive</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Përparimi drejt statusit <b>Ekspert 🏆</b> bazohet në saktësinë (syno 85%+) dhe mbulimin e pyetjeve.</p>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {categories.map((c) => {
                      const stats = progress.catStats[c.id] || { total: 0, correct: 0 };
                      const acc = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                      const catTotalQuestions = questions.filter(q => q.catId === c.id).length || 30;
                      const targetQuestions = Math.min(catTotalQuestions, 50);

                      // Calculate Expert Progress score (0 - 100%)
                      const volumeRatio = Math.min(1, stats.total / Math.max(1, targetQuestions));
                      const accuracyRatio = Math.min(1, acc / 85);
                      
                      let expertProgress = 0;
                      if (stats.total > 0) {
                        expertProgress = Math.min(100, Math.round((volumeRatio * 0.5 + accuracyRatio * 0.5) * 100));
                      }

                      // Level badge calculation based on Expert Progress
                      let badge = 'Fillestar 🩺';
                      let badgeBg = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                      let barGradient = 'from-slate-400 to-slate-500';

                      if (expertProgress >= 90) {
                        badge = 'Ekspert 🏆';
                        badgeBg = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
                        barGradient = 'from-emerald-500 to-teal-400';
                      } else if (expertProgress >= 60) {
                        badge = 'I avancuar 🧪';
                        badgeBg = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300';
                        barGradient = 'from-sky-500 to-indigo-500';
                      } else if (expertProgress >= 25) {
                        badge = 'Mesatar 🩹';
                        badgeBg = 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300';
                        barGradient = 'from-amber-400 to-sky-500';
                      }

                      return (
                        <div key={c.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight block">
                                {c.name}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                <span>{stats.total}/{targetQuestions} pyetje</span>
                                <span>•</span>
                                <span className={acc >= 85 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>Saktësi {acc}% (Objektiv 85%)</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${badgeBg} font-mono block`}>
                                {badge}
                              </span>
                              <span className="text-[10px] font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">
                                {expertProgress}% drejt Ekspertit
                              </span>
                            </div>
                          </div>

                          {/* Progress bar layout */}
                          <div className="space-y-1">
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-800">
                              <div
                                className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${barGradient}`}
                                style={{ width: `${expertProgress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB CONTENT: ERRORS */}
            {statsSubTab === 'errors' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Error Journal (Ditari i Gabimeve) */}
                {progress && (
                  <ErrorJournal
                    questions={questions}
                    categories={categories}
                    topics={topics}
                    progress={progress}
                    onToggleBookmark={handleToggleBookmark}
                    onStartQuizWithQuestions={(filteredQs) => {
                      setActiveSession({
                        mode: 'wrong',
                        questions: filteredQs,
                        currentIndex: 0,
                        selectedOption: null,
                        answered: false,
                        answers: [],
                        customTitle: 'Ditari i Gabimeve',
                      });
                      setExamRemainingSeconds(null);
                    }}
                  />
                )}
              </div>
            )}

          </section>
        )}

        {/* TAB: KUIZ MODES */}
        {activeTab === 'modes' && (
          <section className="space-y-5 animate-in fade-in duration-200" id="modesView">
            <div className="text-left pb-1.5 border-b border-slate-200/60 dark:border-slate-800/80">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider text-[#1cb0f6] bg-[#1cb0f6]/10 dark:bg-[#1cb0f6]/20 uppercase mb-2">
                Përgatitja
              </span>
              <h2 className="text-2xl font-black tracking-tight text-sky-600 dark:text-sky-400 pl-1 leading-none">Mënyrat e Studimit</h2>
              <p className="text-sm text-slate-700 dark:text-slate-250 pl-1 font-semibold mt-2">Zgjidhni njërën nga 3 mënyrat kryesore për t'u përgatitur sot.</p>
            </div>

            {/* 3 Main Modes */}
            <div className="grid grid-cols-1 gap-4">
              {/* 1. Kuiz i Personalizuar */}
              <button
                type="button"
                onClick={() => setIsCustomQuizOpen(true)}
                className="bg-gradient-to-r from-sky-500/5 to-sky-600/5 dark:from-sky-500/10 dark:to-sky-700/5 border-2 border-sky-500/30 dark:border-sky-500/20 border-b-4 p-4 rounded-3xl text-left hover:bg-sky-500/10 dark:hover:bg-sky-500/15 transition-all active:translate-y-[2px] active:border-b-0 flex items-center gap-4 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full -mr-6 -mt-6" />
                <span className="w-12 h-12 bg-gradient-to-br from-sky-400 to-sky-500 rounded-2xl flex items-center justify-center text-2xl border-b-2 border-sky-600 shrink-0">🎯</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-slate-950 dark:text-white">Kuiz i Personalizuar</h3>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold mt-1 leading-relaxed">Zgjidhni kategorinë ose temën specifike dhe zhvilloni të gjitha pyetjet përkatëse.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
              </button>

              {/* 2. Stërvitje Adaptive */}
              <button
                type="button"
                onClick={() => startAdaptiveSession(15)}
                className="bg-gradient-to-r from-sky-500/5 to-sky-600/5 dark:from-sky-500/10 dark:to-sky-700/5 border-2 border-sky-500/30 dark:border-sky-500/20 border-b-4 p-4 rounded-3xl text-left hover:bg-sky-500/10 dark:hover:bg-sky-500/15 transition-all active:translate-y-[2px] active:border-b-0 flex items-center gap-4 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full -mr-6 -mt-6" />
                <span className="w-12 h-12 bg-gradient-to-br from-sky-400 to-sky-500 rounded-2xl flex items-center justify-center text-2xl border-b-2 border-sky-600 shrink-0">🧠</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-slate-950 dark:text-white flex items-center gap-1.5">
                    Stërvitje Adaptive
                    <span className="bg-sky-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full tracking-wide uppercase font-mono">
                      rekomanduar
                    </span>
                  </h3>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold mt-1 leading-relaxed">Algoritëm inteligjent bazuar në pikat tuaja të dobëta dhe Spaced Repetition.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
              </button>

              {/* 3. Simulim Provimi */}
              <button
                type="button"
                onClick={startTestMode}
                className="bg-gradient-to-r from-sky-500/5 to-sky-600/5 dark:from-sky-500/10 dark:to-sky-700/5 border-2 border-sky-500/30 dark:border-sky-500/20 border-b-4 p-4 rounded-3xl text-left hover:bg-sky-500/10 dark:hover:bg-sky-500/15 transition-all active:translate-y-[2px] active:border-b-0 flex items-center gap-4 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full -mr-6 -mt-6" />
                <span className="w-12 h-12 bg-gradient-to-br from-sky-400 to-sky-500 rounded-2xl flex items-center justify-center text-2xl border-b-2 border-sky-600 shrink-0">📝</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-slate-950 dark:text-white">Simulim Provimi</h3>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold mt-1 leading-relaxed">50 pyetje · 60 minuta · Kohë reale pa ndërprerje (Provimi Kombëtar).</p>
                </div>
                <ArrowRight className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
              </button>
            </div>

            {/* Other Specialized Learning Utilities */}
            <div className="pt-4 space-y-3 border-t border-slate-200/50 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-600 dark:text-slate-200 uppercase tracking-wider pl-1 font-mono text-left">Mente & Mjete të Tjera Ndihmëse</h3>
              
              <div className="grid grid-cols-3 gap-2">
                 {/* Spaced Repetition */}
                 {(() => {
                   const srDue = getSRDueQuestions(questions, progress.srCards).length;
                   const totalSR = Object.keys(progress.srCards).length;
                   const hasCards = totalSR > 0;
                   
                   let cardStyle = '';
                   let badgeStyle = '';
                   let countColor = '';
                   let emoji = '🔄';

                   if (srDue > 0) {
                     cardStyle = 'bg-sky-50 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-950/30 cursor-pointer';
                     badgeStyle = 'text-sky-950 dark:text-sky-100';
                     countColor = 'text-sky-800 dark:text-sky-200';
                   } else if (hasCards) {
                     cardStyle = 'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-300 dark:border-emerald-850 hover:bg-emerald-100 dark:hover:bg-emerald-950/20 cursor-pointer';
                     badgeStyle = 'text-emerald-950 dark:text-emerald-100';
                     countColor = 'text-emerald-700 dark:text-emerald-300';
                     emoji = '✅';
                   } else {
                     cardStyle = 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer';
                     badgeStyle = 'text-slate-700 dark:text-slate-300';
                     countColor = 'text-slate-500 dark:text-slate-400';
                   }

                   return (
                     <button
                       type="button"
                       onClick={startSpacedRepetitionMode}
                       className={`border-2 border-b-4 p-2.5 rounded-2xl text-left transition-all active:translate-y-[2px] active:border-b-0 flex flex-col items-center justify-center text-center gap-1 shadow-sm ${cardStyle}`}
                     >
                       <span className="text-xl">{emoji}</span>
                       <div className="min-w-0">
                         <h4 className={`text-[11px] font-black leading-tight ${badgeStyle}`}>
                           SM-2 Recall
                         </h4>
                         <p className={`text-[10px] font-extrabold leading-tight mt-1 ${countColor}`}>
                           {srDue > 0 ? `${srDue} për sot` : hasCards ? 'Gati' : 'Mëso si'}
                         </p>
                       </div>
                     </button>
                   );
                 })()}

                {/* Wrong mistakes */}
                {(() => {
                  const wrongCount = progress.wrongIds.length;
                  const isEnabled = wrongCount > 0;
                  return (
                    <button
                      type="button"
                      disabled={!isEnabled}
                      onClick={startWrongCorrectionMode}
                      className={`border-2 border-b-4 p-2.5 rounded-2xl text-left transition-all active:translate-y-[2px] active:border-b-0 flex flex-col items-center text-center gap-1 shadow-sm ${
                        isEnabled
                          ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-850 hover:bg-rose-100 dark:hover:bg-rose-950/30 cursor-pointer'
                          : 'bg-slate-100/90 dark:bg-slate-850/60 border-slate-300 dark:border-slate-700 opacity-80 cursor-not-allowed'
                      }`}
                    >
                      <span className={`text-xl ${!isEnabled && 'grayscale opacity-70'}`}>🩹</span>
                      <div className="min-w-0">
                        <h4 className={`text-[11px] font-black leading-tight ${isEnabled ? 'text-rose-950 dark:text-rose-100' : 'text-slate-700 dark:text-slate-300'}`}>
                          Gabimet
                        </h4>
                        <p className={`text-[10px] font-extrabold leading-tight mt-1 ${isEnabled ? 'text-rose-800 dark:text-rose-250' : 'text-slate-600 dark:text-slate-450'}`}>
                          {wrongCount} rishikim
                        </p>
                      </div>
                    </button>
                  );
                })()}

                {/* Bookmarks */}
                {(() => {
                  const bookmarkCount = progress.bookmarkIds.length;
                  const isEnabled = bookmarkCount > 0;
                  return (
                    <button
                      type="button"
                      disabled={!isEnabled}
                      onClick={startBookmarksMode}
                      className={`border-2 border-b-4 p-2.5 rounded-2xl text-left transition-all active:translate-y-[2px] active:border-b-0 flex flex-col items-center text-center gap-1 shadow-sm ${
                        isEnabled
                          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/30 cursor-pointer'
                          : 'bg-slate-100/90 dark:bg-slate-850/60 border-slate-300 dark:border-slate-700 opacity-80 cursor-not-allowed'
                      }`}
                    >
                      <span className={`text-xl ${!isEnabled && 'grayscale opacity-70'}`}>🔖</span>
                      <div className="min-w-0">
                        <h4 className={`text-[11px] font-black leading-tight ${isEnabled ? 'text-amber-950 dark:text-amber-100' : 'text-slate-700 dark:text-slate-300'}`}>
                          Të Shënuara
                        </h4>
                        <p className={`text-[10px] font-extrabold leading-tight mt-1 ${isEnabled ? 'text-amber-800 dark:text-amber-250' : 'text-slate-600 dark:text-slate-450'}`}>
                          {bookmarkCount} pyetje
                        </p>
                      </div>
                    </button>
                  );
                })()}
              </div>
            </div>
          </section>
        )}


        {/* TAB: BOOKMARKS */}
        {activeTab === 'bookmarks' && progress && (
          <BookmarksTab
            questions={questions}
            categories={categories}
            topics={topics}
            progress={progress}
            onToggleBookmark={handleToggleBookmark}
            onStartQuizWithQuestions={(filteredQs) => {
              setActiveSession({
                mode: 'bookmarks',
                questions: getRandomSubset(filteredQs, 20),
                currentIndex: 0,
                selectedOption: null,
                answered: false,
                answers: [],
                customTitle: 'Të Shënuara',
              });
              setExamRemainingSeconds(null);
            }}
          />
        )}

        {/* TAB: ADMIN (if logged in) */}
        {activeTab === 'admin' && isAdminLoggedIn && (
          <div className="max-w-4xl mx-auto py-4">
            <AdminPanel
              progress={progress}
              onLogout={() => {
                setIsAdminLoggedIn(false);
                setActiveTab('home');
                showToast('Mbyllët panelin admin.', 'info');
              }}
              onUpdateState={() => {
                // refresh database state in React state context
                setCategories(getCategories());
                setTopics(getTopics());
                setQuestions(getQuestions());
                setProgress(getProgress());
              }}
              onStartQuizWithQuestions={(importedQs, title, mode) => {
                setActiveSession({
                  mode: mode || 'test',
                  questions: importedQs,
                  currentIndex: 0,
                  selectedOption: null,
                  answered: false,
                  answers: [],
                  customTitle: title,
                });
                if (mode === 'test') {
                  setExamRemainingSeconds(3600); // 60 minutes
                } else {
                  setExamRemainingSeconds(null);
                }
              }}
              showToast={showToast}
            />
          </div>
        )}
      </div>

      {/* MODAL: TRAIN COUNT PICKER */}
      <TrainPickerModal
        isOpen={isTrainPickerOpen}
        categories={categories}
        topics={topics}
        getQuestionCountForScope={getQuestionCountForScope}
        totalQuestionsCount={questions.length}
        initialCount={15}
        onClose={() => setIsTrainPickerOpen(false)}
        onStart={startTrainMode}
      />

      {/* MODAL: CUSTOM CONFIGURATION */}
      <CustomQuizModal
        isOpen={isCustomQuizOpen}
        categories={categories}
        topics={topics}
        totalQuestionsCount={questions.length}
        getQuestionCountForScope={getQuestionCountForScope}
        onClose={() => setIsCustomQuizOpen(false)}
        onStart={startCustomQuiz}
      />

      {/* MODAL: EXIT CONFIRMATION */}
      <Modal
        isOpen={isExitConfirmOpen}
        title="Ndërpre kuizin?"
        body="Çfarë dëshironi të bëni me këtë kuiz? Mund të vazhdoni studimin, të pezulloni sesionin për më vonë, ose të dilni duke ruajtur progresin e deritanishëm."
        onClose={() => setIsExitConfirmOpen(false)}
        buttons={[
          {
            label: 'Vazhdo kuizin',
            variant: 'cancel',
            onClick: () => setIsExitConfirmOpen(false),
          },
          {
            label: 'Pezullo kuizin',
            onClick: () => {
              setIsExitConfirmOpen(false);
              if (activeSession) {
                setActiveSession({
                  ...activeSession,
                  isPaused: true,
                });
              }
              setActiveTab('home');
              showToast('Kuizi u pezullua. Mund ta vazhdoni në çdo kohë nga Kreu.', 'success');
            },
          },
          {
            label: 'Dil dhe ruaj progresin',
            variant: 'primary',
            onClick: handleExitAndSaveProgress,
          },
        ]}
      />

      {/* MODAL: SECURE ADMIN ACCESS */}
      {isAdminLoginOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-[9980] animate-in fade-in duration-200"
          onClick={() => setIsAdminLoginOpen(false)}
        >
          <div
            id="adminLoginModal"
            className="bg-white dark:bg-slate-950 border-2 border-b-8 border-slate-300 dark:border-slate-850 rounded-3xl p-6 w-full max-w-sm shadow-2xl transition-all animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border-2 border-b-4 border-amber-200 dark:border-amber-800 flex items-center justify-center text-3xl mx-auto mb-3 shadow-sm">
                🔒
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Hyrje Administrative</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1.5 leading-relaxed">Vendosni fjalëkalimin për të hyrë në cilësimet e bankës së pyetjeve.</p>
            </div>

            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
                  Fjalëkalimi Admin
                </label>
                <input
                  type="password"
                  required
                  placeholder="Shkruaj fjalëkalimin..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none font-bold focus:border-[#1cb0f6] focus:ring-2 focus:ring-[#1cb0f6]/20 transition-all"
                />
              </div>

              {adminLockoutRemaining > 0 && (
                <div className="bg-rose-500/10 border-2 border-rose-300 dark:border-rose-900/50 p-3 rounded-xl text-center text-xs font-bold text-rose-600 dark:text-rose-400">
                  🔒 Tentativat u bllokuan. Provoni pas {adminLockoutRemaining} sekondash.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdminLoginOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-b-4 border-slate-300 dark:border-slate-800 font-black text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:translate-y-[2px] active:border-b-2 cursor-pointer"
                >
                  Anulo
                </button>
                <button
                  type="submit"
                  disabled={adminLockoutRemaining > 0}
                  className="flex-[2] py-2.5 rounded-xl bg-[#58cc02] hover:bg-[#46a302] disabled:bg-slate-300 disabled:dark:bg-slate-800 disabled:text-slate-500 text-white font-black text-xs border-b-4 border-[#46a302] disabled:border-b-0 active:translate-y-[2px] active:border-b-0 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Identifikohu ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RAPORTO GABIM */}
      {isReportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-[9980] animate-in fade-in duration-200"
          onClick={() => setIsReportModalOpen(false)}
        >
          <div
            id="reportModal"
            className="bg-white dark:bg-slate-900 border-2 border-b-8 border-slate-300 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl transition-all animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 rounded-2xl border-2 border-b-4 border-rose-200 dark:border-rose-800 flex items-center justify-center text-3xl mx-auto mb-3 shadow-sm">
                🚨
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Raporto Gabim në Pyetje</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1.5 leading-relaxed">
                Nëse dyshoni për saktësinë e kësaj pyetjeje, shpjegoni shkurtimisht gabimin që adminët ta korrigjojnë direkt.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
                  Arsyeja e Raportimit
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="P.sh. Përgjigja e saktë është B në vend të A... ose gabim në formuluar..."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none font-bold focus:border-[#1cb0f6] focus:ring-2 focus:ring-[#1cb0f6]/20 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-b-4 border-slate-300 dark:border-slate-800 font-black text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:translate-y-[2px] active:border-b-2 cursor-pointer"
                >
                  Anulo
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReport}
                  className="flex-[2] py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs border-b-4 border-rose-700 active:translate-y-[2px] active:border-b-0 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Dërgo Raportin ✓
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Quick Start Tour Component */}
      <QuickStartTour
        isOpen={isQuickStartOpen}
        onClose={() => setIsQuickStartOpen(false)}
        onStartPractice={startTrainMode}
        progress={progress}
      />

      {/* Global reusable Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
