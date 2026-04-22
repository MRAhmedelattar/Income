import React, { useState } from 'react';
import {
  IconUniversity, IconBuilding, IconSettings, IconDollarSign, IconBarChart,
  IconUsers, IconDatabase, IconFileText, IconCreditCard, IconReceipt, IconPlus
} from './Icons';
import { canAccessView } from '../utils/permissions';

/**
 * مكون اللوحة الجانبية (Sidebar)
 * @param {object} props
 * @param {string} props.universityName - اسم الجامعة
 * @param {string} props.universityLogo - شعار الجامعة (URL)
 * @param {string} props.facultyName - اسم الكلية
 * @param {string} props.facultyLogo - شعار الكلية (URL)
 * @param {string} props.currentView - العرض الحالي
 * @param {function} props.setCurrentView - دالة لتغيير العرض
 * @param {object} props.currentUser - المستخدم الحالي
 */
const Sidebar = ({ universityName, universityLogo, facultyName, facultyLogo, currentView, setCurrentView, currentUser }) => {
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  const NavButton = ({ viewName, label, Icon, isSubItem = false }) => (
    <button
      onClick={() => setCurrentView(viewName)}
      className={`
        sidebar-nav-button w-full px-4 py-3 rounded-lg font-medium transition-all duration-300
        transform hover:scale-105 flex items-center
        ${isSubItem ? 'justify-end pr-8' : 'justify-end'}
        ${currentView === viewName
          ? 'bg-primary text-white shadow-lg'
          : 'text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-surface-dark'
        }
      `}
      style={{ direction: 'rtl' }}
    >
      <div className="flex items-center justify-end w-full gap-3">
        <span>{label}</span>
        <div className="w-6 h-6 flex items-center justify-center">
          <Icon className="w-full h-full" />
        </div>
      </div>
    </button>
  );

  const CollapsibleNavSection = ({ sectionName, label, Icon, children }) => {
    const isOpen = openSection === sectionName;
    return (
      <div>
        <button
          onClick={() => toggleSection(sectionName)}
          className="sidebar-nav-button w-full px-4 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 flex items-center justify-between text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-surface-dark"
          style={{ direction: 'rtl' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center">
              <Icon className="w-full h-full" />
            </div>
            <span>{label}</span>
          </div>
          <svg
            className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
        {isOpen && (
          <div className="mt-2 flex flex-col gap-2 pl-4 border-r-2 border-primary-light dark:border-primary-dark">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className="sidebar-rtl w-72 bg-surface-light dark:bg-surface-dark shadow-2xl p-6 flex flex-col gap-8 border-l border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-y-auto"
    >
      {/* University Info */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden border-4 border-white shadow-xl transform transition-all duration-300 hover:scale-110">
          {universityLogo ? (
            <img src={universityLogo} alt="شعار الجامعة" className="w-full h-full object-cover" />
          ) : (
            <IconUniversity className="w-16 h-16 text-white" />
          )}
        </div>
        <h2 className="text-xl font-bold text-text-light dark:text-text-dark">
          {universityName || 'نظام الإيرادات'}
        </h2>
      </div>

      {/* Faculty Info */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg transform transition-all duration-300 hover:scale-110">
          {facultyLogo ? (
            <img src={facultyLogo} alt="شعار الكلية" className="w-full h-full object-cover" />
          ) : (
            <IconBuilding className="w-10 h-10 text-white" />
          )}
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {facultyName || 'الكلية/القسم'}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-4 mt-6">
        {canAccessView(currentUser, 'home') && (
          <NavButton viewName="home" label="الرئيسية" Icon={IconDollarSign} />
        )}

        {canAccessView(currentUser, 'collections') && (
          <NavButton viewName="collections" label="تسجيل إيرادات" Icon={IconDollarSign} />
        )}

        {canAccessView(currentUser, 'reports/receipts') && (
          <CollapsibleNavSection sectionName="reports" label="التقارير" Icon={IconBarChart}>
            <NavButton viewName="reports/receipts" label="تقرير المتحصلات" Icon={IconFileText} isSubItem />
            <NavButton viewName="reports/funds" label="تقرير الصناديق" Icon={IconCreditCard} isSubItem />
            <NavButton viewName="reports/collection" label="تقرير المجمع" Icon={IconBarChart} isSubItem />
            <NavButton viewName="reports/budget" label="تقرير الموازنة" Icon={IconReceipt} isSubItem />
            <NavButton viewName="reports/collection-items" label="تقرير بنود التحصيل" Icon={IconFileText} isSubItem />
            <NavButton viewName="reports/revenues" label="تقرير الإيرادات" Icon={IconDollarSign} isSubItem />
          </CollapsibleNavSection>
        )}

        {canAccessView(currentUser, 'settings/basic') && (
          <CollapsibleNavSection sectionName="settings" label="إعدادات النظام" Icon={IconSettings}>
            <NavButton viewName="settings/basic" label="الإعدادات الأساسية" Icon={IconSettings} isSubItem />
            <NavButton viewName="settings/revenue" label="إدارة الإيرادات" Icon={IconDollarSign} isSubItem />
            <NavButton viewName="settings/items" label="إدارة البنود" Icon={IconPlus} isSubItem />
            <NavButton viewName="settings/funds" label="إدارة الصناديق" Icon={IconCreditCard} isSubItem />
            <NavButton viewName="settings/deductions" label="إدارة الاستقطاعات" Icon={IconReceipt} isSubItem />
            <NavButton viewName="settings/budget-items" label="إدارة الميزانية" Icon={IconFileText} isSubItem />
            <NavButton viewName="settings/signatures" label="إدارة التوقيعات" Icon={IconUsers} isSubItem />
          </CollapsibleNavSection>
        )}

        {canAccessView(currentUser, 'users') && (
          <NavButton viewName="users" label="إدارة المستخدمين" Icon={IconUsers} />
        )}

        {canAccessView(currentUser, 'data') && (
          <NavButton viewName="data" label="التخزين والنسخ الاحتياطي" Icon={IconDatabase} />
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;