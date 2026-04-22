"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, Shield, Zap, Sword, ClipboardList, Maximize2, Minimize2, Mic, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, getRecentChatMessages, saveChatMessage, deleteChatHistory } from "@/lib/firebase/chat";
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
  const [isMaximized, setIsMaximized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [size, setSize] = useState({ width: 384, height: 640 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

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
    const msgs = await getRecentChatMessages(userId, 50);
    setMessages(msgs);
    setIsLoading(false);
  };

  // 音声認識の初期化
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "ja-JP";

        recognitionRef.current.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setInput(prev => prev + transcript);
        };
      }
    }
  }, []);

  const handleMicStart = () => {
    if (recognitionRef.current) {
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  const handleMicEnd = () => {
    if (recognitionRef.current) {
      setIsRecording(false);
      recognitionRef.current.stop();
    }
  };

  const handleClear = async () => {
    if (!window.confirm("これまでの会話履歴をすべて消去しますか？\nこの操作は取り消せません。")) return;
    
    setIsLoading(true);
    try {
      await deleteChatHistory(userId);
      setMessages([]);
    } catch (error: any) {
      alert("エラーが発生しました: " + (error.message || "詳細不明"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");

    const tempUserMsg: ChatMessage = {
      role: "user",
      content: userMessage,
      // @ts-ignore
      createdAt: { toDate: () => new Date() }
    };
    setMessages(prev => [...prev, tempUserMsg]);
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
        profileContext = `持病:${profile.medicalHistory || "なし"}, 家族構成:${profile.familyStructure || "未設定"}, 仕事内容:${profile.jobDescription || "未設定"}, 趣味・交流:${profile.hobbies || "未設定"}, 経歴:${historyStr}`;
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
        messages.slice(-10), // コンテキストとして直近のメッセージを渡す
        {
          bucketListContext,
          dictionaryContext,
          pastContext,
          profileContext,
          todaysDiaryContext,
        },
        googleToken || null,
        dateStr
      );

      if (result.success) {
        const addedMsgs: ChatMessage[] = [];
        for (const reply of result.replies) {
          await saveChatMessage(userId, "model", reply.content, (reply as any).agentId);
          addedMsgs.push({
            ...reply,
            // @ts-ignore
            createdAt: { toDate: () => new Date() }
          });
          // 少し遅延をおいて表示させて「順番に話している感」を出す
          setMessages(prev => [...prev, addedMsgs[addedMsgs.length - 1]]);
          await new Promise(res => setTimeout(res, 800));
        }

        // ツール呼び出し（日付ジャンプ）の処理
        if (result.toolCall?.name === "jump_to_date" && onDateChange) {
          onDateChange(result.toolCall.args.date);
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

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(320, startWidth + (startX - moveEvent.clientX));
      const newHeight = Math.max(400, startHeight + (startY - moveEvent.clientY));
      setSize({ width: newWidth, height: newHeight });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
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
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              width: isMaximized ? "100%" : size.width,
              height: isMaximized ? "100%" : size.height,
              right: isMaximized ? 0 : 24,
              bottom: isMaximized ? 0 : 24,
              borderRadius: isMaximized ? 0 : 16
            }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col z-50 overflow-hidden"
            style={{ maxWidth: isMaximized ? "100%" : "95vw", maxHeight: isMaximized ? "100%" : "90vh" }}
          >
            {/* Resize handles (only when not maximized) */}
            {!isMaximized && (
              <>
                <div 
                  onMouseDown={handleResize}
                  className="absolute top-0 left-0 w-4 h-full cursor-ew-resize z-10" 
                />
                <div 
                  onMouseDown={handleResize}
                  className="absolute top-0 left-0 w-full h-4 cursor-ns-resize z-10" 
                />
                <div 
                  onMouseDown={handleResize}
                  className="absolute top-0 left-0 w-6 h-6 cursor-nw-resize z-10" 
                />
              </>
            )}

            <div className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <div className="flex justify-between items-center px-4 pt-3 pb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                    <ClipboardList size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">ChampionMaker</h3>
                    <p className="text-[10px] text-slate-500">軍師会議：外部脳チーム連携中</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button 
                    onClick={handleClear}
                    className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-red-500 transition-colors"
                    title="会話をクリア"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button 
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400"
                    title={isMaximized ? "縮小" : "最大化"}
                  >
                    {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex px-3 pb-2 space-x-2 overflow-x-auto">
                {PERSONAS.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center space-x-1.5 px-2 py-1 bg-white dark:bg-zinc-800 rounded-full border border-slate-200 dark:border-zinc-700 shadow-sm shrink-0"
                  >
                    <div className={`w-4 h-4 rounded-full ${p.color} flex items-center justify-center text-white`}>
                      {p.icon}
                    </div>
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">{p.name}</span>
                  </div>
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
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const persona = PERSONAS.find(p => p.id === (msg.agentId || "log"));
                
                return (
                  <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"} items-start space-x-2 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    {!isUser && (
                      <div className={`w-8 h-8 rounded-full ${persona?.color || "bg-slate-600"} flex items-center justify-center text-white text-[11px] shadow-md mt-1 flex-shrink-0 border-2 border-white dark:border-zinc-800`}>
                        {persona?.icon}
                      </div>
                    )}
                    <div 
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap shadow-md ${
                        isUser 
                          ? "bg-blue-600 text-white rounded-tr-none" 
                          : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-zinc-700 rounded-tl-none font-medium"
                      }`}
                    >
                      {!isUser && (
                        <div className="flex items-center space-x-2 mb-1.5">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${persona?.color} text-white`}>
                            {persona?.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {persona?.role}
                          </span>
                        </div>
                      )}
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start items-start space-x-2">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-slate-400 animate-pulse mt-1">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                  <div className="bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl rounded-tl-none px-5 py-3 shadow-md italic text-slate-400 text-sm">
                    軍師が協議中...
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-end space-x-2 relative">
                <button
                  onMouseDown={handleMicStart}
                  onMouseUp={handleMicEnd}
                  onMouseLeave={handleMicEnd}
                  className={`p-3 rounded-xl transition-all shadow-md ${
                    isRecording 
                      ? "bg-red-500 text-white scale-110 animate-pulse ring-4 ring-red-500/20" 
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  }`}
                  title="音声入力（押している間）"
                >
                  <Mic size={20} />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="会議に発言する..."
                  className="flex-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-[14px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none max-h-48 min-h-[48px]"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="p-3.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-zinc-800 transition-all shadow-lg active:scale-95"
                >
                  <Send size={20} />
                </button>
              </div>
              {isRecording && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-xl animate-bounce">
                  RECORDING...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
