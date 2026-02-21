export interface RunKinyarwandaOptions {
  variables?: Record<string, unknown>;
}

export interface RunKinyarwandaResult {
  ok: boolean;
  failedLine?: string;
  variables: Record<string, unknown>;
  results: unknown[];
}

export function runKinyarwanda(
  code: string,
  options?: RunKinyarwandaOptions
): Promise<RunKinyarwandaResult>;

export function runDOMCommand(line: string, variables?: Record<string, unknown>): boolean;

export function idafiteAgaciro(selector: string): boolean;
export function siImererweNeza(selector: string): boolean;
export function ntibihuye(selectorOne: string, selectorTwo: string): boolean;
export function validateCommand(line: string, variables?: Record<string, unknown>): boolean | null;

export function networkCommand(
  line: string,
  variables?: Record<string, unknown>
): Promise<Response | FormData | null>;
