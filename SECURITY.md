# Security

Found something wrong with morganvanv.com or this repo? Thanks for looking.

**Please report it privately:** use [Report a vulnerability](https://github.com/morgan-vanv/morganvanv.com/security/advisories/new) on this repo's Security tab, or email website@morganvanv.com. Please don't open a public issue for it.

It's a one-person hobby site, so there's no bounty and no SLA, but I read everything and will reply as soon as I can.

## What's in scope

- This repo and the site it deploys (https://morganvanv.com, a static site on GitHub Pages).
- Its backend, [morganvanv.com-backend](https://github.com/morgan-vanv/morganvanv.com-backend): the Ask Morgan function and the campfire (visitor counter and shoutbox). Report those on that repo, or by email.

Third-party APIs the site reads from (stats.fm, Wise Old Man, RuneProfile, Open-Meteo, Letterboxd, GitHub) belong to their owners; please report problems in them to them.

## What I'd especially like to hear about

- Anything a visitor can type (the contact form, star names, the shoutbox) ending up as live markup or script on the site.
- Ways to abuse the backend: flooding Morgan's Discord, getting around rate limits, impersonating the host in the shoutbox.
- Secrets that shouldn't be public, in the code or its history.
- Weaknesses in the GitHub Actions workflows that could change what gets deployed.
