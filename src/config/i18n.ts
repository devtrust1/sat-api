import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-express-middleware';
import path from 'path';

export const supportedLanguages = ['en', 'es', 'zh', 'hi'];

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: 'en',
    preload: supportedLanguages,
    supportedLngs: supportedLanguages,

    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}.json'),
    },

    detection: {
      order: ['header', 'querystring', 'cookie'],
      caches: ['cookie'],
      lookupQuerystring: 'lang',
      lookupCookie: 'i18next',
      lookupHeader: 'accept-language',
    },

    interpolation: {
      escapeValue: false,
    },
  });

export { i18next, middleware };
