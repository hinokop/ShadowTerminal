"""Gezielter Regressionstest der realen lokalen Archivbrücke (>500 Dateien).

Aufruf aus dem Projektstamm: python tests/terminal_bridge_pagination.py
Verwendet ausschließlich ein temporäres Verzeichnis und keine echten Benutzerarchive.
"""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from terminal_lokal import Refused, terminal_file_op


class BridgePaginationTests(unittest.TestCase):
    def test_pagination_contains_entries_beyond_500(self):
        with tempfile.TemporaryDirectory() as root_dir:
            root = Path(root_dir)
            folder = root / "ops"
            folder.mkdir()
            for i in range(520):
                (folder / f"aaa-test-{i:04d}.txt").write_text("", encoding="utf-8")
            name = "lageblatt-PIN-001.txt"
            (folder / name).write_text("Record content\n", encoding="utf-8")

            first = terminal_file_op(root, {"op": "ls", "parts": ["ops"], "offset": 0, "limit": 500})
            second = terminal_file_op(root, {"op": "ls", "parts": ["ops"], "offset": first["next"], "limit": 500})
            self.assertEqual(len(first["entries"]), 500)
            self.assertEqual(first["next"], 500)
            self.assertEqual(len(second["entries"]), 21)
            self.assertIsNone(second["next"])
            listed = [x["name"] for x in first["entries"] + second["entries"]]
            self.assertEqual(len(set(listed)), 521)
            self.assertEqual(listed[-1], name)
            self.assertEqual(terminal_file_op(root, {"op": "ls", "parts": ["ops"]})["entries"], first["entries"])

            for invalid in (-1, True, "500", 10000001):
                with self.subTest(offset=invalid), self.assertRaises(Refused):
                    terminal_file_op(root, {"op": "ls", "parts": ["ops"], "offset": invalid})
            for invalid in (0, False, 501, "500"):
                with self.subTest(limit=invalid), self.assertRaises(Refused):
                    terminal_file_op(root, {"op": "ls", "parts": ["ops"], "limit": invalid})


if __name__ == "__main__":
    unittest.main()
