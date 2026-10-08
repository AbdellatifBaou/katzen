export type FeedingType = 'nass' | 'trocken' | 'leckerli';

export interface FeedingLog {
  id: string;
  created_at: string;
  user_name: string;
  type: FeedingType;
}
