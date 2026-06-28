"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import auth from "@/utils/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (auth.isLoggedIn()) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#060814]">
      <div className="relative flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
      </div>
    </div>
  );
}
