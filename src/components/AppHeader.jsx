// src/components/AppHeader.jsx
import React from 'react';
import { IconSun, IconMoon, IconRefresh } from './Icons';

/**
 * مكون رأس التطبيق (Header)
 */
const AppHeader = ({ currentView, darkMode, toggleDarkMode, universityName, facultyName, currentUser, onLogout, onRefresh }) => {
  const viewTitles = {
    setup: 'إعداد النظام',
  };

  return (
    <header className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg p-4 flex items-center justify-between">
      {/* Dark Mode Toggle + Refresh */}
      <div className="flex items-center gap-2">
        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          className="p-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 hover:rotate-180 transition-all duration-300 transform hover:scale-110 shadow-lg"
          title="تحديث البيانات"
          aria-label="تحديث البيانات"
        >
          <IconRefresh className="w-6 h-6" />
        </button>
        
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all duration-200 transform hover:scale-110 shadow-lg"
          aria-label="تبديل الوضع الليلي"
        >
          {darkMode ? <IconSun className="w-6 h-6" /> : <IconMoon className="w-6 h-6" />}
        </button>
      </div>

      {/* University and Faculty Info */}
      <div className="flex-1 text-center">
        <h1 className="text-3xl font-bold drop-shadow-lg mb-2">
          نظام إدارة الإيرادات والمتحصلات " 7 تعليم"
        </h1>
        <h2 className="text-xl font-semibold drop-shadow-md">
          {universityName || 'جامعة العريش'}
        </h2>
        <p className="text-sm opacity-90 mt-1">
          {facultyName || 'الإدارة العامة لنظم المعلومات والتحول الرقمي'}
        </p>
      </div>

      {/* User Info and Logout */}
      <div className="flex items-center gap-4">
        {currentUser && (
          <div className="text-right">
            <p className="text-sm font-medium">{currentUser.username}</p>
            <p className="text-xs opacity-75">
              {currentUser.role === 'admin' ? 'مدير' : 'مستخدم'}
            </p>
          </div>
        )}
        <button
          onClick={onLogout}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 shadow-lg"
          aria-label="تسجيل الخروج"
        >
          خروج
        </button>
      </div>
    </header>
  );
};

export default AppHeader;