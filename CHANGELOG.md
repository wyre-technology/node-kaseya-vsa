# 1.0.0 (2026-04-30)


### Features

* initial SDK scaffold for Kaseya VSA REST API ([79506ad](https://github.com/wyre-technology/node-kaseya-vsa/commit/79506ad04f83b45be735e7411498419b0dac5597))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `CODE_OF_CONDUCT.md` (Contributor Covenant).
- `.github/workflows/ci.yml` running lint, typecheck, build, and tests on
  pull requests and pushes to `main` (Node 22).

### Changed

- Standardized on Node 22: `tsup` build target `node22` and
  `@types/node` `^22.0.0` (previously inconsistent: `@types/node ^20`,
  `engines.node >=22`, tsup target `node18`).

### Fixed

- Add `"type": "module"` to `package.json` so tsup emits `dist/index.cjs` (CJS)
  and `dist/index.js` (ESM), matching the `main`/`exports` map. Previously
  `require()` of the published package failed because tsup emitted
  `dist/index.js` as CJS and `dist/index.mjs` as ESM.
- Resolve ESLint errors blocking CI: removed an unnecessary type assertion in
  `src/auth.ts` and fixed unsafe-typed access in `tests/unit/auth.test.ts`.
- Resolve all `strict-boolean-expressions` lint warnings in `src/auth.ts`,
  `src/http.ts`, and `src/rate-limiter.ts` by handling nullish/empty cases
  explicitly. `npm run lint` is now clean.
