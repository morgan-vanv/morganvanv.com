import { LAB_LOG, LAB_LOG_TAIL, labLogTail } from './lab-log.const';

describe('the lab log', () => {
  it('has one short line per entry, and more entries than the tail shows', () => {
    expect(LAB_LOG.length).toBeGreaterThan(LAB_LOG_TAIL);
    for (const text of LAB_LOG) {
      expect(text.trim().length, text).toBeGreaterThan(0);
      expect(text, text).not.toMatch(/\n/);
      expect(text.length, text).toBeLessThanOrEqual(120);
    }
  });

  it('never says where anything is: no addresses, ports, MACs, hosts or local names', () => {
    for (const text of LAB_LOG) {
      expect(text, text).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/); // IPv4
      expect(text, text).not.toMatch(/\b[0-9a-f]{1,4}(:[0-9a-f]{0,4}){2,7}\b/i); // IPv6
      expect(text, text).not.toMatch(/:\d{2,5}\b/); // a port
      expect(text, text).not.toMatch(/\bport\s+\d/i);
      expect(text, text).not.toMatch(/\b([0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/i); // a MAC address
      expect(text, text).not.toMatch(/\.(local|lan|home|internal|ts\.net)\b|localhost|tailnet/i);
      expect(text, text).not.toMatch(/serial|s\/n\b/i);
      expect(text, text).not.toMatch(/[a-z][a-z0-9+.-]*:\/\//i); // a URL
      expect(text, text).not.toMatch(/\b[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\b/i); // a host name
    }
  });

  it('never says when: no dates, months, times of day or "later"s (Morgan, 2026-11-09)', () => {
    const when = new RegExp([
      String.raw`\b\d{4}-\d{2}-\d{2}\b`, // a date
      String.raw`\b\d{1,2}/\d{1,2}\b`, // 11/08
      String.raw`\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d`, // "Nov 8"
      String.raw`\b(january|february|march|april|june|july|august|september|october|november|december)\b`,
      String.raw`\b(morning|afternoon|evening|tonight|overnight|midnight|noon|today|yesterday|tomorrow|later|earlier|minutes?|hours?|o'clock|weeks?|weekend|months?|years?)\b`,
      String.raw`\d\s?(am|pm)\b`,
    ].join('|'), 'i');
    for (const text of LAB_LOG) expect(text, text).not.toMatch(when);
  });

  describe('labLogTail', () => {
    const entries = ['a', 'b', 'c', 'd'];

    it('keeps the order and cuts to the last few', () => {
      expect(labLogTail(entries, 2)).toEqual(['c', 'd']);
      expect(labLogTail(entries, 10)).toEqual(['a', 'b', 'c', 'd']);
      expect(labLogTail(entries)).toEqual(['a', 'b', 'c', 'd']);
      expect(labLogTail([], 3)).toEqual([]);
    });

    it('reads the real log by default', () => {
      expect(labLogTail()).toEqual(LAB_LOG);
      expect(labLogTail(undefined, LAB_LOG_TAIL).length).toBe(LAB_LOG_TAIL);
    });
  });
});
