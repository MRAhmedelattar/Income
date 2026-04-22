// src/views/SystemSetup.jsx

import React, { useState, useEffect } from 'react';
import { canAccessView } from '../utils/permissions';

// 🆕 استيراد جميع المكونات الفرعية الجديدة التي تم إنشاؤها
import BasicSettings from '../components/settings/BasicSettings';
import BudgetManagement from '../components/settings/BudgetManagement';
import BudgetDeductionsManagement from '../components/settings/BudgetDeductionsManagement';
import FundsManagement from '../components/settings/FundsManagement';
import ItemsManagement from '../components/settings/ItemsManagement';
import RevenueManagement from '../components/settings/RevenueManagement';
import UserManagement from '../components/settings/UserManagement';
import DeductionsManagement from '../components/settings/DeductionsManagement';
import SignaturesManagement from '../components/settings/SignaturesManagement';
// ⚠️ يجب إنشاء هذين المكونين لاحقاً:
// import DataManagement from '../components/settings/DataManagement';

/**
 * المكون الشامل لإعدادات النظام.
 * يستخدم قائمة جانبية داخلية (Tabbed Sidebar) لتقسيم الإعدادات.
 */
export default function SystemSetup({ 
    config, setConfig, 
    funds, setFunds, 
    items, setItems, 
    revenues, setRevenues, 
    users, setUsers, 
    signatures, setSignatures, 
    deductions, setDeductions, 
    budgetItems, setBudgetItems, 
    budgetDeductions, setBudgetDeductions, 
    currentUser,
    initialView = 'basic' 
}) {
    
    // حالة لتحديد التبويب الداخلي النشط ضمن شاشة الإعدادات
    const [activeTab, setActiveTab] = useState(initialView);

    useEffect(() => {
        setActiveTab(initialView);
    }, [initialView]);

    const tabs = [
        { id: 'basic', name: '⚙️ معلومات المؤسسة', icon: 'M10 2a8 8 0 100 16 8 8 0 000-16z' },
        { id: 'budget-items', name: '📋 بنود الموازنة', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        { id: 'funds', name: '💸 إدارة الصناديق', icon: 'M12 8c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z' },
        { id: 'items', name: '🧾 بنود التحصيل', icon: 'M16 11V3H8v4H2v10h14v-6z' },
        { id: 'revenue', name: '💰 إدارة الإيرادات', icon: 'M12 8c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z' },
        { id: 'deductions', name: '📊 الاستقطاعات', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
        { id: 'budget-deductions', name: '📊 أبواب الموازنة', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
        { id: 'signatures', name: '✍️ التوقيعات', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ];

    // دالة لعرض محتوى التبويب النشط
    const renderContent = () => {
        switch (activeTab) {
            case 'basic':
                return (
                    // 🟢 استدعاء مكون BasicSettings و تمرير الـ props
                    <div className="space-y-6">
                        <BasicSettings config={config} setConfig={setConfig} />
                    </div>
                );
            case 'budget-items':
                return (
                    <div className="space-y-6">
                        <BudgetManagement budgetItems={budgetItems} setBudgetItems={setBudgetItems} />
                    </div>
                );
            case 'budget-deductions':
                return (
                    <div className="space-y-6">
                        <BudgetDeductionsManagement budgetDeductions={budgetDeductions} setBudgetDeductions={setBudgetDeductions} />
                    </div>
                );
            case 'funds':
                return (
                    // 🟢 استدعاء مكون FundsManagement و تمرير الـ props
                    <div className="space-y-6">
                        <FundsManagement funds={funds} setFunds={setFunds} />
                    </div>
                );
            case 'items':
                return (
                    <div className="space-y-6">
                        <ItemsManagement items={items} setItems={setItems} funds={funds} budgetItems={budgetItems} />
                    </div>
                );
            case 'revenue':
                return (
                    <div className="space-y-6">
                        <RevenueManagement items={items} revenues={revenues} setRevenues={setRevenues} />
                    </div>
                );
            case 'deductions':
                return (
                    <div className="space-y-6">
                        <DeductionsManagement deductions={deductions} setDeductions={setDeductions} />
                    </div>
                );
            case 'signatures':
                return (
                    <div className="space-y-6">
                        <SignaturesManagement signatures={signatures} setSignatures={setSignatures} />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex w-full min-h-[80vh] rounded-xl shadow-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" dir="rtl">
            {/* القائمة الجانبية للتبويبات (Sidebar/Tabs) */}
            <nav className="w-64 flex-shrink-0 bg-gray-50 dark:bg-gray-900 p-4 border-r border-gray-200 dark:border-gray-700 text-right">
                <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-white border-b border-gray-300 dark:border-gray-700 pb-3">إعداد النظام</h2>

                <div className="space-y-2">
                    {tabs.map((tab) => {
                        // التحقق من الصلاحيات لكل تبويب
                        let hasAccess = true;
                        if (tab.id === 'basic') {
                            hasAccess = canAccessView(currentUser, 'settings/basic');
                        } else if (tab.id === 'budget-items') {
                            hasAccess = canAccessView(currentUser, 'settings/budget-items');
                        } else if (tab.id === 'funds') {
                            hasAccess = canAccessView(currentUser, 'settings/funds');
                        } else if (tab.id === 'items') {
                            hasAccess = canAccessView(currentUser, 'settings/items');
                        } else if (tab.id === 'revenue') {
                            hasAccess = canAccessView(currentUser, 'settings/revenue');
                        } else if (tab.id === 'deductions') {
                            hasAccess = canAccessView(currentUser, 'settings/deductions');
                        } else if (tab.id === 'budget-deductions') {
                            hasAccess = canAccessView(currentUser, 'settings/budget-deductions');
                        } else if (tab.id === 'signatures') {
                            hasAccess = canAccessView(currentUser, 'settings/signatures');
                        }

                        if (!hasAccess) return null;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                // تطبيق أنماط Tailwind الديناميكية لزر جذاب
                                className={`w-full text-right flex items-center p-3 rounded-lg transition duration-200
                                    ${activeTab === tab.id
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 font-semibold shadow-inner'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`
                                }
                            >
                                <svg className="w-5 h-5 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon}></path>
                                </svg>
                                {tab.name}
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* منطقة المحتوى الرئيسية */}
            <main className="flex-1 p-8 overflow-y-auto bg-white dark:bg-gray-800 text-right">
                 <h1 className="text-3xl font-extrabold mb-8 border-b pb-4 text-gray-900 dark:text-white">
                    إعدادات النظام
                </h1>
                {renderContent()}
            </main>
        </div>
    );
}