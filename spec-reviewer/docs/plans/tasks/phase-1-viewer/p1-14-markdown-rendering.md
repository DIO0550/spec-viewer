# P1.14 Markdown Rendering

## Goal

Render Markdown safely and consistently while attaching block metadata needed for later comments.

## Tasks

- [ ] Render Markdown with `react-markdown`.
- [ ] Enable `remark-gfm`.
- [ ] Render code blocks with stable styling.
- [ ] Render GFM tables without layout overflow.
- [ ] Render task lists read-only.
- [ ] Add `data-block-type` attributes for headings, paragraphs, list items, tables, and code blocks.
- [ ] Add `data-block-index` attributes within the rendered document.
- [ ] Keep block indexing stable for unchanged Markdown.

## Done When

- GFM content renders correctly.
- DOM block metadata exists for comment anchoring.

