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

    def test_granite_undated_nav_is_not_promoted(self):
        fund = {"fund_id": "granite_first_fund__granite_fund_management", "canonical_name": "Granite First Fund"}
        row = safe.safe_row(
            "EGP Money Market Fund", 1.65778, None,
            "https://www.granite.eg/", "src_granite_eg", fund, 1.0,
            {"date_provenance": "manager_unpublished", "manager_label": "Today"},
        )
        self.assertIsNone(row["as_of_date"])
        self.assertEqual(row["source_id"], "src_granite_eg")
        with patch.object(safe.legacy, "sb_get", return_value=[]):
            with patch.object(safe.legacy, "sb_post") as sb_post:
                safe.safe_upsert_official([row])
                sb_post.assert_not_called()

    def test_granite_with_real_source_date_is_promoted(self):
        fund = {"fund_id": "granite_first_fund__granite_fund_management", "canonical_name": "Granite First Fund"}
        row = safe.safe_row(
            "EGP Money Market Fund", 1.65778, "2026-09-17",
            "https://www.granite.eg/", "src_granite_eg", fund, 1.0,
        )
        self.assertEqual(row["as_of_date"], "2026-09-17")
        with patch.object(safe.legacy, "sb_get", return_value=[]):
            with patch.object(safe.legacy, "sb_post", return_value=SimpleNamespace(status_code=201, text="")) as sb_post:
                safe.safe_upsert_official([row])
                sb_post.assert_called_once()
                self.assertEqual(sb_post.call_args.args[1][0]["source_id"], "src_granite_eg")
                self.assertEqual(sb_post.call_args.args[1][0]["as_of_date"], "2026-09-17")

    def test_snduk_fallback_preserves_snduk_provenance(self):
        fund = {"fund_id": "granite_first_fund__granite_fund_management", "canonical_name": "Granite First Fund"}
        row = safe.safe_row(
            "Granite First Fund", 1.66, "2026-09-17",
            "https://snduk.com/eg/page/mutual-funds-prices-today?lang=en",
            "src_snduk", fund, 0.95,
            {"fallback": True, "provenance": "third_party_snduk", "date_provenance": "snduk"},
        )
        self.assertEqual(row["source_id"], "src_snduk")
        self.assertEqual(row["as_of_date"], "2026-09-17")
        self.assertTrue(row["raw"].get("fallback"))
        with patch.object(safe.legacy, "sb_get", return_value=[]):
            with patch.object(safe.legacy, "sb_post", return_value=SimpleNamespace(status_code=201, text="")) as sb_post:
                safe.safe_upsert_official([row])
                payload = sb_post.call_args.args[1][0]
                self.assertEqual(payload["source_id"], "src_snduk")
                self.assertIn("snduk.com", payload["source_url"])

    def test_snduk_granite_fixed_income_must_not_match_first_fund(self):
        from difflib import SequenceMatcher
        import re
        def norm(s):
            return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()
        first = norm("Granite First Fund")
        for other in ("Granite Fixed Income Fund EGP", "Granite USD Fixed Income Fund"):
            ratio = SequenceMatcher(None, first, norm(other)).ratio()
            self.assertLess(ratio, 0.84, msg=f"{other!r} must not fuzzy-match Granite First Fund (ratio={ratio})")

    def test_no_snduk_match_keeps_granite_undated(self):
        manager = [safe.safe_row(
            "EGP Money Market Fund", 1.65778, None,
            "https://www.granite.eg/", "src_granite_eg",
            {"fund_id": "granite_first_fund__granite_fund_management", "canonical_name": "Granite First Fund"},
            1.0,
        )]
        selected = safe._select_fallbacks(manager, [])
        self.assertEqual(selected, [])
        self.assertFalse(safe._is_usable_current_candidate(manager[0]))

    def test_snduk_without_date_is_not_usable_fallback(self):
        fund = {"fund_id": "granite_first_fund__granite_fund_management", "canonical_name": "Granite First Fund"}
        undated_snduk = safe.safe_row(
            "Granite First Fund", 1.66, None,
            "https://snduk.com/eg/page/mutual-funds-prices-today?lang=en",
            "src_snduk", fund, 0.95, {"fallback": True},
        )
        self.assertIsNone(undated_snduk["as_of_date"])
        self.assertFalse(safe._is_usable_current_candidate(undated_snduk))
        with patch.object(safe.legacy, "sb_get", return_value=[]):
            with patch.object(safe.legacy, "sb_post") as sb_post:
                safe.safe_upsert_official([undated_snduk])
                sb_post.assert_not_called()

    def test_existing_dated_official_not_replaced_by_undated_or_older_snduk(self):
        fund_id = "granite_first_fund__granite_fund_management"
        with patch.object(safe.legacy, "sb_get", return_value=[{
            "fund_id": fund_id, "as_of_date": "2026-09-17", "source_id": "src_granite_eg",
        }]):
            with patch.object(safe.legacy, "sb_post") as sb_post:
                safe.safe_upsert_official([{
                    "fund_id": fund_id, "nav": 1.66, "as_of_date": None,
                    "source_id": "src_snduk", "source_url": "https://snduk.com/x",
                }])
                sb_post.assert_not_called()
                safe.safe_upsert_official([{
                    "fund_id": fund_id, "nav": 1.66, "as_of_date": "2026-09-16",
                    "source_id": "src_snduk", "source_url": "https://snduk.com/x",
                }])
                sb_post.assert_not_called()

    def test_today_label_is_never_used_as_as_of_date(self):
        row = safe.safe_row(
            "EGP Money Market Fund", 1.65778, None,
            "https://www.granite.eg/", "src_granite_eg", self.fund, 1.0,
            {"manager_label": "Today"},
        )
        self.assertIsNone(row["as_of_date"])
        self.assertNotEqual(row["as_of_date"], safe.TODAY.isoformat())

    def test_misr_euro_snduk_alias_is_explicitly_verified(self):
        funds = [{
            "fund_id": "misr_money_market_euro__ci_asset_management",
            "canonical_name": "Misr Money Market (Euro)",
            "management_company": "CI Asset Management",
            "currency": "EUR",
            "inception_date": "2007-06-01",
        }]
        fund, score = safe._explicit_snduk_alias("Banque Misr Mutual Fund in Euro ( day by day Euro )", funds)
        self.assertIsNotNone(fund)
        self.assertEqual(fund["fund_id"], "misr_money_market_euro__ci_asset_management")
        self.assertEqual(score, 1.0)

    def test_snduk_fallback_uses_fund_currency_not_default_egp(self):
        fund = {
            "fund_id": "misr_money_market_euro__ci_asset_management",
            "canonical_name": "Misr Money Market (Euro)",
            "currency": "EUR",
        }
        row = safe.safe_row(
            "Banque Misr Mutual Fund in Euro", 11.95, "2026-09-15",
            "https://snduk.com/eg/page/mutual-funds-prices-today?lang=en",
            "src_snduk", fund, 1.0, {"fallback": True}, currency=(fund.get("currency") or "EGP"),
        )
        self.assertEqual(row["currency"], "EUR")
        self.assertEqual(row["source_id"], "src_snduk")

    def test_beltone_integer_nav_and_curly_quotes_extract_b_secure(self):
        sample = (
            'Egyptian Sport Fund 199.45 2021-12-19 2026-09-20 12.3% '
            'Beltone Fixed Income Fund “B-Secure” 2 2022-11-02 2026-09-20 17.71% '
            'Beltone 2nd tranche "B-Cobonat" Fund 1.03 2026-07-16 2026-09-20 -'
        )
        rows = safe.legacy.parse_beltone_listings(sample)
        names = [r["name"] for r in rows]
        self.assertIn('Beltone Fixed Income Fund “B-Secure”', names)
        b_secure = next(r for r in rows if "B-Secure" in r["name"])
        self.assertEqual(b_secure["nav"], 2.0)
        self.assertEqual(b_secure["as_of_date"], "2026-09-20")
        self.assertEqual(
            safe.legacy.BELTONE_ALIAS.get(safe.legacy.norm(b_secure["name"])),
            "B-Secure",
        )

    def test_beltone_alias_resolves_b_secure_via_matcher(self):
        funds = [{
            "fund_id": "b_secure__beltone_asset_management",
            "canonical_name": "B-Secure",
            "management_company": "Beltone Asset Management",
            "metadata": {},
        }]
        by_name, match = safe.legacy.matcher(funds)
        extracted = 'Beltone Fixed Income Fund “B-Secure”'
        alias = safe.legacy.BELTONE_ALIAS.get(safe.legacy.norm(extracted))
        self.assertEqual(alias, "B-Secure")
        self.assertEqual(by_name[alias]["fund_id"], "b_secure__beltone_asset_management")
        fund, score = match(extracted, "Beltone Asset Management")
        self.assertIsNotNone(fund)
        self.assertGreaterEqual(score, 0.84)


if __name__ == "__main__":
    unittest.main()
