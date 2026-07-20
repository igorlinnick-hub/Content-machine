# Canva Connect: edit_url is temporary — never store it as the link-out

**Date:** 2026-07-20
**Context:** "Open in Canva" on month-old posts landed on Canva's 404 page.

## The gotcha

Every `urls.edit_url` the Canva Connect API returns (autofill jobs, GET
/designs, anywhere) is a **temporary** link: it expires after ~30 days and is
tied to the OAuth token that minted it. Persisting it and rendering it as an
`<a href>` guarantees rot.

## The pattern

1. Persist the **design id** (`render_result.canva_design_id`), never trust a
   stored edit_url.
2. Link out through a redirect endpoint (`/api/posts/:id/canva`) that calls
   `GET /designs/{id}` per click and 302s to the fresh edit_url.
3. Legacy rows without an id: recover it by title search (`GET
   /designs?query=`) — autofill titles designs with the post topic — then
   backfill.

Reusable for any project that stores Canva links (UFC Banners, canva_connect.py
consumers): same trap, same fix.
