"use client";

type ChartSymbolOption = {
  symbol: string;
  symbol_name: string;
};

type ChartControlsProps = {
  symbols: ChartSymbolOption[];
  selectedSymbol: string;
  timeframe: "1m" | "5m" | "15m" | "1h";
  isLoading: boolean;
  onSelectSymbol: (symbol: string) => void;
  onTimeframeChange: (timeframe: "1m" | "5m" | "15m" | "1h") => void;
  onRefresh: () => void;
};

export function ChartControls({
  symbols,
  selectedSymbol,
  timeframe,
  isLoading,
  onSelectSymbol,
  onTimeframeChange,
  onRefresh,
}: ChartControlsProps) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-[#d7e0e8] bg-white px-3 py-2">
      <label className="min-w-[220px] flex-1 text-xs font-semibold text-[#5b6f82]">
        종목 선택
        <select
          className="mt-1 w-full rounded-md border border-[#d3dbe3] bg-[#f8fbff] px-2.5 py-1.5 text-sm text-[#1a2e3b]"
          value={selectedSymbol}
          onChange={(event) => onSelectSymbol(event.target.value)}
        >
          {symbols.map((row) => (
            <option key={row.symbol} value={row.symbol}>
              {row.symbol_name} ({row.symbol})
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1 rounded-md border border-[#d3dbe3] bg-[#f8fbff] p-1">
        {(["1m", "5m", "15m", "1h"] as const).map((option) => (
          <button
            key={option}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
              timeframe === option
                ? "border-[#0f6c5f] bg-[#e5f5f2] text-[#0f6c5f]"
                : "border-[#d3dbe3] bg-white text-[#4b5f73] hover:border-[#9ab0c3]"
            }`}
            type="button"
            aria-pressed={timeframe === option}
            onClick={() => onTimeframeChange(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <button
        className="rounded-md border border-[#d3dbe3] bg-white px-3 py-2 text-xs font-semibold text-[#324b5f] disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        disabled={isLoading}
        onClick={onRefresh}
      >
        {isLoading ? "갱신 중..." : "새로고침"}
      </button>
    </div>
  );
}
