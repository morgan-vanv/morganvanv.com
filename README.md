# morganvanv.com

My modern, personal website built with Angular, TypeScript, and SCSS.

## Deployment Process

Deployment is fully automated via GitHub Actions. Any push to the `master` branch triggers the [`deploy.yml`](.github/workflows/deploy.yml) workflow, which:

1. Builds the Angular app with `ng build --configuration production`
2. Uploads the build output as a Pages artifact
3. Deploys it directly to GitHub Pages

No manual steps required.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
- [Development](#development)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [Contributing](#contributing)
- [License](#license)

## Overview

This project is a personal portfolio and blog site. It showcases projects, skills, and contact information with a clean, responsive design.

## Features

- Greeting page to welcome the user
- Landing page with a brief introduction
- Projects page to showcase work and portfolio
- Skills page to highlight technical proficiencies
- Blog page for articles and updates
- Fun Demos page with interactive examples (Worst UI Ideas)
- Contact page with a form to reach out
