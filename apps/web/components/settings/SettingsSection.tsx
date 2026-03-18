import { FormEvent } from "react";

import { ProviderMode, ProviderStatus, StrategySettings } from "@/lib/types";

export type EditableStrategySettings = Omit<StrategySettings, "id" | "user_id" | "created_at" | "updated_at">;
export type KisCredentialFormState = {
  appKey: string;
  appSecret: string;
  baseUrl: string;
};

type SettingsSectionProps = {
  formSettings: EditableStrategySettings | null;
  onChange: (next: EditableStrategySettings) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  providerStatus: ProviderStatus | null;
  providerStatusLoading: boolean;
  providerActionLoading: boolean;
  providerMessage: string | null;
  kisForm: KisCredentialFormState;
  onKisFormChange: (next: KisCredentialFormState) => void;
  onSaveKisCredentials: (event: FormEvent<HTMLFormElement>) => void;
  onSwitchProviderMode: (mode: ProviderMode) => void;
  onTestProviderConnection: () => void;
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ko-KR", { hour12: false });
}

export function SettingsSection({
  formSettings,
  onChange,
  onSave,
  providerStatus,
  providerStatusLoading,
  providerActionLoading,
  providerMessage,
  kisForm,
  onKisFormChange,
  onSaveKisCredentials,
  onSwitchProviderMode,
  onTestProviderConnection,
}: SettingsSectionProps) {
  const kisConfigured = providerStatus?.kisConfigured ?? false;

  return (
    <div className="space-y-4">
      <section className="card p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">시장 데이터 제공자</h2>
          <span className="text-xs text-[#5a6f81]">전역 설정(서버 단위)</span>
        </div>

        {providerStatusLoading && !providerStatus ? (
          <p className="text-sm text-[#5a6f81]">상태 확인 중...</p>
        ) : providerStatus ? (
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p>
              현재 모드: <span className="font-semibold uppercase">{providerStatus.mode}</span>
            </p>
            <p>
              KIS 설정: <span className="font-semibold">{providerStatus.kisConfigured ? "완료" : "미설정"}</span>
            </p>
            <p>
              런타임 상태: <span className="font-semibold">{providerStatus.runtimeHealthy ? "정상" : "주의"}</span>
            </p>
            <p>
              최근 수신 시각: <span className="font-semibold">{formatDateTime(providerStatus.lastUpdateAt)}</span>
            </p>
            <p>
              최근 모드 전환: <span className="font-semibold">{formatDateTime(providerStatus.lastSwitchAt)}</span>
            </p>
            <p>
              키 저장 여부: <span className="font-semibold">{providerStatus.hasAppKey ? "App Key O" : "App Key X"}</span> /{" "}
              <span className="font-semibold">{providerStatus.hasAppSecret ? "App Secret O" : "App Secret X"}</span>
            </p>
            <p className="md:col-span-2">
              최근 오류: <span className="font-semibold">{providerStatus.lastError ?? "-"}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#5a6f81]">상태 정보를 불러오지 못했습니다.</p>
        )}
      </section>

      <section className="card p-4 md:p-5">
        <h3 className="text-base font-bold">KIS 자격증명</h3>
        <div className="mt-3 rounded-md border border-[#d92d20] bg-[#fef3f2] px-3 py-2 text-sm text-[#7a271a]">
          주의: 브로커 API 자격증명은 민감한 정보입니다. 신뢰 가능한 개인 환경에서만 입력하세요.
        </div>

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSaveKisCredentials}>
          <label className="text-sm">
            KIS App Key
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
              value={kisForm.appKey}
              onChange={(e) => onKisFormChange({ ...kisForm, appKey: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="text-sm">
            KIS App Secret
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
              value={kisForm.appSecret}
              onChange={(e) => onKisFormChange({ ...kisForm, appSecret: e.target.value })}
              autoComplete="new-password"
            />
          </label>
          <label className="text-sm md:col-span-2">
            KIS Base URL (선택)
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
              value={kisForm.baseUrl}
              onChange={(e) => onKisFormChange({ ...kisForm, baseUrl: e.target.value })}
              placeholder="https://openapi.koreainvestment.com:9443"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={providerActionLoading}
              className="rounded-md bg-[#b42318] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#d7746c]"
            >
              {providerActionLoading ? "저장 중..." : "KIS 자격증명 저장"}
            </button>
          </div>
        </form>
      </section>

      <section className="card p-4 md:p-5">
        <h3 className="text-base font-bold">Provider 제어</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-[#d7e0e8] bg-white px-3 py-2 text-sm font-semibold"
            onClick={onTestProviderConnection}
            disabled={!kisConfigured || providerActionLoading}
          >
            KIS 연결 테스트
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              providerStatus?.mode === "mock" ? "bg-[#2d6cdf] text-white" : "border border-[#d7e0e8] bg-white"
            }`}
            onClick={() => onSwitchProviderMode("mock")}
            disabled={providerActionLoading}
          >
            Mock 모드
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              providerStatus?.mode === "kis" ? "bg-[#2d6cdf] text-white" : "border border-[#d7e0e8] bg-white"
            }`}
            onClick={() => onSwitchProviderMode("kis")}
            disabled={!kisConfigured || providerActionLoading}
          >
            KIS 모드
          </button>
        </div>
        {providerMessage ? <p className="mt-3 text-sm text-[#183244]">{providerMessage}</p> : null}
      </section>

      <form className="card p-4 md:p-5" onSubmit={onSave}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">시그널 전략 설정</h2>
          <p className="text-xs text-[#5a6f81]">전략식 직접 입력 없이 파라미터만 조정</p>
        </div>

        {formSettings ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              단기 MA
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
                value={formSettings.ma_short}
                onChange={(e) => onChange({ ...formSettings, ma_short: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm">
              장기 MA
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
                value={formSettings.ma_long}
                onChange={(e) => onChange({ ...formSettings, ma_long: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm">
              볼린저 길이
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
                value={formSettings.bollinger_length}
                onChange={(e) => onChange({ ...formSettings, bollinger_length: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm">
              볼린저 표준편차
              <input
                type="number"
                step="0.1"
                className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
                value={formSettings.bollinger_std}
                onChange={(e) => onChange({ ...formSettings, bollinger_std: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm">
              거래량 배수
              <input
                type="number"
                step="0.1"
                className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
                value={formSettings.volume_multiplier}
                onChange={(e) => onChange({ ...formSettings, volume_multiplier: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm">
              중복 알림 제한(분)
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
                value={formSettings.cooldown_minutes}
                onChange={(e) => onChange({ ...formSettings, cooldown_minutes: Number(e.target.value) })}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formSettings.use_trend_filter}
                onChange={(e) => onChange({ ...formSettings, use_trend_filter: e.target.checked })}
              />
              추세 필터
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formSettings.use_bollinger_support}
                onChange={(e) => onChange({ ...formSettings, use_bollinger_support: e.target.checked })}
              />
              볼린저 중앙선 지지
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formSettings.use_volume_surge}
                onChange={(e) => onChange({ ...formSettings, use_volume_surge: e.target.checked })}
              />
              거래량 급증
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formSettings.use_breakout} onChange={(e) => onChange({ ...formSettings, use_breakout: e.target.checked })} />
              돌파 신호
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formSettings.use_rsi} onChange={(e) => onChange({ ...formSettings, use_rsi: e.target.checked })} />
              RSI 보조 사용
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formSettings.enable_telegram_notifications}
                onChange={(e) => onChange({ ...formSettings, enable_telegram_notifications: e.target.checked })}
              />
              텔레그램 알림
            </label>

            <label className="text-sm sm:col-span-2">
              알림 강도
              <select
                className="mt-1 w-full rounded-md border border-[#d7e0e8] bg-white px-2 py-1"
                value={formSettings.signal_strength_mode}
                onChange={(e) => onChange({ ...formSettings, signal_strength_mode: e.target.value as "all" | "strong_only" })}
              >
                <option value="strong_only">강한 신호만</option>
                <option value="all">모든 신호</option>
              </select>
            </label>

            <div className="sm:col-span-2">
              <button className="rounded-md bg-[#113c3a] px-4 py-2 text-sm font-semibold text-white">설정 저장</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#5a6f81]">설정 불러오는 중...</p>
        )}
      </form>
    </div>
  );
}
