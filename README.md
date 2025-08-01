# morganvanv.com

My modern, personal website built with Angular, TypeScript, and SCSS.

## Deployment Process

- `ng build --base-href=/morganvanv.com/`
- move the contents of `dist/morganvanv.com` to the docs folder of the `morganvanv.com` GitHub repository
- test by running http server locally `http-server -p 8080`
- run angular-cli tool to deploy to github pages `npx angular-cli-ghpages --dir=docs`

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
