import { Switch, Route, Router, useLocation } from "wouter";
import { AppProvider, useUIContext } from "./context/AppContext";
import StepIndicator from "./components/StepIndicator";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ShortcutHelpDialog } from "./components/ShortcutHelpDialog";
import ImportPage from "./pages/ImportPage";
import FilterPage from "./pages/FilterPage";
import ResultPage from "./pages/ResultPage";
import NotFound from "./pages/not-found";
import { GraduationCap, RotateCcw, X, Keyboard } from "lucide-react";
import { useState } from "react";
import { Toaster } from "sonner";
import { useTranslation } from "react-i18next";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useDocumentTitle } from "./hooks/use-document-title";
import { AppBootSkeleton } from "./components/Skeleton";
import { PWAUpdatePrompt } from "./components/PWAUpdatePrompt";
import { LanguageSwitcher } from "./components/LanguageSwitcher";

const STEP_PATHS = ["/", "/filter", "/result"];

function AppContent() {
  const [location, navigate] = useLocation();
  const { isLoading, hasRestoredData, clearAll } = useUIContext();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const { t } = useTranslation();

  // P3.5：步驟標籤改為動態取自 i18n，切換語言即時生效
  const steps = [
    { label: t("steps.import") },
    { label: t("steps.filter") },
    { label: t("steps.result") },
  ];

  useDocumentTitle();
  useKeyboardShortcuts({
    onShowHelp: () => setShortcutHelpOpen(true),
    onFocusSearch: () => {
      const el = document.querySelector<HTMLInputElement>('input[type="text"][placeholder*="搜尋"]');
      el?.focus();
    },
  });

  const currentStep = STEP_PATHS.indexOf(location === "" ? "/" : location);
  const activeStep = currentStep < 0 ? 0 : currentStep;

  const handleReset = async () => {
    await clearAll();
    setBannerDismissed(false);
    navigate("/");
  };

  if (isLoading) {
    return <AppBootSkeleton />;
  }

  const showBanner = hasRestoredData && !bannerDismissed;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{t("app.title")}</h1>
            <p className="text-xs text-gray-500">{t("app.subtitle")}</p>
          </div>
          <LanguageSwitcher />
          <button
            onClick={() => setShortcutHelpOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
            title={t("actions.shortcutsTitle")}
          >
            <Keyboard className="w-4 h-4" />
            <span className="hidden md:inline">{t("actions.shortcuts")}</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
            title={t("actions.resetTitle")}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">{t("actions.reset")}</span>
          </button>
        </div>
      </header>

      {showBanner && (
        <div className="bg-blue-600 text-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
            <p className="text-sm">
              {t("banner.restored")}
              <button
                onClick={handleReset}
                className="underline ml-2 hover:text-blue-200 transition-colors"
              >
                {t("banner.restart")}
              </button>
            </p>
            <button
              onClick={() => setBannerDismissed(true)}
              className="flex-shrink-0 hover:text-blue-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex justify-center mb-8">
          <StepIndicator steps={steps} currentStep={activeStep} />
        </div>

        <ErrorBoundary>
          <Switch>
            <Route path="/">
              <ErrorBoundary>
                <ImportPage onNext={() => navigate("/filter")} />
              </ErrorBoundary>
            </Route>
            <Route path="/filter">
              <ErrorBoundary>
                <FilterPage
                  onPrev={() => navigate("/")}
                  onNext={() => navigate("/result")}
                />
              </ErrorBoundary>
            </Route>
            <Route path="/result">
              <ErrorBoundary>
                <ResultPage
                  onPrev={() => navigate("/filter")}
                  onReset={handleReset}
                />
              </ErrorBoundary>
            </Route>
            <Route component={NotFound} />
          </Switch>
        </ErrorBoundary>
      </main>

      <ShortcutHelpDialog open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
      <Toaster position="top-right" richColors closeButton />
      <PWAUpdatePrompt />
    </div>
  );
}

export default function App() {
  // Strip trailing slash so wouter base works in both dev (/) and prod (/filter/)
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <ErrorBoundary>
      <Router base={base}>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </Router>
    </ErrorBoundary>
  );
}
