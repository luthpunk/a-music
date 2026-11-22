import { App } from "@capacitor/app";
import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { installTvMode } from "../tv/tvMode";

type SearchPromptOptions = { title: string; value: string; placeholder: string };
type SearchPromptResult = { submitted: boolean; value?: string };

/** MusikeDevicePlugin.java: what kind of device this is. */
const Device = registerPlugin<{
  info(): Promise<{ tv: boolean }>;
  promptSearch(options: SearchPromptOptions): Promise<SearchPromptResult>;
  showKeyboard(): Promise<void>;
  hideKeyboard(): Promise<void>;
}>("MusikeDevice", {
  web: () => ({
    info: async () => ({ tv: false }),
    promptSearch: async () => ({ submitted: false }),
    showKeyboard: async () => {},
    hideKeyboard: async () => {},
  }),
});

// How the app fits into Android itself: Android TV, the Back button and the system bars.
if (Capacitor.isNativePlatform()) {
  const host = globalThis as {
    __amusicPromptSearch?: (options: SearchPromptOptions) => Promise<SearchPromptResult>;
    __amusicShowKeyboard?: () => void;
    __amusicHideKeyboard?: () => void;
  };
  host.__amusicPromptSearch = (options) => Device.promptSearch(options);
  host.__amusicShowKeyboard = () => {
    void Device.showKeyboard().catch(() => {});
  };
  host.__amusicHideKeyboard = () => {
    void Device.hideKeyboard().catch(() => {});
  };

  // One APK for phones and TVs: on a TV, switch to the remote-friendly 10-foot UI (web/src/tv).
  void Device.info()
    .then(({ tv }) => {
      if (!tv) return;
      document.documentElement.dataset.tv = "1";
      installTvMode();
    })
    .catch(() => {});

  // Back closes what's on top (a dialog, a menu, theater), then goes back through pages, then sends the app to the
  // background, where the music keeps playing.
  void App.addListener("backButton", () => {
    const overlay = [
      ...document.querySelectorAll('[data-escape-closes], [role="dialog"], [aria-modal="true"], [role="menu"]'),
    ].some((el) => el.getClientRects().length > 0);
    if (overlay) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      return;
    }
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) window.history.back();
    else void App.minimizeApp();
  });

  // Status and navigation bar icons stay readable in both themes.
  const syncBars = () => {
    const light = document.documentElement.dataset.theme === "light";
    void SystemBars.setStyle({ style: light ? SystemBarsStyle.Light : SystemBarsStyle.Dark });
  };
  syncBars();
  new MutationObserver(syncBars).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
