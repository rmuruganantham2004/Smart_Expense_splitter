import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import {
  HomeIcon,
  UserGroupIcon,
  SparklesIcon,
  ScaleIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
  ArrowLeftStartOnRectangleIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface LayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: LayoutProps) {
  const { 
    user, 
    isAuthenticated, 
    clearAuth, 
    isDarkMode, 
    toggleDarkMode, 
    notifications, 
    loadProfile, 
    markNotificationsRead 
  } = useAppStore();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();

  // Protect route
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      loadProfile();
      // Poll notifications every 30s
      const interval = setInterval(loadProfile, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, navigate, loadProfile]);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: HomeIcon },
    { name: 'Groups', path: '/groups', icon: UserGroupIcon },
    { name: 'AI Text Parser', path: '/ai-input', icon: SparklesIcon },
    { name: 'Settlement Optimization', path: '/settlement-page', icon: ScaleIcon },
  ];

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-mesh flex">
      {/* --- Sidebar Desktop --- */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-white/70 dark:bg-slate-900/60 border-r border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md transition-all duration-300 relative z-30">
        <div className="h-16 flex items-center px-6 border-b border-slate-200/50 dark:border-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-brand-500/20">
              $
            </div>
            <span className="font-extrabold text-xl bg-gradient-to-r from-brand-600 to-emerald-400 bg-clip-text text-transparent">
              SmartSplit
            </span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/15' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User profile section */}
        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/50">
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/50 dark:bg-slate-800/30">
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate text-slate-800 dark:text-slate-200">
                {user.name}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 transition-all duration-200"
            >
              <ArrowLeftStartOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* --- Mobile Sidebar Overlay --- */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <aside className="w-64 h-full bg-slate-50 dark:bg-[#0b0f19] border-r border-slate-200 dark:border-slate-800 flex flex-col p-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-lg">
                  $
                </div>
                <span className="font-extrabold text-xl">SmartSplit</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)}>
                <XMarkIcon className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <nav className="flex-1 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                      isActive 
                        ? 'bg-brand-500 text-white' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t pt-4 dark:border-slate-800 flex items-center justify-between">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold truncate">{user.name}</span>
                <span className="text-xs text-slate-500 truncate">{user.email}</span>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500">
                <ArrowLeftStartOnRectangleIcon className="w-5 h-5" />
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* --- Main Content Area --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* --- Top Header Navigation --- */}
        <header className="h-16 flex items-center justify-between px-6 bg-white/40 dark:bg-slate-900/30 border-b border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {/* Hamburger button on Mobile */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1 rounded-lg text-slate-500 md:hidden hover:bg-slate-100 dark:hover:bg-slate-800/50"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {navItems.find(item => location.pathname.startsWith(item.path))?.name || 'Smart Splitting'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Dark Mode toggle */}
            <button
              onClick={() => toggleDarkMode()}
              title="Toggle Dark Mode"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition-all duration-200 active:scale-95"
            >
              {isDarkMode ? <SunIcon className="w-5.5 h-5.5 text-brand-400" /> : <MoonIcon className="w-5.5 h-5.5 text-slate-600" />}
            </button>

            {/* Notification drop */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications && unreadNotificationsCount > 0) {
                    markNotificationsRead();
                  }
                }}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition-all duration-200 relative"
              >
                <BellIcon className="w-5.5 h-5.5" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white dark:border-[#0b0f19] animate-pulse"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 glass-card p-4 shadow-2xl border border-slate-200/60 dark:border-slate-800/80 rounded-2xl z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                  <div className="flex items-center justify-between border-b pb-2 mb-3 dark:border-slate-800">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">Notifications</span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2.5">
                    {notifications.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-4">No recent activity notifications</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`p-2.5 rounded-xl text-xs transition-colors ${n.isRead ? 'bg-slate-100/30 dark:bg-slate-800/20 text-slate-500 dark:text-slate-400' : 'bg-brand-500/5 border border-brand-500/10 text-slate-700 dark:text-slate-300'}`}>
                          <p>{n.message}</p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* --- Render Main Panel Outlet --- */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
