"use client";

import React, { useState, useEffect } from "react";
import { Image as ImageIcon, Camera, Check, Loader2, RefreshCcw } from "lucide-react";
import { GooglePhoto } from "@/lib/google/photos";
import { getPhotosAction } from "@/app/actions";
import { saveDiaryEntry } from "@/lib/firebase/entries";

interface PhotoCurationProps {
  userId: string;
  date: string;
  selectedPhotoIds?: string[];
  onUpdate: () => void;
}

export function PhotoCuration({ userId, date, selectedPhotoIds = [], onUpdate }: PhotoCurationProps) {
  const [photos, setPhotos] = useState<GooglePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPhotos();
  }, [userId, date]);

  const loadPhotos = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPhotosAction(userId, date);
      if (result.success) {
        setPhotos(result.data || []);
      } else {
        setError(result.error || "Failed to load photos");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const togglePhoto = async (photoId: string) => {
    const newSelectedIds = selectedPhotoIds.includes(photoId)
      ? selectedPhotoIds.filter(id => id !== photoId)
      : [...selectedPhotoIds, photoId];

    try {
      await saveDiaryEntry({
        userId,
        date,
        photos: newSelectedIds
      });
      onUpdate();
    } catch (err) {
      console.error("Failed to update photo selection:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span className="text-xs font-medium">写真を読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/50 text-center">
        <p className="text-[10px] text-red-500 mb-2">{error}</p>
        <button 
          onClick={loadPhotos}
          className="text-xs flex items-center justify-center mx-auto text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <RefreshCcw size={12} className="mr-1" />
          再試行
        </button>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
        <Camera size={32} className="mx-auto mb-2 text-slate-300 opacity-50" />
        <p className="text-xs text-slate-400">この日の写真はありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center">
          <ImageIcon size={14} className="mr-1.5 text-orange-500" />
          今日のフォトキュレーション
        </h3>
        <span className="text-[10px] text-slate-400">{photos.length}件の候補</span>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        {photos.map(photo => {
          const isSelected = selectedPhotoIds.includes(photo.id);
          return (
            <div 
              key={photo.id}
              onClick={() => togglePhoto(photo.id)}
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group shadow-sm bg-slate-200 dark:bg-zinc-800"
            >
              <img 
                src={`${photo.baseUrl}=w300-h300-c`} 
                alt="" 
                className={`w-full h-full object-cover transition-all duration-300 ${
                  isSelected ? "opacity-100 scale-100" : "opacity-60 scale-105 grayscale-[40%]"
                } group-hover:opacity-100 group-hover:scale-100`}
              />
              <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                isSelected ? "bg-orange-500 text-white scale-100 shadow-lg" : "bg-black/40 text-white/50 scale-0"
              }`}>
                <Check size={12} strokeWidth={4} />
              </div>
              {!isSelected && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
