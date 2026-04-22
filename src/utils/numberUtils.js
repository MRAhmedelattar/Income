/**
 * أدوات معالجة الأرقام - توافق كامل مع الإعدادات الإقليمية
 * Handles both English (.) and Arabic (,) decimal separators
 */

/**
 * تحويل آمن للأرقام من أي صيغة إلى Float
 * يتعامل مع:
 * - صيغة عربية: "1,5" -> 1.5
 * - صيغة إنجليزية: "1.5" -> 1.5
 * - أرقام صحيحة: "100" -> 100
 * - نصوص فارغة وnull -> 0
 * 
 * @param {string|number} value - القيمة المراد تحويلها
 * @returns {number} الرقم المحول أو 0 إذا فشل التحويل
 */
export const parseLocaleNumber = (value) => {
  // التعامل مع null و undefined
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  // إذا كان الرقم بالفعل number
  if (typeof value === 'number') {
    return isFinite(value) ? value : 0;
  }

  // تحويل إلى نص وإزالة المسافات
  const stringValue = String(value).trim();

  // إذا كان النص فارغاً
  if (stringValue === '' || stringValue === 'NaN') {
    return 0;
  }

  // استبدال الفاصلة العربية بنقطة عشرية
  const normalizedValue = stringValue.replace(/,/g, '.');

  // محاولة التحويل إلى رقم
  const num = parseFloat(normalizedValue);

  // التحقق من أن النتيجة رقم صحيح (valid)
  if (isFinite(num)) {
    return num;
  }

  // في حالة الفشل
  console.warn(`⚠️ Failed to parse number: "${value}"`, { stringValue, normalizedValue });
  return 0;
};

/**
 * تحويل آمن للأرقام مع معالجة خاصة للكميات والمبالغ
 * - يتأكد من أن القيمة موجبة أو صفر
 * - يتعامل مع أخطاء الإدخال بشكل آمن
 * 
 * @param {string|number} value - القيمة المراد تحويلها
 * @param {number} minValue - القيمة الدنيا (default: 0)
 * @param {number} maxValue - القيمة العليا (default: Infinity)
 * @returns {number} الرقم المحول ضمن النطاق المحدد
 */
export const normalizeAmount = (value, minValue = 0, maxValue = Infinity) => {
  const num = parseLocaleNumber(value);

  // التأكد من أن الرقم ضمن النطاق
  if (num < minValue) return minValue;
  if (num > maxValue) return maxValue;

  return num;
};

/**
 * تحويل الرقم إلى صيغة محلية للعرض
 * - يستخدم الإعداد الإقليمي للجهاز
 * - يدعم عدد محدد من المنازل العشرية
 * 
 * @param {number} value - الرقم المراد تحويله
 * @param {number} decimals - عدد المنازل العشرية (default: 2)
 * @returns {string} الرقم بصيغة محلية
 */
export const formatLocaleNumber = (value, decimals = 2) => {
  const num = parseLocaleNumber(value);
  
  try {
    // استخدام Intl.NumberFormat لتنسيق حسب الإعداد الإقليمي
    return new Intl.NumberFormat(navigator.language || 'en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch (error) {
    console.warn('Error formatting number:', error);
    // fallback بسيط
    return num.toFixed(decimals);
  }
};

/**
 * تحويل القيمة للحفظ في قاعدة البيانات
 * - تأكد من أن الرقم صا لح للحفظ
 * - يزيل أي قيم غير صالحة
 * 
 * @param {string|number} value - القيمة المراد تحويلها
 * @returns {number} الرقم الآمن للحفظ
 */
export const normalizeForStorage = (value) => {
  const num = parseLocaleNumber(value);
  
  // التأكد من أن الرقم ليس Infinity أو NaN
  if (!isFinite(num)) {
    console.warn(`⚠️ Invalid number for storage: "${value}"`);
    return 0;
  }

  return num;
};

/**
 * التحقق من أن القيمة رقم صحيح
 * 
 * @param {any} value - القيمة المراد التحقق منها
 * @returns {boolean} true إذا كانت قيمة صحيحة
 */
export const isValidNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return false;
  }

  const num = parseLocaleNumber(value);
  return isFinite(num) && num !== 0;
};

/**
 * مقارنة رقمين مع التسامح (tolerance)
 * مفيد للتحقق من القيم بعد التحويل
 * 
 * @param {any} a - الرقم الأول
 * @param {any} b - الرقم الثاني
 * @param {number} tolerance - مسافة التسامح (default: 0.0001)
 * @returns {boolean} true إذا كانت الأرقام متقاربة
 */
export const areNumbersEqual = (a, b, tolerance = 0.0001) => {
  const numA = parseLocaleNumber(a);
  const numB = parseLocaleNumber(b);
  return Math.abs(numA - numB) < tolerance;
};

/**
 * تحويل كائن يحتوي على أرقام (مثل itemValues)
 * يحول جميع القيم بشكل آمن
 * 
 * @param {Object} obj - الكائن يحتوي على الأرقام
 * @returns {Object} كائن جديد بأرقام محولة
 */
export const normalizeNumberObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return {};
  }

  const normalized = {};
  for (const [key, value] of Object.entries(obj)) {
    // تقريب إلى رقمين عشريين قبل التخزين
    const num = parseLocaleNumber(value);
    normalized[key] = Number(Math.round(num * 100) / 100);
  }

  return normalized;
};

export default {
  parseLocaleNumber,
  normalizeAmount,
  formatLocaleNumber,
  normalizeForStorage,
  isValidNumber,
  areNumbersEqual,
  normalizeNumberObject,
};
