#!/usr/bin/env python3
"""Locate and print unresolved spec-viewer Diff comments for a Git worktree."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from typing import Any

MAX_DOCUMENT_BYTES = 8 * 1024 * 1024
WORKTREE_HASH_DOMAIN = b"spec-viewer.worktree-storage-id.v1\0"


class CommentStoreError(RuntimeError):
    """Raised when the repository or comment store cannot be read safely."""


def _run_git(project_dir: Path, *arguments: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(project_dir), *arguments],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip() or "git command failed"
        raise CommentStoreError(message)
    return result.stdout.strip()


def _frame(value: bytes) -> bytes:
    return len(value).to_bytes(8, byteorder="big") + value


def _canonical_path_bytes(path: Path) -> bytes:
    value = str(path)
    if os.name == "nt":
        return value.encode("utf-16-le")
    return os.fsencode(value)


def _resolve_git_path(repository_root: Path, value: str) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = repository_root / candidate
    try:
        return candidate.resolve(strict=True)
    except OSError as error:
        raise CommentStoreError(f"cannot resolve Git path {candidate}: {error}") from error


def derive_comment_document(project_dir: Path) -> tuple[Path, Path, str]:
    """Return repository root, expected document path, and worktree storage ID."""

    repository_root = Path(_run_git(project_dir, "rev-parse", "--show-toplevel")).resolve(
        strict=True
    )
    git_dir = _resolve_git_path(
        repository_root, _run_git(project_dir, "rev-parse", "--git-dir")
    )
    common_dir = _resolve_git_path(
        repository_root, _run_git(project_dir, "rev-parse", "--git-common-dir")
    )
    if git_dir != common_dir and common_dir not in git_dir.parents:
        raise CommentStoreError("Git directory escapes the canonical common directory")

    worktree_digest = hashlib.sha256()
    worktree_digest.update(WORKTREE_HASH_DOMAIN)
    worktree_digest.update(_frame(_canonical_path_bytes(common_dir)))
    worktree_digest.update(_frame(_canonical_path_bytes(git_dir)))
    worktree_id = f"rw1_{worktree_digest.hexdigest()}"

    storage_key = hashlib.sha256(_frame(worktree_id.encode("utf-8"))).hexdigest()
    document = (
        common_dir
        / "spec-viewer"
        / "diff-comments"
        / f"df1_{storage_key}.v1.json"
    )
    return repository_root, document, worktree_id


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise CommentStoreError(f"duplicate JSON key: {key}")
        value[key] = item
    return value


def _read_document(path: Path, worktree_id: str) -> dict[str, Any]:
    try:
        size = path.stat().st_size
    except OSError as error:
        raise CommentStoreError(f"cannot stat comment document {path}: {error}") from error
    if size > MAX_DOCUMENT_BYTES:
        raise CommentStoreError("Diff comment document exceeds the 8 MiB limit")

    try:
        document = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicate_keys
        )
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise CommentStoreError(f"cannot decode comment document {path}: {error}") from error

    if not isinstance(document, dict):
        raise CommentStoreError("Diff comment document must be a JSON object")
    if document.get("version") != 1:
        raise CommentStoreError("unsupported Diff comment document version")
    if document.get("worktreeId") != worktree_id:
        raise CommentStoreError("Diff comment document worktree identity mismatch")
    if not isinstance(document.get("revision"), str):
        raise CommentStoreError("Diff comment document revision must be a string")
    if not isinstance(document.get("comments"), list):
        raise CommentStoreError("Diff comment document comments must be an array")
    return document


def _required_string(
    value: dict[str, Any], key: str, context: str, *, allow_empty: bool = False
) -> str:
    item = value.get(key)
    if not isinstance(item, str) or (not allow_empty and not item):
        raise CommentStoreError(f"{context}.{key} must be a non-empty string")
    return item


def _optional_string(value: dict[str, Any], key: str, context: str) -> str | None:
    item = value.get(key)
    if item is None:
        return None
    if not isinstance(item, str) or not item:
        raise CommentStoreError(f"{context}.{key} must be a non-empty string")
    return item


def _line_number(value: dict[str, Any], key: str, context: str) -> int | None:
    item = value.get(key)
    if item is None and key == "endLine":
        return None
    if not isinstance(item, int) or isinstance(item, bool) or item < 1:
        raise CommentStoreError(f"{context}.{key} must be a positive integer")
    return item


def _string_list(value: dict[str, Any], key: str, context: str) -> list[str]:
    item = value.get(key)
    if not isinstance(item, list) or not all(isinstance(line, str) for line in item):
        raise CommentStoreError(f"{context}.{key} must be an array of strings")
    return item


def _open_comment(comment: Any, index: int) -> dict[str, Any] | None:
    context = f"comments[{index}]"
    if not isinstance(comment, dict):
        raise CommentStoreError(f"{context} must be an object")
    resolved = comment.get("resolved")
    if not isinstance(resolved, bool):
        raise CommentStoreError(f"{context}.resolved must be a boolean")
    if resolved:
        return None

    anchor = comment.get("anchor")
    if not isinstance(anchor, dict):
        raise CommentStoreError(f"{context}.anchor must be an object")
    side = anchor.get("side")
    if side not in {"base", "current"}:
        raise CommentStoreError(f"{context}.anchor.side is invalid")

    old_path = _optional_string(anchor, "oldPath", f"{context}.anchor")
    new_path = _optional_string(anchor, "newPath", f"{context}.anchor")
    target_path = new_path if side == "current" else new_path or old_path
    if target_path is None:
        raise CommentStoreError(f"{context}.anchor has no editable path")

    replies = comment.get("replies", [])
    if not isinstance(replies, list):
        raise CommentStoreError(f"{context}.replies must be an array")
    normalized_replies: list[dict[str, str]] = []
    for reply_index, reply in enumerate(replies):
        reply_context = f"{context}.replies[{reply_index}]"
        if not isinstance(reply, dict):
            raise CommentStoreError(f"{reply_context} must be an object")
        normalized_replies.append(
            {
                "id": _required_string(reply, "id", reply_context),
                "body": _required_string(reply, "body", reply_context),
                "createdAt": _required_string(reply, "createdAt", reply_context),
            }
        )

    return {
        "id": _required_string(comment, "id", context),
        "body": _required_string(comment, "body", context),
        "createdAt": _required_string(comment, "createdAt", context),
        "replies": normalized_replies,
        "target": {
            "side": side,
            "path": target_path,
            "line": _line_number(anchor, "line", f"{context}.anchor"),
            "endLine": _line_number(anchor, "endLine", f"{context}.anchor"),
        },
        "anchor": {
            "oldPath": old_path,
            "newPath": new_path,
            "baseSha": _required_string(anchor, "baseSha", f"{context}.anchor"),
            "currentSnapshotId": _required_string(
                anchor, "currentSnapshotId", f"{context}.anchor"
            ),
            "snippet": _required_string(
                anchor, "snippet", f"{context}.anchor", allow_empty=True
            ),
            "contextBefore": _string_list(
                anchor, "contextBefore", f"{context}.anchor"
            ),
            "contextAfter": _string_list(anchor, "contextAfter", f"{context}.anchor"),
        },
    }


def summarize_document(document: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
    """Return normalized unresolved comments and the number of resolved comments."""

    open_comments: list[dict[str, Any]] = []
    resolved_count = 0
    for index, comment in enumerate(document["comments"]):
        normalized = _open_comment(comment, index)
        if normalized is None:
            resolved_count += 1
        else:
            open_comments.append(normalized)
    open_comments.sort(
        key=lambda item: (
            item["target"]["path"],
            item["target"]["line"],
            item["createdAt"],
            item["id"],
        )
    )
    return open_comments, resolved_count


def parse_args(arguments: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Print unresolved spec-viewer Diff comments for the current Git worktree."
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=Path.cwd(),
        help="Path inside the target Git worktree (default: current directory)",
    )
    return parser.parse_args(arguments)


def main(arguments: list[str] | None = None) -> int:
    args = parse_args(arguments if arguments is not None else sys.argv[1:])
    try:
        repository_root, document_path, worktree_id = derive_comment_document(
            args.project_dir
        )
        if not document_path.is_file():
            result = {
                "status": "not_found",
                "repositoryRoot": str(repository_root),
                "documentPath": str(document_path),
                "message": "No spec-viewer Diff comment document exists for this worktree.",
            }
        else:
            document = _read_document(document_path, worktree_id)
            open_comments, resolved_count = summarize_document(document)
            result = {
                "status": "ok",
                "repositoryRoot": str(repository_root),
                "documentPath": str(document_path),
                "repositoryId": document.get("repositoryId"),
                "worktreeId": worktree_id,
                "revision": document["revision"],
                "openCount": len(open_comments),
                "resolvedCount": resolved_count,
                "comments": open_comments,
            }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except CommentStoreError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
