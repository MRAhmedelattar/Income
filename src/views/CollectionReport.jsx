import React, { useState, useEffect, useMemo } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import ar from 'date-fns/locale/ar';
import { exportToExcel } from '../utils/excelExport';
import { exportToWhatsApp, exportToImage } from '../utils/whatsappExport';

registerLocale('ar', ar);

/**
 * مكون تقرير المجمع
 */
export default function CollectionReport({ collections, items, funds, budgetItems, config, signatures, revenues = [] }) {
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

  // حالة التصفية
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startDatePicker, setStartDatePicker] = useState(null);
  const [endDatePicker, setEndDatePicker] = useState(null);
  const [selectedRevenueType, setSelectedRevenueType] = useState('all');

  // مزامنة الحالة النصية مع كائنات DatePicker
  useEffect(() => {
    if (!startDate) {
      setStartDatePicker(null);
    } else {
      setStartDatePicker(new Date(startDate + 'T00:00:00'));
    }
    
    if (!endDate) {
      setEndDatePicker(null);
    } else {
      setEndDatePicker(new Date(endDate + 'T00:00:00'));
    }
  }, [startDate, endDate]);

  // دالة إعادة تعيين التصفية
  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setStartDatePicker(null);
    setEndDatePicker(null);
    setSelectedRevenueType('all');
  };

  // فلترة البيانات حسب التاريخ والإيراد
  const filteredCollections = useMemo(() => {
    let result = collections.filter(c => c.receiptNumber && c.name);

    // فلترة التاريخ
    if (startDate || endDate) {
      result = result.filter(collection => {
        const dateToCheck = collection.paymentDate;
        if (!dateToCheck) return false;

        const collectionDate = new Date(dateToCheck + 'T00:00:00');
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        let end = endDate ? new Date(endDate + 'T23:59:59') : null;

        if (start && collectionDate < start) return false;
        if (end && collectionDate > end) return false;
        return true;
      });
    }

    // فلترة نوع الإيراد
    if (selectedRevenueType !== 'all') {
      result = result.filter(c => {
        const revenue = revenues.find(r => String(r.id) === String(c.selectedRevenueId));
        return revenue && revenue.type === selectedRevenueType;
      });
    }

    return result;
  }, [collections, startDate, endDate, selectedRevenueType]);

  // تجميع البيانات حسب الصناديق
  const fundsData = useMemo(() => {
    const fundMap = new Map();

    // تهيئة البيانات لكل صندوق
    funds.forEach(fund => {
      fundMap.set(fund.id, {
        fundId: fund.id,
        fundName: fund.name,
        totalAmount: 0,
        items: new Map()
      });
    });

    // حساب إجمالي المبلغ لكل بند في كل صندوق من التحصيلات
    filteredCollections.forEach(collection => {
      if (!collection.distribution || !Array.isArray(collection.distribution)) return;

      collection.distribution.forEach(dist => {
        const item = items.find(i => i.id === dist.itemId);
        if (!item || !item.fundId) return;

        const fundData = fundMap.get(item.fundId);
        if (!fundData) return;

        fundData.totalAmount += dist.amount || 0;

        if (!fundData.items.has(item.id)) {
          fundData.items.set(item.id, {
            itemId: item.id,
            itemName: item.name,
            amount: 0
          });
        }
        fundData.items.get(item.id).amount += dist.amount || 0;
      });
    });

    return Array.from(fundMap.values()).filter(fund => fund.totalAmount > 0);
  }, [funds, items, filteredCollections]);

  // بيانات الموازنة مع البنود الفرعية (مثل الصناديق)
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

        const budgetData = budgetMap.get(budgetItem.id);
        if (!budgetData) return;

        budgetData.totalAmount += dist.amount || 0;

        // إضافة/تحديث البند الفرعي
        if (!budgetData.items.has(item.id)) {
          budgetData.items.set(item.id, {
            itemId: item.id,
            itemName: item.name,
            amount: 0
          });
        }
        budgetData.items.get(item.id).amount += dist.amount || 0;
      });
    });

    return Array.from(budgetMap.values()).filter(budget => budget.totalAmount > 0);
  }, [budgetItems, items, filteredCollections]);

  // حساب الإجماليات
  const totals = useMemo(() => {
    let fundsTotal = 0;
    let budgetTotal = 0;

    fundsData.forEach(fund => {
      fundsTotal += fund.totalAmount;
    });

    budgetData.forEach(item => {
      budgetTotal += item.totalAmount;
    });

    return { fundsTotal, budgetTotal, grandTotal: fundsTotal + budgetTotal };
  }, [fundsData, budgetData]);

// تنسيق التاريخ الموحد (أرقام غربية DD/MM/YYYY)
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
    const data = [];

    // قسم الصناديق
    data.push(['قسم الصناديق']);
    fundsData.forEach(fund => {
      data.push([fund.fundName, '', toArabicNumbers(fund.totalAmount.toFixed(2))]);
      Array.from(fund.items.values()).forEach(item => {
        data.push(['', item.itemName, toArabicNumbers(item.amount.toFixed(2))]);
      });
    });
    data.push(['إجمالي الصناديق', '', toArabicNumbers(totals.fundsTotal.toFixed(2))]);
    data.push(['']);

    // قسم الموازنة
    data.push(['قسم الموازنة']);
    budgetData.forEach(item => {
      data.push([item.budgetItemName, toArabicNumbers(item.totalAmount.toFixed(2))]);
    });
    data.push(['إجمالي الموازنة', toArabicNumbers(totals.budgetTotal.toFixed(2))]);
    data.push(['الإجمالي الكلي', toArabicNumbers(totals.grandTotal.toFixed(2))]);

    const headers = ['البند', 'الوصف', 'المبلغ'];

    exportToExcel(data, headers, 'تقرير المجمع', reportPeriod, 'تقرير_المجمع');
  };

  // دالة حفظ كصورة
  const handleSaveAsImage = () => {
    // الحصول على عنصر التقرير
    const reportElement = document.querySelector('.report-content');
    if (!reportElement) {
      alert('لم يتم العثور على محتوى التقرير');
      return;
    }

    exportToImage(reportElement, 'تقرير المجمع', reportPeriod);
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

    exportToWhatsApp(`تقرير المجمع\nالفترة: ${reportPeriod}`, formattedNumber);
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

    // حساب حجم الخط بناءً على عدد الأعمدة
    const numColumns = 3; // م، اسم البند، المبلغ
    let fontSize = 12;
    if (numColumns > 38) fontSize = 7;
    else if (numColumns > 32) fontSize = 7.5;
    else if (numColumns > 20) fontSize = 8;
    else if (numColumns > 15) fontSize = 9;
    else if (numColumns > 10) fontSize = 10;

    // جمع محتوى التقرير فقط
    const printContent = document.querySelector('.print-content').cloneNode(true);

    // إنشاء HTML للطباعة مع تضمين أنماط Tailwind المبسطة
    const printHTML = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>تقرير المجمع</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          @page {
            size: A4 portrait;
            margin: 0.5cm 0.5cm;
          }
          @page {
            margin: 0.5cm;
            @bottom-center {
              content: counter(page);
              font-size: 11px;
              color: black;
            }
          }
          @media print {
            body {
              counter-reset: page;
            }
            .page-footer {
              display: none;
            }
          }
          html, body {
            font-family: 'Cairo', 'Arial', sans-serif;
            direction: rtl;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            margin: 0;
            padding: 0.5cm;
            background: white;
          }
          .report-content {
            font-size: ${fontSize}px;
            line-height: 1.4;
          }
          .logo-container img {
            width: 60px;
            height: 60px;
            object-fit: contain;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid black;
            margin: 15px 0;
            font-size: ${fontSize}px;
            table-layout: fixed;
          }
          .print-table th {
            padding: 4px 2px;
            border: 1px solid black;
            text-align: center;
            font-weight: bold;
            background-color: #f3f4f6;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: keep-all;
            white-space: normal;
            vertical-align: middle;
            max-height: 3em;
          }
          .print-table td {
            padding: 4px 2px;
            border: 1px solid black;
            text-align: center;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: normal;
            vertical-align: middle;
          }
          .header {
            page-break-inside: avoid;
            margin-bottom: 6px;
            padding: 0;
          }
          .print-break-inside-avoid {
            page-break-inside: avoid;
          }
          .university-name {
            font-size: 16px;
            font-weight: bold;
          }
          .faculty-name {
            font-size: 14px;
            font-weight: bold;
          }
          .report-title {
            font-size: 14px;
            font-weight: bold;
          }
          .report-period, .print-date {
            font-size: 11px;
          }
          .logos {
            margin-bottom: 4px;
          }
          .separator {
            border-top: 2px solid black;
            margin: 4px 0;
          }
          .signatures-section {
            margin-top: 8px;
            page-break-inside: avoid;
            font-size: 10px;
          }
          .text-center {
            text-align: center;
          }
          .flex {
            display: flex;
          }
          .justify-between {
            justify-content: space-between;
          }
          .items-center {
            align-items: center;
          }
          .items-start {
            align-items: flex-start;
          }
          .flex-1 {
            flex: 1;
          }
          .border-t {
            border-top: 1px solid black;
          }
          .pt-2 {
            padding-top: 8px;
          }
          .font-bold {
            font-weight: bold;
          }
          .text-sm {
            font-size: ${fontSize}px;
          }
          .mt-1 {
            margin-top: 4px;
          }
          .mt-4 {
            margin-top: 15px;
          }
          .mx-6 {
            margin-left: 24px;
            margin-right: 24px;
          }
          .ml-4 {
            margin-left: 16px;
          }
          .mr-4 {
            margin-right: 16px;
          }
          .mb-2 {
            margin-bottom: 8px;
          }
          .bg-gray-100 {
            background-color: #f3f4f6;
          }
          .bg-gray-200 {
            background-color: #e5e7eb;
          }
          .text-black {
            color: black;
          }
          .signature-title {
            font-size: 13px;
            font-weight: bold;
          }
          .signature-name {
            font-size: 12px;
            font-weight: bold;
            margin-top: 2px;
          }
          .grand-total-print {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        </style>

      </head>
      <body>
        <div class="report-content">
          ${printContent.outerHTML}
        </div>
        <div class="page-footer">صفحة <span class="page-number">1</span></div>
      </body>
      </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();

    // انتظر قليلاً لتحميل الصور والعرض قبل الطباعة
    printWindow.onload = () => {
      setTimeout(() => {
        // إصلاح ترقيم الصفحات - احسب عدد الصفحات ديناميكياً
        const pageHeight = printWindow.innerHeight * 0.95; // بدون footer
        const contentHeight = printWindow.document.body.scrollHeight;
        const pageCount = Math.ceil(contentHeight / pageHeight);

        // تحديث أرقام الصفحات
        const pageFooters = printWindow.document.querySelectorAll('.page-footer');
        let currentPage = 1;
        pageFooters.forEach((footer, index) => {
          footer.querySelector('.page-number').textContent = currentPage;
        });

        printWindow.focus();
        printWindow.print();
        // لا تغلق النافذة فوراً لتتمكن من الطباعة
        setTimeout(() => printWindow.close(), 100);
      }, 500);
    };
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* نافذة المعاينة */}
{showPreview && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 ${isFullscreen ? '' : 'flex items-center justify-center'} z-[100] ${isFullscreen ? 'p-0' : ''} print:hidden`}>
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
                  <div className="report-title text-xl font-bold mb-2 text-black text-center">تقرير المجمع</div>
                  <div className="report-period text-sm text-black">الفترة: {reportPeriod}</div>
                  <div className="print-date text-xs text-black mt-1">تاريخ الطباعة: {formatDate(new Date())}</div>
                </div>

                {/* قسم الصناديق */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-4 text-black">قسم الصناديق</h3>
                  {fundsData.map((fund, fundIndex) => (
                    <div key={fund.fundId} className="mb-4">
                      <div className="bg-gray-100 p-2 text-right font-bold text-black">
                        {fund.fundName} - إجمالي: {toArabicNumbers(fund.totalAmount.toFixed(2))}
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
                          {Array.from(fund.items.values()).map((item, index) => (
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
                </div>

                {/* قسم الموازنة */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-4 text-black">قسم الموازنة</h3>
                  {budgetData.map((budgetItem, budgetIndex) => (
                    <div key={budgetItem.budgetItemId} className="mb-4">
                      <div className="bg-gray-100 p-2 text-right font-bold text-black">
                        {budgetItem.budgetItemName} - إجمالي: {toArabicNumbers(budgetItem.totalAmount.toFixed(2))}
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
                          {Array.from(budgetItem.items.values()).map((item, index) => (
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
                </div>

                {/* الإجمالي الكلي - نافذة المعاينة */}
                <div className="w-full bg-gray-100 p-6 text-center mt-6 mb-4 print-break-inside-avoid grand-total-print">
                  <div className="text-2xl font-bold text-black">
                    الإجمالي الكلي: {toArabicNumbers(totals.grandTotal.toFixed(2))}
                  </div>
                </div>

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[101]">
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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">تقرير المجمع</h1>
      </div>

      {/* قسم التصفية */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
          تصفية البيانات
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* من تاريخ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              من تاريخ
            </label>
<div className="relative z-[50]">
  <DatePicker
    selected={startDatePicker}
    onChange={(date) => {
      setStartDatePicker(date);
      setStartDate(format(date, 'yyyy-MM-dd'));
    }}
    dateFormat="dd/MM/yyyy"
    locale="ar"
    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
    wrapperClassName="w-full"
    placeholderText="اختر تاريخ البداية"
  />
</div>
          </div>

          {/* إلى تاريخ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              إلى تاريخ
            </label>
<div className="relative z-[50]">
  <DatePicker
    selected={endDatePicker}
    onChange={(date) => {
      setEndDatePicker(date);
      setEndDate(format(date, 'yyyy-MM-dd'));
    }}
    dateFormat="dd/MM/yyyy"
    locale="ar"
    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
    wrapperClassName="w-full"
    placeholderText="اختر تاريخ النهاية"
  />
</div>
          </div>

          {/* الإيراد */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              الإيراد
            </label>
            <select
              value={selectedRevenueType}
              onChange={(e) => setSelectedRevenueType(e.target.value)}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">جميع أنواع الإيرادات</option>
              {[...new Set(revenues.map(r => r.type))].map(type => (
                <option key={type} value={type}>
                  {type === 'general' ? 'عام' : type === 'special' ? 'مميز' : type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
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
              <span className="font-medium">عدد الصناديق:</span> {fundsData.length}
            </div>
            <div>
              <span className="font-medium">عدد بنود الموازنة:</span> {budgetData.length}
            </div>
            {selectedRevenueType !== 'all' && (
              <div>
                <span className="font-medium">نوع الإيراد:</span> {
                  selectedRevenueType === 'general' ? 'عام' : selectedRevenueType === 'special' ? 'مميز' : selectedRevenueType.charAt(0).toUpperCase() + selectedRevenueType.slice(1)
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* قسم الصناديق */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4">
          <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-100">قسم الصناديق</h3>
          {fundsData.map((fund) => (
            <div key={fund.fundId} className="mb-4">
              <div className="bg-gray-100 dark:bg-gray-700 p-2 text-right font-bold text-gray-800 dark:text-gray-100">
                {fund.fundName} - إجمالي: {fund.totalAmount.toFixed(2)}
              </div>
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
                        المبلغ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {Array.from(fund.items.values()).map((item, index) => (
                      <tr key={item.itemId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                          {item.itemName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                          {toArabicNumbers(item.amount.toFixed(2))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* قسم الموازنة */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4">
          <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-100">قسم الموازنة</h3>
          {budgetData.map((budgetItem) => (
            <div key={budgetItem.budgetItemId} className="mb-6">
              <div className="bg-gray-100 dark:bg-gray-700 p-3 text-right font-bold text-gray-800 dark:text-gray-100 mb-3">
                {budgetItem.budgetItemName} - إجمالي: {toArabicNumbers(budgetItem.totalAmount.toFixed(2))}
              </div>
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
                        المبلغ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {Array.from(budgetItem.items.values()).map((item, index) => (
                      <tr key={item.itemId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                          {item.itemName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                          {toArabicNumbers(item.amount.toFixed(2))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* الإجمالي الكلي - عرض الصفحة الرئيسية */}
      <div className="bg-gray-100 p-6 text-center rounded-lg shadow-md mt-6">
        <div className="text-2xl font-bold text-gray-800">
          الإجمالي الكلي: {toArabicNumbers(totals.grandTotal.toFixed(2))}
        </div>
      </div>
    </div>
  );
}

