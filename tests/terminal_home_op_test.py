"""Backup-API der lokalen Brücke (terminal_home_op): Format, Integrität, Größenlimit, Pfadgrenzen, Rotation. Aufruf: python3 -m unittest tests/terminal_home_op_test.py"""
import hashlib, json, os, sys, tempfile, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import terminal_lokal as tl


def paket(extra=None):
    d = {"format": "fieldterminal-home", "version": 1, "eintraege": []}
    d.update(extra or {})
    return json.dumps(d)


def speichern(folder, data):
    return tl.terminal_home_op(folder, {"op": "home-save", "data": data, "sha256": hashlib.sha256(data.encode("utf-8")).hexdigest()})


class HomeOp(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.folder = Path(self.tmp.name) / "terminal-home"

    def tearDown(self):
        self.tmp.cleanup()

    def test_limits_match_worst_case(self):
        # 16 MiB content, each byte a control character: 6x in the file, 7x in the JSON request
        self.assertGreaterEqual(tl.MAX_HOME, 16 * 1024 * 1024 * 6)
        self.assertGreaterEqual(tl.MAX_HOME_REQUEST, 16 * 1024 * 1024 * 7)

    def test_save_load_roundtrip_and_name_is_server_chosen(self):
        r = speichern(self.folder, paket())
        self.assertRegex(r["name"], tl.HOME_NAME.pattern)
        self.assertEqual(r["bytes"], len(paket().encode()))
        self.assertEqual(sorted(p.name for p in self.folder.iterdir()), [r["name"]], "no temporary leftovers")
        g = tl.terminal_home_op(self.folder, {"op": "home-load", "name": r["name"]})
        self.assertEqual(g["data"], paket())
        self.assertEqual(g["sha256"], hashlib.sha256(paket().encode()).hexdigest())

    def test_checksum_and_format_are_enforced(self):
        d = paket()
        r = tl.terminal_home_op(self.folder, {"op": "home-save", "data": d, "sha256": "0" * 64})
        self.assertIn("error", r)
        self.assertFalse(self.folder.exists() and any(self.folder.iterdir()), "nothing stored on mismatch")
        for bad in ("not json", json.dumps({"format": "x"}), json.dumps([1])):
            with self.assertRaises(tl.Refused):
                speichern(self.folder, bad)

    def test_size_limit(self):
        old = tl.MAX_HOME
        tl.MAX_HOME = 1000
        try:
            self.assertIn("error", speichern(self.folder, paket({"x": "a" * 2000})))
            self.assertFalse(self.folder.exists() and any(self.folder.iterdir()))
            self.assertNotIn("error", speichern(self.folder, paket()))
        finally:
            tl.MAX_HOME = old

    def test_only_exact_keys_and_names(self):
        for req in ({"op": "home-list", "extra": 1}, {"op": "home-load", "name": "../x"}, {"op": "home-load", "name": "home-20240101T000000Z.json/../../x"},
                    {"op": "home-load", "name": "home-20240101T000000Z.json", "x": 1}, {"op": "home-save", "data": paket()}, {"op": "other"}, []):
            with self.assertRaises(tl.Refused, msg=str(req)):
                tl.terminal_home_op(self.folder, req)
        with self.assertRaises(FileNotFoundError):
            tl.terminal_home_op(self.folder, {"op": "home-load", "name": "home-20240101T000000Z.json"})

    def test_symlinked_folder_and_files_are_refused(self):
        target = Path(self.tmp.name) / "elsewhere"
        target.mkdir()
        os.symlink(target, self.folder)
        with self.assertRaises(tl.Refused):
            tl.terminal_home_op(self.folder, {"op": "home-list"})
        with self.assertRaises(tl.Refused):
            speichern(self.folder, paket())
        self.assertEqual(list(target.iterdir()), [])
        os.unlink(self.folder)
        self.folder.mkdir()
        secret = Path(self.tmp.name) / "geheim.txt"
        secret.write_text("x")
        os.symlink(secret, self.folder / "home-20240101T000000Z.json")
        self.assertEqual(tl.terminal_home_op(self.folder, {"op": "home-list"})["backups"], [], "symlinks are not listed")
        with self.assertRaises(FileNotFoundError):
            tl.terminal_home_op(self.folder, {"op": "home-load", "name": "home-20240101T000000Z.json"})

    def test_rotation_keeps_newest_ten(self):
        self.folder.mkdir()
        for i in range(12):
            (self.folder / f"home-2020010{i % 10}T0000{i:02d}Z.json").write_text(paket())
        r = speichern(self.folder, paket())
        names = [b["name"] for b in tl.terminal_home_op(self.folder, {"op": "home-list"})["backups"]]
        self.assertEqual(len(names), tl.HOME_KEEP)
        self.assertEqual(names, sorted(names, reverse=True), "newest first")
        self.assertIn(r["name"], names)
        self.assertEqual(len(list(self.folder.iterdir())), tl.HOME_KEEP)

    def test_same_second_gets_suffix(self):
        a, b = speichern(self.folder, paket()), speichern(self.folder, paket())
        self.assertNotEqual(a["name"], b["name"])


if __name__ == "__main__":
    unittest.main()
