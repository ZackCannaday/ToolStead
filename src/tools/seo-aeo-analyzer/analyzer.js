export { TOOL_MANIFEST } from "./manifest.js";

export const INPUT_LIMITS = Object.freeze({ url: 2048, title: 200, metaDescription: 400, headings: 12000, body: 80000, aggregate: 90000 });

const FIELD_LABELS = Object.freeze({ url: "Canonical URL", title: "Page title", metaDescription: "Meta description", headings: "Heading outline", body: "Visible body copy" });
const STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "with", "your", "our", "we", "you"]);
const QUESTION_OPENERS = /^(what|why|how|when|where|who|which|can|could|do|does|is|are|should|will)\b/i;

// # Text utilities
export function countWords(value = "") {
  return String(value).trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function tokens(value = "") {
  return String(value).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function meaningfulTokens(value = "") {
  return tokens(value).filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function overlapRatio(left, right) {
  const leftTokens = new Set(meaningfulTokens(left));
  const rightTokens = new Set(meaningfulTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  return [...leftTokens].filter((token) => rightTokens.has(token)).length / Math.min(leftTokens.size, rightTokens.size);
}

function estimateSyllables(word) {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return 0;
  if (normalized.length <= 3) return 1;
  const withoutEndings = normalized.replace(/(?:e|es|ed)$/i, "");
  return Math.max(1, withoutEndings.match(/[aeiouy]+/g)?.length ?? 1);
}

export function calculateFleschReadingEase(value = "") {
  const text = String(value).trim();
  const words = text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? [];
  const sentenceCount = Math.max(1, text.split(/[.!?]+/).filter((item) => item.trim()).length);
  if (!words.length) return null;
  const syllables = words.reduce((total, word) => total + estimateSyllables(word), 0);
  const score = 206.835 - 1.015 * (words.length / sentenceCount) - 84.6 * (syllables / words.length);
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}

function readingLevel(score) {
  if (score == null) return "Not available";
  if (score >= 80) return "Easy";
  if (score >= 60) return "Plain language";
  if (score >= 40) return "Difficult";
  return "Very difficult";
}

export function inferSearchIntent(value = "") {
  const text = String(value).toLowerCase();
  if (/\b(login|sign in|contact|about|dashboard|portal)\b/.test(text)) return "Navigational";
  if (/\b(book|buy|order|schedule|hire|request|reserve|get (?:a )?quote)\b/.test(text)) return "Transactional";
  if (/\b(best|compare|comparison|versus|vs\.?|review|reviews|top|cost|price|pricing)\b/.test(text)) return "Commercial investigation";
  return "Informational";
}

function parseHeadingLine(line, index) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const htmlMatch = trimmed.match(/^<h([1-6])[^>]*>(.*?)<\/h\1>$/i);
  if (htmlMatch) return { level: Number(htmlMatch[1]), text: htmlMatch[2].replace(/<[^>]+>/g, "").trim(), line: index + 1 };
  const labeledMatch = trimmed.match(/^h([1-6])\s*[:|-]\s*(.+)$/i);
  if (labeledMatch) return { level: Number(labeledMatch[1]), text: labeledMatch[2].trim(), line: index + 1 };
  const markdownMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (markdownMatch) return { level: markdownMatch[1].length, text: markdownMatch[2].trim(), line: index + 1 };
  return { level: null, text: trimmed, line: index + 1 };
}

export function parseHeadings(value = "") {
  const lines = Array.isArray(value) ? value.map((heading) => typeof heading === "string" ? heading : `H${heading?.level ?? ""}: ${heading?.text ?? ""}`) : String(value).split(/\r?\n/);
  return lines.map(parseHeadingLine).filter(Boolean);
}

function normalizeInput(rawInput = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) throw new TypeError("Analyzer input must be an object.");
  return {
    url: String(rawInput.url ?? "").trim(),
    title: String(rawInput.title ?? "").trim(),
    metaDescription: String(rawInput.metaDescription ?? "").trim(),
    headings: Array.isArray(rawInput.headings) ? rawInput.headings.map((item) => typeof item === "string" ? item : `H${item?.level ?? ""}: ${item?.text ?? ""}`).join("\n") : String(rawInput.headings ?? "").trim(),
    body: String(rawInput.body ?? "").trim(),
  };
}

// # Input validation
export function validateSeoAeoInput(rawInput = {}) {
  let input;
  try {
    input = normalizeInput(rawInput);
  } catch (error) {
    return { input: null, errors: [{ field: "input", message: error.message }] };
  }
  const errors = [];
  for (const field of Object.keys(FIELD_LABELS)) {
    if (input[field].length > INPUT_LIMITS[field]) errors.push({ field, message: `${FIELD_LABELS[field]} must be ${INPUT_LIMITS[field].toLocaleString("en-US")} characters or fewer.` });
  }
  const aggregateLength = Object.values(input).reduce((total, value) => total + value.length, 0);
  if (aggregateLength > INPUT_LIMITS.aggregate) errors.push({ field: "input", message: `Combined input must be ${INPUT_LIMITS.aggregate.toLocaleString("en-US")} characters or fewer.` });
  if (input.url) {
    try {
      const url = new URL(input.url);
      if (!/^https?:$/.test(url.protocol)) throw new Error("Unsupported protocol");
    } catch {
      errors.push({ field: "url", message: "Enter a complete HTTP or HTTPS URL." });
    }
  }
  return { input, errors };
}

function gradeForScore(score) {
  if (score >= 90) return { grade: "A", band: "Elite" };
  if (score >= 80) return { grade: "B", band: "Strong" };
  if (score >= 70) return { grade: "C", band: "Moderate" };
  if (score >= 60) return { grade: "D", band: "Weak" };
  return { grade: "F", band: "Critical" };
}

function statusFor(points, maxPoints) {
  if (points === maxPoints) return "pass";
  if (points > 0) return "warning";
  return "error";
}

function check(id, title, evidence, remediation, points, maxPoints) {
  return Object.freeze({ id, title, evidence, remediation, points, maxPoints, status: statusFor(points, maxPoints) });
}

function pillar(id, name, checks) {
  const score = checks.reduce((total, item) => total + item.points, 0);
  return Object.freeze({ id, name, score, maxScore: 20, status: statusFor(score, 20), checks: Object.freeze(checks) });
}

function primaryKeywordFor(input, h1s) {
  const source = input.title || h1s[0]?.text || input.body;
  return meaningfulTokens(source).slice(0, 3).join(" ") || "Not detected";
}

function phraseCount(text, phrase) {
  if (!phrase || phrase === "Not detected") return 0;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(text).match(new RegExp(`\\b${escaped.replace(/\s+/g, "\\s+")}\\b`, "gi"))?.length ?? 0;
}

function frozenError(summary, errors) {
  return { status: "error", score: null, grade: null, band: null, summary, errors, metrics: null, pillars: [], findings: [] };
}

// # Deterministic audit
export function analyzeSeoAeoContent(rawInput = {}) {
  const validation = validateSeoAeoInput(rawInput);
  if (!validation.input) return frozenError("The supplied content could not be analyzed.", validation.errors);
  const { input, errors } = validation;
  if (Object.values(input).every((value) => !value)) return { status: "empty", score: null, grade: null, band: null, summary: "Add page content to run an SEO and AEO audit.", errors: [], metrics: null, pillars: [], findings: [] };
  if (errors.length) return frozenError("Correct the highlighted inputs before running the audit.", errors);

  const parsedUrl = input.url ? new URL(input.url) : null;
  const headings = parseHeadings(input.headings);
  const recognized = headings.filter((heading) => heading.level);
  const unrecognized = headings.filter((heading) => !heading.level);
  const h1s = recognized.filter((heading) => heading.level === 1);
  const hierarchyJumps = recognized.slice(1).filter((heading, index) => heading.level - recognized[index].level > 1);
  const questionHeadings = recognized.filter((heading) => heading.text.endsWith("?") || QUESTION_OPENERS.test(heading.text));
  const wordCount = countWords(input.body);
  const sentences = input.body.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const paragraphs = input.body.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const averageSentenceWords = sentences.length ? Math.round((wordCount / sentences.length) * 10) / 10 : 0;
  const averageParagraphSentences = paragraphs.length ? Math.round((sentences.length / paragraphs.length) * 10) / 10 : 0;
  const firstSentenceWords = countWords(sentences[0] ?? "");
  const readability = calculateFleschReadingEase(input.body);
  const primaryKeyword = primaryKeywordFor(input, h1s);
  const keywordOccurrences = phraseCount(input.body, primaryKeyword);
  const keywordWordCount = countWords(primaryKeyword);
  const keywordDensity = wordCount ? Math.round(((keywordOccurrences * keywordWordCount / wordCount) * 100) * 100) / 100 : 0;
  const intent = inferSearchIntent(`${input.title} ${h1s[0]?.text ?? ""} ${input.body.slice(0, 500)}`);
  const titleAlignment = primaryKeyword !== "Not detected" && input.title.toLowerCase().includes(primaryKeyword);
  const h1Alignment = primaryKeyword !== "Not detected" && h1s.some((heading) => heading.text.toLowerCase().includes(primaryKeyword));
  const entityClarity = meaningfulTokens(input.title).length > 1 && overlapRatio(input.title, input.body.slice(0, 500)) >= 0.3;
  const hasExtractionHook = /(?:^|\n)\s*(?:[-*]\s+|\d+[.)]\s+|\|.+\|)/m.test(input.body);
  const evidenceCount = input.body.match(/\b(?:\d+(?:\.\d+)?%?|\$\d+|19\d{2}|20\d{2})\b/g)?.length ?? 0;
  const attributionCount = input.body.match(/(?:https?:\/\/|\baccording to\b|\bsource(?:s)?\s*:|\bcited by\b)/gi)?.length ?? 0;
  const experienceSignals = input.body.match(/\b(?:we tested|we measured|our process|our technician|in practice|case study|firsthand)\b/gi)?.length ?? 0;
  const freshnessSignals = input.body.match(/\b(?:updated|reviewed|published)\s+(?:on\s+)?(?:19|20)\d{2}|\b(?:19|20)\d{2}\b/gi)?.length ?? 0;
  const slug = parsedUrl?.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const readableSlug = Boolean(slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !/^\d+$/.test(slug));
  const schemaDetected = /(?:application\/ld\+json|"@context"\s*:\s*"https?:\/\/schema\.org)/i.test(`${input.headings}\n${input.body}`);

  const pillars = [
    pillar("search-intent", "Search intent & keywords", [
      check("keyword-detected", "Identify a primary keyword", `Primary keyword inferred from supplied copy: ${primaryKeyword}.`, "Use one clear topic phrase consistently in the title, H1, opening, and supporting sections.", primaryKeyword === "Not detected" ? 0 : 4, 4),
      check("intent", "Match a recognizable search intent", `Detected ${intent.toLowerCase()} intent from the supplied language.`, "Clarify whether the page should inform, compare, navigate, or drive a transaction.", input.title || input.body ? 4 : 0, 4),
      check("keyword-title", "Place the topic in the title", titleAlignment ? "The inferred topic appears in the page title." : "The inferred topic does not appear as one phrase in the page title.", "Use the natural primary topic in the title without repetition.", titleAlignment ? 4 : 0, 4),
      check("keyword-h1", "Align the topic and H1", h1Alignment ? "The inferred topic appears in an H1." : "The inferred topic is not present in an H1.", "Use one H1 that clearly names the primary page topic.", h1Alignment ? 4 : 0, 4),
      check("keyword-density", "Keep topic usage natural", wordCount ? `Exact-phrase density is ${keywordDensity}% (${keywordOccurrences} occurrence${keywordOccurrences === 1 ? "" : "s"}).` : "No body copy was supplied for density analysis.", "Use the exact phrase only where natural; the audit target is 1.0%–2.2%.", keywordDensity >= 1 && keywordDensity <= 2.2 ? 4 : keywordDensity > 0 && keywordDensity <= 3 ? 2 : 0, 4),
    ]),
    pillar("aeo", "AEO & direct answers", [
      check("question-headings", "Use question-led sections", `${questionHeadings.length} question-led heading${questionHeadings.length === 1 ? "" : "s"} detected.`, "Add natural customer questions as headings and answer each immediately below.", questionHeadings.length >= 2 ? 4 : questionHeadings.length === 1 ? 2 : 0, 4),
      check("bluf", "Lead with a concise direct answer", sentences.length ? `The opening sentence contains ${firstSentenceWords} words.` : "No complete opening sentence was detected.", "Place an accurate 40–60 word bottom-line answer before supporting detail.", firstSentenceWords >= 40 && firstSentenceWords <= 60 ? 4 : firstSentenceWords >= 20 && firstSentenceWords <= 70 ? 2 : 0, 4),
      check("extraction-hooks", "Provide extractable formats", hasExtractionHook ? "A list or table pattern was detected in the supplied body." : "No list or table pattern was detected.", "Use a numbered list for steps, bullets for options, or a table for direct comparisons.", hasExtractionHook ? 4 : 0, 4),
      check("entity-clarity", "Name the subject clearly", entityClarity ? "Title language recurs in the opening body copy." : "The title topic is not clearly reinforced in the opening copy.", "Name the subject explicitly instead of relying on ambiguous pronouns.", entityClarity ? 4 : 0, 4),
      check("concise-sentences", "Keep answers scannable", sentences.length ? `Average sentence length is ${averageSentenceWords} words.` : "No complete body sentences were detected.", "Break long sentences into focused statements; target 24 words or fewer on average.", averageSentenceWords > 0 && averageSentenceWords <= 24 ? 4 : averageSentenceWords <= 30 && averageSentenceWords > 0 ? 2 : 0, 4),
    ]),
    pillar("eeat", "E-E-A-T & citation authority", [
      check("useful-depth", "Supply useful topic depth", `${wordCount} body words were supplied.`, "Add original, relevant detail that answers likely follow-up questions; avoid filler.", wordCount >= 500 ? 4 : wordCount >= 300 ? 3 : wordCount >= 150 ? 2 : 0, 4),
      check("hard-evidence", "Support claims with specifics", `${evidenceCount} numeric, date, percentage, or price signal${evidenceCount === 1 ? "" : "s"} detected.`, "Add only verified measurements, dates, prices, or statistics that support visible claims.", evidenceCount >= 3 ? 4 : evidenceCount ? 2 : 0, 4),
      check("attribution", "Attribute external claims", `${attributionCount} explicit source attribution signal${attributionCount === 1 ? "" : "s"} detected.`, "Cite reputable primary sources for external facts; do not add a citation unless it supports the claim.", attributionCount >= 2 ? 4 : attributionCount === 1 ? 2 : 0, 4),
      check("experience", "Show firsthand experience", `${experienceSignals} firsthand process or experience signal${experienceSignals === 1 ? "" : "s"} detected.`, "Describe verifiable firsthand testing, measurements, process, or case evidence where applicable.", experienceSignals >= 2 ? 4 : experienceSignals === 1 ? 2 : 0, 4),
      check("freshness", "State content freshness", `${freshnessSignals} date or review/update signal${freshnessSignals === 1 ? "" : "s"} detected.`, "Show an accurate published, reviewed, or updated date when freshness matters.", freshnessSignals >= 1 ? 4 : 0, 4),
    ]),
    pillar("structure", "Content structure & hierarchy", [
      check("single-h1", "Use one clear H1", `${h1s.length} H1 heading${h1s.length === 1 ? "" : "s"} detected.`, h1s.length ? "Keep one primary H1 and convert other top-level headings to H2." : "Add one H1 that states the page’s primary topic.", h1s.length === 1 ? 5 : 0, 5),
      check("hierarchy", "Maintain heading hierarchy", unrecognized.length ? `${unrecognized.length} heading line${unrecognized.length === 1 ? " is" : "s are"} missing a level.` : `${hierarchyJumps.length} skipped heading-level jump${hierarchyJumps.length === 1 ? "" : "s"} detected.`, "Label headings H1–H6 and nest sections without skipping levels.", recognized.length && !unrecognized.length && !hierarchyJumps.length ? 5 : 0, 5),
      check("paragraphs", "Keep paragraphs mobile-scannable", paragraphs.length ? `Average paragraph length is ${averageParagraphSentences} sentence${averageParagraphSentences === 1 ? "" : "s"}.` : "No body paragraphs were detected.", "Keep most paragraphs to 2–4 focused sentences.", averageParagraphSentences >= 2 && averageParagraphSentences <= 4 ? 4 : averageParagraphSentences > 0 && averageParagraphSentences <= 5 ? 2 : 0, 4),
      check("content-baseline", "Cover the page topic", `${wordCount} body words detected; 300+ is the audit baseline.`, "Expand only with useful answers, evidence, and related decision information.", wordCount >= 300 ? 3 : wordCount >= 150 ? 2 : 0, 3),
      check("visual-anchors", "Use scannable anchors", `${recognized.length} structured heading${recognized.length === 1 ? "" : "s"} and ${hasExtractionHook ? "an extraction format" : "no list/table"} detected.`, "Break the page into descriptive sections and use lists or tables where they improve comprehension.", recognized.length >= 3 && hasExtractionHook ? 3 : recognized.length >= 2 ? 2 : recognized.length ? 1 : 0, 3),
    ]),
    pillar("technical", "Technical SEO & schema", [
      check("url", "Provide a canonical URL", parsedUrl ? `Valid ${parsedUrl.protocol.replace(":", "").toUpperCase()} URL supplied.` : "No canonical URL was supplied.", "Add the exact canonical HTTP or HTTPS page URL.", parsedUrl ? 4 : 0, 4),
      check("https", "Use HTTPS", parsedUrl?.protocol === "https:" ? "The supplied canonical URL uses HTTPS." : parsedUrl ? "The supplied canonical URL uses HTTP." : "No URL was supplied.", "Use HTTPS as canonical and redirect HTTP traffic.", parsedUrl?.protocol === "https:" ? 3 : 0, 3),
      check("slug", "Use a descriptive slug", readableSlug ? `Readable slug detected: /${slug}.` : slug ? `The slug “${slug}” is not a concise lowercase phrase.` : "No descriptive page slug was supplied.", "Use a concise lowercase, hyphen-separated phrase.", readableSlug ? 3 : 0, 3),
      check("title", "Use a concise title tag", input.title ? `${input.title.length} characters; target range is 30–60.` : "No page title was supplied.", "Write an accurate unique title between 30 and 60 characters.", input.title.length >= 30 && input.title.length <= 60 ? 4 : input.title.length >= 20 && input.title.length <= 70 ? 2 : 0, 4),
      check("meta", "Use a useful meta description", input.metaDescription ? `${input.metaDescription.length} characters; target range is 140–160.` : "No meta description was supplied.", "Write an accurate meta description between 140 and 160 characters.", input.metaDescription.length >= 140 && input.metaDescription.length <= 160 ? 4 : input.metaDescription.length >= 120 && input.metaDescription.length <= 170 ? 2 : 0, 4),
      check("schema", "Check schema readiness", schemaDetected ? "A JSON-LD schema signal was detected in supplied content." : "No JSON-LD schema signal was detected in supplied content.", "Add schema only when it matches visible page content and the page is eligible for that schema type.", schemaDetected ? 2 : 0, 2),
    ]),
  ];

  const score = pillars.reduce((total, item) => total + item.score, 0);
  const { grade, band } = gradeForScore(score);
  const findings = pillars.flatMap((item) => item.checks.map((itemCheck) => Object.freeze({ ...itemCheck, area: item.name, pillarId: item.id })));
  const issueCount = findings.filter((item) => item.status !== "pass").length;
  const metrics = Object.freeze({ titleCharacters: input.title.length, metaCharacters: input.metaDescription.length, bodyWords: wordCount, headingCount: recognized.length, questionHeadingCount: questionHeadings.length, averageSentenceWords, fleschReadingEase: readability, readingLevel: readingLevel(readability), primaryKeyword, keywordDensity, searchIntent: intent });
  return { status: "complete", score, grade, band, summary: issueCount ? `${issueCount} evidence-backed improvement${issueCount === 1 ? "" : "s"} identified.` : "All deterministic checks passed.", errors: [], metrics, pillars: Object.freeze(pillars), findings: Object.freeze(findings) };
}

// # Local report
export function buildAuditReport(result) {
  if (!result || result.status !== "complete") throw new TypeError("A completed audit result is required.");
  const lines = ["# SEO & AEO Content Audit Report", "", "## Executive Summary", `- **Overall grade:** ${result.grade} (${result.score}/100, ${result.band})`, `- **Primary keyword:** ${result.metrics.primaryKeyword}`, `- **Search intent:** ${result.metrics.searchIntent}`, `- **Word count & readability:** ${result.metrics.bodyWords} words | Flesch ${result.metrics.fleschReadingEase ?? "N/A"} (${result.metrics.readingLevel})`, "", "## Five-pillar scorecard", "", "| Pillar | Score | Status |", "| --- | ---: | --- |", ...result.pillars.map((item) => `| ${item.name} | ${item.score}/20 | ${item.status} |`), "", "## Evidence and remediation", ""];
  for (const item of result.findings) {
    lines.push(`### ${item.title} — ${item.points}/${item.maxPoints}`, `- **Evidence:** ${item.evidence}`);
    if (item.status !== "pass") lines.push(`- **Remediation:** ${item.remediation}`);
    lines.push("");
  }
  lines.push("_This deterministic report analyzes only the content supplied. It does not verify rankings, indexing, citations, schema validity, or live-page behavior._", "");
  return lines.join("\n");
}

export default analyzeSeoAeoContent;
