import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-key")

from scripts import ingest_nav_safe as safe


class NavIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.fund = {"fund_id": "fund-1", "canonical_name": "Test Fund"}

    def test_missing_source_date_stays_null(self):
        row = safe.safe_row("Test Fund", 10.5, None, "https://manager.example/fund", "src_test", self.fund, 1.0)
        self.assertIsNone(row["as_of_date"])

    def test_dated_source_date_is_preserved_exactly(self):
        row = safe.safe_row("Test Fund", 10.5, "2026-09-17", "https://manager.example/fund", "src_test", self.fund, 1.0)
        self.assertEqual(row["as_of_date"], "2026-09-17")

    def test_bounded_future_date_is_accepted(self):
        future = (safe.TODAY + __import__("datetime").timedelta(days=3)).isoformat()
        row = safe.safe_row("Test Fund", 10.5, future, "https://manager.example/fund", "src_test", self.fund, 1.0)
        self.assertEqual(row["as_of_date"], future)
        self.assertEqual(row["raw"]["phase2_date_policy"], "source_published_bounded_future")

    def test_future_date_outside_window_is_not_promoted(self):
        future = (safe.TODAY + __import__("datetime").timedelta(days=8)).isoformat()
        row = safe.safe_row("Test Fund", 10.5, future, "https://manager.example/fund", "src_test", self.fund, 1.0)
        self.assertEqual(row["raw"]["phase2_date_policy"], "future_outside_window")

    @patch.object(safe.legacy, "sb_post")
    @patch.object(safe.legacy, "sb_get")
    def test_undated_candidate_is_never_promoted(self, sb_get, sb_post):
        sb_get.return_value = [{"fund_id": "fund-1", "as_of_date": "2026-09-16"}]
        safe.safe_upsert_official([{"fund_id": "fund-1", "nav": 11.0, "as_of_date": None, "source_id": "src_test"}])
        sb_post.assert_not_called()

    @patch.object(safe.legacy, "sb_post")
    @patch.object(safe.legacy, "sb_get")
    def test_older_candidate_cannot_overwrite_newer_official(self, sb_get, sb_post):
        sb_get.return_value = [{"fund_id": "fund-1", "as_of_date": "2026-09-17"}]
        safe.safe_upsert_official([{
            "fund_id": "fund-1", "nav": 10.0, "as_of_date": "2026-09-16",
            "source_id": "src_test", "source_url": "https://manager.example/fund",
        }])
        sb_post.assert_not_called()

    @patch.object(safe.legacy, "sb_post")
    @patch.object(safe.legacy, "sb_get")
    def test_same_date_candidate_is_promoted(self, sb_get, sb_post):
        sb_get.return_value = [{"fund_id": "fund-1", "as_of_date": "2026-09-17"}]
        sb_post.return_value = SimpleNamespace(status_code=201, text="")
        safe.safe_upsert_official([{
            "fund_id": "fund-1", "nav": 12.0, "as_of_date": "2026-09-17",
            "source_id": "src_test", "source_url": "https://manager.example/fund",
        }])
        sb_post.assert_called_once()
        self.assertEqual(sb_post.call_args.args[1][0]["as_of_date"], "2026-09-17")

    @patch.object(safe.legacy, "sb_post")
    @patch.object(safe.legacy, "sb_get")
    def test_newer_candidate_is_promoted(self, sb_get, sb_post):
        sb_get.return_value = [{"fund_id": "fund-1", "as_of_date": "2026-09-16"}]
        sb_post.return_value = SimpleNamespace(status_code=201, text="")
        safe.safe_upsert_official([{
            "fund_id": "fund-1", "nav": 12.0, "as_of_date": "2026-09-17",
            "source_id": "src_test", "source_url": "https://manager.example/fund",
        }])
        sb_post.assert_called_once()
        self.assertEqual(sb_post.call_args.args[1][0]["as_of_date"], "2026-09-17")

    def test_zaldi_source_alias_is_normalized(self):
        rows = [{"source_id": "src_zaldi", "raw": {}}]
        safe._normalize_source_ids(rows)
        self.assertEqual(rows[0]["source_id"], "src_zaldi_capital")
        self.assertEqual(rows[0]["raw"]["source_id_normalized_from"], "src_zaldi")

    def test_snduk_fallback_is_selected_only_without_current_manager_candidate(self):
        snduk = [{"fund_id": "fund-1", "as_of_date": "2026-09-17", "source_id": "src_snduk"}]
        selected = safe._select_fallbacks([], snduk)
        self.assertEqual(selected, snduk)

        manager = [{"fund_id": "fund-1", "as_of_date": "2026-09-17", "source_id": "src_manager"}]
        self.assertEqual(safe._select_fallbacks(manager, snduk), [])


if __name__ == "__main__":
    unittest.main()
