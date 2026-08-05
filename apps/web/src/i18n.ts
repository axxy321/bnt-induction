import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      "app_title": "Induction Portal",
      "step_1": "Personal Details",
      "step_2": "Documents Upload",
      "step_3": "Safety Content",
      "step_4": "Knowledge Check",
      "step_5": "Identity & Declaration",
      "step_6": "Completion",
      "continue": "Continue",
      "back": "Back",
      "logout": "Log Out"
    }
  },
  hi: {
    translation: {
      "app_title": "प्रेरण पोर्टल",
      "step_1": "व्यक्तिगत विवरण",
      "step_2": "दस्तावेज़ अपलोड",
      "step_3": "सुरक्षा सामग्री",
      "step_4": "ज्ञान जांच",
      "step_5": "पहचान और घोषणा",
      "step_6": "समापन",
      "continue": "जारी रखें",
      "back": "वापस",
      "logout": "लॉग आउट"
    }
  },
  zh: {
    translation: {
      "app_title": "入职门户",
      "step_1": "个人信息",
      "step_2": "文件上传",
      "step_3": "安全内容",
      "step_4": "知识检查",
      "step_5": "身份与声明",
      "step_6": "完成",
      "continue": "继续",
      "back": "返回",
      "logout": "登出"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
