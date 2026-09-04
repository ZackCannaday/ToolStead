export const TOOL_MANIFEST = Object.freeze({
  id: "test-case-generator",
  name: "Test Case Generator",
  description:
    "Convert requirements, function contracts, API specifications, and schemas into traceable test cases.",
  category: "Quality & Testing",
  version: "1.0.0",
  runtime: "client",
  requiresNetwork: false,
  inputs: ["requirements", "function-contract", "api-specification", "schema"],
  outputs: ["test-cases", "csv"],
});
