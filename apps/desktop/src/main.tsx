import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { I18nProvider } from "./i18n/I18nContext";
import "./styles/global.css";

const isWindows =
  /Windows/i.test(navigator.userAgent) || /^Win/i.test(navigator.platform);

if (isWindows) {
  document.documentElement.dataset.platform = "windows";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
