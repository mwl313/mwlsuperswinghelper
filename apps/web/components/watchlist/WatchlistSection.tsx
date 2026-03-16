import { FormEvent } from "react";

import { LiveWatchlistItem, WatchlistItem } from "@/lib/types";
import { SignalPill } from "@/components/SignalPill";

function numberFormat(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

type WatchlistSectionProps = {
  liveRows: LiveWatchlistItem[];
  watchlistItemMap: Map<string, WatchlistItem>;
  newSymbol: string;
  resolvedSymbolName: string | null;
  isResolvingSymbol: boolean;
  symbolLookupMessage: string;
  onSymbolChange: (value: string) => void;
  onAddSymbol: (event: FormEvent<HTMLFormElement>) => void;
  onToggleItem: (item: WatchlistItem) => void;
  onDeleteItem: (item: WatchlistItem) => void;
  onOpenChart: (symbol: string) => void;
};

export function WatchlistSection({
  liveRows,
  watchlistItemMap,
  newSymbol,
  resolvedSymbolName,
  isResolvingSymbol,
  symbolLookupMessage,
  onSymbolChange,
  onAddSymbol,
  onToggleItem,
  onDeleteItem,
  onOpenChart,
}: WatchlistSectionProps) {
  return (
    <section className="card p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">워치리스트</h2>
        <p className="text-xs text-[#7a6a51]">종목별 최근 신호와 감시 상태</p>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#d4c4aa] text-xs text-[#7a6a51]">
              <th className="pb-2">종목</th>
              <th className="pb-2">현재가</th>
              <th className="pb-2">변동률</th>
              <th className="pb-2">최근 신호</th>
              <th className="pb-2">감시</th>
              <th className="pb-2">관리</th>
            </tr>
          </thead>
          <tbody>
            {liveRows.map((row) => {
              const item = watchlistItemMap.get(row.symbol);
              return (
                <tr key={row.symbol} className="border-b border-[#eadcc8] align-top">
                  <td className="py-2">
                    <button className="text-left font-semibold text-[#113c3a] hover:underline" type="button" onClick={() => onOpenChart(row.symbol)}>
                      {row.symbol_name}
                    </button>
                    <div className="text-xs text-[#7a6a51]">{row.symbol}</div>
                  </td>
                  <td className="py-2">{numberFormat(row.price)}</td>
                  <td className={`py-2 ${row.change_percent && row.change_percent < 0 ? "text-[#a4302d]" : "text-[#1f7a59]"}`}>
                    {row.change_percent !== null ? `${row.change_percent.toFixed(2)}%` : "-"}
                  </td>
                  <td className="py-2">
                    {row.last_signal_type && row.last_signal_strength ? (
                      <div className="space-y-1">
                        <SignalPill type={row.last_signal_type} strength={row.last_signal_strength} />
                        <p className="max-w-[340px] text-xs text-[#496466]">{row.last_signal_reason}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-[#7a6a51]">최근 신호 없음</span>
                    )}
                  </td>
                  <td className="py-2">{item?.enabled ? "ON" : "OFF"}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      {item ? (
                        <>
                          <button className="rounded-md border border-[#c9b89c] px-2 py-1 text-xs" onClick={() => onToggleItem(item)}>
                            {item.enabled ? "감시 끄기" : "감시 켜기"}
                          </button>
                          <button className="rounded-md border border-[#c9b89c] px-2 py-1 text-xs" type="button" onClick={() => onOpenChart(row.symbol)}>
                            차트
                          </button>
                          <button className="rounded-md border border-[#c9b89c] px-2 py-1 text-xs" onClick={() => onDeleteItem(item)}>
                            삭제
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={onAddSymbol}>
        <input
          className="rounded-md border border-[#c9b89c] bg-white px-3 py-2 text-sm"
          placeholder="종목코드"
          value={newSymbol}
          onChange={(e) => onSymbolChange(e.target.value)}
        />
        <button
          className="rounded-md bg-[#113c3a] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#6b8f8d]"
          disabled={isResolvingSymbol || newSymbol.length !== 6 || !resolvedSymbolName}
        >
          종목 추가
        </button>
      </form>
      <p className={`mt-2 text-xs ${resolvedSymbolName ? "text-[#1f7a59]" : "text-[#7a6a51]"}`}>
        {isResolvingSymbol ? "종목명 확인 중..." : symbolLookupMessage}
      </p>
    </section>
  );
}
