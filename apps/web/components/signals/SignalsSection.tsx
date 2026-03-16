import { SignalPill } from "@/components/SignalPill";
import { SignalLog } from "@/lib/types";

function numberFormat(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

type SignalsSectionProps = {
  signals: SignalLog[];
};

export function SignalsSection({ signals }: SignalsSectionProps) {
  return (
    <section className="card p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">시그널 로그</h2>
        <p className="text-xs text-[#7a6a51]">최근 발생 순</p>
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
              <SignalPill type={sig.signal_type} strength={sig.signal_strength} />
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
