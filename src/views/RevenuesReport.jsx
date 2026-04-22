// src/components/settings/RevenuesReport.jsx
import React, { useState, useMemo, useEffect } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import ar from 'date-fns/locale/ar';

registerLocale('ar', ar);

import { exportToExcel } from '../utils/excelExport';
import { exportToWhatsApp, exportToImage } from '../utils/whatsappExport';

// مفتاح التخزين المحلي لأنواع الإيرادات
const REVENUE_TYPES_STORAGE_KEY = 'revenueTypes_custom';

// الأنواع الافتراضية (يجب أن تكون متطابقة مع RevenueManagement)
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

// دالة تحويل الأرقام إلى عربية
const toArabicNumbers = (num) => {
    return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
};

// دالة تنسيق رقم الهاتف المصري
const formatPhoneNumber = (phoneNumber) => {
    const cleanNumber = phoneNumber.replace(/\s+|-|\(|\)/g, '');
    if (cleanNumber.startsWith('0')) {
        return '+20' + cleanNumber.substring(1);
    } else {
        return '+20' + cleanNumber;
    }
};

/**
 * مكون تقرير الإيرادات
 */
export default function RevenuesReport({ collections, items, revenues, config, signatures, onRefresh }) {
    // تحديث البيانات عند الدخول للتقرير
    useEffect(() => {
        if (onRefresh) {
            onRefresh();
        }
    }, []); // مصفوفة تبعية فارغة ليعمل مرة واحدة عند التحميل

    // حالة التصفية
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [startDatePicker, setStartDatePicker] = useState(null);
    const [endDatePicker, setEndDatePicker] = useState(null);
    const [revenueType, setRevenueType] = useState('all');
    const [hideTypeColumn, setHideTypeColumn] = useState(false);

    // ⚠️ جديدة: تحميل أنواع الإيرادات من localStorage
    const [revenueTypes, setRevenueTypes] = useState(() => loadRevenueTypesForReport());

// دالة التنسيق الموحدة
    const formatDate = (date) => {
      if (!date) return '-';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // دالة إعادة تعيين التصفية
    const resetFilters = () => {
        setStartDate('');
        setEndDate('');
        setStartDatePicker(null);
        setEndDatePicker(null);
        setRevenueType('all');
        setHideTypeColumn(false);
    };

    // فلترة الإيرادات حسب النوع فقط (بدون التاريخ لأن التاريخ يتم فلترته من التحصيلات)
    const filteredRevenues = useMemo(() => {
        return revenues.filter(revenue => {
            if (revenueType !== 'all') {
                if (revenue.type !== revenueType) return false;
            }
            return true;
        });
    }, [revenues, revenueType]);

    // فلترة التحصيلات حسب التاريخ
    const filteredCollections = useMemo(() => {
        if (!startDate && !endDate) return collections;

        return collections.filter(collection => {
            const collDateStrFull = collection.paymentDate;
            if (!collDateStrFull) return true;

            const collectionDate = new Date(collDateStrFull);
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

    // حساب المبالغ من التحصيلات الفعلية
    const revenueData = useMemo(() => {
        const revenueMap = new Map();

        filteredRevenues.forEach(rev => {
            revenueMap.set(rev.id, {
                id: rev.id,
                title: rev.title,
                type: rev.type,
                totalAmount: 0,
                count: 0
            });
        });

        filteredCollections.forEach(collection => {
            if (!collection.distribution || !Array.isArray(collection.distribution) || !collection.selectedRevenueId) return;

            if (revenueMap.has(collection.selectedRevenueId)) {
                const revData = revenueMap.get(collection.selectedRevenueId);
                revData.count += 1;
                const totalForThisCollection = collection.distribution.reduce((sum, dist) => sum + (dist.amount || 0), 0);
                revData.totalAmount += totalForThisCollection;
            }
        });

        return Array.from(revenueMap.values());
    }, [filteredRevenues, filteredCollections]);

    // حساب الإجماليات
    const totals = useMemo(() => {
        let totalAmount = 0;
        let totalCount = 0;
        revenueData.forEach(rev => {
            totalAmount += rev.totalAmount;
            totalCount += rev.count;
        });
        return { totalAmount, totalCount };
    }, [revenueData]);

    // دالة للحصول على اسم النوع لعرضه
    const getTypeDisplayName = (typeId) => {
        const type = revenueTypes.find(t => t.id === typeId);
        return type ? type.name : typeId;
    };

    // تحديث قائمة أنواع الإيرادات عند التحميل (مهم إذا تم تعديلها خارج هذا المكون)
    useEffect(() => {
        const handleStorageChange = () => {
            setRevenueTypes(loadRevenueTypesForReport());
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // مزامنة الحالة النصية مع DatePicker عند التحميل
    useEffect(() => {
        if (startDate && !startDatePicker) {
            setStartDatePicker(startDate ? new Date(startDate + 'T00:00:00') : null);
        }
        if (endDate && !endDatePicker) {
            setEndDatePicker(endDate ? new Date(endDate + 'T00:00:00') : null);
        }
    }, []);

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
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');

    // دوال العرض والتصدير (بدون تغيير منطقي)
    const handleViewReport = () => setShowPreview(true);
    const handleClosePreview = () => {
        setShowPreview(false);
        setIsFullscreen(false);
    };
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.log(err));
        } else {
            document.exitFullscreen();
        }
        setIsFullscreen(!isFullscreen);
    };

    const handleExportExcel = () => {
        const data = [
            ...revenueData.map((rev, index) => [
                index + 1,
                rev.title,
                !hideTypeColumn ? getTypeDisplayName(rev.type) : undefined,
                rev.count,
                rev.totalAmount
            ].filter(item => item !== undefined)),
            ['', hideTypeColumn ? 'الإجمالي الكلي' : '', hideTypeColumn ? '' : 'الإجمالي الكلي', totals.totalCount, totals.totalAmount]
        ];

        const headers = ['م', 'اسم مصدر الإيراد'];
        if (!hideTypeColumn) headers.push('النوع');
        headers.push('العدد', 'القيمة');

        exportToExcel(data, headers, 'تقرير الإيرادات', reportPeriod, 'تقرير_الإيرادات');
    };

    const handleOpenWhatsAppModal = () => setShowWhatsAppModal(true);

    const handleWhatsAppExport = () => {
        if (!phoneNumber.trim()) {
            alert('يرجى إدخال رقم الهاتف.');
            return;
        }

        const cleanNumber = phoneNumber.replace(/\s+|-|\(|\)/g, '');
        const phoneRegex = /^(\+20|0)?1[0-2,5][0-9]{8}$/;
        if (!phoneRegex.test(cleanNumber)) {
            alert('رقم الهاتف غير صحيح. يرجى إدخال رقم صحيح.');
            return;
        }

        let formattedNumber = cleanNumber;
        if (!formattedNumber.startsWith('+')) {
            formattedNumber = formattedNumber.startsWith('0')
                ? '+20' + formattedNumber.substring(1)
                : '+20' + formattedNumber;
        }

        const reportText = `تقرير الإيرادات\nالفترة: ${reportPeriod}\n\n${revenueData.map((rev, index) => `${index + 1}. ${rev.title} - العدد: ${rev.count} - القيمة: ${rev.totalAmount.toFixed(2)}`).join('\n')}\n\nالإجمالي الكلي - العدد: ${totals.totalCount} - القيمة: ${totals.totalAmount.toFixed(2)}`;
        exportToWhatsApp(reportText, formattedNumber);

        setShowWhatsAppModal(false);
        setPhoneNumber('');
    };

    const handleExportImage = () => {
        const element = document.querySelector('.report-content');
        if (element) exportToImage(element, 'تقرير_الإيرادات');
    };

    const handlePrintReportInNewWindow = () => {
        const printWindow = window.open('', '_blank', 'width=1000,height=800');
        if (!printWindow) {
            alert('يرجى السماح بفتح النوافذ المنبثقة لطباعة التقرير.');
            return;
        }

        // تنسيق الطباعة (تم الحفاظ على الكود الأصلي هنا كما هو)
        const printContent = document.querySelector('.print-content').cloneNode(true);

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
                'hover:bg-gray-50': '',
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
                'logos': 'display: flex; justify-content: space-between; align-items: center;',
                'signatures-container': 'display: flex; justify-content: space-between; width: 100%;',
                'signature-item': 'flex: 1; text-align: center;'
            };

            const classes = element.className.split(' ').filter(cls => cls);
            let inlineStyle = '';
            classes.forEach(cls => {
                if (classToStyleMap[cls]) {
                    inlineStyle += classToStyleMap[cls];
                }
            });
            if (inlineStyle) {
                element.style.cssText += inlineStyle;
            }

            Array.from(element.children).forEach(child => applyInlineStyles(child));
        };

        applyInlineStyles(printContent);

        const printHTML = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>تقرير الإيرادات</title>
        <style>
          @media print {
            @page {
              size: A4 portrait;
              margin: 1.5cm;
            }
            body {
              font-family: 'Cairo', 'Arial', sans-serif;
              direction: rtl;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0.5cm !important;
            }
            .report-content { 
              font-size: 10px; 
              width: 100%;
              height: auto !important;
              overflow: visible !important;
            }
            .logo-container img { width: 60px; height: 60px; object-fit: contain; }
            .print-table {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid black;
              margin: 10px 0;
              font-size: 12px;
            }
            .print-table th {
              padding: 6px 4px;
              border: 1px solid black;
              text-align: center;
              font-weight: bold;
              background-color: #f3f4f6;
              font-size: 12px;
              word-wrap: break-word;
            }
            .print-table td {
              padding: 6px 4px;
              border: 1px solid black;
              text-align: center;
              font-size: 11px;
              word-wrap: break-word;
            }
            .header { page-break-inside: avoid; margin-bottom: 10px; }
            .print-break-inside-avoid { page-break-inside: avoid; }
            thead { display: table-header-group !important; }
            tfoot { display: table-row-group !important; }
            tr { page-break-inside: avoid; }
            .signatures-section { page-break-inside: avoid; }
            .logos { display: flex; justify-content: space-between; align-items: center; }
            .signatures-container { display: flex; justify-content: space-between; width: 100%; }
            .signature-item { flex: 1; text-align: center; }
          }
          /* Ensure explicit CSS is applied even without print media query initially for the popup */
          .logos { display: flex; justify-content: space-between; align-items: center; }
          .signatures-container { display: flex; justify-content: space-between; width: 100%; }
          .signature-item { flex: 1; text-align: center; }
          thead { display: table-header-group !important; }
          tr { page-break-inside: avoid; }
          .signatures-section { page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="report-content">
          ${printContent.outerHTML}
        </div>
      </body>
      </html>
    `;

        printWindow.document.open();
        printWindow.document.write(printHTML);
        printWindow.document.close();

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
                <div className={`fixed inset-0 bg-black bg-opacity-50 z-[9999] ${isFullscreen ? '' : 'flex items-center justify-center'} ${isFullscreen ? 'p-0' : ''} print:hidden`}>
                    <div className={`bg-white rounded-lg shadow-xl ${isFullscreen ? 'w-full h-full max-w-none max-h-none' : 'max-w-4xl w-full mx-4 max-h-[90vh]'} overflow-hidden print:w-full print:h-full print:max-w-none print:max-h-none print:rounded-none`}>
                        <div className="flex justify-between items-center p-4 border-b print:hidden">
                            <h2 className="text-xl font-bold">معاينة التقرير</h2>
                            <div className="flex gap-2">
                                <button onClick={toggleFullscreen} className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isFullscreen ? "M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" : "M21 3H3v18h18V3zM9 9h6m-6 4h6m-6 4h6"}></path>
                                    </svg>
                                    {isFullscreen ? 'تصغير' : 'تكبير'}
                                </button>
                                <button onClick={handlePrintReportInNewWindow} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                                    طباعة
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                </button>
                                <button onClick={handleExportImage} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                    </svg>
                                    حفظ كصورة
                                </button>
                                <button onClick={handleOpenWhatsAppModal} className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                                    </svg>
                                    ارسال عبر واتساب
                                </button>
                                <button onClick={handleClosePreview} className="text-gray-500 hover:text-gray-700">
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
                                    <div className="report-title text-xl font-bold mb-2 text-black">تقرير الإيرادات</div>
                                    <div className="report-period text-sm text-black">الفترة: {reportPeriod}</div>
                                    <div className="print-date text-xs text-black mt-1">تاريخ الطباعة: {formatDate(new Date())} {new Date().toLocaleTimeString('ar-EG')}</div>
                                </div>

                                <table className="w-full border-collapse border border-black print-table">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">م</th>
                                            <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">اسم مصدر الإيراد</th>
                                            {!hideTypeColumn && (
                                                <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">النوع</th>
                                            )}
                                            <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">العدد</th>
                                            <th className="border border-black px-2 py-2 text-center text-sm font-bold text-black">القيمة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {revenueData.map((rev, index) => (
                                            <tr key={rev.id}>
                                                <td className="border border-black px-2 py-2 text-sm text-center text-black">{index + 1}</td>
                                                <td className="border border-black px-2 py-2 text-sm text-center text-black">{rev.title}</td>
                                                {!hideTypeColumn && (
                                                    <td className="border border-black px-2 py-2 text-sm text-center text-black">
                                                        {getTypeDisplayName(rev.type)}
                                                    </td>
                                                )}
                                                <td className="border border-black px-2 py-2 text-sm text-center text-black">{toArabicNumbers(rev.count.toString())}</td>
                                                <td className="border border-black px-2 py-2 text-sm text-center text-black">{toArabicNumbers(rev.totalAmount.toFixed(2))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {revenueData.length > 0 && (
                                        <tfoot>
                                            <tr className="bg-gray-200">
                                                <td colSpan={hideTypeColumn ? "2" : "3"} className="border border-black px-2 py-2 text-sm font-bold text-center text-black">الإجمالي الكلي</td>
                                                <td className="border border-black px-2 py-2 text-sm font-bold text-center text-black">{toArabicNumbers(totals.totalCount)}</td>
                                                <td className="border border-black px-2 py-2 text-sm font-bold text-center text-black">{toArabicNumbers(totals.totalAmount.toFixed(2))}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>

                                {signatures && signatures.length > 0 && (
                                    <div className="signatures-section mt-4 print-break-inside-avoid">
                                        <div className="signatures-container flex justify-between items-start mt-4">
                                            {signatures
                                                .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                                                .map((signature, index) => (
                                                    <div key={signature.id} className="signature-item text-center flex-1">
                                                        <div className="border-t border-black pt-2">
                                                            <div className="font-bold text-sm text-black">{signature.title}</div>
                                                            {signature.name && (
                                                                <div className="text-sm mt-1 text-black">{signature.name}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-center gap-4 mb-4">
                <button onClick={handleViewReport} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                    عرض التقرير
                </button>
                <button onClick={handleExportExcel} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    تصدير Excel
                </button>
            </div>

            <div className="flex justify-center items-center">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">تقرير الإيرادات</h1>
            </div>

            {/* قسم التصفية */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
                    تصفية البيانات
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="relative z-[50]">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                            className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                            placeholderText="اختر تاريخ البداية"
                        />
                    </div>

                    <div className="relative z-[50]">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                            className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                            placeholderText="اختر تاريخ النهاية"
                        />
                    </div>

                    <div className="flex flex-col h-full justify-end">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            نوع الإيراد
                        </label>
                        <select
                            value={revenueType}
                            onChange={(e) => setRevenueType(e.target.value)}
                            className="flex-1 p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">الكل</option>
                            {revenueTypes.map(type => (
                                <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={() => setHideTypeColumn(!hideTypeColumn)}
                            className={`w-full px-4 py-2 rounded-md transition-colors ${
                                hideTypeColumn
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : 'bg-orange-500 text-white hover:bg-orange-600'
                            }`}
                        >
                            {hideTypeColumn ? 'إظهار النوع' : 'إخفاء النوع'}
                        </button>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={resetFilters}
                            className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                        >
                            إعادة تعيين
                        </button>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-md">
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                        <span className="font-medium">عدد مصادر الإيرادات:</span> {revenueData.length}
                    </div>
                </div>
            </div>

            {/* جدول البيانات */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                                    م
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                                    اسم مصدر الإيراد
                                </th>
                                {!hideTypeColumn && (
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                                        النوع
                                    </th>
                                )}
                                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                                    العدد
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                                    القيمة
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                            {revenueData.length === 0 ? (
                                <tr>
                                    <td colSpan={hideTypeColumn ? "3" : "4"} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                        لا توجد بيانات متاحة
                                    </td>
                                </tr>
                            ) : (
                                revenueData.map((rev, index) => (
                                    <tr key={rev.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                                            {rev.title}
                                        </td>
                                        {!hideTypeColumn && (
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                                                {getTypeDisplayName(rev.type)}
                                            </td>
                                        )}
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                                            {rev.count}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                                            {rev.totalAmount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {revenueData.length > 0 && (
                            <tfoot className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20">
                                <tr>
                                    <td colSpan={hideTypeColumn ? "2" : "3"} className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200 text-center">
                                        الإجمالي الكلي
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200 text-center">
                                        {totals.totalCount}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold text-blue-800 dark:text-blue-200 text-center">
                                        {totals.totalAmount.toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* مودال واتساب */}
            {showWhatsAppModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold mb-4">إرسال عبر واتساب</h3>
                        <input
                            type="text"
                            placeholder="أدخل رقم الهاتف (مثال: 01234567890)"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full p-2 border rounded-md mb-4"
                        />
                        <div className="flex gap-2">
                            <button onClick={handleWhatsAppExport} className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">
                                إرسال
                            </button>
                            <button onClick={() => setShowWhatsAppModal(false)} className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}