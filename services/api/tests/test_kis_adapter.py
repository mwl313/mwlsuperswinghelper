import unittest

from app.services.market_data.kis_adapter import KoreaInvestmentAdapter


class _FakeKISAdapter(KoreaInvestmentAdapter):
    def __init__(self) -> None:
        super().__init__(
            app_key="test-key",
            app_secret="test-secret",
            base_url="https://example.invalid",
            poll_interval_seconds=0.0,
            request_timeout_seconds=5.0,
            market_div_code="J",
            quote_tr_id="FHKST01010100",
            intraday_tr_id="FHKST03010200",
        )
        self._quote_calls: dict[str, int] = {}

    async def _ensure_access_token(self) -> str | None:
        return "token"

    async def _request_json(self, method, path, *, headers=None, params=None, json_body=None):  # type: ignore[override]
        if path.endswith("/inquire-price"):
            symbol = (params or {}).get("fid_input_iscd", "")
            self._quote_calls[symbol] = self._quote_calls.get(symbol, 0) + 1
            count = self._quote_calls[symbol]
            return {
                "output": {
                    "stck_prpr": "70000" if symbol == "005930" else "120000",
                    "acml_vol": "1000" if count == 1 else "1125",
                    "stck_bsop_date": "20260316",
                    "stck_cntg_hour": "093001",
                }
            }

        if path.endswith("/inquire-time-itemchartprice"):
            return {
                "output2": [
                    {
                        "stck_bsop_date": "20260316",
                        "stck_cntg_hour": "093200",
                        "stck_oprc": "70000",
                        "stck_hgpr": "70100",
                        "stck_lwpr": "69900",
                        "stck_prpr": "70050",
                        "cntg_vol": "500",
                    },
                    {
                        "stck_bsop_date": "20260316",
                        "stck_cntg_hour": "093100",
                        "stck_oprc": "69900",
                        "stck_hgpr": "70050",
                        "stck_lwpr": "69850",
                        "stck_prpr": "70000",
                        "cntg_vol": "420",
                    },
                ]
            }

        return {}


class KISAdapterTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_ticks_computes_delta_volume(self) -> None:
        adapter = _FakeKISAdapter()
        first = await adapter.get_ticks(["005930"])
        second = await adapter.get_ticks(["005930"])

        self.assertEqual(len(first), 1)
        self.assertEqual(len(second), 1)
        self.assertEqual(first[0].price, 70000.0)
        self.assertEqual(first[0].volume, 0.0)
        self.assertEqual(second[0].volume, 125.0)

    async def test_get_recent_candles_sorted_ascending(self) -> None:
        adapter = _FakeKISAdapter()
        candles = await adapter.get_recent_candles(symbol="005930", limit=240)

        self.assertEqual(len(candles), 2)
        self.assertLess(candles[0].timestamp, candles[1].timestamp)
        self.assertEqual(candles[0].close, 70000.0)
        self.assertEqual(candles[1].close, 70050.0)


if __name__ == "__main__":
    unittest.main()
