"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  MessageSquare, Plus, LogOut, MessageCircleCode, 
  GraduationCap, Award, RefreshCw, BookOpen, AlertCircle,
  Trash2
} from "lucide-react";
import auth from "@/utils/auth";
import api, { Conversation, Message } from "@/utils/api";
import VoiceRecorder from "@/components/VoiceRecorder";

export default function DashboardPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [activeTitle, setActiveTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // SSE Streaming state placeholders
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamedUserTranscript, setStreamedUserTranscript] = useState("");
  const [streamedAssistantResponse, setStreamedAssistantResponse] = useState("");
  const [streamedFeedback, setStreamedFeedback] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // 1. Auth check & mounting check
  useEffect(() => {
    setMounted(true);
    setUserEmail(auth.getEmail() || "");
    if (!auth.isLoggedIn()) {
      router.replace("/login");
    } else {
      fetchConversations();
    }
  }, [router]);

  // Scroll to bottom when history changes or streaming is active
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, streamedUserTranscript, streamedAssistantResponse, isProcessing]);

  const fetchConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  const handleCreateConversation = async () => {
    const title = prompt("Enter a title for the new conversation:");
    if (!title || !title.trim()) return;

    setLoading(true);
    try {
      const newConv = await api.createConversation(title.trim());
      await fetchConversations();
      handleSelectConversation(newConv.id, newConv.title);
    } catch (err) {
      alert("Failed to create conversation");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = async (id: string, title: string) => {
    setSelectedId(id);
    setActiveTitle(title);
    setLoadingHistory(true);
    setStreamedUserTranscript("");
    setStreamedAssistantResponse("");
    setStreamedFeedback(null);
    try {
      const data = await api.getConversationHistory(id);
      setHistory(data.messages);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (!confirm("Are you sure you want to delete this conversation?")) {
      return;
    }

    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setActiveTitle("");
        setHistory([]);
      }
    } catch (err: any) {
      alert("Failed to delete conversation: " + err.message);
    }
  };

  const handleAudioReady = async (audioBlob: Blob) => {
    if (!selectedId) return;

    setIsProcessing(true);
    setStreamedUserTranscript("Processing audio...");
    setStreamedAssistantResponse("");
    setStreamedFeedback(null);

    try {
      const historyData = await api.sendVoiceMessage(selectedId, audioBlob);
      setHistory(historyData.messages);
      setStreamedUserTranscript("");
      setStreamedAssistantResponse("");
      setStreamedFeedback(null);
    } catch (err: any) {
      alert("Error uploading audio: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 70) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-rose-400 border-rose-500/30 bg-rose-500/10";
  };

  return (
    <div className="flex h-screen w-screen bg-[#060814] overflow-hidden text-slate-100 font-sans">
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 h-[400px] w-[400px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-rose-500/3 blur-[120px] pointer-events-none"></div>

      {/* 1. Sidebar */}
      <aside className="w-80 glass border-r border-slate-800 flex flex-col shrink-0 z-10">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-500 flex items-center justify-center glow-indigo">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold tracking-tight text-white">English Coach</span>
          </div>
          <button 
            onClick={handleCreateConversation} 
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"
            title="New Conversation"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          <p className="text-[10px] font-bold tracking-wider text-slate-500 mb-3 px-2 uppercase">Conversations</p>
          
          {conversations.length === 0 ? (
            <p className="text-xs text-slate-500 px-2 italic py-4">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`group w-full flex items-center justify-between rounded-lg text-sm transition-colors ${
                  selectedId === c.id 
                    ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20" 
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
                }`}
              >
                <button
                  onClick={() => handleSelectConversation(c.id, c.title)}
                  className="flex-1 text-left px-3 py-3 flex items-center gap-3 min-w-0"
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate font-medium">{c.title}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(c.id);
                  }}
                  className="p-2 mr-1 rounded hover:bg-slate-800 hover:text-rose-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all text-slate-500"
                  title="Delete Conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-500">Logged in as</span>
            <span className="text-sm font-semibold truncate text-slate-300">{mounted ? userEmail : "..."}</span>
          </div>
          <button 
            onClick={() => auth.logout()} 
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* 2. Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950/20 z-10 relative">
        {selectedId ? (
          <>
            {/* Active Header */}
            <header className="px-8 py-5 border-b border-slate-800/80 bg-slate-950/10 backdrop-blur-sm flex items-center justify-between">
              <div className="flex flex-col">
                <h2 className="text-md font-semibold text-white tracking-wide">{activeTitle}</h2>
                <span className="text-xs text-slate-500">Conversation Gateway Active</span>
              </div>
            </header>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-6">
              {loadingHistory ? (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin" />
                    <span className="text-xs text-slate-500">Retrieving conversation...</span>
                  </div>
                </div>
              ) : (
                <>
                  {history.map((m) => (
                    <div 
                      key={m.id} 
                      className={`flex flex-col ${m.role === "USER" ? "items-end" : "items-start"}`}
                    >
                      {/* Message bubble */}
                      <div className={`max-w-2xl px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${
                        m.role === "USER"
                          ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-500/10"
                          : "bg-slate-800/60 text-slate-200 rounded-bl-none border border-slate-700/50"
                      }`}>
                        {m.transcript}
                      </div>

                      {/* AI Feedback inline under user messages */}
                      {m.role === "USER" && m.feedback && (
                        <div className="w-full max-w-2xl mt-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm p-5 space-y-4">
                          {/* Score and Header */}
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                              <MessageCircleCode className="h-4 w-4 text-indigo-400" />
                              <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">AI COACH ANALYSIS</span>
                            </div>
                            <div className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${getScoreColor(m.feedback.pronunciationScore)}`}>
                              <Award className="h-3.5 w-3.5" />
                              <span>Pronunciation: {m.feedback.pronunciationScore}%</span>
                            </div>
                          </div>

                          {/* Grammar corrections */}
                          {m.feedback.grammarCorrections && m.feedback.grammarCorrections.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Grammar Corrections</p>
                              {m.feedback.grammarCorrections.map((corr: any, i: number) => (
                                <div key={i} className="text-xs bg-slate-950/30 border border-slate-800/50 rounded-lg p-3 space-y-2">
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <span className="text-rose-400 line-through">"{corr.original}"</span>
                                    <span className="text-slate-500 text-[10px]">➜</span>
                                    <span className="text-emerald-400 font-semibold">"{corr.correction}"</span>
                                  </div>
                                  <p className="text-slate-400 leading-relaxed">{corr.explanation}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Pronunciation feedback */}
                          {m.feedback.pronunciationFeedback && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Pronunciation</p>
                              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/20 border border-slate-850 p-2.5 rounded-lg">
                                {m.feedback.pronunciationFeedback}
                              </p>
                            </div>
                          )}

                          {/* Vocabulary Tips */}
                          {m.feedback.vocabularyTips && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                                <p className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Vocabulary Enhancements</p>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/20 border border-slate-850 p-2.5 rounded-lg">
                                {m.feedback.vocabularyTips}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Realtime Feedback Loading State */}
                  {isProcessing && (
                    <div className="space-y-4">
                      <div className="flex flex-col items-end">
                        <div className="max-w-2xl px-5 py-3.5 rounded-2xl text-sm leading-relaxed bg-gradient-to-br from-indigo-500/60 to-indigo-600/60 text-white/80 rounded-br-none animate-pulse">
                          Processing your voice message...
                        </div>
                      </div>

                      <div className="flex flex-col items-start">
                        <div className="w-full max-w-2xl mt-2 rounded-xl border border-slate-800/80 bg-slate-900/30 p-5 space-y-4 animate-pulse">
                          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                            <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-indigo-400 animate-spin"></div>
                            <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">AI COACH IS ANALYZING...</span>
                          </div>
                          <div className="space-y-2">
                            <div className="h-3 bg-slate-800/60 rounded w-5/6"></div>
                            <div className="h-3 bg-slate-800/60 rounded w-4/6"></div>
                            <div className="h-3 bg-slate-800/60 rounded w-3/6"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Chat Footer / Recorder */}
            <footer className="px-8 py-4 border-t border-slate-800/80 bg-slate-950/20">
              <VoiceRecorder 
                onAudioReady={handleAudioReady} 
                disabled={isProcessing} 
              />
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-900 border border-slate-850 flex items-center justify-center mb-6 shadow-xl text-indigo-400 glow-indigo">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Practice speaking English</h3>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Start a new conversation or select an existing one to begin speaking with your personal AI Coach.
            </p>
            <button
              onClick={handleCreateConversation}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 font-medium text-sm text-white transition-all shadow-lg shadow-indigo-500/25 active:scale-98"
            >
              <Plus className="h-4 w-4" />
              <span>New Conversation</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
