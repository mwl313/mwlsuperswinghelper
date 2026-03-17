export type AppTabKey = "overview" | "watchlist" | "chart" | "signals" | "settings";

type TabItem = {
  key: AppTabKey;
  label: string;
};

type AppTabsProps = {
  tabs: TabItem[];
  activeTab: AppTabKey;
  onChange: (tab: AppTabKey) => void;
};

export function AppTabs({ tabs, activeTab, onChange }: AppTabsProps) {
  return (
    <nav className="mb-5 flex flex-wrap gap-2" aria-label="메인 탭">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "border-[#1f4e79] bg-[#1f4e79] text-white"
                : "border-[#d0dae3] bg-white text-[#2a465c] hover:border-[#93aac0]"
            }`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
