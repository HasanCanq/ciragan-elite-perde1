export const dynamic = "force-dynamic";

import { Suspense } from "react";
import AuthForm from "./auth-form";

export default function GirisPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <AuthForm />
    </Suspense>
  );
}

function AuthFormSkeleton() {
  return (
    <div className="min-h-screen bg-elite-bone flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="block text-center mb-8">
          <span className="font-serif text-3xl font-semibold text-elite-black">
            Çırağan Elite
          </span>
        </div>
        <div className="bg-white rounded-2xl shadow-elite p-8 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto mb-8"></div>
          <div className="space-y-5">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
