from dataclasses import dataclass
from datetime import datetime

from app.models.strategy_settings import StrategySettings
from app.services.candles import Candle
from app.services.indicators import bollinger, rsi, sma, support_resistance, volume_ratio


@dataclass(slots=True)
class SignalDecision:
    symbol: str
    symbol_name: str
    signal_type: str
    signal_strength: str
    price: float
    volume: float
    reason_text: str
    timestamp: datetime
    raw_payload: dict


def _to_strength(score: int) -> str:
    if score >= 4:
        return "strong"
    if score >= 3:
        return "medium"
    return "weak"


def _passes_strength_mode(mode: str, strength: str) -> bool:
    if mode == "all":
        return True
    return strength == "strong"


def evaluate_signals(
    candles: list[Candle],
    settings: StrategySettings,
    symbol: str,
    symbol_name: str,
    volume_lookback: int,
    sr_lookback: int,
) -> list[SignalDecision]:
    required_count = max(settings.ma_long, settings.bollinger_length, volume_lookback + 1, sr_lookback + 1)
    if len(candles) < required_count:
        return []

    closes = [c.close for c in candles]
    highs = [c.high for c in candles]
    lows = [c.low for c in candles]
    volumes = [c.volume for c in candles]
    latest = candles[-1]

    ma_short = sma(closes, settings.ma_short)
    ma_long = sma(closes, settings.ma_long)
    bb = bollinger(closes, settings.bollinger_length, settings.bollinger_std)
    vol_ratio = volume_ratio(volumes, volume_lookback)
    support, resistance = support_resistance(highs, lows, sr_lookback)
    latest_rsi = rsi(closes, 14)

    if ma_short is None or ma_long is None or bb is None or vol_ratio is None:
        return []

    bb_mid, bb_upper, bb_lower = bb
    trend_up = ma_short > ma_long
    trend_down = ma_short < ma_long
    near_mid_support = latest.close >= bb_mid and latest.low <= bb_mid * 1.003
    vol_surge = vol_ratio >= settings.volume_multiplier
    breakout = resistance is not None and latest.close > resistance
    support_break = support is not None and latest.close < support
    midline_breakdown = latest.close < bb_mid
    bearish_candle = latest.close < latest.open
    rsi_bonus = latest_rsi is not None and latest_rsi > 50

    decisions: list[SignalDecision] = []

    buy_conditions = [
        (not settings.use_trend_filter) or trend_up,
        (not settings.use_bollinger_support) or near_mid_support,
        (not settings.use_volume_surge) or vol_surge,
    ]
    if all(buy_conditions):
        score = 2
        reasons = []
        if trend_up:
            score += 1
            reasons.append(f"{settings.ma_short}MA가 {settings.ma_long}MA 위로 추세 우위")
        if near_mid_support:
            score += 1
            reasons.append("볼린저 중앙선 부근 지지 확인")
        if vol_surge:
            score += 1
            reasons.append(f"거래량 평균 대비 {vol_ratio:.2f}배 증가")
        if settings.use_rsi and rsi_bonus:
            score += 1
            reasons.append(f"RSI {latest_rsi:.1f}로 모멘텀 보강")
        strength = _to_strength(score)
        if _passes_strength_mode(settings.signal_strength_mode, strength):
            decisions.append(
                SignalDecision(
                    symbol=symbol,
                    symbol_name=symbol_name,
                    signal_type="buy_candidate",
                    signal_strength=strength,
                    price=latest.close,
                    volume=latest.volume,
                    reason_text="매수 후보: " + ", ".join(reasons[:4]),
                    timestamp=latest.timestamp,
                    raw_payload={
                        "ma_short": ma_short,
                        "ma_long": ma_long,
                        "bb_mid": bb_mid,
                        "bb_upper": bb_upper,
                        "bb_lower": bb_lower,
                        "volume_ratio": vol_ratio,
                        "support": support,
                        "resistance": resistance,
                        "rsi": latest_rsi,
                    },
                )
            )

    if settings.use_breakout and breakout and ((not settings.use_volume_surge) or vol_surge):
        score = 3
        reasons = [f"최근 저항 {resistance:.2f} 상향 돌파"] if resistance is not None else ["저항 돌파 감지"]
        if vol_surge:
            score += 1
            reasons.append(f"거래량 {vol_ratio:.2f}배")
        if trend_up:
            score += 1
            reasons.append("추세 필터 통과")
        strength = _to_strength(score)
        if _passes_strength_mode(settings.signal_strength_mode, strength):
            decisions.append(
                SignalDecision(
                    symbol=symbol,
                    symbol_name=symbol_name,
                    signal_type="breakout",
                    signal_strength=strength,
                    price=latest.close,
                    volume=latest.volume,
                    reason_text="돌파 감시: " + ", ".join(reasons[:4]),
                    timestamp=latest.timestamp,
                    raw_payload={
                        "resistance": resistance,
                        "volume_ratio": vol_ratio,
                        "ma_short": ma_short,
                        "ma_long": ma_long,
                    },
                )
            )

    sell_trigger = (midline_breakdown and bearish_candle and ((not settings.use_volume_surge) or vol_surge)) or support_break
    if sell_trigger:
        score = 2
        reasons = []
        if midline_breakdown:
            score += 1
            reasons.append("볼린저 중앙선 하향 이탈")
        if support_break and support is not None:
            score += 1
            reasons.append(f"주요 지지 {support:.2f} 이탈")
        if vol_surge:
            score += 1
            reasons.append(f"하락 구간 거래량 {vol_ratio:.2f}배")
        if trend_down:
            score += 1
            reasons.append("단기 추세 약화")
        strength = _to_strength(score)
        if _passes_strength_mode(settings.signal_strength_mode, strength):
            decisions.append(
                SignalDecision(
                    symbol=symbol,
                    symbol_name=symbol_name,
                    signal_type="sell_warning",
                    signal_strength=strength,
                    price=latest.close,
                    volume=latest.volume,
                    reason_text="매도 경고: " + ", ".join(reasons[:4]),
                    timestamp=latest.timestamp,
                    raw_payload={
                        "bb_mid": bb_mid,
                        "support": support,
                        "volume_ratio": vol_ratio,
                        "ma_short": ma_short,
                        "ma_long": ma_long,
                    },
                )
            )

    return decisions
