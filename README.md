# morganvanv.com

My personal website built with Angular, TypeScript, and SCSS — live at [morganvanv.com](https://morganvanv.com).

## Tech Stack

- **Framework**: Angular 21
- **UI Library**: Angular Material
- **Styling**: SCSS
- **Hosting**: GitHub Pages (deployed via GitHub Actions)

## Pages

| Route | Status |
|---|---|
| `/` | Greeting / landing |
| `/home` | About me, social links |
| `/background` | Background info and pictures of Ada the cat |
| `/interests` | Music (stats.fm) + OSRS stats (Wise Old Man, RuneProfile, Official Boss Icons) |
| `/projects` | 🚧 Coming soon |
| `/blog` | 🚧 Coming soon |

## Development

```bash
npm install
npm start        # dev server at http://localhost:4200
npm run build    # production build
npm test         # unit tests
npm run lint     # lint
```

## Deployment

Fully automated. Any push to `master` triggers the [deploy workflow](.github/workflows/deploy.yml), which builds the app and deploys it to GitHub Pages. No manual steps required.

## CI

Pull requests to `master` run [three parallel checks](.github/workflows/ci.yml): **Lint**, **Build**, and **Test**. All must pass before merging.

