import type { TabId } from '../types';

interface LayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: React.ReactNode;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: '仪表盘', icon: '📊' },
  { id: 'history', label: '记录', icon: '📋' },
  { id: 'profile', label: '我的', icon: '👤' },
];

export default function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-bg dark:bg-bg light:bg-bg-light">
      <main className="flex-1 overflow-y-auto pb-4">{children}</main>
      <nav className="flex justify-around items-center py-3 border-t border-surface sticky bottom-0 bg-bg dark:bg-bg light:bg-bg-light light:border-gray-200">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-opacity ${
                isActive ? 'text-primary opacity-100' : 'opacity-25 hover:opacity-40'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
