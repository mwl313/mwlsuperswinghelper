import { SignalStrength, SignalType } from "@/lib/types";

const typeLabel: Record<SignalType, string> = {
  buy_candidate: "매수 후보",
  breakout: "돌파 감시",
  sell_warning: "매도 경고",
};

const strengthLabel: Record<SignalStrength, string> = {
  weak: "약",
  medium: "중",
  strong: "강",
};

export function SignalPill({ type, strength }: { type: SignalType; strength: SignalStrength }) {
  const cls = strength === "strong" ? "signal-strong" : strength === "medium" ? "signal-medium" : "signal-weak";
  return (
    <div className={`rounded-full border border-[#c9b89c] px-3 py-1 text-xs ${cls}`}>
      {typeLabel[type]} · {strengthLabel[strength]}
    </div>
  );
}
