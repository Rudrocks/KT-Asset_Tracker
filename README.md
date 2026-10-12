# KT Asset Tracker

A Node.js, Express, PostgreSQL, Sequelize, and Jade-compatible Pug application for maintaining employee and asset registers and tracking the full asset lifecycle. Pug is the maintained successor to Jade; the app keeps `.jade` template filenames and Jade-compatible syntax.

## Requirements

- Node.js 18 or later
- PostgreSQL

## Setup

1. Create a PostgreSQL database, for example `asset_tracker`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a unique `SESSION_SECRET`.
3. Install dependencies and start the server:

   ```sh
   npm install
   npm start
   ```

4. Open `http://localhost:3000`.

The app creates missing tables at startup using Sequelize `sync()`. For production deployments, use managed schema migrations and configure a persistent Express session store; the built-in session store is intended only for local development.

## Features

- Employee and asset-category masters with add, edit, view, search, and filtering.
- Asset register with unique asset tags and serial numbers, category, purchase details, and branch.
- Stock totals by branch and combined purchase value.
- Transactional issue, return (with required reason), and scrap workflows.
- Per-asset purchase-to-scrap event history and a scrapped-assets report.

Scrapping is limited to assets in stock. Return an issued asset before scrapping it. Scrapped assets are excluded from operational asset lists, stock, issue, return, and scrap screens, while remaining available in reports and asset history.

Bootstrap and DataTables assets are loaded from their public CDNs in the Jade layout.
