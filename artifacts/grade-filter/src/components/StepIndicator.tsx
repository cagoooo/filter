import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  icon?: React.ReactNode;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all",
                i < currentStep
                  ? "bg-blue-600 border-blue-600 text-white"
                  : i === currentStep
                  ? "bg-white border-blue-600 text-blue-600"
                  : "bg-white border-gray-200 text-gray-400"
              )}
            >
              {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "mt-1.5 text-xs font-medium whitespace-nowrap",
                i === currentStep ? "text-blue-600" : i < currentStep ? "text-gray-600" : "text-gray-400"
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "w-16 sm:w-24 h-0.5 mb-4 mx-1",
                i < currentStep ? "bg-blue-600" : "bg-gray-200"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
