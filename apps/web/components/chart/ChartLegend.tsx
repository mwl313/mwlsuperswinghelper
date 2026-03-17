"use client";

type ToggleKey = "candles" | "ma20" | "ma60" | "bollinger" | "markers" | "rsi" | "volume";

type ToggleState = Record<ToggleKey, boolean>;

type ChartLegendProps = {
  toggles: ToggleState;
  onToggle: (key: ToggleKey, next: boolean) => void;
};

function ToggleChip({
  label,
  active,
  sampleClassName,
  onClick,
}: {
  label: string;
  active: boolean;
  sampleClassName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
        active
          ? "border-[#0f6c5f] bg-[#e5f5f2] text-[#0f6c5f]"
          : "border-[#d3dbe3] bg-white text-[#5d7186] hover:border-[#9ab0c3]"
      }`}
    >
      <span className={sampleClassName} />
      <span>{label}</span>
    </button>
  );
}

export function ChartLegend({ toggles, onToggle }: ChartLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#d7e0e8] bg-white p-2">
      <span className="mr-1 text-[11px] font-semibold text-[#5d7186]">표시 항목</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d3dbe3] bg-white px-2 py-1 text-[11px] text-[#5d7186]">
        <span className="h-2.5 w-2.5 rounded-sm bg-[#1f7a59]" />
        양봉
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d3dbe3] bg-white px-2 py-1 text-[11px] text-[#5d7186]">
        <span className="h-2.5 w-2.5 rounded-sm bg-[#a4302d]" />
        음봉
      </span>

      <ToggleChip
        label="캔들"
        active={toggles.candles}
        sampleClassName="h-2.5 w-2.5 rounded-sm bg-[#1f7a59]"
        onClick={() => onToggle("candles", !toggles.candles)}
      />
      <ToggleChip
        label="MA20"
        active={toggles.ma20}
        sampleClassName="h-0.5 w-4 rounded bg-[#2b6de0]"
        onClick={() => onToggle("ma20", !toggles.ma20)}
      />
      <ToggleChip
        label="MA60"
        active={toggles.ma60}
        sampleClassName="h-0.5 w-4 rounded bg-[#6b46c1]"
        onClick={() => onToggle("ma60", !toggles.ma60)}
      />
      <ToggleChip
        label="볼린저"
        active={toggles.bollinger}
        sampleClassName="h-0.5 w-4 rounded bg-[#64748b]"
        onClick={() => onToggle("bollinger", !toggles.bollinger)}
      />
      <ToggleChip
        label="시그널"
        active={toggles.markers}
        sampleClassName="h-2.5 w-2.5 rounded-full bg-[#2d6cdf]"
        onClick={() => onToggle("markers", !toggles.markers)}
      />
      <ToggleChip
        label="거래량"
        active={toggles.volume}
        sampleClassName="h-2.5 w-2.5 rounded-sm bg-[#1f7a59]"
        onClick={() => onToggle("volume", !toggles.volume)}
      />
      <ToggleChip
        label="RSI"
        active={toggles.rsi}
        sampleClassName="h-0.5 w-4 rounded bg-[#bc5f07]"
        onClick={() => onToggle("rsi", !toggles.rsi)}
      />
    </div>
  );
}

