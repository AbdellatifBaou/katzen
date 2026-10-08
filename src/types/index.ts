export type FeedingType = 'nass' | 'trocken' | 'leckerli' | 'klo';

export interface FeedingLog {
  id: string;
  created_at: string;
  user_name: string;
  type: FeedingType;
}

export interface Expense {
  id: string;
  created_at: string;
  paid_by: string;
  amount: number;
  description: string;
}

export interface DebtSettlement {
  from: string;
  to: string;
  amount: number;
}

export interface UserBalance {
  userName: string;
  paid: number;
  share: number;
  balance: number; // positive = gets back, negative = owes
}
