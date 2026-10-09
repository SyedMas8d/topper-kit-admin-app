# TopperKit Admin

A small web app for TopperKit's books and papers: upload, process, classify, check the
report, publish. Runs on your own laptop and talks to the TopperKit API (production or
local) with the admin key. Nothing to deploy.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

Log in with the server's `ADMIN_API_KEY`. It is kept for this browser tab only
(sessionStorage): closing the tab logs you out.

The API must allow this page: its `CORS_ORIGINS` includes `http://localhost:5173` by default.

## Pages

| Page | Does |
|---|---|
| Documents | Every book and paper, with its state (uploaded, not published, published) |
| Upload | A textbook or a question paper (with its exam year), with subject, board and class |
| Document | 1 Process (textbooks) · 2 Classify (in the background) · 3 Publish / Unpublish · the classify report, with left-out questions as printed · Delete |
| Usage | Model calls, tokens and estimated cost, by purpose and by day |

The order for a subject: the textbook first (process, classify, publish), then its papers
(classify, publish). A paper links its questions to the published textbook.

## Settings

`.env.example` lists the servers the login offers; copy it to `.env.local` to change them.
