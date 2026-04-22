import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { registerLocale } from "react-datepicker";
import { format } from 'date-fns';
import ar from 'date-fns/locale/ar';

registerLocale('ar', ar);
import { exportToExcel } from '../utils/excelExport';
import { exportToWhatsApp, exportToImage } from '../utils/whatsappExport';

// دالة تحويل الأرقام إلى عربية
const toArabicNumbers = (num) => {
  return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
};

// دالة تنسيق رقم الهاتف المصري
const formatPhoneNumber = (phoneNumber) => {
  // إزالة المسافات والرموز
  const cleanNumber = phoneNumber.replace(/\s+|-|\(|\)/g, '');

  // إذا كان الرقم يبدأ بـ 0، أزل الـ 0 وأضف +20
  if (cleanNumber.startsWith('0')) {
    return '+20' + cleanNumber.substring(1);
  } else {
    // إذا لم يبدأ بـ 0، أضف +20 مباشرة
    return '+20' + cleanNumber;
  }
};

/**
 * مكون تقرير الصناديق
 */
export default function FundsReport({ collections, items, funds, deductions, config, signatures, budgetDeductions, onBack }) {

  // حالة التصفية
  const [filterType, setFilterType] = useState('paymentDate'); // 'paymentDate' أو 'registrationDate'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedFund, setSelectedFund] = useState('all'); // 'all' أو id الصندوق
  const [hideBudgetDeductions, setHideBudgetDeductions] = useState(false); // إخفاء أعمدة الخصومات الموازنة
  
  // حالة DatePicker للتصفية الزمنية
  const [startDatePicker, setStartDatePicker] = useState(null);
  const [endDatePicker, setEndDatePicker] = useState(null);

  // مزامنة DatePicker مع state strings (إصلاح timezone offset)
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
    setSelectedFund('all');
    setHideBudgetDeductions(false);
  };

  // فلترة البيانات حسب التواريخ والصندوق
  const filteredCollections = useMemo(() => {
    const validCollections = collections.filter(c => c.receiptNumber && c.name);
    if (!startDate && !endDate && selectedFund === 'all') return validCollections;

    let filtered = validCollections;

    // فلترة حسب التواريخ
    if (startDate || endDate) {
      filtered = filtered.filter(collection => {
        const dateToCheck = filterType === 'paymentDate' ? collection.paymentDate : collection.registrationDate;
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
    }

    // فلترة حسب الصندوق
    if (selectedFund !== 'all') {
      filtered = filtered.filter(collection => {
        if (!collection.distribution || !Array.isArray(collection.distribution)) return false;
        return collection.distribution.some(dist => {
          const item = items.find(i => i.id === dist.itemId);
          return item && item.fundId === selectedFund;
        });
      });
    }

    return filtered;
  }, [collections, filterType, startDate, endDate, selectedFund, items]);

  // تجميع البيانات حسب الصندوق
  const fundsData = useMemo(() => {
    const fundMap = new Map();
    const safeDeductions = deductions || [];
    const safeBudgetDeductions = budgetDeductions || [];

    // تهيئة البيانات لكل صندوق
    funds.forEach(fund => {
      if (selectedFund === 'all' || selectedFund === fund.id) {
        fundMap.set(fund.id, {
          fundId: fund.id,
          fundName: fund.name,
          totalCollected: 0,
          deductions: safeDeductions.reduce((acc, deduction) => {
            acc[deduction.id] = 0;
            return acc;
          }, {}),
          budgetDeductions: safeBudgetDeductions.reduce((acc, budgetDeduction) => {
            acc[budgetDeduction.id] = 0;
            return acc;
          }, {}),
          netAmount: 0,
          netAfterGeneral: 0
        });
      }
    });

    // حساب إجمالي المحصل لكل صندوق
    filteredCollections.forEach(collection => {
      if (!collection.distribution || !Array.isArray(collection.distribution)) return;

      collection.distribution.forEach(dist => {
        const item = items.find(i => i.id === dist.itemId);
        if (!item || !item.fundId) return;

        if (fundMap.has(item.fundId)) {
          const fundData = fundMap.get(item.fundId);
          fundData.totalCollected += dist.amount || 0;
        }
      });
    });

    // حساب الاستقطاعات والصافي لكل صندوق
    fundMap.forEach(fundData => {
      let totalGeneralDeductions = 0;

      // حساب مجموع الاستقطاعات العامة لكل صندوق
      safeDeductions.forEach(deduction => {
        const deductionAmount = (fundData.totalCollected * (deduction.percentage || 0)) / 100;
        fundData.deductions[deduction.id] = deductionAmount;
        totalGeneralDeductions += deductionAmount;
      });

      // حساب المبلغ الصافي بعد الاستقطاعات العامة
      fundData.netAmount = fundData.totalCollected - totalGeneralDeductions;

      // حساب مجموع الاستقطاعات الموازنة: الاستقطاعات الموازنة تُحسب متسلسلة
      // الباب الأول يُحسب من المبلغ الصافي كاملاً
      // باقي الأبواب تُحسب من (المبلغ الصافي - مبلغ الباب الأول)
      let firstDeductionAmount = 0;
      safeBudgetDeductions.forEach((budgetDeduction, index) => {
        if (index === 0) {
          // الباب الأول يُحسب من المبلغ الصافي
          const deductionAmount = (fundData.netAmount * (budgetDeduction.percentage || 0)) / 100;
          fundData.budgetDeductions[budgetDeduction.id] = deductionAmount;
          firstDeductionAmount = deductionAmount;
        } else {
          // باقي الأبواب تُحسب من (المبلغ الصافي - مبلغ الباب الأول)
          const deductionAmount = ((fundData.netAmount - firstDeductionAmount) * (budgetDeduction.percentage || 0)) / 100;
          fundData.budgetDeductions[budgetDeduction.id] = deductionAmount;
        }
      });
    });

    return Array.from(fundMap.values());
  }, [funds, deductions, budgetDeductions, filteredCollections, items, selectedFund]);

  // حساب الإجماليات
  const totals = useMemo(() => {
    let totalCollected = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    fundsData.forEach(fund => {
      totalCollected += fund.totalCollected;
      totalDeductions += Object.values(fund.deductions).reduce((sum, val) => sum + val, 0) + Object.values(fund.budgetDeductions).reduce((sum, val) => sum + val, 0);
      totalNet += fund.netAmount;
    });

    return { totalCollected, totalDeductions, totalNet };
  }, [fundsData]);

// تنسيق التاريخ الموحد مع Collections.jsx
const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
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

  // دوال الواتساب داخل المعاينة
  const handleOpenWhatsAppModal = () => {
    setShowWhatsAppModal(true);
  };

  const handleCloseWhatsAppModal = () => {
    setShowWhatsAppModal(false);
    setPhoneNumber('');
  };

  const handleSendWhatsAppFromModal = () => {
    if (!phoneNumber.trim()) {
      alert('يرجى إدخال رقم الهاتف.');
      return;
    }

    let formattedNumber = formatPhoneNumber(phoneNumber.trim());

    // التحقق من صحة الرقم
    const cleanNumber = formattedNumber.replace(/\s+|-|\(|\)/g, '');
    const phoneRegex = /^(\+20|0)?1[0-25][0-9]{8}$/;
    if (!phoneRegex.test(cleanNumber)) {
      alert('رقم الهاتف غير صحيح. يرجى إدخال رقم صحيح.');
      return;
    }

    exportToWhatsApp('تقرير الصناديق: ' + reportPeriod, formattedNumber);
    handleCloseWhatsAppModal();
  };

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

  // دالة تصدير Excel
  const handleExportExcel = () => {
    console.log('Exporting Excel with fundsData length:', fundsData.length);
    const headers = [
      'اسم الصندوق',
      'الإجمالي المحصل',
      ...(deductions || []).map(d => d.name),
      'المبلغ الصافي',
      ...(budgetDeductions || []).map(bd => bd.name)
    ];

    const data = [
      ...fundsData.map(fund => [
        fund.fundName,
        fund.totalCollected,
        ...(deductions || []).map(d => fund.deductions[d.id] || 0),
        fund.netAmount,
        ...(budgetDeductions || []).map(bd => fund.budgetDeductions[bd.id] || 0)
      ]),
      [
        'الإجمالي الكلي',
        totals.totalCollected,
        ...(deductions || []).map(d => {
          let totalDeduction = 0;
          fundsData.forEach(f => {
            totalDeduction += f.deductions[d.id] || 0;
          });
          return totalDeduction;
        }),
        totals.totalNet,
        ...(budgetDeductions || []).map(bd => {
          let totalBudgetDeduction = 0;
          fundsData.forEach(f => {
            totalBudgetDeduction += f.budgetDeductions[bd.id] || 0;
          });
          return totalBudgetDeduction;
        })
      ]
    ];

    console.log('data to export:', JSON.stringify(data));
    exportToExcel(data, headers, 'تقرير الصناديق', reportPeriod, 'تقرير_الصناديق');
  };

  // دالة حفظ كصورة
  const handleSaveAsImage = () => {
    // الحصول على عنصر التقرير
    const reportElement = document.querySelector('.report-content');
    if (!reportElement) {
      alert('لم يتم العثور على محتوى التقرير');
      return;
    }

    exportToImage(reportElement, 'تقرير الصناديق', reportPeriod);
  };

  // دالة تصدير كصورة
  const handleExportImage = () => {
    const element = document.querySelector('.print-content');
    if (element) {
      exportToImage(element, 'تقرير الصناديق', reportPeriod);
    }
  };

  // دالة إرسال عبر واتساب
  const handleSendWhatsApp = () => {
    let phoneNumber = prompt('يرجى إدخال رقم الهاتف المصري (مثال: 01012345678):', '');
    if (!phoneNumber) return;

    phoneNumber = formatPhoneNumber(phoneNumber);

    // التحقق من صحة الرقم
    const cleanNumber = phoneNumber.replace(/\s+|-|\(|\)/g, '');
    const phoneRegex = /^(\+20|0)?1[0-25][0-9]{8}$/;
    if (!phoneRegex.test(cleanNumber)) {
      alert('رقم الهاتف غير صحيح. يرجى إدخال رقم صحيح.');
      return;
    }

    exportToWhatsApp('تقرير الصناديق: ' + reportPeriod, phoneNumber);
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
        <title>تقرير الصناديق</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          @media print {
            @page {
              size: A4 landscape;
              margin: 0.5cm;
            }
            body {
              font-family: 'Cairo', 'Arial', sans-serif;
              direction: rtl;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              width: 100%;
              height: 100%;
            }
            .report-content { 
              font-size: 10px;
              width: 100%;
              max-height: 98vh;
              overflow: hidden;
            }
            .logo-container img { width: 60px; height: 60px; object-fit: contain; }
            .print-table {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid black;
              margin: 10px 0;
              font-size: 10px;
              table-layout: auto;
            }
            .print-table th, .print-table td {
              padding: 4px;
              border: 1px solid black;
              text-align: center;
              word-wrap: break-word;
            }
            .header { page-break-inside: avoid; margin-bottom: 10px; }
            .print-break-inside-avoid { page-break-inside: avoid; }
            .signatures-section {
              page-break-inside: avoid;
              margin-top: 10px;
            }
          }
          body {
            padding: 0.5cm;
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
                  طباعة
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                </button>
                <button
                  onClick={handleSaveAsImage}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  حفظ كصورة
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </button>
                <button
                  onClick={handleOpenWhatsAppModal}
                  className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                >
                  إرسال عبر واتساب
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                  </svg>
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
                  <div className="report-title text-xl font-bold mb-2 text-black">تقرير الصناديق</div>
                  <div className="report-period text-sm text-black">الفترة: {reportPeriod}</div>
<div className="print-date text-xs text-black mt-1">تاريخ الطباعة: {formatDate(new Date())} - {new Date().toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}</div>
                </div>

                <table className="w-full border-collapse border border-black print-table">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">اسم الصندوق</th>
                      <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">الإجمالي المحصل</th>
                      {(deductions || []).map(deduction => (
                        <th key={deduction.id} className="border border-black px-2 py-2 text-center text-sm font-bold text-black">{deduction.name}</th>
                      ))}
                      <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">المبلغ الصافي</th>
                      {!hideBudgetDeductions && (budgetDeductions || []).map(budgetDeduction => (
                        <th key={budgetDeduction.id} className="border border-black px-2 py-2 text-center text-sm font-bold text-black">{budgetDeduction.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fundsData.map((fund, index) => (
                      <tr key={fund.fundId}>
                        <td className="border border-black px-2 py-2 text-sm text-center text-black">{fund.fundName}</td>
                        <td className="border border-black px-2 py-2 text-sm text-center text-black">{toArabicNumbers(fund.totalCollected.toFixed(2))}</td>
                        {(deductions || []).map(deduction => (
                          <td key={deduction.id} className="border border-black px-2 py-2 text-sm text-center text-black">
                            {toArabicNumbers((fund.deductions[deduction.id] || 0).toFixed(2))}
                          </td>
                        ))}
                        <td className="border border-black px-2 py-2 text-sm font-bold text-center text-black">{toArabicNumbers(fund.netAmount.toFixed(2))}</td>
                        {!hideBudgetDeductions && (budgetDeductions || []).map(budgetDeduction => (
                          <td key={budgetDeduction.id} className="border border-black px-2 py-2 text-sm text-center text-black">
                            {toArabicNumbers((fund.budgetDeductions[budgetDeduction.id] || 0).toFixed(2))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {fundsData.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-200">
                        <td className="border border-black px-2 py-2 text-sm font-bold text-center text-black">الإجمالي الكلي</td>
                        <td className="border border-black px-2 py-2 text-sm font-bold text-center text-black">{toArabicNumbers(totals.totalCollected.toFixed(2))}</td>
{(deductions || []).map(deduction => {
                            const deductionTotal = fundsData.reduce((sum, f) => sum + (f.deductions[deduction.id] || 0), 0);
                            return (
                              <td key={deduction.id} className="border border-black px-2 py-2 text-sm font-bold text-center text-black">
                                {toArabicNumbers(deductionTotal.toFixed(2))}
                              </td>
                            );
                          })}
                        <td className="border border-black px-2 py-2 text-sm font-bold text-center text-black">{toArabicNumbers(totals.totalNet.toFixed(2))}</td>
{!hideBudgetDeductions && (budgetDeductions || []).map(budgetDeduction => {
                            const budgetDeductionTotal = fundsData.reduce((sum, f) => sum + (f.budgetDeductions[budgetDeduction.id] || 0), 0);
                            return (
                              <td key={budgetDeduction.id} className="border border-black px-2 py-2 text-sm font-bold text-center text-black">
                                {toArabicNumbers(budgetDeductionTotal.toFixed(2))}
                              </td>
                            );
                          })}
                      </tr>
                    </tfoot>
                  )}
                </table>

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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          تصدير Excel
        </button>
      </div>


      <div className="flex justify-center items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">تقرير الصناديق</h1>
      </div>

      {/* قسم التصفية */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-gray-100">
          تصفية البيانات
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* مجموعة التصفية الزمنية */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              التصفية الزمنية
            </h3>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                نوع التصفية
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="paymentDate">تاريخ السداد</option>
                <option value="registrationDate">تاريخ التسجيل</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                من تاريخ
              </label>
              <DatePicker
                selected={startDatePicker}
                onChange={(date) => {
                  setStartDatePicker(date);
                  if (date) {
                    // الحفظ بتنسيق YYYY-MM-DD محلياً
                    setStartDate(format(date, 'yyyy-MM-dd'));
                  } else {
                    setStartDate('');
                  }
                }}
                dateFormat="dd/MM/yyyy"
                locale="ar"
                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholderText="اختر تاريخ البداية"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                إلى تاريخ
              </label>
              <DatePicker
                selected={endDatePicker}
                onChange={(date) => {
                  setEndDatePicker(date);
                  if (date) {
                    // الحفظ بتنسيق YYYY-MM-DD محلياً
                    setEndDate(format(date, 'yyyy-MM-dd'));
                  } else {
                    setEndDate('');
                  }
                }}
                dateFormat="dd/MM/yyyy"
                locale="ar"
                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholderText="اختر تاريخ النهاية"
              />
            </div>
          </div>

          {/* مجموعة التصفية بالمحتوى */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
              </svg>
              التصفية بالمحتوى
            </h3>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                الصندوق
              </label>
              <select
                value={selectedFund}
                onChange={(e) => setSelectedFund(e.target.value)}
                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="all">جميع الصناديق</option>
                {funds.map(fund => (
                  <option key={fund.id} value={fund.id}>{fund.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* مجموعة خيارات العرض */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
              خيارات العرض
            </h3>

            <button
              onClick={() => setHideBudgetDeductions(!hideBudgetDeductions)}
              className={`w-full h-10 px-3 py-2 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-2 ${
                hideBudgetDeductions
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              {hideBudgetDeductions ? 'إظهار الأبواب' : 'إخفاء الأبواب'}
            </button>
          </div>

          {/* مجموعة الإجراءات */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              الإجراءات
            </h3>

            <button
              onClick={resetFilters}
              className="w-full h-10 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              إعادة تعيين
            </button>
          </div>
        </div>

        {/* معلومات التقرير */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-md">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <div>
              <span className="font-medium">عدد الصناديق:</span> {fundsData.length}
            </div>
          </div>
        </div>
      </div>

      {/* جدول تفاصيل الصناديق */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                  اسم الصندوق
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                  الإجمالي المحصل
                </th>
                {(deductions || []).map(deduction => (
                  <th key={deduction.id} className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                    {deduction.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                  المبلغ الصافي
                </th>
                {!hideBudgetDeductions && (budgetDeductions || []).map(budgetDeduction => (
                  <th key={budgetDeduction.id} className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                    {budgetDeduction.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {fundsData.length === 0 ? (
                <tr>
                  <td colSpan={3 + (deductions || []).length + (!hideBudgetDeductions ? (budgetDeductions || []).length : 0)} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    لا توجد بيانات متاحة
                  </td>
                </tr>
              ) : (
                fundsData.map(fund => (
                  <tr key={fund.fundId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {fund.fundName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {fund.totalCollected.toFixed(2)}
                    </td>
                    {(deductions || []).map(deduction => (
                      <td key={deduction.id} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {fund.deductions[deduction.id]?.toFixed(2) || '0.00'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400">
                      {fund.netAmount.toFixed(2)}
                    </td>
                    {!hideBudgetDeductions && (budgetDeductions || []).map(budgetDeduction => (
                      <td key={budgetDeduction.id} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {fund.budgetDeductions[budgetDeduction.id]?.toFixed(2) || '0.00'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {/* صف الإجماليات */}
            <tfoot className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20">
              <tr>
                <td className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200 text-right">
                  الإجمالي
                </td>
                <td className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200">
                  {totals.totalCollected.toFixed(2)}
                </td>
                {(deductions || []).map(deduction => (
                  <td key={deduction.id} className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200">
                    {(deductions || []).map(d => {
                      let totalDeduction = 0;
                      fundsData.forEach(f => {
                        totalDeduction += f.deductions[d.id] || 0;
                      });
                      return totalDeduction.toFixed(2);
                    })[deductions.indexOf(deduction)]}
                  </td>
                ))}
                <td className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200">
                  {totals.totalNet.toFixed(2)}
                </td>
                {!hideBudgetDeductions && (budgetDeductions || []).map(budgetDeduction => (
                  <td key={budgetDeduction.id} className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200">
                    {(budgetDeductions || []).map(bd => {
                      let totalBudgetDeduction = 0;
                      fundsData.forEach(f => {
                        totalBudgetDeduction += f.budgetDeductions[bd.id] || 0;
                      });
                      return totalBudgetDeduction.toFixed(2);
                    })[budgetDeductions.indexOf(budgetDeduction)]}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* نافذة واتساب */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">إرسال عبر واتساب</h3>
            <input
              type="text"
              placeholder="أدخل رقم الهاتف المصري (مثال: 01012345678)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full p-2 border rounded mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSendWhatsAppFromModal}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                إرسال
              </button>
              <button
                onClick={handleCloseWhatsAppModal}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
