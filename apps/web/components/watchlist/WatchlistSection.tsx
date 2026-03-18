import { FormEvent } from "react";

import { SignalPill } from "@/components/SignalPill";
import { HoldingState, LiveWatchlistItem, SymbolSearchResult, WatchlistItem } from "@/lib/types";

function numberFormat(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

type WatchlistSectionProps = {
  liveRows: LiveWatchlistItem[];
  watchlistItemMap: Map<string, WatchlistItem>;
  newSymbol: string;
  newHoldingState: HoldingState | "";
  newEntryPrice: string;
  newQuantity: string;
  newStopLossPrice: string;
  newTakeProfitPrice: string;
  newNote: string;
  selectedSymbol: SymbolSearchResult | null;
  symbolSuggestions: SymbolSearchResult[];
  resolvedSymbolName: string | null;
  isResolvingSymbol: boolean;
  symbolLookupMessage: string;
  canSubmitAdd: boolean;
  onSymbolChange: (value: string) => void;
  onSelectSymbol: (item: SymbolSearchResult) => void;
  onHoldingStateChange: (value: HoldingState | "") => void;
  onEntryPriceChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onStopLossPriceChange: (value: string) => void;
  onTakeProfitPriceChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onAddSymbol: (event: FormEvent<HTMLFormElement>) => void;
  onToggleItem: (item: WatchlistItem) => void;
  onDeleteItem: (item: WatchlistItem) => void;
  onOpenChart: (symbol: string) => void;
  onOpenPositionEditor: (symbol: string) => void;
};

export function WatchlistSection({
  liveRows,
  watchlistItemMap,
  newSymbol,
  newHoldingState,
  newEntryPrice,
  newQuantity,
  newStopLossPrice,
  newTakeProfitPrice,
  newNote,
  selectedSymbol,
  symbolSuggestions,
  resolvedSymbolName,
  isResolvingSymbol,
  symbolLookupMessage,
  canSubmitAdd,
  onSymbolChange,
  onSelectSymbol,
  onHoldingStateChange,
  onEntryPriceChange,
  onQuantityChange,
  onStopLossPriceChange,
  onTakeProfitPriceChange,
  onNoteChange,
  onAddSymbol,
  onToggleItem,
  onDeleteItem,
  onOpenChart,
  onOpenPositionEditor,
}: WatchlistSectionProps) {
  const isHolding = newHoldingState === "holding";

  return (
    <section className="card p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">워치리스트</h2>
        <p className="text-xs text-[#7a6a51]">종목별 최근 신호와 포지션 요약</p>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#d4c4aa] text-xs text-[#7a6a51]">
              <th className="pb-2">종목</th>
              <th className="pb-2">현재가</th>
              <th className="pb-2">변동률</th>
              <th className="pb-2">최근 신호</th>
              <th className="pb-2">포지션</th>
              <th className="pb-2">손익률</th>
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
                  <td className={`py-2 ${row.change_percent && row.change_percent < 0 ? "text-[#1f5bd8]" : "text-[#d9363e]"}`}>
                    {row.change_percent !== null ? `${row.change_percent.toFixed(2)}%` : "-"}
                  </td>
                  <td className="py-2">
                    {row.last_signal_type && row.last_signal_strength ? (
                      <div className="space-y-1">
                        <SignalPill type={row.last_signal_type} strength={row.last_signal_strength} />
                        <p className="max-w-[280px] text-xs text-[#496466]">{row.last_signal_reason}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-[#7a6a51]">최근 신호 없음</span>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="text-xs">
                      <div>{row.holding_state === "holding" ? "보유중" : "미보유"}</div>
                      <div>진입: {row.entry_price ? `${numberFormat(row.entry_price, 0)}원` : "-"}</div>
                      <div>수량: {row.quantity ?? "-"}</div>
                    </div>
                  </td>
                  <td className={`py-2 ${row.pnl_percent && row.pnl_percent < 0 ? "text-[#1f5bd8]" : "text-[#d9363e]"}`}>
                    {row.pnl_percent !== null ? `${row.pnl_percent.toFixed(2)}%` : "-"}
                  </td>
                  <td className="py-2">{item?.enabled ? "ON" : "OFF"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      {item ? (
                        <>
                          <button className="rounded-md border border-[#c9b89c] px-2 py-1 text-xs" onClick={() => onToggleItem(item)}>
                            {item.enabled ? "감시 끄기" : "감시 켜기"}
                          </button>
                          <button className="rounded-md border border-[#c9b89c] px-2 py-1 text-xs" type="button" onClick={() => onOpenChart(row.symbol)}>
                            차트
                          </button>
                          <button className="rounded-md border border-[#c9b89c] px-2 py-1 text-xs" type="button" onClick={() => onOpenPositionEditor(row.symbol)}>
                            포지션 수정
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

      <form className="mt-4 grid gap-2 rounded-md border border-[#d4c4aa] p-3 md:grid-cols-2" onSubmit={onAddSymbol}>
        <label className="text-sm">
          종목코드 또는 종목명
          <input
            className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-3 py-2 text-sm"
            placeholder="예: 005930, 삼성전자, 삼성"
            value={newSymbol}
            onChange={(e) => onSymbolChange(e.target.value)}
          />
        </label>
        <div className="text-xs text-[#7a6a51] md:col-span-2">
          {selectedSymbol ? (
            <p className="text-[#1f7a59]">
              선택된 종목: {selectedSymbol.symbol_name} ({selectedSymbol.symbol})
              {selectedSymbol.market ? ` · ${selectedSymbol.market}` : ""}
            </p>
          ) : (
            <p>{isResolvingSymbol ? "종목 검색 중..." : symbolLookupMessage}</p>
          )}
          {symbolSuggestions.length > 0 ? (
            <div className="mt-2 max-h-40 overflow-auto rounded-md border border-[#d4c4aa] bg-white">
              {symbolSuggestions.map((item) => (
                <button
                  key={`${item.symbol}-${item.source}`}
                  type="button"
                  className={`block w-full border-b border-[#f0e6d7] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[#f9f4ea] ${
                    selectedSymbol?.symbol === item.symbol ? "bg-[#edf7f3]" : ""
                  }`}
                  onClick={() => onSelectSymbol(item)}
                >
                  {item.symbol_name} ({item.symbol})
                  {item.market ? <span className="ml-1 text-xs text-[#7a6a51]">· {item.market}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
          {resolvedSymbolName && !selectedSymbol ? <p className="mt-1 text-[#1f7a59]">종목명: {resolvedSymbolName}</p> : null}
        </div>
        <label className="text-sm">
          보유여부 (필수)
          <select
            className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-2 text-sm"
            value={newHoldingState}
            onChange={(e) => onHoldingStateChange(e.target.value as HoldingState | "")}
          >
            <option value="">선택하세요</option>
            <option value="not_holding">미보유</option>
            <option value="holding">보유중</option>
          </select>
        </label>

        <label className="text-sm">
          진입가 {isHolding ? "(필수)" : "(선택)"}
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-3 py-2 text-sm"
            value={newEntryPrice}
            onChange={(e) => onEntryPriceChange(e.target.value)}
          />
        </label>
        <label className="text-sm">
          수량 {isHolding ? "(필수, 정수)" : "(선택)"}
          <input
            type="number"
            min={1}
            step={1}
            className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-3 py-2 text-sm"
            value={newQuantity}
            onChange={(e) => onQuantityChange(e.target.value)}
          />
        </label>

        <label className="text-sm">
          손절가 (선택)
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-3 py-2 text-sm"
            value={newStopLossPrice}
            onChange={(e) => onStopLossPriceChange(e.target.value)}
          />
        </label>
        <label className="text-sm">
          익절가 (선택)
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-3 py-2 text-sm"
            value={newTakeProfitPrice}
            onChange={(e) => onTakeProfitPriceChange(e.target.value)}
          />
        </label>

        <label className="text-sm md:col-span-2">
          메모 (선택)
          <input
            className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-3 py-2 text-sm"
            value={newNote}
            onChange={(e) => onNoteChange(e.target.value)}
          />
        </label>

        <div className="md:col-span-2">
          <button
            className="rounded-md bg-[#113c3a] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#6b8f8d]"
            disabled={!canSubmitAdd || isResolvingSymbol}
          >
            종목 추가
          </button>
        </div>
      </form>
    </section>
  );
}
