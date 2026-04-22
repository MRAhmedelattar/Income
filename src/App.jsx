import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AppHeader from './components/AppHeader';
import Login from './components/Login';
import FirstTimeSetup from './components/FirstTimeSetup';
import SystemSetup from './views/SystemSetup';
import Reports from './views/Reports';
import Home from './views/Home';
import Collections from './views/Collections';
import UserManagementView from './views/UserManagementView';
import DataManagementView from './views/DataManagementView';
import apiClient from './api';
import BackupOnExitModal from './components/BackupOnExitModal';

// استخدام الدالة المساعدة لإنشاء ID عشوائي إذا لم تكن موجودة (لبيئة المتصفح)
const crypto = window.crypto || window.msCrypto;
if (!crypto.randomUUID) {
  crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

/**
 * المكون الرئيسي للتطبيق
 */
export default function App() {
  // حالة لتحديد الوضع الليلي/النهاري
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
          (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // حالة لتحديد الواجهة المعروضة
  const [currentView, setCurrentView] = useState('home');

  // حالة للتحكم في إظهار نافذة النسخ الاحتياطي عند الخروج
  const [showBackupOnExitModal, setShowBackupOnExitModal] = useState(false);

  // حالة لإعدادات الجامعة والكلية
  const [config, setConfig] = useState({
    universityName: 'جامعة العريش',
    universityLogo: null,
    facultyName: 'الإدارة العامة لنظم المعلومات والتحول الرقمي',
    facultyLogo: null,
  });

  // حالة الصناديق والبنود والتحصيلات والإيرادات والمستخدمين والتوقيعات والاستقطاعات وبنود الموازنة واستقطاعات الموازنة
  const [funds, setFunds] = useState([]);
  const [items, setItems] = useState([]);
  const [collections, setCollections] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [users, setUsers] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [budgetItems, setBudgetItems] = useState([]);
  const [budgetDeductions, setBudgetDeductions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [setupError, setSetupError] = useState(null);

  // دالة لمعالجة قرار المستخدم من النافذة المنبثقة
  const handleExitDecision = (decision) => {
    setShowBackupOnExitModal(false); // إخفاء النافذة أولاً
    if (window.electronAPI) {
      // إرسال القرار إلى الخلفية لتنفيذ الإجراء المناسب
      window.electronAPI.sendExitDecision(decision);
    }
  };

  // دالة تحميل البيانات من قاعدة البيانات
  const loadData = async () => {
    try {
      // Load users first to check for first-time setup
      const usersData = await apiClient.getUsers();
      setUsers(usersData);

      // Check if this is first time setup (no users exist)
      if (usersData.length === 0) {
        setIsFirstTimeSetup(true);
        // Clear any previous setup error
        setSetupError(null);
        return; // Don't load other data if it's first time setup
      }

      // Load config
      const configData = await apiClient.getConfig();
      setConfig(configData);

      // Load funds
      const fundsData = await apiClient.getFunds();
      setFunds(fundsData);

      // Load items
      const itemsData = await apiClient.getItems();
      setItems(itemsData);

      // Load collections
      const collectionsData = await apiClient.getCollections();
      setCollections(collectionsData);

      // Load revenues
      const revenuesData = await apiClient.getRevenues();
      setRevenues(revenuesData);

      // Load signatures
      const signaturesData = await apiClient.getSignatures();
      setSignatures(signaturesData);

      // Load deductions
      const deductionsData = await apiClient.getDeductions();
      setDeductions(deductionsData);

      // Load budget items
      const budgetItemsData = await apiClient.getBudgetItems();
      setBudgetItems(budgetItemsData);

      // Load budget deductions
      const budgetDeductionsData = await apiClient.getBudgetDeductions();
      setBudgetDeductions(budgetDeductionsData);

      // Clear any previous setup error
      setSetupError(null);

    } catch (error) {
      console.error('Failed to load data from database:', error);
      setSetupError('حدث خطأ في تحميل البيانات من قاعدة البيانات. يرجى التأكد من تشغيل الخادم والمحاولة مرة أخرى.');

      // If we can't connect to API, assume it's first time setup
      setIsFirstTimeSetup(true);

      // Fallback to local storage if database is not available
      if (window.electronAPI) {
        const result = await window.electronAPI.loadData();
        if (result.status === 'success' && result.data) {
          setConfig(result.data.config || {
            universityName: 'جامعة العريش',
            universityLogo: null,
            facultyName: 'الإدارة العامة لنظم المعلومات والتحول الرقمي',
            facultyLogo: null,
          });
          setFunds((result.data.funds || []).map((fund, index) => ({ ...fund, order: fund.order ?? index })));
          setItems((result.data.items || []).map((item, index) => ({ ...item, order: item.order ?? index })));
          setCollections(result.data.collections || []);
          setRevenues((result.data.revenues || []).map((revenue, index) => ({ ...revenue, order: revenue.order ?? index })));
          setSignatures((result.data.signatures || []).map((signature, index) => ({ ...signature, order: signature.order ?? index })));
          setSetupError(null); // Clear error if fallback succeeds
        }
      }
    }
  };

  // تحميل البيانات عند بدء تشغيل التطبيق
  useEffect(() => {
    loadData();
  }, []);

  // 🔧 إعداد مستمع الأحداث من الخلفية لطلب إظهار النافذة (مُحسَّن)
  useEffect(() => {
    console.log('App.jsx: Setting up IPC listener.'); // 🔍 Debug Log
    if (window.electronAPI) {
      console.log('App.jsx: electronAPI is available.'); // 🔍 Debug Log
      
      // التأكد من إزالة المستمع القديم إذا وجد لمنع التكرار
      window.electronAPI.removeAllListeners('should-show-backup-dialog');
      
      window.electronAPI.onShouldShowBackupDialog(() => {
        console.log('App.jsx: should-show-backup-dialog event received!'); // 🔍 Debug Log
        setShowBackupOnExitModal(true);
      });
    } else {
        console.log('App.jsx: electronAPI is NOT available.'); // 🔍 Debug Log
    }
  }, []); // يعمل مرة واحدة عند تحميل المكون

  // حفظ البيانات عند أي تغيير
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.saveData({ config, funds, items, collections, revenues, users, signatures, deductions, budgetItems, budgetDeductions, currentUser });
    }
  }, [config, funds, items, collections, revenues, users, signatures, deductions, budgetItems, budgetDeductions, currentUser]);

  // تطبيق الوضع الليلي
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const handleFirstTimeSetup = (newUser) => {
    setCurrentUser(newUser);
    setUsers([newUser]);
    setIsFirstTimeSetup(false);
    localStorage.setItem('currentUser', JSON.stringify(newUser));
  };

  // التحقق من تسجيل الدخول عند بدء التطبيق - تم إلغاؤه ليطلب تسجيل الدخول في كل مرة
  /*
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('currentUser');
      }
    }
  }, []);
  */

  // عرض شاشة الإعداد الأولي إذا لم يكن هناك مستخدمون في قاعدة البيانات
  if (isFirstTimeSetup) {
    return <FirstTimeSetup onSetupComplete={handleFirstTimeSetup} />;
  }

  // عرض شاشة تسجيل الدخول إذا لم يكن المستخدم مسجلاً دخولاً
  if (!currentUser) {
    return <Login onLogin={handleLogin} config={config} />;
  }

  return (
    <div className="app-container" dir="rtl">
      <div className="flex h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans">
        {/* Sidebar */}
        <Sidebar
          universityName={config.universityName}
          universityLogo={config.universityLogo}
          facultyName={config.facultyName}
          facultyLogo={config.facultyLogo}
          currentView={currentView}
          setCurrentView={setCurrentView}
          currentUser={currentUser}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* App Header */}
          <AppHeader
            currentView={currentView}
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
            universityName={config.universityName}
            facultyName={config.facultyName}
            currentUser={currentUser}
            onLogout={handleLogout}
            onRefresh={loadData}
          />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-8 main-content scrollbar-thin">
            <div className="animate-fade-in">
              {currentView.startsWith('settings') ? (
                <SystemSetup
                  config={config}
                  setConfig={setConfig}
                  funds={funds}
                  setFunds={setFunds}
                  items={items}
                  setItems={setItems}
                  revenues={revenues}
                  setRevenues={setRevenues}
                  users={users}
                  setUsers={setUsers}
                  signatures={signatures}
                  setSignatures={setSignatures}
                  deductions={deductions}
                  setDeductions={setDeductions}
                  budgetItems={budgetItems}
                  setBudgetItems={setBudgetItems}
                  budgetDeductions={budgetDeductions}
                  setBudgetDeductions={setBudgetDeductions}
                  currentUser={currentUser}
                  initialView={currentView.split('/')[1]}
                />
              ) : currentView.startsWith('reports') ? (
                <Reports
                  collections={collections}
                  items={items}
                  funds={funds}
                  config={config}
                  signatures={signatures}
                  deductions={deductions}
                  budgetDeductions={budgetDeductions}
                  budgetItems={budgetItems}
                  revenues={revenues}
                  initialReport={currentView.split('/')[1]}
                  onRefresh={loadData}
                />
              ) : currentView === 'data' ? (
                <DataManagementView />
              ) : currentView === 'users' ? (
                <UserManagementView
                  users={users}
                  setUsers={setUsers}
                  currentUser={currentUser}
                />
              ) : currentView === 'home' ? (
                <Home currentUser={currentUser} />
              ) : (
                <Collections
                  items={items}
                  funds={funds}
                  collections={collections}
                  setCollections={setCollections}
                  revenues={revenues}
                  currentUser={currentUser}
                />
              )}
            </div>

            {/* Footer with system info */}
            <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
              تم تصميم هذا النظام بواسطة الإدارة العامة لنظم المعلومات والتحول الرقمي - جامعة العريش
            </footer>
          </main>
        </div>
      </div>

      {/* إضافة المكون المنبثق للنسخ الاحتياطي عند الخروج */}
      <BackupOnExitModal
        isVisible={showBackupOnExitModal}
        onConfirm={() => handleExitDecision('backup-and-quit')}
        onSkip={() => handleExitDecision('quit')}
        onCancel={() => handleExitDecision('cancel')}
      />
    </div>
  );
}