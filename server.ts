import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import mammoth from "mammoth";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body limit to handle larger base64 PDFs
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Lazy initialize Gemini client on server to prevent crashes on startup if the API key is missing
  let aiClient: GoogleGenAI | null = null;
  function getAI(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Çelësi API i Gemini nuk është konfiguruar ose është i pavlefshëm. Ju lutemi shkoni te Settings > Secrets dhe shtoni GEMINI_API_KEY.");
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiClient;
  }

  // Offline / local question parser to process text/docx when Gemini API key is missing or not provided
  function localParseQuestions(rawText: string): { parsed: any[]; errors: string[] } {
    const parsed: any[] = [];
    const errors: string[] = [];

    if (!rawText || !rawText.trim()) {
      return { parsed, errors };
    }

    const normalizedText = rawText
      .replace(/\r/g, '')
      .replace(/\u200B/g, '')
      .replace(/\u00A0/g, ' ');

    const splitSideBySideOptions = (line: string): string[] => {
      const hasMultiple = 
        (/A[\.\)]/i.test(line) && /B[\.\)]/i.test(line)) ||
        (/B[\.\)]/i.test(line) && /C[\.\)]/i.test(line)) ||
        (/C[\.\)]/i.test(line) && /D[\.\)]/i.test(line));

      if (!hasMultiple) return [line];

      return line
        .replace(/\s+([B-Db-d])([\.\)\-\/–\:]\s*|\s+)(?=\S)/g, '\n$1$2')
        .split('\n');
    };

    const rawLines = normalizedText.split('\n');
    const lines: string[] = [];
    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      const splitLines = splitSideBySideOptions(trimmed);
      for (const sl of splitLines) {
        lines.push(sl.trim());
      }
    }

    let currentQuestionText = '';
    let currentOptions: { letter: string; text: string }[] = [];
    let currentAnswerIdx = -1;
    let currentExplanation = '';
    let currentImageUrl = '';
    let inExplanationMode = false;
    let inQuestionMode = false;

    const saveCurrentQuestion = () => {
      if (!currentQuestionText.trim()) return;

      let cleanQText = currentQuestionText.trim();
      let oldLength = 0;
      while (cleanQText.length !== oldLength) {
        oldLength = cleanQText.length;
        cleanQText = cleanQText
           .replace(/^[\s•\*\-\▪\▫\◦\■\□\●\○\♦\◊\u2022\u2023\u2043\s]+/, '')
           .replace(/^\[?Rasti\s+Klinik\s+#?\d+\]?[:\s\-]*/i, '')
           .replace(/^Pyetj[aeë]\s*\d+[\s\.\:\-]*/i, '')
           .replace(/^Q\d+[\.\:\)]\s*/i, '')
           .replace(/^\d+[\.\)\s\-]+\s*/, '')
           .trim();
      }

      if (!cleanQText) {
        cleanQText = 'Pyetje pa titull';
      }

      const finalOptions = ['', '', '', ''];
      currentOptions.forEach((o) => {
        const idx = 'ABCD'.indexOf(o.letter.toUpperCase());
        if (idx >= 0 && idx < 4) {
          finalOptions[idx] = o.text.trim();
        }
      });

      const nonEmpties = finalOptions.filter(Boolean);
      if (nonEmpties.length < 4 && currentOptions.length >= 2) {
        for (let i = 0; i < Math.min(4, currentOptions.length); i++) {
          if (!finalOptions[i] && currentOptions[i]) {
            finalOptions[i] = currentOptions[i].text.trim();
          }
        }
      }

      for (let i = 0; i < 4; i++) {
        if (!finalOptions[i] || !finalOptions[i].trim()) {
          finalOptions[i] = `Opsioni ${'ABCD'[i]}`;
        }
      }

      if (currentAnswerIdx === -1) {
        currentOptions.forEach((o) => {
          if (/\(e\s*sakt[eë]\)/i.test(o.text) || /\(sakt[eë]\)/i.test(o.text) || /\*\*+/i.test(o.text) || /✓/.test(o.text)) {
            const idx = 'ABCD'.indexOf(o.letter.toUpperCase());
            if (idx >= 0 && idx < 4) {
              currentAnswerIdx = idx;
            }
          }
        });
      }

      if (currentAnswerIdx === -1) {
        currentAnswerIdx = 0;
      }

      if (!currentExplanation.trim()) {
        currentExplanation = 'Ky sqarim ose arsyetim vlerëson konceptet kryesore të pyetjes përkatëse.';
      }

      parsed.push({
        text: cleanQText,
        options: finalOptions,
        answer: currentAnswerIdx,
        exp: currentExplanation.trim(),
        imageUrl: currentImageUrl || undefined
      });

      currentQuestionText = '';
      currentOptions = [];
      currentAnswerIdx = -1;
      currentExplanation = '';
      currentImageUrl = '';
      inExplanationMode = false;
      inQuestionMode = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let cleanLine = line.trim();

      const isNoiseLine = 
        /^\s*Termokimia\s+dhe\s+Kinetika\s*$/i.test(cleanLine) ||
        /^\s*Pyetje,\s*Përgjigje\s+dhe\s+Shpjegime.*$/i.test(cleanLine) ||
        /^\s*Page\s+\d+.*$/i.test(cleanLine) ||
        /^\s*\d+\s*of\s*\d+\s*$/i.test(cleanLine) ||
        /^\s*-\s*\d+\s*-\s*$/.test(cleanLine) ||
        /^\s*\d+\s*$/.test(cleanLine);
        
      if (isNoiseLine) continue;

      cleanLine = cleanLine.replace(/^[\s•\*\▪\▫\◦\■\□\●\○\♦\◊\u2022\u2023\u2043]+\s*/, '');
      cleanLine = cleanLine.replace(/^\-\s*(?!\d)/, '');

      const imgMatch = cleanLine.match(/(?:\[)?(?:imazhi|figura|figurë|image|skicë|vizatim|foto)\s*[:=]\s*([^\]\r\n]+)(?:\])?/i);
      if (imgMatch) {
        currentImageUrl = imgMatch[1].trim();
        cleanLine = cleanLine.replace(/(?:\[)?(?:imazhi|figura|figurë|image|skicë|vizatim|foto)\s*[:=]\s*([^\]\r\n]+)(?:\])?/i, '').trim();
        if (!cleanLine) continue;
      }

      const optMatch = cleanLine.match(/^\s*[\(\[ ]?\s*([A-Da-d])\s*(?:[\)\]\.\/–\:\—\=\◦\•\▪]|\-(?!\d))\s*(.*)/i);
      if (optMatch) {
        const letter = optMatch[1].toUpperCase();
        const text = optMatch[2].trim();
        currentOptions.push({ letter, text });
        inQuestionMode = false;
        inExplanationMode = false;
        continue;
      }

      if (currentAnswerIdx === -1) {
        const ansKeywordMatch = cleanLine.match(/^\s*(?:sakt[eë]|correct|answer|përgjigj[a-zëë]*|pergjigj[a-z]*|zgjidhj[a-zë]*|çelës|celes|opsioni|alternativa)\b/i);
        if (ansKeywordMatch) {
          const afterKeyword = cleanLine.slice(ansKeywordMatch[0].length);
          const letterMatch = afterKeyword.match(/\b([A-Da-d])\b/i);
          if (letterMatch) {
            currentAnswerIdx = 'ABCD'.indexOf(letterMatch[1].toUpperCase());
          }
          inQuestionMode = false;
          inExplanationMode = false;
          continue;
        }
      }

      if (/^\s*([A-Da-d])\s*$/.test(cleanLine) && currentOptions.length === 4 && currentAnswerIdx === -1) {
        const letter = cleanLine.trim().toUpperCase();
        currentAnswerIdx = 'ABCD'.indexOf(letter);
        inQuestionMode = false;
        inExplanationMode = false;
        continue;
      }

      const expKeywordMatch = cleanLine.match(/^\s*(?:shpjegimi?|exp(lanation)?|sqarim(i)?|arsyetimi?|koment(imi?)?|arsye|shpjeguara?)\b/i);
      if (expKeywordMatch) {
        let rest = cleanLine.slice(expKeywordMatch[0].length).trim();
        rest = rest.replace(/^[:\-\s\=]+/g, '').trim();
        rest = rest.replace(/^(?:i\s+pyetjes|i\s+rastit|mbi|për|per|është|eshte)\s*[:\-\s\=]*/i, '').trim();
        currentExplanation = rest;
        inQuestionMode = false;
        inExplanationMode = true;
        continue;
      }

      const isNewQHeader = 
        /^\s*\d{1,4}[\.\)](?!\d)/.test(cleanLine) || 
        /^\s*Pyetj[aeë]\s*\d+/i.test(cleanLine) || 
        /^\s*Quest(ion)?\s*\d+/i.test(cleanLine) ||
        /^\s*Q\d+[\.\:\)]/i.test(cleanLine) ||
        /^\s*\[?Rasti\s+Klinik\s+#?\d+/i.test(cleanLine);

      if (isNewQHeader) {
        if (currentQuestionText.trim()) {
          saveCurrentQuestion();
        }
        currentQuestionText = cleanLine;
        inQuestionMode = true;
        inExplanationMode = false;
        continue;
      }

      if (inQuestionMode) {
        currentQuestionText += ' ' + cleanLine;
      } else if (inExplanationMode) {
        currentExplanation += ' ' + cleanLine;
      } else if (currentOptions.length > 0) {
        const lastOpt = currentOptions[currentOptions.length - 1];
        if (lastOpt) {
          lastOpt.text += ' ' + cleanLine;
        }
      } else {
        if (!currentQuestionText) {
          currentQuestionText = cleanLine;
          inQuestionMode = true;
        } else {
          currentQuestionText += ' ' + cleanLine;
        }
      }
    }

    if (currentQuestionText.trim()) {
      saveCurrentQuestion();
    }

    const finalParsed: any[] = [];
    parsed.forEach((q, idx) => {
      const nonEmpties = q.options.filter((o: any) => o && !o.startsWith('Opsioni '));
      if (q.text && nonEmpties.length >= 2) {
        finalParsed.push(q);
      } else {
        errors.push(`Blloku ${idx + 1} afër "${q.text.slice(0, 35)}...": Mungojnë opsione.`);
      }
    });

    return { parsed: finalParsed, errors };
  }

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  function cleanAndParseJSON(jsonStr: string): any {
    let cleaned = jsonStr.trim();
    // Remove markdown codeblock backticks if present
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "");
    }
    cleaned = cleaned.trim();
    try {
      return JSON.parse(cleaned);
    } catch (err) {
      console.log("[JSON Clean Parse] Standard JSON parsing failed, trying to extract content inside curly braces or brackets...");
      const startObj = cleaned.indexOf("{");
      const startArr = cleaned.indexOf("[");
      let startIdx = -1;
      let endIdx = -1;
      
      if (startObj !== -1 && (startArr === -1 || startObj < startArr)) {
        startIdx = startObj;
        endIdx = cleaned.lastIndexOf("}");
      } else if (startArr !== -1) {
        startIdx = startArr;
        endIdx = cleaned.lastIndexOf("]");
      }
      
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        try {
          const potentialJson = cleaned.substring(startIdx, endIdx + 1);
          return JSON.parse(potentialJson);
        } catch (innerErr) {
          console.log("[JSON Clean Parse] Substring parsing also failed.");
        }
      }
      throw err;
    }
  }

  function getRetryDelayFromError(error: any): number {
    try {
      const errorStr = [
        String(error),
        String(error?.message || ""),
        JSON.stringify(error || {})
      ].join(" ");

      // 1. Direct Regex Match for retryDelay (e.g., "retryDelay":"53s" or "retryDelay":"53")
      const regex = /"retryDelay"\s*:\s*"(\d+)(?:\.\d+)?s?"/i;
      const match = errorStr.match(regex);
      if (match && match[1]) {
        const seconds = parseInt(match[1], 10);
        if (seconds > 0) {
          console.log(`[getRetryDelayFromError] U gjet vonesë përmes Regex: ${seconds}s`);
          return seconds * 1000;
        }
      }

      // 2. Direct Regex Match for numbers of seconds inside standard error strings (e.g., "Please retry in 53s" or "Please retry in 53.216940969s.")
      const retryInRegex = /retry\s+in\s+(\d+(?:\.\d+)?)\s*s/i;
      const matchRetry = errorStr.match(retryInRegex);
      if (matchRetry && matchRetry[1]) {
        const seconds = Math.ceil(parseFloat(matchRetry[1]));
        if (seconds > 0) {
          console.log(`[getRetryDelayFromError] U gjet vonesë e kërkuar nga mesazhi: ${seconds}s`);
          return seconds * 1000;
        }
      }

      const findDelay = (details: any[]) => {
        const retryInfo = details.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
        if (retryInfo && typeof retryInfo.retryDelay === 'string') {
          const seconds = parseFloat(retryInfo.retryDelay);
          if (!isNaN(seconds) && seconds > 0) {
            return Math.ceil(seconds) * 1000;
          }
        }
        return 0;
      };

      if (error?.details && Array.isArray(error.details)) {
        const d = findDelay(error.details);
        if (d > 0) return d;
      }

      if (error?.error?.details && Array.isArray(error.error.details)) {
        const d = findDelay(error.error.details);
        if (d > 0) return d;
      }

      if (typeof error?.message === 'string' && error.message.trim().startsWith('{')) {
        const parsed = JSON.parse(error.message);
        const details = parsed?.details || parsed?.error?.details;
        if (Array.isArray(details)) {
          const d = findDelay(details);
          if (d > 0) return d;
        }
      }
    } catch (e) {
      // ignore
    }
    return 0;
  }

  function formatGeminiError(error: any): string {
    let safeJsonString = "";
    try {
      safeJsonString = JSON.stringify(error || {});
    } catch (e) {
      safeJsonString = error?.message || String(error);
    }
    const errorStr = [
      String(error),
      String(error?.message || ""),
      safeJsonString
    ].join(" ");

    const errorStrLower = errorStr.toLowerCase();

    // 1. Quota / Rate limit
    if (errorStrLower.includes("quota") || errorStrLower.includes("resource_exhausted") || errorStrLower.includes("429") || errorStrLower.includes("limit")) {
      // Find retry delay in message
      const retryInRegex = /retry\s+in\s+(\d+(?:\.\d+)?)\s*s/i;
      const matchRetry = errorStr.match(retryInRegex);
      if (matchRetry && matchRetry[1]) {
        const seconds = Math.ceil(parseFloat(matchRetry[1]));
        return `Keni kaluar limitin e kërkesave (quota) të Gemini API. Ju lutemi provoni përsëri pas ${seconds} sekondash. (Kodi i gabimit: 429)`;
      }

      const regex = /"retryDelay"\s*:\s*"(\d+)(?:\.\d+)?s?"/i;
      const match = errorStr.match(regex);
      if (match && match[1]) {
        const seconds = parseInt(match[1], 10);
        return `Keni kaluar limitin e kërkesave (quota) të Gemini API. Ju lutemi provoni përsëri pas ${seconds} sekondash. (Kodi i gabimit: 429)`;
      }

      return "Keni kaluar limitin e kërkesave të lejuara të Gemini API (Quota Exceeded). Ju lutemi prisni pak ose provoni përsëri pas disa sekondash.";
    }

    // 2. Missing API key
    if (errorStrLower.includes("api key") || errorStrLower.includes("api_key") || errorStrLower.includes("key not found") || errorStrLower.includes("settings > secrets")) {
      return "Çelësi API i Gemini nuk është konfiguruar ose është i pavlefshëm. Ju lutemi shkoni te Settings > Secrets dhe shtoni GEMINI_API_KEY.";
    }

    // 3. Service Unavailable
    if (errorStrLower.includes("503") || errorStrLower.includes("unavailable") || errorStrLower.includes("high demand") || errorStrLower.includes("temp")) {
      return "Shërbimi i Gemini AI është përkohësisht i mbingarkuar ose i padisponueshëm. Ju lutemi provoni përsëri pas disa sekondash.";
    }

    // Default
    return error?.message || String(error) || "Ndodhi një gabim gjatë komunikimit me Gemini AI.";
  }

  const exhaustedModels = new Map<string, number>(); // model name -> expiry timestamp

  async function generateContentWithRetry(params: any, retries = 5, initialDelayMs = 3000): Promise<any> {
    const modelFallbackList = [
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite"
    ];

    const now = Date.now();
    // Filter out models that are currently marked as exhausted
    let activeModels = [...modelFallbackList].filter(m => {
      const expiry = exhaustedModels.get(m);
      if (expiry && expiry > now) {
        return false;
      }
      return true;
    });

    let initialModel = params.model || "gemini-3.5-flash";
    const initialExpiry = exhaustedModels.get(initialModel);
    if (initialExpiry && initialExpiry > now) {
      if (activeModels.length > 0) {
        console.log(`[Gemini Fallback] Modeli i kërkuar ${initialModel} është shënuar si i konsumuar përkohësisht. Duke përdorur ${activeModels[0]} si zëvendësues.`);
        initialModel = activeModels[0];
      }
    }

    let listToTry = [initialModel, ...activeModels.filter(m => m !== initialModel)];

    // Fallback safety: If all models are marked as exhausted, try all of them anyway
    if (activeModels.length === 0) {
      console.log("[Gemini Warning] Të gjithë modelet e rëndësishme janë shënuar si të konsumuar. Duke provuar gjithsesi listën e plotë.");
      listToTry = [initialModel, ...modelFallbackList.filter(m => m !== initialModel)];
    }

    let lastError: any = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      let maxRetryDelayObserved = 0;

      for (const currentModel of [...listToTry]) {
        try {
          console.log(`[Gemini Request] Duke tentuar modelin ${currentModel} (Tentativa ${attempt}/${retries})...`);
          const response = await getAI().models.generateContent({
            ...params,
            model: currentModel
          });
          console.log(`[Gemini Request] Sukses me modelin ${currentModel}`);
          return response;
        } catch (error: any) {
          lastError = error;
          let safeJsonString = "";
          try {
            safeJsonString = JSON.stringify(error);
          } catch (e) {
            safeJsonString = error?.message || String(error);
          }
          const errorStr = [
            String(error),
            String(error?.message || ""),
            String(error?.status || ""),
            String(error?.code || ""),
            safeJsonString
          ].join(" ").toLowerCase();

          const isQuotaExceeded = errorStr.includes("quota") || 
                                  errorStr.includes("resource_exhausted") || 
                                  errorStr.includes("429");
                                  
          const isTransient = isQuotaExceeded || 
                              errorStr.includes("503") || 
                              errorStr.includes("unavailable") || 
                              errorStr.includes("high demand") || 
                              errorStr.includes("limit") || 
                              errorStr.includes("temp") ||
                              (error?.status && (error.status === 503 || error.status === 429));

          const isUnsupported = errorStr.includes("not found") || 
                                errorStr.includes("404") || 
                                errorStr.includes("not supported") || 
                                errorStr.includes("invalid") || 
                                errorStr.includes("400") ||
                                (error?.status && (error.status === 404 || error.status === 400));

          console.log(`[Gemini Error] Modeli ${currentModel} dështoi në tentativën ${attempt}. Gabimi: ${error?.message || error}. isTransient: ${isTransient}, isUnsupported: ${isUnsupported}`);

          const observedDelay = getRetryDelayFromError(error);
          if (observedDelay > maxRetryDelayObserved) {
            maxRetryDelayObserved = observedDelay;
          }

          if (isQuotaExceeded) {
            let duration = 60000; // 1 minute default for minute rate limit
            const isDaily = errorStr.includes("free_tier_requests") || 
                            errorStr.includes("per_day") || 
                            errorStr.includes("perday") || 
                            errorStr.includes("daily") || 
                            errorStr.includes("limit: 20") || 
                            errorStr.includes("limit: 5");
            if (isDaily) {
              duration = 12 * 60 * 60 * 1000; // 12 hours for daily quota
              console.warn(`[Gemini Quota] Modeli ${currentModel} ka tejkaluar kuotën ditore! Duke e shënuar si të konsumuar për 12 orë.`);
            } else {
              console.warn(`[Gemini Quota] Modeli ${currentModel} ka tejkaluar kuotën për minutë! Duke e shënuar si të konsumuar për 1 minutë.`);
            }
            exhaustedModels.set(currentModel, Date.now() + duration);
            
            // Immediately remove it from current listToTry so we don't try it again in this current loop
            listToTry = listToTry.filter(m => m !== currentModel);
          }

          if (isUnsupported) {
            listToTry = listToTry.filter(m => m !== currentModel);
          }

          if (!isTransient && !isUnsupported) {
            throw error;
          }
        }
      }

      if (attempt < retries && listToTry.length > 0) {
        const baseDelay = initialDelayMs * Math.pow(2, attempt - 1);
        const delayToUse = Math.max(baseDelay, maxRetryDelayObserved + 1500);
        console.log(`[Gemini Status] Të gjithë modelet dështuan në tentativën ${attempt}. Duke pritur ${delayToUse}ms para tentativës tjetër...`);
        await delay(delayToUse);
      }
    }

    throw lastError || new Error("Të gjithë modelet e Gemini dështuan dhe tentativat u ezauruan.");
  }

  // Simple memory cache for uploaded PDFs to prevent client from uploading huge payloads repeatedly
  const pdfUploadsCache = new Map<string, { pdfBase64: string }>();

  // Simple memory cache for uploaded Word documents to parse answers
  const wordUploadsCache = new Map<string, { text: string; fileName: string }>();

  // API route to temporarily save uploaded PDF
  app.post("/api/pdf/upload", (req, res) => {
    try {
      const { pdfBase64 } = req.body;
      if (!pdfBase64) {
        return res.status(400).json({ error: "Duhet të ngarkoni një skedar PDF." });
      }

      const fileId = "pdf_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
      pdfUploadsCache.set(fileId, { pdfBase64 });

      // Clean older cache to avoid memory leaks
      if (pdfUploadsCache.size > 20) {
        const firstKey = pdfUploadsCache.keys().next().value;
        if (firstKey) {
          pdfUploadsCache.delete(firstKey);
        }
      }

      return res.json({ success: true, fileId });
    } catch (error: any) {
      console.error("Gabim gjatë ruajtjes së përkohshme të PDF:", error);
      return res.status(500).json({ error: "Gabim gjatë ruajtjes së përkohshme të skedarit." });
    }
  });

  // API route to temporarily save and parse uploaded Word (.docx) file
  app.post("/api/word/upload", async (req, res) => {
    try {
      const { docxBase64, fileName } = req.body;
      if (!docxBase64) {
        return res.status(400).json({ error: "Duhet të ngarkoni një skedar Word (.docx)." });
      }

      const buffer = Buffer.from(docxBase64, "base64");
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value || "";

      const fileId = "word_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
      wordUploadsCache.set(fileId, { text, fileName: fileName || "answers.docx" });

      // Clean older cache to avoid memory leaks
      if (wordUploadsCache.size > 20) {
        const firstKey = wordUploadsCache.keys().next().value;
        if (firstKey) {
          wordUploadsCache.delete(firstKey);
        }
      }

      return res.json({ success: true, fileId, textLength: text.length });
    } catch (error: any) {
      console.error("Gabim gjatë leximit dhe nxjerrjes së tekstit nga Word (.docx):", error);
      return res.status(500).json({ error: "Gabim gjatë përpunimit të skedarit Word. Sigurohuni që është një format .docx i rregullt." });
    }
  });

  // API route to count the questions inside a PDF
  app.post("/api/generate-from-pdf/count", async (req, res) => {
    try {
      const { pdfBase64, fileId, wordFileId, customPrompt } = req.body;
      
      let base64Data = pdfBase64;
      if (fileId) {
        const cached = pdfUploadsCache.get(fileId);
        if (cached) {
          base64Data = cached.pdfBase64;
        } else {
          return res.status(404).json({ error: "Skedari i ngarkuar nuk u gjet ose ka skaduar në server. Ju lutemi ngarkojeni përsëri." });
        }
      }

      if (!base64Data) {
        return res.status(400).json({ error: "Duhet të ngarkoni një skedar PDF." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({ success: false, error: "GEMINI_API_KEY_MISSING", message: "Çelësi API i Gemini mungon. Ju lutem përdorni parserin offline." });
      }

      const pdfPart = {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data
        }
      };

      let wordHint = "";
      if (wordFileId) {
        const cachedWord = wordUploadsCache.get(wordFileId);
        if (cachedWord) {
          wordHint = `\n\nKemi gjithashtu të disponueshëm një skedar Word (.docx) që përmban përgjigjet ose çelësin e saktë të pyetjeve. Ju lutemi, përdoreni këtë përmbajtje të Word-it si referencë ose udhëzues për të llogaritur më saktë numrin e pyetjeve dhe për të parë se si lidhen ato:\n\n---\n${cachedWord.text}\n---`;
        }
      }

      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: [
          pdfPart,
          {
            text: `Ju lutem, analizoni me shumë vëmendje këtë dokument PDF faqe për faqe (nga faqja e parë deri tek e fundit) dhe numëroni SAKTËSISHT sa pyetje me zgjedhje të shumëfishtë ndodhen në të. Ky dokument PDF përmban pyetjet, alternativat e tyre, përgjigjet e sakta dhe shpjegimet e tyre përkatëse.
Mos anashkaloni asnjë pyetje, asnjë paragraf dhe asnjë pjesë të dokumentit. Duhet të llogaritet çdo pyetje pa asnjë përjashtim.${wordHint}
Kthejeni përgjigjen saktësisht si një objekt JSON med një fushë 'totalQuestions' (numër i plotë).
Nëse keni udhëzime shtesë si: "${customPrompt || ''}", merreni parasysh gjithashtu në përcaktimin e pyetjeve të vlefshme.`
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              totalQuestions: { type: Type.INTEGER, description: "Numri i saktë dhe i detajuar i pyetjeve të gjetura në të gjithë dokumentin pa asnjë anashkalim." }
            },
            required: ["totalQuestions"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Gemini nuk ktheu asnjë përgjigje gjatë numërimit.");
      }

      const parsed = cleanAndParseJSON(responseText);
      return res.json({ success: true, totalQuestions: parsed.totalQuestions || 0 });

    } catch (error: any) {
      console.error("Gabim gjatë numërimit të pyetjeve në PDF:", error);
      return res.status(500).json({ error: formatGeminiError(error) });
    }
  });

  // API route to process a single batch of questions from PDF
  app.post("/api/generate-from-pdf/batch", async (req, res) => {
    try {
      const { pdfBase64, fileId, wordFileId, startIndex, endIndex, customPrompt } = req.body;
      
      let base64Data = pdfBase64;
      if (fileId) {
        const cached = pdfUploadsCache.get(fileId);
        if (cached) {
          base64Data = cached.pdfBase64;
        } else {
          return res.status(404).json({ error: "Skedari i ngarkuar nuk u gjet ose ka skaduar në server." });
        }
      }

      if (!base64Data) {
        return res.status(400).json({ error: "Duhet të ngarkoni një skedar PDF." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({ success: false, error: "GEMINI_API_KEY_MISSING", message: "Çelësi API i Gemini mungon. Ju lutem përdorni parserin offline." });
      }

      const pdfPart = {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data
        }
      };

      const defaultInstruction = `DETYRË STRIPTE EKSTRAKTUESE (100% Faithful Extraction): Dokumenti PDF i bashkëngjitur përmban pyetje ekzistuese me zgjedhje të shumëfishtë, së bashku met 4 alternativat, përgjigjen e saktë dhe shpjegimin përkatës të shkruar direkt në PDF.
Detyra juaj kryesore është të nxirrni këto pyetje saktësisht ashtu siç janë shkruar në PDF, duke ruajtur 100% besnikëri ndaj përmbajtjes origjinale. Për pyetjet e fizikës ose magnetizmit, ruani saktësisht të gjitha simbolet, formulat, greqishtet (si ε, Φ, Δ, θ, μ₀, π).
Përpunoni dhe ktheni pyetjet që gjenden në intervalin prej pyetjes numër \${startIndex} deri te pyetja numër \${endIndex} (bazuar në renditjen e tyre të saktë kronologjike në dokument nga fillimi në fund).

RREGULLAT E SEVERTA TË EKSTRAKTIMIT:
1. RENDITJA E PYETJEVE: Kthejini pyetjet saktësisht sipas sekuencës dhe renditjes kronologjike që ato kanë në skedarin PDF (nga e para tek e fundit në kët' interval). Mos i përzieni ose ndryshoni renditjen e tyre në asnjë mënyrë!
2. TEKSTI I PYETJES: Nxirrni tekstin e pyetjes saktësisht siç është shkruar në PDF. Mos ndryshoni asgjë, mos bëni rishkrim ose parafrazim. Duhet të jetë 100% identike me origjinalin.
3. 4 ALTERNATIVAT: Nxirrni saktësisht të 4 alternativat/opsionet që vijnë me atë pyetje in PDF. Mos i ndryshoni, mos i rishkruani dhe mos i rirregulloni ato. Nëse ndonjë pyetje ka më pak se 4 alternativa në dokument, gjeneroni një alternativa të 4-të të besueshme për të plotësuar saktësisht 4 opsione.
4. PERGJIGJA E SAKTE: Gjeni dhe nxirrni saktësisht përgjigjen e saktë të treguar në PDF (qoftë me asterisk si A*, e theksuar bold, e nënvizuar, e specifikuar me tekst si 'Përgjigja e saktë: A', ose në një tabelë çelës-përgjigjesh brenda dokumentit). Nëse nuk specifikohet visualisht, përcaktojeni bazuar në logjikën e saktë shkencore mjekësore/fizike. Kthejeni indeksin si numër të plotë (0 për A, 1 për B, 2 për C, 3 për D).
5. SHPJEGIMI (EXP): Nxirrni saktësisht shpjegimin ekzistues të pyetjes direkt nga PDF-ja ashtu siç është shkruar, pa asnjë ndryshim ose zgjerim të panevojshëm. Vetëm nëse shpjegimi mungon tërësisht ose është tejet i shkurtër në PDF, gjeneroni një shpjegim konciz, të qartë dhe profesional mjekësor apo shkencor në gjuhën shqipe ('exp').`;

      let wordInstruction = "";
      if (wordFileId) {
        const cachedWord = wordUploadsCache.get(wordFileId);
        if (cachedWord) {
          wordInstruction = `\n\n⚠️ RREGULL KRYESOR DHE I DETYRUESHËM:
Së bashku me PDF-në, ju është dhënë më poshtë teksti i nxjerrë nga një skedar Word (.docx) që përmban përgjigjet e sakta ose çelësin e pyetjeve.
Ju DUHET të përdorni këtë përmbajtje tekstuale nga Word-i më poshtë për të gjetur saktësisht se cila nga alternativat (A, B, C, D) që po nxirrni nga PDF-ja është përgjigjja e saktë për pyetjen përkatëse.
Nëse çelësi në Word thotë se përgjigjja e saktë është një opsion i caktuar (p.sh. a, b, c, d), vendoseni saktë indeksin përkatës (0 për A, 1 për B, 2 për C, 3 për D). Ju lutemi mos devijoni nga përgjigjet e dhëna në këtë skedar Word!

PËRMBAJTJA E SKEDARIT WORD ME PËRGJIGJET E SAKTA:
------------------------------------------------
${cachedWord.text}
------------------------------------------------`;
        }
      }

      const userInstruction = customPrompt ? `${defaultInstruction}\nUdhëzim shtesë dhe specifik nga përdoruesi: ${customPrompt}${wordInstruction}` : `${defaultInstruction}${wordInstruction}`;

      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: [
          pdfPart,
          {
            text: `${userInstruction}\n\nKthejeni rezultatin saktësisht si një JSON array që përputhet med këtë skemë strukturore.`
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "Teksti i plotë i pyetjes" },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Saktësisht katër opsione të mundshme (A, B, C, D) për t'u shfaqur si alternativa."
                },
                answer: { type: Type.INTEGER, description: "Indeksi i përgjigjes së saktë (nga 0 deri në 3)." },
                exp: { type: Type.STRING, description: "Shpjegim i hollësishëm dhe i qartë në gjuhën shqipe se pse ky opsion është i saktë." },
                pageNumber: { type: Type.INTEGER, description: "Numri i faqes (1-bazuar) në dokumentin PDF ku ndodhet kjo pyetje." },
                figureCrop: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER, description: "Pozicioni horizontal fillestar i figurës/diagramës në faqe, si përqindje (0-100)." },
                    y: { type: Type.NUMBER, description: "Pozicioni vertikal fillestar i figurës/diagramës në faqe, si përqindje (0-100)." },
                    width: { type: Type.NUMBER, description: "Gjerësia e figurës/diagramës si përqindje e gjerësisë së faqes (0-100)." },
                    height: { type: Type.NUMBER, description: "Lartësia e figurës/diagramës si përqindje e lartësisë së faqes (0-100)." }
                  },
                  required: ["x", "y", "width", "height"],
                  description: "Kutitë e kufizimit (bounding box) si përqindje të faqes për ndonjë figurë, diagramë ose skicë që i përket kësaj pyetjeje në PDF. Nëse pyetja nuk ka figurë ose skicë, mos e plotësoni ose kthejeni null."
                }
              },
              required: ["text", "options", "answer", "exp", "pageNumber"]
            }
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Gemini nuk ktheu asnjë përgjigje.");
      }

      const parsedQuestions = cleanAndParseJSON(responseText);
      return res.json({ success: true, questions: parsedQuestions });

    } catch (error: any) {
      console.error("Gabim gjatë procesimit të PDF-range:", error);
      return res.status(500).json({ error: formatGeminiError(error) });
    }
  });

  app.post("/api/generate-from-pdf", async (req, res) => {
    try {
      const { pdfBase64, fileId, wordFileId, customPrompt } = req.body;

      let base64Data = pdfBase64;
      if (fileId) {
        const cached = pdfUploadsCache.get(fileId);
        if (cached) {
          base64Data = cached.pdfBase64;
        } else {
          return res.status(404).json({ error: "Skedari i ngarkuar nuk u gjet ose ka skaduar në server. Ju lutemi ngarkojeni përsëri." });
        }
      }

      if (!base64Data) {
        return res.status(400).json({ error: "Duhet të ngarkoni një skedar PDF." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({ success: false, error: "GEMINI_API_KEY_MISSING", message: "Çelësi API i Gemini mungon. Ju lutem përdorni parserin offline." });
      }

      const pdfPart = {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data
        }
      };

      const defaultInstruction = `Dokumenti PDF i bashkëngjitur përmban pyetje ekzistuese me zgjedhje të shumëfishtë, së bashku me alternativat, përgjigjen e saktë dhe shpjegimet e tyre përkatëse të shkruara direkt në PDF. Ju duhet të bëni një analizë të thellë të secilës pyetje faqe për faqe pa anashkaluar asnjë detaj. Detyra juaj është:
1. Të nxirrni dhe të ruani tekstin e pyetjes ekzistuese saktësisht siç është shkruar në PDF. Për pyetjet e fizikës ose magnetizmit, ruani saktësisht të gjitha simbolet, formulat, greqishtet (si ε, Φ, Δ, θ, μ₀, π).
2. Të nxirrni saktësisht 4 opsionet/alternativat që vijnë me atë pyetje në PDF (nëse ka më pak se 4 opsione, shtoni një opsion të 4-të të besueshëm për të pasur gjithmonë saktësisht 4 opsione; nëse ka më shumë se 4, zgjidhni 4 më të rëndësishmet).
3. Të gjeni dhe të nxirrni SAKTËSISHT përgjigjen e saktë nga vetë PDF-ja. Ajo mund të jetë e theksuar (bold/highlight), e shënuar me yll/asterisk (p.sh. A* ose *A), e nënvizuar, e specifikuar si tekst (p.sh. "Përgjigja: A" ose "Saktë: B" pas pyetjes ose alternativave), ose e listuar si çelës diku në faqe ose në fund të dokumentit. Nëse PDF-ja nuk e specifikon, përcaktojeni atë bazuar në përmbajtjen shkencore/mjekësore/fizike të PDF-së. Kthejeni indeksin e saktë si numër të plotë (0 për A, 1 për B, 2 për C, 3 për D).
4. Të nxirrni shpjegimin ekzistues të pyetjes direkt nga PDF-ja (i cili zakonisht fillon me fjalë si "Shpjegim:", "Arsyetim:", "Sqarim:", "Zgjidhja:" ose e ngjashme). Përktheni ose kopjoni këtë shpjegim saktësisht në fushën 'exp' në gjuhën shqipe. Nëse shpjegimi mungon ose është tejet i shkurtër në PDF, ju lutemi gjeneroni dhe zgjerojeni atë duke ofruar një shpjegim të hollësishëm, të qartë, shkencor dhe profesional në gjuhën shqipe.`;
      
      let wordInstruction = "";
      if (wordFileId) {
        const cachedWord = wordUploadsCache.get(wordFileId);
        if (cachedWord) {
          wordInstruction = `\n\n⚠️ RREGULL KRYESOR DHE I DETYRUESHËM:
Së bashku me PDF-në, ju është dhënë më poshtë teksti i nxjerrë nga një skedar Word (.docx) që përmban përgjigjet e sakta ose çelësin e pyetjeve.
Ju DUHET të përdorni këtë përmbajtje tekstuale nga Word-i më poshtë për të gjetur saktësisht se cila nga alternativat (A, B, C, D) që po nxirrni nga PDF-ja është përgjigjja e saktë për pyetjen përkatëse.
Nëse çelësi in Word thotë se përgjigjja e saktë është një opsion i caktuar (p.sh. a, b, c, d), vendoseni saktë indeksin përkatës (0 për A, 1 për B, 2 për C, 3 për D). Ju lutemi mos devijoni nga përgjigjet e dhëna në këtë skedar Word!

PËRMBAJTJA E SKEDARIT WORD ME PËRGJIGJET E SAKTA:
------------------------------------------------
${cachedWord.text}
------------------------------------------------`;
        }
      }

      const userInstruction = customPrompt ? `${defaultInstruction}\nUdhëzim shtesë dhe specifik nga përdoruesi: ${customPrompt}${wordInstruction}` : `${defaultInstruction}${wordInstruction}`;

      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: [
          pdfPart,
          {
            text: `${userInstruction}\n\nKthejeni rezultatin saktësisht si një JSON array që përputhet med këtë skemë strukturore.`
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "Teksti i plotë i pyetjes" },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Saktësisht katër opsione të mundshme (A, B, C, D) për t'u shfaqur si alternativa."
                },
                answer: { type: Type.INTEGER, description: "Indeksi i përgjigjes së saktë (nga 0 deri në 3)." },
                exp: { type: Type.STRING, description: "Shpjegim i hollësishëm dhe i qartë në gjuhën shqipe se pse ky opsion është i saktë." },
                pageNumber: { type: Type.INTEGER, description: "Numri i faqes (1-bazuar) në dokumentin PDF ku ndodhet kjo pyetje." },
                figureCrop: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER, description: "Pozicioni horizontal fillestar i figurës/diagramës në faqe, si përqindje (0-100)." },
                    y: { type: Type.NUMBER, description: "Pozicioni vertikal fillestar i figurës/diagramës në faqe, si përqindje (0-100)." },
                    width: { type: Type.NUMBER, description: "Gjerësia e figurës/diagramës si përqindje e gjerësisë së faqes (0-100)." },
                    height: { type: Type.NUMBER, description: "Lartësia e figurës/diagramës si përqindje e lartësisë së faqes (0-100)." }
                  },
                  required: ["x", "y", "width", "height"],
                  description: "Kutitë e kufizimit (bounding box) si përqindje të faqes për ndonjë figurë, diagramë ose skicë që i përket kësaj pyetjeje në PDF. Nëse pyetja nuk ka figurë ose skicë, mos e plotësoni ose kthejeni null."
                }
              },
              required: ["text", "options", "answer", "exp", "pageNumber"]
            }
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Gemini nuk ktheu asnjë përgjigje.");
      }

      const parsedQuestions = cleanAndParseJSON(responseText);
      return res.json({ success: true, questions: parsedQuestions });

    } catch (error: any) {
      console.error("Gabim gjatë procesimit të PDF:", error);
      return res.status(500).json({ error: formatGeminiError(error) });
    }
  });

  // API route to process raw text (from TXT or DOCX) into structured questions using Gemini AI
  app.post("/api/generate-from-text", async (req, res) => {
    try {
      const { textContent, wordFileId, customPrompt } = req.body;
      let finalTxt = textContent;

      if (wordFileId) {
        const cached = wordUploadsCache.get(wordFileId);
        if (cached) {
          finalTxt = cached.text;
        } else {
          return res.status(404).json({ error: "Përmbajtja e dokumentit Word nuk u gjet ose ka skaduar." });
        }
      }

      if (!finalTxt) {
        return res.status(400).json({ error: "Mungon përmbajtja e tekstit për përpunim." });
      }

      if (!process.env.GEMINI_API_KEY) {
        console.log("[Server Fallback] Gemini API Key nuk është konfiguruar. Duke përdorur parserin lokal (Offline Regex Parser)...");
        const { parsed, errors } = localParseQuestions(finalTxt);
        if (parsed.length > 0) {
          return res.json({ success: true, questions: parsed });
        } else {
          return res.status(400).json({ error: "Çelësi API i Gemini mungon dhe parseri lokal nuk gjeti dot pyetje të rregullta në tekst. Formati duhet të ketë pyetje të ndjekura nga opsione A, B, C, D." });
        }
      }

      const defaultInstruction = "Teksti i mëposhtëm përmban pyetje mjekësore ose klinike me alternativa, përgjigje të sakta dhe shpjegime. Detyra juaj është të lexoni këtë tekst, të identifikoni të gjitha pyetjet ekzistuese dhe t'i ktheni ato në një strukturë të rregullt JSON array.\nPër secilën pyetje të gjetur:\n1. Nxirrni pyetjen saktësisht siç është në tekst.\n2. Nxirrni saktësisht 4 alternativa (nëse ka më pak, plotësoni me alternativa të besueshme; nëse ka më shumë, merrni 4 më të rëndësishmet).\n3. Përcaktoni saktë indeksin e përgjigjes së saktë (0=A, 1=B, 2=C, 3=D).\n4. Nxirrni ose gjeneroni një shpjegim të hollësishëm mjekësor në gjuhën shqipe ('exp') se pse kjo përgjigje është e saktë.";

      const userInstruction = customPrompt 
        ? `${defaultInstruction}\nUdhëzim specifik shtesë nga përdoruesi: ${customPrompt}`
        : defaultInstruction;

      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: [
          {
            text: `Teksti për të analizuar:\n\n${finalTxt}\n\n---\n\nUdhëzimi:\n${userInstruction}\n\nKthejeni rezultatin saktësisht si një JSON array që përputhet me këtë skemë strukturore.`
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "Teksti i plotë i pyetjes" },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Saktësisht katër opsione të mundshme (A, B, C, D) për t'u shfaqur si alternativa."
                },
                answer: { type: Type.INTEGER, description: "Indeksi i përgjigjes së saktë (nga 0 deri në 3)." },
                exp: { type: Type.STRING, description: "Shpjegim i hollësishëm dhe i qartë në gjuhën shqipe se pse ky opsion është i saktë." }
              },
              required: ["text", "options", "answer", "exp"]
            }
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Gemini nuk ktheu asnjë përgjigje.");
      }

      const parsedQuestions = cleanAndParseJSON(responseText);
      return res.json({ success: true, questions: parsedQuestions });

    } catch (error: any) {
      console.error("Gabim gjatë procesimit të tekstit me Gemini:", error);
      return res.status(500).json({ error: formatGeminiError(error) });
    }
  });

  // API route to process a screenshot/image into a structured question using Gemini Vision AI
  app.post("/api/generate-from-image", async (req, res) => {
    try {
      const { imageBase64, customPrompt } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Mungon imazhi i ngarkuar ose i kopjuar." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({ success: false, error: "GEMINI_API_KEY_MISSING", message: "Çelësi API i Gemini mungon për njohjen e imazheve (OCR)." });
      }

      // Clean base64 prefix
      let base64Clean = imageBase64;
      let mimeType = "image/png";
      if (imageBase64.startsWith("data:")) {
        const parts = imageBase64.split(";base64,");
        if (parts.length === 2) {
          mimeType = parts[0].substring(5); // e.g. "image/png"
          base64Clean = parts[1];
        }
      }

      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Clean
        }
      };

      const defaultInstruction = "DETYRË EXTRALCUESE ME VISION AI: Ky imazh përmban një pyetje me zgjedhje të shumëfishtë (nga fusha e mjekësisë, fizikës, apo biologjisë).\nAnalizojeni imazhin me vëmendje të plotë dhe nxirrni:\n1. Tekstin e saktë dhe të plotë të pyetjes (text). Mos bëni parafrazim apo ndryshime të panevojshme.\n2. Saktësisht katër opsionet/alternativat e mundshme (options). Nëse ka më pak në imazh, gjeneroni alternativa plotësuese shkencore për të patur saktësisht 4 opsione.\n3. Indeksin e përgjigjes së saktë (answer) si numër i plotë (0=A, 1=B, 2=C, 3=D). Nëse nuk specifikohet me rreth/ngjyrë në imazh, përcaktojeni saktë duke u bazuar në logjikën klinike mjekësore apo shkencore.\n4. Shpjegim konciz e të qartë mjekësor/akademik në gjuhën shqipe ('exp') se pse kjo përgjigje është e saktë dhe pse të tjerat eliminohen.";

      const userInstruction = customPrompt 
        ? `${defaultInstruction}\nUdhëzim specifik shtesë nga përdoruesi: ${customPrompt}`
        : defaultInstruction;

      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash", // Use gemini-3.5-flash for superb OCR and speed
        contents: [
          imagePart,
          {
            text: `${userInstruction}\n\nKthejeni rezultatin saktësisht si një objekt JSON që përputhet me këtë skemë strukturore.`
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "Teksti i plotë i pyetjes" },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Saktësisht katër opsione të mundshme (A, B, C, D) të cilat janë gjetur ose shtohen nëse mungojnë."
              },
              answer: { type: Type.INTEGER, description: "Indeksi i përgjigjes së saktë (nga 0 deri në 3)." },
              exp: { type: Type.STRING, description: "Shpjegim i hollësishëm mjekësor ose fizik në gjuhën shqipe." }
            },
            required: ["text", "options", "answer", "exp"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Gemini nuk ktheu asnjë përgjigje.");
      }

      const parsedQuestion = cleanAndParseJSON(responseText);
      return res.json({ success: true, question: parsedQuestion });

    } catch (error: any) {
      console.error("Gabim gjatë procesimit të imazhit me Gemini Vision:", error);
      return res.status(500).json({ error: formatGeminiError(error) });
    }
  });

  // Global shared questions storage on server
  const SHARED_DATA_FILE = path.join(process.cwd(), "data", "shared_questions.json");

  function loadSharedData() {
    try {
      if (fs.existsSync(SHARED_DATA_FILE)) {
        const raw = fs.readFileSync(SHARED_DATA_FILE, "utf-8");
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error("Error reading shared questions file:", err);
    }
    return { questions: [], categories: [], topics: [] };
  }

  function saveSharedData(data: { questions?: any[]; categories?: any[]; topics?: any[] }) {
    try {
      const dir = path.dirname(SHARED_DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const current = loadSharedData();
      const updated = {
        questions: data.questions !== undefined ? data.questions : (current.questions || []),
        categories: data.categories !== undefined ? data.categories : (current.categories || []),
        topics: data.topics !== undefined ? data.topics : (current.topics || []),
        lastUpdated: Date.now()
      };
      fs.writeFileSync(SHARED_DATA_FILE, JSON.stringify(updated), "utf-8");
      return updated;
    } catch (err) {
      console.error("Error saving shared questions file:", err);
      throw err;
    }
  }

  // API route to get all shared questions, categories, and topics for any user
  app.get("/api/shared-data", (req, res) => {
    try {
      const data = loadSharedData();
      return res.json({ success: true, ...data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API route for Admin panel to publish or update shared questions, categories, and topics
  app.post("/api/shared-data", (req, res) => {
    try {
      const { questions, categories, topics } = req.body;
      const updated = saveSharedData({ questions, categories, topics });
      return res.json({ success: true, count: updated.questions.length, lastUpdated: updated.lastUpdated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API route to merge newly uploaded questions with existing server store
  app.post("/api/sync-questions", (req, res) => {
    try {
      const { newQuestions, categories, topics } = req.body;
      const current = loadSharedData();

      const existingQs = current.questions || [];
      const existingIds = new Set(existingQs.map((q: any) => q.id));
      const existingTexts = new Set(existingQs.map((q: any) => (q.text || '').trim().toLowerCase()));

      const mergedQs = [...existingQs];
      if (Array.isArray(newQuestions)) {
        for (const q of newQuestions) {
          const normText = (q.text || '').trim().toLowerCase();
          if (!existingIds.has(q.id) && !existingTexts.has(normText)) {
            mergedQs.push(q);
            existingIds.add(q.id);
            existingTexts.add(normText);
          }
        }
      }

      // Merge categories
      const existingCats = current.categories || [];
      const catIds = new Set(existingCats.map((c: any) => c.id));
      const mergedCats = [...existingCats];
      if (Array.isArray(categories)) {
        for (const c of categories) {
          if (!catIds.has(c.id)) {
            mergedCats.push(c);
            catIds.add(c.id);
          }
        }
      }

      // Merge topics
      const existingTops = current.topics || [];
      const topIds = new Set(existingTops.map((t: any) => t.id));
      const mergedTops = [...existingTops];
      if (Array.isArray(topics)) {
        for (const t of topics) {
          if (!topIds.has(t.id)) {
            mergedTops.push(t);
            topIds.add(t.id);
          }
        }
      }

      const updated = saveSharedData({
        questions: mergedQs,
        categories: mergedCats,
        topics: mergedTops
      });

      return res.json({ success: true, ...updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
