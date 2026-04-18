"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, getRecentChatMessages, saveChatMessage } from "@/lib/firebase/chat";
import { chatWithAIAction } from "@/app/actions";
import { getBucketList } from "@/lib/firebase/bucketList";
import { getDictionary } from "@/lib/firebase/dictionary";
import { getUserProfile } from "@/lib/firebase/profile";
import { getDiaryEntry } from "@/lib/firebase/entries";

interface ChatWindowProps {
  userId: string;
  dateStr: string;
}

export function ChatWindow({ userId, dateStr }: ChatWindowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 初回ロード時に履歴を取得
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadMessages();
    }
  }, [isOpen, userId]);

  // 新しいメッセージが来たら一番下へスクロール
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
    setInput("");

    // 楽観的UI更新
    const tempUserMsg: ChatMessage = {
      role: "user",
      content: userMessage,
      // @ts-ignore (FirestoreのTimestampと完全互換ではないがUI表示用にはOK)
      createdAt: { toDate: () => new Date() }
    };
    const newHistory = [...messages, tempUserMsg];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      // ユーザーのメッセージをFirestoreに保存（クライアント側なのでAuthが有効）
      await saveChatMessage(userId, "user", userMessage);

      // コンテキストの取得
      const [bucketList, dictionary, profile, todaysEntry] = await Promise.all([
        getBucketList(userId),
        getDictionary(userId),
        getUserProfile(userId),
        getDiaryEntry(userId, dateStr)
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

      const pastContext = "（過去の出来事は未ロード）"; // 今回の実装では一旦省略 または過去1週間等取得してもOK

      // @ts-ignore
      const { getUserToken } = await import("@/lib/firebase/tokens");
      const googleToken = await getUserToken(userId);

      const result = await chatWithAIAction(
        userId,
        userMessage,
        messages, // 古い履歴も含めて送信
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

      if (result.success && result.reply) {
        // AIの返信をFirestoreに保存
        await saveChatMessage(userId, "model", result.reply);

        const tempAiMsg: ChatMessage = {
          role: "model",
          content: result.reply,
          // @ts-ignore
          createdAt: { toDate: () => new Date() }
        };
        setMessages([...newHistory, tempAiMsg]);
      } else {
        alert("エラーが発生しました: " + result.error);
      }
    } catch (error) {
      console.error(error);
      alert("通信エラー");
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
            className="fixed bottom-6 right-6 w-full max-w-sm h-[600px] max-h-[80vh] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl rounded-2xl flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                  <SparklesIcon />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">AI Companion</h3>
                  <p className="text-[10px] text-slate-500">外部脳 チーム</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-zinc-900/50">
              {messages.length === 0 && !isLoading && (
                <div className="text-center text-xs text-slate-400 mt-10">
                  質問や相談を入力してください。<br/>今日の日記や過去の記録を踏まえて回答します。
                </div>
              )}
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                return (
                  <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div 
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                        isUser 
                          ? "bg-blue-600 text-white rounded-br-sm" 
                          : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700 rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <Loader2 size={16} className="animate-spin text-blue-500" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
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
                  placeholder="メッセージを入力..."
                  className="flex-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none max-h-32 min-h-[44px]"
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = Math.min(target.scrollHeight, 120) + "px";
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-zinc-800 transition-colors"
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

function SparklesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  );
}
