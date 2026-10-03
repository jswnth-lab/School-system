// Small dictionary i18n: the school's locale picks the language, English is the fallback per key.
const en = {
  signIn: 'Sign in', signOut: 'Sign out', identifier: 'Email or username', password: 'Password', signingIn: 'Signing in…',
  wrongLogin: 'Wrong email, username or password.', tooMany: 'Too many attempts. Try again later.', loading: 'Loading…',
  welcome: 'Welcome to', signedInAs: 'Signed in as', home: 'Home', setup: 'Setup', people: 'People', classes: 'Classes', users: 'Users', audit: 'Activity', import: 'Import',
  students: 'Students', teachers: 'Teachers', guardians: 'Guardians', search: 'Search', add: 'Add', delete: 'Delete', select: 'Select…',
  nothing: 'Nothing here yet.', createLogin: 'Create login', resetPassword: 'Reset password', active: 'active', save: 'Save', skip: 'Skip to content',
  previous: 'Previous', next: 'Next', login: 'Login', name: 'Name', class: 'Class', confirmDelete: 'Delete this item? Anything under it is deleted too.',
}
type Dict = typeof en
const ar: Partial<Dict> = {
  signIn: 'تسجيل الدخول', signOut: 'تسجيل الخروج', identifier: 'البريد الإلكتروني أو اسم المستخدم', password: 'كلمة المرور', signingIn: 'جارٍ تسجيل الدخول…',
  wrongLogin: 'البريد الإلكتروني أو اسم المستخدم أو كلمة المرور غير صحيحة.', tooMany: 'محاولات كثيرة. حاول لاحقًا.', loading: 'جارٍ التحميل…',
  welcome: 'مرحبًا بك في', signedInAs: 'تم تسجيل الدخول بصفة', home: 'الرئيسية', setup: 'الإعداد', people: 'الأشخاص', classes: 'الصفوف', users: 'المستخدمون', audit: 'النشاط', import: 'استيراد',
  students: 'الطلاب', teachers: 'المعلمون', guardians: 'أولياء الأمور', search: 'بحث', add: 'إضافة', delete: 'حذف', select: 'اختر…',
  nothing: 'لا يوجد شيء بعد.', createLogin: 'إنشاء حساب دخول', resetPassword: 'إعادة تعيين كلمة المرور', active: 'نشط', save: 'حفظ', skip: 'انتقل إلى المحتوى',
  previous: 'السابق', next: 'التالي', login: 'الدخول', name: 'الاسم', class: 'الصف', confirmDelete: 'حذف هذا العنصر؟ سيتم حذف كل ما تحته أيضًا.',
}
const hi: Partial<Dict> = {
  signIn: 'साइन इन करें', signOut: 'साइन आउट', identifier: 'ईमेल या उपयोगकर्ता नाम', password: 'पासवर्ड', signingIn: 'साइन इन हो रहा है…',
  wrongLogin: 'ईमेल, उपयोगकर्ता नाम या पासवर्ड गलत है।', tooMany: 'बहुत अधिक प्रयास। बाद में पुनः प्रयास करें।', loading: 'लोड हो रहा है…',
  welcome: 'आपका स्वागत है', signedInAs: 'इस रूप में साइन इन', home: 'होम', setup: 'सेटअप', people: 'लोग', classes: 'कक्षाएँ', users: 'उपयोगकर्ता', audit: 'गतिविधि', import: 'आयात',
  students: 'छात्र', teachers: 'शिक्षक', guardians: 'अभिभावक', search: 'खोजें', add: 'जोड़ें', delete: 'हटाएँ', select: 'चुनें…',
  nothing: 'अभी यहाँ कुछ नहीं है।', createLogin: 'लॉगिन बनाएँ', resetPassword: 'पासवर्ड रीसेट करें', active: 'सक्रिय', save: 'सहेजें', skip: 'सामग्री पर जाएँ',
  previous: 'पिछला', next: 'अगला', login: 'लॉगिन', name: 'नाम', class: 'कक्षा', confirmDelete: 'यह आइटम हटाएँ? इसके अंतर्गत सब कुछ भी हट जाएगा।',
}
const dicts: Record<string, Partial<Dict>> = { en, ar, hi }
let current = 'en'
export const setLocale = (l: string) => { current = dicts[l] ? l : 'en' }
export const t = (k: keyof Dict) => dicts[current][k] ?? en[k]
export const LOCALES = [['en', 'English'], ['ar', 'العربية'], ['hi', 'हिन्दी']] as const
