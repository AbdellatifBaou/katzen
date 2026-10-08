'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FeedingLog, FeedingType } from '@/types';
import { USERS, CAT_NAMES } from '@/lib/constants';
import { fetchFeedings, addFeeding, removeFeeding } from '@/lib/feedingStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { format, isToday, parseISO, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import confetti from 'canvas-confetti';
import { Plus, Trash2, X, RotateCcw } from 'lucide-react';

export default function SimpleCatFeeder() {
  const [feedings, setFeedings] = useState<FeedingLog[]>([]);
  const [selectedType, setSelectedType] = useState<FeedingType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load feedings & filter automatically for 7-day cycle
  const loadData = useCallback(async () => {
    const data = await fetchFeedings();
    // Auto-reset: Only keep records from the last 7 days
    const now = new Date();
    const last7DaysData = data.filter((item) => {
      try {
        const itemDate = parseISO(item.created_at);
        return differenceInDays(now, itemDate) < 7;
      } catch {
        return false;
      }
    });
    setFeedings(last7DaysData);
  }, []);

  useEffect(() => {
    loadData();

    // Supabase realtime updates across all phones
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('simple_feedings_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'feedings' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newRecord = payload.new as FeedingLog;
              setFeedings((prev) => [
                newRecord,
                ...prev.filter((i) => i.id !== newRecord.id),
              ]);
            } else if (payload.eventType === 'DELETE') {
              const delId = (payload.old as { id: string }).id;
              setFeedings((prev) => prev.filter((i) => i.id !== delId));
            }
          }
        )
        .subscribe();

      return () => {
        if (supabase) {
          supabase.removeChannel(channel);
        }
      };
    }
  }, [loadData]);

  // Filter for today
  const todayFeedings = feedings.filter((f) => {
    try {
      return isToday(parseISO(f.created_at));
    } catch {
      return false;
    }
  });

  const getStats = (type: FeedingType) => {
    const matching = todayFeedings.filter((f) => f.type === type);
    const count = matching.length;
    const last = matching[0];
    let timeStr = '';
    if (last) {
      try {
        timeStr = format(parseISO(last.created_at), 'HH:mm', { locale: de });
      } catch {
        timeStr = '';
      }
    }
    return { count, last, timeStr };
  };

  const nassStats = getStats('nass');
  const trockenStats = getStats('trocken');
  const leckerliStats = getStats('leckerli');

  // Submit feeding (Click person)
  const handleApprove = async (userName: string) => {
    if (!selectedType || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const newEntry = await addFeeding(selectedType, userName);
      setFeedings((prev) => [newEntry, ...prev.filter((i) => i.id !== newEntry.id)]);

      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.8 },
      });

      setSelectedType(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete single entry
  const handleDelete = async (id: string) => {
    if (confirm('Diesen Eintrag wirklich löschen?')) {
      await removeFeeding(id);
      setFeedings((prev) => prev.filter((i) => i.id !== id));
    }
  };

  // Manual reset of 7 days if desired
  const handleResetWeek = async () => {
    if (confirm('Möchtest du alle Fütterungen der letzten 7 Tage zurücksetzen?')) {
      for (const f of feedings) {
        await removeFeeding(f.id);
      }
      setFeedings([]);
    }
  };

  const getTypeLabel = (type: FeedingType) => {
    if (type === 'nass') return 'Nassfutter';
    if (type === 'trocken') return 'Trockenfutter';
    return 'Leckerlies';
  };

  const getTypeIcon = (type: FeedingType) => {
    if (type === 'nass') return '🥣';
    if (type === 'trocken') return '🍪';
    return '🐟';
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-8">
      {/* Top Simple Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 sticky top-0 z-20 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>🐱</span> {CAT_NAMES}
            </h1>
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
              Familien-Fütterung (7-Tage-Zyklus)
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {format(new Date(), 'd. MMMM', { locale: de })}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content - Mobile Centered */}
      <main className="max-w-md w-full mx-auto px-4 py-4 space-y-3 flex-1">
        {/* 1. NASSFUTTER BUTTON CARD */}
        <div
          onClick={() => setSelectedType('nass')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 text-3xl bg-orange-100 dark:bg-orange-950/60 rounded-2xl flex items-center justify-center p-2.5">
              🥣
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Nassfutter
                </h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    nassStats.count > 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {nassStats.count > 0 ? `${nassStats.count}x heute` : 'Noch keins'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {nassStats.last
                  ? `Zuletzt um ${nassStats.timeStr} Uhr von ${nassStats.last.user_name}`
                  : 'Heute noch nicht gefüttert'}
              </p>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold shadow-sm">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* 2. TROCKENFUTTER BUTTON CARD */}
        <div
          onClick={() => setSelectedType('trocken')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 text-3xl bg-amber-100 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center p-2.5">
              🍪
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Trockenfutter
                </h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    trockenStats.count > 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {trockenStats.count > 0 ? `${trockenStats.count}x heute` : '0x heute'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {trockenStats.last
                  ? `Zuletzt um ${trockenStats.timeStr} Uhr von ${trockenStats.last.user_name}`
                  : 'Heute noch nicht aufgefüllt'}
              </p>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* 3. LECKERLIES BUTTON CARD */}
        <div
          onClick={() => setSelectedType('leckerli')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 text-3xl bg-pink-100 dark:bg-pink-950/60 rounded-2xl flex items-center justify-center p-2.5">
              🐟
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Leckerlies
                </h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    leckerliStats.count > 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {leckerliStats.count > 0 ? `${leckerliStats.count}x heute` : '0x heute'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {leckerliStats.last
                  ? `Zuletzt um ${leckerliStats.timeStr} Uhr von ${leckerliStats.last.user_name}`
                  : 'Heute noch keine Leckerlies'}
              </p>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold shadow-sm">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* TODAY'S TIMELINE LIST */}
        <div className="pt-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Heute gegeben ({todayFeedings.length})
            </h3>
            {feedings.length > 0 && (
              <button
                onClick={handleResetWeek}
                className="text-[11px] text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                title="Woche manuell zurücksetzen"
              >
                <RotateCcw className="w-3 h-3" />
                7-Tage Reset
              </button>
            )}
          </div>

          {todayFeedings.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              Heute wurde noch nichts eingetragen.
            </div>
          ) : (
            <div className="space-y-2">
              {todayFeedings.map((item) => {
                let time = '';
                try {
                  time = format(parseISO(item.created_at), 'HH:mm', { locale: de });
                } catch {
                  time = '';
                }
                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{getTypeIcon(item.type)}</span>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{getTypeLabel(item.type)}</span>
                          <span className="text-orange-600 dark:text-orange-400 font-semibold">
                            von {item.user_name}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {time} Uhr
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 active:scale-90 transition-all"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* POPUP: WHO IS FEEDING? (APPROVE MODAL) */}
      {selectedType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{getTypeIcon(selectedType)}</span>
                  {getTypeLabel(selectedType)}
                </h3>
                <p className="text-xs text-slate-500">Wer füttert gerade?</p>
              </div>
              <button
                onClick={() => setSelectedType(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 6 Person Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {USERS.map((name) => (
                <button
                  key={name}
                  disabled={isSubmitting}
                  onClick={() => handleApprove(name)}
                  className="py-3.5 px-4 rounded-xl font-bold text-sm text-slate-800 dark:text-slate-100 bg-slate-100 hover:bg-orange-500 hover:text-white active:bg-orange-600 active:text-white dark:bg-slate-800 dark:hover:bg-orange-500 dark:hover:text-white transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <span>👤</span>
                  <span>{name}</span>
                </button>
              ))}
            </div>

            <p className="text-center text-[11px] text-slate-400">
              Klicke einfach auf deinen Namen zum Bestätigen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
