import { runDOMCommand } from "./dom.js";
import { validateCommand } from "./validation.js";
import { networkCommand } from "./network.js";
import {
  parseArgs,
  parseAssignment,
  parseCommand,
  parseValue,
  setVariable,
  splitTopLevel,
  stripTrailingSemicolon
} from "./utils.js";

const VALIDATION_COMMANDS = new Set(["idafite_agaciro", "si_imererwe_neza", "ntibihuye"]);
const DOM_COMMANDS = new Set(["andika", "muburire", "shyiramo", "hindura_ibuju"]);
const NETWORK_COMMANDS = new Set(["fata", "subiza", "zana"]);

const BUILTIN_NAMES = new Set([...VALIDATION_COMMANDS, ...DOM_COMMANDS, ...NETWORK_COMMANDS, "subiramo"]);

export async function runKinyarwanda(code, options = {}) {
  const statements = parseProgram(String(code));
  const globalScope = Object.create(null);
  Object.assign(globalScope, options.variables || {});

  const context = {
    results: [],
    functions: new Map()
  };

  const halt = await executeStatements(statements, globalScope, context);
  if (halt) {
    return {
      ok: false,
      failedLine: halt.failedLine,
      variables: toPlainObject(globalScope),
      results: context.results
    };
  }

  return {
    ok: true,
    variables: toPlainObject(globalScope),
    results: context.results
  };
}

function parseProgram(code) {
  const lines = code
    .split("\n")
    .map((rawLine) => stripInlineComment(rawLine).trim())
    .filter((line) => line !== "");

  const parsed = parseBlock(lines, 0, false);
  return parsed.statements;
}

function parseBlock(lines, startIndex, stopAtClosingBrace) {
  const statements = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (line === "}") {
      if (!stopAtClosingBrace) {
        throw new Error("Unexpected closing brace.");
      }

      return {
        statements,
        nextIndex: index + 1
      };
    }

    if (line.endsWith("{")) {
      const header = line.slice(0, -1).trim();
      const loopStatement = parseLoopHeader(header);

      if (loopStatement) {
        const parsedInner = parseBlock(lines, index + 1, true);
        statements.push({ ...loopStatement, body: parsedInner.statements });
        index = parsedInner.nextIndex;
        continue;
      }

      const functionStatement = parseFunctionHeader(header);
      if (functionStatement) {
        const parsedInner = parseBlock(lines, index + 1, true);
        statements.push({ ...functionStatement, body: parsedInner.statements });
        index = parsedInner.nextIndex;
        continue;
      }

      throw new Error(`Unsupported block header: ${line}`);
    }

    statements.push({ type: "line", line });
    index += 1;
  }

  if (stopAtClosingBrace) {
    throw new Error("Missing closing brace for block.");
  }

  return {
    statements,
    nextIndex: index
  };
}

function parseLoopHeader(header) {
  if (!header.startsWith("subiramo(")) {
    return null;
  }

  const args = parseArgs(header, "subiramo");

  if (args.length === 1) {
    return {
      type: "loop_count",
      timesToken: args[0]
    };
  }

  if (args.length === 3) {
    const variableName = args[0].trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variableName)) {
      throw new Error(`Invalid loop variable name: ${variableName}`);
    }

    return {
      type: "loop_range",
      variableName,
      startToken: args[1],
      endToken: args[2]
    };
  }

  throw new Error(`Invalid subiramo arguments: ${header}`);
}

function parseFunctionHeader(header) {
  const match = header.match(/^umukoro\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
  if (!match) {
    return null;
  }

  const functionName = match[1];
  if (BUILTIN_NAMES.has(functionName)) {
    throw new Error(`Function name cannot shadow a built-in command: ${functionName}`);
  }

  const paramsRaw = match[2].trim();
  const params = paramsRaw === "" ? [] : splitTopLevel(paramsRaw).map((part) => part.trim());

  for (const param of params) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(param)) {
      throw new Error(`Invalid function parameter: ${param}`);
    }
  }

  return {
    type: "function_def",
    name: functionName,
    params
  };
}

async function executeStatements(statements, scope, context) {
  for (const statement of statements) {
    if (statement.type === "function_def") {
      context.functions.set(statement.name, {
        params: statement.params,
        body: statement.body,
        scope
      });
      continue;
    }

    if (statement.type === "loop_count") {
      const times = Number(parseValue(statement.timesToken, scope));

      if (!Number.isInteger(times) || times < 0) {
        throw new Error(`subiramo(count) expects a non-negative integer. Got: ${statement.timesToken}`);
      }

      for (let i = 0; i < times; i += 1) {
        const loopScope = Object.create(scope);
        const halt = await executeStatements(statement.body, loopScope, context);
        if (halt) {
          return halt;
        }
      }

      continue;
    }

    if (statement.type === "loop_range") {
      const start = Number(parseValue(statement.startToken, scope));
      const end = Number(parseValue(statement.endToken, scope));

      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new Error(`subiramo(variable,start,end) expects integer bounds.`);
      }

      const step = start <= end ? 1 : -1;
      for (let current = start; step > 0 ? current <= end : current >= end; current += step) {
        const loopScope = Object.create(scope);
        loopScope[statement.variableName] = current;

        const halt = await executeStatements(statement.body, loopScope, context);
        if (halt) {
          return halt;
        }
      }

      continue;
    }

    const halt = await executeLine(statement.line, scope, context);
    if (halt) {
      return halt;
    }
  }

  return null;
}

async function executeLine(line, scope, context) {
  const assignment = parseAssignment(line);
  if (assignment) {
    const assignedValue = await evaluateExpression(assignment.expression, scope, context);
    setVariable(scope, assignment.variable, assignedValue);

    if (isNetworkCommandExpression(assignment.expression)) {
      context.results.push(assignedValue);
    }

    return null;
  }

  const parsed = parseCommand(line);
  if (!parsed) {
    throw new Error(`Invalid syntax: ${line}`);
  }

  if (context.functions.has(parsed.name)) {
    return executeUserFunction(line, parsed.name, scope, context);
  }

  if (VALIDATION_COMMANDS.has(parsed.name)) {
    const failed = validateCommand(line, scope);
    if (failed) {
      return { failedLine: line };
    }

    return null;
  }

  if (DOM_COMMANDS.has(parsed.name)) {
    runDOMCommand(line, scope);
    return null;
  }

  if (NETWORK_COMMANDS.has(parsed.name)) {
    const value = await networkCommand(line, scope);
    context.results.push(value);
    return null;
  }

  throw new Error(`Unknown command: ${parsed.name}`);
}

async function evaluateExpression(expression, scope, context) {
  const normalized = stripTrailingSemicolon(expression);
  const command = parseCommand(normalized);

  if (command) {
    if (context.functions.has(command.name)) {
      throw new Error(`Cannot assign user-function calls directly: ${expression}`);
    }

    if (VALIDATION_COMMANDS.has(command.name)) {
      return validateCommand(normalized, scope);
    }

    if (DOM_COMMANDS.has(command.name)) {
      runDOMCommand(normalized, scope);
      return null;
    }

    if (NETWORK_COMMANDS.has(command.name)) {
      return networkCommand(normalized, scope);
    }

    throw new Error(`Unknown command in assignment: ${command.name}`);
  }

  return parseValue(normalized, scope);
}

async function executeUserFunction(line, functionName, callerScope, context) {
  const definition = context.functions.get(functionName);
  const args = parseArgs(line, functionName);

  if (args.length !== definition.params.length) {
    throw new Error(
      `Function ${functionName} expects ${definition.params.length} argument(s), got ${args.length}.`
    );
  }

  const functionScope = Object.create(definition.scope);
  for (let index = 0; index < definition.params.length; index += 1) {
    functionScope[definition.params[index]] = parseValue(args[index], callerScope);
  }

  return executeStatements(definition.body, functionScope, context);
}

function isNetworkCommandExpression(expression) {
  const command = parseCommand(stripTrailingSemicolon(expression));
  return command ? NETWORK_COMMANDS.has(command.name) : false;
}

function stripInlineComment(line) {
  const commentIndex = line.indexOf("//");
  if (commentIndex === -1) {
    return line;
  }

  return line.slice(0, commentIndex);
}

function toPlainObject(scope) {
  return { ...scope };
}
