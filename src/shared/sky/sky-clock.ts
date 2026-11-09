const FIVE_MINUTES = 5 * 60_000;

/** "9:10 pm", "8 am": to the nearest five minutes, on the sky's own clock (Cincinnati's, or the browser's). */
export function clock(date: Date, timeZone?: string): string {
  const rounded = new Date(Math.round(date.getTime() / FIVE_MINUTES) * FIVE_MINUTES);
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone })
    .format(rounded)
    .replace(/\s/g, ' ')
    .replace(':00 ', ' ')
    .toLowerCase();
}
