import { useState } from "react";
import { AppProvider, useAppContext } from "./context/AppContext";
import StepIndicator from "./components/StepIndicator";
import ImportPage from "./pages/ImportPage";
import FilterPage from "./pages/FilterPage";
import ResultPage from "./pages/ResultPage";
import { GraduationCap } from "lucide-react";

const STEPS = [
  { label: "匯入資料" },
  { label: "設定篩選" },
  { label: "查看結果" },
];

function AppContent() {
  const [step, setStep] = useState(0);
  const { clearResults, setChineseData, setEnglishData, setMathData, setCurrentStudents, setSpecialStudents, setFilterConfigs } = useAppContext();

  const handleReset = () => {
    clearResults();
    setChineseData([]);
    setEnglishData([]);
    setMathData([]);
    setCurrentStudents([]);
    setSpecialStudents([]);
    setFilterConfigs([]);
    setStep(0);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">成績篩選系統</h1>
            <p className="text-xs text-gray-500">國小期中考成績篩選工具</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex justify-center mb-8">
          <StepIndicator steps={STEPS} currentStep={step} />
        </div>

        {step === 0 && (
          <ImportPage onNext={() => setStep(1)} />
        )}
        {step === 1 && (
          <FilterPage onPrev={() => setStep(0)} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <ResultPage onPrev={() => setStep(1)} onReset={handleReset} />
        )}
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
