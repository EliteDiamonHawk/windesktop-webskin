from __future__ import annotations

import json
import os
import shutil
import unittest
from pathlib import Path
from unittest.mock import patch

from webskin.persistence import JsonSettingsStorage, SettingsStorageError, _MISSING


class JsonSettingsStorageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings_path = Path(__file__).resolve().parents[2] / "temp" / "settings-tests"
        self.settings_path.mkdir(parents=True, exist_ok=True)
        for child in self.settings_path.iterdir():
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
            else:
                child.unlink(missing_ok=True)

    def tearDown(self) -> None:
        for child in self.settings_path.iterdir():
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
            else:
                child.unlink(missing_ok=True)

    def test_initializes_namespace_files_and_widget_directory(self) -> None:
        JsonSettingsStorage(self.settings_path)

        self.assertEqual(
            {path.name for path in self.settings_path.glob("*.json")},
            {"app.json", "themes.json", "widgets.json"},
        )
        self.assertTrue((self.settings_path / "widgets").is_dir())
        self.assertEqual(
            json.loads((self.settings_path / "widgets.json").read_text(encoding="utf-8")),
            {"version": 1, "widgets": {}},
        )

    def test_first_widget_write_creates_file_and_index_entry(self) -> None:
        storage = JsonSettingsStorage(self.settings_path)

        storage.set_value("widgets", "updateInterval", 15, "my widget")

        widget_path = self.settings_path / "widgets" / "my%20widget.json"
        self.assertEqual(
            json.loads(widget_path.read_text(encoding="utf-8")),
            {"version": 1, "id": "my widget", "settings": {"updateInterval": 15}},
        )
        self.assertEqual(
            json.loads((self.settings_path / "widgets.json").read_text(encoding="utf-8")),
            {"version": 1, "widgets": {"my widget": {"file": "widgets/my%20widget.json"}}},
        )

    def test_widgets_keep_independent_files(self) -> None:
        storage = JsonSettingsStorage(self.settings_path)
        storage.set_value("widgets", "color", "blue", "one")
        storage.set_value("widgets", "color", "red", "two")

        self.assertEqual(storage.get_value("widgets", "color", "one"), "blue")
        self.assertEqual(storage.get_value("widgets", "color", "two"), "red")
        self.assertEqual(storage.get_value("widgets", "missing", "three"), _MISSING)

    def test_uninitialized_widget_reads_as_empty_without_creating_file(self) -> None:
        storage = JsonSettingsStorage(self.settings_path)

        self.assertEqual(storage.get_namespace("widgets", "memory-plain"), {})
        self.assertFalse((self.settings_path / "widgets" / "memory-plain.json").exists())

    def test_deleting_last_widget_setting_keeps_empty_file_and_pointer(self) -> None:
        storage = JsonSettingsStorage(self.settings_path)
        storage.set_value("widgets", "enabled", True, "memory-plain")

        self.assertTrue(storage.delete_value("widgets", "enabled", "memory-plain"))
        self.assertEqual(storage.get_namespace("widgets", "memory-plain"), {})
        self.assertTrue((self.settings_path / "widgets" / "memory-plain.json").exists())
        index = json.loads((self.settings_path / "widgets.json").read_text(encoding="utf-8"))
        self.assertIn("memory-plain", index["widgets"])

    def test_legacy_single_file_is_ignored(self) -> None:
        (self.settings_path / "settings.json").write_text(
            json.dumps({"version": 1, "app": {"legacy": True}, "themes": {}, "widgets": {}}),
            encoding="utf-8",
        )

        storage = JsonSettingsStorage(self.settings_path)

        self.assertIs(storage.get_value("app", "legacy"), _MISSING)

    def test_invalid_index_pointer_is_rejected(self) -> None:
        storage = JsonSettingsStorage(self.settings_path)
        (self.settings_path / "widgets.json").write_text(
            json.dumps({"version": 1, "widgets": {"memory-plain": {"file": "../app.json"}}}),
            encoding="utf-8",
        )

        with self.assertRaises(SettingsStorageError):
            storage.get_namespace("widgets", "memory-plain")

    def test_missing_indexed_widget_file_is_rejected(self) -> None:
        storage = JsonSettingsStorage(self.settings_path)
        (self.settings_path / "widgets.json").write_text(
            json.dumps({"version": 1, "widgets": {"memory-plain": {"file": "widgets/missing.json"}}}),
            encoding="utf-8",
        )

        with self.assertRaises(SettingsStorageError):
            storage.get_value("widgets", "updateInterval", "memory-plain")

    def test_configured_settings_path_is_a_directory(self) -> None:
        with patch.dict(os.environ, {"WEBSKIN_SETTINGS_PATH": str(self.settings_path)}):
            JsonSettingsStorage()

        self.assertTrue((self.settings_path / "app.json").exists())

    def test_production_default_uses_local_app_data_settings_directory(self) -> None:
        local_app_data = Path("C:/test-local-app-data")
        with patch.dict(
            os.environ,
            {
                "WEBSKIN_SETTINGS_PATH": "",
                "WEBSKIN_ENV": "production",
                "WEBSKIN_PRODUCTION": "",
                "LOCALAPPDATA": str(local_app_data),
            },
        ):
            with patch.object(JsonSettingsStorage, "_initialize_storage"):
                storage = JsonSettingsStorage()

        self.assertEqual(storage.path, local_app_data / "WinDesktopWebskin" / "settings")


if __name__ == "__main__":
    unittest.main()
