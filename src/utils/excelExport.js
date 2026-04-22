import * as XLSX from 'xlsx';

/**
 * دالة تصدير البيانات إلى Excel
 * @param {Array} data - البيانات المراد تصديرها
 * @param {Array} headers - عناوين الأعمدة
 * @param {string} reportTitle - عنوان التقرير
 * @param {string} reportPeriod - فترة التقرير
 * @param {string} fileName - اسم الملف (اختياري)
 */
export const exportToExcel = (data, headers, reportTitle, reportPeriod, fileName = null) => {
  try {
    console.log('Exporting to Excel with data:', JSON.stringify(data));
    console.log('Headers:', headers);
    console.log('Report Title:', reportTitle);
    console.log('Report Period:', reportPeriod);

    // إنشاء مصنف Excel جديد
    const wb = XLSX.utils.book_new();

    // إنشاء ورقة واحدة تحتوي على المعلومات والبيانات
    const fullData = [
      [reportTitle], // صف العنوان
      ['الفترة: ' + reportPeriod], // صف الفترة
      ['تاريخ التصدير: ' + new Date().toLocaleString('ar-EG')], // صف تاريخ التصدير
      [], // صف فارغ
      headers, // عناوين الأعمدة
      ...data // البيانات
    ];

    const ws = XLSX.utils.aoa_to_sheet(fullData);

    // تنسيق العنوان (الصف الأول)
    const titleCell = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (ws[titleCell]) {
      ws[titleCell].s = {
        font: { bold: true, sz: 14 },
        alignment: { horizontal: "center" }
      };
    }

    // تنسيق الفترة والتاريخ
    for (let r = 1; r <= 2; r++) {
      const cell = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[cell]) {
        ws[cell].s = {
          font: { sz: 12 },
          alignment: { horizontal: "right" }
        };
      }
    }

    // تنسيق عناوين الأعمدة (الصف الخامس - index 4)
    const headerRow = 4;
    for (let col = 0; col < headers.length; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "CCCCCC" } },
          alignment: { horizontal: "center" }
        };
      }
    }

    // دمج الخلايا للعنوان (يمتد على جميع الأعمدة)
    const mergeRange = { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } };
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push(mergeRange);

    // تعيين اتجاه الورقة من اليمين لليسار
    ws['!rightToLeft'] = true;

    // تعيين عرض الأعمدة تلقائياً
    const colWidths = headers.map(header => ({ wch: Math.max(header.length * 2, 15) }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'تقرير الموازنة');

    // حفظ الملف
    const baseFileName = fileName || `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
    const finalFileName = baseFileName.endsWith('.xlsx') ? baseFileName : `${baseFileName}.xlsx`;
    XLSX.writeFile(wb, finalFileName);

    console.log('Excel file exported successfully:', finalFileName);
    return true;
  } catch (error) {
    console.error('خطأ في تصدير Excel:', error);
    alert('حدث خطأ أثناء تصدير الملف. يرجى المحاولة مرة أخرى.');
    return false;
  }
};

/**
 * تحويل الأرقام إلى عربية للتصدير
 * @param {number} num - الرقم
 * @returns {string} الرقم بالأرقام العربية
 */
export const toArabicNumbersForExcel = (num) => {
  return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
};

/**
 * تنسيق التاريخ للتصدير
 * @param {string} dateString - سلسلة التاريخ
 * @returns {string} التاريخ منسق
 */
export const formatDateForExcel = (dateString) => {
  if (!dateString) return 'غير محدد';
  return new Date(dateString).toLocaleDateString('ar-EG');
};
