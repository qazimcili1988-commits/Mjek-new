import { create } from 'zustand';
import { Category, Topic, Question, UserProgress, ActiveSession, ActiveTab } from '../types';

interface AppState {
  activeTab: ActiveTab;
  darkMode: boolean;
  progress: UserProgress | null;
  categories: Category[];
  topics: Topic[];
  questions: Question[];
  activeSession: ActiveSession | null;
  examRemainingSeconds: number | null;
  isTrainPickerOpen: boolean;
  isCustomQuizOpen: boolean;
  isQuickStartOpen: boolean;
  isExitConfirmOpen: boolean;
  showConfetti: boolean;
  toast: { message: string; type: 'success' | 'warn' | 'error' | 'info' } | null;
  reportingQuestionId: string | null;
  reportReason: string;
  isReportModalOpen: boolean;
  isAdminLoggedIn: boolean;
  isAdminLoginOpen: boolean;
  adminPassword: string;
  adminFailedAttempts: number;
  adminLockoutRemaining: number;
  logoClickCount: number;
  lastLogoClickTime: number;
  isDbReady: boolean;

  // Actions
  setActiveTab: (tab: ActiveTab) => void;
  setDarkMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  setProgress: (val: UserProgress | null | ((prev: UserProgress | null) => UserProgress | null)) => void;
  setCategories: (val: Category[] | ((prev: Category[]) => Category[])) => void;
  setTopics: (val: Topic[] | ((prev: Topic[]) => Topic[])) => void;
  setQuestions: (val: Question[] | ((prev: Question[]) => Question[])) => void;
  setActiveSession: (val: ActiveSession | null | ((prev: ActiveSession | null) => ActiveSession | null)) => void;
  setExamRemainingSeconds: (val: number | null | ((prev: number | null) => number | null)) => void;
  setIsTrainPickerOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  setIsCustomQuizOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  setIsQuickStartOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  setIsExitConfirmOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  setShowConfetti: (val: boolean | ((prev: boolean) => boolean)) => void;
  setToast: (val: { message: string; type: 'success' | 'warn' | 'error' | 'info' } | null | ((prev: { message: string; type: 'success' | 'warn' | 'error' | 'info' } | null) => { message: string; type: 'success' | 'warn' | 'error' | 'info' } | null)) => void;
  setReportingQuestionId: (val: string | null | ((prev: string | null) => string | null)) => void;
  setReportReason: (val: string | ((prev: string) => string)) => void;
  setIsReportModalOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  setIsAdminLoggedIn: (val: boolean | ((prev: boolean) => boolean)) => void;
  setIsAdminLoginOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  setAdminPassword: (val: string | ((prev: string) => string)) => void;
  setAdminFailedAttempts: (val: number | ((prev: number) => number)) => void;
  setAdminLockoutRemaining: (val: number | ((prev: number) => number)) => void;
  setLogoClickCount: (val: number | ((prev: number) => number)) => void;
  setLastLogoClickTime: (val: number | ((prev: number) => number)) => void;
  setIsDbReady: (val: boolean | ((prev: boolean) => boolean)) => void;
}

export const useAppStore = create<AppState>((set) => {
  // Helper to handle functional state updates
  const updateState = <K extends keyof AppState>(key: K, val: any) => {
    set((state) => {
      const current = state[key];
      const nextVal = typeof val === 'function' ? val(current) : val;
      return { [key]: nextVal } as unknown as Partial<AppState>;
    });
  };

  return {
    activeTab: 'home',
    darkMode: false,
    progress: null,
    categories: [],
    topics: [],
    questions: [],
    activeSession: null,
    examRemainingSeconds: null,
    isTrainPickerOpen: false,
    isCustomQuizOpen: false,
    isQuickStartOpen: false,
    isExitConfirmOpen: false,
    showConfetti: false,
    toast: null,
    reportingQuestionId: null,
    reportReason: '',
    isReportModalOpen: false,
    isAdminLoggedIn: false,
    isAdminLoginOpen: false,
    adminPassword: '',
    adminFailedAttempts: 0,
    adminLockoutRemaining: 0,
    logoClickCount: 0,
    lastLogoClickTime: 0,
    isDbReady: false,

    // Actions
    setActiveTab: (tab) => set({ activeTab: tab }),
    setDarkMode: (val) => updateState('darkMode', val),
    setProgress: (val) => updateState('progress', val),
    setCategories: (val) => updateState('categories', val),
    setTopics: (val) => updateState('topics', val),
    setQuestions: (val) => updateState('questions', val),
    setActiveSession: (val) => updateState('activeSession', val),
    setExamRemainingSeconds: (val) => updateState('examRemainingSeconds', val),
    setIsTrainPickerOpen: (val) => updateState('isTrainPickerOpen', val),
    setIsCustomQuizOpen: (val) => updateState('isCustomQuizOpen', val),
    setIsQuickStartOpen: (val) => updateState('isQuickStartOpen', val),
    setIsExitConfirmOpen: (val) => updateState('isExitConfirmOpen', val),
    setShowConfetti: (val) => updateState('showConfetti', val),
    setToast: (val) => updateState('toast', val),
    setReportingQuestionId: (val) => updateState('reportingQuestionId', val),
    setReportReason: (val) => updateState('reportReason', val),
    setIsReportModalOpen: (val) => updateState('isReportModalOpen', val),
    setIsAdminLoggedIn: (val) => updateState('isAdminLoggedIn', val),
    setIsAdminLoginOpen: (val) => updateState('isAdminLoginOpen', val),
    setAdminPassword: (val) => updateState('adminPassword', val),
    setAdminFailedAttempts: (val) => updateState('adminFailedAttempts', val),
    setAdminLockoutRemaining: (val) => updateState('adminLockoutRemaining', val),
    setLogoClickCount: (val) => updateState('logoClickCount', val),
    setLastLogoClickTime: (val) => updateState('lastLogoClickTime', val),
    setIsDbReady: (val) => updateState('isDbReady', val),
  };
});
