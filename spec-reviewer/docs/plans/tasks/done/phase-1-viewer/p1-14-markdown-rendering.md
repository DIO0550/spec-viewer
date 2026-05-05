# P1.14 Markdown Rendering

## Goal

Render Markdown safely and consistently while attaching block metadata needed for later comments.

## Tasks

- [x] Render Markdown with `react-markdown`.
- [x] Enable `remark-gfm`.
- [x] Render code blocks with stable styling.
- [x] Render GFM tables without layout overflow.
- [x] Render task lists read-only.
- [x] Add `data-block-type` attributes for headings, paragraphs, list items, tables, and code blocks.
- [x] Add `data-block-index` attributes within the rendered document.
- [x] Keep block indexing stable for unchanged Markdown.

## Done When

- GFM content renders correctly.
- DOM block metadata exists for comment anchoring.

## Completion Note

Implemented Markdown rendering, GFM support, read-only task lists, table/code overflow handling, and block anchor metadata in the P1.14 completion commit.
