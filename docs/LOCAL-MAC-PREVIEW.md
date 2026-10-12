# One-click local Mac preview

Download the packaged launcher from the ChatGPT conversation: **SonoMarzi-CAD-One-Click-Mac-Preview.zip**. Unzip it, then double-click **Open SonoMarzi CAD.command**.

The launcher downloads the latest `refactor/quality-foundation` GitHub branch archive to `~/Library/Application Support/SonoMarzi CAD Preview/site`, starts a Python 3 HTTP server bound only to `127.0.0.1`, and opens the local CAD in the default browser. It tries port 8765, falling back to a free port. A cached version works if a subsequent refresh cannot reach GitHub.

- **No Netlify deploy, merge to main, or database changes.**
- Keep the Terminal window open while testing; Control+C stops the server.
- Python 3 is required. macOS may require Control-click > Open on first launch.
- Browser localStorage remains in that browser's origin until reset. External GIS and speech features may require internet.
- The launcher is a convenience test tool, **not a real-browser acceptance certification**.

For developers already working in a local clone, run `python3 -m http.server 8765 --bind 127.0.0.1` in the repository root, then open `http://127.0.0.1:8765/`. Confirm your clone is checked out to `refactor/quality-foundation` first.
