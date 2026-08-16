import { Category, Question, SRCard, ThemeName, Topic, UserProgress, QuestionReport } from '../types';
import { SEED_CATEGORIES, SEED_QUESTIONS, SEED_TOPICS } from '../data/seed';

// IndexedDB core engine for high-volume storage (supporting 7k+ questions with rich explanations)
const DB_NAME = 'MjekHyrjeDB';
const DB_VERSION = 1;
const STORE_NAME = 'questions_store';

export const initIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined') {
        throw new Error("Nuk jemi në kontekstin e dritares (window).");
      }
      
      let idb: IDBFactory | undefined;
      try {
        idb = window.indexedDB || (window as any).mozIndexedDB || (window as any).webkitIndexedDB || (window as any).msIndexedDB;
      } catch (e) {
        throw new Error("Aksesi tek window.indexedDB u refuzua: " + String(e));
      }

      if (!idb) {
        throw new Error("IndexedDB nuk mbështetet në këtë mjedis.");
      }

      const request = idb.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        } catch (err) {
          reject(err);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Dështoi hapja e IndexedDB."));
    } catch (err) {
      reject(err);
    }
  });
};

export const getIDBValue = <T>(key: string): Promise<T | null> => {
  return initIndexedDB()
    .then((db) => {
      return new Promise<T | null>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const request = store.get(key);
          request.onsuccess = () => resolve((request.result as T) || null);
          request.onerror = () => reject(request.error);
        } catch (err) {
          reject(err);
        }
      });
    })
    .catch((err) => {
      console.warn(`[IndexedDB] error getting key "${key}":`, err);
      return null;
    });
};

export const setIDBValue = <T>(key: string, val: T): Promise<void> => {
  return initIndexedDB()
    .then((db) => {
      return new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const request = store.put(val, key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } catch (err) {
          reject(err);
        }
      });
    })
    .catch((err) => {
      console.warn(`[IndexedDB] error setting key "${key}":`, err);
    });
};

// Safe LocalStorage helpers
export const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`[storage] Error reading key "${key}" from localStorage:`, e);
    return null;
  }
};

export const safeSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[storage] Error writing key "${key}" to localStorage:`, e);
  }
};

export const safeRemoveItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[storage] Error removing key "${key}" from localStorage:`, e);
  }
};

export const ld = <T>(key: string, defaultVal: T): T => {
  try {
    const item = safeGetItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (e) {
    console.warn(`[storage] Error reading ${key}:`, e);
    return defaultVal;
  }
};

export const sv = <T>(key: string, val: T): boolean => {
  try {
    safeSetItem(key, JSON.stringify(val));
    return true;
  } catch (e) {
    console.warn(`[storage] Error saving ${key}:`, e);
    return false;
  }
};

export const getTheme = (): ThemeName => {
  const t = safeGetItem('nsp_theme') as ThemeName;
  if (t === 'green' || t === 'navy' || t === 'osmosis' || t === 'teal') return t;
  return 'teal';
};

export const setTheme = (theme: ThemeName) => {
  safeSetItem('nsp_theme', theme);
  document.documentElement.setAttribute('data-theme', theme === 'teal' ? '' : theme);
  if (theme === 'osmosis') {
    document.documentElement.style.setProperty('--surface', '#FFFFFF');
  } else {
    document.documentElement.style.removeProperty('--surface');
  }
};

export const getDarkMode = (): boolean => {
  const m = safeGetItem('nsp_mode');
  if (m === 'dark') return true;
  if (m === 'light') return false;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    return false;
  }
};

export const setDarkMode = (dark: boolean) => {
  safeSetItem('nsp_mode', dark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light');
};

export const getDailyLimit = (): number => {
  const lim = parseInt(safeGetItem('nsp_limit') || '100', 10);
  return Math.min(Math.max(isNaN(lim) ? 100 : lim, 1), 500);
};

export const setDailyLimit = (lim: number) => {
  const clean = Math.min(Math.max(lim, 1), 500);
  safeSetItem('nsp_limit', String(clean));
};

// In-memory caches to prevent redundant JSON parsing & localStorage reads
let cachedQuestions: Question[] | null = null;
let cachedCategories: Category[] | null = null;
let cachedTopics: Topic[] | null = null;

// Pack Question to compact array format to save ~60% of localStorage space
// Property order: id, catId, topicId, text, options, answer, exp, imageUrl, svgMarkup, pageNumber, figureCrop
export const packQuestions = (qs: Question[]): any[] => {
  return qs.map(q => [
    q.id,
    q.catId,
    q.topicId,
    q.text,
    q.options,
    q.answer,
    q.exp,
    q.imageUrl || '',
    q.svgMarkup || '',
    q.pageNumber || null,
    q.figureCrop || null
  ]);
};

// Unpack compact array format back to Question objects
export const unpackQuestions = (packed: any[]): Question[] => {
  if (!Array.isArray(packed)) return [];
  if (packed.length > 0 && !Array.isArray(packed[0])) {
    // If it is already in the expanded object format (legacy or seed data)
    return (packed as unknown as Question[]).map(q => {
      let catId = q.catId;
      if (catId === 'c1_kimia') catId = 'c1';
      if (catId === 'c2_biologjia') catId = 'c2';
      if (catId === 'c3_fizika') catId = 'c3';
      return { ...q, catId };
    });
  }
  return packed.map(p => {
    let catId = p[1];
    if (catId === 'c1_kimia') catId = 'c1';
    if (catId === 'c2_biologjia') catId = 'c2';
    if (catId === 'c3_fizika') catId = 'c3';
    const qObj: Question = {
      id: p[0],
      catId,
      topicId: p[2],
      text: p[3],
      options: p[4],
      answer: p[5],
      exp: p[6]
    };
    if (p[7]) qObj.imageUrl = p[7];
    if (p[8]) qObj.svgMarkup = p[8];
    if (p[9] !== undefined && p[9] !== null) qObj.pageNumber = p[9];
    if (p[10]) qObj.figureCrop = p[10];
    return qObj;
  });
};

// Extremely efficient O(k) selection of k random elements out of N total elements
export function getRandomSubset<T>(arr: T[], count: number): T[] {
  const result: T[] = [];
  const len = arr.length;
  if (len === 0 || count <= 0) return result;
  
  if (count >= len) {
    // Fisher-Yates shuffle the copy of the whole array
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Set of chosen indices to pick unique elements
  const chosenIndices = new Set<number>();
  while (chosenIndices.size < count) {
    const r = Math.floor(Math.random() * len);
    chosenIndices.add(r);
  }
  
  for (const idx of chosenIndices) {
    result.push(arr[idx]);
  }
  return result;
}

export const getCategories = (): Category[] => {
  if (cachedCategories) return cachedCategories;
  let cats = ld<Category[]>('nsp_cats', []);

  const targetMap: Record<string, { name: string; color: string }> = {
    c1: { name: 'Kimia', color: '#3B82F6' },
    c2: { name: 'Biologjia', color: '#10B981' },
    c3: { name: 'Fizika', color: '#EF4444' },
  };

  // If there are no categories, initialize them
  if (!cats || !cats.length) {
    sv('nsp_cats', SEED_CATEGORIES);
    cachedCategories = SEED_CATEGORIES;
    return SEED_CATEGORIES;
  }

  // Safely map/rename categories without wiping anything!
  let modified = false;
  const updatedCats: Category[] = [];
  
  // Keep only c1, c2, c3
  for (const id of ['c1', 'c2', 'c3']) {
    const oldId = id === 'c1' ? 'c1_kimia' : id === 'c2' ? 'c2_biologjia' : 'c3_fizika';
    const existing = cats.find(c => c.id === id || c.id === oldId);
    const target = targetMap[id];
    
    if (existing) {
      if (existing.id !== id || existing.name !== target.name || existing.color !== target.color) {
        updatedCats.push({ id, name: target.name, color: target.color });
        modified = true;
      } else {
        updatedCats.push(existing);
      }
    } else {
      updatedCats.push({ id, name: target.name, color: target.color });
      modified = true;
    }
  }

  if (cats.length !== updatedCats.length || modified) {
    sv('nsp_cats', updatedCats);
    cats = updatedCats;
  }

  cachedCategories = cats;
  return cats;
};

export const saveCategories = (cats: Category[]) => {
  cachedCategories = cats;
  sv('nsp_cats', cats);
  publishToServerStore(undefined, cats, undefined).catch(() => {});
};

export const getTopics = (): Topic[] => {
  getCategories(); // force migration check first

  // Explicit one-time wipe of topics requested by the user
  if (!safeGetItem('nsp_topics_wiped_v2')) {
    safeSetItem('nsp_topics_wiped_v2', '1');
    safeRemoveItem('nsp_topics');
    cachedTopics = [];
    sv('nsp_topics', []);
    return [];
  }

  if (cachedTopics) return cachedTopics;
  let topics = ld<Topic[]>('nsp_topics', []);

  // Clean up/migrate any topics pointing to 'c1_kimia', 'c2_biologjia', 'c3_fizika'
  let modified = false;
  const migratedTopics = topics.map(t => {
    let catId = t.catId;
    if (catId === 'c1_kimia') { catId = 'c1'; modified = true; }
    if (catId === 'c2_biologjia') { catId = 'c2'; modified = true; }
    if (catId === 'c3_fizika') { catId = 'c3'; modified = true; }
    return { ...t, catId };
  });

  if (modified || !topics.length) {
    const finalTopics = topics.length ? migratedTopics : SEED_TOPICS;
    sv('nsp_topics', finalTopics);
    topics = finalTopics;
  }

  cachedTopics = topics;
  return topics;
};

export const saveTopics = (topics: Topic[]) => {
  cachedTopics = topics;
  sv('nsp_topics', topics);
  publishToServerStore(undefined, undefined, topics).catch(() => {});
};

export const publishToServerStore = async (
  qs?: Question[],
  cats?: Category[],
  tops?: Topic[]
): Promise<boolean> => {
  try {
    const payload = {
      questions: qs || getQuestions(),
      categories: cats || getCategories(),
      topics: tops || getTopics(),
    };
    const res = await fetch('/api/shared-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return false;
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.warn('[Server Sync] Publish failed:', err);
    return false;
  }
};

export const syncWithServerStore = async (): Promise<{ questions: Question[]; categories: Category[]; topics: Topic[] } | null> => {
  try {
    const res = await fetch('/api/shared-data');
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return null;
    const data = await res.json();
    if (!data || !data.success) return null;

    let updatedQuestions = false;
    let updatedCategories = false;
    let updatedTopics = false;

    const localQs = getQuestions();
    const localCats = getCategories();
    const localTops = getTopics();

    // Merge categories
    let mergedCats = [...localCats];
    if (data.categories && Array.isArray(data.categories)) {
      data.categories.forEach((serverCat: Category) => {
        if (!mergedCats.some(c => c.id === serverCat.id)) {
          mergedCats.push(serverCat);
          updatedCategories = true;
        }
      });
    }

    // Merge topics
    let mergedTops = [...localTops];
    if (data.topics && Array.isArray(data.topics)) {
      data.topics.forEach((serverTopic: Topic) => {
        if (!mergedTops.some(t => t.id === serverTopic.id)) {
          mergedTops.push(serverTopic);
          updatedTopics = true;
        }
      });
    }

    // Merge questions
    let mergedQs = [...localQs];
    const existingQIds = new Set(localQs.map(q => q.id));
    const existingQTexts = new Set(localQs.map(q => (q.text || '').trim().toLowerCase()));

    if (data.questions && Array.isArray(data.questions)) {
      data.questions.forEach((serverQ: Question) => {
        const normText = (serverQ.text || '').trim().toLowerCase();
        if (!existingQIds.has(serverQ.id) && !existingQTexts.has(normText)) {
          mergedQs.push(serverQ);
          existingQIds.add(serverQ.id);
          existingQTexts.add(normText);
          updatedQuestions = true;
        }
      });
    }

    if (updatedCategories) {
      cachedCategories = mergedCats;
      sv('nsp_cats', mergedCats);
    }
    if (updatedTopics) {
      cachedTopics = mergedTops;
      sv('nsp_topics', mergedTops);
    }
    if (updatedQuestions) {
      cachedQuestions = mergedQs;
      const packed = packQuestions(mergedQs);
      setIDBValue('nsp_qs_compact', packed).catch(() => {});
    }

    return {
      questions: mergedQs,
      categories: mergedCats,
      topics: mergedTops,
    };
  } catch (err) {
    console.warn('[Server Sync] Fetch failed:', err);
    return null;
  }
};

export const preloadQuestions = async (): Promise<Question[]> => {
  getCategories(); // force migration check first to clear old data if necessary

  // Seed Versioning - Automatically refreshes IndexedDB on new manual releases
  const CURRENT_SEED_VERSION = 'v5_figures_final_fix';
  const hasMigrated = safeGetItem('nsp_7k_migration_v2') === 'true';
  const activeSeedVersion = safeGetItem('nsp_seed_version');

  if (!hasMigrated || activeSeedVersion !== CURRENT_SEED_VERSION) {
    safeSetItem('nsp_7k_migration_v2', 'true');
    safeSetItem('nsp_seed_version', CURRENT_SEED_VERSION);
    safeSetItem('nsp_topics_wiped_v2', '1'); // bypass legacy topic wipe
    cachedQuestions = SEED_QUESTIONS;
    const packedSeed = packQuestions(SEED_QUESTIONS);
    await setIDBValue('nsp_qs_compact', packedSeed);
    saveTopics(SEED_TOPICS);
    try {
      safeRemoveItem('nsp_qs_compact');
      safeRemoveItem('nsp_qs');
    } catch (e) {}

    setTimeout(() => {
      if (cachedQuestions) optimizeStoredBase64Questions(cachedQuestions).catch(() => {});
    }, 1500);

    return SEED_QUESTIONS;
  }

  if (cachedQuestions && cachedQuestions !== SEED_QUESTIONS) {
    setTimeout(() => {
      if (cachedQuestions) optimizeStoredBase64Questions(cachedQuestions).catch(() => {});
    }, 1500);
    return cachedQuestions;
  }

  try {
    const compactRaw = await getIDBValue<any[]>('nsp_qs_compact');
    if (compactRaw && compactRaw.length > 0) {
      cachedQuestions = unpackQuestions(compactRaw);
      setTimeout(() => {
        if (cachedQuestions) optimizeStoredBase64Questions(cachedQuestions).catch(() => {});
      }, 1500);
      return cachedQuestions;
    }
  } catch (err) {
    console.warn('[storage] IndexedDB load failed, falling back to localStorage...', err);
  }

  // Fallback to localStorage compact
  const compactRaw = ld<any[]>('nsp_qs_compact', null as any);
  if (compactRaw && compactRaw.length > 0) {
    cachedQuestions = unpackQuestions(compactRaw);
    // Asynchronously save to IndexedDB so it's ready next time
    setIDBValue('nsp_qs_compact', compactRaw).catch(() => {});
    setTimeout(() => {
      if (cachedQuestions) optimizeStoredBase64Questions(cachedQuestions).catch(() => {});
    }, 1500);
    return cachedQuestions;
  }

  // Fallback to legacy format
  const legacy = ld<Question[]>('nsp_qs', []);
  if (legacy && legacy.length > 0) {
    cachedQuestions = legacy;
    const packed = packQuestions(legacy);
    setIDBValue('nsp_qs_compact', packed).catch(() => {});
    try {
      safeRemoveItem('nsp_qs');
    } catch (e) {}
    setTimeout(() => {
      if (cachedQuestions) optimizeStoredBase64Questions(cachedQuestions).catch(() => {});
    }, 1500);
    return cachedQuestions;
  }

  // Default to SEED_QUESTIONS
  cachedQuestions = SEED_QUESTIONS;
  const packedSeed = packQuestions(SEED_QUESTIONS);
  setIDBValue('nsp_qs_compact', packedSeed).catch(() => {});
  try {
    if (SEED_QUESTIONS.length < 1500) {
      sv('nsp_qs_compact', packedSeed);
    } else {
      safeRemoveItem('nsp_qs_compact');
    }
  } catch (e) {}

  setTimeout(() => {
    if (cachedQuestions) optimizeStoredBase64Questions(cachedQuestions).catch(() => {});
  }, 1500);

  return cachedQuestions;
};

export const getQuestions = (): Question[] => {
  if (cachedQuestions) return cachedQuestions;

  // Try loading compact format synchronously from localStorage first
  const compactRaw = ld<any[]>('nsp_qs_compact', null as any);
  if (compactRaw) {
    cachedQuestions = unpackQuestions(compactRaw);
    return cachedQuestions;
  }

  // Fallback to legacy expanded format
  const legacy = ld<Question[]>('nsp_qs', []);
  if (legacy && legacy.length > 0) {
    cachedQuestions = legacy;
    return cachedQuestions;
  }

  // If neither, load seed questions
  cachedQuestions = SEED_QUESTIONS;
  return cachedQuestions;
};

export const saveQuestions = (qs: Question[]) => {
  cachedQuestions = qs;
  const packed = packQuestions(qs);

  // 1. Asynchronously save to IndexedDB (completely safe for 7,000+ items, no 5MB limit!)
  setIDBValue('nsp_qs_compact', packed).catch((err) => {
    console.error('[storage] Failed to save questions to IndexedDB:', err);
  });

  // 2. Safely try saving to localStorage for smaller sets to remain backward compatible,
  // but avoid QuotaExceededError or slow loads for larger datasets.
  try {
    if (qs.length < 1500) {
      sv('nsp_qs_compact', packed);
    } else {
      // Clear localStorage copy to free up space, as IndexedDB is now the primary storage
      safeRemoveItem('nsp_qs_compact');
    }
  } catch (e) {
    console.warn('[storage] LocalStorage quota exceeded, saved to IndexedDB only.', e);
    try {
      safeRemoveItem('nsp_qs_compact');
    } catch (err) {}
  }

  // Publish to global server store so all app users receive updated questions
  publishToServerStore(qs, undefined, undefined).catch(() => {});
};

// Background helper to compress and resize any excessively large base64 images to lightweight JPEGs
export const compressImageToLightweightJPEG = (base64Str: string, maxDimension = 1000, quality = 0.82): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith('data:image')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      
      // Resize if too big (keeps proportions and makes sure we don't save massive images)
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      
      // Paint white background to prevent black margins in transparent PNGs exported to JPEG
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

// Background helper to compress massive base64 images to lightweight JPEGs
export const optimizeStoredBase64Questions = async (qs: Question[]) => {
  let modified = false;
  const updated = await Promise.all(qs.map(async (q) => {
    // If we have an image that is base64 and has a large footprint (> 60KB in string length)
    if (q.imageUrl && q.imageUrl.startsWith('data:image') && q.imageUrl.length > 60000) {
      try {
        const compressed = await compressImageToLightweightJPEG(q.imageUrl, 1000, 0.82);
        if (compressed !== q.imageUrl && compressed.length < q.imageUrl.length) {
          modified = true;
          return { ...q, imageUrl: compressed };
        }
      } catch (err) {
        console.warn('Failed to compress base64 image on the fly:', err);
      }
    }
    return q;
  }));

  if (modified) {
    console.log('[storage] Automatically compressed and optimized base64 images inside the questions database!');
    saveQuestions(updated);
  }
};

export const getDefaultProgress = (): UserProgress => ({
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
});

export const getProgress = (): UserProgress => {
  const def = getDefaultProgress();
  const stored = ld<UserProgress>('nsp_prog', def);
  return { ...def, ...stored };
};

export const saveProgress = (prog: UserProgress) => {
  sv('nsp_prog', prog);
};

// Check and maintain streaks & unlock limits
export const syncDailyState = (prog: UserProgress): UserProgress => {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toDateString();

  let p = { ...prog };

  // Check streak freeze
  if (p.lastAnswerDate && p.lastAnswerDate === twoDaysAgo && p.streak > 0 && p.streakFreezes > 0) {
    p.streakFreezes--;
    p.lastAnswerDate = yesterday; // pretend they practiced yesterday
  }

  // Check unlock date
  if (p.lastUnlockDate !== today) {
    const totalQ = getQuestions().length || 500;
    p.unlockedUpTo = Math.min((p.unlockedUpTo || 0) + getDailyLimit(), totalQ);

    // Regen 1 streak freeze weekly
    const lastRegen = safeGetItem('nsp_freeze_regen') || '';
    const weekAgo = new Date(Date.now() - 7 * 86400000).toDateString();
    if (!lastRegen || new Date(lastRegen) <= new Date(weekAgo)) {
      p.streakFreezes = Math.min((p.streakFreezes || 0) + 1, 3);
      safeSetItem('nsp_freeze_regen', today);
    }
    p.lastUnlockDate = today;

    // Reset streak if missed more than yesterday
    if (p.lastAnswerDate && p.lastAnswerDate !== yesterday && p.lastAnswerDate !== today) {
      p.streak = 0;
    }
  }

  saveProgress(p);
  return p;
};

// Spaced Repetition (SM-2) Engine
export const getNewSRCard = (): SRCard => ({
  interval: 1,
  ef: 2.5,
  reps: 0,
  nextReview: 0,
  lapses: 0,
});

export const sm2Update = (card: SRCard, quality: number, applyFuzz = true): SRCard => {
  const c = { ...card };
  
  // Backwards compatibility for lapses
  if (c.lapses === undefined) {
    c.lapses = 0;
  }

  // Improved Anki-grade SM-2 Scheduling Logic
  if (quality === 0) {
    // RED (Sërisht): Forgotten
    c.reps = 0;
    c.interval = 1;
    // Penalty to Ease Factor (EF)
    c.ef = Math.max(1.3, c.ef - 0.2);
    c.lapses += 1;
  } else if (quality === 1) {
    // ORANGE (Vështirë): Struggle / Hard correct
    c.reps = Math.max(1, c.reps);
    c.interval = Math.max(1, Math.round(c.interval * 1.2));
    // Moderate decrease in EF
    c.ef = Math.max(1.3, c.ef - 0.15);
  } else if (quality === 2) {
    // BLUE (Mirë): Good / Normal correct
    if (c.reps === 0) {
      c.interval = 1;
    } else if (c.reps === 1) {
      c.interval = 6;
    } else {
      c.interval = Math.round(c.interval * c.ef);
    }
    c.reps++;
    // Minimal change to EF (kept steady/slightly positive)
    c.ef = Math.max(1.3, c.ef + 0.05);
  } else {
    // GREEN (Lehtë): Easy correct
    if (c.reps === 0) {
      c.interval = 4;
    } else if (c.reps === 1) {
      c.interval = 8;
    } else {
      c.interval = Math.round(c.interval * c.ef * 1.3); // 30% Easy Bonus
    }
    c.reps++;
    // Boost EF
    c.ef = Math.min(3.0, c.ef + 0.15);
  }

  // Dynamic scatter / clumping protection (fuzz factor) for intervals >= 3 days
  if (applyFuzz && c.interval >= 3) {
    let fuzzRange = 0;
    if (c.interval <= 5) {
      fuzzRange = 1; // +/- 1 day
    } else if (c.interval <= 15) {
      fuzzRange = 2; // +/- 2 days
    } else {
      fuzzRange = Math.round(c.interval * 0.1); // +/- 10%
    }
    
    // Deterministic random selection for that update
    const fuzz = Math.floor(Math.random() * (fuzzRange * 2 + 1)) - fuzzRange;
    c.interval = Math.max(1, c.interval + fuzz);
  }

  // Safeguard: Maximum interval of 365 days (1 year) to ensure it eventually comes back
  if (c.interval > 365) {
    c.interval = 365;
  }

  const startOfDay = new Date().setHours(0, 0, 0, 0);
  c.nextReview = startOfDay + c.interval * 86400000;
  return c;
};

export const formatInterval = (days: number): string => {
  if (days <= 0) return 'nesër';
  if (days === 1) return '1 ditë';
  if (days < 7) return `${days} ditë`;
  if (days < 30) return `${Math.round(days / 7)} javë`;
  return `${Math.round(days / 30)} muaj`;
};

export const getSRDueQuestions = (allQ: Question[], srCards: Record<string, SRCard>): Question[] => {
  const now = Date.now();
  const due = allQ.filter(q => srCards[q.id] && srCards[q.id].nextReview <= now);
  return due;
};

export interface PredictiveLoadPoint {
  dayName: string;
  dateStr: string;
  count: number;
}

export const getPredictiveStudyLoad = (
  allQ: Question[],
  srCards: Record<string, SRCard>
): PredictiveLoadPoint[] => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();
  
  const dayNames = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'];
  const result: PredictiveLoadPoint[] = [];
  
  for (let i = 1; i <= 7; i++) {
    const targetDayMs = startOfTodayMs + i * 86400000;
    const targetDate = new Date(targetDayMs);
    const dayName = dayNames[targetDate.getDay()];
    
    // Count how many questions are due up to (and including) this day
    const count = allQ.filter(q => {
      const card = srCards[q.id];
      if (!card) return false;
      return card.nextReview <= targetDayMs;
    }).length;
    
    result.push({
      dayName,
      dateStr: `${targetDate.getDate()}/${targetDate.getMonth() + 1}`,
      count
    });
  }
  
  return result;
};

// Exam Readiness Engine calculation
export const calculateReadiness = (prog: UserProgress, totalQ: number) => {
  if (prog.totalDone < 10) return { score: 0, acc: 0, coverage: 0, label: 'Fillo stërvitjen', color: '#64748B', days: 14 };
  const acc = prog.totalDone > 0 ? Math.round((prog.totalCorrect / prog.totalDone) * 100) : 0;
  const cap = Math.min(totalQ, 500);
  const coverage = cap > 0 ? Math.round((Math.min(prog.totalDone, cap) / cap) * 100) : 0;
  const score = Math.round(acc * 0.85 + coverage * 0.15);

  let label = '';
  let color = '';
  let days = 0;
  if (score >= 85) { label = 'Gati për provim!'; color = '#22C55E'; days = 0; }
  else if (score >= 70) { label = 'Afër — edhe 1-2 javë'; color = '#F59E0B'; days = Math.ceil((85 - score) / 3); }
  else if (score >= 50) { label = 'Po afrohesh — 3-4 javë'; color = '#0096C7'; days = Math.ceil((85 - score) / 2.5); }
  else { label = 'Duhen 5+ javë studim'; color = '#EF4444'; days = Math.ceil((85 - score) / 2); }

  return { score, acc, coverage, label, color, days };
};

// Simple one-way non-reversible hash function for admin password protection
export const simpleHash = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return "h_" + Math.abs(hash).toString(36);
};

// Check admin password
export const verifyAdminPassword = (pwd: string): boolean => {
  const customPwd = safeGetItem('nsp_admin_pwd');
  const hashedInput = simpleHash(pwd);
  if (customPwd) {
    if (customPwd.startsWith('h_')) {
      return hashedInput === customPwd;
    } else {
      // Automatically migrate plain text password to hashed format
      const hashed = simpleHash(customPwd);
      safeSetItem('nsp_admin_pwd', hashed);
      return pwd === customPwd;
    }
  }
  return pwd === 'admin123';
};

export const setAdminPassword = (newPwd: string) => {
  const hashed = simpleHash(newPwd);
  safeSetItem('nsp_admin_pwd', hashed);
  safeSetItem('nsp_pwd_customized', '1');
};

export const isPasswordDefault = (): boolean => {
  return safeGetItem('nsp_pwd_customized') !== '1';
};

// Question Report Storage helpers
export const getReportedQuestions = (): QuestionReport[] => {
  try {
    const data = safeGetItem('nsp_reports');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveReportedQuestions = (reports: QuestionReport[]) => {
  try {
    safeSetItem('nsp_reports', JSON.stringify(reports));
  } catch (e) {}
};

export const addQuestionReport = (
  questionId: string,
  questionText: string,
  categoryName: string,
  topicName: string,
  reason: string
): QuestionReport => {
  const reports = getReportedQuestions();
  const newReport: QuestionReport = {
    id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    questionId,
    questionText,
    categoryName,
    topicName,
    reason,
    timestamp: Date.now(),
    status: 'pending'
  };
  reports.push(newReport);
  saveReportedQuestions(reports);
  return newReport;
};

export const exportBackupJSON = () => {
  const prog = getProgress();
  const data = {
    version: 1,
    exported: new Date().toISOString(),
    progress: prog,
    appName: 'Mjek Hyrje',
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mjek-hyrje-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
