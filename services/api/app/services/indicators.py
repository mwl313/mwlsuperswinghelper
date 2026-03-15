from statistics import mean, pstdev


def sma(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    return mean(values[-period:])


def bollinger(values: list[float], length: int, std_factor: float) -> tuple[float, float, float] | None:
    if len(values) < length:
        return None
    window = values[-length:]
    mid = mean(window)
    std = pstdev(window)
    upper = mid + std_factor * std
    lower = mid - std_factor * std
    return mid, upper, lower


def volume_ratio(volumes: list[float], lookback: int) -> float | None:
    if len(volumes) < lookback + 1:
        return None
    avg_volume = mean(volumes[-lookback - 1 : -1])
    if avg_volume <= 0:
        return None
    return volumes[-1] / avg_volume


def support_resistance(highs: list[float], lows: list[float], lookback: int) -> tuple[float | None, float | None]:
    if len(highs) < lookback + 1 or len(lows) < lookback + 1:
        return None, None
    resistance = max(highs[-lookback - 1 : -1])
    support = min(lows[-lookback - 1 : -1])
    return support, resistance


def rsi(values: list[float], period: int = 14) -> float | None:
    if len(values) < period + 1:
        return None
    deltas = [values[i] - values[i - 1] for i in range(1, len(values))]
    gains = [max(delta, 0.0) for delta in deltas[-period:]]
    losses = [abs(min(delta, 0.0)) for delta in deltas[-period:]]
    avg_gain = mean(gains)
    avg_loss = mean(losses)
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))
