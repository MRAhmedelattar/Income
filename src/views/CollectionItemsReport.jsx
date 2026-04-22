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
 * مكون تقرير بنود التحصيل
 */
export default function CollectionItemsReport({ collections, items, funds, budgetItems, config, signatures }) {

  // حالة التصفية
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // حالة DatePicker للتصفية الزمنية (إصلاح timezone)
  const [startDatePicker, setStartDatePicker] = useState(null);
  const [endDatePicker, setEndDatePicker] = useState(null);
  
  const [selectedFund, setSelectedFund] = useState('all');
  const [selectedBudgetItem, setSelectedBudgetItem] = useState('all');
  const [selectedItem, setSelectedItem] = useState('all'); // جديد: تصفية حسب بند التحصيل

  // دالة إعادة تعيين التصفية
  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setStartDatePicker(null);
    setEndDatePicker(null);
    setSelectedFund('all');
    setSelectedBudgetItem('all');
    setSelectedItem('all');
  };

  // مزامنة DatePicker مع state strings
  useEffect(() => {
    if (startDate) {
      setStartDatePicker(new Date(startDate + 'T00:00:00'));
    } else {
      setStartDatePicker(null);
    }
  }, [startDate]);

  useEffect(() => {
    if (endDate) {
      setEndDatePicker(new Date(endDate + 'T23:59:59.999'));
    } else {
      setEndDatePicker(null);
    }
  }, [endDate]);

  // دوال معالجة اختيار الفلاتر (حصرية متبادلة)
  const handleFundChange = (e) => {
    const value = e.target.value;
    setSelectedFund(value);
    if (value !== 'all') {
      setSelectedBudgetItem('all');
      setSelectedItem('all');
    }
  };

  const handleBudgetItemChange = (e) => {
    const value = e.target.value;
    setSelectedBudgetItem(value);
    if (value !== 'all') {
      setSelectedFund('all');
      setSelectedItem('all');
    }
  };

  const handleItemChange = (e) => {
    const value = e.target.value;
    setSelectedItem(value);
    if (value !== 'all') {
      setSelectedFund('all');
      setSelectedBudgetItem('all');
    }
  };

  // دالة مساعدة للتحقق مما إذا كان البند يطابق الفلتر النشط
  const itemMatchesActiveFilter = (item) => {
    if (selectedFund !== 'all' && item.fundId !== selectedFund) return false;
    if (selectedBudgetItem !== 'all' && item.budgetItemId !== selectedBudgetItem) return false;
    if (selectedItem !== 'all' && item.id !== selectedItem) return false;
    return true;
  };

  // فلترة البيانات حسب التواريخ + الصندوق + بند الموازنة + البند
  const filteredCollections = useMemo(() => {
    let validCollections = collections.filter(c => c.receiptNumber && c.name);

    // فلترة حسب التاريخ
    if (startDate || endDate) {
      validCollections = validCollections.filter(collection => {
        const dateToCheck = collection.paymentDate;
        if (!dateToCheck) return false;

        const collectionDate = new Date(dateToCheck);
        const start = startDate ? new Date(startDate) : null;
        let end = endDate ? new Date(endDate) : null;

        if (startDate && endDate && startDate === endDate) {
          end = new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1);
        }

        if (start && collectionDate < start) return false;
        if (end && collectionDate > end) return false;
        return true;
      });
    }

    // فلترة حسب الصندوق أو بند الموازنة أو البند (منطق حصري متبادل)
    if (selectedFund !== 'all' || selectedBudgetItem !== 'all' || selectedItem !== 'all') {
      validCollections = validCollections.filter(collection => {
        if (!collection.distribution || !Array.isArray(collection.distribution)) return false;

        return collection.distribution.some(dist => {
          const item = items.find(i => i.id === dist.itemId);
          if (!item) return false;

          // تصفية حسب الصندوق
          if (selectedFund !== 'all' && item.fundId === selectedFund) return true;
          // تصفية حسب بند الموازنة
          if (selectedBudgetItem !== 'all' && item.budgetItemId === selectedBudgetItem) return true;
          // تصفية حسب بند التحصيل
          if (selectedItem !== 'all' && item.id === selectedItem) return true;
          
          return false;
        });
      });
    }

    return validCollections;
  }, [collections, startDate, endDate, selectedFund, selectedBudgetItem, selectedItem, items]);

  // تجميع البيانات حسب بند التحصيل مع تطبيق الفلترة على مستوى البنود
  const itemsData = useMemo(() => {
    const itemMap = new Map();

    // تهيئة البيانات لكل بند تحصيل مع تطبيق الفلترة النشطة
    items.forEach(item => {
      // تطبيق فلترة إضافية حسب الاختيار النشط لإخفاء البنود غير المرغوبة
      if (!itemMatchesActiveFilter(item)) return;
      
      itemMap.set(item.id, {
        itemId: item.id,
        itemName: item.name,
        totalAmount: 0,
      });
    });

    // حساب إجمالي المبلغ لكل بند تحصيل من التحصيلات
    filteredCollections.forEach(collection => {
      if (!collection.distribution || !Array.isArray(collection.distribution)) return;

      collection.distribution.forEach(dist => {
        const item = items.find(i => i.id === dist.itemId);
        if (!item) return;

        // تطبيق نفس الفلترة على مستوى التوزيع لضمان الاتساق
        if (!itemMatchesActiveFilter(item)) return;

        const itemData = itemMap.get(item.id);
        if (itemData) {
          itemData.totalAmount += dist.amount || 0;
        }
      });
    });

    return Array.from(itemMap.values()).filter(item => item.totalAmount > 0);
  }, [items, filteredCollections, selectedFund, selectedBudgetItem, selectedItem]);

  // حساب الإجماليات
  const totals = useMemo(() => {
    let totalAmount = 0;

    itemsData.forEach(item => {
      totalAmount += item.totalAmount;
    });

    return { totalAmount };
  }, [itemsData]);

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
    ? `من ${formatDate(startDate)} إلى ${formatDate(new Date())}`
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

  // دالة تصدير Excel
  const handleExportExcel = () => {
    console.log('Exporting Excel with itemsData length:', itemsData.length);
    const data = [
      ...itemsData.map((item, index) => [
        index + 1,
        item.itemName,
        item.totalAmount
      ]),
      ['', 'الإجمالي الكلي', totals.totalAmount]
    ];

    console.log('data to export:', JSON.stringify(data));
    const headers = ['م', 'اسم البند', 'القيمة'];

    exportToExcel(data, headers, 'تقرير بنود التحصيل', reportPeriod, 'تقرير_بنود_التقصيل');
  };

  // دالة حفظ كصورة
  const handleSaveAsImage = () => {
    // الحصول على عنصر التقرير
    const reportElement = document.querySelector('.report-content');
    if (!reportElement) {
      alert('لم يتم العثور على محتوى التقرير');
      return;
    }

    exportToImage(reportElement, 'تقرير بنود التحصيل', reportPeriod);
  };

  // دالة إرسال عبر واتساب
  const handleSendWhatsApp = () => {
    setShowWhatsAppModal(true);
  };

  // دالة تأكيد إرسال عبر واتساب
  const handleConfirmSendWhatsApp = () => {
    if (!phoneNumber.trim()) {
      alert('يرجى إدخال رقم الهاتف');
      return;
    }

    // تنسيق رقم الهاتف
    const formattedNumber = formatPhoneNumber(phoneNumber.trim());

    exportToWhatsApp(`تقرير بنود التحصيل\nالفترة: ${reportPeriod}`, formattedNumber);
    setShowWhatsAppModal(false);
    setPhoneNumber('');
  };

  // دالة إلغاء إرسال عبر واتساب
  const handleCancelSendWhatsApp = () => {
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
        <title>تقرير بنود التحصيل</title>
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
                  onClick={handleSendWhatsApp}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                  </svg>
                  إرسال عبر واتساب
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
                  <div className="report-title text-xl font-bold mb-2 text-black">تقرير بنود التحصيل</div>
                  <div className="report-period text-sm text-black">الفترة: {reportPeriod}</div>
                  <div className="print-date text-xs text-black mt-1">تاريخ الطباعة: {formatDate(new Date())}</div>
                </div>

                <table className="w-full border-collapse border border-black print-table">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">م</th>
                      <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">اسم البند</th>
                      <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsData.map((item, index) => (
                      <tr key={item.itemId}>
                        <td className="border border-black px-2 py-2 text-sm text-center text-black">{index + 1}</td>
                        <td className="border border-black px-2 py-2 text-sm text-center text-black">{item.itemName}</td>
                        <td className="border border-black px-2 py-2 text-sm text-center text-black">{toArabicNumbers(item.totalAmount.toFixed(2))}</td>
                      </tr>
                    ))}
                  </tbody>
                  {itemsData.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-200">
                        <td colSpan="2" className="border border-black px-2 py-2 text-sm font-bold text-center text-black">الإجمالي الكلي</td>
                        <td className="border border-black px-2 py-2 text-sm font-bold text-center text-black">{toArabicNumbers(totals.totalAmount.toFixed(2))}</td>
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

      {/* نافذة إدخال رقم الهاتف للواتساب */}
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
                placeholder="أدخل رقم الهاتف (مثال: 01234567890)"
                className="w-full p-2 border rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelSendWhatsApp}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmSendWhatsApp}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          تصدير Excel
        </button>
      </div>

      <div className="flex justify-center items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">تقرير بنود التحصيل</h1>
      </div>

      {/* قسم التصفية - تم تحسين التنسيق */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 pb-3 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
          تصفية البيانات
        </h2>

        {/* شبكة الفلاتر موزعة بشكل متساوٍ مع محاذاة من الأسفل */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-6 items-end">
          {/* من تاريخ */}
          <div className="relative z-[20]">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              تاريخ البداية
            </label>
            <DatePicker
              wrapperClassName="w-full"
              selected={startDatePicker}
              onChange={(date) => {
                setStartDatePicker(date);
                setStartDate(date ? format(date, 'yyyy-MM-dd') : '');
              }}
              dateFormat="dd/MM/yyyy"
              locale="ar"
              placeholderText="اختر تاريخ البداية"
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* إلى تاريخ */}
          <div className="relative z-[20]">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              تاريخ النهاية
            </label>
            <DatePicker
              wrapperClassName="w-full"
              selected={endDatePicker}
              onChange={(date) => {
                setEndDatePicker(date);
                setEndDate(date ? format(date, 'yyyy-MM-dd') : '');
              }}
              dateFormat="dd/MM/yyyy"
              locale="ar"
              placeholderText="اختر تاريخ النهاية"
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* الصندوق */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              الصندوق
            </label>
            <select
              value={selectedFund}
              onChange={handleFundChange}
              disabled={selectedBudgetItem !== 'all' || selectedItem !== 'all'}
              className={`w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 ${(selectedBudgetItem !== 'all' || selectedItem !== 'all') ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="all">الكل</option>
              {funds?.map(fund => (
                <option key={fund.id} value={fund.id}>{fund.name}</option>
              ))}
            </select>
          </div>

          {/* بند الموازنة */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              بند الموازنة
            </label>
            <select
              value={selectedBudgetItem}
              onChange={handleBudgetItemChange}
              disabled={selectedFund !== 'all' || selectedItem !== 'all'}
              className={`w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 ${(selectedFund !== 'all' || selectedItem !== 'all') ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="all">الكل</option>
              {budgetItems?.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          {/* بند التحصيل */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              بند التحصيل
            </label>
            <select
              value={selectedItem}
              onChange={handleItemChange}
              disabled={selectedFund !== 'all' || selectedBudgetItem !== 'all'}
              className={`w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 ${(selectedFund !== 'all' || selectedBudgetItem !== 'all') ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="all">الكل</option>
              {items?.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* زر إعادة تعيين - مفصول بأسفل الفلاتر */}
        <div className="flex justify-end mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={resetFilters}
            className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            إعادة تعيين التصفية
          </button>
        </div>

        {/* معلومات التصفية والتقرير */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-md grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <span className="font-medium">عدد بنود التحصيل:</span> {itemsData.length}
            </div>
          </div>
          <div>
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <span className="font-medium">الصندوق:</span> {selectedFund === 'all' ? 'الكل' : funds?.find(f => f.id === selectedFund)?.name || 'غير محدد'}
              <span className="mx-2">•</span>
              <span className="font-medium">بند الموازنة:</span> {selectedBudgetItem === 'all' ? 'الكل' : budgetItems?.find(b => b.id === selectedBudgetItem)?.name || 'غير محدد'}
              <span className="mx-2">•</span>
              <span className="font-medium">بند التحصيل:</span> {selectedItem === 'all' ? 'الكل' : items?.find(i => i.id === selectedItem)?.name || 'غير محدد'}
            </div>
          </div>
        </div>
      </div>

      {/* جدول تفاصيل بنود التحصيل */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                  م
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                  اسم البند
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                  القيمة
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {itemsData.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    لا توجد بيانات متاحة
                  </td>
                </tr>
              ) : (
                itemsData.map((item, index) => (
                  <tr key={item.itemId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                      {item.itemName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                      {item.totalAmount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* صف الإجماليات */}
            <tfoot className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20">
              <tr>
                <td colSpan="2" className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200 text-center">
                  الإجمالي الكلي
                </td>
                <td className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200 text-center">
                  {totals.totalAmount.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>


    </div>
  );
}