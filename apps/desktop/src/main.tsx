import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { I18nProvider } from "./i18n/I18nContext";
import { applyDesktopPlatform } from "./platform/detect";
import "./styles/global.css";
import "./styles/platforms/macos.css";
import "./styles/platforms/linux.css";
import "./styles/platforms/windows.css";

applyDesktopPlatform();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
