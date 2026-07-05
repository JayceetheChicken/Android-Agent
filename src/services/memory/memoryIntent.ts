import type { MemoryImportance } from './types';

export interface MemoryIntent {
  shouldRemember: boolean;
  content?: string;
  tags?: string[];
  importance?: MemoryImportance;
  remainingText?: string;
}

const REMEMBER_PATTERNS = [
  /^(?:bitte\s+)?(?:merk|merke)\s+dir(?:\s*,|\s*:|\s+dass)?\s+/i,
  /^(?:bitte\s+)?speicher(?:e)?(?:\s+dir)?(?:\s*,|\s*:|\s+dass)?\s+/i,
  /^remember(?:\s+this)?(?:\s*,|\s*:|\s+that)?\s+/i,
  /^save(?:\s+this)?(?:\s*,|\s*:|\s+that)?\s+/i,
];

const FOLLOW_UP_SPLITTERS = [
  /\s+(?:und|and)\s+(?=(?:erklär|erklaer|erkläre|erklaere|explain|sag|tell|zeige|show|mach|make|wie|how|was|what|warum|why)\b)/i,
];

function cleanContent(content: string): string {
  return content.trim().replace(/^["'„“”]+|["'„“”.]+$/g, '').trim();
}

function capitalizeSentence(content: string): string {
  if (content.length === 0) {
    return content;
  }
  return `${content[0].toUpperCase()}${content.slice(1)}`;
}

function normalizeRememberedContent(content: string): string {
  const preference = /^ich\s+(.+)\s+mag\.?$/i.exec(content);
  if (preference) {
    return `Ich mag ${preference[1]}.`;
  }
  return capitalizeSentence(content);
}

function splitContentAndRemainder(raw: string): { content: string; remainingText: string } {
  for (const splitter of FOLLOW_UP_SPLITTERS) {
    const match = splitter.exec(raw);
    if (match?.index !== undefined) {
      return {
        content: raw.slice(0, match.index),
        remainingText: raw.slice(match.index + match[0].length),
      };
    }
  }
  return { content: raw, remainingText: '' };
}

function deriveTags(content: string): string[] {
  const lower = content.toLowerCase();
  if (/(projekt|project|app|code|github|repo|repository)/i.test(lower)) {
    return ['project'];
  }
  if (/(antwort|antworten|stil|style|kurz|short|direkt|direct|prefer|bevorzug)/i.test(lower)) {
    return ['preference'];
  }
  if (/(schule|klasse|abi|school|class|exam)/i.test(lower)) {
    return ['school'];
  }
  return ['manual'];
}

function deriveImportance(content: string): MemoryImportance {
  return /(immer|always|wichtig|important|bevorzug|prefer|präferenz|preference)/i.test(content)
    ? 4
    : 3;
}

export function parseRememberIntent(userInput: string): MemoryIntent {
  const trimmed = userInput.trim();
  if (trimmed.length === 0) {
    return { shouldRemember: false };
  }

  const pattern = REMEMBER_PATTERNS.find((candidate) => candidate.test(trimmed));
  if (!pattern) {
    return { shouldRemember: false };
  }

  const rawAfterCommand = trimmed.replace(pattern, '').trim();
  if (rawAfterCommand.length < 4) {
    return { shouldRemember: false };
  }

  const { content: rawContent, remainingText } = splitContentAndRemainder(rawAfterCommand);
  const content = normalizeRememberedContent(cleanContent(rawContent));
  if (content.length < 4) {
    return { shouldRemember: false };
  }

  return {
    shouldRemember: true,
    content,
    tags: deriveTags(content),
    importance: deriveImportance(content),
    remainingText: cleanContent(remainingText),
  };
}
