'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FeedingLog, FeedingType, Expense, SettlementConfirmation } from '@/types';
import { USERS, EXPENSE_USERS, CAT_NAMES } from '@/lib/constants';
import { fetchFeedings, addFeeding, removeFeeding } from '@/lib/feedingStore';
import {
  fetchExpenses,
  addExpense,
  removeExpense,
  fetchSettlementConfirmations,
  confirmSettlementPayment,
  removeSettlementConfirmation,
  calculateSettlements,
} from '@/lib/expenseStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { format, isToday, parseISO, differenceInDays, addMonths, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import confetti from 'canvas-confetti';
import { playMeowSound } from '@/lib/sound';
import {
  Plus,
  Trash2,
  X,
  RotateCcw,
  Volume2,
  VolumeX,
  Receipt,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Check,
  Undo2,
} from 'lucide-react';

export default function SimpleCatFeeder() {
  const [activeTab, setActiveTab] = useState<'feeding' | 'expenses'>('feeding');

  // Feeding state
  const [feedings, setFeedings] = useState<FeedingLog[]>([]);
  const [selectedType, setSelectedType] = useState<FeedingType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Expenses & Settlement state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<SettlementConfirmation[]>([]);
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(new Date());
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expensePayer, setExpensePayer] = useState<string>(EXPENSE_USERS[0]);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  // Load sound preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('katzen_sound_enabled');
      if (saved !== null) {
        setSoundEnabled(saved === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('katzen_sound_enabled', String(next));
    } catch {
      // ignore
    }
    if (next) {
      playMeowSound();
    }
  };

  // Load all data
  const loadData = useCallback(async () => {
    // 1. Load feedings (last 7 days)
    const feedData = await fetchFeedings();
    const now = new Date();
    const last7DaysData = feedData.filter((item) => {
      try {
        const itemDate = parseISO(item.created_at);
        return differenceInDays(now, itemDate) < 7;
      } catch {
        return false;
      }
    });
    setFeedings(last7DaysData);

    // 2. Load expenses & settlements
    const expData = await fetchExpenses();
    setExpenses(expData);

    const settData = await fetchSettlementConfirmations();
    setSettlements(settData);
  }, []);

  useEffect(() => {
    loadData();

    // Supabase realtime subscriptions
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('realtime_all_tables')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'feedings' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newRecord = payload.new as FeedingLog;
              setFeedings((prev) => [newRecord, ...prev.filter((i) => i.id !== newRecord.id)]);
            } else if (payload.eventType === 'DELETE') {
              const delId = (payload.old as { id: string }).id;
              setFeedings((prev) => prev.filter((i) => i.id !== delId));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'expenses' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newRecord = payload.new as Expense;
              setExpenses((prev) => [newRecord, ...prev.filter((i) => i.id !== newRecord.id)]);
            } else if (payload.eventType === 'DELETE') {
              const delId = (payload.old as { id: string }).id;
              setExpenses((prev) => prev.filter((i) => i.id !== delId));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'settlements' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newRecord = payload.new as SettlementConfirmation;
              setSettlements((prev) => [newRecord, ...prev.filter((i) => i.id !== newRecord.id)]);
            } else if (payload.eventType === 'DELETE') {
              const delId = (payload.old as { id: string }).id;
              setSettlements((prev) => prev.filter((i) => i.id !== delId));
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

  // Today's feedings
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
  const kloStats = getStats('klo');

  // Submit feeding/toilet action
  const handleApproveFeeding = async (userName: string) => {
    if (!selectedType || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const newEntry = await addFeeding(selectedType, userName);
      setFeedings((prev) => [newEntry, ...prev.filter((i) => i.id !== newEntry.id)]);

      if (soundEnabled) {
        playMeowSound();
      }

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

  const handleDeleteFeeding = async (id: string) => {
    if (confirm('Diesen Eintrag wirklich löschen?')) {
      await removeFeeding(id);
      setFeedings((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const handleResetWeek = async () => {
    if (confirm('Möchtest du alle Fütterungen der letzten 7 Tage zurücksetzen?')) {
      for (const f of feedings) {
        await removeFeeding(f.id);
      }
      setFeedings([]);
    }
  };

  // Submit new expense
  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseAmount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Bitte einen gültigen Betrag eingeben');
      return;
    }

    try {
      setExpenseSubmitting(true);
      const newExp = await addExpense({
        paid_by: expensePayer,
        amount: amountNum,
        description: expenseDesc.trim() || 'Katzen-Einkauf',
      });

      setExpenses((prev) => [newExp, ...prev.filter((i) => i.id !== newExp.id)]);

      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.8 },
      });

      setExpenseAmount('');
      setExpenseDesc('');
      setIsExpenseModalOpen(false);
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Diesen Ausgabe-Eintrag wirklich löschen?')) {
      await removeExpense(id);
      setExpenses((prev) => prev.filter((i) => i.id !== id));
    }
  };

  // Settlement Confirmations (Als bezahlt markieren / rückgängig machen)
  const currentMonthKey = format(selectedMonthDate, 'yyyy-MM');

  const handleConfirmPayment = async (fromUser: string, toUser: string, amount: number) => {
    if (confirm(`Bestätigen, dass ${fromUser} ${amount.toFixed(2)} € an ${toUser} bezahlt hat?`)) {
      const conf = await confirmSettlementPayment({
        month: currentMonthKey,
        from_user: fromUser,
        to_user: toUser,
        amount,
      });
      setSettlements((prev) => [conf, ...prev.filter((s) => s.id !== conf.id)]);
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
      });
    }
  };

  const handleUndoPayment = async (confirmationId: string) => {
    if (confirm('Zahlungsbestätigung wirklich rückgängig machen?')) {
      await removeSettlementConfirmation(confirmationId);
      setSettlements((prev) => prev.filter((s) => s.id !== confirmationId));
    }
  };

  // Filter expenses by selected month
  const selectedMonthExpenses = expenses.filter((e) => {
    try {
      const expDate = parseISO(e.created_at);
      return (
        expDate.getMonth() === selectedMonthDate.getMonth() &&
        expDate.getFullYear() === selectedMonthDate.getFullYear()
      );
    } catch {
      return false;
    }
  });

  const settlementData = calculateSettlements(
    selectedMonthExpenses,
    currentMonthKey,
    settlements
  );

  const getTypeLabel = (type: FeedingType) => {
    if (type === 'nass') return 'Nassfutter';
    if (type === 'trocken') return 'Trockenfutter';
    if (type === 'leckerli') return 'Leckerlies';
    return 'Toilette putzen';
  };

  const getTypeIcon = (type: FeedingType) => {
    if (type === 'nass') return '🥣';
    if (type === 'trocken') return '🍪';
    if (type === 'leckerli') return '🐟';
    return '🧹';
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-10">
      {/* Top Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 sticky top-0 z-20 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>🐱</span> {CAT_NAMES}
            </h1>
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
              Familien-Manager
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleSound}
              className={`p-2 rounded-full border transition-all active:scale-95 ${
                soundEnabled
                  ? 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-950/60 dark:border-orange-800 dark:text-orange-400'
                  : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
              }`}
              title={soundEnabled ? 'Miau-Ton: An' : 'Ton: Aus'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-md mx-auto mt-3 grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
          <button
            onClick={() => setActiveTab('feeding')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'feeding'
                ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>🥣</span> Fütterung & Klo
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'expenses'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>💰</span> Katzen-Kasse
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md w-full mx-auto px-4 py-4 space-y-3 flex-1">
        {/* ================= TAB 1: FÜTTERUNG & TOILETTE ================= */}
        {activeTab === 'feeding' && (
          <div className="space-y-3 animate-fadeIn">
            {/* 1. NASSFUTTER */}
            <div
              onClick={() => setSelectedType('nass')}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 text-2xl bg-orange-100 dark:bg-orange-950/60 rounded-2xl flex items-center justify-center">
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {nassStats.last
                      ? `Zuletzt um ${nassStats.timeStr} Uhr von ${nassStats.last.user_name}`
                      : 'Heute noch nicht gefüttert'}
                  </p>
                </div>
              </div>
              <button className="w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold shadow-sm">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* 2. TROCKENFUTTER */}
            <div
              onClick={() => setSelectedType('trocken')}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 text-2xl bg-amber-100 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center">
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {trockenStats.last
                      ? `Zuletzt um ${trockenStats.timeStr} Uhr von ${trockenStats.last.user_name}`
                      : 'Heute noch nicht aufgefüllt'}
                  </p>
                </div>
              </div>
              <button className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* 3. LECKERLIES */}
            <div
              onClick={() => setSelectedType('leckerli')}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 text-2xl bg-pink-100 dark:bg-pink-950/60 rounded-2xl flex items-center justify-center">
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {leckerliStats.last
                      ? `Zuletzt um ${leckerliStats.timeStr} Uhr von ${leckerliStats.last.user_name}`
                      : 'Heute noch keine Leckerlies'}
                  </p>
                </div>
              </div>
              <button className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold shadow-sm">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* 4. TOILETTE PUTZEN */}
            <div
              onClick={() => setSelectedType('klo')}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 text-2xl bg-teal-100 dark:bg-teal-950/60 rounded-2xl flex items-center justify-center">
                  🧹
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Toilette putzen
                    </h2>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        kloStats.count > 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {kloStats.count > 0 ? `${kloStats.count}x sauber` : 'Noch nicht'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {kloStats.last
                      ? `Zuletzt um ${kloStats.timeStr} Uhr von ${kloStats.last.user_name}`
                      : 'Heute noch nicht gereinigt'}
                  </p>
                </div>
              </div>
              <button className="w-9 h-9 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold shadow-sm">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* TODAY'S TIMELINE */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Heute erledigt ({todayFeedings.length})
                </h3>
                {feedings.length > 0 && (
                  <button
                    onClick={handleResetWeek}
                    className="text-[11px] text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    7-Tage Reset
                  </button>
                )}
              </div>

              {todayFeedings.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 text-center border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
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
                            <span className="text-[11px] text-slate-400">{time} Uhr</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteFeeding(item.id)}
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
          </div>
        )}

        {/* ================= TAB 2: KATZEN-KASSE & AUSGABEN ================= */}
        {activeTab === 'expenses' && (
          <div className="space-y-4 animate-fadeIn">
            {/* MONTH SWITCHER HEADER */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <button
                onClick={() => setSelectedMonthDate((prev) => subMonths(prev, 1))}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
                title="Vorheriger Monat"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="text-center">
                <span className="text-sm font-black text-slate-900 dark:text-white block">
                  {format(selectedMonthDate, 'MMMM yyyy', { locale: de })}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {format(selectedMonthDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM')
                    ? 'Aktueller Monat'
                    : 'Vergangener Monat (Archiv)'}
                </span>
              </div>

              <button
                onClick={() => setSelectedMonthDate((prev) => addMonths(prev, 1))}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
                title="Nächster Monat"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* MONTH TOTAL BANNER */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-5 shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4" />
                  Monats-Übersicht
                </span>
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
                  5 Personen (ohne Lennart)
                </span>
              </div>

              <div className="flex items-baseline justify-between mt-1">
                <div>
                  <p className="text-3xl font-black">{settlementData.total.toFixed(2)} €</p>
                  <p className="text-xs text-emerald-100 font-medium mt-0.5">
                    Gesamtausgaben in {format(selectedMonthDate, 'MMMM', { locale: de })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{settlementData.perPerson.toFixed(2)} €</p>
                  <p className="text-[11px] text-emerald-100">pro Person</p>
                </div>
              </div>

              {/* Add Expense Button */}
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="w-full mt-4 py-3 bg-white text-emerald-800 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all hover:bg-emerald-50"
              >
                <Plus className="w-4 h-4" /> + Ausgabe / Einkauf eintragen
              </button>
            </div>

            {/* WHO OWES WHOM (ABRECHNUNG & BEZAHL-BESTÄTIGUNG) */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span>🔄</span> Wer schuldet wem was?
                </h3>
              </div>

              {/* 1. Offene Schulden */}
              {settlementData.openSettlements.length === 0 ? (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                    {settlementData.total === 0
                      ? 'Keine Ausgaben in diesem Monat vorhanden.'
                      : 'Alle Schulden für diesen Monat sind vollständig bezahlt & ausgeglichen! 🎉'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-400 font-medium">Offene Überweisungen:</p>
                  {settlementData.openSettlements.map((s) => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <span className="text-rose-600 dark:text-rose-400">{s.from}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-emerald-600 dark:text-emerald-400">{s.to}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {s.amount.toFixed(2)} €
                        </span>
                      </div>

                      {/* Pay / Settle Button */}
                      <button
                        onClick={() => handleConfirmPayment(s.from, s.to, s.amount)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        title="Zahlung bestätigen"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Bezahlt</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 2. Bereits beglichene Zahlungen */}
              {settlementData.paidSettlements.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Bereits beglichene Zahlungen ({settlementData.paidSettlements.length}):
                  </p>
                  <div className="space-y-1.5">
                    {settlementData.paidSettlements.map((s) => (
                      <div
                        key={s.id}
                        className="px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            ✓ {s.from} ➜ {s.to}: {s.amount.toFixed(2)} €
                          </span>
                          <span className="text-[10px] text-slate-400">(Erhalten)</span>
                        </div>

                        <button
                          onClick={() => handleUndoPayment(s.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Rückgängig machen"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Salden-Übersicht */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold text-slate-400 mb-2">Salden-Übersicht:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {settlementData.balances.map((b) => {
                    const isPlus = b.balance > 0.01;
                    const isMinus = b.balance < -0.01;
                    return (
                      <div
                        key={b.userName}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs border border-slate-100 dark:border-slate-800"
                      >
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {b.userName}
                        </span>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">
                            Gezahlt: {b.paid.toFixed(2)} €
                          </span>
                          <span
                            className={`font-black text-xs ${
                              isPlus
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isMinus
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {isPlus
                              ? `+${b.balance.toFixed(2)} € (bekommt)`
                              : isMinus
                              ? `${b.balance.toFixed(2)} € (schuldet)`
                              : '0.00 € (ausgeglichen)'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* EXPENSES HISTORY FOR SELECTED MONTH */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Einkäufe im {format(selectedMonthDate, 'MMMM yyyy', { locale: de })} ({selectedMonthExpenses.length})
              </h3>

              {selectedMonthExpenses.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Keine Einkäufe in diesem Monat erfasst.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedMonthExpenses.map((exp) => {
                    let dateStr = '';
                    try {
                      dateStr = format(parseISO(exp.created_at), 'd. MMM, HH:mm', { locale: de });
                    } catch {
                      dateStr = '';
                    }
                    return (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {exp.description}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Bezahlt von <span className="font-semibold text-emerald-600 dark:text-emerald-400">{exp.paid_by}</span> • {dateStr}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {Number(exp.amount).toFixed(2)} €
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 active:scale-90 transition-all"
                            title="Löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL: WHO IS FEEDING / CLEANING? ================= */}
      {selectedType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{getTypeIcon(selectedType)}</span>
                  {getTypeLabel(selectedType)}
                </h3>
                <p className="text-xs text-slate-500">Wer hat es gerade gemacht?</p>
              </div>
              <button
                onClick={() => setSelectedType(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* All 6 Persons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {USERS.map((name) => (
                <button
                  key={name}
                  disabled={isSubmitting}
                  onClick={() => handleApproveFeeding(name)}
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

      {/* ================= MODAL: ADD EXPENSE ================= */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>💰</span> Neue Ausgabe eintragen
                </h3>
                <p className="text-xs text-slate-500">Wird durch 5 geteilt (ohne Lennart)</p>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-3.5">
              {/* Amount */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Betrag (€)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="z. B. 24.99"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full text-lg font-black px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Was wurde gekauft?
                </label>
                <input
                  type="text"
                  placeholder="z. B. Katzenstreu, Nassfutter Dose..."
                  required
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full text-xs font-medium px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Who paid? (5 people, excluding Lennart) */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Wer hat bezahlt?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPENSE_USERS.map((user) => (
                    <button
                      type="button"
                      key={user}
                      onClick={() => setExpensePayer(user)}
                      className={`py-2 px-2.5 rounded-xl font-bold text-xs border transition-all ${
                        expensePayer === user
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {user}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={expenseSubmitting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {expenseSubmitting ? 'Wird gespeichert...' : 'Ausgabe speichern'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
