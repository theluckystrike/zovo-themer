# Zovo Themer modifications

Zovo Themer is based on openstyles/stylus commit
`69c894d9c03512e2133dbfb842d7532dd1751164` (September 1, 2026).

## Product changes

- Replaced the browser action with a purpose-built no-code visual studio.
- Added per-domain accent, link color, font size and corner controls with live
  page preview.
- Added contrast, line-spacing and system-font reading presets per domain.
- Added a point-and-click element selector that produces scoped, editable CSS.
- Added Blob-based portable `.user.css` export for the active domain.
- Added a local free/Pro product boundary and explicit license activation UI.
- Added original Zovo Themer artwork and a light/dark plum visual system.

## Technical changes

- Added isolated `atm8-` DOM/CSS identifiers and `atelier8d1` storage,
  message and webpack runtime identifiers.
- Renamed packaged JavaScript and CSS assets to unique `atelier-` basenames.
- Added a Chrome MV3 content layer for applying generated visual profiles.
- Added a fail-closed license verifier. Only an exact server response of
  `valid: true` grants Pro; a tier label never grants access by itself.
- Added a seven-day offline cache that requires a previously validated matching
  key and a current server-supplied expiry when present.
- Required a real `sb_publishable_` Supabase key for production MV3 builds.
- Removed the packaged LESS and Stylus compiler bundles from the Chrome MV3
  artifact because they rely on dynamic evaluation prohibited by MV3 policy.
- Limited the packaged locale set to English for this release.

## License and provenance

The full modified source remains GPL-3.0-only. Original copyright notices,
license text and existing source headers are retained. New Zovo Themer files
carry a modification notice where appropriate.
