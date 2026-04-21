"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, X, Loader2, Calendar, ChevronRight, Hash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getRecentEntries } from "@/lib/firebase/entries";
import { getDictionary } from "@/lib/firebase/dictionary";
import { DiarySearchEngine, SearchResult } from "@/lib/search";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface SearchModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onDateChange: (date: string) => void;
}

export function SearchModal({ userId, isOpen, onClose, onDateChange }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [data, setData] = useState<{ entries: any[]; dictionary: any[] } | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);

  // 検索エンジンの初期化
  const engine = useMemo(() => {
    if (!data) return null;
    return new DiarySearchEngine(data.entries, data.dictionary);
  }, [data]);

  // モーダルが開かれたときにデータを一括取得（キャッシュ）
  useEffect(() => {
    if (isOpen && !data && !isDataLoading) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsDataLoading(true);
    try {
      // サーバーアクションを経由せず、クライアント側SDKで直接取得
      const [entries, dictionary] = await Promise.all([
        getRecentEntries(userId, 1000), // 十分に大きな数で全取得を試みる
        getDictionary(userId)
      ]);

      setData({
        entries: entries || [],
        dictionary: dictionary || []
      });
    } catch (error) {
      console.error("Search data load failed:", error);
    } finally {
      setIsDataLoading(false);
    }
  };

  // 検索実行
  useEffect(() => {
    if (engine && query.trim()) {
      const found = engine.search(query);
      setResults(found);
    } else {
      setResults([]);
    }
  }, [query, engine]);

  const handleSelect = (date: string) => {
    onDateChange(date);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 px-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: -20 }}
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* 検索ヘッダー */}
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center space-x-3">
          <Search className="text-slate-400" size={20} />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="キーワードを入力 (スペースでAND, | でOR検索)"
            className="flex-1 bg-transparent border-none outline-none text-lg text-slate-800 dark:text-slate-200 placeholder-slate-400"
          />
          {isDataLoading && <Loader2 size={18} className="animate-spin text-blue-500" />}
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* ヒント */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-zinc-950/50 flex items-center space-x-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center space-x-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            <Hash size={10} />
            <span>ナレッジ・ベース別名検索 有効</span>
          </div>
          <div className="text-[10px] text-zinc-400">
            例: 「ザリガニ 中国」「旅行 | ドライブ」
          </div>
        </div>

        {/* 結果リスト */}
        <div className="flex-1 overflow-y-auto p-2">
          {query.trim() === "" ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
              <Search size={40} className="opacity-20" />
              <p className="text-sm">お探しの出来事をキーワードで検索</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((res) => (
                <button
                  key={res.date}
                  onClick={() => handleSelect(res.date)}
                  className="w-full text-left p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all border border-transparent hover:border-slate-100 dark:hover:border-zinc-700 group flex items-start space-x-4"
                >
                  <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-500 transition-colors pt-1">
                    <Calendar size={18} />
                    <span className="text-[10px] font-bold mt-1 whitespace-nowrap">
                      {format(new Date(res.date), "MM/dd", { locale: ja })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-slate-700 dark:text-slate-200 mb-1">
                      {format(new Date(res.date), "yyyy年MM月dd日 (eee)", { locale: ja })}
                    </div>
                    <div className="space-y-1">
                      {res.snippets.home && (
                        <p className="text-xs text-slate-500 line-clamp-1">
                          <span className="text-orange-500/70 font-bold mr-1">H</span> {res.snippets.home}
                        </p>
                      )}
                      {res.snippets.work && (
                        <p className="text-xs text-slate-500 line-clamp-1">
                          <span className="text-blue-500/70 font-bold mr-1">W</span> {res.snippets.work}
                        </p>
                      )}
                      {res.snippets.hobby && (
                        <p className="text-xs text-slate-500 line-clamp-1">
                          <span className="text-emerald-500/70 font-bold mr-1">H</span> {res.snippets.hobby}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 mt-2 group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400">
              <p className="text-sm">見つかりませんでした</p>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-3 bg-slate-50 dark:bg-zinc-950 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center text-[10px] text-slate-500 px-6">
          <span>{results.length} 件のヒット</span>
          <span>手動検索モード（外部脳キャッシュ使用）</span>
        </div>
      </motion.div>
    </div>
  );
}
