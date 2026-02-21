const SINGLE_QUOTED = /^'([\s\S]*)'$/;
const DOUBLE_QUOTED = /^"([\s\S]*)"$/;

export function parseArgs(line, commandName) {
  const raw = extractArgString(line, commandName);
  return splitTopLevel(raw);
}

export function parseCommand(line) {
  const normalized = stripTrailingSemicolon(line.trim());
  const match = normalized.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);

  if (!match) {
    return null;
  }

  return {
    name: match[1],
    expression: normalized
  };
}

export function parseAssignment(line) {
  const normalized = stripTrailingSemicolon(line.trim());
  const match = normalized.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);

  if (!match) {
    return null;
  }

  return {
    variable: match[1],
    expression: match[2].trim()
  };
}

export function parseSingleQuoted(value) {
  const trimmed = value.trim();
  const match = trimmed.match(SINGLE_QUOTED);
  if (!match) {
    throw new Error(`Expected single-quoted string, got: ${value}`);
  }

  return match[1].replace(/\\'/g, "'");
}

export function parseValue(token, variables = {}) {
  const trimmed = token.trim();

  if (SINGLE_QUOTED.test(trimmed)) {
    return parseSingleQuoted(trimmed);
  }

  if (DOUBLE_QUOTED.test(trimmed)) {
    return JSON.parse(trimmed);
  }

  if (/^\{[\s\S]*\}$/.test(trimmed) || /^\[[\s\S]*\]$/.test(trimmed)) {
    return JSON.parse(trimmed);
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (trimmed === "null") {
    return null;
  }

  if (trimmed === "undefined") {
    return undefined;
  }

  if (hasVariable(variables, trimmed)) {
    return variables[trimmed];
  }

  throw new Error(`Unknown value or variable: ${trimmed}`);
}

export function hasVariable(scope, variableName) {
  return variableName in scope;
}

export function setVariable(scope, variableName, value) {
  let current = scope;

  while (current) {
    if (Object.prototype.hasOwnProperty.call(current, variableName)) {
      current[variableName] = value;
      return;
    }

    current = Object.getPrototypeOf(current);
  }

  scope[variableName] = value;
}

export function stripTrailingSemicolon(line) {
  return line.endsWith(";") ? line.slice(0, -1).trim() : line;
}

export function splitTopLevel(input) {
  const args = [];
  let current = "";
  let inSingleQuotes = false;
  let inDoubleQuotes = false;
  let bracketDepth = 0;
  let braceDepth = 0;
  let parenDepth = 0;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const prev = input[i - 1];

    if (!inDoubleQuotes && ch === "'" && prev !== "\\") {
      inSingleQuotes = !inSingleQuotes;
      current += ch;
      continue;
    }

    if (!inSingleQuotes && ch === '"' && prev !== "\\") {
      inDoubleQuotes = !inDoubleQuotes;
      current += ch;
      continue;
    }

    if (!inSingleQuotes && !inDoubleQuotes) {
      if (ch === "[") bracketDepth += 1;
      if (ch === "]") bracketDepth -= 1;
      if (ch === "{") braceDepth += 1;
      if (ch === "}") braceDepth -= 1;
      if (ch === "(") parenDepth += 1;
      if (ch === ")") parenDepth -= 1;

      if (ch === "," && bracketDepth === 0 && braceDepth === 0 && parenDepth === 0) {
        args.push(current.trim());
        current = "";
        continue;
      }
    }

    current += ch;
  }

  if (current.trim() !== "") {
    args.push(current.trim());
  }

  return args;
}

function extractArgString(line, commandName) {
  const normalized = stripTrailingSemicolon(line.trim());
  const prefix = `${commandName}(`;

  if (!normalized.startsWith(prefix) || !normalized.endsWith(")")) {
    throw new Error(`Invalid ${commandName} syntax: ${line}`);
  }

  return normalized.slice(prefix.length, -1).trim();
}
