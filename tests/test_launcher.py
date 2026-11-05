"""Checks for the desktop launcher: python -m unittest discover -s tests"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import launcher  # noqa: E402


class LauncherTest(unittest.TestCase):
    def test_selftest_passes(self):
        env = dict(os.environ, STUDY_SUITE_DATA=tempfile.mkdtemp())
        r = subprocess.run([sys.executable, os.path.join(ROOT, "run_app.py"), "--selftest"], env=env, capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("selftest passed", r.stdout)

    def test_store_writes_whole_files_and_skips_damaged_ones(self):
        d = tempfile.mkdtemp()
        os.makedirs(os.path.join(d, "data"))
        s = launcher.Store(d)
        s.put("a.b", {"x": [1, 2]})
        with open(os.path.join(d, "data", "bad.json"), "w") as f:
            f.write("{not json")
        self.assertEqual(s.all(), {"a.b": {"x": [1, 2]}})
        with self.assertRaises(ValueError):
            s.put("../escape", {})
        s.delete("a.b")
        self.assertEqual(s.all(), {})
        self.assertEqual([n for n in os.listdir(os.path.join(d, "data")) if n.endswith(".tmp")], [])


if __name__ == "__main__":
    unittest.main()
