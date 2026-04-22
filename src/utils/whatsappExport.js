import html2canvas from 'html2canvas';

/**
 * دالة حفظ التقرير كصورة JPEG مع هوامش بيضاء
 * @param {HTMLElement} element - العنصر المراد تصويره
 * @param {string} reportTitle - عنوان التقرير
 * @param {string} reportPeriod - فترة التقرير
 */
export const exportToImage = async (element, reportTitle, reportPeriod) => {
  try {
    // التقاط الصورة
    const canvas = await html2canvas(element, {
      scale: 2, // جودة عالية
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });

    // إضافة هوامش بيضاء
    const margin = 40; // هوامش 40 بكسل
    const newCanvas = document.createElement('canvas');
    const ctx = newCanvas.getContext('2d');
    newCanvas.width = canvas.width + margin * 2;
    newCanvas.height = canvas.height + margin * 2;

    // ملء الخلفية باللون الأبيض
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);

    // رسم الصورة الأصلية مع الهوامش
    ctx.drawImage(canvas, margin, margin);

    // تحويل إلى blob كـ JPEG
    newCanvas.toBlob((blob) => {
      if (!blob) {
        alert('حدث خطأ في إنشاء الصورة');
        return;
      }

      // حفظ الصورة محلياً للمستخدم
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.9);

  } catch (error) {
    console.error('خطأ في حفظ الصورة:', error);
    alert('حدث خطأ أثناء حفظ الصورة. يرجى المحاولة مرة أخرى.');
  }
};

/**
 * دالة إرسال التقرير عبر واتساب (الرسالة النصية فقط)
 * @param {string} message - الرسالة المراد إرسالها
 * @param {string} phoneNumber - رقم الهاتف
 */
export const exportToWhatsApp = (message, phoneNumber) => {
  // إزالة الرمز + من رقم الهاتف للتوافق مع wa.me
  const cleanPhoneNumber = phoneNumber.replace(/\+/g, '');

  // إنشاء رابط واتساب
  const whatsappUrl = `https://wa.me/${cleanPhoneNumber}?text=${encodeURIComponent(message)}`;

  // فتح واتساب في نافذة جديدة
  const whatsappWindow = window.open(whatsappUrl, '_blank');

  // إشعار المستخدم
  alert('تم فتح واتساب مع الرسالة. يرجى إرفاق الصورة يدوياً إذا لزم الأمر والضغط على إرسال.');
};

/**
 * دالة التحقق من صحة رقم الهاتف
 * @param {string} phoneNumber - رقم الهاتف
 * @returns {boolean} صحة الرقم
 */
export const validatePhoneNumber = (phoneNumber) => {
  // إزالة المسافات والرموز
  const cleanNumber = phoneNumber.replace(/\s+|-|\(|\)/g, '');

  // التحقق من رقم الهاتف المصري (يبدأ بـ 01 ثم 0-2 أو 5 ثم 8 أرقام)
  const phoneRegex = /^(\+20|0)?1[0-25][0-9]{8}$/;

  return phoneRegex.test(cleanNumber);
};

/**
 * دالة طلب رقم الهاتف من المستخدم
 * @returns {string|null} رقم الهاتف أو null إذا تم الإلغاء
 */
export const promptPhoneNumber = () => {
  let phoneNumber = '';
  let isValid = false;

  while (!isValid) {
    phoneNumber = prompt('يرجى إدخال رقم الهاتف (مثال: 01234567890):', '');

    if (phoneNumber === null) {
      // تم الإلغاء
      return null;
    }

    if (phoneNumber.trim() === '') {
      alert('يرجى إدخال رقم الهاتف.');
      continue;
    }

    // تنظيف الرقم
    phoneNumber = phoneNumber.trim();

    // إضافة +20 إذا لم يكن موجوداً
    if (!phoneNumber.startsWith('+')) {
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '+20' + phoneNumber.substring(1);
      } else {
        phoneNumber = '+20' + phoneNumber;
      }
    }

    if (validatePhoneNumber(phoneNumber)) {
      isValid = true;
    } else {
      alert('رقم الهاتف غير صحيح. يرجى إدخال رقم صحيح.');
    }
  }

  return phoneNumber;
};
