import { parseArgs, parseValue } from "./utils.js";

function ensureDocument() {
  if (typeof document === "undefined") {
    throw new Error("DOM commands require a browser-like environment with document.");
  }

  return document;
}

function getElement(selector) {
  const doc = ensureDocument();
  const element = doc.querySelector(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  return element;
}

export function runDOMCommand(line, variables = {}) {
  if (line.startsWith("andika")) {
    const [valueRaw] = parseArgs(line, "andika");
    console.log(parseValue(valueRaw, variables));
    return true;
  }

  if (line.startsWith("muburire")) {
    const [valueRaw] = parseArgs(line, "muburire");
    const value = parseValue(valueRaw, variables);

    if (typeof alert === "function") {
      alert(String(value));
    } else {
      console.warn("alert is not available in this environment:", value);
    }

    return true;
  }

  if (line.startsWith("shyiramo")) {
    const [selectorRaw, valueRaw] = parseArgs(line, "shyiramo");
    const selector = String(parseValue(selectorRaw, variables));
    const value = parseValue(valueRaw, variables);

    getElement(selector).innerText = String(value);
    return true;
  }

  if (line.startsWith("hindura_ibuju")) {
    const [selectorRaw, colorRaw] = parseArgs(line, "hindura_ibuju");
    const selector = String(parseValue(selectorRaw, variables));
    const color = String(parseValue(colorRaw, variables));

    getElement(selector).style.color = color;
    return true;
  }

  return false;
}
