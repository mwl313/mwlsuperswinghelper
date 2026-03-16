"use client";

type ChartSymbolOption = {
  symbol: string;
  symbol_name: string;
};

type ChartControlsProps = {
  symbols: ChartSymbolOption[];
  selectedSymbol: string;
  showRsi: boolean;
  showMarkers: boolean;
  isLoading: boolean;
  onSelectSymbol: (symbol: string) => void;
  onToggleRsi: (checked: boolean) => void;
  onToggleMarkers: (checked: boolean) => void;
  onRefresh: () => void;
};

export function ChartControls({
  symbols,
  selectedSymbol,
  showRsi,
  showMarkers,
  isLoading,
  onSelectSymbol,
  onToggleRsi,
  onToggleMarkers,
  onRefresh,
}: ChartControlsProps) {
  return (
    <div className="mb-4 grid gap-3 rounded-xl border border-[#d8c9ae] bg-white p-3 md:grid-cols-[1fr_auto_auto_auto]">
      <label className="text-sm">
        감시 종목
        <select
          className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
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

      <label className="flex items-center gap-2 self-end pb-1 text-sm">
        <input type="checkbox" checked={showRsi} onChange={(event) => onToggleRsi(event.target.checked)} />
        RSI 표시
      </label>

      <label className="flex items-center gap-2 self-end pb-1 text-sm">
        <input type="checkbox" checked={showMarkers} onChange={(event) => onToggleMarkers(event.target.checked)} />
        시그널 마커
      </label>

      <button
        className="self-end rounded-md border border-[#c9b89c] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        disabled={isLoading}
        onClick={onRefresh}
      >
        {isLoading ? "불러오는 중..." : "새로고침"}
      </button>
    </div>
  );
}

