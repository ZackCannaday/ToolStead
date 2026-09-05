import { analyzeSeoAeoContent } from "./analyzer.js";

// # Background analysis
self.onmessage = ({ data }) => {
  self.postMessage({ requestId: data.requestId, result: analyzeSeoAeoContent(data.input) });
};
