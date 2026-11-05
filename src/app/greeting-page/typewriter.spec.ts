import { GreetingLine } from '../../shared/constants/subtitles.const';
import {
  FIRST_STATE, TYPE_TIMING, TypeState, caretBlinks, characters, charDelay, creditShows, cycleMs, following, shownText, step,
} from './typewriter';

const LINES: readonly GreetingLine[] = [
  { text: 'hi.', credit: null },
  { text: 'a b', credit: null },
  { text: 'yo ☾', credit: '— suggested by sam' },
];
const middle = () => 0.5;
const motion = { reducedMotion: false, random: middle };

/** Runs the typewriter from a state, collecting each state and its delay until `until` says stop. */
function run(from: TypeState, until: (state: TypeState) => boolean, lines = LINES, options = motion) {
  const seen: { state: TypeState; delay: number; text: string }[] = [];
  let state = from;
  for (let i = 0; i < 200; i++) {
    const next = step(state, lines, options);
    state = next.state;
    seen.push({ state, delay: next.delay, text: shownText(state, lines) });
    if (until(state)) break;
  }
  return seen;
}

describe('the greeting\'s typewriter', () => {
  it('counts characters as a reader does: a moon, an emoji with a skin tone or a flag is one', () => {
    expect(characters('yo ☾')).toEqual(['y', 'o', ' ', '☾']);
    expect(characters('👍🏽!')).toEqual(['👍🏽', '!']);
    expect(characters('🇺🇸')).toHaveLength(1);
    expect(characters('')).toEqual([]);
  });

  it('starts with the first line whole, resting, the caret blinking and no credit', () => {
    expect(shownText(FIRST_STATE, LINES)).toBe('hi.');
    expect(caretBlinks(FIRST_STATE)).toBe(true);
    expect(creditShows(FIRST_STATE, LINES)).toBe(false);
  });

  it('backspaces a line a character at a time, waits with only the caret, then types the next', () => {
    const seen = run(FIRST_STATE, state => state.phase === 'rest');
    expect(seen.map(s => s.text)).toEqual(['hi.', 'hi', 'h', '', 'a', 'a ', 'a b', 'a b']);
    expect(seen.map(s => s.state.phase)).toEqual(['erase', 'erase', 'erase', 'pause', 'type', 'type', 'type', 'rest']);
    expect(seen.at(-1)!.state.index).toBe(1);
  });

  it('keeps the caret still while it types or erases, and blinking in the pause', () => {
    expect(caretBlinks({ ...FIRST_STATE, phase: 'erase', chars: 2 })).toBe(false);
    expect(caretBlinks({ ...FIRST_STATE, phase: 'type', chars: 2 })).toBe(false);
    expect(caretBlinks({ ...FIRST_STATE, phase: 'pause' })).toBe(true);
    expect(caretBlinks({ ...FIRST_STATE, phase: 'fade' })).toBe(true);
  });

  it('times each beat: ~32 ms a backspace, a 650 ms pause, ~70 ms a keystroke, then a 7 s rest', () => {
    const seen = run(FIRST_STATE, state => state.phase === 'rest');
    expect(seen.filter(s => s.state.phase === 'erase').map(s => s.delay)).toEqual([TYPE_TIMING.eraseMs, TYPE_TIMING.eraseMs, TYPE_TIMING.eraseMs]);
    expect(seen.find(s => s.state.phase === 'pause')!.delay).toBe(TYPE_TIMING.pauseMs);
    // After "a", after the space (×1.6), after "b"; then the line rests.
    expect(seen.filter(s => s.state.phase === 'type').map(s => s.delay)).toEqual([70, 112, 70]);
    expect(seen.at(-1)!.delay).toBe(TYPE_TIMING.restMs);
  });

  it('types unevenly, and stops longer after a space or punctuation', () => {
    expect(charDelay('a', () => 0)).toBe(42);
    expect(charDelay('a', () => 1)).toBe(98);
    expect(charDelay(' ', middle)).toBe(112);
    for (const mark of ['.', ',', '!']) expect(charDelay(mark, middle)).toBe(280);
  });

  it('fades a visitor\'s credit out before erasing their line, and in once their line is typed', () => {
    const resting: TypeState = { index: 2, chars: 4, phase: 'rest', queued: null };
    expect(creditShows(resting, LINES)).toBe(true);
    const fade = step(resting, LINES, motion);
    expect(fade.state.phase).toBe('fade');
    expect(fade.delay).toBe(TYPE_TIMING.fadeMs);
    expect(creditShows(fade.state, LINES)).toBe(false);
    expect(shownText(fade.state, LINES)).toBe('yo ☾');

    const typing = run({ index: 1, chars: 0, phase: 'pause', queued: null }, state => state.phase === 'rest');
    expect(typing.map(s => s.text)).toEqual(['y', 'yo', 'yo ', 'yo ☾', 'yo ☾']);
    expect(typing.slice(0, -1).every(s => !creditShows(s.state, LINES))).toBe(true);
    expect(creditShows(typing.at(-1)!.state, LINES)).toBe(true);
  });

  it('goes straight to the backspace for a line with no credit', () => {
    expect(step(FIRST_STATE, LINES, motion).state.phase).toBe('erase');
  });

  it('types the queued line next (the random start), then carries on in order, round to the start', () => {
    const queued = run({ ...FIRST_STATE, queued: 2 }, state => state.phase === 'type');
    expect(queued.at(-1)!.state).toEqual({ index: 2, chars: 1, phase: 'type', queued: null });
    expect(following({ index: 2, chars: 0, phase: 'pause', queued: null }, 3)).toBe(0);
    // Queued on the line already showing: the next one instead, so a line never follows itself.
    expect(following({ ...FIRST_STATE, queued: 0 }, 3)).toBe(1);
  });

  it('copes with the list growing or a live line changing under it', () => {
    const live: GreetingLine[] = [...LINES, { text: 'listening to A by B', credit: null }];
    expect(shownText({ index: 3, chars: 5, phase: 'type', queued: null }, live)).toBe('liste');
    // The line got shorter mid-erase: carry on from its new end.
    expect(step({ index: 0, chars: 40, phase: 'erase', queued: null }, LINES, motion).state.chars).toBe(2);
    // An index past the end wraps.
    expect(shownText({ index: 4, chars: 0, phase: 'rest', queued: null }, LINES)).toBe('a b');
  });

  describe('under reduced motion', () => {
    const still = { reducedMotion: true, random: middle };

    it('swaps the whole next line in at once, credit and all', () => {
      const next = step(FIRST_STATE, LINES, still);
      expect(next.state).toEqual({ index: 1, chars: 0, phase: 'rest', queued: null });
      expect(shownText(next.state, LINES)).toBe('a b');
      const visitor = step(next.state, LINES, still);
      expect(shownText(visitor.state, LINES)).toBe('yo ☾');
      expect(creditShows(visitor.state, LINES)).toBe(true);
    });

    it('keeps the same clock as the typing: the hold is as long as a typed change would take', () => {
      const next = step(FIRST_STATE, LINES, still);
      expect(next.delay).toBe(cycleMs(LINES[0], LINES[1]));
      // No credit to fade; four backspace beats (three characters, then empty); the pause; "a b" typed; the rest.
      expect(next.delay).toBe(4 * 32 + 650 + 70 + 112 + 70 + 7000);
      expect(cycleMs(LINES[2], LINES[0])).toBe(350 + 5 * 32 + 650 + 70 + 70 + 280 + 7000);
    });

    it('also takes the queued line first', () => {
      expect(step({ ...FIRST_STATE, queued: 2 }, LINES, still).state.index).toBe(2);
    });
  });
});
