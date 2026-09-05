const MAX_REQUIREMENTS = 200;
const MAX_REQUIREMENT_LENGTH = 2_000;
const MAX_SOURCE_LENGTH = 400_000;
const MAX_SQL_TABLES = 200;
const MAX_SQL_COLUMNS = 200;

export const CASE_TYPES = Object.freeze(["positive", "negative", "boundary"]);
export const PRIORITIES = Object.freeze(["P0", "P1", "P2", "P3"]);
export const SOURCE_TYPES = Object.freeze(["requirements", "function", "api", "schema"]);

// # Normalize source text
function cleanText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function stableHash(value) {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

function normalizeId(value, text) {
  const supplied = cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return supplied || `REQ-${stableHash(text).slice(0, 7)}`;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  const text = cleanText(value);
  return text ? [text] : [];
}

function normalizeRequirement(value, sourceLine = null) {
  if (typeof value === "string") {
    const match = value.match(
      /^\s*(?:[-*]\s*)?(?:(REQ(?:UIREMENT)?[-_\s.]?[A-Z0-9._-]+)\s*[:|]\s*)?(.+)$/i,
    );
    const text = cleanText(match?.[2] ?? value.replace(/^\s*[-*]\s*/, ""));
    return {
      id: normalizeId(match?.[1], text),
      text,
      title: "",
      priority: "",
      preconditions: [],
      acceptanceCriteria: [],
      boundaryValues: [],
      sourceType: "requirements",
      testLevel: "acceptance",
      sourceLine,
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      id: "",
      text: "",
      title: "",
      priority: "",
      preconditions: [],
      acceptanceCriteria: [],
      boundaryValues: [],
      sourceType: "requirements",
      testLevel: "acceptance",
      sourceLine,
    };
  }

  const text = cleanText(
    value.text ?? value.description ?? value.requirement ?? value.title,
  );
  return {
    id: normalizeId(value.id ?? value.requirementId, text),
    text,
    title: cleanText(value.title),
    priority: cleanText(value.priority).toUpperCase(),
    preconditions: normalizeList(value.preconditions ?? value.precondition),
    acceptanceCriteria: normalizeList(
      value.acceptanceCriteria ?? value.acceptance_criteria ?? value.criteria,
    ),
    boundaryValues: normalizeList(value.boundaryValues ?? value.boundary_values),
    sourceType: SOURCE_TYPES.includes(value.sourceType) ? value.sourceType : "requirements",
    testLevel: cleanText(value.testLevel) || "acceptance",
    sourceLine: value.sourceLine ?? sourceLine,
  };
}

// # Parse requirement input
export function parseRequirements(input) {
  if (typeof input === "string") {
    return input
      .split(/\n/)
      .map((line, index) => ({ line, sourceLine: index + 1 }))
      .filter(({ line }) => cleanText(line))
      .map(({ line, sourceLine }) => normalizeRequirement(line, sourceLine));
  }

  if (Array.isArray(input)) {
    return input.map((item, index) => normalizeRequirement(item, index + 1));
  }

  return [];
}

function parseJsonSource(input, label) {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) return input;
  if (typeof input !== "string") throw new TypeError(`${label} must be a JSON object or text.`);
  try {
    const value = JSON.parse(input);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new TypeError(`${label} must be valid JSON.`);
  }
}

// # Parse function contracts
function parseFunctionSource(input) {
  if (typeof input !== "string") throw new TypeError("Function source must be text.");
  const signatures = [];
  const patterns = [
    /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g,
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?([A-Za-z_$][\w$]*)\s*=>/g,
    /(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)/g,
  ];
  patterns.forEach((pattern) => {
    for (const match of input.matchAll(pattern)) {
      signatures.push({ name: match[1], parameters: cleanText(match[2]) });
    }
  });

  return signatures.map(({ name, parameters }, index) =>
    normalizeRequirement(
      {
        id: `FN-${name}`,
        title: `${name} public contract`,
        text: `${name} must satisfy its public input and output contract${parameters ? ` for parameters: ${parameters}` : ""}.`,
        preconditions: [`The public function ${name} is available in an isolated test harness.`],
        acceptanceCriteria: [
          "Returned values conform to the public contract",
          "Documented errors remain observable to the caller",
          "Inputs are not mutated unless mutation is part of the public contract",
        ],
        boundaryValues: ["null or undefined input", "empty input", "minimum valid input", "largest supported input"],
        sourceType: "function",
        testLevel: "unit",
      },
      index + 1,
    ),
  );
}

function documentedResponses(operation) {
  const responses = operation?.responses && typeof operation.responses === "object"
    ? Object.keys(operation.responses)
    : [];
  return responses.length ? `Documented response statuses: ${responses.join(", ")}` : "Response matches the documented contract";
}

// # Parse API contracts
function parseApiSource(input) {
  if (typeof input === "string" && !input.trim().startsWith("{")) {
    const endpoints = [...input.matchAll(/\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\/[^\s]*)/gi)];
    return endpoints.map((match, index) =>
      normalizeRequirement(
        {
          id: `API-${match[1]}-${stableHash(match[2]).slice(0, 5)}`,
          title: `${match[1].toUpperCase()} ${match[2]}`,
          text: `${match[1].toUpperCase()} ${match[2]} must enforce its request contract and return a documented response.`,
          preconditions: ["The API is available in an isolated integration test environment."],
          acceptanceCriteria: ["The response status and body match the documented endpoint contract"],
          boundaryValues: ["request without optional fields", "request at documented limits", "request one unit beyond a documented limit"],
          sourceType: "api",
          testLevel: "integration",
        },
        index + 1,
      ),
    );
  }

  const specification = parseJsonSource(input, "API specification");
  const methods = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
  const requirements = [];
  Object.entries(specification.paths ?? {}).forEach(([path, pathItem]) => {
    Object.entries(pathItem ?? {}).forEach(([method, operation]) => {
      if (!methods.has(method.toLowerCase())) return;
      const requiredParameters = [
        ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
        ...(Array.isArray(operation?.parameters) ? operation.parameters : []),
      ].filter((parameter) => parameter?.required).map((parameter) => parameter.name).filter(Boolean);
      const acceptanceCriteria = [documentedResponses(operation)];
      if (requiredParameters.length) {
        acceptanceCriteria.push(`Required parameters are enforced: ${requiredParameters.join(", ")}`);
      }
      if (operation?.requestBody?.required) acceptanceCriteria.push("A request body is required");
      requirements.push(
        normalizeRequirement(
          {
            id: operation?.operationId || `API-${method}-${stableHash(path).slice(0, 5)}`,
            title: `${method.toUpperCase()} ${path}`,
            text: `${method.toUpperCase()} ${path} must enforce its request contract and return a documented response.`,
            preconditions: ["The API is available in an isolated integration test environment."],
            acceptanceCriteria,
            boundaryValues: ["request without optional fields", "request at documented limits", "request one unit beyond a documented limit"],
            sourceType: "api",
            testLevel: "integration",
          },
          requirements.length + 1,
        ),
      );
    });
  });
  return requirements;
}

function schemaConstraints(name, schema, required) {
  const constraints = [];
  if (schema?.type) constraints.push(`type ${schema.type}`);
  if (required) constraints.push("required");
  if (schema?.format) constraints.push(`format ${schema.format}`);
  if (schema?.minimum !== undefined) constraints.push(`minimum ${schema.minimum}`);
  if (schema?.maximum !== undefined) constraints.push(`maximum ${schema.maximum}`);
  if (schema?.minLength !== undefined) constraints.push(`minimum length ${schema.minLength}`);
  if (schema?.maxLength !== undefined) constraints.push(`maximum length ${schema.maxLength}`);
  if (Array.isArray(schema?.enum)) constraints.push(`allowed values ${schema.enum.map(String).join(", ")}`);
  if (schema?.pattern) constraints.push(`pattern ${schema.pattern}`);
  return constraints.length ? `${name} constraints: ${constraints.join("; ")}` : `${name} matches its declared schema`;
}

function schemaBoundaries(schema, required) {
  const values = [];
  if (!required) values.push("omitted optional field");
  if (schema?.minimum !== undefined) values.push(String(schema.minimum - 1), String(schema.minimum), String(schema.minimum + 1));
  if (schema?.maximum !== undefined) values.push(String(schema.maximum - 1), String(schema.maximum), String(schema.maximum + 1));
  if (schema?.minLength !== undefined) values.push(`${Math.max(0, schema.minLength - 1)} characters`, `${schema.minLength} characters`, `${schema.minLength + 1} characters`);
  if (schema?.maxLength !== undefined) values.push(`${Math.max(0, schema.maxLength - 1)} characters`, `${schema.maxLength} characters`, `${schema.maxLength + 1} characters`);
  if (Array.isArray(schema?.enum)) values.push(...schema.enum.map((value) => `allowed value ${String(value)}`), "value outside the allowed set");
  return [...new Set(values.length ? values : ["empty value", "smallest valid value", "unsupported value"] )];
}

// # Scan SQL safely
function isSqlWordCharacter(character) {
  return Boolean(character) && /[A-Za-z0-9_$]/.test(character);
}

function sqlKeywordAt(source, index, keyword) {
  const candidate = source.slice(index, index + keyword.length);
  return (
    candidate.toUpperCase() === keyword &&
    !isSqlWordCharacter(source[index - 1]) &&
    !isSqlWordCharacter(source[index + keyword.length])
  );
}

function skipSqlQuotedValue(source, index, quote) {
  const closingQuote = quote === "[" ? "]" : quote;
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] !== closingQuote) {
      cursor += 1;
      continue;
    }
    if (source[cursor + 1] === closingQuote) {
      cursor += 2;
      continue;
    }
    return cursor + 1;
  }
  return source.length;
}

function skipSqlTrivia(source, index) {
  let cursor = index;
  while (cursor < source.length) {
    if (/\s/.test(source[cursor])) {
      cursor += 1;
      continue;
    }
    if (source[cursor] === "-" && source[cursor + 1] === "-") {
      const newline = source.indexOf("\n", cursor + 2);
      cursor = newline === -1 ? source.length : newline + 1;
      continue;
    }
    if (source[cursor] === "/" && source[cursor + 1] === "*") {
      const commentEnd = source.indexOf("*/", cursor + 2);
      cursor = commentEnd === -1 ? source.length : commentEnd + 2;
      continue;
    }
    break;
  }
  return cursor;
}

function readSqlIdentifier(source, index) {
  const quote = source[index];
  if (quote === '"' || quote === "`" || quote === "[") {
    const end = skipSqlQuotedValue(source, index, quote);
    if (end >= source.length && source[source.length - 1] !== (quote === "[" ? "]" : quote)) {
      return null;
    }
    const raw = source.slice(index + 1, end - 1);
    const escapedQuote = `${quote === "[" ? "]" : quote}${quote === "[" ? "]" : quote}`;
    return {
      value: raw.replaceAll(escapedQuote, quote === "[" ? "]" : quote),
      end,
    };
  }

  let end = index;
  while (end < source.length && /[A-Za-z0-9_.-]/.test(source[end])) end += 1;
  return end === index ? null : { value: source.slice(index, end), end };
}

function findSqlTableClose(source, openIndex) {
  let depth = 1;
  for (let cursor = openIndex + 1; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (character === "'" || character === '"' || character === "`" || character === "[") {
      cursor = skipSqlQuotedValue(source, cursor, character) - 1;
      continue;
    }
    if (character === "-" && source[cursor + 1] === "-") {
      const newline = source.indexOf("\n", cursor + 2);
      if (newline === -1) return -1;
      cursor = newline;
      continue;
    }
    if (character === "/" && source[cursor + 1] === "*") {
      const commentEnd = source.indexOf("*/", cursor + 2);
      if (commentEnd === -1) return -1;
      cursor = commentEnd + 1;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return cursor;
    }
  }
  return -1;
}

function splitSqlColumns(source) {
  const definitions = [];
  let start = 0;
  let depth = 0;
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (character === "'" || character === '"' || character === "`" || character === "[") {
      cursor = skipSqlQuotedValue(source, cursor, character) - 1;
      continue;
    }
    if (character === "-" && source[cursor + 1] === "-") {
      const newline = source.indexOf("\n", cursor + 2);
      cursor = newline === -1 ? source.length : newline;
      continue;
    }
    if (character === "/" && source[cursor + 1] === "*") {
      const commentEnd = source.indexOf("*/", cursor + 2);
      cursor = commentEnd === -1 ? source.length : commentEnd + 1;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")" && depth > 0) depth -= 1;
    if (character === "," && depth === 0) {
      definitions.push(source.slice(start, cursor));
      start = cursor + 1;
    }
  }
  definitions.push(source.slice(start));
  return definitions;
}

function findSqlTables(source) {
  const tables = [];
  let cursor = 0;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === "'" || character === '"' || character === "`" || character === "[") {
      cursor = skipSqlQuotedValue(source, cursor, character);
      continue;
    }
    if (character === "-" && source[cursor + 1] === "-") {
      cursor = skipSqlTrivia(source, cursor);
      continue;
    }
    if (character === "/" && source[cursor + 1] === "*") {
      cursor = skipSqlTrivia(source, cursor);
      continue;
    }
    if (!sqlKeywordAt(source, cursor, "CREATE")) {
      cursor += 1;
      continue;
    }

    let statement = skipSqlTrivia(source, cursor + 6);
    if (!sqlKeywordAt(source, statement, "TABLE")) {
      cursor += 6;
      continue;
    }
    statement = skipSqlTrivia(source, statement + 5);
    if (sqlKeywordAt(source, statement, "IF")) {
      statement = skipSqlTrivia(source, statement + 2);
      if (!sqlKeywordAt(source, statement, "NOT")) {
        cursor += 6;
        continue;
      }
      statement = skipSqlTrivia(source, statement + 3);
      if (!sqlKeywordAt(source, statement, "EXISTS")) {
        cursor += 6;
        continue;
      }
      statement = skipSqlTrivia(source, statement + 6);
    }

    const identifier = readSqlIdentifier(source, statement);
    if (!identifier) {
      cursor += 6;
      continue;
    }
    statement = skipSqlTrivia(source, identifier.end);
    if (source[statement] !== "(") {
      cursor = identifier.end;
      continue;
    }
    const close = findSqlTableClose(source, statement);
    if (close === -1) {
      throw new TypeError("SQL schema contains an unclosed CREATE TABLE definition.");
    }
    tables.push({ name: identifier.value, columns: source.slice(statement + 1, close) });
    if (tables.length > MAX_SQL_TABLES) {
      throw new TypeError(`SQL schema exceeds the ${MAX_SQL_TABLES}-table limit.`);
    }
    cursor = close + 1;
  }
  return tables;
}

// # Parse data schemas
function parseSchemaSource(input) {
  if (typeof input === "string" && !input.trimStart().startsWith("{")) {
    const tables = findSqlTables(input);
    if (tables.length > 0) {
      const requirements = [];
      for (const { name: tableName, columns: columnsText } of tables) {
        splitSqlColumns(columnsText).forEach((definition) => {
          const column = definition.trim().match(/^["`]?([A-Za-z_]\w*)["`]?\s+([A-Za-z]+(?:\s*\([^)]*\))?)([\s\S]*)$/);
          if (!column || /^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)$/i.test(column[1])) return;
          const [, columnName, dataType, constraints] = column;
          const required = /\bNOT\s+NULL\b/i.test(constraints);
          requirements.push(
            normalizeRequirement(
              {
                id: `SCHEMA-${tableName}-${columnName}`,
                title: `${tableName}.${columnName} column contract`,
                text: `Column ${tableName}.${columnName} must conform to its declared database constraints.`,
                acceptanceCriteria: [
                  `${columnName} constraints: type ${cleanText(dataType)}${required ? "; required" : ""}${constraints.trim() ? `; ${cleanText(constraints)}` : ""}`,
                ],
                boundaryValues: required
                  ? ["null value", "smallest valid value", "largest supported value"]
                  : ["omitted optional value", "null value", "largest supported value"],
                sourceType: "schema",
                testLevel: "integration",
              },
              requirements.length + 1,
            ),
          );
          if (requirements.length > MAX_SQL_COLUMNS) {
            throw new TypeError(`SQL schema exceeds the ${MAX_SQL_COLUMNS}-column limit.`);
          }
        });
      }
      return requirements;
    }
  }

  const schema = parseJsonSource(input, "Schema");
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  return Object.entries(schema.properties ?? {}).map(([name, propertySchema], index) =>
    normalizeRequirement(
      {
        id: `SCHEMA-${name}`,
        title: `${name} field contract`,
        text: `Field ${name} must conform to its declared schema constraints.`,
        acceptanceCriteria: [schemaConstraints(name, propertySchema, required.has(name))],
        boundaryValues: schemaBoundaries(propertySchema, required.has(name)),
        sourceType: "schema",
        testLevel: "unit",
      },
      index + 1,
    ),
  );
}

// # Route source parsing
export function parseSource(input, sourceType = "requirements") {
  if (!SOURCE_TYPES.includes(sourceType)) throw new TypeError(`Unsupported source type: ${sourceType}.`);
  if (typeof input === "string" && input.length > MAX_SOURCE_LENGTH) {
    throw new TypeError(`Source text exceeds the ${MAX_SOURCE_LENGTH.toLocaleString("en-US")}-character limit.`);
  }
  if (sourceType === "function") return parseFunctionSource(input);
  if (sourceType === "api") return parseApiSource(input);
  if (sourceType === "schema") return parseSchemaSource(input);
  return parseRequirements(input);
}

function requirementWarnings(requirement) {
  const warnings = [];
  if (requirement.text.length < 12) {
    warnings.push("Requirement may be too brief to produce a precise test.");
  }
  if (/\b(works?|properly|correctly|user[- ]friendly|fast)\b/i.test(requirement.text)) {
    warnings.push("Requirement contains a term that may not be objectively verifiable.");
  }
  if (!/\b(must|shall|should|can|allows?|prevents?|returns?|shows?|creates?|updates?|deletes?|accepts?|rejects?|requires?)\b/i.test(requirement.text)) {
    warnings.push("Requirement may be missing a clear, testable behavior.");
  }
  return warnings;
}

// # Validate generator input
export function validateRequirements(input, options = {}) {
  const errors = [];
  const warnings = [];

  const sourceType = options.sourceType ?? "requirements";
  const acceptsObject = sourceType === "api" || sourceType === "schema";
  if (typeof input !== "string" && !Array.isArray(input) && !(acceptsObject && input && typeof input === "object")) {
    errors.push({ code: "INVALID_INPUT", message: "Requirements must be text or an array." });
    return { valid: false, errors, warnings, requirements: [] };
  }

  let requirements = [];
  try {
    requirements = parseSource(input, sourceType);
  } catch (reason) {
    errors.push({ code: "INVALID_SOURCE", message: reason.message });
    return { valid: false, errors, warnings, requirements };
  }
  if (requirements.length === 0) {
    errors.push({ code: "EMPTY_INPUT", message: "Enter at least one requirement." });
  }
  if (requirements.length > MAX_REQUIREMENTS) {
    errors.push({
      code: "TOO_MANY_REQUIREMENTS",
      message: `A maximum of ${MAX_REQUIREMENTS} requirements can be generated at once.`,
    });
  }

  const seenIds = new Set();
  requirements.forEach((requirement, index) => {
    const location = requirement.sourceLine ?? index + 1;
    if (!requirement.text) {
      errors.push({
        code: "EMPTY_REQUIREMENT",
        requirementId: requirement.id || null,
        message: `Requirement ${location} has no description.`,
      });
      return;
    }
    if (requirement.text.length > MAX_REQUIREMENT_LENGTH) {
      errors.push({
        code: "REQUIREMENT_TOO_LONG",
        requirementId: requirement.id,
        message: `${requirement.id} exceeds ${MAX_REQUIREMENT_LENGTH} characters.`,
      });
    }
    if (seenIds.has(requirement.id)) {
      errors.push({
        code: "DUPLICATE_ID",
        requirementId: requirement.id,
        message: `${requirement.id} is duplicated. Requirement IDs must be unique.`,
      });
    }
    seenIds.add(requirement.id);
    if (requirement.priority && !PRIORITIES.includes(requirement.priority)) {
      errors.push({
        code: "INVALID_PRIORITY",
        requirementId: requirement.id,
        message: `${requirement.id} uses an unsupported priority. Use P0, P1, P2, or P3.`,
      });
    }
    requirementWarnings(requirement).forEach((message) => {
      warnings.push({ requirementId: requirement.id, message });
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    requirements,
  };
}

// # Infer testing priority
function inferPriority(requirement, fallbackPriority) {
  if (PRIORITIES.includes(requirement.priority)) return requirement.priority;
  if (PRIORITIES.includes(fallbackPriority)) return fallbackPriority;
  if (/\b(critical|security|authentication|authorization|passwords?|credentials?|sessions?|payments?|billing|data loss)\b/i.test(requirement.text)) {
    return "P0";
  }
  if (/\b(must|shall|required|prevent|core)\b/i.test(requirement.text)) return "P1";
  if (/\b(optional|may|nice to have)\b/i.test(requirement.text)) return "P3";
  return "P2";
}

function requirementSubject(requirement) {
  const subject = cleanText(requirement.title || requirement.text)
    .replace(/[.!?]+$/, "")
    .replace(/^(the system|the application|users?|customers?)\s+(must|shall|should|can)\s+/i, "")
    .replace(/^(must|shall|should|can)\s+/i, "");
  return subject.length > 92 ? `${subject.slice(0, 89).trimEnd()}…` : subject;
}

function numericBoundaries(text) {
  const between = text.match(/\bbetween\s+(-?\d+(?:\.\d+)?)\s+and\s+(-?\d+(?:\.\d+)?)/i);
  if (between) {
    const lower = Number(between[1]);
    const upper = Number(between[2]);
    return [lower - 1, lower, lower + 1, upper - 1, upper, upper + 1];
  }

  const range = text.match(/\b(-?\d+(?:\.\d+)?)\s*(?:-|to|through)\s*(-?\d+(?:\.\d+)?)\b/i);
  if (range) {
    const lower = Number(range[1]);
    const upper = Number(range[2]);
    return [lower - 1, lower, lower + 1, upper - 1, upper, upper + 1];
  }

  const minimum = text.match(/\b(?:at least|minimum(?: of)?|min(?:imum)?[:=]?)\s*(-?\d+(?:\.\d+)?)/i);
  if (minimum) {
    const value = Number(minimum[1]);
    return [value - 1, value, value + 1];
  }

  const maximum = text.match(/\b(?:at most|no more than|maximum(?: of)?|max(?:imum)?[:=]?|up to)\s*(-?\d+(?:\.\d+)?)/i);
  if (maximum) {
    const value = Number(maximum[1]);
    return [value - 1, value, value + 1];
  }

  return [];
}

function boundaryValues(requirement) {
  if (requirement.boundaryValues.length) return requirement.boundaryValues;
  const numbers = [...new Set(numericBoundaries(requirement.text))];
  if (numbers.length) return numbers.map(String);
  if (/\b(email|e-mail)\b/i.test(requirement.text)) {
    return ["minimum valid address", "address at the supported length limit", "malformed address"];
  }
  if (/\b(date|time|schedule|deadline)\b/i.test(requirement.text)) {
    return ["earliest allowed value", "latest allowed value", "one unit outside each limit"];
  }
  if (/\b(file|upload|attachment|image)\b/i.test(requirement.text)) {
    return ["smallest supported file", "maximum supported file", "one unit above the size limit"];
  }
  if (/\b(count|quantity|items?|records?|characters?|length|password|number|amount)\b/i.test(requirement.text)) {
    return ["empty value", "minimum supported value", "maximum supported value", "one unit outside each limit"];
  }
  return ["empty state", "smallest meaningful input", "largest supported input", "one unsupported extreme"];
}

function basePreconditions(requirement) {
  const inherited = requirement.preconditions;
  return inherited.length
    ? [...inherited]
    : [`The feature traced to ${requirement.id} is available in a controlled test environment.`];
}

function expectedResult(requirement, type) {
  const criteria = requirement.acceptanceCriteria;
  if (criteria.length) {
    const qualifier =
      type === "negative"
        ? "Invalid input is rejected safely, and the applicable acceptance criteria remain satisfied"
        : type === "boundary"
          ? "Supported limits are accepted, unsupported limits are rejected, and the applicable acceptance criteria remain satisfied"
          : "All acceptance criteria are satisfied";
    return `${qualifier}: ${criteria.join("; ")}.`;
  }
  if (type === "negative") {
    return `The system rejects the invalid or missing condition without unintended changes and gives actionable feedback consistent with ${requirement.id}.`;
  }
  if (type === "boundary") {
    return `Values at supported limits satisfy ${requirement.id}; values outside those limits are rejected without unintended changes.`;
  }
  return `The requested behavior completes successfully and satisfies ${requirement.id}: ${requirement.text}`;
}

function makeCase(requirement, type, priority) {
  const typeCode = { positive: "POS", negative: "NEG", boundary: "BND" }[type];
  const subject = requirementSubject(requirement);
  const titles = {
    positive: `Complete valid flow: ${subject}`,
    negative: `Reject invalid flow: ${subject}`,
    boundary: `Enforce limits: ${subject}`,
  };
  const steps = {
    positive: [
      `Arrange — Prepare valid state and input for ${requirement.id}.`,
      `Act — Perform the behavior described by the requirement: ${requirement.text}`,
      "Assert — Observe the public result and any documented state change.",
    ],
    negative: [
      `Arrange — Prepare state for ${requirement.id} with one required condition missing or invalid.`,
      `Act — Attempt the behavior described by the requirement: ${requirement.text}`,
      "Assert — Observe the public error and verify that no unintended state change occurs.",
    ],
    boundary: [
      `Arrange — Identify the supported limits for ${requirement.id}.`,
      `Act — Exercise these boundary values: ${boundaryValues(requirement).join(", ")}.`,
      "Assert — Compare each public outcome with the supported and unsupported limits.",
    ],
  };

  return {
    id: `TC-${requirement.id}-${typeCode}`,
    requirementId: requirement.id,
    requirement: requirement.text,
    title: titles[type],
    type,
    priority,
    testLevel: requirement.testLevel,
    preconditions: basePreconditions(requirement),
    steps: steps[type].map((action, index) => ({ number: index + 1, action })),
    expectedResult: expectedResult(requirement, type),
    traceability: {
      requirementId: requirement.id,
      sourceLine: requirement.sourceLine,
      acceptanceCriteria: [...requirement.acceptanceCriteria],
    },
  };
}

// # Generate traceable cases
export function generateTestCases(input, options = {}) {
  const validation = validateRequirements(input, options);
  if (!validation.valid) {
    const error = new Error(validation.errors.map(({ message }) => message).join(" "));
    error.name = "TestCaseValidationError";
    error.errors = validation.errors;
    throw error;
  }

  const requestedTypes = options.types ?? CASE_TYPES;
  if (
    !Array.isArray(requestedTypes) ||
    requestedTypes.length === 0 ||
    requestedTypes.some((type) => !CASE_TYPES.includes(type))
  ) {
    throw new TypeError("Case types must include positive, negative, or boundary.");
  }

  const types = CASE_TYPES.filter((type) => requestedTypes.includes(type));
  return validation.requirements.flatMap((requirement) => {
    const priority = inferPriority(requirement, options.defaultPriority);
    return types.map((type) => makeCase(requirement, type, priority));
  });
}

function protectSpreadsheetFormula(value) {
  const text = String(value ?? "");
  return /^[\u0000-\u0020\u007f]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  const protectedValue = protectSpreadsheetFormula(value);
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

// # Export cases safely
export function exportTestCasesCsv(testCases) {
  if (!Array.isArray(testCases)) {
    throw new TypeError("Test cases must be an array.");
  }
  const columns = [
    "Test Case ID",
    "Requirement ID",
    "Requirement",
    "Title",
    "Type",
    "Priority",
    "Test Level",
    "Preconditions",
    "Steps",
    "Expected Result",
    "Source Line",
    "Acceptance Criteria",
  ];
  const rows = testCases.map((testCase) => [
    testCase.id,
    testCase.requirementId,
    testCase.requirement,
    testCase.title,
    testCase.type,
    testCase.priority,
    testCase.testLevel,
    normalizeList(testCase.preconditions).join("\n"),
    Array.isArray(testCase.steps)
      ? testCase.steps.map((step) => `${step.number}. ${step.action}`).join("\n")
      : "",
    testCase.expectedResult,
    testCase.traceability?.sourceLine ?? "",
    normalizeList(testCase.traceability?.acceptanceCriteria).join("\n"),
  ]);

  return [columns, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
