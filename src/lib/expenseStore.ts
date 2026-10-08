import { Expense, UserBalance, DebtSettlement, SettlementConfirmation } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';
import { EXPENSE_USERS } from './constants';

const LOCAL_EXPENSES_KEY = 'katzen_expenses_v1';
const LOCAL_SETTLEMENTS_KEY = 'katzen_settlements_v1';

// Fetch all expenses
export async function fetchExpenses(): Promise<Expense[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as Expense[];
      }
    } catch (e) {
      console.error('Supabase expenses fetch error:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(LOCAL_EXPENSES_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }

  return [];
}

// Add new expense
export async function addExpense(params: {
  paid_by: string;
  amount: number;
  description: string;
  customDate?: string;
}): Promise<Expense> {
  const newExpense: Expense = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    created_at: params.customDate || new Date().toISOString(),
    paid_by: params.paid_by,
    amount: Number(params.amount.toFixed(2)),
    description: params.description.trim() || 'Katzen-Bedarf',
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([newExpense])
        .select()
        .single();

      if (!error && data) {
        return data as Expense;
      }
    } catch (e) {
      console.error('Supabase expense insert error:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const current = await fetchExpenses();
      const updated = [newExpense, ...current];
      localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  }

  return newExpense;
}

// Remove expense
export async function removeExpense(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('expenses').delete().eq('id', id);
    } catch (e) {
      console.error(e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const current = await fetchExpenses();
      const filtered = current.filter((item) => item.id !== id);
      localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error(e);
    }
  }
}

// Fetch confirmed settlement payments
export async function fetchSettlementConfirmations(): Promise<SettlementConfirmation[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as SettlementConfirmation[];
      }
    } catch (e) {
      console.error('Supabase settlements fetch error:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(LOCAL_SETTLEMENTS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }

  return [];
}

// Confirm that money has been transferred / received
export async function confirmSettlementPayment(params: {
  month: string;
  from_user: string;
  to_user: string;
  amount: number;
}): Promise<SettlementConfirmation> {
  const newConfirmation: SettlementConfirmation = {
    id: `settle_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    created_at: new Date().toISOString(),
    month: params.month,
    from_user: params.from_user,
    to_user: params.to_user,
    amount: Number(params.amount.toFixed(2)),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('settlements')
        .insert([newConfirmation])
        .select()
        .single();

      if (!error && data) {
        return data as SettlementConfirmation;
      }
    } catch (e) {
      console.error('Supabase settlement insert error:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const current = await fetchSettlementConfirmations();
      const updated = [newConfirmation, ...current];
      localStorage.setItem(LOCAL_SETTLEMENTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  }

  return newConfirmation;
}

// Delete confirmation (undo)
export async function removeSettlementConfirmation(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('settlements').delete().eq('id', id);
    } catch (e) {
      console.error(e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const current = await fetchSettlementConfirmations();
      const filtered = current.filter((item) => item.id !== id);
      localStorage.setItem(LOCAL_SETTLEMENTS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error(e);
    }
  }
}

// Calculate settlements taking month and confirmations into account
export function calculateSettlements(
  expenses: Expense[],
  monthKey: string,
  confirmedSettlements: SettlementConfirmation[] = []
): {
  total: number;
  perPerson: number;
  balances: UserBalance[];
  openSettlements: DebtSettlement[];
  paidSettlements: DebtSettlement[];
} {
  const total = Number(expenses.reduce((sum, e) => sum + Number(e.amount), 0).toFixed(2));
  const memberCount = EXPENSE_USERS.length; // 5 people (excluding Lennart)
  const perPerson = memberCount > 0 ? Number((total / memberCount).toFixed(2)) : 0;

  // Calculate what each of the 5 people paid
  const paidMap: Record<string, number> = {};
  for (const user of EXPENSE_USERS) {
    paidMap[user] = 0;
  }

  for (const exp of expenses) {
    if (paidMap[exp.paid_by] !== undefined) {
      paidMap[exp.paid_by] += Number(exp.amount);
    }
  }

  // Create balances
  const balances: UserBalance[] = EXPENSE_USERS.map((user) => {
    const paid = Number(paidMap[user].toFixed(2));
    const balance = Number((paid - perPerson).toFixed(2));
    return {
      userName: user,
      paid,
      share: perPerson,
      balance,
    };
  });

  // Calculate debt settlements
  const debtors: { user: string; amount: number }[] = [];
  const creditors: { user: string; amount: number }[] = [];

  for (const b of balances) {
    if (b.balance < -0.01) {
      debtors.push({ user: b.userName, amount: Math.abs(b.balance) });
    } else if (b.balance > 0.01) {
      creditors.push({ user: b.userName, amount: b.balance });
    }
  }

  const allCalculated: DebtSettlement[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0.01) {
      const settlementKey = `${monthKey}_${debtor.user}_${creditor.user}`;
      allCalculated.push({
        id: settlementKey,
        month: monthKey,
        from: debtor.user,
        to: creditor.user,
        amount: Number(settledAmount.toFixed(2)),
      });
    }

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (debtor.amount <= 0.01) dIdx++;
    if (creditor.amount <= 0.01) cIdx++;
  }

  // Match against confirmations for this month
  const monthConfirmations = confirmedSettlements.filter((c) => c.month === monthKey);

  const openSettlements: DebtSettlement[] = [];
  const paidSettlements: DebtSettlement[] = [];

  for (const item of allCalculated) {
    const foundConf = monthConfirmations.find(
      (c) => c.from_user === item.from && c.to_user === item.to
    );

    if (foundConf) {
      paidSettlements.push({
        ...item,
        id: foundConf.id, // for undoing
        isPaid: true,
        paid_at: foundConf.created_at,
      });
    } else {
      openSettlements.push({
        ...item,
        isPaid: false,
      });
    }
  }

  return { total, perPerson, balances, openSettlements, paidSettlements };
}
