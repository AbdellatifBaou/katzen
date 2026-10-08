export type FeedingType = 'nass' | 'trocken' | 'leckerli';

export interface FeedingLog {
  id: string;
  created_at: string;
  user_name: string;
  type: FeedingType;
}

export const USERS = [
  'Latif',
  'Wiame',
  'Karam',
  'Adiana',
  'Romy',
  'Lennart',
];

export const CAT_NAMES = 'Mimi • Miscu • Luna';
