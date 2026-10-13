export type FeedingType = 'nass' | 'trocken' | 'leckerli' | 'klo';

// All 6 members with their 2-digit PINs
export const USER_PINS: Record<string, string> = {
  '11': 'Latif',
  '12': 'Wiame',
  '31': 'Karam',
  '41': 'Adiana',
  '15': 'Romy',
  '17': 'Lennart',
};

export const USERS = [
  'Latif',
  'Wiame',
  'Karam',
  'Adiana',
  'Romy',
  'Lennart',
];

// 4 members currently share cat costs (Lennart and Romy excluded from expenses for now)
export const EXPENSE_USERS = [
  'Latif',
  'Wiame',
  'Karam',
  'Adiana',
];

export const CAT_NAMES = 'Mimi • Miscu • Luna';
