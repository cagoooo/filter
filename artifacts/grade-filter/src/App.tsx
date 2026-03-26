import { Switch, Route, useLocation } from "wouter";
import { AppProvider, useAppContext } from "./context/AppContext";
import StepIndicator from "./components/StepIndicator";
import ImportPage from "./pages/ImportPage";
import FilterPage from "./pages/FilterPage";
import ResultPage from "./pages/ResultPage";
import NotFound from "./pages/not-found";
import { GraduationCap, Loader2, RotateCcw, X } from "lucide-react";
import { useState } from "react";

const STEPS = [
  { label: "匯入資料" },
  { label: "設定篩選" },
  { label: "查看結果" },
];

const STEP_PATHS = ["/", "/filter", "/result"];

function AppContent() {
  const [location, navigate] = useLocation();
  const { isLoading, hasRestoredData, clearAll } = useAppContext();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const currentStep = STEP_PATHS.indexOf(location === "" ? "/" : location);
  const activeStep = currentStep < 0 ? 0 : currentStep;

  const handleReset = async () => {
    await clearAll();
    setBannerDismissed(false);
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">正在還原上次的資料...</p>
        </div>
      </div>
    );
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
            <h1 className="text-lg font-bold text-gray-900">成績篩選系統</h1>
            <p className="text-xs text-gray-500">國小期中考成績篩選工具</p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
            title="清除所有資料，重新開始"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">清除資料</span>
          </button>
        </div>
      </header>

      {showBanner && (
        <div className="bg-blue-600 text-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
            <p className="text-sm">
              上次的資料已自動還原，可直接繼續操作。
              <button
                onClick={handleReset}
                className="underline ml-2 hover:text-blue-200 transition-colors"
              >
                清除資料，重新開始
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
          <StepIndicator steps={STEPS} currentStep={activeStep} />
        </div>

        <Switch>
          <Route path="/">
            <ImportPage onNext={() => navigate("/filter")} />
          </Route>
          <Route path="/filter">
            <FilterPage
              onPrev={() => navigate("/")}
              onNext={() => navigate("/result")}
            />
          </Route>
          <Route path="/result">
            <ResultPage
              onPrev={() => navigate("/filter")}
              onReset={handleReset}
            />
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
