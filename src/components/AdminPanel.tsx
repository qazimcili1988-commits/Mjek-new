import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Category, Topic, Question, UserProgress, ThemeName, QuizMode, AdminSubPanel, QuestionReport } from '../types';
import {
  LayoutDashboard, FolderHeart, FolderOpen, HelpCircle, GitFork, Users, Settings,
  LogOut, Plus, Trash2, ChevronRight, ChevronDown, Check, ShieldAlert, FileSpreadsheet,
  FileText, FileUp, Sparkles, UploadCloud, RotateCcw, AlertTriangle, Download, DownloadCloud,
  Activity, Image, Edit2, Crop, BookOpen, Search
} from 'lucide-react';
import {
  getCategories, getTopics, getQuestions, getProgress, saveCategories,
  saveTopics, saveQuestions, saveProgress, getDailyLimit, setDailyLimit,
  isPasswordDefault, setAdminPassword, verifyAdminPassword, exportBackupJSON,
  sm2Update, getReportedQuestions, saveReportedQuestions, compressImageToLightweightJPEG
} from '../utils/storage';
import { smartParseQuestions } from '../utils/parser';
import { ImageCropper } from './ImageCropper';

export interface AdminPanelProps {
  progress: UserProgress;
  onLogout: () => void;
  onUpdateState: () => void;
  showToast: (msg: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
  onStartQuizWithQuestions?: (qs: Question[], title: string, mode?: 'train' | 'test') => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  progress,
  onLogout,
  onUpdateState,
  showToast,
  onStartQuizWithQuestions,
}) => {
  const [activePanel, setActivePanel] = useState<AdminSubPanel>('dashboard');

  // Database states
  const [cats, setCats] = useState<Category[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [qs, setQs] = useState<Question[]>([]);
  const [reports, setReports] = useState<QuestionReport[]>([]);
  const [editingReportedQ, setEditingReportedQ] = useState<Question | null>(null);
  const [editingQ, setEditingQ] = useState<Question | null>(null);

  // States for Image Screenshot extraction via AI
  const [newQImageUrl, setNewQImageUrl] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [isCroppingNew, setIsCroppingNew] = useState(false);
  const [isCroppingEdit, setIsCroppingEdit] = useState(false);

  // Editing individual question state copies
  const [editQText, setEditQText] = useState('');
  const [editQExp, setEditQExp] = useState('');
  const [editQOpts, setEditQOpts] = useState<string[]>(['', '', '', '']);
  const [editCorrectIdx, setEditCorrectIdx] = useState<number>(0);
  const [editQTopicId, setEditQTopicId] = useState('');
  const [editQCatId, setEditQCatId] = useState('');
  const [editQImageUrl, setEditQImageUrl] = useState('');
  const [editQSvgMarkup, setEditQSvgMarkup] = useState('');

  // Category addition
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');

  // Topic addition
  const [newTopicCatId, setNewTopicCatId] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [filterTopicCatId, setFilterTopicCatId] = useState('');

  // Inline Category / Topic additions within question form
  const [inlineCatOpen, setInlineCatOpen] = useState(false);
  const [inlineCatName, setInlineCatName] = useState('');
  const [inlineCatColor, setInlineCatColor] = useState('#8B5CF6');
  const [inlineTopicOpen, setInlineTopicOpen] = useState(false);
  const [inlineTopicName, setInlineTopicName] = useState('');

  // Question addition
  const [newQCatId, setNewQCatId] = useState('');
  const [newQTopicId, setNewQTopicId] = useState('');
  const [newQText, setNewQText] = useState('');
  const [newQExp, setNewQExp] = useState('');
  const [newQOpts, setNewQOpts] = useState<string[]>(['', '', '', '']);
  const [correctIdx, setCorrectIdx] = useState<number>(0);

  // Question bank filters & selection
  const [filterQCatId, setFilterQCatId] = useState('');
  const [filterQTopicId, setFilterQTopicId] = useState('');
  const [qPage, setQPage] = useState(0);
  const [qSelection, setQSelection] = useState<string[]>([]);
  const [expandedAdminQId, setExpandedAdminQId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [topicLimits, setTopicLimits] = useState<Record<string, number>>({});

  // Bulk Import
  const [bulkCatId, setBulkCatId] = useState('');
  const [bulkTopicId, setBulkTopicId] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkImportTab, setBulkImportTab] = useState<'txt' | 'file'>('txt');
  const [bulkPreviewData, setBulkPreviewData] = useState<any[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [fileImportStatus, setFileImportStatus] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings
  const [dailyLimit, setDailyLimitState] = useState(100);
  const [newPwd, setNewPwd] = useState('');

  // PDF Import States
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [pdfCustomPrompt, setPdfCustomPrompt] = useState('');
  const [pdfTargetCatId, setPdfTargetCatId] = useState('');
  const [pdfTargetTopicId, setPdfTargetTopicId] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [pdfGeneratedQuestions, setPdfGeneratedQuestions] = useState<{
    text: string;
    options: string[];
    answer: number;
    exp: string;
    approved: boolean;
    imageUrl?: string;
    svgMarkup?: string;
    pageNumber?: number;
    figureCrop?: { x: number; y: number; width: number; height: number };
  }[]>([]);
  const [pdfImportSuccessCount, setPdfImportSuccessCount] = useState<number | null>(null);
  const [lastSavedQuestions, setLastSavedQuestions] = useState<Question[]>([]);

  // Visual PDF Cropper States
  const [pdfPageImageUrl, setPdfPageImageUrl] = useState('');
  const [cropPdfNumPages, setCropPdfNumPages] = useState(0);
  const [cropPdfCurrentPage, setCropPdfCurrentPage] = useState(1);
  const [isRenderingPdfPage, setIsRenderingPdfPage] = useState(false);
  const [isPdfCroppingActive, setIsPdfCroppingActive] = useState(false);
  const [croppedPdfImageResult, setCroppedPdfImageResult] = useState('');
  const [pdfCroppingSource, setPdfCroppingSource] = useState<'new_question' | 'edit_question' | 'pdf_panel' | 'bulk_preview' | 'generated_preview'>('pdf_panel');
  const [bulkCropIndex, setBulkCropIndex] = useState<number | null>(null);
  const [pdfRenderScale, setPdfRenderScale] = useState(2.0);
  const [pdfPageSearchQuery, setPdfPageSearchQuery] = useState('');

  // Inline editing states for Generated and Bulk Previews
  const [editingGeneratedIdx, setEditingGeneratedIdx] = useState<number | null>(null);
  const [editingGenText, setEditingGenText] = useState('');
  const [editingGenOpts, setEditingGenOpts] = useState<string[]>(['', '', '', '']);
  const [editingGenAnswer, setEditingGenAnswer] = useState<number>(0);
  const [editingGenExp, setEditingGenExp] = useState('');

  const [editingBulkIdx, setEditingBulkIdx] = useState<number | null>(null);
  const [editingBulkText, setEditingBulkText] = useState('');
  const [editingBulkOpts, setEditingBulkOpts] = useState<string[]>(['', '', '', '']);
  const [editingBulkAnswer, setEditingBulkAnswer] = useState<number>(0);
  const [editingBulkExp, setEditingBulkExp] = useState('');

  // Manual Crop/Focus Adjustment States
  const [manualCropTarget, setManualCropTarget] = useState<{
    questionId: string;
    type: 'database' | 'generated';
    index: number;
    pageNumber?: number;
    initialCrop?: { x: number; y: number; width: number; height: number };
    baseImage: string;
  } | null>(null);
  const [isRenderingManualCropPage, setIsRenderingManualCropPage] = useState(false);

  // States for on-the-fly Category / Topic in PDF Import
  const [pdfNewCatName, setPdfNewCatName] = useState('');
  const [pdfNewTopicName, setPdfNewTopicName] = useState('');
  const [showPdfNewCat, setShowPdfNewCat] = useState(false);
  const [showPdfNewTopic, setShowPdfNewTopic] = useState(false);

  // Word Import States
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [wordBase64, setWordBase64] = useState<string>('');
  const [wordFileId, setWordFileId] = useState<string>('');
  const [isUploadingWord, setIsUploadingWord] = useState(false);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [wordDragOver, setWordDragOver] = useState(false);

  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const wordFileInputRef = useRef<HTMLInputElement>(null);

  // Single File Import States
  const [importMethod, setImportMethod] = useState<'dual' | 'single'>('dual');
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singleFileDragOver, setSingleFileDragOver] = useState(false);
  const [singleFileStatus, setSingleFileStatus] = useState('');
  const [isProcessingSingle, setIsProcessingSingle] = useState(false);
  const singleFileInputRef = useRef<HTMLInputElement>(null);

  // Concurrency Simulation States
  const [isSimulating, setIsSimulating] = useState(false);
  const [simUsersCount, setSimUsersCount] = useState(100);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [simStats, setSimStats] = useState({
    totalAnswers: 0,
    totalCorrect: 0,
    activeCount: 100,
    cpuLoad: 0.02,
    memoryUsage: 18.5,
    bandwidth: 0,
  });

  interface SimUser {
    id: number;
    name: string;
    status: string;
    score: number;
    wrong: number;
    lastActive: string;
    isCorrectStreak: number;
  }

  const [simUsers, setSimUsers] = useState<SimUser[]>([]);

  // Sync editing question states
  useEffect(() => {
    if (editingQ) {
      setEditQText(editingQ.text);
      setEditQExp(editingQ.exp || '');
      setEditQOpts([...editingQ.options]);
      setEditCorrectIdx(editingQ.answer);
      setEditQTopicId(editingQ.topicId);
      
      const topic = topics.find(t => t.id === editingQ.topicId);
      setEditQCatId(topic ? topic.catId : '');
      setEditQImageUrl(editingQ.imageUrl || '');
      setEditQSvgMarkup(editingQ.svgMarkup || '');
    } else {
      setEditQText('');
      setEditQExp('');
      setEditQOpts(['', '', '', '']);
      setEditCorrectIdx(0);
      setEditQTopicId('');
      setEditQCatId('');
      setEditQImageUrl('');
      setEditQSvgMarkup('');
    }
  }, [editingQ, topics]);

  // Paste handler for window to capture pasted screenshots!
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              const rawBase64 = event.target?.result as string;
              const base64 = await compressImageToLightweightJPEG(rawBase64, 1000, 0.82);
              if (editingQ) {
                setEditQImageUrl(base64);
                showToast('Skica e ndryshuar u ngarkua me sukses nga Clipboard! 📸', 'success');
              } else if (activePanel === 'questions' && bulkImportTab === 'txt') {
                setNewQImageUrl(base64);
                showToast('Imazhi i kopjuar (Screenshot) u ngarkua me sukses! 📸', 'success');
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [activePanel, bulkImportTab, editingQ]);

  useEffect(() => {
    if (!isSimulating) return;

    // Initialize simulation users if they don't exist
    const initialUsers: SimUser[] = Array.from({ length: 100 }).map((_, idx) => {
      const names = [
        "Dr. Arben Gashi", "Dr. Valbona Morina", "Dr. Ilir Kabashi", "Dr. Teuta Krasniqi", "Dr. Besnik Berisha",
        "Dr. Shkëndije Hoti", "Dr. Gentian Aliu", "Dr. Luljeta Gashi", "Dr. Fatime Rama", "Dr. Fisnik Shala",
        "Dr. Blerta Pacolli", "Dr. Adrian Leka", "Dr. Vjollca Kastrati", "Dr. Kujtim Halili", "Dr. Lindita Sinani",
        "Dr. Bekim Kurti", "Dr. Mimoza Shehu", "Dr. Astrit Demiri", "Dr. Saranda Bytyqi", "Dr. Genc Hoxha",
        "Dr. Donika Spahiu", "Dr. Kushtrim Dedaj", "Dr. Arta Muçiqi", "Dr. Ramadan Shabani", "Dr. Flutura Bytyçi",
        "Dr. Alban Kelmendi", "Dr. Nora Gjonaj", "Dr. Dardan Rugova", "Dr. Edona Selimi", "Dr. Valon Vula",
        "Dr. Jehona Ahmeti", "Dr. Shkumbin Bajraktari", "Dr. Sihana Haziri", "Dr. Bujar Dobra", "Dr. Mrika Nikqi",
        "Dr. Luan Jashari", "Dr. Shqipe Haradinaj", "Dr. Rrezart Syla", "Dr. Fitore Sopaj", "Dr. Agon Maliqi",
        "Dr. Vlora Limani", "Dr. Korab Zeneli", "Dr. Kaltrina Ukaj", "Dr. Yllka Rrustemi", "Dr. Armend Thaqi",
        "Dr. Gresa Kryeziu", "Dr. Erion Sefa", "Dr. Majlinda Bregu", "Dr. Taulant Xhaferi", "Dr. Dafina Zeqiri",
        "Dr. Faton Basha", "Dr. Doruntina Sejdiu", "Dr. Kreshnik Shkreli", "Dr. Merita Dauti", "Dr. Shpend Ahmeti",
        "Dr. Rozafa Shala", "Dr. Petrit Çeku", "Dr. Alketa Vejsiu", "Dr. Drilon Gjoka", "Dr. Anila Agolli",
        "Dr. Ledion Ruçi", "Dr. Senada Bushi", "Dr. Klodian Meta", "Dr. Ornela Viça", "Dr. Ervis Kovaçi",
        "Dr. Brunilda Lame", "Dr. Andi Çela", "Dr. Enkeleda Myftari", "Dr. Rezart Balla", "Dr. Silvana Hoxha",
        "Dr. Bledar Muça", "Dr. Sidorela Kadiu", "Dr. Artan Bushati", "Dr. Jonida Shehu", "Dr. Redon Halili",
        "Dr. Denisa Kola", "Dr. Ergi Karaj", "Dr. Matilda Shpata", "Dr. Denis Sulaj", "Dr. Rovena Kurti",
        "Dr. Elton Spahiu", "Dr. Kiara Tafa", "Dr. Alket Hyseni", "Dr. Samanta Dervishi", "Dr. Julian Deda",
        "Dr. Fiona Shehi", "Dr. Kristi Pano", "Dr. Elona Leka", "Dr. Saimir Kodra", "Dr. Gentiana Karaj",
        "Dr. Robert Shkurti", "Dr. Megi Doçi", "Dr. Erald Gjoni", "Dr. Albana Fusha", "Dr. Geraldo Hoxha",
        "Dr. Sidorela Toska", "Dr. Roland Çollaku", "Dr. Mirela Jano", "Dr. Enea Bejleri", "Dr. Jona Prifti"
      ];
      return {
        id: idx + 1,
        name: names[idx % names.length],
        status: "Sapo u lidh 🟢",
        score: Math.floor(Math.random() * 20) + 5,
        wrong: Math.floor(Math.random() * 5),
        lastActive: "Tani",
        isCorrectStreak: 0,
      };
    });
    setSimUsers(initialUsers);

    const interval = setInterval(() => {
      // Pick a random user to do an action
      const randomIdx = Math.floor(Math.random() * 100);
      const actionType = Math.random(); // 0 to 1

      const timeStr = new Date().toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setSimUsers(prevUsers => {
        if (prevUsers.length === 0) return prevUsers;
        const updated = [...prevUsers];
        const user = { ...updated[randomIdx] };

        let logMsg = "";
        user.lastActive = timeStr;

        // Categories & topics available
        const topicsList = ["Kardiologji", "Anestezi", "Pediatri", "Neurologji", "Kirurgji", "Gjinekologji", "Farmakologji"];
        const randomTopic = topicsList[Math.floor(Math.random() * topicsList.length)];

        if (actionType < 0.15) {
          // Started a quiz
          user.status = `Nisi një test në: ${randomTopic} 📝`;
          logMsg = `[${timeStr}] 📝 ${user.name} nisi një test të ri me 10 pyetje në temën "${randomTopic}".`;
        } else if (actionType < 0.75) {
          // Answered a question
          const isCorrect = Math.random() < 0.78; // 78% correct rate
          if (isCorrect) {
            user.score += 1;
            user.status = `Zgjodhi opsionin e saktë në ${randomTopic}! ✓`;
            logMsg = `[${timeStr}] ✓ ${user.name} u përgjigj SAKTË në një pyetje mbi "${randomTopic}". (+10 pikë)`;
            setSimStats(s => ({ ...s, totalAnswers: s.totalAnswers + 1, totalCorrect: s.totalCorrect + 1 }));
          } else {
            user.wrong += 1;
            user.status = `U përgjigj gabim në ${randomTopic} ✗`;
            logMsg = `[${timeStr}] ✗ ${user.name} u përgjigj gabim në një pyetje mbi "${randomTopic}". (Do t'i përsëritet)`;
            setSimStats(s => ({ ...s, totalAnswers: s.totalAnswers + 1 }));
          }
        } else if (actionType < 0.85) {
          // Bookmarked a question
          user.status = `Ruajti një pyetje në bookmarks ⭐`;
          logMsg = `[${timeStr}] ⭐ ${user.name} shtoi një pyetje klinike në listën e pyetjeve të ruajtura.`;
        } else if (actionType < 0.95) {
          // Studied a flashcard
          user.status = `Po rishikon kartat SM2 🔁`;
          logMsg = `[${timeStr}] 🔁 ${user.name} po rishikon kartat e studimit me Spaced Repetition (algoritmi SM2).`;
        } else {
          // Unlocked an achievement
          user.status = `Zhbllokoi një distinktiv të ri! 🏆`;
          logMsg = `[${timeStr}] 🏆 ${user.name} zhbllokoi distinktivin "Mjek Kërkimor" (100 pyetje të sakta)!`;
        }

        updated[randomIdx] = user;

        // Update logs (limit to 25 items)
        setSimLogs(logs => [logMsg, ...logs].slice(0, 25));

        return updated;
      });

      // Fluctuate global statistics slightly
      setSimStats(s => {
        const bandwidthAdd = Math.floor(Math.random() * 5) + 1; // 1-5 KB
        const activeFluctuation = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const nextActive = Math.max(92, Math.min(108, s.activeCount + activeFluctuation));
        
        // Server CPU remains incredibly low (< 0.05%) since it's fully client-side cached static files
        const nextCpu = +(0.01 + Math.random() * 0.03).toFixed(3);
        // Memory usage fluctuates in 18.2 to 19.8 MB range
        const nextMem = +(18.2 + Math.random() * 1.5).toFixed(1);

        return {
          ...s,
          activeCount: nextActive,
          bandwidth: s.bandwidth + bandwidthAdd,
          cpuLoad: nextCpu,
          memoryUsage: nextMem,
        };
      });

    }, 500);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Custom Confirmation Modal State
  interface ConfirmModalState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    promptExpected?: string;
    promptPlaceholder?: string;
    promptValue?: string;
  }

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const triggerConfirm = (options: Omit<ConfirmModalState, 'isOpen' | 'promptValue'>) => {
    setConfirmModal({
      ...options,
      isOpen: true,
      promptValue: '',
    });
  };

  // Tree interactive nodes
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});

  const handleWordFileChange = (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.docx')) {
      showToast('Ju lutem ngarkoni vetëm skedarë të formatit Word (.docx).', 'warn');
      return;
    }
    setWordFile(file);
    setWordFileId('word_local_' + Date.now());
    setIsUploadingWord(true);
    setGenerationStatus('Duke lexuar skedarin Word lokalisht...');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        setWordBase64(base64Data);

        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
        const buf = await file.arrayBuffer();
        const res = await (window as any).mammoth.extractRawText({ arrayBuffer: buf });
        setIsUploadingWord(false);

        if (!res.value) {
          throw new Error('Dokumenti Word është i zbrazët ose dështoi nxjerrja e tekstit.');
        }

        setGenerationStatus(`Skedari Word u lexua me sukses offline! (${res.value.length} karaktere të gjetura). Gati për gjenerim.`);
        showToast('Skedari i përgjigjeve Word u lexua me sukses offline!', 'success');
      } catch (err: any) {
        console.error(err);
        setIsUploadingWord(false);
        setWordFile(null);
        setWordBase64('');
        setWordFileId('');
        showToast(err?.message || 'Gabim gjatë leximit lokal të skedarit Word.', 'error');
        setGenerationStatus('Dështoi leximi i skedarit Word.');
      }
    };
    reader.onerror = () => {
      setIsUploadingWord(false);
      showToast('Gabim gjatë leximit lokal të skedarit Word.', 'error');
      setGenerationStatus('');
    };
    reader.readAsDataURL(file);
  };

  const handlePdfFileChange = (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      showToast('Ju lutem ngarkoni vetëm skedarë të formatit PDF.', 'warn');
      return;
    }
    setPdfFile(file);
    setPdfImportSuccessCount(null);
    setPdfGeneratedQuestions([]);

    setGenerationStatus('Duke lexuar skedarin...');
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setPdfBase64(base64Data);
      setGenerationStatus('Skedari u lexua me sukses! Gati për gjenerim.');
    };
    reader.onerror = () => {
      showToast('Gabim gjatë leximit të skedarit.', 'error');
      setGenerationStatus('');
    };
    reader.readAsDataURL(file);
  };

  const getPdfjsLib = async (): Promise<any> => {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    for (let i = 0; i < 50; i++) {
      const lib = (window as any).pdfjsLib || (window as any)['pdfjs-dist/build/pdf'];
      if (lib) return lib;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Skripti PDF.js u ngarkua por objekti pdfjsLib nuk u gjet.");
  };

  const renderPdfPage = async (file: File, pageNum: number, customScale?: number) => {
    if (!file) return;
    setIsRenderingPdfPage(true);
    const scaleToUse = customScale !== undefined ? customScale : pdfRenderScale;
    try {
      const pdfjsLib = await getPdfjsLib();
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const fileReader = new FileReader();
      fileReader.onload = async function() {
        try {
          const typedarray = new Uint8Array(this.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
          setCropPdfNumPages(pdf.numPages);
          
          const targetPageNum = Math.max(1, Math.min(pageNum, pdf.numPages));
          setCropPdfCurrentPage(targetPageNum);
          
          const page = await pdf.getPage(targetPageNum);
          
          const viewport = page.getViewport({ scale: scaleToUse });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
              canvasContext: context,
              viewport: viewport
            };
            await page.render(renderContext).promise;
            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            setPdfPageImageUrl(base64);
          }
        } catch (err: any) {
          console.error(err);
          showToast('Gabim gjatë vizatimit të faqes së PDF: ' + err.message, 'error');
        } finally {
          setIsRenderingPdfPage(false);
        }
      };
      fileReader.readAsArrayBuffer(file);
    } catch (err: any) {
      console.error(err);
      showToast('Dështoi ngarkimi i PDF.js: ' + err.message, 'error');
      setIsRenderingPdfPage(false);
    }
  };

  const startPdfCropper = (source: 'new_question' | 'edit_question' | 'pdf_panel', fileToUse?: File | null) => {
    const file = fileToUse || pdfFile;
    setPdfCroppingSource(source);
    setIsPdfCroppingActive(true);
    if (file) {
      renderPdfPage(file, 1);
    } else {
      setPdfPageImageUrl('');
      setCropPdfNumPages(0);
      setCropPdfCurrentPage(1);
    }
  };

  const handleOpenManualCrop = async (
    q: Question | any,
    index: number,
    type: 'database' | 'generated'
  ) => {
    // If we have a pageNumber and a pdfFile, we should render the full PDF page!
    if (q.pageNumber && pdfFile) {
      setIsRenderingManualCropPage(true);
      try {
        const pdfjsLib = await getPdfjsLib();
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const fileReader = new FileReader();
        fileReader.onload = async function() {
          try {
            const typedarray = new Uint8Array(this.result as ArrayBuffer);
            const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
            
            const targetPageNum = Math.max(1, Math.min(q.pageNumber || 1, pdf.numPages));
            const page = await pdf.getPage(targetPageNum);
            
            const scale = 2.0;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            if (context) {
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              const renderContext = {
                canvasContext: context,
                viewport: viewport
              };
              await page.render(renderContext).promise;
              const base64 = canvas.toDataURL('image/jpeg', 0.8);
              
              setManualCropTarget({
                questionId: q.id || '',
                type,
                index,
                pageNumber: q.pageNumber,
                initialCrop: q.figureCrop || { x: 15, y: 15, width: 70, height: 70 },
                baseImage: base64
              });
            } else {
              throw new Error('Nuk u mundësua vizatimi i faqes.');
            }
          } catch (err: any) {
            console.error(err);
            showToast('Dështoi vizatimi i faqes së PDF: ' + err.message, 'error');
            // Fallback to current image
            setManualCropTarget({
              questionId: q.id || '',
              type,
              index,
              initialCrop: { x: 15, y: 15, width: 70, height: 70 },
              baseImage: q.imageUrl || ''
            });
          } finally {
            setIsRenderingManualCropPage(false);
          }
        };
        fileReader.readAsArrayBuffer(pdfFile);
      } catch (err: any) {
        console.error(err);
        showToast('Gabim gjatë hapjes së prerësit: ' + err.message, 'error');
        setIsRenderingManualCropPage(false);
      }
    } else {
      // Fallback: crop the existing image
      if (!q.imageUrl) {
        showToast('Kjo pyetje nuk ka një imazh për t\'u rregulluar.', 'warn');
        return;
      }
      setManualCropTarget({
        questionId: q.id || '',
        type,
        index,
        initialCrop: { x: 15, y: 15, width: 70, height: 70 },
        baseImage: q.imageUrl
      });
    }
  };

  const handleSaveManualCrop = async (
    croppedBase64: string,
    newCropPercent?: { x: number; y: number; width: number; height: number }
  ) => {
    if (!manualCropTarget) return;

    const { type, index, questionId } = manualCropTarget;

    if (type === 'generated') {
      const updated = [...pdfGeneratedQuestions];
      if (updated[index]) {
        updated[index].imageUrl = croppedBase64;
        if (newCropPercent) {
          updated[index] = {
            ...updated[index],
            figureCrop: newCropPercent
          } as any;
        }
        setPdfGeneratedQuestions(updated);
        showToast('Fokusi i imazhit u rregullua me sukses! ✂️✨', 'success');
      }
    } else {
      // Database question
      const targetQ = qs.find(q => q.id === questionId);
      if (targetQ) {
        const updatedQ = {
          ...targetQ,
          imageUrl: croppedBase64,
          ...(newCropPercent ? { figureCrop: newCropPercent } : {})
        };
        const updatedList = qs.map(q => q.id === questionId ? updatedQ : q);
        saveQuestions(updatedList);
        showToast('Fokusi i imazhit u përditësua dhe u ruajt me sukses! ✂️✨', 'success');
        reloadData();
      }
    }

    setManualCropTarget(null);
  };

  const performAutoCrop = async (
    file: File,
    pageNum: number,
    crop: { x: number; y: number; width: number; height: number }
  ): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const pdfjsLib = await getPdfjsLib();
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const fileReader = new FileReader();
        fileReader.onload = async function() {
          try {
            const typedarray = new Uint8Array(this.result as ArrayBuffer);
            const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
            
            const targetPageNum = Math.max(1, Math.min(pageNum, pdf.numPages));
            const page = await pdf.getPage(targetPageNum);
            
            const scale = 2.0;
            const viewport = page.getViewport({ scale });
            
            const fullCanvas = document.createElement('canvas');
            fullCanvas.height = viewport.height;
            fullCanvas.width = viewport.width;
            const fullContext = fullCanvas.getContext('2d');
            
            if (!fullContext) {
              reject(new Error('Nuk u mundësua krijimi i canvas-it.'));
              return;
            }

            const renderContext = {
              canvasContext: fullContext,
              viewport: viewport
            };
            await page.render(renderContext).promise;

            const cropX = (crop.x / 100) * viewport.width;
            const cropY = (crop.y / 100) * viewport.height;
            const cropW = (crop.width / 100) * viewport.width;
            const cropH = (crop.height / 100) * viewport.height;

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            const cropCtx = cropCanvas.getContext('2d');
            
            if (!cropCtx) {
              reject(new Error('Nuk u mundësua krijimi i canvas-it të dytë.'));
              return;
            }

            cropCtx.fillStyle = '#ffffff';
            cropCtx.fillRect(0, 0, cropW, cropH);

            cropCtx.drawImage(
              fullCanvas,
              cropX, cropY, cropW, cropH,
              0, 0, cropW, cropH
            );

            const base64 = cropCanvas.toDataURL('image/jpeg', 0.85);
            resolve(base64);
          } catch (err) {
            reject(err);
          }
        };
        fileReader.onerror = (err) => reject(err);
        fileReader.readAsArrayBuffer(file);
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleGenerateQuestionsFromPdf = async () => {
    if (!pdfBase64) {
      showToast('Ju lutem ngarkoni një skedar PDF fillimisht.', 'warn');
      return;
    }

    let catId = pdfTargetCatId;
    let topicId = pdfTargetTopicId;

    // Handle Category creation on-the-fly
    if (showPdfNewCat && pdfNewCatName.trim()) {
      const newCat: Category = {
        id: 'cat_' + Date.now(),
        name: pdfNewCatName.trim(),
        color: '#6366F1' // violet default
      };
      const updatedCats = [...cats, newCat];
      saveCategories(updatedCats);
      catId = newCat.id;
      setCats(updatedCats);
      setPdfTargetCatId(catId);
      setShowPdfNewCat(false);
      setPdfNewCatName('');
    }

    if (!catId) {
      showToast('Ju lutem zgjidhni ose krijoni një kategori.', 'warn');
      return;
    }

    // Handle Topic creation on-the-fly
    if (showPdfNewTopic && pdfNewTopicName.trim()) {
      const newTopic: Topic = {
        id: 'topic_' + Date.now(),
        catId: catId,
        name: pdfNewTopicName.trim()
      };
      const updatedTopics = [...topics, newTopic];
      saveTopics(updatedTopics);
      topicId = newTopic.id;
      setTopics(updatedTopics);
      setPdfTargetTopicId(topicId);
      setShowPdfNewTopic(false);
      setPdfNewTopicName('');
    }

    if (!topicId) {
      showToast('Ju lutem zgjidhni ose krijoni një temë.', 'warn');
      return;
    }

    setIsGeneratingPdf(true);
    setPdfGeneratedQuestions([]);
    setGenerationStatus('Duke përgatitur motorin lokal të ekstraktimeve (Offline)...');

    try {
      const fileToProcess = pdfFile || (singleFile && singleFile.name.toLowerCase().endsWith('.pdf') ? singleFile : null);
      if (!fileToProcess) {
        throw new Error('Ju lutem ngarkoni një skedar PDF fillimisht.');
      }

      const pdfjsLib = await getPdfjsLib();
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const buf = await fileToProcess.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const pages: string[] = [];

      for (let p = 1; p <= pdf.numPages; p++) {
        setGenerationStatus(`Duke lexuar faqen ${p} nga ${pdf.numPages} (Offline)...`);
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        
        let lastY = null;
        let pageText = '';
        for (const item of content.items as any[]) {
          if (lastY !== null && item.transform && Math.abs(item.transform[5] - lastY) > 5) {
            pageText += '\n';
          } else if (lastY !== null) {
            pageText += ' ';
          }
          pageText += item.str;
          if (item.transform) {
            lastY = item.transform[5];
          }
        }
        pages.push(pageText);
      }

      let fullText = pages.join('\n\n');

      // If a Word file is also uploaded, extract its text offline and merge it
      if (wordFile) {
        setGenerationStatus('Duke lexuar skedarin Word (.docx) shoqërues lokalisht...');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
        const wordBuf = await wordFile.arrayBuffer();
        const mammothRes = await (window as any).mammoth.extractRawText({ arrayBuffer: wordBuf });
        if (mammothRes.value) {
          fullText += '\n\n=== TEXT NGA WORD ARCHIVE ===\n\n' + mammothRes.value;
        }
      }

      setGenerationStatus('Duke strukturuar pyetjet me rregullat e parserit inteligjent lokal...');
      const { parsed, errors } = smartParseQuestions(fullText);

      if (parsed && parsed.length > 0) {
        const processed = parsed.map((q: any) => ({
          ...q,
          approved: true
        }));
        setPdfGeneratedQuestions(processed);
        showToast(`U përpunuan me sukses ${processed.length} pyetje offline!`, 'success');
        setGenerationStatus('');
      } else {
        throw new Error('Nuk u gjet asnjë pyetje e rregullt me zgjedhje të shumëfishtë përmes parserit lokal. Shpjegim gabimi: ' + (errors?.join(', ') || 'asnjë'));
      }
    } catch (err: any) {
      console.error(err);
      setGenerationStatus('');
      showToast(`Dështoi gjenerimi offline: ${err.message}`, 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Smart and robust CSV parser
  const parseCsvQuestions = (text: string): { text: string; options: string[]; answer: number; exp: string }[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';

    const parseCsvLine = (line: string) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(val => val.replace(/^"|"$/g, '').trim());
    };

    const headers = parseCsvLine(headerLine).map(h => h.toLowerCase());
    
    let textIdx = headers.findIndex(h => h.includes('pyetj') || h.includes('text') || h.includes('question') || h === 'q');
    let optAIdx = headers.findIndex(h => h === 'a' || h.includes('opt_a') || h.includes('option_a') || h.includes('opsioni_a') || h.includes('opsioni a') || h.includes('opsion_a'));
    let optBIdx = headers.findIndex(h => h === 'b' || h.includes('opt_b') || h.includes('option_b') || h.includes('opsioni_b') || h.includes('opsioni b') || h.includes('opsion_b'));
    let optCIdx = headers.findIndex(h => h === 'c' || h.includes('opt_c') || h.includes('option_c') || h.includes('opsioni_c') || h.includes('opsioni c') || h.includes('opsion_c'));
    let optDIdx = headers.findIndex(h => h === 'd' || h.includes('opt_d') || h.includes('option_d') || h.includes('opsioni_d') || h.includes('opsioni d') || h.includes('opsion_d'));
    let answerIdx = headers.findIndex(h => h.includes('pergj') || h.includes('answer') || h.includes('correct') || h === 'ans');
    let expIdx = headers.findIndex(h => h.includes('shpj') || h.includes('exp') || h.includes('explanation'));

    if (textIdx === -1) textIdx = 0;
    if (optAIdx === -1) optAIdx = 1;
    if (optBIdx === -1) optBIdx = 2;
    if (optCIdx === -1) optCIdx = 3;
    if (optDIdx === -1) optDIdx = 4;
    if (answerIdx === -1) answerIdx = 5;
    if (expIdx === -1) expIdx = 6;

    const parsed: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseCsvLine(line);
      if (cols.length <= Math.max(textIdx, optAIdx, optBIdx, optCIdx, optDIdx)) continue;

      const qText = cols[textIdx] || '';
      if (!qText) continue;

      const options = [
        cols[optAIdx] || 'Opsioni A',
        cols[optBIdx] || 'Opsioni B',
        cols[optCIdx] || 'Opsioni C',
        cols[optDIdx] || 'Opsioni D'
      ];

      const rawAns = (cols[answerIdx] || '').trim().toUpperCase();
      let answer = 0;
      if (rawAns === 'A' || rawAns === '0') answer = 0;
      else if (rawAns === 'B' || rawAns === '1') answer = 1;
      else if (rawAns === 'C' || rawAns === '2') answer = 2;
      else if (rawAns === 'D' || rawAns === '3') answer = 3;
      else {
        const matchIdx = options.findIndex(opt => opt.toUpperCase() === rawAns);
        if (matchIdx !== -1) {
          answer = matchIdx;
        } else {
          const parsedInt = parseInt(rawAns, 10);
          if (!isNaN(parsedInt) && parsedInt >= 0 && parsedInt <= 3) {
            answer = parsedInt;
          }
        }
      }

      const exp = cols[expIdx] || 'Përgjigje e saktë bazuar në skedar.';

      parsed.push({
        text: qText,
        options,
        answer,
        exp
      });
    }

    return parsed;
  };

  const handleSingleFileChange = (file: File) => {
    if (!file) return;
    setSingleFile(file);
    setPdfImportSuccessCount(null);
    setPdfGeneratedQuestions([]);
    
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (['json', 'csv', 'txt', 'docx', 'pdf'].includes(ext)) {
      setSingleFileStatus(`Skedari "${file.name}" u lexua. Gati për përpunim!`);
    } else {
      showToast('Format i panjohur. Ju lutem ngarkoni JSON, CSV, TXT, Word (.docx) ose PDF.', 'warn');
      setSingleFile(null);
      setSingleFileStatus('');
    }
  };

  const handleProcessSingleFile = async () => {
    if (!singleFile) {
      showToast('Ju lutem ngarkoni një skedar fillimisht.', 'warn');
      return;
    }

    let catId = pdfTargetCatId;
    let topicId = pdfTargetTopicId;

    // Handle Category creation on-the-fly
    if (showPdfNewCat && pdfNewCatName.trim()) {
      const newCat: Category = {
        id: 'cat_' + Date.now(),
        name: pdfNewCatName.trim(),
        color: '#6366F1'
      };
      const updatedCats = [...cats, newCat];
      saveCategories(updatedCats);
      catId = newCat.id;
      setCats(updatedCats);
      setPdfTargetCatId(catId);
      setShowPdfNewCat(false);
      setPdfNewCatName('');
    }

    if (!catId) {
      showToast('Ju lutem zgjidhni ose krijoni një kategori.', 'warn');
      return;
    }

    // Handle Topic creation on-the-fly
    if (showPdfNewTopic && pdfNewTopicName.trim()) {
      const newTopic: Topic = {
        id: 'topic_' + Date.now(),
        catId: catId,
        name: pdfNewTopicName.trim()
      };
      const updatedTopics = [...topics, newTopic];
      saveTopics(updatedTopics);
      topicId = newTopic.id;
      setTopics(updatedTopics);
      setPdfTargetTopicId(topicId);
      setShowPdfNewTopic(false);
      setPdfNewTopicName('');
    }

    if (!topicId) {
      showToast('Ju lutem zgjidhni ose krijoni një temë.', 'warn');
      return;
    }

    setIsProcessingSingle(true);
    setPdfGeneratedQuestions([]);
    setGenerationStatus('Duke lexuar skedarin...');

    const ext = singleFile.name.split('.').pop()?.toLowerCase() || '';

    try {
      if (ext === 'json') {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const raw = JSON.parse(reader.result as string);
            const items = Array.isArray(raw) ? raw : [raw];
            
            const processed = items.map((item: any, idx: number) => {
              const qText = item.text || item.pyetje || item.question || '';
              const opts = Array.isArray(item.options) ? item.options : 
                           Array.isArray(item.alternativa) ? item.alternativa :
                           [item.a || 'A', item.b || 'B', item.c || 'C', item.d || 'D'];
              
              let answerNum = 0;
              const rawAns = item.answer !== undefined ? item.answer : item.pergjigja !== undefined ? item.pergjigja : 0;
              if (typeof rawAns === 'number') {
                answerNum = rawAns;
              } else if (typeof rawAns === 'string') {
                if (rawAns.toUpperCase() === 'A') answerNum = 0;
                else if (rawAns.toUpperCase() === 'B') answerNum = 1;
                else if (rawAns.toUpperCase() === 'C') answerNum = 2;
                else if (rawAns.toUpperCase() === 'D') answerNum = 3;
                else {
                  const idxMatch = opts.findIndex((o: any) => String(o).toUpperCase() === rawAns.toUpperCase());
                  if (idxMatch !== -1) answerNum = idxMatch;
                }
              }

              const expText = item.exp || item.shpjegimi || item.explanation || 'Përgjigje e saktë.';

              return {
                text: qText,
                options: opts.slice(0, 4),
                answer: answerNum,
                exp: expText,
                approved: true
              };
            }).filter((q: any) => q.text);

            if (processed.length === 0) {
              throw new Error('Nuk u gjet asnjë pyetje e vlefshme në skedarin JSON.');
            }

            setPdfGeneratedQuestions(processed);
            showToast(`U ngarkuan me sukses ${processed.length} pyetje nga skedari JSON! Klikoni butonin më poshtë për t'i ruajtur në aplikacion.`, 'success');
            setGenerationStatus(`Leximi i JSON përfundoi. ${processed.length} pyetje janë gati për shqyrtim.`);
          } catch (e: any) {
            showToast(`Dështoi leximi i JSON: ${e.message}`, 'error');
            setGenerationStatus('');
          } finally {
            setIsProcessingSingle(false);
          }
        };
        reader.readAsText(singleFile);

      } else if (ext === 'csv') {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const rawText = reader.result as string;
            const questions = parseCsvQuestions(rawText);
            if (questions.length === 0) {
              throw new Error('Nuk u gjet asnjë pyetje në skedarin CSV. Sigurohuni që kolonat të jenë emëruar saktë.');
            }

            const processed = questions.map(q => ({ ...q, approved: true }));
            setPdfGeneratedQuestions(processed);
            showToast(`U ngarkuan me sukses ${processed.length} pyetje nga CSV! Shqyrtojini më poshtë para se t'i ruani.`, 'success');
            setGenerationStatus(`Leximi i CSV përfundoi. ${processed.length} pyetje janë gati për shqyrtim.`);
          } catch (e: any) {
            showToast(`Gabim gjatë leximit të CSV: ${e.message}`, 'error');
            setGenerationStatus('');
          } finally {
            setIsProcessingSingle(false);
          }
        };
        reader.readAsText(singleFile);

      } else if (ext === 'txt') {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const rawText = reader.result as string;
            setGenerationStatus('Duke strukturuar pyetjet me rregullat e parserit inteligjent lokal...');
            const { parsed, errors } = smartParseQuestions(rawText);
            if (parsed && parsed.length > 0) {
              const processed = parsed.map((q: any) => ({ ...q, approved: true }));
              setPdfGeneratedQuestions(processed);
              showToast(`Përpunimi lokal përfundoi me sukses! ${processed.length} pyetje u zbuluan offline.`, 'success');
              setGenerationStatus(`Përpunimi i tekstit përfundoi offline. ${processed.length} pyetje u zbuluan.`);
            } else {
              throw new Error('Nuk u gjet asnjë pyetje e rregullt me përzgjedhje të shumëfishtë përmes parserit lokal. Shpjegim gabimi: ' + (errors?.join(', ') || 'formatimi duhet të jetë me pyetje dhe alternativa A, B, C, D.'));
            }
          } catch (e: any) {
            showToast(`Gabim gjatë përpunimit lokal: ${e.message}`, 'error');
            setGenerationStatus('');
          } finally {
            setIsProcessingSingle(false);
          }
        };
        reader.readAsText(singleFile);

      } else if (ext === 'docx') {
        try {
          setGenerationStatus('Duke lexuar skedarin Word (.docx) lokalisht...');
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
          const buf = await singleFile.arrayBuffer();
          const mammothRes = await (window as any).mammoth.extractRawText({ arrayBuffer: buf });
          if (mammothRes.value) {
            setGenerationStatus('Duke strukturuar pyetjet nga Word me parserin inteligjent lokal...');
            const { parsed, errors } = smartParseQuestions(mammothRes.value);
            if (parsed && parsed.length > 0) {
              const processed = parsed.map((q: any) => ({ ...q, approved: true }));
              setPdfGeneratedQuestions(processed);
              showToast(`Përpunimi lokal i Word përfundoi me sukses! ${processed.length} pyetje u zbuluan offline.`, 'success');
              setGenerationStatus(`Përpunimi i skedarit Word përfundoi. ${processed.length} pyetje u zbuluan.`);
            } else {
              throw new Error('Nuk u gjet asnjë pyetje e rregullt me përzgjedhje të shumëfishtë në skedarin Word përmes parserit lokal.');
            }
          } else {
            throw new Error('Skedari Word është i zbrazët ose dështoi nxjerrja e tekstit.');
          }
        } catch (e: any) {
          showToast(`Gabim gjatë përpunimit lokal të Word: ${e.message}`, 'error');
          setGenerationStatus('');
        } finally {
          setIsProcessingSingle(false);
        }

      } else if (ext === 'pdf') {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            
            setPdfBase64(base64Data);
            setPdfFile(singleFile);
            setGenerationStatus('Skedari PDF u lexua lokalisht. Duke filluar përpunimin e avancuar me faza...');
            
            setTimeout(async () => {
              setIsProcessingSingle(false);
              await handleGenerateQuestionsFromPdf();
            }, 100);
            
          } catch (e: any) {
            showToast(`Gabim mbas leximit të PDF: ${e.message}`, 'error');
            setGenerationStatus('');
            setIsProcessingSingle(false);
          }
        };
        reader.readAsDataURL(singleFile);
      }
    } catch (e: any) {
      showToast(`Ndodhi një gabim gjatë importit: ${e.message}`, 'error');
      setGenerationStatus('');
      setIsProcessingSingle(false);
    }
  };

  const handleSaveImportedQuestions = () => {
    const approvedQuestions = pdfGeneratedQuestions.filter(q => q.approved);
    if (approvedQuestions.length === 0) {
      showToast('Nuk ka pyetje të përzgjedhura për t\'u importuar.', 'warn');
      return;
    }

    let catId = pdfTargetCatId;
    let topicId = pdfTargetTopicId;

    if (!catId || !topicId) {
      showToast('Ju lutem sigurohuni që kategoria dhe tema janë zgjedhur.', 'error');
      return;
    }

    const newQuestionsToSave: Question[] = approvedQuestions.map((q, idx) => ({
      id: `q_pdf_${Date.now()}_${idx}`,
      catId,
      topicId,
      text: q.text,
      options: q.options.slice(0, 4),
      answer: q.answer,
      exp: q.exp,
      svgMarkup: q.svgMarkup,
      imageUrl: q.imageUrl,
      pageNumber: q.pageNumber,
      figureCrop: q.figureCrop
    }));

    const updatedQuestions = [...qs, ...newQuestionsToSave];
    saveQuestions(updatedQuestions);
    reloadData();

    setPdfImportSuccessCount(newQuestionsToSave.length);
    setLastSavedQuestions(newQuestionsToSave);
    setPdfGeneratedQuestions([]);
    setPdfFile(null);
    setPdfBase64('');
    setPdfCustomPrompt('');
    showToast(`U importuan dhe u sinkronizuan me sukses ${newQuestionsToSave.length} pyetje të reja për të gjithë përdoruesit!`, 'success');
  };

  // Reload database caches
  const reloadData = () => {
    setCats(getCategories());
    setTopics(getTopics());
    setQs(getQuestions());
    setReports(getReportedQuestions());
    onUpdateState();
  };

  const handleResolveReport = (reportId: string) => {
    const allReports = getReportedQuestions();
    const updated = allReports.filter((r) => r.id !== reportId);
    saveReportedQuestions(updated);
    setReports(updated);
    showToast('Raporti u fshi/zgjidh me sukses!', 'success');
  };

  const handleStartEditReportedQuestion = (report: QuestionReport) => {
    const qItem = qs.find((q) => q.id === report.questionId);
    if (qItem) {
      setEditingReportedQ({ ...qItem });
    } else {
      showToast('Kjo pyetje nuk u gjet më në sistem.', 'error');
    }
  };

  const handleSaveReportedQuestionEdit = (reportId: string) => {
    if (!editingReportedQ) return;
    
    if (!editingReportedQ.text.trim()) {
      showToast('Teksti i pyetjes nuk mund të jetë bosh.', 'warn');
      return;
    }
    if (editingReportedQ.options.some(o => !o.trim())) {
      showToast('Të gjitha 4 opsionet duhet të plotësohen.', 'warn');
      return;
    }
    if (!editingReportedQ.exp.trim()) {
      showToast('Shpjegimi klinik nuk mund të jetë bosh.', 'warn');
      return;
    }

    const allQs = [...qs];
    const index = allQs.findIndex((q) => q.id === editingReportedQ.id);
    if (index !== -1) {
      allQs[index] = editingReportedQ;
      saveQuestions(allQs);
      setQs(allQs);
      
      const allReports = getReportedQuestions();
      const updatedReports = allReports.filter((r) => r.id !== reportId);
      saveReportedQuestions(updatedReports);
      setReports(updatedReports);
      
      setEditingReportedQ(null);
      showToast('Pyetja u korrigjua dhe raporti u zgjidh automatikisht!', 'success');
      reloadData();
    } else {
      showToast('Dështoi ruajtja. Pyetja nuk ekziston.', 'error');
    }
  };

  useEffect(() => {
    reloadData();
    setDailyLimitState(getDailyLimit());
  }, []);

  // Sync submenus selection options
  const activeTopicsForAdd = newQCatId ? topics.filter((t) => t.catId === newQCatId) : [];
  const activeTopicsForBulk = bulkCatId ? topics.filter((t) => t.catId === bulkCatId) : [];
  const activeTopicsForFilter = filterQCatId ? topics.filter((t) => t.catId === filterQCatId) : topics;

  // Question validation O(1) inside handlers
  const validateQ = (q: any): boolean => {
    return (
      q &&
      typeof q.id === 'string' &&
      typeof q.topicId === 'string' &&
      typeof q.text === 'string' &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.every((o: string) => o.trim().length > 0) &&
      typeof q.exp === 'string' &&
      q.exp.trim().length > 0 &&
      q.answer >= 0 &&
      q.answer <= 3
    );
  };

  // Helper ID generator
  const getUID = (prefix: string) => {
    return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  };

  // Category Actions
  const handleAddCategory = () => {
    const name = newCatName.trim();
    if (!name) {
      showToast('Ju lutem shkruani emrin e kategorisë.', 'warn');
      return;
    }
    const currentCats = getCategories();
    const newCat: Category = {
      id: getUID('c'),
      name,
      color: newCatColor,
    };
    const updated = [...currentCats, newCat];
    saveCategories(updated);
    setNewCatName('');
    showToast(`Kategoria "${name}" u shtua me sukses!`, 'success');
    reloadData();
  };

  const handleDeleteCategory = (catId: string) => {
    const cat = cats.find((c) => c.id === catId);
    if (!cat) return;

    triggerConfirm({
      title: 'Fshi Kategorinë',
      message: `A jeni të sigurt që dëshironi të fshini kategorinë "${cat.name}"? Kjo do të fshijë të gjitha temat dhe pyetjet e kësaj kategorie.`,
      confirmText: 'Fshi',
      cancelText: 'Anulo',
      isDanger: true,
      onConfirm: () => {
        const updatedCats = cats.filter((c) => c.id !== catId);
        const affectedTopics = topics.filter((t) => t.catId === catId).map((t) => t.id);
        const updatedTopics = topics.filter((t) => t.catId !== catId);
        const updatedQs = qs.filter((q) => q.catId !== catId && !affectedTopics.includes(q.topicId));

        saveCategories(updatedCats);
        saveTopics(updatedTopics);
        saveQuestions(updatedQs);

        showToast(`Kategoria "${cat.name}" dhe të gjitha lidhjet u fshinë.`, 'warn');
        reloadData();
      }
    });
  };

  // Topic Actions
  const handleAddTopic = () => {
    const name = newTopicName.trim();
    if (!newTopicCatId) {
      showToast('Zgjidhni kategorinë.', 'warn');
      return;
    }
    if (!name) {
      showToast('Shkruani emrin e temës.', 'warn');
      return;
    }

    const currentTopics = getTopics();
    const newTopic: Topic = {
      id: getUID('t'),
      catId: newTopicCatId,
      name,
    };
    saveTopics([...currentTopics, newTopic]);
    setNewTopicName('');
    showToast(`Tema "${name}" u shtua me sukses!`, 'success');
    reloadData();
  };

  const handleDeleteTopic = (topicId: string) => {
    const t = topics.find((topic) => topic.id === topicId);
    if (!t) return;

    triggerConfirm({
      title: 'Fshi Temën',
      message: `A jeni të sigurt që dëshironi të fshini temën "${t.name}"? Kjo do të fshijë të gjitha pyetjet e kësaj teme.`,
      confirmText: 'Fshi',
      cancelText: 'Anulo',
      isDanger: true,
      onConfirm: () => {
        const updatedTopics = topics.filter((topic) => topic.id !== topicId);
        const updatedQs = qs.filter((q) => q.topicId !== topicId);

        saveTopics(updatedTopics);
        saveQuestions(updatedQs);

        showToast(`Tema "${t.name}" u fshi.`, 'warn');
        reloadData();
      }
    });
  };

  // Inline Category / Topic additions
  const handleAddInlineCat = () => {
    const name = inlineCatName.trim();
    if (!name) {
      showToast('Shkruani emrin e kategorisë inline.', 'warn');
      return;
    }
    const currentCats = getCategories();
    const newId = getUID('c');
    const newCat: Category = { id: newId, name, color: inlineCatColor };
    saveCategories([...currentCats, newCat]);
    setNewQCatId(newId);
    setInlineCatName('');
    setInlineCatOpen(false);
    showToast(`Kategoria "${name}" u shtua dhe u zgjodh automatikisht!`, 'success');
    reloadData();
  };

  const handleAddInlineTopic = () => {
    const name = inlineTopicName.trim();
    if (!name) {
      showToast('Shkruani emrin e temës inline.', 'warn');
      return;
    }
    if (!newQCatId) {
      showToast('Zgjidhni një kategori fillimisht.', 'warn');
      return;
    }
    const currentTopics = getTopics();
    const newId = getUID('t');
    const newTopic: Topic = { id: newId, catId: newQCatId, name };
    saveTopics([...currentTopics, newTopic]);
    setNewQTopicId(newId);
    setInlineTopicName('');
    setInlineTopicOpen(false);
    showToast(`Tema "${name}" u shtua dhe u zgjodh!`, 'success');
    reloadData();
  };

  // Single Question Action
  const handleAddQuestion = () => {
    if (!newQCatId) { showToast('Zgjidhni kategorinë.', 'warn'); return; }
    if (!newQTopicId) { showToast('Zgjidhni temën.', 'warn'); return; }
    const text = newQText.trim();
    if (!text) { showToast('Shkruani tekstin e pyetjes.', 'warn'); return; }
    const exp = newQExp.trim();

    const isOptsValid = newQOpts.every((o) => o.trim().length > 0);
    if (!isOptsValid) {
      showToast('Ju lutem plotësoni të 4 opsionet e përgjigjes.', 'warn');
      return;
    }

    const currentQs = getQuestions();
    const newQ: Question = {
      id: getUID('q'),
      catId: newQCatId,
      topicId: newQTopicId,
      text,
      options: [...newQOpts],
      answer: correctIdx,
      exp: exp || undefined,
      imageUrl: newQImageUrl || undefined,
    };

    saveQuestions([...currentQs, newQ]);

    // Clear question text inputs
    setNewQText('');
    setNewQExp('');
    setNewQOpts(['', '', '', '']);
    setCorrectIdx(0);
    setNewQImageUrl('');
    showToast('Pyetja u shtua në bankë me sukses!', 'success');
    reloadData();
  };

  const handleProcessPastedImage = async () => {
    if (!newQImageUrl) return;
    showToast('Leximi i imazheve (OCR) nuk mbështetet në versionin offline statik në GitHub. Ju mund ta përdorni imazhin si figurë shoqëruese dhe të plotësoni tekstin vetë!', 'info');
  };

  const handleDeleteQuestion = (qId: string) => {
    triggerConfirm({
      title: 'Fshi Pyetjen',
      message: 'A jeni të sigurt që dëshironi të fshini këtë pyetje nga banka e pyetjeve?',
      confirmText: 'Fshi',
      cancelText: 'Anulo',
      isDanger: true,
      onConfirm: () => {
        const updated = qs.filter((q) => q.id !== qId);
        saveQuestions(updated);
        showToast('Pyetja u fshi nga banka.', 'warn');
        reloadData();
      }
    });
  };

  const handleSaveQuestionEdit = (edited: Question) => {
    if (!edited.text.trim()) {
      showToast('Teksti i pyetjes nuk mund të jetë bosh.', 'error');
      return;
    }
    const updated = qs.map((q) => (q.id === edited.id ? edited : q));
    saveQuestions(updated);
    setEditingQ(null);
    showToast('Pyetja u përditësua me sukses!', 'success');
    reloadData();
  };

  // Bulk deletion
  const handleBulkDelete = () => {
    if (qSelection.length === 0) return;
    triggerConfirm({
      title: 'Fshi Pyetjet e Zgjedhura',
      message: `A jeni të sigurt që dëshironi të fshini ${qSelection.length} pyetje të zgjedhura?`,
      confirmText: 'Fshi',
      cancelText: 'Anulo',
      isDanger: true,
      onConfirm: () => {
        const updated = qs.filter((q) => !qSelection.includes(q.id));
        saveQuestions(updated);
        setQSelection([]);
        showToast(`${qSelection.length} pyetje u fshinë.`, 'warn');
        reloadData();
      }
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pageQs = getFilteredQuestions().slice(qPage * 50, (qPage + 1) * 50);
      setQSelection(pageQs.map((q) => q.id));
    } else {
      setQSelection([]);
    }
  };

  const handleToggleSelect = (qId: string, checked: boolean) => {
    if (checked) {
      setQSelection([...qSelection, qId]);
    } else {
      setQSelection(qSelection.filter((id) => id !== qId));
    }
  };

  // Filtered lists getters with high-performance memoization (vital for up to 7,000+ questions!)
  const filteredQuestions = useMemo(() => {
    let f = qs;
    if (filterQCatId) {
      const topicIds = topics.filter((t) => t.catId === filterQCatId).map((t) => t.id);
      f = f.filter((q) => topicIds.includes(q.topicId));
    }
    if (filterQTopicId) {
      f = f.filter((q) => q.topicId === filterQTopicId);
    }
    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase();
      f = f.filter((q) => q.text.toLowerCase().includes(qLower) || (q.exp && q.exp.toLowerCase().includes(qLower)));
    }
    return f;
  }, [qs, filterQCatId, filterQTopicId, searchQuery, topics]);

  const getFilteredQuestions = (): Question[] => {
    return filteredQuestions;
  };

  // Tree nodes toggler
  const toggleNode = (nodeId: string) => {
    setOpenNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Settings Actions
  const handleSaveDailyLimit = () => {
    if (dailyLimit < 1 || dailyLimit > 500) {
      showToast('Limiti ditor duhet të jetë midis 1 dhe 500.', 'warn');
      return;
    }
    setDailyLimit(dailyLimit);
    showToast('Limiti ditor u ruajt me sukses!', 'success');
  };

  const handleSaveAdminPassword = () => {
    const trimmed = newPwd.trim();
    if (trimmed.length < 6) {
      showToast('Fjalëkalimi duhet të ketë të paktën 6 karaktere.', 'warn');
      return;
    }
    if (trimmed === 'admin123') {
      showToast('Zgjidhni një fjalëkalim të ndryshëm nga ai i paracaktuar.', 'warn');
      return;
    }
    setAdminPassword(trimmed);
    setNewPwd('');
    showToast('Fjalëkalimi i panelit admin u përditësua!', 'success');
  };

  const handleResetProgress = () => {
    triggerConfirm({
      title: 'Rivendos Progresin',
      message: 'Kjo do të fshijë të gjithë progresin tuaj të studimit, statistikat dhe historikun.',
      confirmText: 'Konfirmo',
      cancelText: 'Anulo',
      isDanger: true,
      promptExpected: 'RIVENDOS',
      promptPlaceholder: 'Shkruani "RIVENDOS" për të konfirmuar:',
      onConfirm: () => {
        const def = {
          totalDone: 0,
          totalCorrect: 0,
          streak: 0,
          wrongIds: [],
          bookmarkIds: [],
          catStats: {},
          srCards: {},
          badges: [],
          history: [],
          streakFreezes: 1,
          lastUnlockDate: new Date().toDateString(),
          lastAnswerDate: '',
          unlockedUpTo: 100,
        };
        saveProgress(def);
        showToast('Progresi i studimit u rivendos plotësisht.', 'success');
        reloadData();
      }
    });
  };

  const handleClearAllData = () => {
    triggerConfirm({
      title: 'Fshi të Gjitha të Dhënat',
      message: 'Kjo do të fshijë të gjitha pyetjet, kategoritë, temat dhe progresin e studimit përgjithmonë.',
      confirmText: 'Fshi Gjithçka',
      cancelText: 'Anulo',
      isDanger: true,
      promptExpected: 'FSHI TE GJITHA',
      promptPlaceholder: 'Shkruani "FSHI TE GJITHA" për të konfirmuar:',
      onConfirm: () => {
        localStorage.clear();
        showToast('Çdo gjë u fshi! Banka e pyetjeve u kthye në gjendjen fillestare.', 'success');
        reloadData();
      }
    });
  };

  // Bulk Import File Reader & Parser
  const parseBulkText = (text: string) => {
    return smartParseQuestions(text);
  };

  const handlePreviewBulk = (overrideText?: string) => {
    const textToParse = typeof overrideText === 'string' ? overrideText : bulkText;
    if (!bulkCatId || !bulkTopicId) {
      showToast('Zgjidhni kategorinë dhe temën për importin.', 'warn');
      return;
    }
    if (!textToParse.trim()) {
      showToast('Ju lutem ngjitni pyetje në formë teksti ose ngarkoni një skedar.', 'warn');
      return;
    }

    const { parsed, errors } = parseBulkText(textToParse);
    setBulkPreviewData(parsed);
    setBulkErrors(errors);

    if (parsed.length > 0) {
      showToast(`${parsed.length} pyetje u lexuan dhe janë gati për rishikim!`, 'info');
    }
    if (errors.length > 0) {
      showToast(`U gjetën ${errors.length} gabime formatimi.`, 'warn');
    }
  };

  const handleImportBulk = () => {
    if (bulkPreviewData.length === 0) return;
    const currentQs = getQuestions();
    const newQuestions: Question[] = bulkPreviewData.map((p, idx) => {
      // Clean non-displayable or placeholder relative references from final save to avoid broken image icons
      const isValidImg = p.imageUrl && (
        p.imageUrl.startsWith('data:') ||
        p.imageUrl.startsWith('http://') ||
        p.imageUrl.startsWith('https://') ||
        p.imageUrl.startsWith('blob:')
      );

      return {
        id: getUID('q'),
        catId: bulkCatId,
        topicId: bulkTopicId,
        text: p.text,
        options: p.options,
        answer: p.answer,
        exp: p.exp,
        imageUrl: isValidImg ? p.imageUrl : undefined,
      };
    });

    saveQuestions([...currentQs, ...newQuestions]);
    showToast(`✓ ${newQuestions.length} pyetje u importuan me sukses!`, 'success');
    setBulkText('');
    setBulkPreviewData([]);
    setBulkErrors([]);
    reloadData();
  };

  const handleBulkUploadLocalImage = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawBase64 = event.target?.result as string;
        const base64 = await compressImageToLightweightJPEG(rawBase64, 1000, 0.82);
        setBulkPreviewData((prev) =>
          prev.map((item, i) => (i === idx ? { ...item, imageUrl: base64 } : item))
        );
        showToast(`Imazhi u ngarkua me sukses për pyetjen #${idx + 1}! 📸`, 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGeneratedUploadLocalImage = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawBase64 = event.target?.result as string;
        const base64 = await compressImageToLightweightJPEG(rawBase64, 1000, 0.82);
        setPdfGeneratedQuestions((prev) =>
          prev.map((item, i) => (i === idx ? { ...item, imageUrl: base64 } : item))
        );
        showToast(`Imazhi u ngarkua me sukses për pyetjen #${idx + 1}! 📸`, 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBulkUploadMultipleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files) as File[];
    showToast(`Duke lexuar ${fileList.length} imazhe... ⏳`, 'info');
    
    // Read all files asynchronously
    const readFilesPromises = fileList.map((file: File) => {
      return new Promise<{ filename: string; base64: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const rawBase64 = event.target?.result as string;
          const base64 = await compressImageToLightweightJPEG(rawBase64, 1000, 0.82);
          resolve({
            filename: file.name,
            base64
          });
        };
        reader.onerror = () => reject(new Error(`Gabim gjatë leximit të ${file.name}`));
        reader.readAsDataURL(file);
      });
    });

    try {
      const results = await Promise.all(readFilesPromises);
      
      setBulkPreviewData((prev) => {
        const updated = [...prev];
        let matched = 0;
        
        // Keep track of which files are assigned to avoid double assignment
        const assignedFileIndexes = new Set<number>();

        // Step 1: Exact or loose matching against referenced filename in p.imageUrl (e.g. from "[Imazhi: 1.jpg]")
        results.forEach((res, fileIdx) => {
          const cleanFilename = res.filename.trim().toLowerCase();
          const cleanFilenameNoExt = cleanFilename.replace(/\.[^/.]+$/, "");

          const matchIdx = updated.findIndex((item) => {
            if (!item.imageUrl || typeof item.imageUrl !== 'string') return false;
            
            // Skip if already a valid web/base64 image
            const isVal = item.imageUrl.startsWith('data:') || item.imageUrl.startsWith('http://') || item.imageUrl.startsWith('https://') || item.imageUrl.startsWith('blob:');
            if (isVal) return false;

            const ref = item.imageUrl.trim().toLowerCase();
            const refNoExt = ref.replace(/\.[^/.]+$/, "");

            return ref === cleanFilename || refNoExt === cleanFilenameNoExt || ref === cleanFilenameNoExt || refNoExt === cleanFilename;
          });

          if (matchIdx !== -1) {
            updated[matchIdx] = { ...updated[matchIdx], imageUrl: res.base64 };
            matched++;
            assignedFileIndexes.add(fileIdx);
          }
        });

        // Step 2: Match by question number from filename (e.g. "1.jpg" or "pyetja_1.jpeg" matches index 0)
        results.forEach((res, fileIdx) => {
          if (assignedFileIndexes.has(fileIdx)) return;

          const numberMatch = res.filename.match(/\d+/);
          if (numberMatch) {
            const num = parseInt(numberMatch[0], 10);
            if (num > 0 && num <= updated.length) {
              const currentImg = updated[num - 1].imageUrl;
              const hasValidImg = currentImg && typeof currentImg === 'string' && (
                currentImg.startsWith('data:') ||
                currentImg.startsWith('http://') ||
                currentImg.startsWith('https://') ||
                currentImg.startsWith('blob:')
              );

              if (!hasValidImg) {
                updated[num - 1] = { ...updated[num - 1], imageUrl: res.base64 };
                matched++;
                assignedFileIndexes.add(fileIdx);
              }
            }
          }
        });

        // Step 3: Sequential fallback assignment to the first questions that do not have a valid image
        results.forEach((res, fileIdx) => {
          if (assignedFileIndexes.has(fileIdx)) return;

          const firstEmptyIdx = updated.findIndex((item) => {
            const currentImg = item.imageUrl;
            const hasValidImg = currentImg && typeof currentImg === 'string' && (
              currentImg.startsWith('data:') ||
              currentImg.startsWith('http://') ||
              currentImg.startsWith('https://') ||
              currentImg.startsWith('blob:')
            );
            return !hasValidImg;
          });

          if (firstEmptyIdx !== -1) {
            updated[firstEmptyIdx] = { ...updated[firstEmptyIdx], imageUrl: res.base64 };
            matched++;
            assignedFileIndexes.add(fileIdx);
          }
        });

        showToast(`Lidhja në masë përfundoi! U lidhën ${matched} imazhe me pyetjet përkatëse. 📸⚡`, 'success');
        return updated;
      });
    } catch (err: any) {
      showToast(err.message || 'Ndodhi një gabim gjatë leximit të imazheve.', 'error');
    }
  };

  // Word (.docx) & Excel (.xlsx) parsing using CDN scripts dynamically
  const loadScript = (url: string): Promise<void> => {
    if (!(window as any)._scriptCache) {
      (window as any)._scriptCache = {};
    }
    const cache = (window as any)._scriptCache;
    if (cache[url]) {
      return cache[url];
    }
    const scripts = Array.from(document.getElementsByTagName('script'));
    if (scripts.some((s) => s.src === url)) {
      return Promise.resolve();
    }
    cache[url] = new Promise<void>((res, rej) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => res();
      s.onerror = () => {
        delete cache[url];
        rej(new Error(`Gabim në ngarkimin e skriptit: ${url}`));
      };
      document.head.appendChild(s);
    });
    return cache[url];
  };

  const handleFileDrop = async (file: File) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'docx', 'doc', 'pdf'].includes(ext || '')) {
      showToast('Format i panjohur. Pranohen vetëm .xlsx, .xls, .docx ose .pdf', 'warn');
      return;
    }

    setFileImportStatus('Duke lexuar skedarin…');

    try {
      if (ext === 'xlsx' || ext === 'xls') {
        setFileImportStatus('Duke lexuar Excel…');
        // Load SheetJS
        await _deriveSheetJS();
        const buf = await file.arrayBuffer();
        const wb = (window as any).XLSX.read(new Uint8Array(buf), { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = (window as any).XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const blocks: string[] = [];
        const startRow = rows.length > 1 ? 1 : 0; // skip header if it looks like one

        for (let i = startRow; i < rows.length; i++) {
          const r = rows[i] as any[];
          if (!r || r.length < 6) continue;
          const qText = String(r[0] || '').trim();
          const a = String(r[1] || '').trim();
          const b = String(r[2] || '').trim();
          const c = String(r[3] || '').toString().trim();
          const d = (r[4] || '').toString().trim();
          const correct = (r[5] || '').toString().trim().toUpperCase();
          const explanation = (r[6] || '—').toString().trim();

          if (qText && a && b && c && d && 'ABCD'.includes(correct)) {
            blocks.push(`${qText}\nA. ${a}\nB. ${b}\nC. ${c}\nD. ${d}\nSaktë: ${correct}\nShpjegim: ${explanation}`);
          }
        }

        if (blocks.length > 0) {
          const el = document.getElementById('bulkText') as HTMLTextAreaElement | null;
          const excelText = blocks.join('\n\n');
          if (el) el.value = excelText;
          setBulkText(excelText);
          setFileImportStatus(`✓ U lexuan ${blocks.length} rreshta nga Excel.`);
          setBulkImportTab('txt');
          handlePreviewBulk(excelText);
        } else {
          setFileImportStatus('Nuk u gjet asnjë rresht i vlefshëm në formatin e kërkuar.');
        }

      } else if (ext === 'docx') {
        setFileImportStatus('Duke lexuar Word…');
        // Load mammoth
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
        const buf = await file.arrayBuffer();
        const res = await (window as any).mammoth.extractRawText({ arrayBuffer: buf });
        if (res.value) {
          const el = document.getElementById('bulkText') as HTMLTextAreaElement | null;
          if (el) el.value = res.value;
          setBulkText(res.value);
          setFileImportStatus('✓ U lexua teksti i plotë nga Word.');
          setBulkImportTab('txt');
          handlePreviewBulk(res.value);
        } else {
          setFileImportStatus('Word është i zbrazët.');
        }
      } else if (ext === 'pdf') {
        setFileImportStatus('Duke lexuar PDF…');
        // Load pdf.js
        const pdfjsLib = await getPdfjsLib();
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const pages: string[] = [];

        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          
          let lastY = null;
          let pageText = '';
          for (const item of content.items as any[]) {
            if (lastY !== null && item.transform && Math.abs(item.transform[5] - lastY) > 5) {
              pageText += '\n';
            } else if (lastY !== null) {
              pageText += ' ';
            }
            pageText += item.str;
            if (item.transform) {
              lastY = item.transform[5];
            }
          }
          pages.push(pageText);
        }

        const fullText = pages.join('\n\n');
        if (fullText.trim()) {
          const el = document.getElementById('bulkText') as HTMLTextAreaElement | null;
          if (el) el.value = fullText;
          setBulkText(fullText);
          setFileImportStatus('✓ U nxorr teksti nga PDF.');
          setBulkImportTab('txt');
          handlePreviewBulk(fullText);
        } else {
          setFileImportStatus('PDF nuk përmban tekst të kopjueshëm.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setFileImportStatus(`Dështoi: ${err.message}`);
    }
  };

  const _deriveSheetJS = async () => {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  };

  return (
    <div className="flex flex-col md:flex-row min-h-[85vh] bg-white dark:bg-slate-950 border-2 border-b-8 border-slate-200 dark:border-slate-850 rounded-3xl overflow-hidden shadow-xl animate-in fade-in duration-200" id="adminPanel">
      {/* Sidebar navigation */}
      <aside className="w-full md:w-56 shrink-0 bg-white dark:bg-slate-900 border-r-2 border-b-2 md:border-b-0 border-slate-200 dark:border-slate-800 p-4 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto">
        <div className="hidden md:flex items-center gap-3 pb-4 mb-4 border-b-2 border-slate-200 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-[#58cc02] text-white font-black text-sm flex items-center justify-center border-b-2 border-[#46a302] shadow-md shadow-emerald-500/10 shrink-0 select-none">Rx</div>
          <div>
            <div className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none">Mjek Hyrje</div>
            <div className="text-[10px] text-[#58cc02] font-extrabold tracking-widest uppercase mt-1">Admin Panel</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActivePanel('dashboard')}
          className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-2xl border-2 border-b-4 text-xs transition-all active:translate-y-[2px] active:border-b-2 w-full ${
            activePanel === 'dashboard'
              ? 'border-[#1899d6] bg-[#1cb0f6] text-white font-black'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Pasqyrë</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePanel('categories')}
          className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-2xl border-2 border-b-4 text-xs transition-all active:translate-y-[2px] active:border-b-2 w-full ${
            activePanel === 'categories'
              ? 'border-[#1899d6] bg-[#1cb0f6] text-white font-black'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold'
          }`}
        >
          <FolderHeart className="w-4 h-4 shrink-0" />
          <span>Kategoritë</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePanel('topics')}
          className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-2xl border-2 border-b-4 text-xs transition-all active:translate-y-[2px] active:border-b-2 w-full ${
            activePanel === 'topics'
              ? 'border-[#1899d6] bg-[#1cb0f6] text-white font-black'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold'
          }`}
        >
          <FolderOpen className="w-4 h-4 shrink-0" />
          <span>Temat</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePanel('questions')}
          className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-2xl border-2 border-b-4 text-xs transition-all active:translate-y-[2px] active:border-b-2 w-full ${
            activePanel === 'questions'
              ? 'border-[#1899d6] bg-[#1cb0f6] text-white font-black'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold'
          }`}
        >
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span>Pyetjet</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePanel('tree')}
          className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-2xl border-2 border-b-4 text-xs transition-all active:translate-y-[2px] active:border-b-2 w-full ${
            activePanel === 'tree'
              ? 'border-[#1899d6] bg-[#1cb0f6] text-white font-black'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold'
          }`}
        >
          <GitFork className="w-4 h-4 shrink-0" />
          <span>Struktura (Tree)</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePanel('users')}
          className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-2xl border-2 border-b-4 text-xs transition-all active:translate-y-[2px] active:border-b-2 w-full ${
            activePanel === 'users'
              ? 'border-[#1899d6] bg-[#1cb0f6] text-white font-black'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Përdoruesit</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePanel('simulation')}
          className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-2xl border-2 border-b-4 text-xs transition-all active:translate-y-[2px] active:border-b-2 w-full ${
            activePanel === 'simulation'
              ? 'border-[#1899d6] bg-[#1cb0f6] text-white font-black'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold'
          }`}
        >
          <Activity className="w-4 h-4 shrink-0" />
          <span>Simulo 100 Userë</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePanel('pdf-import')}
          className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-2xl border-2 border-b-4 text-xs transition-all active:translate-y-[2px] active:border-b-2 w-full ${
            activePanel === 'pdf-import'
              ? 'border-[#1899d6] bg-[#1cb0f6] text-white font-black'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold'
          }`}
        >
          <FileUp className="w-4 h-4 shrink-0" />
          <span>Gjenero nga PDF</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePanel('reports')}
          className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-2xl border-2 border-b-4 text-xs transition-all active:translate-y-[2px] active:border-b-2 w-full ${
            activePanel === 'reports'
              ? 'border-rose-600 bg-rose-500 text-white font-black'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold'
          }`}
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Raportimet</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePanel('settings')}
          className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-2xl border-2 border-b-4 text-xs transition-all active:translate-y-[2px] active:border-b-2 w-full ${
            activePanel === 'settings'
              ? 'border-[#1899d6] bg-[#1cb0f6] text-white font-black'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Cilësimet</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2.5 py-2.5 px-3.5 rounded-2xl border-2 border-b-4 border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-black transition-all active:translate-y-[2px] active:border-b-2 w-full mt-auto select-none"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Mbyll Admin</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-4xl bg-white dark:bg-slate-950">
        {/* SUBPANEL: DASHBOARD */}
        {activePanel === 'dashboard' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-150">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Pasqyrë Admin</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-6">Përmbledhje e plotë e të dhënave, strukturave dhe statusit lokal.</p>

            {isPasswordDefault() && (
              <div className="bg-rose-500/10 border border-rose-500/25 text-rose-800 dark:text-rose-300 p-4 rounded-2xl flex gap-3 text-xs mb-6 leading-relaxed">
                <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
                <div>
                  <strong className="font-black block">Paralajmërim Sigurie!</strong>
                  Ju jeni duke përdorur fjalëkalimin e paracaktuar admin: <code className="bg-rose-500/20 px-1 py-0.5 rounded font-bold font-mono">admin123</code>. Ndryshojeni menjëherë te skeda <strong>Cilësimet</strong>.
                </div>
              </div>
            )}

            {/* Counters grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm text-center">
                <span className="text-3xl font-black text-[#1899d6] dark:text-[#38bdf8] block tracking-tight font-mono">{qs.length}</span>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mt-1">Pyetje</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm text-center">
                <span className="text-3xl font-black text-[#58cc02] dark:text-[#4ade80] block tracking-tight font-mono">{topics.length}</span>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mt-1">Tema</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm text-center">
                <span className="text-3xl font-black text-[#ff9600] dark:text-[#fbbf24] block tracking-tight font-mono">{cats.length}</span>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mt-1">Kategori</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm text-center">
                <span className="text-3xl font-black text-rose-500 block tracking-tight font-mono">{dailyLimit}</span>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mt-1">Limit ditor</span>
              </div>
            </div>

            {/* Category summary cards */}
            <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4 font-mono">
                Pyetjet sipas kategorisë
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {cats.map((c) => {
                  const catTopics = topics.filter((t) => t.catId === c.id);
                  const catTopicIds = catTopics.map((t) => t.id);
                  const catQsCount = qs.filter((q) => catTopicIds.includes(q.topicId)).length;
                  const pct = qs.length > 0 ? Math.round((catQsCount / qs.length) * 100) : 0;
                  return (
                    <div key={c.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                      <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{c.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{catTopics.length} tema · {catQsCount} pyetje</div>
                      </div>
                      <div className="w-24 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden shrink-0">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-500 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* SUBPANEL: CATEGORIES */}
        {activePanel === 'categories' && (
          <section className="animate-in fade-in duration-150 space-y-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Kategoritë</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Shto apo fshi nivele të larta të kategorizimit.</p>

            {/* Creation form */}
            <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 font-mono">Shto kategori të re</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Emri i Kategorisë</label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="p.sh. Farmakologji..."
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-white text-sm focus:border-[#58cc02] focus:ring-2 focus:ring-[#58cc02]/30 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Ngjyra (Hex)</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-10 h-10 p-1 border-2 border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="py-2.5 px-4 rounded-xl bg-[#58cc02] hover:bg-[#46a302] text-white border-b-4 border-[#46a302] active:translate-y-[2px] active:border-b-0 text-xs font-black transition-all flex items-center justify-center gap-1.5 h-10 w-full"
                >
                  <Plus className="w-4 h-4" /> Shto Kategori
                </button>
              </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-5 py-3">Emri</th>
                      <th className="px-5 py-3">Tema</th>
                      <th className="px-5 py-3">Pyetje</th>
                      <th className="px-5 py-3 text-right">Veprime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {cats.map((c) => {
                      const catTopics = topics.filter((t) => t.catId === c.id);
                      const catTopicIds = catTopics.map((t) => t.id);
                      const catQsCount = qs.filter((q) => q.catId === c.id || catTopicIds.includes(q.topicId)).length;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                          <td className="px-5 py-3.5 flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                            <span className="font-bold text-slate-800 dark:text-slate-100">{c.name}</span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-xs">{catTopics.length}</td>
                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-xs">{catQsCount}</td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(c.id)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* SUBPANEL: TOPICS */}
        {activePanel === 'topics' && (
          <section className="animate-in fade-in duration-150 space-y-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Temat</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Shto apo fshi nënnivele tematike.</p>

            {/* Creation form */}
            <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 font-mono">Shto temë të re</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Zgjidh Kategorinë</label>
                  <select
                    value={newTopicCatId}
                    onChange={(e) => setNewTopicCatId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500 outline-none h-10 font-bold"
                  >
                    <option value="">— Zgjidh —</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Emri i Temës</label>
                  <input
                    type="text"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    placeholder="p.sh. Antidotet..."
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-white text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500 outline-none font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddTopic}
                  className="py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white border-b-4 border-sky-700 active:translate-y-[2px] active:border-b-0 text-xs font-black transition-all flex items-center justify-center gap-1.5 h-10 w-full"
                >
                  <Plus className="w-4 h-4" /> Shto Temë
                </button>
              </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">Lista e Temave</h3>
                <select
                  value={filterTopicCatId}
                  onChange={(e) => setFilterTopicCatId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold outline-none"
                >
                  <option value="">Të gjitha kategoritë</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-5 py-3">Tema</th>
                      <th className="px-5 py-3">Kategoria</th>
                      <th className="px-5 py-3">Pyetje</th>
                      <th className="px-5 py-3 text-right">Veprime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {topics
                      .filter((t) => !filterTopicCatId || t.catId === filterTopicCatId)
                      .map((t) => {
                        const cat = cats.find((c) => c.id === t.catId);
                        const topicQsCount = qs.filter((q) => q.topicId === t.id).length;
                        return (
                          <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                            <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-slate-100">{t.name}</td>
                            <td className="px-5 py-3.5">
                              {cat ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                  <span className="text-xs text-slate-600 dark:text-slate-400">{cat.name}</span>
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-xs">{topicQsCount}</td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteTopic(t.id)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* SUBPANEL: QUESTIONS & BULK IMPORT */}
        {activePanel === 'questions' && (
          <section className="animate-in fade-in duration-150 space-y-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Pyetjet</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Shto pyetje individuale ose importo ato në masë përmes fushës Bulk.</p>

            {/* Main Tabs (Single / Bulk) */}
            <div className="flex gap-2 border-b-2 border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBulkImportTab('txt')}
                className={`py-3 px-5 text-sm font-black border-b-4 transition-all -mb-[2px] ${
                  bulkImportTab === 'txt'
                    ? 'border-[#1cb0f6] text-[#1899d6] dark:text-[#38bdf8]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Shto pyetje të thjeshtë
              </button>
              <button
                type="button"
                onClick={() => setBulkImportTab('file')}
                className={`py-3 px-5 text-sm font-black border-b-4 transition-all -mb-[2px] ${
                  bulkImportTab === 'file'
                    ? 'border-[#1cb0f6] text-[#1899d6] dark:text-[#38bdf8]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Importo në Masë (Excel/Word/PDF)
              </button>
            </div>

            {/* TAB: SINGLE ADD */}
            {bulkImportTab === 'txt' && (
              <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 font-mono">Shto një pyetje të re</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Zgjidh Kategorinë</label>
                    <div className="flex gap-2">
                      <select
                        value={newQCatId}
                        onChange={(e) => {
                          setNewQCatId(e.target.value);
                          setNewQTopicId('');
                        }}
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold"
                      >
                        <option value="">— Zgjidh —</option>
                        {cats.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setInlineCatOpen(true)}
                        className="px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Zgjidh Temën</label>
                    <div className="flex gap-2">
                      <select
                        value={newQTopicId}
                        onChange={(e) => setNewQTopicId(e.target.value)}
                        disabled={!newQCatId}
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none disabled:opacity-50 font-bold"
                      >
                        <option value="">— Zgjidh temën —</option>
                        {activeTopicsForAdd.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setInlineTopicOpen(true)}
                        disabled={!newQCatId}
                        className="px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 shrink-0 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* INLINE CAT FORM */}
                {inlineCatOpen && (
                  <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/80 p-4 rounded-xl space-y-3">
                    <span className="text-xs font-black uppercase text-sky-700 dark:text-sky-300">Kategori e re inline</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Emri i kategorisë..."
                        value={inlineCatName}
                        onChange={(e) => setInlineCatName(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg"
                      />
                      <input
                        type="color"
                        value={inlineCatColor}
                        onChange={(e) => setInlineCatColor(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={handleAddInlineCat}
                        className="px-3 py-2 rounded-lg bg-sky-600 text-white font-bold text-xs"
                      >
                        Shto
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlineCatOpen(false)}
                        className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-bold"
                      >
                        Anulo
                      </button>
                    </div>
                  </div>
                )}

                {/* INLINE TOPIC FORM */}
                {inlineTopicOpen && (
                  <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/80 p-4 rounded-xl space-y-3">
                    <span className="text-xs font-black uppercase text-sky-700 dark:text-sky-300">Temë e re inline</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Emri i temës..."
                        value={inlineTopicName}
                        onChange={(e) => setInlineTopicName(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleAddInlineTopic}
                        className="px-3 py-2 rounded-lg bg-sky-600 text-white font-bold text-xs"
                      >
                        Shto
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlineTopicOpen(false)}
                        className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-bold"
                      >
                        Anulo
                      </button>
                    </div>
                  </div>
                )}

                {/* IMAGE SCREENSHOT CAPTURE & AI EXTRACTION ZONE */}
                <div className="bg-slate-50 dark:bg-slate-950/30 border-2 border-dashed border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-slate-400 font-mono flex items-center gap-1.5">
                      <Image className="w-4 h-4 text-sky-500" /> Figurë / Screenshot nga PDF (Opsionale)
                    </span>
                    {newQImageUrl && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCroppingNew(true)}
                          className="text-[10px] font-black uppercase text-sky-600 hover:text-sky-700 flex items-center gap-1 bg-sky-50 dark:bg-sky-950/20 px-2 py-1 rounded-lg border border-sky-100 dark:border-sky-900 transition-colors"
                        >
                          <Crop className="w-3.5 h-3.5" /> Prit Imazhin ✂️
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewQImageUrl('')}
                          className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-600 flex items-center gap-1 bg-rose-50 dark:bg-rose-950/20 px-2 py-1 rounded-lg border border-rose-100 dark:border-rose-900 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Fshi Imazhin
                        </button>
                      </div>
                    )}
                  </div>

                  {!newQImageUrl ? (
                    <div className="space-y-3">
                      <div
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = async (ev) => {
                                const rawBase64 = ev.target?.result as string;
                                const base64 = await compressImageToLightweightJPEG(rawBase64, 1000, 0.82);
                                setNewQImageUrl(base64);
                                showToast('Imazhi u ngarkua me sukses! 📸', 'success');
                              };
                              reader.readAsDataURL(file);
                            }
                          };
                          input.click();
                        }}
                        className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 rounded-xl p-6 text-center cursor-pointer transition-colors bg-white dark:bg-slate-900 group"
                      >
                        <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-sky-500 mx-auto mb-2 transition-colors animate-bounce" />
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          Kliko këtu për të ngarkuar skicën, ose thjesht bëj <kbd className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-black text-slate-500">Paste (Ctrl+V)</kbd> një screenshot të kopjuar!
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">Shtohet si figura origjinale e pyetjes në kuiz pa asnjë ndryshim.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="h-[1px] bg-slate-200 dark:bg-slate-800 flex-1"></div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ose</span>
                        <div className="h-[1px] bg-slate-200 dark:bg-slate-800 flex-1"></div>
                      </div>

                      <button
                        type="button"
                        onClick={() => startPdfCropper('new_question', null)}
                        className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-black text-xs rounded-xl border-b-4 border-sky-700 active:translate-y-[1px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Crop className="w-4 h-4" /> Merr ose Prit (Crop) Figurinë nga skedar PDF 📄
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col md:flex-row gap-4 items-start bg-white dark:bg-slate-900 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-800">
                        <img
                          src={newQImageUrl}
                          alt="Pasted screenshot"
                          className="max-h-36 max-w-full md:max-w-[240px] rounded-lg object-contain bg-slate-50 border border-slate-100 dark:border-slate-800"
                        />
                        <div className="flex-1 space-y-3 w-full">
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <span>✓ Screenshot i lidhur me sukses si figurë shoqëruese!</span>
                          </p>
                          <p className="text-xs text-slate-500 font-semibold">
                            Kjo figurë do të shfaqet së bashku me pyetjen tuaj. Plotësoni tekstin, opsionet dhe shpjegimin më poshtë.
                          </p>
                          <button
                            type="button"
                            onClick={() => setNewQImageUrl('')}
                            className="py-1.5 px-3.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs cursor-pointer shadow-sm"
                          >
                            Hiq Figurinë 🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Teksti i Pyetjes</label>
                  <textarea
                    rows={3}
                    value={newQText}
                    onChange={(e) => setNewQText(e.target.value)}
                    placeholder="Shkruani pyetjen mjekësore klinike..."
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none resize-none leading-relaxed font-bold focus:border-[#58cc02] focus:ring-2 focus:ring-[#58cc02]/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Opsionet e përgjigjes <span className="font-normal text-slate-400">(Kliko butonin e shkronjës për të zgjedhur të saktën)</span>
                  </label>
                  {newQOpts.map((opt, oIdx) => {
                    const isCorr = correctIdx === oIdx;
                    return (
                      <div key={oIdx} className="flex gap-2.5 items-center">
                        <button
                          type="button"
                          onClick={() => setCorrectIdx(oIdx)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 border-b-4 transition-all select-none active:translate-y-[2px] active:border-b-2 ${
                            isCorr
                              ? 'bg-[#58cc02] border-[#46a302] text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-emerald-400'
                          }`}
                        >
                          {'ABCD'[oIdx]}
                        </button>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const copy = [...newQOpts];
                            copy[oIdx] = e.target.value;
                            setNewQOpts(copy);
                          }}
                          placeholder={`Opsioni ${'ABCD'[oIdx]}...`}
                          className="flex-1 px-4 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none font-semibold focus:border-[#1cb0f6]"
                        />
                      </div>
                    );
                  })}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Shpjegimi Klinik</label>
                  <textarea
                    rows={3}
                    value={newQExp}
                    onChange={(e) => setNewQExp(e.target.value)}
                    placeholder="Arsyetimi i saktësisë së përgjigjes dhe eliminimi i alternativave..."
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none resize-none leading-relaxed font-bold focus:border-[#58cc02] focus:ring-2 focus:ring-[#58cc02]/20"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewQText('');
                      setNewQExp('');
                      setNewQOpts(['', '', '', '']);
                      setCorrectIdx(0);
                    }}
                    className="px-4 py-2.5 rounded-xl border-2 border-b-4 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/55 text-xs font-black transition-all active:translate-y-[2px] active:border-b-2"
                  >
                    Pastro
                  </button>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-5 py-2.5 rounded-xl bg-[#58cc02] hover:bg-[#46a302] text-white border-b-4 border-[#46a302] active:translate-y-[2px] active:border-b-0 text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Shto Pyetjen
                  </button>
                </div>
              </div>
            )}

            {/* TAB: BULK FILE / TEXT IMPORT */}
            {bulkImportTab === 'file' && (
              <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Zgjidh Kategorinë</label>
                    <select
                      value={bulkCatId}
                      onChange={(e) => {
                        setBulkCatId(e.target.value);
                        setBulkTopicId('');
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold"
                    >
                      <option value="">— Zgjidh —</option>
                      {cats.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Zgjidh Temën</label>
                    <select
                      value={bulkTopicId}
                      onChange={(e) => setBulkTopicId(e.target.value)}
                      disabled={!bulkCatId}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none disabled:opacity-50 font-bold"
                    >
                      <option value="">— Zgjidh temën —</option>
                      {activeTopicsForBulk.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sub-toggle internally within bulk: Paste Text vs File Upload */}
                <div className="bg-slate-50 dark:bg-slate-950/45 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2 uppercase tracking-wider font-mono">Zgjidhni mënyrën e importit</span>
                  <div className="grid grid-cols-2 gap-2 max-w-sm mb-4">
                    <button
                      type="button"
                      onClick={() => setBulkErrors([])}
                      className="py-1.5 px-3 bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black transition-all active:translate-y-[1px] active:border-b-2"
                    >
                      Copypaste tekst
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-1.5 px-3 bg-sky-500 hover:bg-sky-600 text-white border-2 border-b-4 border-sky-700 rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-sm transition-all active:translate-y-[1px] active:border-b-2"
                    >
                      <UploadCloud className="w-3.5 h-3.5" /> Ngarko Skedar
                    </button>
                  </div>

                  {/* Detailed guide on including images in text bulk import */}
                  <details className="group bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-150 dark:border-indigo-900/30 rounded-xl p-3 text-xs leading-relaxed transition-all">
                    <summary className="font-bold text-indigo-700 dark:text-indigo-400 cursor-pointer select-none flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Si të shkruani pyetje me imazhe? (Klikoni për formatin)
                      </span>
                      <span className="transition-transform group-open:rotate-180 text-[10px]">▼</span>
                    </summary>
                    <div className="mt-2.5 space-y-2 text-slate-600 dark:text-slate-300 font-medium">
                      <p>Sistemi përkrah importimin e plotë të figurave ose skicave për çdo pyetje duke vendosur kodin <code className="bg-indigo-100 dark:bg-indigo-950 px-1 py-0.5 rounded text-indigo-700 dark:text-indigo-400 font-bold font-mono">[Imazhi: burimi]</code> ose <code className="bg-indigo-100 dark:bg-indigo-950 px-1 py-0.5 rounded text-indigo-700 dark:text-indigo-400 font-bold font-mono">Imazhi: burimi</code> kudo brenda bllokut të pyetjes.</p>
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40 font-mono text-[10px] space-y-1 text-slate-500 dark:text-slate-400">
                        <div className="font-bold text-indigo-600 dark:text-indigo-400">// Shembull i shkrimit të pyetjes:</div>
                        <div>Pyetja 1. Sa është vlera e rrymës në këtë qark?</div>
                        <div className="text-emerald-600 font-bold">[Imazhi: https://shembull.com/skica1.png]  &lt;-- Mund të jetë link ose Base64</div>
                        <div>A. 5 Amper</div>
                        <div>B. 10 Amper</div>
                        <div>C. 15 Amper</div>
                        <div>D. 20 Amper</div>
                        <div>Saktë: B</div>
                        <div>Shpjegim: Sipas ligjit të Ohmit, I = U / R.</div>
                      </div>
                      <p className="text-[10px] text-indigo-500 dark:text-indigo-400">💡 Këshillë: Mund t'i shkruani direkt me këtë format, ose t'i ngarkoni fotot në masë më poshtë te zona e pamjes paraprake, duke u bazuar te numri i pyetjes (p.sh. emërtoni fotot si <code className="font-bold">1.png</code>, <code className="font-bold">2.png</code>, etj.) ose thjesht duke i pritur direkt nga një skedar PDF me prerësin tonë inteligjent.</p>
                    </div>
                  </details>

                  {/* Textarea parser input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block">Paste Text Format</label>
                    <textarea
                      rows={5}
                      value={bulkText}
                      id="bulkText"
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="Teksti i pyetjes...&#10;A. Opsioni A&#10;B. Opsioni B&#10;C. Opsioni C&#10;D. Opsioni D&#10;Saktë: B&#10;Shpjegim: Detajet mjekësore..."
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs outline-none resize-none font-mono font-semibold focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  {/* Hidden Input File */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.docx,.doc,.pdf"
                    onChange={(e) => handleFileDrop(e.target.files?.[0] as File)}
                    className="hidden"
                  />

                  {/* Status Indicator */}
                  {fileImportStatus && (
                    <div className="text-xs text-sky-600 dark:text-sky-400 mt-2 font-mono flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>{fileImportStatus}</span>
                    </div>
                  )}
                </div>

                {/* Bulk validation preview area */}
                {bulkPreviewData.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-black uppercase text-slate-400 font-mono flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> Pamje Paraprake ({bulkPreviewData.length} pyetje)
                      </span>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Hidden file input for bulk image uploading */}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          id="bulk-images-multi-upload"
                          onChange={handleBulkUploadMultipleImages}
                          className="hidden"
                        />
                        <label
                          htmlFor="bulk-images-multi-upload"
                          className="py-1 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          Ngarko Imazhet në Masë 📸⚡
                        </label>

                        <button
                          type="button"
                          onClick={handleImportBulk}
                          className="py-1 px-4 bg-[#58cc02] hover:bg-[#46a302] text-white font-black rounded-lg text-xs cursor-pointer shadow-sm border-b-2 border-[#46a302] active:translate-y-[1px] active:border-b-0 transition-all"
                        >
                          ✓ Konfirmo Importin
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {bulkPreviewData.map((p, idx) => {
                        const isEditingThis = editingBulkIdx === idx;
                        return (
                          <div key={idx} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-xs leading-relaxed shadow-sm flex flex-col md:flex-row gap-4 items-start w-full">
                            {/* Left Column: Question Details OR Edit Form */}
                            {isEditingThis ? (
                              <div className="flex-1 space-y-4 w-full animate-in fade-in duration-200">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-xs font-black text-[#58cc02] uppercase tracking-wider font-mono">Modifiko Pyetjen #{idx + 1}</h4>
                                  <span className="text-[10px] text-slate-400 font-bold">Importi në Masë</span>
                                </div>
                                
                                {/* Question Text */}
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Teksti i Pyetjes</label>
                                  <textarea
                                    value={editingBulkText}
                                    onChange={(e) => setEditingBulkText(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold outline-none focus:border-[#58cc02] transition-colors"
                                  />
                                </div>

                                {/* Options */}
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Opsionet (Kliko shkronjën për të zgjedhur të saktën)</label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {['A', 'B', 'C', 'D'].map((label, oIdx) => (
                                      <div key={oIdx} className="flex items-center gap-2 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-white dark:bg-slate-950">
                                        <button
                                          type="button"
                                          onClick={() => setEditingBulkAnswer(oIdx)}
                                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all cursor-pointer ${
                                            editingBulkAnswer === oIdx
                                              ? 'bg-[#58cc02] text-white border-b-2 border-[#46a302]'
                                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                                          }`}
                                        >
                                          {label}
                                        </button>
                                        <input
                                          type="text"
                                          value={editingBulkOpts[oIdx]}
                                          onChange={(e) => {
                                            const copy = [...editingBulkOpts];
                                            copy[oIdx] = e.target.value;
                                            setEditingBulkOpts(copy);
                                          }}
                                          className="w-full bg-transparent outline-none text-xs font-semibold text-slate-800 dark:text-slate-100"
                                          placeholder={`Shkruaj opsionin ${label}...`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Explanation */}
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Shpjegimi i Pyetjes</label>
                                  <textarea
                                    value={editingBulkExp}
                                    onChange={(e) => setEditingBulkExp(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold outline-none focus:border-[#58cc02] transition-colors"
                                    placeholder="Shpjegimi pse zgjidhja është e saktë..."
                                  />
                                </div>

                                {/* Save / Cancel buttons */}
                                <div className="flex justify-end gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingBulkIdx(null)}
                                    className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black cursor-pointer"
                                  >
                                    Anulo ✕
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!editingBulkText.trim()) {
                                        showToast('Teksti i pyetjes nuk mund të jetë i zbrazët!', 'error');
                                        return;
                                      }
                                      setBulkPreviewData((prev) =>
                                        prev.map((item, i) =>
                                          i === idx
                                            ? {
                                                ...item,
                                                text: editingBulkText,
                                                options: [...editingBulkOpts],
                                                answer: editingBulkAnswer,
                                                exp: editingBulkExp,
                                              }
                                            : item
                                        )
                                      );
                                      setEditingBulkIdx(null);
                                      showToast('Pyetja u modifikua me sukses!', 'success');
                                    }}
                                    className="px-4 py-1.5 bg-[#58cc02] hover:bg-[#46a302] text-white rounded-xl text-xs font-black cursor-pointer shadow-sm border-b-2 border-[#46a302]"
                                  >
                                    Ruaj ✓
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1 space-y-1.5">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="font-black text-slate-950 dark:text-white text-sm">{idx + 1}. {p.text}</div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingBulkIdx(idx);
                                      setEditingBulkText(p.text);
                                      setEditingBulkOpts([...p.options]);
                                      setEditingBulkAnswer(p.answer);
                                      setEditingBulkExp(p.exp || '');
                                    }}
                                    className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-150 dark:border-sky-900/30 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0 shadow-sm"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" /> Modifiko ✏️
                                  </button>
                                </div>
                                <div className="text-slate-600 dark:text-slate-400 pl-4 space-y-0.5">
                                  <div><span className="font-bold text-slate-400">A:</span> {p.options[0]}</div>
                                  <div><span className="font-bold text-slate-400">B:</span> {p.options[1]}</div>
                                  <div><span className="font-bold text-slate-400">C:</span> {p.options[2]}</div>
                                  <div><span className="font-bold text-slate-400">D:</span> {p.options[3]}</div>
                                  <div className="text-[#58cc02] font-black mt-1.5 flex items-center gap-1">
                                    <span className="bg-emerald-500/10 text-[#58cc02] px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">Zgjidhja</span>
                                    {'ABCD'[p.answer]}
                                  </div>
                                </div>
                                {p.exp && (
                                  <div className="mt-2 text-[11px] text-slate-400 italic bg-slate-50 dark:bg-slate-900/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800/60">
                                    <span className="font-bold not-italic text-slate-500 block text-[10px] uppercase font-mono mb-0.5">Shpjegimi:</span>
                                    {p.exp}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Right Column: Image Manager */}
                            <div className="w-full md:w-56 shrink-0 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-150 dark:border-slate-800 flex flex-col gap-2 items-center justify-center text-center">
                              <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider block">Figurë / Skicë</span>
                            
                            {(() => {
                              const isDisplayable = p.imageUrl && (
                                p.imageUrl.startsWith('data:') ||
                                p.imageUrl.startsWith('http://') ||
                                p.imageUrl.startsWith('https://') ||
                                p.imageUrl.startsWith('blob:')
                              );

                              if (isDisplayable) {
                                return (
                                  <div className="space-y-2 w-full">
                                    <div className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-850 bg-white">
                                      <img
                                        src={p.imageUrl}
                                        alt={`Question ${idx + 1}`}
                                        className="max-h-28 mx-auto object-contain p-1"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setBulkPreviewData((prev) =>
                                          prev.map((item, i) => (i === idx ? { ...item, imageUrl: undefined } : item))
                                        );
                                        showToast('Imazhi u hoq me sukses!', 'info');
                                      }}
                                      className="w-full py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-[#9b1c1c]/30 rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer"
                                    >
                                      Largo Figurën 🗑️
                                    </button>
                                  </div>
                                );
                              }

                              return (
                                <div className="space-y-2 w-full">
                                  {p.imageUrl ? (
                                    <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 p-2 rounded-lg text-[10px] font-extrabold flex flex-col items-center gap-1">
                                      <span>📂 Kërkohet skedari:</span>
                                      <span className="font-mono text-[9px] break-all bg-amber-500/5 px-1 py-0.5 rounded">{p.imageUrl}</span>
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-400">Ska figurë të lidhur.</p>
                                  )}
                                  
                                  <div className="grid grid-cols-2 gap-1.5 w-full">
                                    {/* Upload local image */}
                                    <div>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleBulkUploadLocalImage(e, idx)}
                                        className="hidden"
                                        id={`bulk-image-upload-${idx}`}
                                      />
                                      <label
                                        htmlFor={`bulk-image-upload-${idx}`}
                                        className="block py-2 px-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 cursor-pointer text-center transition-colors shadow-sm"
                                      >
                                        Ngarko 📸
                                      </label>
                                    </div>

                                    {/* Crop from PDF */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPdfCroppingSource('bulk_preview');
                                        setBulkCropIndex(idx);
                                        setIsPdfCroppingActive(true);
                                        showToast(`Prisni skicën nga PDF për pyetjen #${idx + 1}`, 'info');
                                      }}
                                      className="py-2 px-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer text-center transition-colors shadow-sm border border-indigo-600"
                                    >
                                      Pris PDF 📄
                                    </button>
                                  </div>

                                  {p.imageUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setBulkPreviewData((prev) =>
                                          prev.map((item, i) => (i === idx ? { ...item, imageUrl: undefined } : item))
                                        );
                                      }}
                                      className="w-full py-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-[9px] font-bold"
                                    >
                                      Anulo lidhjen ✕
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}

                {/* Errors summary in parse */}
                {bulkErrors.length > 0 && (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-xs space-y-1.5 text-rose-800 dark:text-rose-300">
                    <span className="font-bold block">U gjetën gabime në formatim:</span>
                    {bulkErrors.map((err, idx) => (
                      <div key={idx}>⚠ {err}</div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => handlePreviewBulk()}
                    className="py-2.5 px-5 rounded-xl bg-[#1cb0f6] hover:bg-[#1899d6] text-white border-b-4 border-[#1899d6] active:translate-y-[2px] active:border-b-0 text-xs font-black transition-all"
                  >
                    Kontrollo Formatimin
                  </button>
                </div>
              </div>
            )}

            {/* Questions Bank List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">Banka e Pyetjeve ({getFilteredQuestions().length})</h3>
                </div>

                 <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Kërko pyetje..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setQPage(0);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs outline-none w-36 md:w-48"
                  />

                  <select
                    value={filterQCatId}
                    onChange={(e) => {
                      setFilterQCatId(e.target.value);
                      setFilterQTopicId('');
                      setQPage(0);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold outline-none"
                  >
                    <option value="">Kategoria</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <select
                    value={filterQTopicId}
                    onChange={(e) => {
                      setFilterQTopicId(e.target.value);
                      setQPage(0);
                    }}
                    disabled={!filterQCatId}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold outline-none disabled:opacity-50"
                  >
                    <option value="">Tema</option>
                    {activeTopicsForFilter.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bulk actions toolbar inside questions list */}
              {qSelection.length > 0 && (
                <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-150">
                  <span className="text-xs font-bold text-rose-800 dark:text-rose-300 font-mono">
                    {qSelection.length} pyetje të zgjedhura
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setQSelection([])}
                      className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold"
                    >
                      Anulo
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Fshi të zgjedhurat
                    </button>
                  </div>
                </div>
              )}

              {/* Questions table list */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/40 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-5 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="px-5 py-3 w-1/2">Pyetja</th>
                    <th className="px-5 py-3">Tema</th>
                    <th className="px-5 py-3">Saktë</th>
                    <th className="px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {getFilteredQuestions()
                    .slice(qPage * 50, (qPage + 1) * 50)
                    .map((q, idx) => {
                      const topic = topics.find((t) => t.id === q.topicId);
                      const cat = topic ? cats.find((c) => c.id === topic.catId) : null;
                      const isSel = qSelection.includes(q.id);
                      const isExpanded = expandedAdminQId === q.id;
                      return (
                        <React.Fragment key={q.id}>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer" onClick={() => setExpandedAdminQId(isExpanded ? null : q.id)}>
                            <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSel}
                                onChange={(e) => handleToggleSelect(q.id, e.target.checked)}
                                className="cursor-pointer"
                              />
                            </td>
                            <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100 leading-relaxed max-w-sm">
                              <div className="flex items-center gap-2">
                                <span className={isExpanded ? "font-bold text-sky-600 dark:text-sky-400" : "truncate block max-w-xs md:max-w-md"}>{q.text}</span>
                                {q.imageUrl && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200/20 text-[9px] font-black uppercase tracking-wider font-mono shrink-0" title="Kjo pyetje ka figurë">
                                    <Image className="w-2.5 h-2.5" /> Figurë
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              {cat ? (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                                >
                                  {topic?.name}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-5 py-3.5 font-bold font-mono text-emerald-600 dark:text-emerald-400">
                              {'ABCD'[q.answer]}
                            </td>
                            <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingQ(q)}
                                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-200 hover:bg-sky-50 dark:hover:bg-sky-950/20 text-slate-400 hover:text-sky-500 transition-colors"
                                  title="Modifiko pyetjen"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 transition-colors"
                                  title="Fshi pyetjen"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/50 dark:bg-slate-900/10">
                              <td colSpan={5} className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                                <div className="space-y-4 text-left animate-in slide-in-from-top-1 duration-150">
                                  {/* Header of Expanded Section */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-[#58cc02] font-mono">Detajet e Pyetjes</span>
                                  </div>

                                  {/* Full text */}
                                  <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono mb-1">Teksti i plotë i pyetjes:</h4>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-relaxed font-sans">{q.text}</p>
                                  </div>

                                  {/* Figure/Diagram */}
                                  {q.svgMarkup && (
                                    <div className="mt-2.5 p-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center overflow-hidden max-w-[320px] shadow-xs text-slate-950">
                                      <h5 className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-mono mb-2 self-start">Skica / Figura (Vektoriale):</h5>
                                      <div 
                                        className="w-full flex items-center justify-center svg-container [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-48 [&>svg]:mx-auto"
                                        dangerouslySetInnerHTML={{ __html: q.svgMarkup }}
                                      />
                                    </div>
                                  )}
                                  {q.imageUrl && (
                                    <div className="mt-2.5 p-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center overflow-hidden max-w-[320px] shadow-xs text-slate-950">
                                      <h5 className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-mono mb-2 self-start">Skica / Figura:</h5>
                                      <div className="flex flex-col items-center gap-2 w-full">
                                        <img
                                          src={q.imageUrl}
                                          alt="Diagrama e pyetjes"
                                          referrerPolicy="no-referrer"
                                          className="max-h-48 object-contain rounded-lg"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleOpenManualCrop(q, idx, 'database')}
                                          className="mt-1 px-3 py-1.5 bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-slate-700 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all active:translate-y-[1px]"
                                        >
                                          <Crop className="w-3.5 h-3.5" /> Ndrysho Fokusin ✂️
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Alternatives */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                    {q.options.map((opt, oIdx) => {
                                      const isCorrect = oIdx === q.answer;
                                      return (
                                        <div
                                          key={oIdx}
                                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-start gap-2.5 ${
                                            isCorrect 
                                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                              : 'bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                          }`}
                                        >
                                          <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] font-mono border shrink-0 ${
                                            isCorrect
                                              ? 'bg-emerald-500 text-white border-emerald-600'
                                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-750'
                                          }`}>
                                            {['A', 'B', 'C', 'D'][oIdx]}
                                          </span>
                                          <span className="flex-1 leading-snug">{opt}</span>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Explanation */}
                                  {q.exp && (
                                    <div className="bg-sky-500/[0.04] border border-sky-500/10 rounded-xl p-3 text-xs leading-relaxed mt-2">
                                      <h5 className="font-black flex items-center gap-1.5 mb-1 text-[9px] uppercase tracking-wider font-mono text-sky-600 dark:text-sky-400">
                                        Sqarimi Shkencor:
                                      </h5>
                                      <p className="font-semibold text-slate-700 dark:text-slate-300 font-sans mt-1">
                                        {q.exp}
                                      </p>
                                    </div>
                                  )}

                                  {/* Veprimet per pyetjen */}
                                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-150 dark:border-slate-800/60 mt-3">
                                    <button
                                      type="button"
                                      onClick={() => setEditingQ(q)}
                                      className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:translate-y-[1px] cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" /> Modifiko Pyetjen ✏️
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteQuestion(q.id)}
                                      className="px-4 py-2 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:translate-y-[1px] cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Fshi Pyetjen 🗑️
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>

              {/* Load more page pagination */}
              {getFilteredQuestions().length > (qPage + 1) * 50 && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => setQPage(qPage + 1)}
                    className="py-1.5 px-4 rounded-xl border text-xs font-bold hover:bg-slate-100"
                  >
                    Ngarko më shumë ↓
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SUBPANEL: TREE STRUCTURE */}
        {activePanel === 'tree' && (
          <section className="animate-in fade-in duration-150 space-y-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Struktura Hierarkike</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pamja e plotë: Kategori → Temat → Pyetjet klinike mjekësore.</p>

            <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              {cats.map((c) => {
                const isCatOpen = !!openNodes[c.id];
                const catTopics = topics.filter((t) => t.catId === c.id);
                return (
                  <div key={c.id} className="border border-slate-100 dark:border-slate-800/80 rounded-xl overflow-hidden">
                    <div className="w-full flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/10 font-bold">
                      <button
                        type="button"
                        onClick={() => toggleNode(c.id)}
                        className="flex-1 flex items-center gap-2.5 p-3.5 text-left cursor-pointer"
                      >
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-sm text-slate-800 dark:text-slate-100">{c.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({catTopics.length} tema)</span>
                      </button>
                      <div className="flex items-center gap-2 pr-3.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(c.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Fshi Kategorinë"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleNode(c.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                        >
                          {isCatOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {isCatOpen && (
                      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pl-8 space-y-2.5">
                        {catTopics.length === 0 ? (
                          <div className="text-xs italic text-slate-400 py-1">Nuk ka tema në këtë kategori.</div>
                        ) : (
                          catTopics.map((t) => {
                            const isTopicOpen = !!openNodes[t.id];
                            const topicQs = qs.filter((q) => q.topicId === t.id);
                            return (
                              <div key={t.id} className="border border-slate-50 dark:border-slate-800/30 rounded-lg overflow-hidden">
                                <div className="w-full flex items-center justify-between bg-slate-50/20 dark:bg-slate-800/5 text-xs font-bold">
                                  <button
                                    type="button"
                                    onClick={() => toggleNode(t.id)}
                                    className="flex-1 flex items-center gap-2 p-2.5 text-left cursor-pointer"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                    <span className="text-slate-700 dark:text-slate-300">{t.name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">({topicQs.length} pyetje)</span>
                                  </button>
                                  <div className="flex items-center gap-2 pr-2.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTopic(t.id)}
                                      className="p-0.5 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                      title="Fshi Temën"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleNode(t.id)}
                                      className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                                    >
                                      {isTopicOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                </div>

                                {isTopicOpen && (
                                  <div className="p-2 bg-slate-50/30 dark:bg-slate-800/10 border-t border-slate-50 dark:border-slate-800/20 pl-6 divide-y divide-slate-100 dark:divide-slate-800 text-[11px] leading-relaxed">
                                    {topicQs.length === 0 ? (
                                      <div className="text-slate-400 italic py-1">Nuk ka pyetje.</div>
                                    ) : (
                                      <>
                                        {topicQs.slice(0, topicLimits[t.id] || 25).map((q) => (
                                          <div key={q.id} className="py-2 flex items-start justify-between gap-3 text-slate-600 dark:text-slate-400">
                                            <span className="flex-1 select-none pr-2">{q.text}</span>
                                            <div className="flex gap-2 items-center shrink-0">
                                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{'ABCD'[q.answer]}</span>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteQuestion(q.id)}
                                                className="p-0.5 text-slate-400 hover:text-rose-500"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                        {topicQs.length > (topicLimits[t.id] || 25) && (
                                          <div className="py-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const currentLimit = topicLimits[t.id] || 25;
                                                setTopicLimits((prev) => ({ ...prev, [t.id]: currentLimit + 50 }));
                                              }}
                                              className="text-sky-600 dark:text-sky-400 hover:underline font-bold text-[10px]"
                                            >
                                              Shfaq më shumë (+50 pyetje) · Gjithsej {topicQs.length}
                                            </button>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SUBPANEL: USERS */}
        {activePanel === 'users' && (
          <section className="animate-in fade-in duration-150 space-y-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Përdoruesit</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Shiko progresin e nxënësit lokal.</p>

            <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-5 py-3">Përdoruesi</th>
                      <th className="px-5 py-3">Të përfunduara</th>
                      <th className="px-5 py-3">Saktësia</th>
                      <th className="px-5 py-3">Seria (Streak)</th>
                      <th className="px-5 py-3">Statusi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    <tr>
                      <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-100">
                        Unë (Studenti Lokor)
                        <span className="block text-[10px] text-slate-400 font-normal">LocalStorage ID: nsp_prog</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{progress.totalDone}</td>
                      <td className="px-5 py-4 font-bold text-sky-600 dark:text-sky-400 font-mono text-xs">
                        {progress.totalDone > 0 ? Math.round((progress.totalCorrect / progress.totalDone) * 100) : 0}%
                      </td>
                      <td className="px-5 py-4 font-bold text-amber-500 font-mono text-xs">🔥 {progress.streak} ditë</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          AKTIW (Lokal)
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* SUBPANEL: SETTINGS */}
        {activePanel === 'settings' && (
          <section className="animate-in fade-in duration-150 space-y-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Cilësimet</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Konfiguro sjelljen administrative të Mjek Hyrje.</p>

            {/* Daily limit */}
            <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1 font-mono">Limiti ditor i pyetjeve</h3>
              <p className="text-[11px] text-slate-400 mb-3">Përcakton sasinë e pyetjeve të reja që çlirohen automatikisht çdo ditë për studim.</p>
              <div className="flex gap-3 items-center max-w-xs">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimitState(Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold font-mono outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveDailyLimit}
                  className="px-4 py-2.5 bg-[#1cb0f6] hover:bg-[#1899d6] text-white border-b-4 border-[#1899d6] active:translate-y-[2px] active:border-b-0 rounded-xl text-xs font-black transition-all shadow-sm"
                >
                  Ruaj Limit
                </button>
              </div>
            </div>

            {/* Update admin password */}
            <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1 font-mono">Ndrysho Fjalëkalimin Admin</h3>
              <p className="text-[11px] text-slate-400 mb-3">Shkruani fjalëkalimin e ri administrativ. Duhet të ketë të paktën 6 karaktere.</p>
              <div className="flex gap-3 items-center max-w-sm">
                <input
                  type="password"
                  placeholder="Min. 6 karaktere..."
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm outline-none font-bold"
                />
                <button
                  type="button"
                  onClick={handleSaveAdminPassword}
                  className="px-4 py-2.5 bg-[#58cc02] hover:bg-[#46a302] text-white border-b-4 border-[#46a302] active:translate-y-[2px] active:border-b-0 rounded-xl text-xs font-black transition-all shrink-0"
                >
                  Ndrysho
                </button>
              </div>
            </div>

            {/* Export / Import Backup */}
            <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1 font-mono">Backup Progresit</h3>
                <p className="text-[11px] text-slate-400">Eksporto ose importo të dhënat e progresit lokal — e dobishme kur ndërroni pajisje.</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={exportBackupJSON}
                  className="py-2.5 px-4 bg-[#1cb0f6] hover:bg-[#1899d6] text-white border-b-4 border-[#1899d6] active:translate-y-[2px] active:border-b-0 rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> Eksporto Progres
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-rose-500/5 border-2 border-b-4 border-rose-300 dark:border-rose-900/60 p-5 rounded-2xl shadow-sm space-y-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-rose-500 mb-1 font-mono">Zona e Rrezikut</h3>
                <p className="text-[11px] text-slate-400">Këto veprime janë të pakthyeshme dhe do të kërkojnë fjalë konfirmimi me shkrim.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleResetProgress}
                  className="py-2.5 px-4 rounded-xl border-2 border-b-4 border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-black transition-all active:translate-y-[2px] active:border-b-2"
                >
                  Rivendos Progresin (Reset)
                </button>
                <button
                  type="button"
                  onClick={handleClearAllData}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white border-b-4 border-rose-800 active:translate-y-[2px] active:border-b-0 text-xs font-black transition-all shadow-md shadow-rose-600/20"
                >
                  Fshi Gjithçka (Fshirje e plotë)
                </button>
              </div>
            </div>
          </section>
        )}

        {/* SUBPANEL: PDF IMPORT */}
        {activePanel === 'pdf-import' && (
          <section className="animate-in fade-in duration-150 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Importo & Gjenero Pyetje</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Shtoni pyetje të reja në aplikacion nga skedarët tuaj. Mbështeten formate të strukturuara ose dokumente të thjeshta me Inteligjencë Artificiale.
                </p>
              </div>
            </div>

            {/* Import Tabs */}
            <div className="flex border-b-2 border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setImportMethod('dual');
                  setPdfGeneratedQuestions([]);
                  setPdfImportSuccessCount(null);
                }}
                className={`pb-3 text-xs md:text-sm font-black tracking-tight border-b-4 transition-all -mb-[2px] px-4 cursor-pointer ${
                  importMethod === 'dual'
                    ? 'border-[#1cb0f6] text-[#1cb0f6]'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                Gjenerim i Kombinuar (PDF + Çelës Word)
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportMethod('single');
                  setPdfGeneratedQuestions([]);
                  setPdfImportSuccessCount(null);
                }}
                className={`pb-3 text-xs md:text-sm font-black tracking-tight border-b-4 transition-all -mb-[2px] px-4 cursor-pointer ${
                  importMethod === 'single'
                    ? 'border-[#1cb0f6] text-[#1cb0f6]'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                Import i Thjeshtë (JSON, CSV, DOCX, TXT, PDF)
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-5">
              {/* Category & Topic Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1 font-mono">Kategoria Target</label>
                  {!showPdfNewCat ? (
                    <div className="flex gap-2">
                      <select
                        value={pdfTargetCatId}
                        onChange={(e) => {
                          setPdfTargetCatId(e.target.value);
                          setPdfTargetTopicId(''); // reset topic when category changes
                        }}
                        className="flex-1 px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm outline-none font-bold text-slate-800 dark:text-slate-200 focus:border-[#1cb0f6]"
                      >
                        <option value="">-- Zgjidhni Kategorinë --</option>
                        {cats.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowPdfNewCat(true)}
                        className="px-3 py-2 border-2 border-b-4 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black transition-all active:translate-y-[1px] active:border-b-2 cursor-pointer"
                      >
                        + Kategori
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Emri i kategorisë së re..."
                        value={pdfNewCatName}
                        onChange={(e) => setPdfNewCatName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm outline-none font-bold text-slate-800 dark:text-slate-200 focus:border-[#1cb0f6]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPdfNewCat(false)}
                        className="px-3 py-2 border-2 border-b-4 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-500 rounded-xl text-xs font-black transition-all active:translate-y-[1px] active:border-b-2 cursor-pointer"
                      >
                        Anulo
                      </button>
                    </div>
                  )}
                </div>

                {/* Topic */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1 font-mono">Tema Target</label>
                  {!showPdfNewTopic ? (
                    <div className="flex gap-2">
                      <select
                        value={pdfTargetTopicId}
                        onChange={(e) => setPdfTargetTopicId(e.target.value)}
                        disabled={!pdfTargetCatId && !showPdfNewCat}
                        className="flex-1 px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm outline-none font-bold disabled:opacity-50 text-slate-800 dark:text-slate-200 focus:border-[#1cb0f6]"
                      >
                        <option value="">-- Zgjidhni Temën --</option>
                        {topics
                          .filter((t) => t.catId === pdfTargetCatId)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowPdfNewTopic(true)}
                        disabled={!pdfTargetCatId && !showPdfNewCat}
                        className="px-3 py-2 border-2 border-b-4 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black disabled:opacity-50 transition-all active:translate-y-[1px] active:border-b-2 cursor-pointer"
                      >
                        + Temë
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Emri i temës së re..."
                        value={pdfNewTopicName}
                        onChange={(e) => setPdfNewTopicName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm outline-none font-bold text-slate-800 dark:text-slate-200 focus:border-[#1cb0f6]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPdfNewTopic(false)}
                        className="px-3 py-2 border-2 border-b-4 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-500 rounded-xl text-xs font-black transition-all active:translate-y-[1px] active:border-b-2 cursor-pointer"
                      >
                        Anulo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Visual PDF Cropper Widget */}
              {(pdfFile || (singleFile && singleFile.name.toLowerCase().endsWith('.pdf'))) ? (
                <div className="bg-sky-50 dark:bg-sky-950/20 border-2 border-sky-100 dark:border-sky-900/30 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold shrink-0">
                      <Crop className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Prerësi i Avancuar i PDF-së (Cropper) ✂️</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Dëshironi të prisni pyetjet ose figurat vizualisht nga kjo PDF? Hapni prerësin interaktiv për të selektuar faqe për faqe.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startPdfCropper('pdf_panel', pdfFile || singleFile)}
                    className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-black text-xs rounded-xl border-b-4 border-sky-700 active:translate-y-[1px] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Crop className="w-4 h-4" /> Prisni (Crop) Vizualisht
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">Prerësi i PDF-së (Interactive Cropping)</h4>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Mund të ngarkoni një PDF direkt në Prerësin Vizual për të gjetur, prerë skica ose gjeneruar pyetje me AI.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startPdfCropper('pdf_panel', null)}
                    className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs rounded-xl border-b-4 border-slate-400 dark:border-slate-950 active:translate-y-[1px] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Crop className="w-4 h-4" /> Hap Prerësin Vizual 📄
                  </button>
                </div>
              )}

              {importMethod === 'dual' ? (
                /* DUAL PDF + WORD INTERFACE */
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* PDF Questions Upload */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Ngarko Skedarin e Pyetjeve (PDF)
                      </label>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setPdfDragOver(true);
                        }}
                        onDragLeave={() => setPdfDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setPdfDragOver(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) handlePdfFileChange(file);
                        }}
                        onClick={() => pdfFileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                          pdfDragOver
                            ? 'border-[#1cb0f6] bg-[#1cb0f6]/5'
                            : pdfFile
                            ? 'border-[#58cc02] bg-[#58cc02]/5'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <input
                          type="file"
                          ref={pdfFileInputRef}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePdfFileChange(file);
                          }}
                          accept=".pdf"
                          className="hidden"
                        />
                        <div className="flex flex-col items-center justify-center gap-2">
                          <UploadCloud className={`w-8 h-8 ${pdfFile ? 'text-[#58cc02]' : 'text-slate-400'}`} />
                          {pdfFile ? (
                            <div>
                              <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate max-w-[200px] mx-auto">{pdfFile.name}</p>
                              <p className="text-xs text-slate-400 font-medium mt-0.5">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-black text-slate-700 dark:text-slate-300">Tërhiqni ose klikoni PDF-në e pyetjeve</p>
                              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Pranohen vetëm skedarë .pdf</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Word Answers Upload */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Ngarko Skedarin e Përgjigjeve (Word .docx)
                      </label>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setWordDragOver(true);
                        }}
                        onDragLeave={() => setWordDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setWordDragOver(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleWordFileChange(file);
                        }}
                        onClick={() => wordFileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                          wordDragOver
                            ? 'border-[#1cb0f6] bg-[#1cb0f6]/5'
                            : wordFile
                            ? 'border-[#58cc02] bg-[#58cc02]/5'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <input
                          type="file"
                          ref={wordFileInputRef}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleWordFileChange(file);
                          }}
                          accept=".docx"
                          className="hidden"
                        />
                        <div className="flex flex-col items-center justify-center gap-2">
                          <UploadCloud className={`w-8 h-8 ${wordFile ? 'text-[#58cc02]' : 'text-slate-400'}`} />
                          {wordFile ? (
                            <div>
                              <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate max-w-[200px] mx-auto">{wordFile.name}</p>
                              <p className="text-xs text-slate-400 font-medium mt-0.5">{(wordFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-black text-slate-700 dark:text-slate-300">Tërhiqni ose klikoni Word-in e përgjigjeve</p>
                              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Pranohen vetëm skedarë .docx</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Custom prompt guidelines */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1 font-mono">Udhëzime shtesë për AI (Opcionale)</label>
                    <textarea
                      placeholder="P.sh. 'Fokusohu vetëm te pyetjet klinike', 'Nëse pyetjet janë në anglisht, përktheji ato dhe shpjegimet në shqip'..."
                      value={pdfCustomPrompt}
                      onChange={(e) => setPdfCustomPrompt(e.target.value)}
                      className="w-full h-20 px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs outline-none resize-none text-slate-800 dark:text-slate-200 font-bold focus:border-[#58cc02] focus:ring-2 focus:ring-[#58cc02]/20"
                    />
                  </div>

                  {/* Status or Success messages */}
                  {generationStatus && (
                    <div className={`p-4 rounded-xl text-xs flex gap-3 leading-relaxed items-center ${
                      isGeneratingPdf
                        ? 'bg-sky-500/10 border-2 border-sky-500/20 text-sky-800 dark:text-sky-300'
                        : 'bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                    }`}>
                      {isGeneratingPdf && <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin shrink-0" />}
                      <span className="font-bold">{generationStatus}</span>
                    </div>
                  )}

                  {/* Generate button */}
                  <button
                    type="button"
                    onClick={handleGenerateQuestionsFromPdf}
                    disabled={isGeneratingPdf || !pdfBase64}
                    className="w-full py-3 bg-[#58cc02] hover:bg-[#46a302] disabled:bg-slate-300 disabled:dark:bg-slate-800 text-white disabled:text-slate-500 rounded-xl text-xs font-black border-b-4 border-[#46a302] active:translate-y-[2px] active:border-b-0 shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all uppercase tracking-wider disabled:border-b-0 disabled:translate-y-0"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isGeneratingPdf ? 'Duke përpunuar lokalisht...' : 'Gjenero Pyetjet, Përgjigjet & Shpjegimet'}
                  </button>
                </div>
              ) : (
                /* SINGLE FILE MULTI-FORMAT INTERFACE */
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                      Ngarko skedar të vetëm (JSON, CSV, DOCX, TXT, PDF)
                    </label>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setSingleFileDragOver(true);
                      }}
                      onDragLeave={() => setSingleFileDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setSingleFileDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleSingleFileChange(file);
                      }}
                      onClick={() => singleFileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                        singleFileDragOver
                          ? 'border-[#1cb0f6] bg-[#1cb0f6]/5'
                          : singleFile
                          ? 'border-[#58cc02] bg-[#58cc02]/5'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <input
                        type="file"
                        ref={singleFileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSingleFileChange(file);
                        }}
                        accept=".json,.csv,.txt,.docx,.pdf"
                        className="hidden"
                      />
                      <div className="flex flex-col items-center justify-center gap-2.5">
                        <UploadCloud className={`w-10 h-10 ${singleFile ? 'text-[#58cc02]' : 'text-slate-400'}`} />
                        {singleFile ? (
                          <div>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate max-w-[300px] mx-auto">{singleFile.name}</p>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">{(singleFile.size / 1024).toFixed(1)} KB ({(singleFile.size / 1024 / 1024).toFixed(2)} MB)</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">Tërhiqni ose klikoni për të ngarkuar skedarin</p>
                            <p className="text-[10px] text-slate-400 font-medium mt-1">Pranohen skedarë .json, .csv, .docx, .txt, .pdf</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cheat sheet templates */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-900 space-y-3">
                    <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider font-mono">Formatet dhe strukturat e pranuara:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          Skedar i strukturuar CSV ose Excel:
                        </p>
                        <p className="mt-0.5 font-medium">Duhet të përmbajë kolonat: <code className="font-mono bg-slate-200/50 px-1 rounded dark:bg-slate-800">pyetja</code>, <code className="font-mono bg-slate-200/50 px-1 rounded dark:bg-slate-800">a</code>, <code className="font-mono bg-slate-200/50 px-1 rounded dark:bg-slate-800">b</code>, <code className="font-mono bg-slate-200/50 px-1 rounded dark:bg-slate-800">c</code>, <code className="font-mono bg-slate-200/50 px-1 rounded dark:bg-slate-800">d</code>, <code className="font-mono bg-slate-200/50 px-1 rounded dark:bg-slate-800">pergjigja</code> (indeksi 0-3 ose shkronja A-D), dhe kolonën <code className="font-mono bg-slate-200/50 px-1 rounded dark:bg-slate-800">shpjegimi</code>.</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          Skedar i strukturuar JSON:
                        </p>
                        <p className="mt-0.5 font-medium">Një array JSON me objekte si: <code className="font-mono bg-slate-200/50 dark:bg-slate-800 block p-1 text-[9px] rounded mt-0.5 whitespace-pre-wrap">{JSON.stringify([{text: "Pyetje..", options: ["A", "B", "C", "D"], answer: 0, exp: "Shpjegim.."}])}</code></p>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold border-t border-slate-100 dark:border-slate-900 pt-2 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#1cb0f6] shrink-0" />
                      <span><strong>Dokumente (PDF, Word .docx, ose Text .txt):</strong> Ngarkoni skedarin tuaj PDF (ose format tjetër) që përmban pyetjet, alternativat, përgjigjet e sakta dhe shpjegimet. Inteligjenca Artificiale do të bëjë përpunimin e avancuar, do të gjejë saktë strukturën e pyetjeve, opsionet, çelësin e saktë dhe shpjegimet mjekësore apo fizike të detajuara, duke i vendosur automatikisht në bankën e pyetjeve!</span>
                    </div>
                  </div>

                  {/* Custom Prompt Instructions for single file */}
                  {singleFile && ['txt', 'docx', 'pdf'].includes(singleFile.name.split('.').pop()?.toLowerCase() || '') && (
                    <div className="animate-in fade-in duration-200">
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1 font-mono">Udhëzime shtesë për përpunimin me AI (Opcionale)</label>
                      <textarea
                        placeholder="P.sh. 'Pyetjet janë në anglisht, përktheji ato dhe shpjegimet mjekësore saktësisht në gjuhën shqipe'..."
                        value={pdfCustomPrompt}
                        onChange={(e) => setPdfCustomPrompt(e.target.value)}
                        className="w-full h-16 px-4 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs outline-none resize-none text-slate-800 dark:text-slate-200 font-bold focus:border-[#1cb0f6]"
                      />
                    </div>
                  )}

                  {/* Status indicator */}
                  {generationStatus && (
                    <div className={`p-4 rounded-xl text-xs flex gap-3 leading-relaxed items-center ${
                      isProcessingSingle
                        ? 'bg-sky-500/10 border-2 border-sky-500/20 text-sky-800 dark:text-sky-300'
                        : 'bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                    }`}>
                      {isProcessingSingle && <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin shrink-0" />}
                      <span className="font-bold">{generationStatus}</span>
                    </div>
                  )}

                  {/* Submit / Process Button */}
                  <button
                    type="button"
                    onClick={handleProcessSingleFile}
                    disabled={isProcessingSingle || !singleFile}
                    className="w-full py-3 bg-[#1cb0f6] hover:bg-[#1899d6] disabled:bg-slate-300 disabled:dark:bg-slate-800 text-white disabled:text-slate-500 rounded-xl text-xs font-black border-b-4 border-[#1899d6] active:translate-y-[2px] active:border-b-0 shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all uppercase tracking-wider disabled:border-b-0 disabled:translate-y-0"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isProcessingSingle ? 'Duke përpunuar skedarin...' : 'Përpuno dhe Nxirr Pyetjet'}
                  </button>
                </div>
              )}

              {pdfImportSuccessCount !== null && (
                <div className="bg-[#58cc02]/10 border-2 border-[#58cc02]/20 text-[#46a302] dark:text-emerald-300 p-5 rounded-2xl text-xs space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎉</span>
                    <div className="text-left">
                      <p className="font-black text-slate-800 dark:text-slate-100">Pyetjet u importuan me sukses!</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">U regjistruan {pdfImportSuccessCount} pyetje të reja në bazën tuaj të të dhënave.</p>
                    </div>
                  </div>
                  
                  {lastSavedQuestions.length > 0 && onStartQuizWithQuestions && (
                    <div className="pt-2 flex flex-wrap gap-2 text-left">
                      <button
                        type="button"
                        onClick={() => onStartQuizWithQuestions(lastSavedQuestions, 'Provimi Kombëtar (Importuar)', 'test')}
                        className="px-4 py-2 bg-[#58cc02] hover:bg-[#46a302] text-white rounded-xl text-[10px] font-black border-b-4 border-[#46a302] active:translate-y-[1px] active:border-b-0 cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        ⏱️ Fillo Provimin me Kohëmatës
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartQuizWithQuestions(lastSavedQuestions, 'Stërvitje e Importuar', 'train')}
                        className="px-4 py-2 bg-[#1cb0f6] hover:bg-[#1899d6] text-white rounded-xl text-[10px] font-black border-b-4 border-[#1899d6] active:translate-y-[1px] active:border-b-0 cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        🩺 Fillo Stërvitjen Klinike
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview Generated Questions */}
            {pdfGeneratedQuestions.length > 0 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                    Rishiko Pyetjet e Gjeneruara ({pdfGeneratedQuestions.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleSaveImportedQuestions}
                    className="py-2.5 px-5 bg-[#58cc02] hover:bg-[#46a302] text-white rounded-xl text-xs font-black border-b-4 border-[#46a302] active:translate-y-[2px] active:border-b-0 shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Ruaj të Përzgjedhurat
                  </button>
                </div>

                <div className="space-y-4">
                  {pdfGeneratedQuestions.map((q, idx) => {
                    const isEditingGen = editingGeneratedIdx === idx;
                    return (
                      <div key={idx} className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm relative space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        {isEditingGen ? (
                          <div className="space-y-4 w-full animate-in fade-in duration-200">
                            <div className="flex justify-between items-center">
                              <h4 className="text-xs font-black text-[#58cc02] uppercase tracking-wider font-mono">Modifiko Pyetjen #{idx + 1}</h4>
                              <span className="text-[10px] text-slate-400 font-bold">Pyetje e Gjeneruar</span>
                            </div>
                            
                            {/* Question Text */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Teksti i Pyetjes</label>
                              <textarea
                                value={editingGenText}
                                onChange={(e) => setEditingGenText(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold outline-none focus:border-[#58cc02] transition-colors"
                              />
                            </div>

                            {/* Options */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Opsionet (Kliko shkronjën për të zgjedhur të saktën)</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {['A', 'B', 'C', 'D'].map((label, oIdx) => (
                                  <div key={oIdx} className="flex items-center gap-2 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-white dark:bg-slate-950">
                                    <button
                                      type="button"
                                      onClick={() => setEditingGenAnswer(oIdx)}
                                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all cursor-pointer ${
                                        editingGenAnswer === oIdx
                                          ? 'bg-[#58cc02] text-white border-b-2 border-[#46a302]'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                    <input
                                      type="text"
                                      value={editingGenOpts[oIdx]}
                                      onChange={(e) => {
                                        const copy = [...editingGenOpts];
                                        copy[oIdx] = e.target.value;
                                        setEditingGenOpts(copy);
                                      }}
                                      className="w-full bg-transparent outline-none text-xs font-semibold text-slate-800 dark:text-slate-100"
                                      placeholder={`Shkruaj opsionin ${label}...`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Explanation */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Shpjegimi i Pyetjes</label>
                              <textarea
                                value={editingGenExp}
                                onChange={(e) => setEditingGenExp(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold outline-none focus:border-[#58cc02] transition-colors"
                                placeholder="Shpjegimi pse zgjidhja është e saktë..."
                              />
                            </div>

                            {/* Figure / Image Zone inside Edit Mode */}
                            <div className="mt-2.5">
                              {q.svgMarkup ? (
                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950/20 flex flex-col items-center justify-center mb-3">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">Skica Vektoriale (SVG)</span>
                                  <div 
                                    className="w-full flex items-center justify-center svg-container [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-[220px] [&>svg]:mx-auto text-slate-950"
                                    dangerouslySetInnerHTML={{ __html: q.svgMarkup }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPdfGeneratedQuestions((prev) =>
                                        prev.map((item, i) => (i === idx ? { ...item, svgMarkup: undefined } : item))
                                      );
                                      showToast('Skica vektoriale u hoq me sukses!', 'info');
                                    }}
                                    className="mt-2 px-3 py-1 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 rounded-lg text-[10px] font-black cursor-pointer"
                                  >
                                    Largo Figurinë 🗑️
                                  </button>
                                </div>
                              ) : q.imageUrl ? (
                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950/20 flex flex-col items-center justify-center mb-3">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">Figurë e lidhur</span>
                                  <img 
                                    src={q.imageUrl}
                                    alt="Figura e pyetjes"
                                    className="max-h-[220px] max-w-full object-contain rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm"
                                  />
                                  <div className="flex gap-2 mt-2.5">
                                    {q.pageNumber && pdfFile && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenManualCrop(q, idx, 'generated')}
                                        className="px-4 py-1.5 bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-slate-700 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:translate-y-[1px] cursor-pointer"
                                      >
                                        <Crop className="w-4 h-4 text-sky-500" /> Ndrysho Fokusin ✂️
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPdfGeneratedQuestions((prev) =>
                                          prev.map((item, i) => (i === idx ? { ...item, imageUrl: undefined } : item))
                                        );
                                        showToast('Imazhi u hoq me sukses!', 'info');
                                      }}
                                      className="px-4 py-1.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:translate-y-[1px] cursor-pointer"
                                    >
                                      Largo Figurën 🗑️
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col items-center justify-center mb-3">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">Imazhi / Figura e Pyetjes (Opsionale)</span>
                                  <div className="flex flex-wrap gap-2.5 justify-center mt-1">
                                    <div>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleGeneratedUploadLocalImage(e, idx)}
                                        className="hidden"
                                        id={`generated-image-upload-edit-${idx}`}
                                      />
                                      <label
                                        htmlFor={`generated-image-upload-edit-${idx}`}
                                        className="px-4 py-2 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-700 dark:text-slate-200 cursor-pointer text-center transition-all shadow-sm flex items-center gap-1.5"
                                      >
                                        <UploadCloud className="w-4 h-4 text-[#58cc02]" /> Ngarko JPG/PNG 📸
                                      </label>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPdfCroppingSource('generated_preview');
                                        setBulkCropIndex(idx);
                                        setIsPdfCroppingActive(true);
                                        showToast(`Prisni skicën nga PDF për pyetjen #${idx + 1}`, 'info');
                                      }}
                                      className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black shadow-sm cursor-pointer transition-colors border border-indigo-600 flex items-center gap-1.5"
                                    >
                                      <Crop className="w-4 h-4" /> Prisni nga PDF 📄✂️
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Save / Cancel buttons */}
                            <div className="flex justify-end gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setEditingGeneratedIdx(null)}
                                className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black cursor-pointer"
                              >
                                Anulo ✕
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!editingGenText.trim()) {
                                    showToast('Teksti i pyetjes nuk mund të jetë i zbrazët!', 'error');
                                    return;
                                  }
                                  setPdfGeneratedQuestions((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? {
                                            ...item,
                                            text: editingGenText,
                                            options: [...editingGenOpts],
                                            answer: editingGenAnswer,
                                            exp: editingGenExp,
                                          }
                                        : item
                                    )
                                  );
                                  setEditingGeneratedIdx(null);
                                  showToast('Pyetja u modifikua me sukses!', 'success');
                                }}
                                className="px-4 py-1.5 bg-[#58cc02] hover:bg-[#46a302] text-white rounded-xl text-xs font-black cursor-pointer shadow-sm border-b-2 border-[#46a302]"
                              >
                                Ruaj ✓
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex gap-2.5 items-start">
                                <span className="w-5 h-5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <p className="text-sm font-black text-slate-800 dark:text-slate-100 leading-relaxed">{q.text}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingGeneratedIdx(idx);
                                    setEditingGenText(q.text);
                                    setEditingGenOpts([...q.options]);
                                    setEditingGenAnswer(q.answer);
                                    setEditingGenExp(q.exp || '');
                                  }}
                                  className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-150 dark:border-sky-900/30 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0 shadow-sm"
                                >
                                  <Edit2 className="w-3.5 h-3.5" /> Modifiko ✏️
                                </button>
                                <input
                                  type="checkbox"
                                  checked={q.approved}
                                  onChange={() => {
                                    const updated = [...pdfGeneratedQuestions];
                                    updated[idx].approved = !updated[idx].approved;
                                    setPdfGeneratedQuestions(updated);
                                  }}
                                  className="w-5 h-5 accent-[#58cc02] border-2 border-slate-200 rounded focus:ring-[#58cc02] cursor-pointer shrink-0"
                                  title="Aprovo ose fshi nga importi"
                                />
                              </div>
                            </div>

                            {/* Options Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-7">
                              {q.options.map((opt, oIdx) => {
                                const isCorrect = oIdx === q.answer;
                                return (
                                  <div
                                    key={oIdx}
                                    className={`p-2.5 rounded-xl text-xs border-2 flex items-center justify-between ${
                                      isCorrect
                                        ? 'bg-[#58cc02]/10 border-[#58cc02]/30 text-[#46a302] dark:text-emerald-400 font-bold'
                                        : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    <span>
                                      <span className="font-mono font-bold mr-1.5">{'ABCD'[oIdx]})</span>
                                      {opt}
                                    </span>
                                    {isCorrect && <Check className="w-3.5 h-3.5 text-[#58cc02] shrink-0 ml-1" />}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Explanation */}
                            {q.svgMarkup ? (
                              <div className="pl-7 pt-1 animate-in zoom-in-95 duration-200">
                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center mb-3">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">Skica Vektoriale (SVG)</span>
                                  <div 
                                    className="w-full flex items-center justify-center svg-container [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-[220px] [&>svg]:mx-auto"
                                    dangerouslySetInnerHTML={{ __html: q.svgMarkup }}
                                  />
                                </div>
                              </div>
                            ) : q.imageUrl ? (
                              <div className="pl-7 pt-1 animate-in zoom-in-95 duration-200">
                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center mb-3">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">Figurë e lidhur</span>
                                  <img 
                                    src={q.imageUrl}
                                    alt="Figura e pyetjes"
                                    className="max-h-[220px] max-w-full object-contain rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm"
                                  />
                                  <div className="flex gap-2 mt-2.5">
                                    {q.pageNumber && pdfFile && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenManualCrop(q, idx, 'generated')}
                                        className="px-4 py-1.5 bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-slate-700 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:translate-y-[1px] cursor-pointer animate-in fade-in"
                                      >
                                        <Crop className="w-4 h-4 text-sky-500" /> Ndrysho Fokusin ✂️
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPdfGeneratedQuestions((prev) =>
                                          prev.map((item, i) => (i === idx ? { ...item, imageUrl: undefined } : item))
                                        );
                                        showToast('Imazhi u hoq me sukses!', 'info');
                                      }}
                                      className="px-4 py-1.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:translate-y-[1px] cursor-pointer animate-in fade-in"
                                    >
                                      Largo Figurën 🗑️
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="pl-7 pt-1">
                                <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col items-center justify-center mb-3">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">Imazhi / Figura e Pyetjes (Opsionale)</span>
                                  <div className="flex flex-wrap gap-2.5 justify-center mt-1">
                                    <div>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleGeneratedUploadLocalImage(e, idx)}
                                        className="hidden"
                                        id={`generated-image-upload-${idx}`}
                                      />
                                      <label
                                        htmlFor={`generated-image-upload-${idx}`}
                                        className="px-4 py-2 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-700 dark:text-slate-200 cursor-pointer text-center transition-all shadow-sm flex items-center gap-1.5"
                                      >
                                        <UploadCloud className="w-4 h-4 text-[#58cc02]" /> Ngarko JPG/PNG 📸
                                      </label>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPdfCroppingSource('generated_preview');
                                        setBulkCropIndex(idx);
                                        setIsPdfCroppingActive(true);
                                        showToast(`Prisni skicën nga PDF për pyetjen #${idx + 1}`, 'info');
                                      }}
                                      className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black shadow-sm cursor-pointer transition-colors border border-indigo-600 flex items-center gap-1.5"
                                    >
                                      <Crop className="w-4 h-4" /> Prisni nga PDF 📄✂️
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="pl-7 pt-1">
                              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                <strong className="text-amber-600 dark:text-amber-400 font-bold block mb-1">Shpjegimi i AI:</strong>
                                {q.exp}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveImportedQuestions}
                    className="py-3 px-6 bg-[#58cc02] hover:bg-[#46a302] text-white rounded-xl text-xs font-black border-b-4 border-[#46a302] active:translate-y-[2px] active:border-b-0 shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Ruaj të Përzgjedhurat në Sistem
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SUBPANEL: REPORTS */}
        {activePanel === 'reports' && (
          <section className="animate-in fade-in duration-150 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Raportimet e Gabimeve</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Shikoni dhe korrigjoni direkt pyetjet ku studentët kanë raportuar mospërputhje ose dyshime.
                </p>
              </div>
            </div>

            {reports.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center">
                <div className="text-4xl mb-2">🎉</div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">Nuk ka asnjë raportim!</h3>
                <p className="text-xs text-slate-400 mt-1">Të gjitha pyetjet janë të konfirmuara ose të pa-raportuara nga studentët.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => {
                  const isEditingThis = editingReportedQ && editingReportedQ.id === report.questionId;
                  
                  return (
                    <div
                      key={report.id}
                      className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-md">
                            Kategoria: {report.categoryName}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                            Tema: {report.topicName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          Data: {report.timestamp}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider font-mono mb-1">Teksti i pyetjes origjinale:</h4>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
                          {report.questionText}
                        </p>
                      </div>

                      <div className="bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-xl p-3">
                        <strong className="text-xs font-black text-rose-600 dark:text-rose-400 block mb-1">⚠️ Mesazhi i studentit (Arsyeja):</strong>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{report.reason}</p>
                      </div>

                      {isEditingThis && editingReportedQ ? (
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                          <h4 className="text-xs font-black text-[#1cb0f6] uppercase tracking-wider font-mono">Modifiko Pyetjen Direkt</h4>
                          
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Teksti i Pyetjes</label>
                            <textarea
                              rows={2}
                              value={editingReportedQ.text}
                              onChange={(e) => setEditingReportedQ({ ...editingReportedQ, text: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none focus:border-[#1cb0f6] text-slate-800 dark:text-slate-200"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {editingReportedQ.options.map((opt, oIdx) => (
                              <div key={oIdx}>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  Opsioni {'ABCD'[oIdx]} {editingReportedQ.answer === oIdx ? '★ (ZGJIDHET SI E SAKTË)' : ''}
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const nextOpts = [...editingReportedQ.options];
                                      nextOpts[oIdx] = e.target.value;
                                      setEditingReportedQ({ ...editingReportedQ, options: nextOpts });
                                    }}
                                    className="flex-1 px-3 py-1.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none focus:border-[#1cb0f6] text-slate-800 dark:text-slate-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditingReportedQ({ ...editingReportedQ, answer: oIdx })}
                                    className={`px-3 rounded-xl text-xs font-black border-2 border-b-4 transition-all active:translate-y-[1px] ${
                                      editingReportedQ.answer === oIdx
                                        ? 'bg-[#58cc02] border-[#46a302] text-white'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                                    }`}
                                    title="Zgjidh si të saktë"
                                  >
                                    Saktë
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Shpjegimi Klinik/Akademik</label>
                            <textarea
                              rows={2}
                              value={editingReportedQ.exp}
                              onChange={(e) => setEditingReportedQ({ ...editingReportedQ, exp: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none focus:border-[#1cb0f6] text-slate-800 dark:text-slate-200"
                            />
                          </div>

                          <div className="flex gap-3 pt-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingReportedQ(null)}
                              className="py-1.5 px-3.5 rounded-xl border-2 border-b-4 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-black text-slate-500 transition-all active:translate-y-[1px]"
                            >
                              Anulo
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveReportedQuestionEdit(report.id)}
                              className="py-1.5 px-4 bg-[#58cc02] hover:bg-[#46a302] text-white border-b-4 border-[#46a302] active:translate-y-[1px] text-xs font-black transition-all shadow-sm flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Ruaj Korrigjimin
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3 pt-2 justify-end">
                          <button
                            type="button"
                            onClick={() => handleResolveReport(report.id)}
                            className="py-1.5 px-3 rounded-xl border-2 border-b-4 border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-black transition-all active:translate-y-[1px]"
                            title="Refuzo raportimin nëse është i pasaktë"
                          >
                            Refuzo/Fshi Raportin
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditReportedQuestion(report)}
                            className="py-1.5 px-4 bg-[#1cb0f6] hover:bg-[#1899d6] text-white border-b-4 border-[#1899d6] active:translate-y-[1px] text-xs font-black rounded-xl transition-all shadow-sm flex items-center gap-1"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Korrigjo Pyetjen
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* SUBPANEL: CONCURRENCY SIMULATION */}
        {activePanel === 'simulation' && (
          <section className="animate-in fade-in duration-150 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Activity className="w-5 h-5 text-sky-500 animate-pulse" />
                  Simulimi i Ngarkesës (100 Përdorues)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Shikoni dhe testoni në kohë reale se si sillet aplikacioni nën fluksin e 100+ studentëve njëkohësisht.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSimulating(!isSimulating);
                    if (!isSimulating) {
                      showToast("Simulimi i 100 përdoruesve u aktivizua!", "success");
                    } else {
                      showToast("Simulimi u ndalua.", "info");
                    }
                  }}
                  className={`py-2 px-4 rounded-xl border-2 border-b-4 text-xs font-black transition-all active:translate-y-[1px] flex items-center gap-1.5 ${
                    isSimulating
                      ? 'bg-rose-500 hover:bg-rose-600 border-rose-700 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700 text-white'
                  }`}
                >
                  <Activity className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
                  {isSimulating ? "Ndalo Simulimin" : "Fillo Simulimin 100 Userë"}
                </button>
              </div>
            </div>

            {/* Architecture Explanation Banner */}
            <div className="bg-sky-500/10 border-2 border-sky-500/20 text-sky-950 dark:text-sky-300 p-5 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-black text-sm text-sky-700 dark:text-sky-400">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                Arkitekturë e Optimizuar: Pse 100+ përdorues kanë ngarkesë 0% në server?
              </div>
              <p className="leading-relaxed font-medium">
                Ky aplikacion është ndërtuar me konceptin <strong>Client-Side First (SPA)</strong>. Të gjitha pyetjet, kategoritë dhe asetet ngarkohen <strong>vetëm një herë</strong> në shfletues. Çdo thirrje e kuizit, përgjigje, matje kohe, përllogaritje e Spaced Repetition (algoritmi SM2) dhe ruajtje e progresit kryhet <strong>direkt në pajisjen e përdoruesit</strong> duke përdorur memorie lokale (Zustand &amp; LocalStorage).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="bg-white/40 dark:bg-slate-900/30 p-2.5 rounded-xl border border-sky-500/10">
                  <span className="font-bold block text-sky-600 dark:text-sky-400">0% CPU e Serverit</span>
                  Serveri nuk kryen asnjë kalkulim për çdo përgjigje të përdoruesit.
                </div>
                <div className="bg-white/40 dark:bg-slate-900/30 p-2.5 rounded-xl border border-sky-500/10">
                  <span className="font-bold block text-sky-600 dark:text-sky-400">0 € Kosto e Databazës</span>
                  Nuk ka thirrje të vazhdueshme në databazë për çdo klikim apo vlerësim.
                </div>
                <div className="bg-white/40 dark:bg-slate-900/30 p-2.5 rounded-xl border border-sky-500/10">
                  <span className="font-bold block text-sky-600 dark:text-sky-400">&lt; 1ms Vonesë (Latency)</span>
                  Tranzicionet janë të menjëhershme sepse gjithçka ndodh lokalisht.
                </div>
              </div>
            </div>

            {/* Infrastructure Real-time Health Monitor Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm text-center relative overflow-hidden">
                {isSimulating && <span className="absolute top-2 right-2 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
                <span className="text-2xl font-black text-sky-500 block font-mono">{isSimulating ? simStats.activeCount : 0}</span>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block mt-1">Studentë Aktivë</span>
              </div>

              <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm text-center">
                <span className="text-2xl font-black text-emerald-500 block font-mono">{isSimulating ? `${simStats.cpuLoad}%` : "0.00%"}</span>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block mt-1">CPU e Serverit</span>
              </div>

              <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm text-center">
                <span className="text-2xl font-black text-[#ff9600] block font-mono">{simStats.totalAnswers}</span>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block mt-1">Përgjigje të Simuluara</span>
              </div>

              <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm text-center">
                <span className="text-2xl font-black text-[#58cc02] block font-mono">
                  {simStats.totalAnswers > 0 ? `${Math.round((simStats.totalCorrect / simStats.totalAnswers) * 100)}%` : "0%"}
                </span>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block mt-1">Saktësia e Përgjithshme</span>
              </div>
            </div>

            {/* Interactive Concurrency / Load Calculator */}
            <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Kalkulatori i Fluksit &amp; Ngarkesës Teorike
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lëvizni rrëshqitësin për të parë se si do të reagonte infrastruktura nën flukse të ndryshme përdoruesish.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-400">Përdorues në të njëjtën sekondë:</span>
                  <span className="text-sky-500 font-mono font-black text-sm">{simUsersCount} përdorues</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="1000"
                  step="5"
                  value={simUsersCount}
                  onChange={(e) => setSimUsersCount(+e.target.value)}
                  className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#1cb0f6]"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">CPU Serveri</span>
                  <span className="font-black text-slate-800 dark:text-slate-200 block font-mono mt-0.5">&lt; 0.01 %</span>
                  <span className="text-[9px] text-emerald-500 font-semibold block mt-0.5">Fiks/I palëvizur</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Bandwidth (Ngarkimi i Parë)</span>
                  <span className="font-black text-slate-800 dark:text-slate-200 block font-mono mt-0.5">{(simUsersCount * 0.45).toFixed(1)} MB</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Zgjidhet me Cloud Run/CDN</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Koha e Përgjigjes</span>
                  <span className="font-black text-slate-800 dark:text-slate-200 block font-mono mt-0.5">&lt; 1 ms</span>
                  <span className="text-[9px] text-emerald-500 font-semibold block mt-0.5">E menjëhershme</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Kosto e Databazës</span>
                  <span className="font-black text-slate-800 dark:text-slate-200 block font-mono mt-0.5">0.00 €</span>
                  <span className="text-[9px] text-emerald-500 font-semibold block mt-0.5">Plotësisht Falas</span>
                </div>
              </div>
            </div>

            {/* Live activity and simulated user directory side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Live Terminal Log Stream */}
              <div className="bg-slate-900 border-2 border-b-4 border-slate-950 p-5 rounded-2xl shadow-sm flex flex-col h-[350px]">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono">Live Activity Stream (Terminal)</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">{isSimulating ? "PO MBLIDHEN TË DHËNAT..." : "SIMULIMI I NDALUAR"}</span>
                </div>

                <div className="flex-1 overflow-y-auto font-mono text-[10px] text-emerald-400 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
                  {!isSimulating && (
                    <div className="text-slate-500 text-center py-12">
                      Shtypni butonin "Fillo Simulimin" për të parë aktivitetin live të 100 përdoruesve klinikë...
                    </div>
                  )}
                  {isSimulating && simLogs.map((log, idx) => (
                    <div key={idx} className="animate-in fade-in slide-in-from-bottom-1 duration-100 whitespace-pre-wrap leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              {/* Simulated active users list */}
              <div className="bg-white dark:bg-slate-900 border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col h-[350px]">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono">Studentët Aktivë në Këtë Sekondë</span>
                  <span className="text-[9px] font-mono text-slate-500">Maks. 100</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 pr-1">
                  {!isSimulating ? (
                    <div className="text-slate-400 text-center py-12 text-xs font-medium">
                      Nuk ka studentë aktivë për momentin.
                    </div>
                  ) : (
                    simUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 hover:border-sky-200 dark:hover:border-sky-900 transition-all text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-[#58cc02]/15 text-[#46a302] font-black text-[10px] flex items-center justify-center border-b-2 border-[#46a302]/30 shrink-0 select-none uppercase">
                            {user.name.split(" ").slice(1).join(" ").substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-slate-800 dark:text-slate-200 truncate">{user.name}</div>
                            <div className="text-[10px] text-slate-400 truncate font-semibold">{user.status}</div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 pl-2">
                          <div className="font-mono font-bold text-[#58cc02]">{user.score} ✓</div>
                          <div className="text-[9px] font-mono text-slate-400">{user.lastActive}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Edit Individual Question Modal Overlay */}
      {editingQ && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-2 border-b-8 border-slate-300 dark:border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl transition-all animate-in zoom-in-95 duration-150 my-8">
            <div className="flex justify-between items-center border-b pb-3 border-slate-150 dark:border-slate-800 mb-4">
              <h3 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-sky-500" /> Ndrysho Pyetjen
              </h3>
              <button
                type="button"
                onClick={() => setEditingQ(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
              {/* Category & Topic select */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Kategoria</label>
                  <select
                    value={editQCatId}
                    onChange={(e) => {
                      setEditQCatId(e.target.value);
                      setEditQTopicId('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold"
                  >
                    <option value="">— Pa Kategori —</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tema</label>
                  <select
                    value={editQTopicId}
                    onChange={(e) => setEditQTopicId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold"
                  >
                    <option value="">— Pa Temë —</option>
                    {topics
                      .filter((t) => !editQCatId || t.catId === editQCatId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Teksti i Pyetjes</label>
                <textarea
                  rows={3}
                  value={editQText}
                  onChange={(e) => setEditQText(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs outline-none font-semibold leading-relaxed"
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Opsionet e përgjigjes <span className="font-normal text-slate-400">(Kliko shkronjën për të zgjedhur të saktën)</span>
                </label>
                {editQOpts.map((opt, oIdx) => {
                  const isCorr = editCorrectIdx === oIdx;
                  return (
                    <div key={oIdx} className="flex gap-2.5 items-center">
                      <button
                        type="button"
                        onClick={() => setEditCorrectIdx(oIdx)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs border-2 border-b-4 transition-all select-none active:translate-y-[1px] ${
                          isCorr
                            ? 'bg-[#58cc02] border-[#46a302] text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                        }`}
                      >
                        {'ABCD'[oIdx]}
                      </button>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const copy = [...editQOpts];
                          copy[oIdx] = e.target.value;
                          setEditQOpts(copy);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-semibold outline-none"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Shpjegimi</label>
                <textarea
                  rows={3}
                  value={editQExp}
                  onChange={(e) => setEditQExp(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs outline-none font-semibold leading-relaxed"
                />
              </div>

              {/* Figure / Image paste & edit zone */}
              <div className="bg-slate-50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono block">Skica / Figura e Pyetjes (Screenshot)</span>
                
                {editQSvgMarkup ? (
                  <div className="flex flex-col sm:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-150 dark:border-slate-850">
                    <div 
                      className="max-h-24 max-w-[160px] rounded-lg bg-slate-50 border p-2 flex items-center justify-center overflow-hidden [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-20 [&>svg]:mx-auto text-slate-950"
                      dangerouslySetInnerHTML={{ __html: editQSvgMarkup }}
                    />
                    <div className="text-center sm:text-left space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-500">Figurë vektoriale (SVG) e lidhur me pyetjen.</p>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <button
                          type="button"
                          onClick={() => setEditQSvgMarkup('')}
                          className="py-1 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg text-[10px] font-black transition-colors"
                        >
                          Fshij Figurinë Vektoriale
                        </button>
                      </div>
                    </div>
                  </div>
                ) : editQImageUrl ? (
                  <div className="flex flex-col sm:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-150 dark:border-slate-850">
                    <img
                      src={editQImageUrl}
                      alt="Question diagram"
                      className="max-h-24 max-w-[160px] rounded-lg object-contain bg-slate-50 border"
                    />
                    <div className="text-center sm:text-left space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-500">Imazh raster i lidhur me pyetjen.</p>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <button
                          type="button"
                          onClick={() => setIsCroppingEdit(true)}
                          className="py-1 px-2.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-600 rounded-lg text-[10px] font-black transition-colors flex items-center gap-1"
                        >
                          <Crop className="w-3 h-3" /> Prit Imazhin ✂️
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditQImageUrl('')}
                          className="py-1 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg text-[10px] font-black transition-colors"
                        >
                          Fshij Imazhin
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                              const rawBase64 = ev.target?.result as string;
                              const base64 = await compressImageToLightweightJPEG(rawBase64, 1000, 0.82);
                              setEditQImageUrl(base64);
                              showToast('Imazhi i ri u ngarkua me sukses! 📸', 'success');
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
                      }}
                      className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-sky-400 p-4 rounded-xl text-center cursor-pointer text-xs font-bold text-slate-600 bg-white dark:bg-slate-900"
                    >
                      <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      Ngarko një skicë të re, ose shtyp <kbd className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[9px] font-mono font-bold border">Ctrl+V</kbd> për të bërë paste një screenshot të kopjuar!
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="h-[1px] bg-slate-200 dark:bg-slate-800 flex-1"></div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ose</span>
                      <div className="h-[1px] bg-slate-200 dark:bg-slate-800 flex-1"></div>
                    </div>

                    <button
                      type="button"
                      onClick={() => startPdfCropper('edit_question', null)}
                      className="w-full py-2 bg-sky-500 hover:bg-sky-600 text-white font-black text-xs rounded-xl border-b-4 border-sky-700 active:translate-y-[1px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Crop className="w-3.5 h-3.5" /> Prit (Crop) Figurinë nga skedar PDF 📄
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6 border-t pt-4 border-slate-150 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingQ(null)}
                className="px-4 py-2.5 rounded-xl border-2 border-b-4 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 text-xs font-black transition-all active:translate-y-[1px]"
              >
                Anulo
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editQText.trim()) { showToast('Shkruani tekstin e pyetjes.', 'warn'); return; }
                  if (editQOpts.some(o => !o.trim())) { showToast('Plotësoni të gjitha alternativat.', 'warn'); return; }
                  
                  const edited: Question = {
                    ...editingQ,
                    catId: editQCatId,
                    topicId: editQTopicId,
                    text: editQText.trim(),
                    options: [...editQOpts],
                    answer: editCorrectIdx,
                    exp: editQExp.trim() || undefined,
                    imageUrl: editQImageUrl || undefined,
                    svgMarkup: editQSvgMarkup || undefined
                  };
                  handleSaveQuestionEdit(edited);
                }}
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white border-b-4 border-sky-700 active:translate-y-[1px] text-xs font-black transition-all"
              >
                Ruaj Përditësimet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation/Prompt Modal Overlay */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-2 border-b-8 border-slate-300 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl transition-all animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-950 dark:text-white leading-tight">
              {confirmModal.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              {confirmModal.message}
            </p>

            {/* Prompt validation field if expected */}
            {confirmModal.promptExpected && (
              <div className="mt-4">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  {confirmModal.promptPlaceholder || 'Konfirmo duke shkruar:'}
                </label>
                <input
                  type="text"
                  value={confirmModal.promptValue || ''}
                  onChange={(e) => setConfirmModal(prev => ({ ...prev, promptValue: e.target.value }))}
                  placeholder={confirmModal.promptExpected}
                  className="w-full px-3 py-2 text-xs border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl focus:border-rose-500 outline-none font-bold"
                />
              </div>
            )}

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 rounded-xl border-2 border-b-4 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 text-xs font-black transition-all active:translate-y-[1px]"
              >
                {confirmModal.cancelText || 'Anulo'}
              </button>
              <button
                type="button"
                disabled={confirmModal.promptExpected !== undefined && confirmModal.promptValue !== confirmModal.promptExpected}
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className={`px-5 py-2.5 rounded-xl text-white border-b-4 text-xs font-black transition-all active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed ${
                  confirmModal.isDanger
                    ? 'bg-rose-500 hover:bg-rose-600 border-rose-700'
                    : 'bg-sky-500 hover:bg-sky-600 border-sky-700'
                }`}
              >
                {confirmModal.confirmText || 'Vazhdo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop Modal for New Question Image */}
      {isCroppingNew && newQImageUrl && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-2 border-b-8 border-slate-300 dark:border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl transition-all animate-in zoom-in-95 duration-150 my-8">
            <div className="flex justify-between items-center border-b pb-3 border-slate-150 dark:border-slate-800 mb-4">
              <h3 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-2">
                <Crop className="w-5 h-5 text-emerald-500" /> Prit Figurinën (Crop) — Pyetje e Re
              </h3>
              <button
                type="button"
                onClick={() => setIsCroppingNew(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <ImageCropper
              imageSrc={newQImageUrl}
              onCrop={(cropped) => {
                setNewQImageUrl(cropped);
                setIsCroppingNew(false);
                showToast('Imazhi u prit me sukses! ✂️✨', 'success');
              }}
              onCancel={() => setIsCroppingNew(false)}
            />
          </div>
        </div>
      )}

      {/* Crop Modal for Editing Question Image */}
      {isCroppingEdit && editQImageUrl && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-2 border-b-8 border-slate-300 dark:border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl transition-all animate-in zoom-in-95 duration-150 my-8">
            <div className="flex justify-between items-center border-b pb-3 border-slate-150 dark:border-slate-800 mb-4">
              <h3 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-2">
                <Crop className="w-5 h-5 text-emerald-500" /> Prit Figurinën (Crop) — Ndrysho Pyetjen
              </h3>
              <button
                type="button"
                onClick={() => setIsCroppingEdit(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <ImageCropper
              imageSrc={editQImageUrl}
              onCrop={(cropped) => {
                setEditQImageUrl(cropped);
                setIsCroppingEdit(false);
                showToast('Imazhi u prit me sukses! ✂️✨', 'success');
              }}
              onCancel={() => setIsCroppingEdit(false)}
            />
          </div>
        </div>
      )}

      {/* Visual PDF Page Cropper and AI Generator Modal */}
      {isPdfCroppingActive && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-2 border-b-8 border-slate-300 dark:border-slate-800 rounded-3xl p-6 w-full max-w-5xl md:max-w-6xl shadow-2xl transition-all animate-in zoom-in-95 duration-150 my-4 flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b pb-3 border-slate-150 dark:border-slate-800 shrink-0">
              <h3 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-2">
                <Crop className="w-5 h-5 text-[#58cc02]" /> Prerësi Vizual i PDF-së (I Përmirësuar) 📄✨
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsPdfCroppingActive(false);
                  setCroppedPdfImageResult('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden py-4 pr-1 min-h-[350px] flex flex-col">
              
              {/* Case 1: No PDF page rendered yet -> Show Upload Dropzone */}
              {!pdfPageImageUrl && !isRenderingPdfPage ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950/30 text-center flex-1">
                  <UploadCloud className="w-12 h-12 text-slate-400 mb-3 animate-bounce" />
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200">Zgjidhni një dokument PDF për të filluar prerjen vizuale</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">Zgjedhja e një PDF do t'ju lejojë të lundroni faqet dhe të prisni skica ose pyetje direkt prej tyre.</p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPdfFile(file);
                        renderPdfPage(file, 1);
                      }
                    }}
                    className="hidden"
                    id="cropper-pdf-upload"
                  />
                  <label
                    htmlFor="cropper-pdf-upload"
                    className="mt-4 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-black text-xs rounded-xl border-b-4 border-sky-700 cursor-pointer transition-all active:translate-y-[1px]"
                  >
                    Ngarko PDF 📄
                  </label>
                </div>
              ) : (
                /* Case 2: PDF is rendering or rendered */
                <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
                  
                  {/* Left Sidebar - Navigation & Dynamic Quality Scale */}
                  <div className="w-full md:w-60 shrink-0 flex flex-col gap-3.5 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 overflow-y-auto max-h-[300px] md:max-h-none">
                    <div className="text-xs font-black uppercase text-slate-400 font-mono flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" /> Lundro Faqet
                    </div>
                    
                    {/* Quick Page Jump Search */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Kërko faqen (p.sh. 5)..."
                        value={pdfPageSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPdfPageSearchQuery(val);
                          const num = parseInt(val);
                          if (num >= 1 && num <= cropPdfNumPages && pdfFile) {
                            renderPdfPage(pdfFile, num);
                          }
                        }}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 transition-colors"
                      />
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    </div>

                    {/* Scale Resolution quality options */}
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-black uppercase text-slate-400 font-mono flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Rezolucioni i Renditjes:
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {([
                          { label: 'Fast', scale: 1.2 },
                          { label: 'Normal', scale: 2.0 },
                          { label: 'Sharp', scale: 3.0 }
                        ]).map((opt) => (
                          <button
                            key={opt.scale}
                            type="button"
                            onClick={() => {
                              setPdfRenderScale(opt.scale);
                              if (pdfFile) {
                                renderPdfPage(pdfFile, cropPdfCurrentPage, opt.scale);
                              }
                            }}
                            className={`py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border cursor-pointer text-center transition-colors ${
                              pdfRenderScale === opt.scale
                                ? 'bg-[#58cc02] text-white border-[#46a302]'
                                : 'bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-slate-200 dark:border-slate-800'
                            }`}
                            title={`${opt.label} (${opt.scale}x Scale)`}
                          >
                            {opt.scale}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* All pages quick select list */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-3">
                      <div className="text-[10px] font-black uppercase text-slate-400 font-mono mb-1.5">
                        Faqet e Dokumentit ({cropPdfNumPages}):
                      </div>
                      <div className="grid grid-cols-4 md:grid-cols-3 gap-1.5">
                        {Array.from({ length: cropPdfNumPages }).map((_, i) => {
                          const pageNum = i + 1;
                          const isActive = pageNum === cropPdfCurrentPage;
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => {
                                if (pdfFile) renderPdfPage(pdfFile, pageNum);
                              }}
                              className={`py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-sky-500 text-white border-sky-600 shadow-sm scale-105'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Work Area */}
                  <div className="flex-1 flex flex-col overflow-y-auto space-y-4 pr-1">
                    {croppedPdfImageResult ? (
                      <div className="space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="p-3 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-center">
                          <div className="text-center space-y-2 w-full">
                            <span className="text-[10px] font-mono font-black text-slate-400 block uppercase">Pamja e Prerë (Cropped Output)</span>
                            <img
                              src={croppedPdfImageResult}
                              alt="Cropped result"
                              className="max-h-[35vh] rounded-lg border shadow-md bg-white mx-auto object-contain"
                            />
                          </div>
                        </div>

                        {/* Prompt input for Gemini extraction if PDF Panel source */}
                        {pdfCroppingSource === 'pdf_panel' && (
                          <div className="space-y-1 bg-sky-50/50 dark:bg-sky-950/10 p-3.5 rounded-2xl border border-sky-100 dark:border-sky-900/30">
                            <label className="text-[10px] font-black uppercase text-sky-600 tracking-wider flex items-center gap-1.5 font-mono">
                              <Sparkles className="w-3.5 h-3.5" /> Udhëzime AI për Ekstraktimin (Opsionale)
                            </label>
                            <input
                              type="text"
                              placeholder="p.sh. Ky është një problem matematikor, ekstraktone me LaTeX..."
                              value={imagePrompt}
                              onChange={(e) => setImagePrompt(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl outline-none"
                            />
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => setCroppedPdfImageResult('')}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black cursor-pointer"
                          >
                            Kthehu te Faqja ↩️
                          </button>

                          {/* Action 1: Link as diagram directly to the question fields */}
                          <button
                            type="button"
                            onClick={() => {
                              if (pdfCroppingSource === 'new_question') {
                                setNewQImageUrl(croppedPdfImageResult);
                                showToast('Imazhi u lidh si skicë për pyetjen e re! 📸', 'success');
                              } else if (pdfCroppingSource === 'edit_question') {
                                setEditQImageUrl(croppedPdfImageResult);
                                showToast('Imazhi u lidh si skicë e re për ndryshimin! 📸', 'success');
                              } else if (pdfCroppingSource === 'bulk_preview' && bulkCropIndex !== null) {
                                setBulkPreviewData((prev) =>
                                  prev.map((item, i) => (i === bulkCropIndex ? { ...item, imageUrl: croppedPdfImageResult } : item))
                                );
                                showToast(`Figurina u lidh me pyetjen #${bulkCropIndex + 1}! 📸`, 'success');
                              } else if (pdfCroppingSource === 'generated_preview' && bulkCropIndex !== null) {
                                setPdfGeneratedQuestions((prev) =>
                                  prev.map((item, i) => (i === bulkCropIndex ? { ...item, imageUrl: croppedPdfImageResult } : item))
                                );
                                showToast(`Figurina u lidh me pyetjen #${bulkCropIndex + 1}! 📸`, 'success');
                              } else {
                                // If from main pdf panel, we populate new question image
                                setNewQImageUrl(croppedPdfImageResult);
                                setBulkImportTab('txt'); // switch to single question tab
                                setActivePanel('questions');
                                showToast('Imazhi u vendos si skicë në formularin e pyetjes së re!', 'success');
                              }
                              setIsPdfCroppingActive(false);
                              setCroppedPdfImageResult('');
                            }}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black shadow-sm cursor-pointer"
                          >
                            Lidh si Figurë/Skicë 🖼️
                          </button>

                          {/* Action 2: Explain that AI OCR is not supported in the static/GitHub Pages environment */}
                          <button
                            type="button"
                            onClick={() => {
                              showToast('Gjenerimi me Inteligjencë Artificiale (OCR) nuk mbështetet në versionin statik të GitHub Pages. Ju lutemi përdorni butonin "Lidh si Figurë" dhe shkruani pyetjen vetë.', 'info');
                            }}
                            className="px-5 py-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                          >
                            Gjenerimi me AI (Nuk mbështetet offline) ❌
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display PDF page navigation & interactive ImageCropper */
                      <div className="space-y-4">
                        {/* Nav bar */}
                        <div className="flex flex-wrap items-center justify-between bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={cropPdfCurrentPage <= 1 || isRenderingPdfPage}
                              onClick={() => {
                                if (pdfFile) renderPdfPage(pdfFile, cropPdfCurrentPage - 1);
                              }}
                              className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 disabled:opacity-40 text-xs font-bold cursor-pointer"
                            >
                              ◀ Para
                            </button>
                            
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                              <span>Faqja</span>
                              <input
                                type="number"
                                min="1"
                                max={cropPdfNumPages}
                                value={cropPdfCurrentPage}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (val >= 1 && val <= cropPdfNumPages && pdfFile) {
                                    renderPdfPage(pdfFile, val);
                                  }
                                }}
                                className="w-12 px-1.5 py-1 text-center bg-white dark:bg-slate-800 border rounded-md"
                              />
                              <span>nga {cropPdfNumPages}</span>
                            </div>

                            <button
                              type="button"
                              disabled={cropPdfCurrentPage >= cropPdfNumPages || isRenderingPdfPage}
                              onClick={() => {
                                if (pdfFile) renderPdfPage(pdfFile, cropPdfCurrentPage + 1);
                              }}
                              className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 disabled:opacity-40 text-xs font-bold cursor-pointer"
                            >
                              Tjetër ▶
                            </button>
                          </div>

                          {/* Fast document switcher button */}
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setPdfFile(file);
                                  renderPdfPage(file, 1);
                                }
                              }}
                              className="hidden"
                              id="cropper-pdf-change-inline"
                            />
                            <label
                              htmlFor="cropper-pdf-change-inline"
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-250 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase rounded-lg cursor-pointer transition-colors"
                            >
                              Ndrysho PDF 📄
                            </label>

                            <div className="text-[10px] font-mono font-bold text-slate-500 truncate max-w-[150px] sm:max-w-xs" title={pdfFile?.name}>
                              Skedari: {pdfFile?.name || 'Ska skedar'}
                            </div>
                          </div>
                        </div>

                        {/* Render stage */}
                        <div className="relative min-h-[350px] bg-slate-900 rounded-2xl flex items-center justify-center p-2 border border-slate-200 dark:border-slate-800">
                          {isRenderingPdfPage ? (
                            <div className="absolute inset-0 bg-slate-950/60 flex flex-col items-center justify-center z-10 text-white rounded-2xl">
                              <div className="w-8 h-8 border-4 border-t-transparent border-sky-400 rounded-full animate-spin mb-2" />
                              <p className="text-xs font-bold font-mono">Duke vizatuar faqen {cropPdfCurrentPage}...</p>
                            </div>
                          ) : null}

                          {pdfPageImageUrl ? (
                            <div className="w-full">
                              <ImageCropper
                                imageSrc={pdfPageImageUrl}
                                onCrop={(cropped) => {
                                  setCroppedPdfImageResult(cropped);
                                  showToast('Zgjedhja u bë me sukses! Tani zgjidhni një veprim për këtë pjesë.', 'info');
                                }}
                                onCancel={() => {
                                  setIsPdfCroppingActive(false);
                                }}
                              />
                            </div>
                          ) : (
                            <div className="text-white text-xs font-semibold">Duke pritur vizatimin e faqes ose ngarkimin e skedarit.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Focus / Crop Adjustment Modal */}
      {manualCropTarget && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-2 border-b-8 border-slate-300 dark:border-slate-800 rounded-3xl p-6 w-full max-w-3xl shadow-2xl transition-all animate-in zoom-in-95 duration-150 my-4 flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b pb-3 border-slate-150 dark:border-slate-800 shrink-0">
              <h3 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-2">
                <Crop className="w-5 h-5 text-sky-500" /> Rregullo Fokusin e Imazhit (Manual Focus)
              </h3>
              <button
                type="button"
                onClick={() => setManualCropTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 min-h-[300px] flex flex-col">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {manualCropTarget.pageNumber && pdfFile ? (
                  <span>Lëvizni ose ndryshoni përmasat e kornizës së prerjes mbi faqen <strong>{manualCropTarget.pageNumber}</strong> të PDF për të rregulluar fokusin e skicës së pyetjes. Klikoni <strong>Prit & Ruaj</strong> për të aplikuar ndryshimet.</span>
                ) : (
                  <span>Ju po rregulloni manualisht prerjen e imazhit ekzistues. Klikoni <strong>Prit & Ruaj</strong> për të aplikuar ndryshimet.</span>
                )}
              </p>

              <div className="relative min-h-[350px] bg-slate-900 rounded-2xl flex items-center justify-center p-2 border border-slate-200 dark:border-slate-800">
                {isRenderingManualCropPage ? (
                  <div className="absolute inset-0 bg-slate-950/60 flex flex-col items-center justify-center z-10 text-white rounded-2xl">
                    <div className="w-8 h-8 border-4 border-t-transparent border-sky-400 rounded-full animate-spin mb-2" />
                    <p className="text-xs font-bold font-mono">Duke vizatuar faqen e PDF...</p>
                  </div>
                ) : null}

                {manualCropTarget.baseImage ? (
                  <div className="w-full">
                    <ImageCropper
                      imageSrc={manualCropTarget.baseImage}
                      initialCrop={manualCropTarget.initialCrop}
                      onCrop={(cropped, cropPercent) => {
                        handleSaveManualCrop(cropped, cropPercent);
                      }}
                      onCancel={() => {
                        setManualCropTarget(null);
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-white text-xs font-semibold">Duke pritur ngarkimin e imazhit...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay when opening manual crop */}
      {isRenderingManualCropPage && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-xs z-50 flex flex-col items-center justify-center text-white">
          <div className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-black tracking-wide font-mono">Duke përgatitur faqen e PDF-së për fokusim... ✂️</p>
        </div>
      )}
    </div>
  );
};
