import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md mx-4 bg-white rounded-xl shadow p-6">
        <div className="flex mb-4 gap-2 items-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900">404 頁面不存在</h1>
        </div>
        <a href="/" className="text-blue-600 hover:underline text-sm">
          返回首頁
        </a>
      </div>
    </div>
  );
}
