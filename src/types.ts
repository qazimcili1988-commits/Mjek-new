export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Topic {
  id: string;
  catId: string;
  name: string;
}

export interface Question {
  id: string;
  catId: string;
  topicId: string;
  text: string;
  options: string[]; // exactly 4 options
  answer: number; // 0, 1, 2, or 3
  exp: string;
  imageUrl?: string;
  svgMarkup?: string;
  pageNumber?: number;
  figureCrop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SRCard {
  interval: number; // days
  ef: number; // easiness factor (default 2.5)
  reps: number;
  nextReview: number; // timestamp ms
  lapses?: number;
}

export interface HistoryEntry {
  date: string; // e.g. "Sun Jun 28 2026"
  done: number;
  correct: number;
}

export interface CatStat {
  done?: number;
  total: number;
  correct: number;
}

export interface UserProgress {
  totalDone: number;
  totalCorrect: number;
  streak: number;
  wrongIds: string[];
  bookmarkIds: string[];
  wrongCounts?: Record<string, number>;
  catStats: Record<string, CatStat>;
  srCards: Record<string, SRCard>;
  badges: string[];
  history: HistoryEntry[];
  streakFreezes: number;
  lastUnlockDate: string;
  lastAnswerDate: string;
  unlockedUpTo: number;
}

export type QuizMode = 'test' | 'train' | 'wrong' | 'sr' | 'bookmarks' | 'custom' | 'adaptive';

export interface AnswerLog {
  question: Question;
  selected: number;
  correct: number; // 1 or 0
}

export interface ActiveSession {
  mode: QuizMode;
  questions: Question[];
  currentIndex: number;
  selectedOption: number | null;
  answered: boolean;
  answers: AnswerLog[];
  startTime?: number;
  customTitle?: string;
  showExplanation?: boolean;
  isFinished?: boolean;
  pendingSRCard?: {
    questionId?: string;
    prevCard: SRCard;
    qId?: string;
  };
  isPaused?: boolean;
}

export interface Milestone {
  id: string;
  label: string;
  icon: string;
  description: string;
  check: (prog: UserProgress, sessionAnswers?: AnswerLog[]) => boolean;
}

export type ThemeName = 'teal' | 'green' | 'navy' | 'osmosis';
export type ActiveTab = 'home' | 'stats' | 'modes' | 'bookmarks' | 'admin';
export interface QuestionReport {
  id: string;
  questionId: string;
  questionText: string;
  categoryName: string;
  topicName: string;
  reason: string;
  timestamp: number;
  status: 'pending' | 'resolved';
}

export type AdminSubPanel = 'dashboard' | 'categories' | 'topics' | 'questions' | 'tree' | 'users' | 'settings' | 'pdf-import' | 'reports' | 'simulation';
