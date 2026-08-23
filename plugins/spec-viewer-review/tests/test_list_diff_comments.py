from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "list_diff_comments.py"
SPEC = importlib.util.spec_from_file_location("list_diff_comments", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ListDiffCommentsTest(unittest.TestCase):
    def test_main_prints_only_unresolved_comments_for_current_worktree(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repository = Path(temporary_directory)
            subprocess.run(
                ["git", "init", "--quiet", str(repository)],
                check=True,
                capture_output=True,
                text=True,
            )
            _, document_path, worktree_id = MODULE.derive_comment_document(repository)
            document_path.parent.mkdir(parents=True)
            document_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "repositoryId": "rr1_test",
                        "worktreeId": worktree_id,
                        "revision": "2",
                        "comments": [
                            self._comment("open-1", False),
                            self._comment("resolved-1", True),
                        ],
                    }
                ),
                encoding="utf-8",
            )

            result = subprocess.run(
                [sys.executable, str(SCRIPT_PATH), "--project-dir", str(repository)],
                check=True,
                capture_output=True,
                text=True,
            )
            payload = json.loads(result.stdout)

            self.assertEqual(payload["status"], "ok")
            self.assertEqual(payload["openCount"], 1)
            self.assertEqual(payload["resolvedCount"], 1)
            self.assertEqual(payload["comments"][0]["id"], "open-1")
            self.assertEqual(payload["comments"][0]["target"]["path"], "src/new.ts")

    def test_main_reports_missing_document_without_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repository = Path(temporary_directory)
            subprocess.run(
                ["git", "init", "--quiet", str(repository)],
                check=True,
                capture_output=True,
                text=True,
            )

            result = subprocess.run(
                [sys.executable, str(SCRIPT_PATH), "--project-dir", str(repository)],
                check=True,
                capture_output=True,
                text=True,
            )
            payload = json.loads(result.stdout)

            self.assertEqual(payload["status"], "not_found")

    @staticmethod
    def _comment(comment_id: str, resolved: bool) -> dict[str, object]:
        return {
            "id": comment_id,
            "body": "Handle the edge case.",
            "resolved": resolved,
            "createdAt": "2026-08-23T00:00:00Z",
            "replies": [],
            "anchor": {
                "repositoryId": "rr1_test",
                "worktreeId": "unused-by-summary",
                "baseSha": "a" * 40,
                "currentSnapshotId": "snapshot",
                "side": "current",
                "oldPath": "src/old.ts",
                "newPath": "src/new.ts",
                "line": 12,
                "lineHash": "hash",
                "snippet": "",
                "contextBefore": ["function read() {"],
                "contextAfter": ["}"],
            },
        }


if __name__ == "__main__":
    unittest.main()
