import React, { useState, useEffect } from 'react';
import ReceiptsReport from './ReceiptsReport';
import FundsReport from './FundsReport';
import BudgetReport from './BudgetReport';
import CollectionItemsReport from './CollectionItemsReport';
import RevenuesReport from './RevenuesReport'; // <-- التقرير الجديد
import CollectionReport from './CollectionReport'; // <-- تقرير المجمع

/**
 * مكون التقارير الرئيسي
 */
export default function Reports({ 
  collections, 
  items, 
  funds, 
  deductions, 
  config, 
  signatures, 
  budgetDeductions, 
  budgetItems, 
  revenues,
  initialReport = 'revenue',
  onRefresh
}) {
  const [activeReport, setActiveReport] = useState(initialReport);

  useEffect(() => {
    setActiveReport(initialReport);
  }, [initialReport]);

  const renderActiveReport = () => {
    switch (activeReport) {
      case 'receipts':
        return <ReceiptsReport key={activeReport} collections={collections} items={items} funds={funds} config={config} signatures={signatures} revenues={revenues} />;
      case 'funds':
        return <FundsReport key={activeReport} collections={collections} items={items} funds={funds} deductions={deductions} config={config} signatures={signatures} budgetDeductions={budgetDeductions} />;
      case 'budget':
        return <BudgetReport key={activeReport} collections={collections} items={items} budgetItems={budgetItems} config={config} signatures={signatures} />;
      case 'collection': // حالة تقرير المجمع ← نقل إلى هنا
        return <CollectionReport key={activeReport} collections={collections} items={items} funds={funds} budgetItems={budgetItems} config={config} signatures={signatures} revenues={revenues} />;
      case 'budget':
        return <BudgetReport key={activeReport} collections={collections} items={items} budgetItems={budgetItems} config={config} signatures={signatures} />;
      case 'collection-items':
        return <CollectionItemsReport key={activeReport} collections={collections} items={items} funds={funds} budgetItems={budgetItems} config={config} signatures={signatures} />;
      case 'revenues': // الحالة الجديدة
        return <RevenuesReport key={activeReport} collections={collections} items={items} revenues={revenues} config={config} signatures={signatures} onRefresh={onRefresh} />;
      default:
        return <div className="text-center py-4"><p className="text-gray-600 dark:text-gray-400">الرجاء اختيار تقرير لعرضه.</p></div>;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <h1 className="reports-title text-3xl font-bold text-text-light dark:text-text-dark">
          التقارير
        </h1>
      </div>

      {/* تبويبات التقارير */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 justify-start">
        <button
          onClick={() => setActiveReport('receipts')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeReport === 'receipts'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          تقرير المتحصلات
        </button>
        <button
          onClick={() => setActiveReport('funds')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeReport === 'funds'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          تقرير الصناديق
        </button>
        <button
          onClick={() => setActiveReport('collection')} // زر تبويب تقرير المجمع ← نقل إلى هنا
          className={`px-4 py-2 font-medium transition-colors ${
            activeReport === 'collection'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          تقرير المجمع
        </button>
        <button
          onClick={() => setActiveReport('budget')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeReport === 'budget'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          تقرير الموازنة
        </button>
        <button
          onClick={() => setActiveReport('collection-items')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeReport === 'collection-items'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          بنود التحصيل
        </button>
        <button
          onClick={() => setActiveReport('revenues')} // زر التبويب الجديد
          className={`px-4 py-2 font-medium transition-colors ${
            activeReport === 'revenues'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          تقرير الإيرادات
        </button>
      </div>

      <div className="mt-4">
        {renderActiveReport()}
      </div>
    </div>
  );
}