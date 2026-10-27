# content/

What visitors sent that Morgan approved: greeting subtitles, star names and mailbag letters. One file per
entry, so pending PRs never touch the same file.

## How an entry gets here

1. A visitor uses the Contact form (ask me something, suggest a subtitle) or the sky's "name a star".
2. It lands in Morgan's Discord. With publishing on (morganvanv.com-backend's `ask/publish`), the message has
   a **Publish as PR** link; its button opens a PR on this repo that adds one file here.
3. **Merge to publish it, close to reject it.** For a question, write the answer in the PR first (the PR
   links to the file's editor). The next deploy shows it.

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

The question is shown exactly as the visitor wrote it, as plain text. The answer is Markdown, but only
paragraphs, `*emphasis*`, `**strong**`, `` `code` ``, fenced code blocks, `-` / `1.` lists and links
(`https://`, `mailto:` or a path on the site); anything else, raw HTML included, shows as the text it is.
HTML comments are left out.

## The checks

`src/shared/visitor-content/content-folder.spec.ts` (the Test job) fails a PR when any file here is off:
an unknown folder or stray file, a file name that isn't an id, a wrong shape, a text over its limit
(subtitle 60, name 24, credit 24, question 500), RA/Dec out of range, a repeat, or **a mailbag letter with
no answer under the marker**. The message says which file and what to fix.

The build (`scripts/build-visitor-content.mjs`, run before every build, test and dev server) gathers this
folder into `src/generated/`, which is gitignored. It never fails: a bad file is left out with a warning.
