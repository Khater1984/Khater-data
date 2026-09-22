"""Snduk fallback identity: explicit alias only + currency gate."""
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-key")

from scripts import ingest_nav_safe as safe


class SndukFallbackIdentityTests(unittest.TestCase):
    def test_rejects_non_explicit_names(self):
        funds = [
            {"fund_id": "granite_first_fund__granite_fund_management", "canonical_name": "Granite First Fund", "currency": "EGP"},
            {"fund_id": "maksab_second_tranche_euro", "canonical_name": "Maksab Second Tranche (Euro)", "currency": "EUR"},
            {"fund_id": "maksab_oz_euro", "canonical_name": "Maksab OZ Euro", "currency": "EUR"},
            {"fund_id": "misr_money_market_euro__ci_asset_management", "canonical_name": "Misr Money Market (Euro)", "currency": "EUR"},
        ]
        for snduk_name in (
            "Granite Fixed Income Fund EGP",
            "Granite USD Fixed Income Fund",
            "Granite First Fund",
            "Maksab Second Tranche (Euro)",
            "Maksab OZ Euro",
            "Maksab OZ - Euro",
        ):
            fund, score = safe._explicit_snduk_alias(snduk_name, funds)
            self.assertIsNone(fund, msg=f"{snduk_name!r} must not be an explicit alias")
            self.assertEqual(score, 0.0)

    def test_granite_first_not_aliased_to_fixed_income(self):
        funds = [{"fund_id": "granite_first_fund__granite_fund_management", "canonical_name": "Granite First Fund", "currency": "EGP"}]
        for name in ("Granite Fixed Income Fund EGP", "Granite USD Fixed Income Fund"):
            fund, _ = safe._explicit_snduk_alias(name, funds)
            self.assertIsNone(fund)

    def test_maksab_second_tranche_not_aliased_to_oz_euro(self):
        funds = [
            {"fund_id": "maksab_second_tranche_euro", "canonical_name": "Maksab Second Tranche (Euro)", "currency": "EUR"},
            {"fund_id": "maksab_oz_euro", "canonical_name": "Maksab OZ Euro", "currency": "EUR"},
        ]
        self.assertIsNone(safe._explicit_snduk_alias("Maksab OZ Euro", funds)[0])
        self.assertIsNone(safe._explicit_snduk_alias("Maksab Second Tranche (Euro)", funds)[0])

    def test_currency_mismatch_rejects(self):
        self.assertFalse(safe._currencies_compatible("EUR", "EGP"))
        self.assertFalse(safe._currencies_compatible("EGP", "USD"))
        self.assertFalse(safe._currencies_compatible("EUR", None))
        self.assertTrue(safe._currencies_compatible("EUR", "EURO"))
        self.assertTrue(safe._currencies_compatible("EGP", "EGP"))

    def test_fallback_does_not_call_fuzzy_match(self):
        funds = [{"fund_id": "granite_first_fund__granite_fund_management", "canonical_name": "Granite First Fund", "currency": "EGP"}]

        def boom(_name):
            raise AssertionError("generic fuzzy match must not run on Snduk fallback")

        html = """<html><body><table>
          <tr><th>Fund</th><th>Type</th><th>Date</th><th>Price</th></tr>
          <tr><td>99 Granite Fixed Income Fund EGP</td><td>Fixed Income</td>
              <td>Sep 17, 2026</td><td>EGP 1.1822</td></tr>
        </table></body></html>"""

        class Resp:
            text = html
            def raise_for_status(self):
                return None

        with patch("requests.get", return_value=Resp()):
            rows = safe._snduk_fallback_rows(funds)
        self.assertEqual(rows, [])

    def test_misr_euro_verified_alias_still_works(self):
        funds = [{
            "fund_id": "misr_money_market_euro__ci_asset_management",
            "canonical_name": "Misr Money Market (Euro)",
            "currency": "EUR",
        }]
        aliases = [{
            "fund_id": "misr_money_market_euro__ci_asset_management",
            "alias_name": "Banque Misr Mutual Fund in Euro ( day by day Euro )",
            "normalized_alias": "banque misr mutual fund in euro day by day euro",
            "alias_source": "snduk:verified_identity:2026-09-19",
            "match_confidence": 1.0,
        }]
        fund, score = safe._explicit_snduk_alias(
            "Banque Misr Mutual Fund in Euro ( day by day Euro )", funds, aliases
        )
        self.assertIsNotNone(fund)
        self.assertEqual(score, 1.0)


    def test_new_verified_aliases_resolve_exactly(self):
        funds = [
            {"fund_id": "agricultural_bank_of_egypt_al_wefak__ci_asset_management", "canonical_name": "Agricultural Bank of Egypt (Al Wefak)", "currency": "EGP"},
            {"fund_id": "mubasher_equity__mubasher_asset_management", "canonical_name": "Mubasher Equity", "currency": "EGP"},
            {"fund_id": "siula_money_market__ni_capital", "canonical_name": "Siula Money Market", "currency": "EGP"},
            {"fund_id": "housing_development_bank_mawared__pfi_asset_management", "canonical_name": "Housing & Development Bank (Mawared)", "currency": "EGP"},
            {"fund_id": "pfi_cashi__pfi_asset_management", "canonical_name": "PFI Cashi", "currency": "EGP"},
            {"fund_id": "odin_trend__x", "canonical_name": "Odin Trend", "currency": "EGP"},
        ]
        aliases = [
            {"fund_id": "agricultural_bank_of_egypt_al_wefak__ci_asset_management", "alias_name": "Al Wefak Shariah Compliant Investment Fund", "alias_source": "snduk:verified_identity:2026-09-20", "match_confidence": 1.0},
            {"fund_id": "mubasher_equity__mubasher_asset_management", "alias_name": "Mubasher Equity Fund", "alias_source": "snduk:verified_identity:2026-09-20", "match_confidence": 1.0},
            {"fund_id": "siula_money_market__ni_capital", "alias_name": "Siula Money Market Fund - NI Capital", "alias_source": "snduk:verified_identity:2026-09-20", "match_confidence": 1.0},
            {"fund_id": "housing_development_bank_mawared__pfi_asset_management", "alias_name": "Mawared Money Market Fund – HD BANK", "alias_source": "snduk:verified_identity:2026-09-20", "match_confidence": 1.0},
            {"fund_id": "pfi_cashi__pfi_asset_management", "alias_name": "PFI Cashi Money Market Fund", "alias_source": "snduk:verified_identity:2026-09-20", "match_confidence": 1.0},
            {"fund_id": "odin_trend__x", "alias_name": "Odin Equity Fund Trend", "alias_source": "snduk:verified_identity:2026-09-20", "match_confidence": 1.0},
        ]
        for alias in aliases:
            fund, score = safe._explicit_snduk_alias(alias["alias_name"], funds, aliases)
            self.assertEqual(fund["fund_id"], alias["fund_id"])
            self.assertEqual(score, 1.0)

    def test_unregistered_misr_euro_alias_does_not_work(self):
        funds = [{
            "fund_id": "misr_money_market_euro__ci_asset_management",
            "canonical_name": "Misr Money Market (Euro)",
            "currency": "EUR",
        }]
        fund, score = safe._explicit_snduk_alias(
            "Banque Misr Mutual Fund in Euro", funds, []
        )
        self.assertIsNone(fund)
        self.assertEqual(score, 0.0)


if __name__ == "__main__":
    unittest.main()
