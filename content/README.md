# content/

What visitors sent that Morgan approved: greeting subtitles, star names and mailbag letters. One file per
entry, so pending PRs never touch the same file.

## How an entry gets here

1. A visitor uses the Contact form (ask me something, suggest a subtitle) or the sky's "name a star".
2. It lands in Morgan's Discord. With publishing on (morganvanv.com-backend's `ask` Worker), the message has
   a **Publish as PR** link: it opens GitHub's new-file editor on this repo with the file filled in. For a
   question, write the answer under the marker line there. Commit to a new branch and create the PR.
3. **Merge to publish it, close to reject it.** The next deploy shows it.

GitHub's editor puts a `.json` file on one line; that's fine, only its contents are checked.

To add one by hand, write the file yourself in the same format.

## The formats

`<id>` is `YYYY-MM-DD-<slug>-<8 hex>`: the date it was sent (UTC), a slug of `a-z`, `0-9` and hyphens (at
most 40), and eight hex digits, e.g. `2026-10-27-a-certified-night-owl-3fa9c1b2`.

**`subtitles/<id>.json`**, a line under Morgan's name on the greeting:

```json
{
  "text": "a certified night owl",
  "by": "sam",
  "added": "2026-10"
}
```

`by` is `null` for anonymous ("suggested by a stranger"). `added` is the id's month.

**`stars/<id>.json`**, a star a visitor named:

```json
{
  "ra": 283.626,
  "dec": 36.899,
  "name": "Gerald",
  "by": "sam",
  "added": "2026-10",
  "near": "Vega"
}
```

`ra` and `dec` are J2000 degrees (0 ≤ ra < 360, −90 ≤ dec ≤ 90). `near` (optional) is the bright star the
naming panel said it was near; without it the sky works it out.

**`mailbag/<id>.md`**, a question and Morgan's answer, shown on `/social`:

```markdown
---
asked: 2026-10-27
---
> the visitor's question, every line quoted
>
> (a lone > for a blank line)

<!-- Write your answer below this line, then merge. Leave it empty and the site's checks will fail. -->
My answer, in Markdown.
```

The question is shown exactly as the visitor wrote it, as plain text. It must be clean the way the backend
writes it (no invisible or control characters, single spaces, no padding, at most one blank line in a row);
a line with a stray carriage return is refused too.

The answer is Markdown, but only paragraphs, `*emphasis*`, `**strong**`, `` `code` ``, fenced code blocks,
`-` / `1.` lists and links (`https://`, `mailto:` or a path on the site); anything else, raw HTML included,
shows as the text it is. HTML comments and bidirectional control characters are left out, and an answer
that would show nothing (only comments, spaces or invisible characters) counts as no answer.

Known quirks of that small Markdown, left as they are:

- Emphasis can't be nested across: `**a *b** c*` shows the inner asterisks as text.
- A bare URL ending in `_` or `*` loses it (they're treated as trailing punctuation); write `[text](url)`.
- A list is one kind from its first line: `- a` then `1. b` makes one bulleted list.
- No link titles (`[text](url "title")` stays as text), headings, quotes, images or tables.
- A single line break inside a paragraph is a space, not a new line.

## The checks

`src/shared/visitor-content/content-folder.spec.ts` (the Test job) fails a PR when any file here is off:
an unknown folder, a stray file or a symlink, a file name that isn't an id, a wrong shape, a text over its
limit (subtitle 60, name 24, credit 24, near 40, question 500), unclean text, RA/Dec out of range, a star
that isn't in the sky's catalogue (`public/data/sky/stars.json`, within 0.01°) or already has a proper name,
a "near" that isn't a star the sky labels (`names.json`), a repeat, or **a mailbag letter with no answer
under the marker**. The message says which file and what to fix.

The build (`scripts/build-visitor-content.mjs`, run before every build, test and dev server) gathers this
folder into `src/generated/`, which is gitignored. It never fails: a bad file is left out with a warning.
It runs when a command starts, so `npm start` and watch mode don't see edits to this folder until they're
restarted (or `npm run content` is run while they're up).
