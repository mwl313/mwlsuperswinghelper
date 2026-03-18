import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { HoldingState, LiveWatchlistItem, PositionUpsertPayload } from "@/lib/types";

type PositionEditorModalProps = {
  isOpen: boolean;
  symbol: string | null;
  symbolName: string | null;
  initial: LiveWatchlistItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: PositionUpsertPayload) => Promise<void>;
  onClosePosition: () => Promise<void>;
};

function toText(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export function PositionEditorModal({
  isOpen,
  symbol,
  symbolName,
  initial,
  isSaving,
  onClose,
  onSubmit,
  onClosePosition,
}: PositionEditorModalProps) {
  const [holdingState, setHoldingState] = useState<HoldingState>("not_holding");
  const [entryPrice, setEntryPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const prevOpenRef = useRef(false);
  const prevSymbolRef = useRef<string | null>(null);

  useEffect(() => {
    const openedNow = isOpen && !prevOpenRef.current;
    const symbolChangedWhileOpen = isOpen && symbol !== prevSymbolRef.current;

    if (isOpen && (openedNow || symbolChangedWhileOpen)) {
      setHoldingState(initial?.holding_state ?? "not_holding");
      setEntryPrice(toText(initial?.entry_price));
      setQuantity(toText(initial?.quantity));
      setStopLossPrice(toText(initial?.stop_loss_price));
      setTakeProfitPrice(toText(initial?.take_profit_price));
      setNote(initial?.note ?? "");
      setError(null);
    }

    prevOpenRef.current = isOpen;
    prevSymbolRef.current = isOpen ? symbol : null;
  }, [isOpen, symbol, initial]);

  const hasOpenPosition = initial?.holding_state === "holding";

  const canSubmit = useMemo(() => {
    if (!symbol) return false;
    if (holdingState === "holding") {
      const entry = Number(entryPrice);
      const qty = Number(quantity);
      return Number.isFinite(entry) && entry > 0 && Number.isInteger(qty) && qty >= 1;
    }
    return true;
  }, [symbol, holdingState, entryPrice, quantity]);

  if (!isOpen || !symbol) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload: PositionUpsertPayload = {
      holding_state: holdingState,
      symbol_name: symbolName ?? undefined,
      note: note.trim() || null,
    };

    if (holdingState === "holding") {
      const entry = Number(entryPrice);
      const qty = Number(quantity);
      if (!Number.isFinite(entry) || entry <= 0) {
        setError("보유중일 때 진입가는 0보다 커야 합니다.");
        return;
      }
      if (!Number.isInteger(qty) || qty < 1) {
        setError("수량은 1 이상 정수만 입력할 수 있습니다.");
        return;
      }
      payload.entry_price = entry;
      payload.quantity = qty;
    }

    if (stopLossPrice.trim()) {
      const stop = Number(stopLossPrice);
      if (!Number.isFinite(stop) || stop <= 0) {
        setError("손절가는 0보다 커야 합니다.");
        return;
      }
      payload.stop_loss_price = stop;
    }

    if (takeProfitPrice.trim()) {
      const take = Number(takeProfitPrice);
      if (!Number.isFinite(take) || take <= 0) {
        setError("익절가는 0보다 커야 합니다.");
        return;
      }
      payload.take_profit_price = take;
    }

    await onSubmit(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-xl p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">포지션 수정</h3>
            <p className="text-xs text-[#5a6f81]">
              {symbolName ?? symbol} ({symbol})
            </p>
          </div>
          <button className="rounded-md border border-[#d7e0e8] px-2 py-1 text-xs" type="button" onClick={onClose}>
            닫기
          </button>
        </div>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="text-sm md:col-span-2">
            보유여부
            <select
              className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
              value={holdingState}
              onChange={(event) => setHoldingState(event.target.value as HoldingState)}
            >
              <option value="not_holding">미보유</option>
              <option value="holding">보유중</option>
            </select>
          </label>

          <label className="text-sm">
            진입가 {holdingState === "holding" ? "(필수)" : "(선택)"}
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
              value={entryPrice}
              onChange={(event) => setEntryPrice(event.target.value)}
            />
          </label>
          <label className="text-sm">
            수량 {holdingState === "holding" ? "(필수, 정수)" : "(선택)"}
            <input
              type="number"
              min={1}
              step={1}
              className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>

          <label className="text-sm">
            손절가 (선택)
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
              value={stopLossPrice}
              onChange={(event) => setStopLossPrice(event.target.value)}
            />
          </label>
          <label className="text-sm">
            익절가 (선택)
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
              value={takeProfitPrice}
              onChange={(event) => setTakeProfitPrice(event.target.value)}
            />
          </label>

          <label className="text-sm md:col-span-2">
            메모 (선택)
            <textarea
              className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {error ? <p className="text-sm text-[#a4302d] md:col-span-2">{error}</p> : null}

          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button
              className="rounded-md bg-[#113c3a] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#6b8f8d]"
              type="submit"
              disabled={isSaving || !canSubmit}
            >
              {isSaving ? "저장 중..." : "저장"}
            </button>
            <button
              className="rounded-md border border-[#d7e0e8] bg-white px-4 py-2 text-sm"
              type="button"
              onClick={onClose}
              disabled={isSaving}
            >
              취소
            </button>
            <button
              className="rounded-md border border-[#d4a3a0] bg-[#fff4f3] px-4 py-2 text-sm text-[#9a2f29] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => {
                void onClosePosition();
              }}
              disabled={isSaving || !hasOpenPosition}
            >
              포지션 종료
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
