import React from 'react';
import { ActiveTab, UserProgress } from '../types';
import { BarChart3, Home, Settings, ShieldCheck, Target, Bookmark, Bell } from 'lucide-react';

export interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  progress: UserProgress;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onLogoClick: () => void;
  dueCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  progress,
  darkMode,
  onToggleDarkMode,
  onLogoClick,
  dueCount = 0,
}) => {
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Mirëmëngjes ☀️';
    if (h < 18) return 'Mirëdita 🌤';
    return 'Mirëmbrëma 🌙';
  };

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: 'Shtëpi', icon: <Home className="w-5 h-5" /> },
    { id: 'stats', label: 'Statistika', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'modes', label: 'Kuiz', icon: <Target className="w-5 h-5" /> },
    { id: 'admin', label: 'Admin', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <header className="max-w-[480px] mx-auto px-4 pt-4 pb-2">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onLogoClick}
            aria-label="Mjek Hyrje (Klikoni 7 herë për Admin)"
            title="Mjek Hyrje"
            className="w-10 h-10 rounded-xl bg-[#58cc02] text-white font-black text-lg flex items-center justify-center border-b-4 border-[#46a302] transition-all active:translate-y-[2px] active:border-b-0 select-none shrink-0"
          >
            Rx
          </button>
          <div>
            <div className="text-[11px] font-black tracking-wide text-slate-400 dark:text-slate-300 uppercase font-mono">
              {getGreeting()} {progress.streak > 0 && `— Dita ${progress.streak}`}
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-slate-50 flex items-center gap-1.5">
              Mjek Hyrje
              <ShieldCheck className="w-4 h-4 text-[#58cc02] shrink-0 inline" />
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {dueCount > 0 && (
            <button
              type="button"
              onClick={() => onTabChange('modes')}
              title={`${dueCount} pyetje për përsëritje (SM-2)`}
              className="relative w-9 h-9 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center border border-rose-500/20 transition-all cursor-pointer shadow-xs"
            >
              <Bell className="w-4.5 h-4.5 fill-rose-500/5 animate-swing" style={{ transformOrigin: 'top center' }} />
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center font-mono border-2 border-[#fff] dark:border-slate-900 shadow-xs">
                {dueCount}
              </span>
            </button>
          )}

          {progress.streak > 0 && (
            <div className="bg-[#ff9600]/10 border border-[#ff9600]/20 px-2.5 h-9 rounded-xl text-xs font-black text-[#ff9600] flex items-center gap-1 shadow-xs">
              <span className="text-sm">🔥</span>
              <span className="font-mono font-extrabold">{progress.streak}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <nav role="tablist" className="grid grid-cols-4 gap-1.5 bg-[#f1f3f4] dark:bg-slate-800/60 p-2 rounded-2xl mb-4 border-2 border-slate-200/50 dark:border-slate-800">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all font-sans select-none relative ${
                isActive
                  ? 'bg-[#1cb0f6] text-white font-extrabold border-b-4 border-[#1899d6] shadow-sm transform translate-y-[-2px]'
                  : 'text-slate-500 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/80 font-bold'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.id === 'modes' && dueCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-white dark:border-slate-850 rounded-full animate-pulse" />
                )}
              </div>
              <span className="text-[11px] font-extrabold tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
