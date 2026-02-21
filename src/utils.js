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

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
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

  const expressionValue = tryEvaluateExpression(trimmed, variables);
  if (expressionValue !== undefined) {
    return expressionValue;
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

function tryEvaluateExpression(expression, variables) {
  const unwrapped = stripEnclosingParentheses(expression);
  if (unwrapped !== expression) {
    return parseValue(unwrapped, variables);
  }

  const addSubOperator = findTopLevelOperator(expression, ["+", "-"]);
  if (addSubOperator) {
    const leftRaw = expression.slice(0, addSubOperator.index).trim();
    const rightRaw = expression.slice(addSubOperator.index + 1).trim();
    const left = parseValue(leftRaw, variables);
    const right = parseValue(rightRaw, variables);

    if (addSubOperator.operator === "+") {
      if (typeof left === "string" || typeof right === "string") {
        return `${left}${right}`;
      }

      return toNumber(left, leftRaw) + toNumber(right, rightRaw);
    }

    return toNumber(left, leftRaw) - toNumber(right, rightRaw);
  }

  const mulDivOperator = findTopLevelOperator(expression, ["*", "/", "%"]);
  if (mulDivOperator) {
    const leftRaw = expression.slice(0, mulDivOperator.index).trim();
    const rightRaw = expression.slice(mulDivOperator.index + 1).trim();
    const left = toNumber(parseValue(leftRaw, variables), leftRaw);
    const right = toNumber(parseValue(rightRaw, variables), rightRaw);

    if (mulDivOperator.operator === "*") {
      return left * right;
    }

    if (mulDivOperator.operator === "/") {
      return left / right;
    }

    return left % right;
  }

  return undefined;
}

function findTopLevelOperator(expression, operators) {
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let inSingleQuotes = false;
  let inDoubleQuotes = false;

  for (let index = expression.length - 1; index >= 0; index -= 1) {
    const char = expression[index];
    const previous = expression[index - 1];

    if (!inDoubleQuotes && char === "'" && previous !== "\\") {
      inSingleQuotes = !inSingleQuotes;
      continue;
    }

    if (!inSingleQuotes && char === "\"" && previous !== "\\") {
      inDoubleQuotes = !inDoubleQuotes;
      continue;
    }

    if (inSingleQuotes || inDoubleQuotes) {
      continue;
    }

    if (char === ")") parenDepth += 1;
    if (char === "(") parenDepth -= 1;
    if (char === "]") bracketDepth += 1;
    if (char === "[") bracketDepth -= 1;
    if (char === "}") braceDepth += 1;
    if (char === "{") braceDepth -= 1;

    if (parenDepth !== 0 || bracketDepth !== 0 || braceDepth !== 0) {
      continue;
    }

    if (!operators.includes(char)) {
      continue;
    }

    if ((char === "-" || char === "+") && isUnaryOperator(expression, index)) {
      continue;
    }

    return { index, operator: char };
  }

  return null;
}

function stripEnclosingParentheses(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) {
    return trimmed;
  }

  let depth = 0;
  let inSingleQuotes = false;
  let inDoubleQuotes = false;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    const previous = trimmed[index - 1];

    if (!inDoubleQuotes && char === "'" && previous !== "\\") {
      inSingleQuotes = !inSingleQuotes;
      continue;
    }

    if (!inSingleQuotes && char === "\"" && previous !== "\\") {
      inDoubleQuotes = !inDoubleQuotes;
      continue;
    }

    if (inSingleQuotes || inDoubleQuotes) {
      continue;
    }

    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (depth === 0 && index < trimmed.length - 1) {
      return trimmed;
    }
  }

  return trimmed.slice(1, -1).trim();
}

function isUnaryOperator(expression, index) {
  const prefix = expression.slice(0, index).trim();
  if (prefix === "") {
    return true;
  }

  const previousChar = prefix[prefix.length - 1];
  return ["+", "-", "*", "/", "%", "(", ","].includes(previousChar);
}

function toNumber(value, token) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    return Number(value);
  }

  throw new Error(`Expected numeric value for expression token: ${token}`);
}
