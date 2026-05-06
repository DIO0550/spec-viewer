# Release Packaging

This note captures the packaging decisions and release checklist for Spec Reviewer `0.1.0`.

## Product Metadata

- Product name: `Spec Reviewer`
- npm package name: `spec-reviewer`
- Cargo package name: `spec-reviewer`
- Tauri identifier: `io.github.dio0550.spec-reviewer`
- Current app version: `0.1.0`
- Icon source: `src-tauri/app-icon.svg`

The app is private/unpublished in package metadata. Create GitHub releases from built artifacts only after an explicit release decision; do not publish npm, Cargo, or GitHub releases as part of routine task work.

## Build Commands

Use these commands from `spec-reviewer/`:

```bash
pnpm install
pnpm check
pnpm test:run
cargo test --manifest-path src-tauri/Cargo.toml
pnpm build
pnpm package:debug
pnpm package:debug:linux
```

Use `pnpm package` only when producing release artifacts. The packaging commands write generated output under `dist/` and `src-tauri/target/`; keep those directories out of commits.

## Linux Build Notes

- Install the Tauri v2 Linux prerequisites for the target distribution before packaging.
- In Debian/Ubuntu containers, the commonly missing packages are WebKitGTK, GTK, AppIndicator, librsvg, and build essentials.
- Run `pnpm package:debug` first to validate the app build, then `pnpm package:debug:linux` to validate a debug deb bundle without creating a release-grade binary.
- For release artifacts, run `pnpm package` on the oldest supported Linux image to reduce runtime library surprises.
- Smoke-test the produced AppImage, deb, or rpm on a clean desktop session before publishing.

## macOS Build Notes

- Build on macOS for macOS artifacts; cross-compiling from Linux is not part of the supported release path.
- Install the Rust target matching the release architecture and run `pnpm package:debug` locally before release packaging.
- Apple signing and notarization are not configured yet. Keep unsigned artifacts internal until signing is planned.
- Verify the generated `.app` opens, can choose a workspace folder, and can persist comments after restart.

## Windows Build Notes

- Build Windows artifacts on Windows. Cross-compiling from Linux is not part of the supported release path.
- Install the Tauri v2 Windows prerequisites, including Microsoft Visual Studio Build Tools and WebView2.
- Run `pnpm package:debug` before a release build to validate metadata, icons, and bundler configuration.
- Signing is not configured yet. Keep unsigned installer artifacts internal until signing is planned.
- Verify the generated installer and portable executable on a clean Windows profile.

## Release Checklist

- Confirm no generated outputs are staged: `dist/`, `storybook-static/`, `src-tauri/target/`, and `src-tauri/gen/`.
- Confirm the product name, Tauri identifier, and version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
- Regenerate icons from `src-tauri/app-icon.svg` when the source icon changes: `pnpm tauri icon src-tauri/app-icon.svg`.
- Run `pnpm check`, `pnpm test:run`, `cargo test --manifest-path src-tauri/Cargo.toml`, `pnpm build`, `pnpm package:debug`, and `pnpm package:debug:linux`.
- Review release notes and known limitations.
- Build release artifacts with `pnpm package` on each target OS.
- Smoke-test every packaged artifact before creating tags or GitHub releases.
- Only after explicit approval, create the release tag and GitHub release, then attach the tested artifacts.

## Packaged App Smoke Test

- Launch the packaged app and confirm the window title is `Spec Reviewer`.
- Open a workspace containing `.plugin-workspace/.specs/`.
- Select a feature and switch between exploration, hearing, impl, and tasks tabs.
- Add a comment from selected Markdown text.
- Resolve and unresolve the comment.
- Restart the packaged app and confirm comments persist.
- Edit or regenerate a Markdown file and confirm existing comments resolve or show as orphaned without crashing.
- Export unresolved comments to Markdown and confirm the saved content is readable.
- Check light and dark themes if the OS theme changes while the app is open.

## Draft 0.1.0 Release Notes

Spec Reviewer `0.1.0` packages the local desktop review workflow for Spec Skill Markdown workspaces. It includes workspace loading, Markdown viewing, persisted anchored comments, orphan handling after file edits, comment filtering/search/export, theme support, keyboard navigation improvements, and AI-oriented prompt/feedback export flows.

Known limitations:

- macOS and Windows signing are not configured.
- Cross-platform release artifacts should be built and smoke-tested on their native OS.
- Packaged Linux builds may require distribution-specific Tauri prerequisites on the build host.
