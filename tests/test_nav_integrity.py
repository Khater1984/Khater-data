import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-key")

from scripts import ingest_nav_safe as safe
from scripts import ingest_nav as legacy_ingest


class NavIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.fund = {"fund_id": "fund-1", "canonical_name": "Test Fund"}

    @patch("scripts.repair_pfi_nav.requests.get", side_effect=__import__("requests").RequestException("PFI timeout"))
    def test_pfi_source_timeout_is_non_blocking(self, get_mock):
        from scripts import repair_pfi_nav
        result = repair_pfi_nav.main()
        self.assertEqual(result, 0)
        get_mock.assert_called_once()

    def _contract_context(self, fund_id="fund-1", currency="EGP",
                          manager="Test Manager", source_id="src_test",
                          source_url="https://manager.example/fund",
                          scope=None, fund_url=None):
        fund = {
            "currency": currency,
            "management_company": manager,
            "price_update_url": fund_url or source_url,
        }
        source = {
            "management_company_scope": scope or manager,
            "source_url": source_url,
            "source_kind": "management_company_page",
        }
        return patch.object(
            safe, "_fund_registry",
            return_value={fund_id: fund},
        ), patch.object(
            safe, "_source_registry",
            return_value={source_id: source},
        )

    def test_missing_source_date_stays_null(self):
        row = safe.safe_row("Test Fund", 10.5, None, "https://manager.example/fund", "src_test", self.fund, 1.0)
        self.assertIsNone(row["as_of_date"])


    def test_missing_parser_currency_uses_verified_fund_currency(self):
        fund = {"fund_id": "fund-usd", "canonical_name": "USD Fund", "currency": "USD"}
        row = safe.safe_row(
            "USD Fund", 10.5, "2026-09-19",
            "https://manager.example/fund", "src_test", fund, 1.0,
        )
        self.assertEqual(row["currency"], "USD")
        self.assertEqual(row["raw"]["currency_provenance"], "fund_registry")

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
        with self._contract_context()[0], self._contract_context()[1]:
            safe.safe_upsert_official([{"fund_id": "fund-1", "nav": 11.0, "as_of_date": None, "source_id": "src_test"}])
        sb_post.assert_not_called()

    @patch.object(safe.legacy, "sb_post")
    @patch.object(safe.legacy, "sb_get")
    def test_older_candidate_cannot_overwrite_newer_official(self, sb_get, sb_post):
        sb_get.return_value = [{"fund_id": "fund-1", "as_of_date": "2026-09-17"}]
        with self._contract_context()[0], self._contract_context()[1]:
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
        with self._contract_context()[0], self._contract_context()[1]:
            safe.safe_upsert_official([{
                "fund_id": "fund-1", "nav": 12.0, "currency": "EGP", "as_of_date": "2026-09-17",
                "source_id": "src_test", "source_url": "https://manager.example/fund",
            }])
        sb_post.assert_called_once()
        self.assertEqual(sb_post.call_args.args[1][0]["as_of_date"], "2026-09-17")

    @patch.object(safe.legacy, "sb_post")
    @patch.object(safe.legacy, "sb_get")
    def test_newer_candidate_is_promoted(self, sb_get, sb_post):
        sb_get.return_value = [{"fund_id": "fund-1", "as_of_date": "2026-09-16"}]
        sb_post.return_value = SimpleNamespace(status_code=201, text="")
        with self._contract_context()[0], self._contract_context()[1]:
            safe.safe_upsert_official([{
                "fund_id": "fund-1", "nav": 12.0, "currency": "EGP", "as_of_date": "2026-09-17",
                "source_id": "src_test", "source_url": "https://manager.example/fund",
            }])
        sb_post.assert_called_once()
        self.assertEqual(sb_post.call_args.args[1][0]["as_of_date"], "2026-09-17")


    @patch.object(safe.legacy.requests, "patch")
    @patch.object(safe.legacy, "sb_post")
    @patch.object(safe.legacy, "sb_get")
    def test_unexplained_large_nav_move_is_quarantined(self, sb_get, sb_post, patch_request):
        sb_get.return_value = [{
            "fund_id": "fund-1",
            "nav": 10.0,
            "currency": "EGP",
            "as_of_date": "2026-09-19",
            "source_id": "src_test",
        }]
        with self._contract_context()[0], self._contract_context()[1]:
            safe.safe_upsert_official([{
                "id": 123,
                "fund_id": "fund-1",
                "nav": 4.0,
                "currency": "EGP",
                "as_of_date": "2026-09-19",
                "source_id": "src_test",
                "source_url": "https://manager.example/fund",
            }])
        sb_post.assert_not_called()
        patch_request.assert_called_once()
        payload = patch_request.call_args.kwargs["json"]
        self.assertEqual(payload["verification_status"], "needs_review")
        self.assertIn("Automatic promotion blocked", payload["notes"])


    @patch.object(safe.legacy.requests, "patch")
    @patch.object(safe.legacy, "sb_post")
    def test_run_observability_persists_shared_run_metrics(self, sb_post, patch_request):
        sb_post.return_value = SimpleNamespace(status_code=201, text="")
        safe._record_run_start(14, 208)
        sb_post.assert_called_once()
        start_payload = sb_post.call_args.args[1][0]
        self.assertEqual(start_payload["run_id"], safe.legacy.RUN_ID)
        self.assertEqual(start_payload["status"], "running")
        self.assertEqual(start_payload["sources_attempted"], 14)
        self.assertEqual(start_payload["meta"]["target_fund_count"], 208)

        patch_request.return_value = SimpleNamespace(status_code=204, text="")
        safe._record_run_finish(
            status="success",
            sources_attempted=14,
            rows_extracted=200,
            rows_matched=190,
            fallback_selected=2,
            fallback_sources={"snduk": 2, "eima_weekly": 0},
            fallback_scan_attempted=True,
            source_errors=[],
            attempted_sources=["hermes", "ci", "snduk"],
            target_fund_count=208,
        )
        patch_request.assert_called_once()
        finish_payload = patch_request.call_args.kwargs["json"]
        self.assertEqual(finish_payload["status"], "success")
        self.assertEqual(finish_payload["rows_extracted"], 200)
        self.assertEqual(finish_payload["rows_matched"], 190)
        self.assertEqual(finish_payload["meta"]["fallback_selected"], 2)
        self.assertTrue(finish_payload["meta"]["fallback_scan_attempted"])
        self.assertEqual(finish_payload["meta"]["attempted_sources"], ["hermes", "ci", "snduk"])
        self.assertEqual(finish_payload["meta"]["target_fund_count"], 208)


    @patch.object(safe.legacy.requests, "patch")
    @patch.object(safe.legacy, "sb_post")
    @patch.object(safe.legacy, "sb_get")
    def test_currency_mismatch_is_quarantined_before_promotion(self, sb_get, sb_post, patch_request):
        sb_get.side_effect = [
            [{
                "fund_id": "fund-1",
                "nav": 10.0,
                "currency": "USD",
                "as_of_date": "2026-09-19",
                "source_id": "src_test",
            }],
            [{"fund_id": "fund-1", "currency": "USD"}],
            [{"source_id": "src_test", "management_company_scope": "Test Manager", "source_url": "https://manager.example/fund", "source_kind": "management_company_page"}],
        ]
        safe.safe_upsert_official([{
            "id": 124,
            "fund_id": "fund-1",
            "nav": 10.1,
            "currency": "EGP",
            "as_of_date": "2026-09-19",
            "source_id": "src_test",
            "source_url": "https://manager.example/fund",
        }])
        sb_post.assert_not_called()
        patch_request.assert_called_once()
        payload = patch_request.call_args.kwargs["json"]
        self.assertEqual(payload["verification_status"], "needs_review")
        self.assertIn("expected=USD", payload["notes"])
        self.assertIn("incoming=EGP", payload["notes"])




    @patch.object(safe.legacy.requests, "patch")
    @patch.object(safe.legacy, "sb_post")
    @patch.object(safe.legacy, "sb_get")
    def test_source_manager_scope_mismatch_is_quarantined(self, sb_get, sb_post, patch_request):
        sb_get.side_effect = [
            [{
                "fund_id": "fund-1",
                "nav": 10.0,
                "currency": "EGP",
                "as_of_date": "2026-09-19",
                "source_id": "src_hc_si",
            }],
            [{"fund_id": "fund-1", "currency": "EGP", "management_company": "Wrong Manager"}],
            [{"source_id": "src_hc_si", "management_company_scope": "HC Securities & Investment"}],
        ]
        safe.safe_upsert_official([{
            "id": 125,
            "fund_id": "fund-1",
            "nav": 10.1,
            "currency": "EGP",
            "as_of_date": "2026-09-19",
            "source_id": "src_hc_si",
            "source_url": "https://hc-si.com",
        }])
        sb_post.assert_not_called()
        patch_request.assert_called_once()
        payload = patch_request.call_args.kwargs["json"]
        self.assertEqual(payload["verification_status"], "needs_review")
        self.assertIn("source-manager mismatch", payload["notes"])


    def test_aaim_and_beltone_aliases_are_provider_scoped(self):
        from scripts import ingest_nav as legacy_ingest
        funds = [
            {
                "fund_id": "aaim-1",
                "canonical_name": "Arab African International Bank (Juman)",
                "management_company": "Arab African Investment Management",
            },
            {
                "fund_id": "beltone-1",
                "canonical_name": "B-Alpha",
                "management_company": "Beltone Asset Management",
            },
        ]
        aliases = [
            {
                "fund_id": "aaim-1",
                "alias_name": "Juman Money Market",
                "alias_source": "aaim:verified_identity:2026-09-20",
                "match_confidence": 1.0,
            },
            {
                "fund_id": "beltone-1",
                "alias_name": "B Alpha",
                "alias_source": "beltone:verified_identity:2026-09-20",
                "match_confidence": 1.0,
            },
        ]
        legacy_ingest.set_provider_alias_registry(aliases, funds)

        fund, score = legacy_ingest.provider_alias_match("Juman Money Market", "aaim")
        self.assertEqual(fund["fund_id"], "aaim-1")
        self.assertEqual(score, 1.0)

        fund, score = legacy_ingest.provider_alias_match("B Alpha", "beltone")
        self.assertEqual(fund["fund_id"], "beltone-1")
        self.assertEqual(score, 1.0)

        fund, score = legacy_ingest.provider_alias_match("B Alpha", "aaim")
        self.assertIsNone(fund)
        self.assertEqual(score, 0.0)

        fund, score = legacy_ingest.provider_alias_match("Juman Money Market Extra", "aaim")
        self.assertIsNone(fund)
        self.assertEqual(score, 0.0)



    @patch.object(legacy_ingest, "fetch")
    def test_alpha_odin_parser_requires_exact_identity_and_source_date(self, fetch):
        funds = [{
            "fund_id": "odin4",
            "canonical_name": "Odin 4",
            "management_company": "Alpha Financial Investments Management",
            "currency": "EGP",
        }]
        aliases = [{
            "fund_id": "odin4",
            "alias_name": "Odin Money Market Fund Odin 4",
            "alias_source": "alpha:verified_identity:2026-09-20",
            "match_confidence": 1.0,
        }]
        legacy_ingest.set_provider_alias_registry(aliases, funds)

        fetch.return_value = """
        <table>
          <tr><td>Odin Money Market Fund Odin 4</td><td>1.2681</td><td>16 Sep 2026</td></tr>
        </table>
        """
        rows = legacy_ingest.scrape_alpha_odin(
            {"Odin 4": funds[0]}
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["fund_id"], "odin4")
        self.assertEqual(rows[0]["nav"], 1.2681)
        self.assertEqual(rows[0]["as_of_date"], "2026-09-16")
        self.assertEqual(rows[0]["source_id"], "src_alpha_odin")

        fetch.return_value = """
        <table>
          <tr><td>Odin Money Market Fund Odin 4</td><td>1.2681</td></tr>
        </table>
        """
        self.assertEqual(
            legacy_ingest.scrape_alpha_odin({"Odin 4": funds[0]}),
            [],
        )

    def test_provider_alias_registry_is_exact_and_provider_scoped(self):
        funds = [
            {"fund_id": "prime-1", "canonical_name": "Ebank Fund III (Konooz)", "management_company": "Prime Investments"},
            {"fund_id": "hc-1", "canonical_name": "QNB AlAHLI (Tadawol)", "management_company": "HC Securities & Investment"},
        ]
        aliases = [
            {
                "fund_id": "prime-1",
                "alias_name": "Konooz",
                "alias_source": "prime:verified_identity:2026-09-20",
                "match_confidence": 1.0,
            },
            {
                "fund_id": "hc-1",
                "alias_name": "QNB (Tadawol)",
                "alias_source": "hc:verified_identity:2026-09-20",
                "match_confidence": 1.0,
            },
        ]
        legacy_ingest = __import__("scripts.ingest_nav", fromlist=["set_provider_alias_registry"])
        legacy_ingest.set_provider_alias_registry(aliases, funds)
        fund, score = legacy_ingest.provider_alias_match("Konooz", "prime")
        self.assertEqual(fund["fund_id"], "prime-1")
        self.assertEqual(score, 1.0)
        fund, score = legacy_ingest.provider_alias_match("QNB (Tadawol)", "hc")
        self.assertEqual(fund["fund_id"], "hc-1")
        self.assertEqual(score, 1.0)
        fund, score = legacy_ingest.provider_alias_match("Konooz", "hc")
        self.assertIsNone(fund)
        self.assertEqual(score, 0.0)


    def test_aaim_alias_registry_targets_own_manager_funds(self):
        funds = [
            {
                "fund_id": f"aaim-{i}",
                "canonical_name": canonical,
                "management_company": "Arab African Investment Management",
            }
            for i, canonical in enumerate([
                "Arab African International Bank (Shield)",
                "Arab African International Bank (Juman)",
                "Iskan Insurance",
                "Diamond",
                "Misr Takaful",
                "Bareeq",
                "Fanar",
                "Sarwaty*",
                "Bonds Fixed Income USD Fund",
            ])
        ]
        aliases = [
            {
                "fund_id": fund["fund_id"],
                "alias_name": alias,
                "alias_source": "aaim:verified_identity:2026-09-20",
                "match_confidence": 1.0,
            }
            for fund, alias in zip(
                funds,
                [
                    "Shield Equity",
                    "Juman Money Market",
                    "Iskan Money Market",
                    "Diamond Money Market",
                    "Misr Takaful Sharia Compliant Money Market",
                    "Bareeq Fixed Income EGP",
                    "El Fanar Money Market",
                    "Sarwaty Money Market",
                    "Bond Fixed Income USD",
                ],
            )
        ]
        legacy_ingest.set_provider_alias_registry(aliases, funds)
        for alias, expected_id in zip(
            ["Shield Equity","Juman Money Market","Iskan Money Market","Diamond Money Market",
             "Misr Takaful Sharia Compliant Money Market","Bareeq Fixed Income EGP",
             "El Fanar Money Market","Sarwaty Money Market","Bond Fixed Income USD"],
            [f["fund_id"] for f in funds],
        ):
            fund, score = legacy_ingest.provider_alias_match(alias, "aaim")
            self.assertEqual(fund["fund_id"], expected_id)
            self.assertEqual(score, 1.0)

    def test_zaldi_source_alias_is_normalized(self):
        rows = [{"source_id": "src_zaldi", "raw": {}}]
        safe._normalize_source_ids(rows)
        self.assertEqual(rows[0]["source_id"], "src_zaldi_capital")
        self.assertEqual(rows[0]["raw"]["source_id_normalized_from"], "src_zaldi")


    @patch.object(safe.legacy, "sb_get")
    def test_eima_fallback_uses_exact_latest_weekly_identity(self, sb_get):
        fund = {
            "fund_id": "fund-1",
            "canonical_name": "Test Fund",
            "currency": "EGP",
        }
        sb_get.side_effect = [
            [{"report_date": "2026-09-03"}],
            [{
                "fund_id": "fund-1",
                "report_date": "2026-09-03",
                "nav_value": 123.45,
                "currency": "EGP",
                "source_id": "src_eima_weekly_tw",
                "raw": {
                    "pdf_name": "Test Fund",
                    "source_url": "https://eima.org.eg/example.pdf",
                },
            }],
        ]
        rows = safe._latest_eima_fallback_rows([fund])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["fund_id"], "fund-1")
        self.assertEqual(rows[0]["nav"], 123.45)
        self.assertEqual(rows[0]["as_of_date"], "2026-09-03")
        self.assertEqual(rows[0]["source_id"], "src_eima_weekly_tw")
        self.assertEqual(rows[0]["raw"]["identity_match"], "exact_fund_id")
        self.assertEqual(rows[0]["raw"]["frequency_provenance"], "weekly")


    def test_fallback_priority_prefers_snduk_over_eima(self):
        snduk = [{"fund_id": "fund-1", "as_of_date": "2026-09-17", "source_id": "src_snduk"}]
        eima = [{"fund_id": "fund-1", "as_of_date": "2026-09-03", "source_id": "src_eima_weekly_tw"}]
        selected = safe._select_fallbacks([], snduk, eima)
        self.assertEqual(selected, snduk)

    def test_snduk_fallback_is_selected_only_without_current_manager_candidate(self):
        snduk = [{"fund_id": "fund-1", "as_of_date": "2026-09-17", "source_id": "src_snduk"}]
        selected = safe._select_fallbacks([], snduk)
        self.assertEqual(selected, snduk)
        manager = [{"fund_id": "fund-1", "as_of_date": "2026-09-17", "source_id": "src_manager"}]
        self.assertEqual(safe._select_fallbacks(manager, snduk), [])


    def test_freshness_classifies_bounded_future_as_current(self):
        future = (safe.TODAY + __import__("datetime").timedelta(days=3)).isoformat()
        from scripts.nav_freshness_report import classify_freshness
        self.assertEqual(classify_freshness(10.0, future, safe.TODAY), "CURRENT_BOUNDED_FUTURE")

    def test_freshness_classifies_future_outside_window_separately(self):
        future = (safe.TODAY + __import__("datetime").timedelta(days=8)).isoformat()
        from scripts.nav_freshness_report import classify_freshness
        self.assertEqual(classify_freshness(10.0, future, safe.TODAY), "FUTURE_OUTSIDE_WINDOW")

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
        fund_patch, source_patch = self._contract_context(
            fund_id="granite_first_fund__granite_fund_management",
            manager="Granite Fund Management",
            source_id="src_granite_eg",
            source_url="https://www.granite.eg/",
            fund_url="https://www.granite.eg/",
        )
        with fund_patch, source_patch:
            with patch.object(safe.legacy, "sb_get", return_value=[]):
                with patch.object(safe.legacy, "sb_post", return_value=SimpleNamespace(status_code=201, text="")) as sb_post:
                    safe.safe_upsert_official([row])
                sb_post.assert_called_once()
                self.assertEqual(sb_post.call_args.args[1][0]["source_id"], "src_granite_eg")
                self.assertEqual(sb_post.call_args.args[1][0]["as_of_date"], "2026-09-17")

    def test_snduk_alias_registry_requires_exact_verified_alias(self):
        fund = {"fund_id": "fund-1", "canonical_name": "Test Fund"}
        aliases = [{
            "fund_id": "fund-1",
            "alias_name": "Test Fund Provider Label",
            "normalized_alias": "test fund provider label",
            "alias_source": "snduk:verified_identity:2026-09-19",
            "match_confidence": 1.0,
        }]
        resolved, score = safe._explicit_snduk_alias("Test Fund Provider Label", [fund], aliases)
        self.assertEqual(resolved["fund_id"], "fund-1")
        self.assertEqual(score, 1.0)
        unresolved, unresolved_score = safe._explicit_snduk_alias("Test Fund", [fund], aliases)
        self.assertIsNone(unresolved)
        self.assertEqual(unresolved_score, 0.0)
        wrong_provider = [{
            "fund_id": "fund-1",
            "alias_name": "Test Fund Provider Label",
            "normalized_alias": "test fund provider label",
            "alias_source": "other_provider:verified_identity:2026-09-19",
            "match_confidence": 1.0,
        }]
        unresolved, unresolved_score = safe._explicit_snduk_alias(
            "Test Fund Provider Label", [fund], wrong_provider
        )
        self.assertIsNone(unresolved)
        self.assertEqual(unresolved_score, 0.0)

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
        fund_patch, source_patch = self._contract_context(
            fund_id="granite_first_fund__granite_fund_management",
            manager="Granite Fund Management",
            source_id="src_snduk",
            source_url="https://snduk.com/eg/page/mutual-funds-prices-today?lang=en",
            fund_url="https://snduk.com/eg/page/mutual-funds-prices-today?lang=en",
        )
        with fund_patch, source_patch:
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

    def test_snduk_fallback_api_has_no_obsolete_match_parameter(self):
        import inspect
        self.assertNotIn("match", inspect.signature(safe._snduk_fallback_rows).parameters)

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
        fund_patch, source_patch = self._contract_context(
            fund_id=fund_id,
            manager="Granite Fund Management",
            source_id="src_snduk",
            source_url="https://snduk.com/x",
            fund_url="https://snduk.com/x",
        )
        with fund_patch, source_patch:
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


if __name__ == "__main__":
    unittest.main()
