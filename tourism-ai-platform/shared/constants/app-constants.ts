export const APP_CONSTANTS = {
  APP_NAME: "Health Tourism AI Platform",
  VERSION: "2.0.0",
  DEFAULT_LOCALE: "en",
  SUPPORTED_LANGUAGES: ["en", "tr", "ar", "de"],
  FEATURE_FLAGS: {
    SPEECH: process.env.FEATURE_SPEECH === "true",
    VISION: process.env.FEATURE_VISION === "true",
    PERSONALIZATION: process.env.FEATURE_PERSONALIZATION === "true",
  },
  CONTACT: {
    SUPPORT_EMAIL: "support@healthtourism.ai",
    DOCS_URL: "https://docs.healthtourism.ai",
  },
};