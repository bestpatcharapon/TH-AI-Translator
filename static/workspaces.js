/* Each feature owns its data, pending request, debounce timer and assistant cache. */
function createWorkspace(name) {
  return {
    name,
    request: null,
    timer: null,
    documentFile: null,
    needsExtraction: false,
    assistantRequests: new Map(),
    sourceInfoCache: new Map(),
    assistant: null,
    glossary: [],
    studio: {
      open: false,
      analysis: null,
      comparison: null,
      otherText: "",
      audit: null,
      previous: null,
      requests: new Map(),
      revision: 0,
      status: "",
      error: false,
    },
    conversation: [],
    additional: [],
    additionalContext: null,
    additionalRequests: new Map(),
    chatRequests: new Map(),
    preferences: {
      context: "general",
      extraContext: "",
      multiple: false,
      targets: [],
      historyQuery: "",
      favoritesOnly: false,
    },
    view: {
      source: ["image", "document"].includes(name) ? "auto" : "th",
      target: "en",
      tone: "natural",
      input: "",
      output: "",
      outputLanguage: "en",
      reverseSpeaker: false,
      filename: "",
      fileStatus: "",
      fileError: false,
      status: "",
      statusError: false,
      scroll: 0,
    },
  };
}
const featureWorkspaces = new Map(
  ["text", "image", "document", "live"].map((name) => [name, createWorkspace(name)])
);
