import { useEffect, useMemo, useState } from "react";

import { SignalPill } from "@/components/SignalPill";
import { SignalLog } from "@/lib/types";

function numberFormat(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

type SignalsSectionProps = {
  signals: SignalLog[];
  isDeleting: boolean;
  onDeleteAll: () => Promise<void>;
  onDeleteBySymbol: (symbol: string) => Promise<void>;
  onDeleteOne: (id: number) => Promise<void>;
};

export function SignalsSection({ signals, isDeleting, onDeleteAll, onDeleteBySymbol, onDeleteOne }: SignalsSectionProps) {
  const [selectedSymbol, setSelectedSymbol] = useState("");

  const signalSymbols = useMemo(() => {
    const seen = new Set<string>();
    const rows: { symbol: string; symbol_name: string }[] = [];
    for (const sig of signals) {
      if (seen.has(sig.symbol)) continue;
      seen.add(sig.symbol);
      rows.push({ symbol: sig.symbol, symbol_name: sig.symbol_name });
    }
    return rows;
  }, [signals]);

  useEffect(() => {
    if (!selectedSymbol) return;
    if (signalSymbols.some((row) => row.symbol === selectedSymbol)) return;
    setSelectedSymbol("");
  }, [selectedSymbol, signalSymbols]);

  async function handleDeleteAll() {
    if (signals.length === 0) return;
    const ok = window.confirm("모든 시그널 로그를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.");
    if (!ok) return;
    await onDeleteAll();
  }

  async function handleDeleteBySymbol() {
    if (!selectedSymbol) return;
    const target = signalSymbols.find((row) => row.symbol === selectedSymbol);
    const label = target ? `${target.symbol_name} (${target.symbol})` : selectedSymbol;
    const ok = window.confirm(`${label} 종목의 시그널 로그를 모두 삭제하시겠습니까?`);
    if (!ok) return;
    await onDeleteBySymbol(selectedSymbol);
  }

  async function handleDeleteOne(sig: SignalLog) {
    if (!Number.isFinite(sig.id)) return;
    const ok = window.confirm("이 시그널 로그를 삭제하시겠습니까?");
    if (!ok) return;
    await onDeleteOne(sig.id);
  }

  return (
    <section className="card p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">시그널 로그</h2>
        <p className="text-xs text-[#7a6a51]">최근 발생 순</p>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#d8c9ae] bg-[#fffaf2] p-3">
        <button
          type="button"
          className="rounded-md border border-[#c99f9b] bg-[#fff1ef] px-3 py-1 text-xs font-semibold text-[#9a2f29] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            void handleDeleteAll();
          }}
          disabled={isDeleting || signals.length === 0}
        >
          전체 삭제
        </button>
        <select
          className="rounded-md border border-[#d7e0e8] bg-white px-2 py-1 text-xs"
          value={selectedSymbol}
          onChange={(event) => setSelectedSymbol(event.target.value)}
          disabled={isDeleting || signalSymbols.length === 0}
        >
          <option value="">종목 선택 후 삭제</option>
          {signalSymbols.map((row) => (
            <option key={row.symbol} value={row.symbol}>
              {row.symbol_name} ({row.symbol})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-md border border-[#c99f9b] bg-white px-3 py-1 text-xs font-semibold text-[#9a2f29] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            void handleDeleteBySymbol();
          }}
          disabled={isDeleting || !selectedSymbol}
        >
          선택 종목 삭제
        </button>
      </div>
      <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
        {signals.map((sig) => (
          <article key={`${sig.id ?? "ws"}-${sig.symbol}-${sig.created_at}`} className="rounded-xl border border-[#d8c9ae] bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  {sig.symbol_name} ({sig.symbol})
                </p>
                <p className="text-xs text-[#7a6a51]">{new Date(sig.created_at).toLocaleString("ko-KR")}</p>
              </div>
              <div className="flex items-center gap-2">
                <SignalPill type={sig.signal_type} strength={sig.signal_strength} />
                <button
                  type="button"
                  className="rounded-md border border-[#d7e0e8] bg-white px-2 py-1 text-xs text-[#7a6a51] hover:border-[#c99f9b] hover:text-[#9a2f29] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void handleDeleteOne(sig);
                  }}
                  disabled={isDeleting || !Number.isFinite(sig.id)}
                >
                  삭제
                </button>
              </div>
            </div>
            <p className="mb-2 text-sm text-[#304b4e]">{sig.reason_text}</p>
            <p className="text-xs text-[#7a6a51]">
              현재가 {numberFormat(sig.price)} / 거래량 {numberFormat(sig.volume)}
            </p>
          </article>
        ))}
        {signals.length === 0 ? <p className="text-sm text-[#7a6a51]">아직 시그널이 없습니다.</p> : null}
      </div>
    </section>
  );
}
