// # Runnable tool manifest contract
export const TOOL_MANIFEST_SCHEMA_VERSION = 1;

export const TOOL_MATURITY = Object.freeze({
  implemented: "implemented",
  foundation: "foundation",
  notStarted: "not_started",
});

export const TOOL_RUNTIME = Object.freeze({
  client: "client",
  server: "server",
  hybrid: "hybrid",
});

export const TOOL_PERSISTENCE = Object.freeze({
  none: "none",
  session: "session",
  workspace: "workspace",
});

const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function validateStringList(value, path, errors, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    errors.push(`${path} must be ${allowEmpty ? "an" : "a non-empty"} array.`);
    return;
  }

  const seen = new Set();
  value.forEach((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      errors.push(`${path}[${index}] must be non-empty text.`);
      return;
    }
    if (seen.has(item)) errors.push(`${path} must not contain duplicate values.`);
    seen.add(item);
  });
}

export function validateToolManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return Object.freeze({ valid: false, errors: Object.freeze(["manifest must be an object."]) });
  }

  for (const field of ["id", "catalogKey", "workspaceId"]) {
    if (typeof manifest[field] !== "string" || !IDENTIFIER_PATTERN.test(manifest[field])) {
      errors.push(`${field} must be a lowercase kebab-case identifier.`);
    }
  }
  for (const field of ["name", "description", "category"]) {
    if (typeof manifest[field] !== "string" || !manifest[field].trim()) {
      errors.push(`${field} must be non-empty text.`);
    }
  }
  if (typeof manifest.version !== "string" || !VERSION_PATTERN.test(manifest.version)) {
    errors.push("version must be a semantic version.");
  }
  if (!Object.values(TOOL_MATURITY).includes(manifest.maturity)) {
    errors.push("maturity is not supported.");
  }
  if (!Object.values(TOOL_RUNTIME).includes(manifest.runtime)) {
    errors.push("runtime is not supported.");
  }
  if (typeof manifest.requiresNetwork !== "boolean") {
    errors.push("requiresNetwork must be a boolean.");
  }
  if (!Object.values(TOOL_PERSISTENCE).includes(manifest.persistence)) {
    errors.push("persistence is not supported.");
  }
  validateStringList(manifest.inputs, "inputs", errors);
  validateStringList(manifest.outputs, "outputs", errors);
  validateStringList(manifest.capabilities, "capabilities", errors);

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function defineToolManifest(manifest) {
  const validation = validateToolManifest(manifest);
  if (!validation.valid) {
    throw new TypeError(`Invalid tool manifest: ${validation.errors.join(" ")}`);
  }

  return Object.freeze({
    schemaVersion: TOOL_MANIFEST_SCHEMA_VERSION,
    ...manifest,
    // Compatibility aliases for existing tool consumers. They are derived so
    // they cannot drift from the canonical fields.
    key: manifest.id,
    runsClientSide: manifest.runtime === TOOL_RUNTIME.client,
    inputs: Object.freeze([...manifest.inputs]),
    outputs: Object.freeze([...manifest.outputs]),
    capabilities: Object.freeze([...manifest.capabilities]),
  });
}
