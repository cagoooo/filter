import { useState, useRef, DragEvent } from "react";
import { Upload, CheckCircle, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { UploadCardSkeleton } from "./Skeleton";

interface FileUploadCardProps {
  title: string;
  description: string;
  acceptedFormats?: string;
  onFileSelect: (file: File) => Promise<void>;
  status: "idle" | "loading" | "success" | "error";
  fileName?: string;
  errorMessage?: string;
  warnings?: string[];
  onClear?: () => void;
}

export default function FileUploadCard({
  title,
  description,
  acceptedFormats = ".xlsx, .xls, .csv",
  onFileSelect,
  status,
  fileName,
  errorMessage,
  warnings = [],
  onClear,
}: FileUploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    await onFileSelect(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="p-5">
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer",
            isDragging
              ? "border-blue-400 bg-blue-50"
              : status === "success"
              ? "border-green-300 bg-green-50/50"
              : status === "error"
              ? "border-red-300 bg-red-50/50"
              : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleChange}
          />
          {status === "loading" ? (
            <UploadCardSkeleton label="解析中..." />
          ) : status === "success" ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <p className="text-sm font-medium text-green-700">{fileName}</p>
              <p className="text-xs text-green-600">匯入成功，點擊重新上傳</p>
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <p className="text-sm text-red-700">{errorMessage}</p>
              <p className="text-xs text-gray-500">點擊重新上傳</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-400" />
              <p className="text-sm text-gray-600">
                拖曳檔案至此，或點擊選擇檔案
              </p>
              <p className="text-xs text-gray-400">支援格式：{acceptedFormats}</p>
            </div>
          )}
        </div>

        {warnings.length > 0 && status === "success" && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-medium text-amber-700 mb-1">注意事項：</p>
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600">
                • {w}
              </p>
            ))}
          </div>
        )}

        {status === "success" && onClear && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            <X className="w-4 h-4" />
            清除資料
          </button>
        )}
      </div>
    </div>
  );
}
