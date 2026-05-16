# P4.8 Keyboard Navigation

## Tasks

- [x] Add focus model for spec tree.
- [x] Add arrow-key navigation in spec tree.
- [x] Add tab switching shortcuts.
- [x] Add jump between comments shortcuts.
- [x] Add escape handling for popovers.
- [x] Document shortcuts outside the main app UI if needed.

## Completion Note

Implemented keyboard navigation for spec tree parent/child movement, app-level file/comment shortcuts, comment list focus movement, and Escape handling for floating UI. Shortcut metadata is exposed through accessible labels/ARIA rather than a new in-app help surface. Implementation commits: `d61497d`, `b9c905a`.
