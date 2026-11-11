export type Locale = "mn" | "en";

export const LOCALE_STORAGE_KEY = "genghis:locale";
export const DEFAULT_LOCALE: Locale = "mn";

export function isLocale(value: unknown): value is Locale {
  return value === "mn" || value === "en";
}

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(raw)) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE;
}

export function applyLocaleToDocument(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale === "en" ? "en" : "mn";
  document.documentElement.dataset.locale = locale;
}

/** UI copy dictionary. Default product language is Mongolian. */
export const UI = {
  mn: {
    tagline: "Монголоос дэлхийтэй холбогд",
    valueProp:
      "Монгол хэлээр асуу, сур, бич, бүтээ. Genghis AI таны өдөр тутмын AI туслах.",
    tryExamples: "Жишээ асуултууд",
    pricingLink: "Багц / үнэ",
    pricingHero:
      "Үнэгүй: сард 30 мессеж. Pro: 72,000₮/сар (~$20) · 500 мессеж + 10 зураг.",
    newChat: "Шинэ чат",
    more: "Илүү их",
    recentChats: "Сүүлд чатласан",
    noChats: "Одоогоор яриа байхгүй.",
    close: "Хаалт",
    closeDialog: "Хаах",
    delete: "Устгах",
    openMenu: "Цэс нээх",
    sidebarResize: "Хажуугийн самбарын өргөн",
    themeGroup: "Гэрэлтүүлэг",
    themeLight: "Гэрэлтэй",
    themeDark: "Харанхуй",
    localeGroup: "Хэл",
    localeMn: "Монгол",
    localeEn: "English",
    wallpaper: "Дэвсгэр",
    wallpaperTitle: "Дэвсгэр зураг",
    wallpaperHint: "Нүүр хуудсын дэвсгэрийг солино",
    wallpaperMine: "Миний зураг",
    wallpaperUpload: "Өөрийн зураг оруулах",
    wallpaperBusy: "Боловсруулж байна…",
    wallpaperLocalOnly: "Зөвхөн энэ төхөөрөмжид хадгалагдана",
    wallpaperLoadFail: "Зураг ачаалж чадсангүй",
    wallpaperPick: "Дэвсгэр сонгох",
    toolChat: "Чат",
    toolThink: "Think",
    toolResearch: "Гүнзгий судалгаа",
    toolImage: "Зураг үүсгэх",
    toolDocument: "Баримт бичиг",
    toolCode: "Код боловсруулах",
    toolWeb: "Вэб хайлт",
    toolResearchShort: "Судалгаа",
    featureChatTitle: "Ухаалаг чат",
    featureChatDesc: "Монгол хэлээр асуулт, зөвлөгөө",
    featureImageDesc: "Санаагаа зургаар амьдруулах",
    featureDocDesc: "Дүгнэлт, тайлан, и-мэйл, орчуулга",
    featureCodeDesc: "Програмчлал, тайлбарлах",
    hiAutoSend: "Сайн уу",
    placeholderDefault: "Монголоор асуу, Genghis AI хариулна...",
    placeholderImage: "Зургийн тайлбараа монголоор бичнэ үү...",
    placeholderWeb: "Юу хайх вэ?",
    attach: "Зураг эсвэл файл хавсаргах",
    removeAttachment: "Хавсралт хасах",
    send: "Илгээх",
    stop: "Зогсоох",
    cancel: "Цуцлах",
    micStart: "Дуу хоолойгоор бичих",
    micStop: "Дуу хоолойг зогсоох",
    micUnsupported: "Микрофон энэ браузерт дэмжигдэхгүй",
    micTitleUnsupported: "Энэ браузер SpeechRecognition дэмжихгүй",
    thinking: "Бодож байна",
    thinkingFallback: "Бодож байна…",
    generatedImage: "Үүсгэсэн зураг",
    viewAttachments: "Хавсралтыг үзэж өгнө үү.",
    imageFail:
      "Зураг үүсгэж чадсангүй. Энэ API түлхүүр/загвар зураг дэмжихгүй байж болно.",
    imageOk: "Зураг амжилттай үүслээ",
    webSearchFail:
      "Вэб хайлт түр ажилласангүй. Дотоод мэдлэгээр судалгааны бүтэцтэй хариул.",
    emptyReply: "Хариу хоосон байна.",
    unknownError: "Тодорхойгүй алдаа гарлаа.",
    replyFail: "Уучлаарай, хариу өгч чадсангүй. Дахин оролдоно уу.",
    errorPrefix: "Алдаа",
    fileAddFail: "Файл нэмж чадсангүй.",
    greetingMorning: "Өглөөний мэнд",
    greetingAfternoon: "Өдрийн мэнд",
    greetingEvening: "Оройн мэнд",
    wallpaperHorseman: "Морьтон · тал",
    wallpaperUbNight: "УБ · шөнийн гэрэл",
    wallpaperGers: "Гэрүүд",
    wallpaperCamels: "Тэмээ · элс",
    wallpaperAutumn: "Намрын тал",
    wallpaperUbWinter: "УБ · өвөл",
    wallpaperUbTower: "УБ · шилэн цамхаг",
    wallpaperSquare: "Сүхбаатарын талбай",
    wallpaperChoijin: "Чойжин · хот",
    wallpaperPark: "Парк · шөнө",
    authSignIn: "Нэвтрэх / бүртгүүлэх",
    authHint: "Хэрэглээ тоолоход бүртгүүлнэ үү",
    authSignup: "Бүртгүүлэх",
    authLogin: "Нэвтрэх",
    authLogout: "Гарах",
    authName: "Нэр (заавал биш)",
    authEmail: "И-мэйл",
    authPassword: "Нууц үг (8+)",
    authFail: "Нэвтэрч чадсангүй.",
    authGoogle: "Google-ээр нэвтрэх",
    planFree: "Үнэгүй",
    planPaid: "Pro",
    planUsage: "Сарын хэрэглээ",
    planUpgrade: "Pro руу шилжих",
    planLimitTitle: "Хязгаарт хүрлээ",
    planLimitHint:
      "Үнэгүй багц: сард {free} мессеж. Pro: {price}₮/сар · {msgs} мессеж + {imgs} зураг. QPay-ээр төлнө (env байхгүй бол mock).",
    attachTruncated:
      "Хавсралтын текст хэт урт тул хязгаарлагдана (тохиргооны тэмдэгтийн хязгаар).",
    translitToggle: "Латин → Кирилл",
    translitConvert: "Хөрвүүлэх",
    translitPreview: "Урьдчилсан харагдац",
    copyMessage: "Хуулах",
    copiedMessage: "Хуулсан",
    regenerate: "Дахин үүсгэх",
    editMessage: "Засах",
    saveEdit: "Хадгалах",
    resendEdit: "Дахин илгээх",
    renameChat: "Нэрлэх",
    renameChatSave: "Хадгалах",
    stopGenerating: "Үүсгэхийг зогсоох",
  },
  en: {
    tagline: "Монголоос дэлхийтэй холбогд",
    valueProp:
      "Ask, learn, write, and create in Mongolian. Genghis AI is your everyday AI assistant.",
    tryExamples: "Try an example",
    pricingLink: "Plans / pricing",
    pricingHero:
      "Free: 30 messages/month. Pro: 72,000₮/mo (~$20) · 500 messages + 10 images.",
    newChat: "New chat",
    more: "More",
    recentChats: "Recent chats",
    noChats: "No conversations yet.",
    close: "Close",
    closeDialog: "Close",
    delete: "Delete",
    openMenu: "Open menu",
    sidebarResize: "Sidebar width",
    themeGroup: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    localeGroup: "Language",
    localeMn: "Монгол",
    localeEn: "English",
    wallpaper: "Wallpaper",
    wallpaperTitle: "Wallpaper",
    wallpaperHint: "Change the home background",
    wallpaperMine: "My image",
    wallpaperUpload: "Upload your image",
    wallpaperBusy: "Processing…",
    wallpaperLocalOnly: "Saved on this device only",
    wallpaperLoadFail: "Could not load image",
    wallpaperPick: "Choose wallpaper",
    toolChat: "Chat",
    toolThink: "Think",
    toolResearch: "Deep research",
    toolImage: "Create image",
    toolDocument: "Documents",
    toolCode: "Code",
    toolWeb: "Web search",
    toolResearchShort: "Research",
    featureChatTitle: "Smart chat",
    featureChatDesc: "Questions, answers, advice",
    featureImageDesc: "Bring ideas to life as images",
    featureDocDesc: "Summaries, reports, email, translation",
    featureCodeDesc: "Programming and explanations",
    hiAutoSend: "Hi",
    placeholderDefault: "Ask Genghis AI anything...",
    placeholderImage: "Describe the image you want...",
    placeholderWeb: "What should I search for?",
    attach: "Attach image or file",
    removeAttachment: "Remove attachment",
    send: "Send",
    stop: "Stop",
    cancel: "Cancel",
    micStart: "Dictate with voice",
    micStop: "Stop listening",
    micUnsupported: "Microphone not supported in this browser",
    micTitleUnsupported: "This browser does not support SpeechRecognition",
    thinking: "Thinking",
    thinkingFallback: "Thinking…",
    generatedImage: "Generated image",
    viewAttachments: "Please review the attachments.",
    imageFail:
      "Could not create an image. This API key/model may not support images.",
    imageOk: "Image created successfully",
    webSearchFail:
      "Web search is temporarily unavailable. Answer from built-in knowledge.",
    emptyReply: "Empty response.",
    unknownError: "An unknown error occurred.",
    replyFail: "Sorry, I could not reply. Please try again.",
    errorPrefix: "Error",
    fileAddFail: "Could not add file.",
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    wallpaperHorseman: "Horsemen · steppe",
    wallpaperUbNight: "UB · night lights",
    wallpaperGers: "Gers",
    wallpaperCamels: "Camels · dunes",
    wallpaperAutumn: "Autumn steppe",
    wallpaperUbWinter: "UB · winter",
    wallpaperUbTower: "UB · glass tower",
    wallpaperSquare: "Sukhbaatar Square",
    wallpaperChoijin: "Choijin · city",
    wallpaperPark: "Park · night",
    authSignIn: "Sign in / sign up",
    authHint: "Sign up so we can count usage",
    authSignup: "Sign up",
    authLogin: "Log in",
    authLogout: "Log out",
    authName: "Name (optional)",
    authEmail: "Email",
    authPassword: "Password (8+)",
    authFail: "Could not sign in.",
    authGoogle: "Continue with Google",
    planFree: "Free",
    planPaid: "Pro",
    planUsage: "Monthly usage",
    planUpgrade: "Upgrade to Pro",
    planLimitTitle: "Limit reached",
    planLimitHint:
      "Free: {free} messages/month. Pro: {price}₮/mo · {msgs} messages + {imgs} images. Pay with QPay (mock when env unset).",
    attachTruncated:
      "Attachment text was truncated to the configured character limit.",
    translitToggle: "Latin → Cyrillic",
    translitConvert: "Convert",
    translitPreview: "Preview",
    copyMessage: "Copy",
    copiedMessage: "Copied",
    regenerate: "Regenerate",
    editMessage: "Edit",
    saveEdit: "Save",
    resendEdit: "Resend",
    renameChat: "Rename",
    renameChatSave: "Save",
    stopGenerating: "Stop generating",
  },
} as const;

export type UiKey = keyof typeof UI.mn;

export function t(locale: Locale, key: UiKey): string {
  return UI[locale][key] ?? UI.mn[key];
}

export function toolLabel(locale: Locale, mode: string): string {
  switch (mode) {
    case "think":
      return t(locale, "toolThink");
    case "research":
      return t(locale, "toolResearch");
    case "image":
      return t(locale, "toolImage");
    case "document":
      return t(locale, "toolDocument");
    case "code":
      return t(locale, "toolCode");
    case "web":
      return t(locale, "toolWeb");
    default:
      return t(locale, "toolChat");
  }
}
