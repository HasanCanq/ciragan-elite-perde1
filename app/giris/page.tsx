export const revalidate = 0;

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
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <p className="text-center font-serif text-[20px] tracking-[0.2em] uppercase mb-8">
          Hanedan
        </p>
        <div className="border border-[#F3F4F6] p-8 animate-pulse">
          <div className="h-5 bg-[#F3F4F6] w-48 mx-auto mb-8" />
          <div className="space-y-4">
            <div className="h-11 bg-[#F3F4F6]" />
            <div className="h-11 bg-[#F3F4F6]" />
            <div className="h-11 bg-[#F3F4F6]" />
          </div>
        </div>
      </div>
    </div>
  );
}
