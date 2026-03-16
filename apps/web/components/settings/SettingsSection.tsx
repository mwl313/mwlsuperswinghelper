import { FormEvent } from "react";

import { StrategySettings } from "@/lib/types";

export type EditableStrategySettings = Omit<StrategySettings, "id" | "user_id" | "created_at" | "updated_at">;

type SettingsSectionProps = {
  formSettings: EditableStrategySettings | null;
  onChange: (next: EditableStrategySettings) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
};

export function SettingsSection({ formSettings, onChange, onSave }: SettingsSectionProps) {
  return (
    <form className="card p-4 md:p-5" onSubmit={onSave}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">설정</h2>
        <p className="text-xs text-[#7a6a51]">전략식 직접 입력 없이 파라미터만 조정</p>
      </div>

      {formSettings ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            단기 MA
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
              value={formSettings.ma_short}
              onChange={(e) => onChange({ ...formSettings, ma_short: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            장기 MA
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
              value={formSettings.ma_long}
              onChange={(e) => onChange({ ...formSettings, ma_long: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            볼린저 길이
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
              value={formSettings.bollinger_length}
              onChange={(e) => onChange({ ...formSettings, bollinger_length: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            볼린저 표준편차
            <input
              type="number"
              step="0.1"
              className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
              value={formSettings.bollinger_std}
              onChange={(e) => onChange({ ...formSettings, bollinger_std: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            거래량 배수
            <input
              type="number"
              step="0.1"
              className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
              value={formSettings.volume_multiplier}
              onChange={(e) => onChange({ ...formSettings, volume_multiplier: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            중복 알림 제한(분)
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
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
              className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
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
        <p className="text-sm text-[#7a6a51]">설정 불러오는 중...</p>
      )}
    </form>
  );
}
