import { DashboardSummary } from "@/lib/types";

type SummarySectionProps = {
  summary: DashboardSummary;
  error: string | null;
  onEnableDesktopAlert: () => Promise<void>;
};

export function SummarySection({ summary, error, onEnableDesktopAlert }: SummarySectionProps) {
  return (
    <>
      <header className="card pulse mb-6 p-5 md:p-6">
        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-[#8a6d48]">KOSPI SWING SIGNAL MVP</p>
        <h1 className="mb-2 text-2xl font-bold md:text-3xl">초보 부업 투자자를 위한 신호 대시보드</h1>
        <p className="text-sm text-[#496466]">
          이 앱은 자동매매가 아닌 참고용 시그널 알림기입니다. 신호 이유를 확인하고 최종 판단은 직접 진행하세요.
        </p>
        {error ? <p className="mt-2 text-sm text-[#a4302d]">오류: {error}</p> : null}
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card p-4">
          <p className="text-xs text-[#7a6a51]">장 상태</p>
          <p className="mt-2 text-xl font-bold">{summary.market_status}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[#7a6a51]">오늘 알림 수</p>
          <p className="mt-2 text-xl font-bold">{summary.today_signal_count}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[#7a6a51]">강한 신호</p>
          <p className="mt-2 text-xl font-bold">{summary.strong_signal_count}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[#7a6a51]">감시 종목</p>
          <p className="mt-2 text-xl font-bold">
            {summary.watchlist_enabled} / {summary.watchlist_total}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[#7a6a51]">강한 신호 종목</p>
          <p className="mt-2 text-sm font-semibold">{summary.strong_symbols.join(", ") || "없음"}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4 md:p-5">
          <h2 className="mb-2 text-lg font-bold">용어 도움말</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <b>매수 후보</b>: 추세/거래량/지지 조건이 맞아 관심 있게 볼 구간
            </li>
            <li>
              <b>돌파 감시</b>: 최근 저항선을 넘어서는지 확인할 구간
            </li>
            <li>
              <b>매도 경고</b>: 추세 약화 또는 지지 이탈로 리스크가 커진 구간
            </li>
          </ul>
        </div>
        <div className="card p-4 md:p-5">
          <h2 className="mb-2 text-lg font-bold">알림 안내</h2>
          <p className="mb-3 text-sm text-[#496466]">
            같은 종목의 같은 신호는 쿨다운 시간 동안 중복 알림이 제한됩니다.
          </p>
          <button className="rounded-md border border-[#c9b89c] px-3 py-2 text-sm" onClick={() => void onEnableDesktopAlert()}>
            브라우저 알림 권한 요청
          </button>
        </div>
      </section>
    </>
  );
}
