export type Locale = 'en' | 'fa';

export const DEFAULT_LOCALE: Locale = 'en';

export const dictionaries = {
  en: {
    nav: { home: 'Home', projects: 'Projects', dashboard: 'Dashboard', createProject: 'Create Project' },
    home: {
      badge: 'Used by real estate professionals building immersive launch experiences.',
      title: 'Everything your sales team needs'
    },
    admin: {
      loginTitle: 'Admin Login',
      email: 'Email',
      password: 'Password',
      signIn: 'Sign in',
      dashboard: 'Admin Dashboard',
      properties: 'Properties',
      create: 'Create Property',
      logout: 'Logout',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      gallery: 'Gallery Images',
      aerial: 'Aerial Images'
    },
    property: {
      showcase: 'Property Showcase',
      openLink: 'Open direct link',
      gallery: 'Image Gallery',
      map: 'Map Location',
      qr: 'QR Code',
      downloadQr: 'Download QR'
    }
  },
  fa: {
    nav: { home: 'خانه', projects: 'پروژه‌ها', dashboard: 'داشبورد', createProject: 'ایجاد پروژه' },
    home: {
      badge: 'مورد استفاده تیم‌های فروش املاک برای تجربه سه‌بعدی تعاملی.',
      title: 'همه چیز برای تیم فروش شما'
    },
    admin: {
      loginTitle: 'ورود مدیر',
      email: 'ایمیل',
      password: 'رمز عبور',
      signIn: 'ورود',
      dashboard: 'داشبورد مدیریت',
      properties: 'املاک',
      create: 'ایجاد ملک',
      logout: 'خروج',
      save: 'ذخیره',
      delete: 'حذف',
      edit: 'ویرایش',
      gallery: 'تصاویر گالری',
      aerial: 'تصاویر هوایی'
    },
    property: {
      showcase: 'معرفی ملک',
      openLink: 'باز کردن لینک مستقیم',
      gallery: 'گالری تصاویر',
      map: 'موقعیت روی نقشه',
      qr: 'کد QR',
      downloadQr: 'دانلود QR'
    }
  }
} as const;

export type Dictionary = (typeof dictionaries)[Locale];

export function getDictionary(locale: Locale) {
  return dictionaries[locale] || dictionaries.en;
}
