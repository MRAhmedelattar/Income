import React, { useState, useEffect, useMemo } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import ar from 'date-fns/locale/ar';

registerLocale('ar', ar);

import { exportToExcel } from '../utils/excelExport';
import { exportToWhatsApp, exportToImage } from '../utils/whatsappExport';

// دالة تحويل الأرقام إلى عربية
const toArabicNumbers = (num) => {
  return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
};

/**
 * مكون تقرير الموازنة
 */
export default function BudgetReport({ collections, items, budgetItems, config, signatures, onBack }) {

  // حالة التصفية
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // حالة DatePicker للتصفية الزمنية (إصلاح timezone)
  const [startDatePicker, setStartDatePicker] = useState(null);
  const [endDatePicker, setEndDatePicker] = useState(null);

  // مزامنة DatePicker مع state strings
  useEffect(() => {
    if (startDate) {
      const date = new Date(startDate + 'T00:00:00');
      setStartDatePicker(date);
    } else {
      setStartDatePicker(null);
    }
  }, [startDate]);

  useEffect(() => {
    if (endDate) {
      const date = new Date(endDate + 'T23:59:59.999');
      setEndDatePicker(date);
    } else {
      setEndDatePicker(null);
    }
  }, [endDate]);

  // دالة إعادة تعيين التصفية
  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  // فلترة البيانات حسب التواريخ
  const filteredCollections = useMemo(() => {
    const validCollections = collections.filter(c => c.receiptNumber && c.name);
    if (!startDate && !endDate) return validCollections;

    return validCollections.filter(collection => {
      const dateToCheck = collection.paymentDate;
      if (!dateToCheck) return false;

      const collectionDate = new Date(dateToCheck);
      const start = startDate ? new Date(startDate) : null;
      let end = endDate ? new Date(endDate) : null;

      // إذا كان تاريخ البداية والنهاية نفس اليوم، اجعل النهاية نهاية اليوم
      if (startDate && endDate && startDate === endDate) {
        end = new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1);
      }

      if (start && collectionDate < start) return false;
      if (end && collectionDate > end) return false;

      return true;
    });
  }, [collections, startDate, endDate]);

// تجميع البيانات حسب بند الموازنة مع البنود الفرعية
  const budgetData = useMemo(() => {
    const budgetMap = new Map();

    // تهيئة البيانات لكل بند موازنة
    budgetItems.forEach(budgetItem => {
      budgetMap.set(budgetItem.id, {
        budgetItemId: budgetItem.id,
        budgetItemName: budgetItem.name,
        totalAmount: 0,
        items: new Map()  // بنود التحصيل الفرعية
      });
    });

    // حساب إجمالي المبلغ + البنود لكل بند موازنة
    filteredCollections.forEach(collection => {
      if (!collection.distribution || !Array.isArray(collection.distribution)) return;

      collection.distribution.forEach(dist => {
        const item = items.find(i => i.id === dist.itemId);
        if (!item || item.type !== 'budget' || !item.budgetItemId) return;

        const budgetItem = budgetItems.find(bi => bi.id === item.budgetItemId);
        if (!budgetItem) return;

        const budgetDataItem = budgetMap.get(budgetItem.id);
        if (!budgetDataItem) return;

        budgetDataItem.totalAmount += dist.amount || 0;

        // إضافة/تحديث البند الفرعي
        if (!budgetDataItem.items.has(item.id)) {
          budgetDataItem.items.set(item.id, {
            itemId: item.id,
            itemName: item.name,
            amount: 0
          });
        }
        budgetDataItem.items.get(item.id).amount += dist.amount || 0;
      });
    });

    return Array.from(budgetMap.values()).filter(budget => budget.totalAmount > 0);
  }, [budgetItems, items, filteredCollections]);

  // حساب الإجماليات
  const totals = useMemo(() => {
    let totalAmount = 0;

    budgetData.forEach(budget => {
      totalAmount += budget.totalAmount;
    });

    return { totalAmount };
  }, [budgetData]);

  // تنسيق التاريخ الموحد
  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // حساب فترة التقرير
  const reportDate = formatDate(new Date());
  const reportPeriod = startDate && endDate
    ? `من ${formatDate(startDate)} إلى ${formatDate(endDate)}`
    : startDate
    ? `من ${formatDate(startDate)} إلى ${formatDate(new Date().toISOString().split('T')[0])}`
    : `حتى ${reportDate}`;

  // حالة للمعاينة
  const [showPreview, setShowPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // حالة للواتساب داخل المعاينة
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  // دالة عرض التقرير
  const handleViewReport = () => {
    setShowPreview(true);
  };

  // دالة إغلاق المعاينة
  const handleClosePreview = () => {
    setShowPreview(false);
    setIsFullscreen(false);
  };

  // دالة تكبير/تصغير النافذة
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  // دالة حفظ كصورة
  const handleSaveAsImage = () => {
    // الحصول على عنصر التقرير
    const reportElement = document.querySelector('.report-content');
    if (!reportElement) {
      alert('لم يتم العثور على محتوى التقرير');
      return;
    }

  exportToImage(reportElement, 'تقرير الموازنة', reportPeriod);
};

const handleExportExcel = () => {
  console.log('Exporting Excel with budgetData length:', budgetData.length);
  const data = [];
  
  budgetData.forEach((budget, index) => {
    // صف البند الرئيسي
    data.push([index + 1, budget.budgetItemName, '', toArabicNumbers(budget.totalAmount.toFixed(2))]);
    
    // صفوف البنود الفرعية
    Array.from(budget.items.values()).forEach(item => {
      data.push(['', '  └─ ' + item.itemName, '', toArabicNumbers(item.amount.toFixed(2))]);
    });
  });
  
  data.push(['', 'الإجمالي الكلي', '', toArabicNumbers(totals.totalAmount.toFixed(2))]);
  
  const headers = ['م', 'اسم البند', 'الوصف', 'القيمة'];
  exportToExcel(data, headers, 'تقرير الموازنة', reportPeriod, 'تقرير_الموازنة');
};

  // دالة الطباعة من العرض الرئيسي
  const handlePrintFromMain = () => {
    setShowPreview(true);
    setTimeout(() => {
      handlePrintReportInNewWindow();
    }, 100);
  };

  // دالة إرسال عبر واتساب
  const handleWhatsAppExport = () => {
    if (!phoneNumber.trim()) {
      alert('يرجى إدخال رقم الهاتف.');
      return;
    }

    // تنظيف الرقم
    const cleanNumber = phoneNumber.replace(/\s+|-|\(|\)/g, '');

    // إضافة +20 تلقائياً
    let formattedNumber = cleanNumber;
    if (formattedNumber.startsWith('0')) {
      formattedNumber = '+20' + formattedNumber.substring(1);
    } else if (!formattedNumber.startsWith('+20')) {
      formattedNumber = '+20' + formattedNumber;
    }

    // التحقق من صحة الرقم بعد التنسيق
    const phoneRegex = /^\+20[0-9]{10}$/;
    if (!phoneRegex.test(formattedNumber)) {
      alert('رقم الهاتف غير صحيح. يرجى إدخال رقم صحيح.');
      return;
    }

    // إرسال عبر واتساب
    exportToWhatsApp(`تقرير الموازنة\nالفترة: ${reportPeriod}`, formattedNumber);

    // إغلاق المودال
    setShowWhatsAppModal(false);
    setPhoneNumber('');
  };

  // دالة الطباعة في نافذة منفصلة مع الحفاظ على التنسيق
  const handlePrintReportInNewWindow = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      alert('يرجى السماح بفتح النوافذ المنبثقة لطباعة التقرير.');
      return;
    }

    // جمع محتوى التقرير فقط
    const printContent = document.querySelector('.print-content').cloneNode(true);

    // دالة لتحويل فئات Tailwind إلى أنماط مُضمَّنة
    const applyInlineStyles = (element) => {
      const classToStyleMap = {
        'border': 'border: 1px solid black;',
        'border-black': 'border-color: black;',
        'border-collapse': 'border-collapse: collapse;',
        'text-right': 'text-align: right;',
        'text-center': 'text-align: center;',
        'p-2': 'padding: 8px;',
        'p-4': 'padding: 16px;',
        'py-2': 'padding-top: 8px; padding-bottom: 8px;',
        'px-2': 'padding-left: 8px; padding-right: 8px;',
        'font-bold': 'font-weight: bold;',
        'text-sm': 'font-size: 14px;',
        'text-lg': 'font-size: 18px;',
        'text-xl': 'font-size: 20px;',
        'bg-gray-100': 'background-color: #f3f4f6;',
        'bg-gray-200': 'background-color: #e5e7eb;',
        'table': 'display: table;',
        'thead': 'display: table-header-group;',
        'tbody': 'display: table-row-group;',
        'tr': 'display: table-row;',
        'th': 'display: table-cell;',
        'td': 'display: table-cell;',
        'w-full': 'width: 100%;',
        'max-w-4xl': 'max-width: 56rem;',
        'mx-auto': 'margin-left: auto; margin-right: auto;',
        'rounded-lg': 'border-radius: 0.5rem;',
        'shadow-md': 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);',
        'flex': 'display: flex;',
        'items-center': 'align-items: center;',
        'justify-between': 'justify-content: space-between;',
        'text-black': 'color: black !important;',
        'text-gray-700': 'color: #374151;',
        'text-gray-500': 'color: #6b7280;',
        'bg-white': 'background-color: white;',
        'border-b': 'border-bottom: 1px solid #e5e7eb;',
        'mb-2': 'margin-bottom: 0.5rem;',
        'mb-4': 'margin-bottom: 1rem;',
        'mt-1': 'margin-top: 0.25rem;',
        'mt-4': 'margin-top: 1rem;',
        'ml-4': 'margin-left: 1rem;',
        'mr-4': 'margin-right: 1rem;',
        'mx-6': 'margin-left: 1.5rem; margin-right: 1.5rem;',
        'object-contain': 'object-fit: contain;',
        'h-20': 'height: 5rem;',
        'w-20': 'width: 5rem;',
        'flex-1': 'flex: 1;',
        'pt-2': 'padding-top: 0.5rem;',
        'divide-y': 'border-top: 1px solid #e5e7eb;',
        'divide-gray-200': 'border-top-color: #e5e7eb;',
        'hover:bg-gray-50': '', // تجاهل hover في الطباعة
        'dark:bg-gray-800': 'background-color: #1f2937;',
        'dark:text-gray-100': 'color: #f9fafb;',
        'dark:border-gray-700': 'border-color: #374151;',
        'dark:hover:bg-gray-700': '',
        'scrollbar-thin': 'scrollbar-width: thin;',
        'print-table': 'width: 100%; border-collapse: collapse; border: 1px solid black; margin: 20px 0; font-size: 14px;',
        'print-table th': 'padding: 8px; border: 1px solid black; text-align: center; font-weight: bold;',
        'print-table td': 'padding: 8px; border: 1px solid black; text-align: center;',
        'print-break-inside-avoid': 'page-break-inside: avoid;',
        'header': 'page-break-inside: avoid; margin-bottom: 15px;',
        'separator': 'border-top: 2px solid black; margin: 10px 0;',
        'report-title': 'font-size: 20px; font-weight: bold;',
        'university-name': 'font-size: 18px; font-weight: bold;',
        'faculty-name': 'font-size: 16px;',
        'report-period': 'font-size: 14px;',
        'print-date': 'font-size: 12px;',
        'logo-container': 'display: flex; align-items: center; justify-content: center;',
        'signatures-section': 'margin-top: 1rem;',
      };

      // تطبيق الأنماط على العنصر
      const classes = element.className.split(' ');
      let inlineStyle = '';
      classes.forEach(cls => {
        if (classToStyleMap[cls]) {
          inlineStyle += classToStyleMap[cls];
        }
      });
      if (inlineStyle) {
        element.style.cssText += inlineStyle;
      }

      // تكرار العملية على العناصر الفرعية
      Array.from(element.children).forEach(child => applyInlineStyles(child));
    };

    applyInlineStyles(printContent);

    // إنشاء HTML للطباعة مع تضمين أنماط Tailwind المبسطة
    const printHTML = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>تقرير الموازنة</title>
        <style>
          @media print {
            @page {
              size: A4 portrait;
              margin: 1cm;
              @bottom-center {
                content: "صفحة " counter(page);
                font-size: 12px;
                color: black;
              }
            }
          body {
            counter-reset: page 1;
            font-family: 'Cairo', 'Inter', sans-serif;
            margin: 0;
            padding: 20px;
            direction: rtl;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
            counter-reset: page;
          }
          body::after {
            content: "صفحة " counter(page);
            position: fixed;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 12px;
            color: black;
          }
            .report-content { font-size: 12px; }
            .logo-container img { width: 80px; height: 80px; object-fit: contain; }
            .print-table {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid black;
              margin: 20px 0;
              font-size: 12px;
            }
            .print-table th, .print-table td {
              padding: 6px;
              border: 1px solid black;
              text-align: center;
            }
            .header { page-break-inside: avoid; margin-bottom: 15px; }
            .print-break-inside-avoid { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="report-content">
          ${printContent.outerHTML}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();

    // انتظر قليلاً لتحميل الصور والعرض قبل الطباعة
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* نافذة المعاينة */}
      {showPreview && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 ${isFullscreen ? '' : 'flex items-center justify-center'} z-50 ${isFullscreen ? 'p-0' : ''} print:hidden`}>
          <div className={`bg-white rounded-lg shadow-xl ${isFullscreen ? 'w-full h-full max-w-none max-h-none' : 'max-w-4xl w-full mx-4 max-h-[90vh]'} overflow-hidden print:w-full print:h-full print:max-w-none print:max-h-none print:rounded-none`}>
            <div className="flex justify-between items-center p-4 border-b print:hidden">
              <h2 className="text-xl font-bold">معاينة التقرير</h2>
              <div className="flex gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isFullscreen ? "M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" : "M21 3H3v18h18V3zM9 9h6m-6 4h6m-6 4h6"}></path>
                  </svg>
                  {isFullscreen ? 'تصغير' : 'تكبير'}
                </button>
                <button
                  onClick={handlePrintReportInNewWindow}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                  </svg>
                  طباعة
                </button>
                <button
                  onClick={handleSaveAsImage}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  حفظ كصورة
                </button>
                <button
                  onClick={() => setShowWhatsAppModal(true)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                  </svg>
                  ارسال عبر  واتساب
                </button>
                <button
                  onClick={handleClosePreview}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] print-preview">
              <div className="report-content print-content">
                <div className="header text-center mb-4">
                  <div className="logos flex justify-between items-center mb-2 mx-6">
                    <div className="logo-container ml-4">
                      {config.facultyLogo ? (
                        <img src={config.facultyLogo} alt="شعار الكلية" className="w-20 h-20 object-contain" />
                      ) : (
                        <div className="w-20 h-20 border border-gray-300 flex items-center justify-center text-sm text-gray-500">شعار الكلية</div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="university-name text-xl font-bold text-black">{config.universityName || 'جامعة العريش'}</div>
                      <div className="faculty-name text-lg text-black">{config.facultyName || 'الإدارة العامة لنظم المعلومات والتحول الرقمي'}</div>
                    </div>
                    <div className="logo-container mr-4">
                      {config.universityLogo ? (
                        <img src={config.universityLogo} alt="شعار الجامعة" className="w-20 h-20 object-contain" />
                      ) : (
                        <div className="w-20 h-20 border border-gray-300 flex items-center justify-center text-sm text-gray-500">شعار الجامعة</div>
                      )}
                    </div>
                  </div>
                  <hr className="separator" />
                  <div className="report-title text-xl font-bold mb-2 text-black">تقرير الموازنة</div>
                  <div className="report-period text-sm text-black">الفترة: {reportPeriod}</div>
                  <div className="print-date text-xs text-black mt-1">تاريخ الطباعة: {formatDate(new Date())}</div>
                </div>

{budgetData.map((budget, budgetIndex) => (
                  <div key={budget.budgetItemId} className="mb-4 print-break-inside-avoid">
                    <div className="bg-gray-100 p-2 text-right font-bold text-black mb-2">
                      {budget.budgetItemName} - إجمالي: {toArabicNumbers(budget.totalAmount.toFixed(2))}
                    </div>
                    <table className="w-full border-collapse border border-black print-table">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">م</th>
                          <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">اسم البند</th>
                          <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(budget.items.values()).map((item, index) => (
                          <tr key={item.itemId}>
                            <td className="border border-black px-2 py-2 text-sm text-center text-black">{index + 1}</td>
                            <td className="border border-black px-2 py-2 text-sm text-center text-black">{item.itemName}</td>
                            <td className="border border-black px-2 py-2 text-sm text-center text-black">{toArabicNumbers(item.amount.toFixed(2))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {budgetData.length > 0 && (
                  <div className="mt-4 print-break-inside-avoid">
                    <div className="bg-gray-200 p-2 text-right font-bold text-black text-lg">
                      الإجمالي الكلي: {toArabicNumbers(totals.totalAmount.toFixed(2))}
                    </div>
                  </div>
                )}

                {/* التوقيعات في نهاية التقرير */}
                {signatures && signatures.length > 0 && (
                  <div className="signatures-section mt-4 print-break-inside-avoid">
                    <div className="flex justify-between items-start mt-4">
                      {signatures
                        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                        .map((signature, index) => (
                          <div key={signature.id} className="text-center flex-1">
                            <div className="border-t border-black pt-2">
                              <div className="font-bold text-sm text-black">{signature.title}</div>
                              {signature.name && (
                                <div className="text-sm mt-1 text-black">{signature.name}</div>
                              )}
                            </div>
                          </div>
                        )) }
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال واتساب */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4 text-center">إرسال عبر واتساب</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رقم الهاتف
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="مثال: 01234567890"
                className="w-full p-2 border rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                أدخل رقم الهاتف (مثل 01234567890)
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowWhatsAppModal(false);
                  setPhoneNumber('');
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleWhatsAppExport}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                إرسال
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={handleViewReport}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
          </svg>
          عرض التقرير
        </button>
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          تصدير إلى Excel
        </button>
      </div>

      <div className="flex justify-center items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">تقرير الموازنة</h1>
      </div>

      {/* قسم التصفية */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
          تصفية البيانات
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* من تاريخ */}
          <div className="relative z-[20]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              من تاريخ
            </label>
            <DatePicker
              selected={startDatePicker}
              onChange={(date) => {
                setStartDatePicker(date);
                if (date) {
                  setStartDate(format(date, 'yyyy-MM-dd'));
                } else {
                  setStartDate('');
                }
              }}
              dateFormat="dd/MM/yyyy"
              locale="ar"
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
              placeholderText="اختر تاريخ البداية"
            />
          </div>

          {/* إلى تاريخ */}
          <div className="relative z-[20]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              إلى تاريخ
            </label>
            <DatePicker
              selected={endDatePicker}
              onChange={(date) => {
                setEndDatePicker(date);
                if (date) {
                  setEndDate(format(date, 'yyyy-MM-dd'));
                } else {
                  setEndDate('');
                }
              }}
              dateFormat="dd/MM/yyyy"
              locale="ar"
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
              placeholderText="اختر تاريخ النهاية"
            />
          </div>

          {/* زر إعادة تعيين */}
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              إعادة تعيين
            </button>
          </div>
        </div>

        {/* معلومات التقرير */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-md">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <div>
              <span className="font-medium">عدد بنود الموازنة:</span> {budgetData.length}
            </div>
          </div>
        </div>
      </div>


<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                  م
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                  اسم البند
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                  المبلغ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {budgetData.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    لا توجد بيانات متاحة للفترة المحددة
                  </td>
                </tr>
              ) : (
                budgetData.map((budget, budgetIndex) => (
                  <React.Fragment key={budget.budgetItemId}>
                    {/* رأس البند الرئيسي */}
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                      <td colSpan="2" className="px-4 py-4 font-bold text-lg text-gray-900 dark:text-gray-100 border-b-2 border-gray-300 dark:border-gray-500">
                        {budgetIndex + 1}. {budget.budgetItemName}
                      </td>
                      <td className="px-6 py-4 text-right text-blue-600 dark:text-blue-400 font-semibold border-b-2 border-gray-300 dark:border-gray-500">
                        الإجمالي: {toArabicNumbers(budget.totalAmount.toFixed(2))}
                      </td>
                    </tr>
                    
                    {/* البنود الفرعية */}
                    {Array.from(budget.items.values()).map((item, itemIndex) => (
                      <tr key={item.itemId} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium">
                          {budgetIndex + 1}.{itemIndex + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          └─ {item.itemName}
                        </td>
                        <td className="px-6 py-3 text-sm font-semibold text-right text-green-600 dark:text-green-400">
                          {toArabicNumbers(item.amount.toFixed(2))}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
            
            {/* الإجمالي الكلي */}
            {budgetData.length > 0 && (
              <tfoot>
                <tr className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-t-2 border-blue-200 dark:border-blue-700">
                  <td colSpan="2" className="px-4 py-4 text-right text-lg font-bold text-gray-900 dark:text-gray-100">
                    الإجمالي الكلي لجميع البنود:
                  </td>
                  <td className="px-6 py-4 text-right text-xl font-black text-blue-800 dark:text-blue-300 bg-blue-200 dark:bg-blue-900 rounded-lg mx-2 py-1">
                    {toArabicNumbers(totals.totalAmount.toFixed(2))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>


    </div>
  );
}