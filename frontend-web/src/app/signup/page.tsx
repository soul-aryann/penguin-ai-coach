"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, UserPlus, Sparkles, CheckCircle2 } from "lucide-react";
import auth from "@/utils/auth";
import api from "@/utils/api";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isLoggedIn()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.signup(email, password);
      setSuccess(response.message || "Account created successfully! Redirecting...");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#060814] px-4">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-rose-500/5 blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-card rounded-2xl p-8 text-slate-100 z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/30 mb-4">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Create Account</h1>
          <p className="text-sm text-slate-400">Join other students learning English conversation</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Mail className="h-5 w-5" />
              </span>
              <input
                id="email"
                type="email"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg glass-input text-sm"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="password">
              Password (min 8 chars)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="h-5 w-5" />
              </span>
              <input
                id="password"
                type="password"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg glass-input text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="h-5 w-5" />
              </span>
              <input
                id="confirmPassword"
                type="password"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg glass-input text-sm"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !!success}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-medium text-sm transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-500/20"
          >
            {loading ? (
              <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
