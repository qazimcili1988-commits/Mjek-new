export interface ParsedQuestion {
  text: string;
  options: string[];
  answer: number; // 0-3
  exp: string;
  imageUrl?: string;
}

export const smartParseQuestions = (rawText: string): { parsed: ParsedQuestion[]; errors: string[] } => {
  const parsed: ParsedQuestion[] = [];
  const errors: string[] = [];

  if (!rawText || !rawText.trim()) {
    return { parsed, errors };
  }

  // Pre-process raw text to normalize spaces and lines
  const normalizedText = rawText
    .replace(/\r/g, '')
    .replace(/\u200B/g, '') // zero-width space
    .replace(/\u00A0/g, ' '); // non-breaking space

  // Helper to split side-by-side options (e.g., "A) option A B) option B C) option C D) option D")
  const splitSideBySideOptions = (line: string): string[] => {
    // Check if line contains at least two distinct option markers in sequence, e.g. A and B, or B and C.
    const hasMultiple = 
      (/A[\.\)]/i.test(line) && /B[\.\)]/i.test(line)) ||
      (/B[\.\)]/i.test(line) && /C[\.\)]/i.test(line)) ||
      (/C[\.\)]/i.test(line) && /D[\.\)]/i.test(line));

    if (!hasMultiple) return [line];

    // Replace " B) ", " B. ", " B - " with "\nB) ", etc.
    return line
      .replace(/\s+([B-Db-d])([\.\)\-\/–\:]\s*|\s+)(?=\S)/g, '\n$1$2')
      .split('\n');
  };

  // Split lines, split any side-by-side options, and trim them
  const rawLines = normalizedText.split('\n');
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue; // Completely ignore empty/blank lines to be resilient to random blank spacing
    }
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

    // Clean up the question text recursively to handle nested prefixes (e.g. "[Rasti Klinik #1]: Pyetja 1. Gjatë...")
    let cleanQText = currentQuestionText.trim();
    let oldLength = 0;
    while (cleanQText.length !== oldLength) {
      oldLength = cleanQText.length;
      cleanQText = cleanQText
         .replace(/^[\s•\*\-\▪\▫\◦\■\□\●\○\♦\◊\u2022\u2023\u2043\s]+/, '') // strip leading bullets/dashes
         .replace(/^\[?Rasti\s+Klinik\s+#?\d+\]?[:\s\-]*/i, '')
         .replace(/^Pyetj[aeë]\s*\d+[\s\.\:\-]*/i, '')
         .replace(/^Q\d+[\.\:\)]\s*/i, '')
         .replace(/^\d+[\.\)\s\-]+\s*/, '') // strip leading numbers like "1. ", "1) ", "1- "
         .trim();
    }

    if (!cleanQText) {
      cleanQText = 'Pyetje pa titull';
    }

    // Map compiled options to A, B, C, D
    const finalOptions = ['', '', '', ''];
    currentOptions.forEach((o) => {
      const idx = 'ABCD'.indexOf(o.letter.toUpperCase());
      if (idx >= 0 && idx < 4) {
        finalOptions[idx] = o.text.trim();
      }
    });

    // Heuristic: If we don't have exactly 4 options mapped by letter, try mapping sequentially
    const nonEmpties = finalOptions.filter(Boolean);
    if (nonEmpties.length < 4 && currentOptions.length >= 2) {
      for (let i = 0; i < Math.min(4, currentOptions.length); i++) {
        if (!finalOptions[i] && currentOptions[i]) {
          finalOptions[i] = currentOptions[i].text.trim();
        }
      }
    }

    // Ensure we have fallback text for empty options
    for (let i = 0; i < 4; i++) {
      if (!finalOptions[i] || !finalOptions[i].trim()) {
        finalOptions[i] = `Opsioni ${'ABCD'[i]}`;
      }
    }

    // Heuristics for correct answer if not found yet (e.g., look for "(E saktë)", "**", "✓" in option text)
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

    // Default correct answer fallback
    if (currentAnswerIdx === -1) {
      currentAnswerIdx = 0; // Default to option A
    }

    // Default explanation fallback
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

    // Reset fields for the next question block
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

    // Ignore common PDF/docx header, footer, page number, and general title noise lines
    const isNoiseLine = 
      /^\s*Termokimia\s+dhe\s+Kinetika\s*$/i.test(cleanLine) ||
      /^\s*Pyetje,\s*Përgjigje\s+dhe\s+Shpjegime.*$/i.test(cleanLine) ||
      /^\s*Page\s+\d+.*$/i.test(cleanLine) ||
      /^\s*\d+\s*of\s*\d+\s*$/i.test(cleanLine) ||
      /^\s*-\s*\d+\s*-\s*$/.test(cleanLine) ||
      /^\s*\d+\s*$/.test(cleanLine); // matches standalone page numbers like "1", "12", "99"
      
    if (isNoiseLine) {
      continue;
    }

    // Strip leading non-minus bullet symbols:
    cleanLine = cleanLine.replace(/^[\s•\*\▪\▫\◦\■\□\●\○\♦\◊\u2022\u2023\u2043]+\s*/, '');
    
    // Strip leading minus signs only if NOT followed by a digit (to preserve negative numbers like -139.6)
    cleanLine = cleanLine.replace(/^\-\s*(?!\d)/, '');

    // Detect image tags like: [Imazhi: data:image/png;base64,...] or [Figurë: http...] or [Image: ...], as well as unbracketed versions
    const imgMatch = cleanLine.match(/(?:\[)?(?:imazhi|figura|figurë|image|skicë|vizatim|foto)\s*[:=]\s*([^\]\r\n]+)(?:\])?/i);
    if (imgMatch) {
      currentImageUrl = imgMatch[1].trim();
      cleanLine = cleanLine.replace(/(?:\[)?(?:imazhi|figura|figurë|image|skicë|vizatim|foto)\s*[:=]\s*([^\]\r\n]+)(?:\])?/i, '').trim();
      if (!cleanLine) {
        continue;
      }
    }

    // 1. Detect Options: e.g. "A. Opsioni", "B) Opsioni", "[C] Opsioni"
    // We require punctuation after the letter to avoid false-matching regular words like "A".
    // We do NOT allow a minus sign followed by a digit to be treated as punctuation, to preserve negative values.
    const optMatch = cleanLine.match(/^\s*[\(\[ ]?\s*([A-Da-d])\s*(?:[\)\]\.\/–\:\—\=\◦\•\▪]|\-(?!\d))\s*(.*)/i);
    if (optMatch) {
      const letter = optMatch[1].toUpperCase();
      const text = optMatch[2].trim();
      currentOptions.push({ letter, text });
      inQuestionMode = false;
      inExplanationMode = false;
      continue;
    }

    // 2. Detect Correct Answer: e.g. "Përgjigje: A", "Përgjigjja e saktë: B", "Saktë: C", "Zgjidhja: D"
    // We check if the line starts with any answer keyword, and then look for a standalone letter A, B, C, D in that line after the keyword.
    // We only match if we haven't found the correct answer yet to avoid false positives inside explanation text.
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

    // 3. Detect Correct Answer fallback if it's literally just the letter "A", "B", "C", "D" on its own line
    if (/^\s*([A-Da-d])\s*$/.test(cleanLine) && currentOptions.length === 4 && currentAnswerIdx === -1) {
      const letter = cleanLine.trim().toUpperCase();
      currentAnswerIdx = 'ABCD'.indexOf(letter);
      inQuestionMode = false;
      inExplanationMode = false;
      continue;
    }

    // 4. Detect Explanation block: e.g. "Shpjegimi i pyetjes: ...", "Sqarimi i rastit: ..."
    const expKeywordMatch = cleanLine.match(/^\s*(?:shpjegimi?|exp(?:lanation)?|sqarim(?:i)?|arsyetimi?|koment(?:imi?)?|arsye|shpjeguara?)\b/i);
    if (expKeywordMatch) {
      let rest = cleanLine.slice(expKeywordMatch[0].length).trim();
      rest = rest.replace(/^[:\-\s\=]+/g, '').trim();
      rest = rest.replace(/^(?:i\s+pyetjes|i\s+rastit|mbi|për|per|është|eshte)\s*[:\-\s\=]*/i, '').trim();
      currentExplanation = rest;
      inQuestionMode = false;
      inExplanationMode = true;
      continue;
    }

    // 5. Detect Question Header: e.g. "1. Pyetja", "Pyetja 1:", "Q5. Pyetja"
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

    // 6. Accumulate plain text lines based on parser state
    if (inQuestionMode) {
      currentQuestionText += ' ' + cleanLine;
    } else if (inExplanationMode) {
      currentExplanation += ' ' + cleanLine;
    } else if (currentOptions.length > 0) {
      // Append multi-line option text or handle page-split option content gracefully
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

  // Save any leftover question at the end
  if (currentQuestionText.trim()) {
    saveCurrentQuestion();
  }

  // Validate the final parsed collection
  const finalParsed: ParsedQuestion[] = [];
  parsed.forEach((q, idx) => {
    // Treat as valid if it has some non-empty text and at least 2 non-placeholder options
    const nonEmpties = q.options.filter((o) => o && !o.startsWith('Opsioni '));
    
    // Always include any question block that has some text, so the user can import and fix format issues manually!
    if (q.text && q.text.trim()) {
      finalParsed.push(q);
      if (nonEmpties.length < 2) {
        errors.push(`Blloku ${idx + 1} afër "${q.text.slice(0, 35)}...": Mungojnë opsione ose formati është i paplotë.`);
      }
    } else {
      errors.push(`Blloku ${idx + 1}: Teksti i pyetjes është i zbrazët.`);
    }
  });

  return { parsed: finalParsed, errors };
};
