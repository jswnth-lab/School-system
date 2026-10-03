// Small dictionary; the school's locale picks the language, English is the per-key fallback.
const en = {
  schoolCode: "School code", schoolCodeHint: "Ask your school for its code, for example “greenvalley”.", continue: "Continue",
  unknownSchool: "No school with that code.", suspended: "This school is suspended. Contact the school office.", offline: "Can't reach the server. Check your connection.",
  identifier: "Email or username", password: "Password", signIn: "Sign in", signingIn: "Signing in…", wrongLogin: "Wrong email, username or password.",
  tooMany: "Too many attempts. Try again in a minute.", signOut: "Sign out", changeSchool: "Use a different school", loading: "Loading…",
  updateTitle: "Update required", updateBody: "This version of the app is no longer supported. Please update it from the store.",
  wrongApp: "This app is for teachers. Your account can't use it.", wrongAppStudent: "This app is for students and parents. Your account can't use it.",
  retry: "Try again", child: "Child", switchChild: "Switch child", home: "Home", profile: "Profile", classes: "My classes", today: "Today", timetable: "Timetable",
  nothing: "Nothing here yet.",
};
type Dict = typeof en;
const ar: Partial<Dict> = {
  schoolCode: "رمز المدرسة", schoolCodeHint: "اطلب من مدرستك رمزها، مثل «greenvalley».", continue: "متابعة", unknownSchool: "لا توجد مدرسة بهذا الرمز.",
  identifier: "البريد الإلكتروني أو اسم المستخدم", password: "كلمة المرور", signIn: "تسجيل الدخول", signingIn: "جارٍ تسجيل الدخول…", wrongLogin: "بيانات الدخول غير صحيحة.",
  signOut: "تسجيل الخروج", changeSchool: "استخدام مدرسة أخرى", loading: "جارٍ التحميل…", home: "الرئيسية", profile: "الملف الشخصي", nothing: "لا يوجد شيء بعد.",
};
const hi: Partial<Dict> = {
  schoolCode: "स्कूल कोड", schoolCodeHint: "अपने स्कूल से उसका कोड पूछें, जैसे “greenvalley”.", continue: "आगे बढ़ें", unknownSchool: "इस कोड का कोई स्कूल नहीं मिला।",
  identifier: "ईमेल या उपयोगकर्ता नाम", password: "पासवर्ड", signIn: "साइन इन करें", signingIn: "साइन इन हो रहा है…", wrongLogin: "लॉगिन विवरण गलत है।",
  signOut: "साइन आउट", changeSchool: "दूसरा स्कूल चुनें", loading: "लोड हो रहा है…", home: "होम", profile: "प्रोफ़ाइल", nothing: "अभी यहाँ कुछ नहीं है।",
};
const dicts: Record<string, Partial<Dict>> = { en, ar, hi };
let locale = "en";
export const setLocale = (l: string) => { locale = dicts[l] ? l : "en"; };
export const t = (k: keyof Dict) => dicts[locale][k] ?? en[k];
export const isRtl = (l: string) => ["ar", "he", "fa", "ur"].includes(l);
