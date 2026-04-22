import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { registerLocale } from 'react-datepicker';
import { exportToExcel } from '../utils/excelExport';
import { exportToWhatsApp, exportToImage } from '../utils/whatsappExport';

// تسجيل اللغة العربية لـ DatePicker
registerLocale('ar', ar);

// مفتاح التخزين المحلي لأنواع الإيرادات
const REVENUE_TYPES_STORAGE_KEY = 'revenueTypes_custom';

// الأنواع الافتراضية
const DEFAULT_REVENUE_TYPES = [
  { id: 'general', name: 'عام' },
  { id: 'special', name: 'مميز' },
  { id: 'postgraduate', name: 'دراسات عليا' },
  { id: 'other', name: 'أخرى' },
];

// تحميل أنواع الإيرادات من localStorage
const loadRevenueTypesForReport = () => {
  try {
    const saved = localStorage.getItem(REVENUE_TYPES_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('فشل تحميل أنواع الإيرادات في التقرير، استخدام الافتراضية.');
  }
  return DEFAULT_REVENUE_TYPES;
};

/**
 * مكون تقرير المتحصلات المنفصل
 */
export default function ReceiptsReport({ collections, items, funds, config, signatures, revenues, onBack }) {
  // دالة تحويل الأرقام إلى عربية
  const toArabicNumbers = (num) => {
    return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  };

  // حالة التصفية
  const [filterType, setFilterType] = useState('paymentDate'); // 'paymentDate', 'registrationDate', 'receiptNumber'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // حالات جديدة لكائنات التاريخ لـ DatePicker
  const [startDatePicker, setStartDatePicker] = useState(null);
  const [endDatePicker, setEndDatePicker] = useState(null);
  
  // حالات جديدة لنطاق أرقام الإيصالات
  const [startReceipt, setStartReceipt] = useState('');
  const [endReceipt, setEndReceipt] = useState('');
  
  const [selectedRevenue, setSelectedRevenue] = useState('all'); // 'all' أو id الإيراد المحدد
  const [revenueType, setRevenueType] = useState('all'); // 'all' أو نوع الإيراد (عام، مميز، إلخ)

  // تحميل أنواع الإيرادات
  const [revenueTypes] = useState(() => loadRevenueTypesForReport());

  // حالة إخفاء أعمدة البنود
  const [hideItemColumns, setHideItemColumns] = useState(false);

  // حالة إخفاء البنود غير المستخدمة
  const [hideUnusedItems, setHideUnusedItems] = useState(false);

  // حالة للواتساب داخل المعاينة
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  // دالة إعادة تعيين التصفية
  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setStartDatePicker(null);
    setEndDatePicker(null);
    setStartReceipt('');
    setEndReceipt('');
    setSelectedRevenue('all');
    setRevenueType('all');
    setHideItemColumns(false);
    setHideUnusedItems(false);
  };

  // مزامنة الحالة النصية مع كائنات الـ Picker عند التحميل أو التغيير
  useEffect(() => {
    if (startDate) {
      setStartDatePicker(new Date(startDate + 'T00:00:00'));
    } else {
      setStartDatePicker(null);
    }
  }, [startDate]);

  useEffect(() => {
    if (endDate) {
      setEndDatePicker(new Date(endDate + 'T00:00:00'));
    } else {
      setEndDatePicker(null);
    }
  }, [endDate]);

  // فلترة البيانات حسب التواريخ والإيراد والترتيب (من الأقدم للأحدث)
  const filteredCollections = useMemo(() => {
    let validCollections = collections.filter(c => c.receiptNumber && c.name);

    // فلترة حسب النوع المحدد
    if (revenueType !== 'all') {
      validCollections = validCollections.filter(collection => {
        const revenue = revenues.find(r => r.id === collection.selectedRevenueId);
        return revenue && revenue.type === revenueType;
      });
    }

    // فلترة حسب الإيراد المحدد
    if (selectedRevenue !== 'all') {
      validCollections = validCollections.filter(collection => {
        return collection.selectedRevenueId && collection.selectedRevenueId === selectedRevenue;
      });
    }

    // فلترة نطاق أرقام الإيصالات (يتكامل مع التصفية الزمنية)
    if (startReceipt || endReceipt) {
      validCollections = validCollections.filter(collection => {
        const receiptNum = Number(collection.receiptNumber);
        const startNum = Number(startReceipt);
        const endNum = Number(endReceipt);
        return (!startReceipt || !isNaN(receiptNum) && receiptNum >= startNum) &&
               (!endReceipt || !isNaN(receiptNum) && receiptNum <= endNum);
      });
    }

    // تطبيق الترتيب
    if (filterType === 'receiptNumber') {
      // ترتيب تصاعدي برقم الإيصال (أرقام حقيقية)
      validCollections = validCollections.sort((a, b) => {
        const numA = Number(a.receiptNumber) || 0;
        const numB = Number(b.receiptNumber) || 0;
        return numA - numB;
      });
    } else {
      // الترتيب الافتراضي حسب تاريخ السداد من الأقدم للأحدث
      validCollections = validCollections.sort((a, b) => {
        const dateA = new Date(a.paymentDate);
        const dateB = new Date(b.paymentDate);
        return dateA - dateB;
      });
    }

    if (!startDate && !endDate) return validCollections;

    return validCollections.filter(collection => {
      const dateToCheck = filterType === 'paymentDate' ? collection.paymentDate : collection.registrationDate;
      if (!dateToCheck) return false;

      // استخراج التاريخ بتنسيق YYYY-MM-DD من الكائن Date لضمان التوافق مع البيانات المخزنة مسبقاً
      const d = new Date(dateToCheck);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateOnly = `${year}-${month}-${day}`;

      if (startDate && dateOnly < startDate) return false;
      if (endDate && dateOnly > endDate) return false;

      return true;
    });
  }, [collections, filterType, startDate, endDate, startReceipt, endReceipt, selectedRevenue, revenueType, revenues]);

  // التحقق من وجود البيانات المطلوبة
  const hasRequiredData = useMemo(() => {
    return collections.some(collection =>
      collection.registrationDate &&
      collection.paymentDate &&
      collection.receiptNumber &&
      collection.name
    );
  }, [collections]);

  // حساب الإجماليات لكل بند
  const totals = useMemo(() => {
    const itemTotals = {};
    let grandTotal = 0;

    filteredCollections.forEach(collection => {
      if (collection.distribution && Array.isArray(collection.distribution)) {
        collection.distribution.forEach(dist => {
          const itemId = dist.itemId;
          const amount = dist.amount || 0;

          if (!itemTotals[itemId]) {
            itemTotals[itemId] = 0;
          }
          itemTotals[itemId] += amount;
          grandTotal += amount;
        });
      }
    });

    return { itemTotals, grandTotal };
  }, [filteredCollections]);

  // فلترة البنود المستخدمة فقط إذا كان الخيار مفعلاً
  const usedItems = useMemo(() => {
    if (!hideUnusedItems) return items;

    return items.filter(item => totals.itemTotals[item.id] > 0);
  }, [items, totals.itemTotals, hideUnusedItems]);

  // الحصول على اسم البند
  const getItemName = (itemId) => {
    const item = items.find(i => i.id === itemId);
    return item ? item.name : 'بند محذوف';
  };

// تنسيق التاريخ الموحد - بصيغة YYYY/MM/DD للاتجاه RTL مع أرقام عربية
  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const day = toArabicNumbers(String(d.getDate()).padStart(2, '0'));
    const month = toArabicNumbers(String(d.getMonth() + 1).padStart(2, '0'));
    const year = toArabicNumbers(d.getFullYear().toString());
    return `${year}/${month}/${day}`;
  };

  // حالة للمعاينة
  const [showPreview, setShowPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // دالة عرض التقرير
  const handleViewReport = () => {
    setShowPreview(true);
  };

  // دالة إغلاق المعاينة
  const handleClosePreview = () => {
    setShowPreview(false);
    setIsFullscreen(false);
    setShowWhatsAppModal(false);
    setPhoneNumber('');
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
    console.log('Exporting Excel with filteredCollections length:', filteredCollections.length);
    const data = [
      ...filteredCollections.map((collection, index) => {
        const rowTotal = (collection.distribution && Array.isArray(collection.distribution))
          ? collection.distribution.reduce((sum, dist) => sum + (dist.amount || 0), 0)
          : 0;

        const row = [
          index + 1,
          formatDate(collection.paymentDate),
          collection.receiptNumber || 'غير محدد',
          collection.name || 'غير محدد'
        ];

        if (!hideItemColumns) {
          items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach(item => {
            const dist = (collection.distribution && Array.isArray(collection.distribution))
              ? collection.distribution.find(d => d.itemId === item.id)
              : null;
            row.push(dist ? dist.amount : 0);
          });
        }

        row.push(rowTotal);
        return row;
      }),
      // إجماليات البنود
      ['', '', '', 'الإجمالي الكلي']
        .concat(
          !hideItemColumns
            ? items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => totals.itemTotals[item.id] || 0)
            : []
        )
        .concat(totals.grandTotal)
    ];

    console.log('data to export:', JSON.stringify(data));

    const headers = ['م', 'تاريخ السداد', 'رقم الإيصال', 'الاسم'];
    if (!hideItemColumns) {
      headers.push(...items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => item.name));
    }
    headers.push('الإجمالي');

    exportToExcel(data, headers, 'تقرير المتحصلات', reportPeriod, 'تقرير_المتحصلات');
  };

  // دالة حفظ كصورة
  const handleSaveAsImage = () => {
    // الحصول على عنصر التقرير
    const reportElement = document.querySelector('.report-content');
    if (!reportElement) {
      alert('لم يتم العثور على محتوى التقرير');
      return;
    }

    exportToImage(reportElement, 'تقرير المتحصلات', reportPeriod);
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
    const formattedNumber = phoneNumber.trim().startsWith('0')
      ? '+20' + phoneNumber.trim().substring(1)
      : phoneNumber.trim().startsWith('+20')
      ? phoneNumber.trim()
      : '+20' + phoneNumber.trim();

    exportToWhatsApp('تقرير المتحصلات: ' + reportPeriod, formattedNumber);
    setShowWhatsAppModal(false);
    setPhoneNumber('');
  };

  // دالة إلغاء إرسال عبر واتساب
  const handleCancelSendWhatsApp = () => {
    setShowWhatsAppModal(false);
    setPhoneNumber('');
  };

  // دالة تقسيم البيانات إلى صفحات (45 صف لكل صفحة)
  const paginateCollections = (collections) => {
    const rowsPerPage = 45;
    const pages = [];
    
    for (let i = 0; i < collections.length; i += rowsPerPage) {
      pages.push(collections.slice(i, i + rowsPerPage));
    }
    
    return pages.length > 0 ? pages : [[]];
  };

  // دالة الطباعة في نافذة منفصلة مع الحفاظ على التنسيق
  const handlePrintReportInNewWindow = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      alert('يرجى السماح بفتح النوافذ المنبثقة لطباعة التقرير.');
      return;
    }

    // حساب حجم الخط بناءً على عدد الأعمدة
    const numColumns = hideItemColumns ? 5 : 4 + items.length;
    let fontSize = 14;
    if (numColumns > 38) fontSize = 7;
    else if (numColumns > 32) fontSize = 7.5;
    else if (numColumns > 20) fontSize = 8;
    else if (numColumns > 15) fontSize = 9;
    else if (numColumns > 10) fontSize = 10.5;

    // تقسيم البيانات إلى صفحات
    const pages = paginateCollections(filteredCollections);

    // دالة إنشاء جدول صفحة واحدة
    const createPageHTML = (pageCollections, pageIndex) => {
      let tableHTML = `
        <table class="w-full border-collapse border border-black print-table">
          <thead>
            <tr class="bg-gray-100">
              <th class="border border-black px-1 py-2 text-center text-sm font-bold text-black col-num">م</th>
              <th class="border border-black px-2 py-2 text-right text-sm font-bold text-black col-date">تاريخ السداد</th>
              <th class="border border-black px-2 py-2 text-right text-sm font-bold text-black col-receipt">رقم الإيصال</th>
              <th class="border border-black px-2 py-2 text-right text-sm font-bold text-black col-name">الاسم</th>
              ${!hideItemColumns ? usedItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => 
                `<th class="border border-black px-2 py-2 text-center text-sm font-bold text-black">${item.name}</th>`
              ).join('') : ''}
              <th class="border border-black px-2 py-2 text-center text-sm font-bold text-black whitespace-nowrap">الإجمالي</th>
            </tr>
          </thead>
          <tbody>`;

      // إضافة صفوف البيانات للصفحة الحالية مع ترقيم يبدأ من رقم الصفحة * عدد الصفوف + 1
      const startIndex = pageIndex * 45;
      pageCollections.forEach((collection, idx) => {
          const rowNumber = startIndex + idx + 1;
        const rowTotal = (collection.distribution && Array.isArray(collection.distribution))
          ? collection.distribution.reduce((sum, dist) => sum + (dist.amount || 0), 0)
          : 0;

        tableHTML += `
          <tr>
            <td class="border border-black px-2 py-2 text-sm text-center text-black">${toArabicNumbers(rowNumber)}</td>
            <td class="border border-black px-2 py-2 text-sm text-right text-black col-date">${formatDate(collection.paymentDate)}</td>
            <td class="border border-black px-2 py-2 text-sm text-right text-black col-receipt">${toArabicNumbers(collection.receiptNumber || '٠٠٠')}</td>
            <td class="border border-black px-2 py-2 text-sm text-right text-black col-name">${collection.name || 'غير محدد'}</td>`;

        if (!hideItemColumns) {
          usedItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach(item => {
            const dist = collection.distribution && Array.isArray(collection.distribution)
              ? collection.distribution.find(d => d.itemId === item.id)
              : null;
            const amount = dist ? dist.amount.toFixed(2) : '0.00';
            tableHTML += `<td class="border border-black px-2 py-2 text-sm text-center text-black font-bold">${toArabicNumbers(amount)}</td>`;
          });
        }

        tableHTML += `
            <td class="border border-black px-2 py-2 text-sm font-bold text-center text-black whitespace-nowrap">${toArabicNumbers(rowTotal.toFixed(2))}</td>
          </tr>`;
      });

      // إضافة صف الإجمالي في نهاية الصفحة
      let totalRowTotal = 0;
      const pageItemTotals = {};
      
      pageCollections.forEach(collection => {
        if (collection.distribution && Array.isArray(collection.distribution)) {
          collection.distribution.forEach(dist => {
            if (!pageItemTotals[dist.itemId]) {
              pageItemTotals[dist.itemId] = 0;
            }
            pageItemTotals[dist.itemId] += dist.amount || 0;
            totalRowTotal += dist.amount || 0;
          });
        }
      });

      tableHTML += `<tfoot>
        <tr class="bg-gray-200">
          <td colspan="${hideItemColumns ? '4' : '4'}" class="border border-black px-2 py-2 text-sm font-bold text-right text-black">إجمالي الصفحة</td>`;

      if (!hideItemColumns) {
        usedItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach(item => {
          const amount = (pageItemTotals[item.id] || 0).toFixed(2);
          tableHTML += `<td class="border border-black px-2 py-2 text-sm font-bold text-center text-black">${toArabicNumbers(amount)}</td>`;
        });
      }

      tableHTML += `<td class="border border-black px-2 py-2 text-sm font-bold text-center text-black whitespace-nowrap">${toArabicNumbers(totalRowTotal.toFixed(2))}</td>
      </tr>
      </tfoot>
      </table>`;

      return tableHTML;
    };

    // بناء HTML الكامل مع الصفحات المتعددة
    let pagesHTML = '';
    const isLastPage = (index) => index === pages.length - 1;
    
    pages.forEach((pageCollections, pageIndex) => {
      const isLast = isLastPage(pageIndex);
      pagesHTML += `
        <div class="page-container" style="${!isLast ? 'page-break-after: always;' : ''} margin-bottom: 20px;">
          ${pageIndex === 0 ? `
            <div class="header text-center mb-4">
              <div class="logos flex justify-between items-center mb-2 mx-6">
                <div class="logo-container ml-4">
                  ${config.facultyLogo ? `<img src="${config.facultyLogo}" alt="شعار الكلية" class="w-20 h-20 object-contain" />` : '<div class="w-20 h-20 border border-gray-300 flex items-center justify-center text-sm text-gray-500">شعار الكلية</div>'}
                </div>
                <div class="text-center">
                  <div class="university-name text-xl font-bold text-black">${config.universityName || 'جامعة العريش'}</div>
                  <div class="faculty-name text-lg text-black">${config.facultyName || 'الإدارة العامة لنظم المعلومات والتحول الرقمي'}</div>
                </div>
                <div class="logo-container mr-4">
                  ${config.universityLogo ? `<img src="${config.universityLogo}" alt="شعار الجامعة" class="w-20 h-20 object-contain" />` : '<div class="w-20 h-20 border border-gray-300 flex items-center justify-center text-sm text-gray-500">شعار الجامعة</div>'}
                </div>
              </div>
              <hr class="separator" />
              <div class="report-title text-xl font-bold mb-2 text-black">تقرير الإيرادات والمتحصلات</div>
              <div class="report-period text-black">الفترة: ${reportPeriod}</div>
              <div class="print-date text-black mt-1">تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</div>
            </div>
          ` : `
            <div class="page-header text-center mb-4" style="page-break-inside: avoid;">
              <div class="report-title text-lg font-bold mb-2 text-black">تقرير الإيرادات والمتحصلات</div>
              <div class="report-period text-black">الفترة: ${reportPeriod}</div>
            </div>
          `}
          ${createPageHTML(pageCollections, pageIndex)}
          ${pageIndex === pages.length - 1 ? `
<table class="w-full border-collapse border border-black print-table mt-4 grand-total-table">
              <tfoot>
                <tr class="bg-gray-400">
                  <td colspan="${hideItemColumns ? '4' : '4'}" class="border border-black px-2 py-2 text-sm font-bold text-right text-black">أسماء البنود</td>
                  ${!hideItemColumns ? usedItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => {
                    return `<td class="border border-black px-2 py-2 text-sm font-bold text-center text-black">${item.name}</td>`;
                  }).join('') : ''}
                  <td class="border border-black px-2 py-2 text-sm font-bold text-center text-black whitespace-nowrap">الإجمالي</td>
                </tr>
                <tr class="bg-gray-300">
                  <td colspan="${hideItemColumns ? '4' : '4'}" class="border border-black px-2 py-3 text-sm font-bold text-right text-black">الإجمالي الكلي</td>
                  ${!hideItemColumns ? usedItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => {
                    const amount = (totals.itemTotals[item.id] || 0).toFixed(2);
                    return `<td class="border border-black px-2 py-3 text-sm font-bold text-center text-black">${toArabicNumbers(amount)}</td>`;
                  }).join('') : ''}
                  <td class="border border-black px-2 py-3 text-sm font-bold text-center text-black whitespace-nowrap">${toArabicNumbers(totals.grandTotal.toFixed(2))}</td>
                </tr>
              </tfoot>
            </table>
          ` : ''}
          ${pageIndex === pages.length - 1 && signatures && signatures.length > 0 ? `
            <div class="signatures-section mt-4 print-break-inside-avoid">
              <div class="flex justify-between items-start mt-4">
                ${signatures
                  .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                  .map((signature, index) => `
                    <div class="text-center flex-1">
                      <div class="border-t border-black pt-2">
                        <div class="signature-title text-black">${signature.title}</div>
                        <div class="signature-name text-black">${signature.name || 'ــــــــــــــــ'}</div>
                      </div>
                    </div>
                  `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    });

    // إنشاء HTML للطباعة مع تضمين أنماط Tailwind المبسطة
    const printHTML = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>تقرير الإيرادات والمتحصلات</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          @page {
            /* use A3 paper in landscape mode */
            size: A3 landscape;
            /* set minimal margins 0.5cm top/bottom, 1cm left/right */
            margin: 0.5cm 1cm;
          }
          @media print {
            body {
              width: 100%;
              height: 100%;
              font-family: 'Cairo', sans-serif;
            }
            .report-content { 
              font-size: ${fontSize}px;
              line-height: 1.2;
              width: 100%;
              font-family: 'Cairo', sans-serif;
            }
            .page-container {
              page-break-inside: avoid;
            }
          }
          body {
            font-family: 'Cairo', sans-serif;
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
            table-layout: ${hideItemColumns || hideUnusedItems ? 'auto' : 'fixed'};
            font-family: 'Cairo', sans-serif;
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
            font-family: 'Cairo', sans-serif;
          }
          .print-table td { 
            padding: 4px 2px;
            border: 1px solid black; 
            text-align: center;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: nowrap;
            vertical-align: middle;
            font-family: 'Cairo', sans-serif;
          }
          .print-table tfoot td {
            font-weight: bold;
          }
          .header { 
            page-break-inside: avoid; 
            margin-bottom: 6px;
            padding: 0;
          }
          .page-header {
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
          .col-num {
            width: 25px;
            max-width: 25px;
          }
          .col-name {
            width: ${hideItemColumns || hideUnusedItems ? 'auto' : '10%'};
            min-width: 70px;
          }
          .col-receipt {
            width: 65px;
            white-space: nowrap;
          }
          .col-date {
            width: 5%;
            min-width: 55px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .logos {
            margin-bottom: 4px;
          }
          /* prevent totals column from wrapping across lines */
          .print-table td:last-child, .print-table th:last-child {
            white-space: nowrap;
          }
          /* allow text wrapping for item names in grand total table */
          .grand-total-table td {
            white-space: normal !important;
            word-wrap: break-word;
            word-break: break-word;
          }
          /* footer with page number at bottom of every printed page */
          .page-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            font-size: ${fontSize}px;
          }
          @media print {
            .page-footer:after {
              content: 'صفحة ' counter(page);
            }
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
          .mb-4 {
            margin-bottom: 16px;
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
        </style>
      </head>
      <body>
        <div class="report-content">
          ${pagesHTML}
        </div>
        <div class="page-footer"></div>
      </body>
      </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();

    // انتظر قليلاً لتحميل الصور والعرض قبل الطباعة
    printWindow.onload = () => {
      setTimeout(() => {
        // حساب عدد الصفحات ديناميكياً
        const pageHeight = printWindow.innerHeight * 0.92;
        const contentHeight = printWindow.document.body.scrollHeight;
        const pageCount = Math.ceil(contentHeight / pageHeight);
        
        // إضافة أرقام الصفحات
        const pageFooters = printWindow.document.querySelectorAll('.page-footer');
        for (let i = 0; i < pageFooters.length; i++) {
          pageFooters[i].textContent = 'صفحة ' + (i + 1);
        }

        printWindow.focus();
        printWindow.print();
        // غلق النافذة بعد قليل حتى يتمكن المستخدم من معاينة الطباعة
        setTimeout(() => printWindow.close(), 100);
      }, 500);
    };
  };

  // حساب فترة التقرير
  const reportDate = formatDate(new Date());
  const reportPeriod = startDate && endDate
    ? `من ${formatDate(startDate)} إلى ${formatDate(endDate)}`
    : startDate
    ? `من ${formatDate(startDate)} إلى ${formatDate(new Date())}`
    : `حتى ${reportDate}`;

  // حساب عدد الأعمدة لتعديل حجم الخط في الطباعة
  const columnCount = hideItemColumns ? 5 : 4 + items.length; // تاريخ السداد، رقم الإيصال، الاسم، الإجمالي + البنود (إذا لم يتم إخفاؤها)

  return (
    <div className="space-y-6" dir="rtl">
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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">تقرير المتحصلات</h1>
      </div>

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
                  <div className="report-title text-xl font-bold mb-2 text-black">تقرير الإيرادات والمتحصلات</div>
                  <div className="report-period text-black">الفترة: {reportPeriod}</div>
                  <div className="print-date text-black mt-1">تاريخ الطباعة: {formatDate(new Date())}</div>
                </div>

                <table className="w-full border-collapse border border-black print-table">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black px-1 py-2 text-center text-sm font-bold text-black col-num">م</th>
                      <th className="border border-black px-2 py-2 text-right text-sm font-bold text-black col-date">تاريخ السداد</th>
                      <th className="border border-black px-2 py-2 text-right text-sm font-bold text-black col-receipt">رقم الإيصال</th>
                      <th className="border border-black px-2 py-2 text-right text-sm font-bold text-black col-name">الاسم</th>
                      {!hideItemColumns && usedItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => (
                        <th key={item.id} className="border border-black px-2 py-2 text-center text-sm font-bold text-black">{item.name}</th>
                      ))}
                      <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black whitespace-nowrap">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCollections.map((collection, index) => {
                      const rowTotal = (collection.distribution && Array.isArray(collection.distribution))
                        ? collection.distribution.reduce((sum, dist) => sum + (dist.amount || 0), 0)
                        : 0;

return (
                          <tr key={collection.id}>
                            <td className="border border-black px-2 py-2 text-sm text-center text-black col-num">{index + 1}</td>
                            <td className="border border-black px-2 py-2 text-sm text-right text-black col-date">{formatDate(collection.paymentDate)}</td>
                            <td className="border border-black px-2 py-2 text-sm text-right text-black col-receipt">{toArabicNumbers(collection.receiptNumber || '٠٠٠')}</td>
                            <td className="border border-black px-2 py-2 text-sm text-right text-black col-name">{collection.name || 'غير محدد'}</td>
                            {!hideItemColumns && usedItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => {
                              const dist = (collection.distribution && Array.isArray(collection.distribution))
                                ? collection.distribution.find(d => d.itemId === item.id)
                                : null;
                              return (
                                <td key={item.id} className="border border-black px-2 py-2 text-sm text-center text-black font-bold">
                                  {dist ? toArabicNumbers(dist.amount.toFixed(2)) : toArabicNumbers('0.00')}
                                </td>
                              );
                            })}
                            <td className="border border-black px-2 py-2 text-sm font-bold text-center text-black whitespace-nowrap">{toArabicNumbers(rowTotal.toFixed(2))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  {filteredCollections.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-200">
                        <td colSpan={hideItemColumns ? "4" : "4"} className="border border-black px-2 py-2 text-sm font-bold text-right text-black">الإجمالي الكلي</td>
                        {!hideItemColumns && usedItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => (
                          <td key={item.id} className="border border-black px-2 py-2 text-sm font-bold text-center text-black">
                            {toArabicNumbers((totals.itemTotals[item.id] || 0).toFixed(2))}
                          </td>
                        ))}
                        <td className="border border-black px-2 py-2 text-sm font-bold text-center text-black whitespace-nowrap">{toArabicNumbers(totals.grandTotal.toFixed(2))}</td>
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
                              <div className="signature-title text-black">{signature.title}</div>
                              {/* always render the name line; if name is missing it will simply be blank */}
                              <div className="signature-name text-black">{signature.name || 'ــــــــــــــــ'}</div>
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
                placeholder="أدخل رقم الهاتف (مثال: 201234567890)"
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
                <option value="receiptNumber">رقم الإيصال</option>
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
                  setStartDate(date ? format(date, 'yyyy-MM-dd') : '');
                }}
                dateFormat="dd/MM/yyyy"
                locale="ar"
                placeholderText="اختر تاريخ البدء"
                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm"
                wrapperClassName="w-full"
                isClearable={false}
                showPopperArrow={false}
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
                  setEndDate(date ? format(date, 'yyyy-MM-dd') : '');
                }}
                dateFormat="dd/MM/yyyy"
                locale="ar"
                placeholderText="اختر تاريخ الانتهاء"
                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm"
                wrapperClassName="w-full"
                isClearable={false}
                showPopperArrow={false}
              />
            </div>

            {/* حقول نطاق أرقام الإيصالات */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                من رقم إيصال
              </label>
              <input
                type="number"
                value={startReceipt}
                onChange={(e) => setStartReceipt(e.target.value)}
                placeholder="مثال: 100"
                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm"
                min="1"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                إلى رقم إيصال
              </label>
              <input
                type="number"
                value={endReceipt}
                onChange={(e) => setEndReceipt(e.target.value)}
                placeholder="مثال: 500"
                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm"
                min="1"
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
                نوع الإيراد
              </label>
              <select
                value={revenueType}
                onChange={(e) => setRevenueType(e.target.value)}
                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="all">الكل</option>
                {revenueTypes && revenueTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                الإيراد
              </label>
              <select
                value={selectedRevenue}
                onChange={(e) => setSelectedRevenue(e.target.value)}
                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="all">الكل</option>
                {revenues && revenues.map(revenue => (
                  <option key={revenue.id} value={revenue.id}>
                    {revenue.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* مجموعة خيارات العرض */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              خيارات العرض
            </h3>

            <div className="space-y-3">
              <button
                onClick={() => setHideItemColumns(!hideItemColumns)}
                className={`w-full h-10 px-3 py-2 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-2 ${
                  hideItemColumns
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                {hideItemColumns ? 'إظهار البنود' : 'إخفاء البنود'}
              </button>

              <button
                onClick={() => setHideUnusedItems(!hideUnusedItems)}
                className={`w-full h-10 px-3 py-2 rounded-md transition-colors text-sm font-medium flex items-center justify-center gap-2 ${
                  hideUnusedItems
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                </svg>
                {hideUnusedItems ? 'إظهار غير المستخدمة' : 'إخفاء غير المستخدمة'}
              </button>
            </div>
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

        {/* إحصائيات سريعة */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            عدد المتحصلات المعروضة: <strong>{filteredCollections.length}</strong>
          </p>
        </div>
      </div>

      {/* جدول البيانات */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                  تاريخ التسجيل
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                  تاريخ السداد
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                  رقم الإيصال
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                  الاسم
                </th>
                {/* أعمدة البنود الديناميكية */}
                {!hideItemColumns && usedItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => (
                  <th key={item.id} className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                    {item.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                  الإجمالي
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {filteredCollections.length === 0 ? (
                <tr>
                  <td colSpan={hideItemColumns ? 5 : 5 + items.length} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {hasRequiredData ? 'لا توجد بيانات متاحة' : 'لا توجد تحصيلات مسجلة بعد'}
                  </td>
                </tr>
              ) : (
                filteredCollections.map(collection => {
                  const rowTotal = (collection.distribution && Array.isArray(collection.distribution))
                    ? collection.distribution.reduce((sum, dist) => sum + (dist.amount || 0), 0)
                    : 0;

                  return (
                    <tr key={collection.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {formatDate(collection.registrationDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {formatDate(collection.paymentDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {toArabicNumbers(collection.receiptNumber || '٠٠٠')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {collection.name || 'غير محدد'}
                      </td>
                      {/* قيم البنود */}
                      {!hideItemColumns && usedItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => {
                        const dist = (collection.distribution && Array.isArray(collection.distribution))
                          ? collection.distribution.find(d => d.itemId === item.id)
                          : null;
                        return (
                          <td key={item.id} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center font-bold">
                            {dist ? toArabicNumbers(dist.amount.toFixed(2)) : toArabicNumbers('0.00')}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-sm font-bold text-green-600 dark:text-green-400 text-center whitespace-nowrap">
                        {toArabicNumbers(rowTotal.toFixed(2))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* صف الإجماليات */}
            {filteredCollections.length > 0 && (
              <tfoot className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200 text-right">
                    الإجمالي الكلي
                  </td>
                  {/* إجماليات البنود */}
                  {!hideItemColumns && usedItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => (
                    <td key={item.id} className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200 text-center">
                      {toArabicNumbers((totals.itemTotals[item.id] || 0).toFixed(2))}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200 text-center whitespace-nowrap">
                    {toArabicNumbers(totals.grandTotal.toFixed(2))}
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