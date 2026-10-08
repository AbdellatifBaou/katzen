import { Expense, UserBalance, DebtSettlement } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';
import { EXPENSE_USERS } from './constants';

const LOCAL_EXPENSES_KEY = 'katzen_expenses_v1';

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

export async function addExpense(params: {
  paid_by: string;
  amount: number;
  description: string;
}): Promise<Expense> {
  const newExpense: Expense = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    created_at: new Date().toISOString(),
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

// Calculate balances and minimum settlement transactions for a list of expenses
export function calculateSettlements(expenses: Expense[]): {
  total: number;
  perPerson: number;
  balances: UserBalance[];
  settlements: DebtSettlement[];
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

  // Calculate who owes whom (debt settlement algorithm)
  // Positive balance = creditor (should receive money)
  // Negative balance = debtor (needs to pay money)
  const debtors: { user: string; amount: number }[] = [];
  const creditors: { user: string; amount: number }[] = [];

  for (const b of balances) {
    if (b.balance < -0.01) {
      debtors.push({ user: b.userName, amount: Math.abs(b.balance) });
    } else if (b.balance > 0.01) {
      creditors.push({ user: b.userName, amount: b.balance });
    }
  }

  const settlements: DebtSettlement[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0.01) {
      settlements.push({
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

  return { total, perPerson, balances, settlements };
}
