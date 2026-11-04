import i18next from "i18next";
import middleware from "i18next-http-middleware";
import Backend from "i18next-fs-backend";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: "en",
    preload: ["en", "ar"],
    ns: [
      "auth",
      "booking",
      "contract",
      "dashboard",
      "favorite",
      "notification",
      "permission",
      "profile",
      "property",
      "report",
      "review",
      "role",
      "savedSearch",
      "supportticket",
    ],
    defaultNS: "auth",
    backend: {
      loadPath: path.join(__dirname, "../../locales/{{lng}}/{{ns}}.json"),
    },
    detection: {
      order: ["header"], //  read from Accept-Language
      caches: false,
    },
  });

export default i18next;
export const i18nextMiddleware = middleware.handle(i18next);
