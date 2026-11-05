import { GreetingLine } from '../../shared/constants/subtitles.const';

/**
 * The greeting's tagline, typed: each line rests with the caret blinking, its credit (a visitor's line)
 * fades out, it's backspaced a character at a time, a beat with only the caret, then the next line is
 * typed at a human pace and its credit fades in. Pure: given where it is, `step` says what comes next
 * and how long that lasts; the component only runs the timers.
 */
export type TypePhase = 'rest' | 'fade' | 'erase' | 'pause' | 'type';

export interface TypeState {
  /** Which line, as an index into the list (taken modulo its length, since a live line can come and go). */
  readonly index: number;
  /** How many characters show while erasing, pausing or typing; resting (and fading) shows the whole line. */
  readonly chars: number;
  readonly phase: TypePhase;
  /** The line to type next when it isn't simply the one after: the random start. */
  readonly queued: number | null;
}

export interface TypeStep {
  readonly state: TypeState;
  /** Milliseconds until the step after it. */
  readonly delay: number;
}

export const TYPE_TIMING = {
  /** A line sits there this long, caret blinking. */
  restMs: 7000,
  /** A visitor's credit fades out before the backspace (the CSS transition is the same length). */
  fadeMs: 350,
  /** Per character, backspacing. */
  eraseMs: 32,
  /** Nothing but the caret, before the next line. */
  pauseMs: 650,
  /** Per character, typing, times a jitter between these two. */
  typeMs: 70,
  jitterMin: 0.6,
  jitterMax: 1.4,
  /** Longer after a space, and longer still after punctuation. */
  afterSpace: 1.6,
  afterPunctuation: 4,
} as const;

/** The prerendered state: the first line, whole, resting. */
export const FIRST_STATE: TypeState = { index: 0, chars: 0, phase: 'rest', queued: null };

let segmenter: Intl.Segmenter | null | undefined;

/** A line's characters as a reader sees them (graphemes), so an emoji or a ☾ is typed in one go. */
export function characters(text: string): string[] {
  if (segmenter === undefined) segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  return segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);
}

export function lineAt(lines: readonly GreetingLine[], index: number): GreetingLine {
  return lines[index % lines.length];
}

/** What the typed text shows now. */
export function shownText(state: TypeState, lines: readonly GreetingLine[]): string {
  const text = lineAt(lines, state.index).text;
  return state.phase === 'rest' || state.phase === 'fade' ? text : characters(text).slice(0, state.chars).join('');
}

/** The caret blinks while nothing is happening, and holds still while a line is typed or erased. */
export function caretBlinks(state: TypeState): boolean {
  return state.phase === 'rest' || state.phase === 'fade' || state.phase === 'pause';
}

/** A visitor's credit shows only while their line rests whole. */
export function creditShows(state: TypeState, lines: readonly GreetingLine[]): boolean {
  return state.phase === 'rest' && !!lineAt(lines, state.index).credit;
}

/** How long to wait after typing this character: a little uneven, longer after a space or punctuation. */
export function charDelay(char: string, random: () => number): number {
  const t = TYPE_TIMING;
  const pause = /[.,!]/.test(char) ? t.afterPunctuation : /\s/.test(char) ? t.afterSpace : 1;
  return Math.round(t.typeMs * pause * (t.jitterMin + random() * (t.jitterMax - t.jitterMin)));
}

/** The line after this one: the queued one if there is one (and it isn't this one), else the next in order. */
export function following(state: TypeState, count: number): number {
  const here = state.index % count;
  const queued = state.queued === null ? null : state.queued % count;
  return queued !== null && queued !== here ? queued : (here + 1) % count;
}

/**
 * How long the typed version takes from one line resting to the next one resting, on average:
 * the clock the reduced-motion version swaps on, so both change lines about as often.
 */
export function cycleMs(from: GreetingLine, to: GreetingLine): number {
  const t = TYPE_TIMING;
  const typing = characters(to.text).reduce((sum, char) => sum + charDelay(char, () => 0.5), 0);
  return (from.credit ? t.fadeMs : 0) + t.eraseMs * (characters(from.text).length + 1) + t.pauseMs + typing + t.restMs;
}

/**
 * What comes after `state`, and how long it lasts. Under reduced motion there's no typing: the whole
 * next line swaps in at once and stays for as long as the typed version would have taken.
 */
export function step(state: TypeState, lines: readonly GreetingLine[], options: { readonly reducedMotion: boolean; readonly random: () => number }): TypeStep {
  const t = TYPE_TIMING;
  const line = lineAt(lines, state.index);
  const length = characters(line.text).length;

  if (options.reducedMotion) {
    const index = following(state, lines.length);
    return { state: { index, chars: 0, phase: 'rest', queued: null }, delay: cycleMs(line, lineAt(lines, index)) };
  }

  switch (state.phase) {
    case 'rest':
      return line.credit
        ? { state: { ...state, phase: 'fade' }, delay: t.fadeMs }
        : { state: { ...state, phase: 'erase', chars: length }, delay: t.eraseMs };
    case 'fade':
      return { state: { ...state, phase: 'erase', chars: length }, delay: t.eraseMs };
    case 'erase': {
      const chars = Math.min(state.chars, length) - 1;
      return chars > 0
        ? { state: { ...state, chars }, delay: t.eraseMs }
        : { state: { ...state, phase: 'pause', chars: 0 }, delay: t.pauseMs };
    }
    case 'pause': {
      const index = following(state, lines.length);
      const next = characters(lineAt(lines, index).text);
      return { state: { index, chars: 1, phase: 'type', queued: null }, delay: charDelay(next[0] ?? '', options.random) };
    }
    case 'type': {
      if (state.chars >= length) return { state: { ...state, phase: 'rest', chars: length }, delay: t.restMs };
      const chars = state.chars + 1;
      return { state: { ...state, chars }, delay: charDelay(characters(line.text)[chars - 1], options.random) };
    }
  }
}
