# SonoMarzi CAD

Public, experimental computer-aided dispatch proof of concept. **Not a production public-safety dispatch system.** Separate from the commercial SonoMarzi Public Safety Management platform.

## Source migration

The source baseline is CAD Voice Intelligence v20.8 (Layers, Voice Navigation, Netlify). The baseline application files are **not yet committed**. Do not connect this repository to the existing Netlify deployment until the baseline and refactoring have been validated.

## Intended structure

- `index.html`, `styles.css`, and JavaScript modules at the repository root for the initial baseline
- `netlify/functions/` for optional Netlify serverless functions
- `tests/` for regression scripts
- `netlify.toml` for Netlify publishing configuration

## Workflow

- `main`: stable tested baseline
- `develop`: integration and refactoring
- feature branches and pull requests for changes

Never commit API keys, credentials, private agency data, or real dispatch records to this public repository.
