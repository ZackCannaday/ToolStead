// # Tool contract
export const TOOL_MANIFEST = Object.freeze({
  id: "seo-aeo-content-analyzer",
  name: "SEO & AEO Content Analyzer",
  description:
    "Audit page copy for search visibility and answer-engine readiness with evidence-backed fixes.",
  category: "Marketing",
  version: "1.0.0",
  runsClientSide: true,
  inputs: Object.freeze(["url", "title", "metaDescription", "headings", "body"]),
  capabilities: Object.freeze([
    "On-page SEO scoring",
    "Answer-engine readiness checks",
    "Heading hierarchy review",
    "Evidence-backed remediation",
  ]),
});

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
  "your",
]);

const QUESTION_OPENERS = /^(what|why|how|when|where|who|which|can|could|do|does|is|are|should|will)\b/i;

// # Text utilities
export function countWords(value = "") {
  return String(value).trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function tokenize(value = "") {
  return new Set(
    String(value)
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) => token.length > 2 && !STOP_WORDS.has(token)) ?? [],
  );
}

function overlapRatio(left, right) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const matches = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return matches / Math.min(leftTokens.size, rightTokens.size);
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

export function inferSearchIntent(value = "") {
  const text = String(value).toLowerCase();
  if (/\b(login|sign in|contact|about|dashboard|portal)\b/.test(text)) return "Navigational";
  if (/\b(book|buy|order|schedule|hire|request|reserve|get (?:a )?quote)\b/.test(text)) return "Transactional";
  if (/\b(best|compare|comparison|versus|vs\.?|review|reviews|top|cost|price|pricing)\b/.test(text)) return "Commercial investigation";
  return "Informational";
}

function gradeForScore(score) {
  if (score >= 90) return { grade: "A", band: "Elite" };
  if (score >= 80) return { grade: "B", band: "Strong" };
  if (score >= 70) return { grade: "C", band: "Moderate" };
  if (score >= 60) return { grade: "D", band: "Weak" };
  return { grade: "F", band: "Critical" };
}

function parseHeadingLine(line, index) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const htmlMatch = trimmed.match(/^<h([1-6])[^>]*>(.*?)<\/h\1>$/i);
  if (htmlMatch) {
    return { level: Number(htmlMatch[1]), text: htmlMatch[2].replace(/<[^>]+>/g, "").trim(), line: index + 1 };
  }

  const labeledMatch = trimmed.match(/^h([1-6])\s*[:|-]\s*(.+)$/i);
  if (labeledMatch) {
    return { level: Number(labeledMatch[1]), text: labeledMatch[2].trim(), line: index + 1 };
  }

  const markdownMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (markdownMatch) {
    return { level: markdownMatch[1].length, text: markdownMatch[2].trim(), line: index + 1 };
  }

  return { level: null, text: trimmed, line: index + 1 };
}

export function parseHeadings(value = "") {
  const lines = Array.isArray(value)
    ? value.map((heading) =>
        typeof heading === "string"
          ? heading
          : `H${heading?.level ?? ""}: ${heading?.text ?? ""}`,
      )
    : String(value).split(/\r?\n/);

  return lines.map(parseHeadingLine).filter(Boolean);
}

function normalizeInput(rawInput = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new TypeError("Analyzer input must be an object.");
  }
  return {
    url: String(rawInput.url ?? "").trim(),
    title: String(rawInput.title ?? "").trim(),
    metaDescription: String(rawInput.metaDescription ?? "").trim(),
    headings: rawInput.headings ?? "",
    body: String(rawInput.body ?? "").trim(),
  };
}

function scoreStatus(points, maxPoints) {
  if (points === maxPoints) return "pass";
  if (points > 0) return "warning";
  return "error";
}

function finding({ id, area, title, evidence, remediation, points, maxPoints }) {
  return Object.freeze({
    id,
    area,
    title,
    evidence,
    remediation,
    points,
    maxPoints,
    status: scoreStatus(points, maxPoints),
  });
}

function scoreBand(score) {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Good foundation";
  if (score >= 50) return "Needs work";
  return "High priority";
}

// # Deterministic audit
export function analyzeSeoAeoContent(rawInput = {}) {
  let input;
  try {
    input = normalizeInput(rawInput);
  } catch (error) {
    return {
      status: "error",
      score: null,
      band: null,
      summary: "The supplied content could not be analyzed.",
      errors: [{ field: "input", message: error.message }],
      metrics: null,
      findings: [],
    };
  }

  const headingText = Array.isArray(input.headings)
    ? input.headings.map((item) => (typeof item === "string" ? item : item?.text ?? "")).join("")
    : String(input.headings).trim();
  const isEmpty = !input.url && !input.title && !input.metaDescription && !headingText && !input.body;
  if (isEmpty) {
    return {
      status: "empty",
      score: null,
      band: null,
      summary: "Add page content to run an SEO and AEO audit.",
      errors: [],
      metrics: null,
      findings: [],
    };
  }

  let parsedUrl = null;
  if (input.url) {
    try {
      parsedUrl = new URL(input.url);
      if (!/^https?:$/.test(parsedUrl.protocol)) parsedUrl = null;
    } catch {
      parsedUrl = null;
    }
  }
  if (input.url && !parsedUrl) {
    return {
      status: "error",
      score: null,
      band: null,
      summary: "Correct the highlighted input before running the audit.",
      errors: [{ field: "url", message: "Enter a complete HTTP or HTTPS URL." }],
      metrics: null,
      findings: [],
    };
  }

  const headings = parseHeadings(input.headings);
  const recognizedHeadings = headings.filter((heading) => heading.level);
  const h1s = recognizedHeadings.filter((heading) => heading.level === 1);
  const hierarchyJumps = recognizedHeadings.slice(1).filter((heading, index) => {
    const previous = recognizedHeadings[index];
    return heading.level - previous.level > 1;
  });
  const unrecognizedHeadings = headings.filter((heading) => !heading.level);
  const questionHeadings = recognizedHeadings.filter(
    (heading) => heading.text.endsWith("?") || QUESTION_OPENERS.test(heading.text),
  );
  const wordCount = countWords(input.body);
  const sentences = input.body
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const averageSentenceWords = sentences.length
    ? Math.round((wordCount / sentences.length) * 10) / 10
    : 0;
  const opening = input.body.split(/\s+/).slice(0, 70).join(" ");
  const hasDirectOpening = /[.!?]/.test(opening) && countWords(opening.split(/[.!?]/)[0]) >= 8;
  const titleH1Overlap = h1s.length ? overlapRatio(input.title, h1s[0].text) : 0;
  const slug = parsedUrl?.pathname
    .split("/")
    .filter(Boolean)
    .at(-1) ?? "";
  const readableSlug = Boolean(slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !/^\d+$/.test(slug));
  const findings = [];

  findings.push(
    finding({
      id: "url-valid",
      area: "URL",
      title: "Use a complete, crawlable page URL",
      evidence: parsedUrl ? `Valid ${parsedUrl.protocol.replace(":", "").toUpperCase()} URL supplied.` : "No page URL supplied.",
      remediation: "Add the exact canonical page URL, including https://.",
      points: parsedUrl ? 5 : 0,
      maxPoints: 5,
    }),
    finding({
      id: "url-slug",
      area: "URL",
      title: "Keep the final URL segment descriptive",
      evidence: readableSlug ? `Readable slug: /${slug}` : slug ? `Slug “${slug}” is not a concise lowercase phrase.` : "The URL has no descriptive page slug.",
      remediation: "Use a short, lowercase, hyphen-separated phrase that describes the page.",
      points: readableSlug ? 5 : 0,
      maxPoints: 5,
    }),
    finding({
      id: "title-present",
      area: "Title",
      title: "Give the page a unique title",
      evidence: input.title ? `Title supplied (${input.title.length} characters).` : "The page title is empty.",
      remediation: "Write a specific title that identifies the topic and differentiates this page.",
      points: input.title ? 10 : 0,
      maxPoints: 10,
    }),
    finding({
      id: "title-length",
      area: "Title",
      title: "Keep the title concise",
      evidence: input.title ? `${input.title.length} characters; target range is 30–60.` : "Title length cannot be assessed without a title.",
      remediation: "Revise the title to 30–60 characters without padding or keyword repetition.",
      points: input.title.length >= 30 && input.title.length <= 60 ? 7 : input.title.length >= 20 && input.title.length <= 70 ? 4 : 0,
      maxPoints: 7,
    }),
    finding({
      id: "meta-present",
      area: "Meta description",
      title: "Add a useful search-result description",
      evidence: input.metaDescription ? `Meta description supplied (${input.metaDescription.length} characters).` : "The meta description is empty.",
      remediation: "Summarize the page’s value and intended action in one accurate sentence.",
      points: input.metaDescription ? 8 : 0,
      maxPoints: 8,
    }),
    finding({
      id: "meta-length",
      area: "Meta description",
      title: "Use a scannable meta description length",
      evidence: input.metaDescription ? `${input.metaDescription.length} characters; target range is 120–160.` : "Meta length cannot be assessed without a description.",
      remediation: "Revise the description to 120–160 characters while preserving its main promise.",
      points: input.metaDescription.length >= 120 && input.metaDescription.length <= 160 ? 7 : input.metaDescription.length >= 90 && input.metaDescription.length <= 170 ? 4 : 0,
      maxPoints: 7,
    }),
    finding({
      id: "single-h1",
      area: "Headings",
      title: "Use one clear H1 heading",
      evidence: `${h1s.length} H1 heading${h1s.length === 1 ? "" : "s"} detected.`,
      remediation: h1s.length ? "Keep one primary H1 and convert other top-level headings to H2." : "Add one H1 that states the page’s primary topic.",
      points: h1s.length === 1 ? 10 : 0,
      maxPoints: 10,
    }),
    finding({
      id: "heading-hierarchy",
      area: "Headings",
      title: "Maintain a logical heading hierarchy",
      evidence: unrecognizedHeadings.length
        ? `${unrecognizedHeadings.length} line${unrecognizedHeadings.length === 1 ? " is" : "s are"} missing an H1–H6 level.`
        : hierarchyJumps.length
          ? `${hierarchyJumps.length} heading level jump${hierarchyJumps.length === 1 ? "" : "s"} detected.`
          : recognizedHeadings.length
            ? "No skipped heading levels detected."
            : "No structured headings detected.",
      remediation: "Label each line as H1–H6 and nest sections without skipping levels.",
      points: recognizedHeadings.length && !hierarchyJumps.length && !unrecognizedHeadings.length ? 8 : 0,
      maxPoints: 8,
    }),
    finding({
      id: "title-h1-alignment",
      area: "Relevance",
      title: "Align the title and primary heading",
      evidence: h1s.length && input.title ? `${Math.round(titleH1Overlap * 100)}% meaningful-term overlap between title and H1.` : "A title and one H1 are required for comparison.",
      remediation: "Use consistent topic language in the title and H1 while keeping both natural.",
      points: titleH1Overlap >= 0.5 ? 8 : titleH1Overlap >= 0.3 ? 4 : 0,
      maxPoints: 8,
    }),
    finding({
      id: "body-depth",
      area: "Content",
      title: "Cover the topic with enough useful detail",
      evidence: `${wordCount} body words detected; 300+ is the baseline for this audit.`,
      remediation: "Add original, relevant detail that answers follow-up questions; avoid filler.",
      points: wordCount >= 300 ? 8 : wordCount >= 150 ? 4 : 0,
      maxPoints: 8,
    }),
    finding({
      id: "direct-answer",
      area: "Answer readiness",
      title: "Lead with a direct answer",
      evidence: hasDirectOpening ? "A complete answer-style sentence appears within the first 70 words." : "No substantial answer-style sentence was detected near the opening.",
      remediation: "Answer the page’s main question in a concise opening sentence before adding detail.",
      points: hasDirectOpening ? 8 : 0,
      maxPoints: 8,
    }),
    finding({
      id: "question-sections",
      area: "Answer readiness",
      title: "Use headings that reflect real questions",
      evidence: `${questionHeadings.length} question-led heading${questionHeadings.length === 1 ? "" : "s"} detected.`,
      remediation: "Add at least one natural question heading and answer it immediately below.",
      points: questionHeadings.length >= 2 ? 7 : questionHeadings.length === 1 ? 4 : 0,
      maxPoints: 7,
    }),
    finding({
      id: "sentence-length",
      area: "Readability",
      title: "Keep sentences easy to scan",
      evidence: sentences.length ? `Average sentence length is ${averageSentenceWords} words.` : "No complete body sentences were detected.",
      remediation: "Break long sentences into focused statements; target a 24-word average or less.",
      points: averageSentenceWords > 0 && averageSentenceWords <= 24 ? 7 : averageSentenceWords <= 30 && averageSentenceWords > 0 ? 4 : 0,
      maxPoints: 7,
    }),
    finding({
      id: "https",
      area: "URL",
      title: "Serve the canonical page over HTTPS",
      evidence: parsedUrl?.protocol === "https:" ? "The supplied URL uses HTTPS." : parsedUrl ? "The supplied URL uses HTTP." : "No URL supplied.",
      remediation: "Use the HTTPS version as the canonical URL and redirect HTTP traffic.",
      points: parsedUrl?.protocol === "https:" ? 2 : 0,
      maxPoints: 2,
    }),
  );

  const score = findings.reduce((total, item) => total + item.points, 0);
  const issueCount = findings.filter((item) => item.status !== "pass").length;

  return {
    status: "complete",
    score,
    band: scoreBand(score),
    summary: issueCount
      ? `${issueCount} improvement${issueCount === 1 ? "" : "s"} identified with evidence and remediation.`
      : "All deterministic checks passed.",
    errors: [],
    metrics: Object.freeze({
      titleCharacters: input.title.length,
      metaCharacters: input.metaDescription.length,
      bodyWords: wordCount,
      headingCount: recognizedHeadings.length,
      questionHeadingCount: questionHeadings.length,
      averageSentenceWords,
    }),
    findings: Object.freeze(findings),
  };
}

export default analyzeSeoAeoContent;
