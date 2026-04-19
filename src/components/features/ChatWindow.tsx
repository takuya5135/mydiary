"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, Shield, Zap, Sword, ClipboardList } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, getRecentChatMessages, saveChatMessage } from "@/lib/firebase/chat";
import { chatWithAIAction } from "@/app/actions";
import { getBucketList } from "@/lib/firebase/bucketList";
import { getDictionary } from "@/lib/firebase/dictionary";
import { getUserProfile } from "@/lib/firebase/profile";
import { getDiaryEntry, getRecentEntries } from "@/lib/firebase/entries";

type PersonaId = "log" | "mamo" | "waku" | "zen";

interface PersonaConfig {
  id: PersonaId;
  name: string;
  role: string;
  color: string;
  icon: React.ReactNode;
}

const PERSONAS: PersonaConfig[] = [
  { id: "log", name: "LOG", role: "秘書", color: "bg-slate-600", icon: <ClipboardList size={14} /> },
  { id: "mamo", name: "MAMO", role: "守護者", color: "bg-emerald-600", icon: <Shield size={14} /> },
  { id: "waku", name: "WAKU", role: "トレーナー", color: "bg-orange-500", icon: <Zap size={14} /> },
  { id: "zen", name: "ZEN", role: "軍師", color: "bg-purple-700", icon: <Sword size={14} /> },
];

interface ChatWindowProps {
  userId: string;
  dateStr: string;
  onDateChange?: (date: string) => void;
}

export function ChatWindow({ userId, dateStr, onDateChange }: ChatWindowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activePersona, setActivePersona] = useState<PersonaId>("log");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadMessages();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    setIsLoading(true);
    const msgs = await getRecentChatMessages(userId, 30);
    setMessages(msgs);
    setIsLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const currentPersona = activePersona;
    setInput("");

    const tempUserMsg: ChatMessage = {
      role: "user",
      content: userMessage,
      // @ts-ignore
      createdAt: { toDate: () => new Date() }
    };
    const newHistory = [...messages, tempUserMsg];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      await saveChatMessage(userId, "user", userMessage);

      const [bucketList, dictionary, profile, todaysEntry, recentEntries] = await Promise.all([
        getBucketList(userId),
        getDictionary(userId),
        getUserProfile(userId),
        getDiaryEntry(userId, dateStr),
        getRecentEntries(userId, 30)
      ]);

      const bucketListContext = bucketList.map(i => `- ${i.title}`).join("\n");
      const dictionaryContext = dictionary.map(i => `- ${i.name}: ${i.attributes?.memo || ""}`).join("\n");
      
      let profileContext = "未登録";
      if (profile) {
        const historyStr = profile.history?.map(h => `${h.from}~${h.to}:${h.description}`).join(", ") || "";
        profileContext = `持病:${profile.medicalHistory || "なし"}, 経歴:${historyStr}`;
      }

      let todaysDiaryContext = "未入力";
      if (todaysEntry?.segments) {
        todaysDiaryContext = `Home: ${todaysEntry.segments.home}\nWork: ${todaysEntry.segments.work}\nHobby: ${todaysEntry.segments.hobby}`;
      }

      const pastContext = recentEntries.length > 0
        ? recentEntries.map((e, idx) => {
            const dateStr = `【${e.date}】`;
            if (idx < 3) {
              return `${dateStr}\n  Home: ${e.segments?.home || "-"}\n  Work: ${e.segments?.work || "-"}\n  Hobby: ${e.segments?.hobby || "-"}`;
            }
            if (idx < 14) {
              return `${dateStr} キーワード: ${e.keywords?.join(", ") || "なし"}`;
            }
            return `${dateStr} (記録あり)`;
          }).join("\n")
        : "記録なし";

      // @ts-ignore
      const { getUserToken } = await import("@/lib/firebase/tokens");
      const googleToken = await getUserToken(userId);

      const result = await chatWithAIAction(
        userId,
        userMessage,
        messages,
        {
          bucketListContext,
          dictionaryContext,
          pastContext,
          profileContext,
          todaysDiaryContext,
        },
        googleToken || null,
        dateStr,
        currentPersona
      );

      if (result.success && result.reply) {
        await saveChatMessage(userId, "model", result.reply, result.agentId);

        const tempAiMsg: ChatMessage = {
          role: "model",
          agentId: result.agentId,
          content: result.reply,
          // @ts-ignore
          createdAt: { toDate: () => new Date() }
        };
        setMessages([...newHistory, tempAiMsg]);

        // ツール呼び出し（日付ジャンプ）の処理
        if (result.toolCall?.name === "jump_to_date" && onDateChange) {
          onDateChange(result.toolCall.args.date);
        }

        if (result.calendarError) {
          console.warn("Calendar token expired. User needs to re-login.");
        }
      } else {
        alert("エラーが発生しました: " + result.error);
      }
    } catch (error: any) {
      console.error(error);
      alert("通信エラーが発生しました: " + (error.message || "詳細不明"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 rounded-full bg-blue-600 outline-none text-white shadow-xl shadow-blue-500/30 hover:bg-blue-700 hover:scale-105 transition-all z-40 group"
      >
        <MessageCircle size={28} className="group-hover:animate-pulse" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-full max-w-sm h-[640px] max-h-[85vh] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl rounded-2xl flex flex-col z-50 overflow-hidden"
          >
            <div className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex justify-between items-center px-4 pt-3 pb-1">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                    <ClipboardList size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">ChampionMaker</h3>
                    <p className="text-[10px] text-slate-500">外部脳 チーム連携中</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex px-2 pb-2 space-x-1">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePersona(p.id)}
                    className={`flex-1 flex flex-col items-center py-1.5 rounded-lg transition-all ${
                      activePersona === p.id 
                        ? "bg-white dark:bg-zinc-800 shadow-sm border border-slate-200 dark:border-zinc-700" 
                        : "opacity-40 grayscale hover:opacity-100 hover:grayscale-0"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full ${p.color} flex items-center justify-center text-white mb-0.5`}>
                      {p.icon}
                    </div>
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-zinc-900/50">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
                  <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center">
                    <MessageCircle size={32} className="text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-[200px]">
                    こんにちは。私はあなたの外部脳です。過去の出来事や将来の目標など、なんでも相談してください。
                  </p>
                </div>
              )}
              {messages.filter(msg => {
                if (msg.role === "model") return msg.agentId === activePersona;
                return true; 
              }).map((msg, i) => {
                const isUser = msg.role === "user";
                const persona = PERSONAS.find(p => p.id === (msg.agentId || "log"));
                
                return (
                  <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"} items-end space-x-2 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    {!isUser && (
                      <div className={`w-7 h-7 rounded-full ${persona?.color || "bg-slate-600"} flex items-center justify-center text-white text-[10px] shadow-sm mb-1 flex-shrink-0`}>
                        {persona?.icon}
                      </div>
                    )}
                    <div 
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap shadow-sm ${
                        isUser 
                          ? "bg-blue-600 text-white rounded-br-sm" 
                          : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-zinc-700 rounded-bl-sm"
                      }`}
                    >
                      {!isUser && (
                        <div className="text-[9px] font-bold mb-1 opacity-50 uppercase tracking-wider">
                          {persona?.name || "LOG"} ({persona?.role || "秘書"})
                        </div>
                      )}
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start items-end space-x-2">
                  <div className={`w-7 h-7 rounded-full ${PERSONAS.find(p => p.id === activePersona)?.color} flex items-center justify-center text-white mb-1 animate-pulse`}>
                    {PERSONAS.find(p => p.id === activePersona)?.icon}
                  </div>
                  <div className="bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
                    <Loader2 size={16} className="animate-spin text-blue-500" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-white dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800">
              <div className="flex items-end space-x-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`${PERSONAS.find(p => p.id === activePersona)?.name}にメッセージ...`}
                  className="flex-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-[13px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none max-h-32 min-h-[44px]"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-zinc-800 transition-all shadow-lg active:scale-95"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
