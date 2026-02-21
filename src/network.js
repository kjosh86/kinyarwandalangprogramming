import { parseArgs, parseValue } from "./utils.js";

function ensureDocument() {
  if (typeof document === "undefined") {
    throw new Error("fata(...) requires a browser-like environment with document.");
  }

  return document;
}

function ensureFetch() {
  if (typeof fetch !== "function") {
    throw new Error("Network commands require fetch to be available.");
  }
}

export async function networkCommand(line, variables = {}) {
  if (line.startsWith("fata")) {
    const [selectorRaw] = parseArgs(line, "fata");
    const selector = String(parseValue(selectorRaw, variables));

    const doc = ensureDocument();
    const form = doc.querySelector(selector);
    if (!form) {
      throw new Error(`Form not found: ${selector}`);
    }

    return new FormData(form);
  }

  if (line.startsWith("subiza")) {
    const [urlRaw, payloadRaw] = parseArgs(line, "subiza");
    const url = String(parseValue(urlRaw, variables));
    const payload = parseValue(payloadRaw, variables);
    ensureFetch();

    const body = payload instanceof FormData ? payload : JSON.stringify(payload);
    const headers = payload instanceof FormData ? undefined : { "Content-Type": "application/json" };

    return fetch(url, {
      method: "POST",
      headers,
      body
    });
  }

  if (line.startsWith("zana")) {
    const [urlRaw] = parseArgs(line, "zana");
    const url = String(parseValue(urlRaw, variables));
    ensureFetch();

    return fetch(url, { method: "GET" });
  }

  return null;
}
