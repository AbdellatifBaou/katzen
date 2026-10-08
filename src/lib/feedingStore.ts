import { FeedingLog, FeedingType } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';

const LOCAL_KEY = 'katzen_feedings_simple_v1';

export async function fetchFeedings(): Promise<FeedingLog[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('feedings')
        .select('id, created_at, user_name, type')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        return data as FeedingLog[];
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(LOCAL_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }

  return [];
}

export async function addFeeding(type: FeedingType, userName: string): Promise<FeedingLog> {
  const newLog: FeedingLog = {
    id: `feed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    created_at: new Date().toISOString(),
    user_name: userName,
    type: type,
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('feedings')
        .insert([{
          id: newLog.id,
          created_at: newLog.created_at,
          user_name: newLog.user_name,
          type: newLog.type,
          user_id: newLog.user_name
        }])
        .select()
        .single();

      if (!error && data) {
        return data as FeedingLog;
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const current = await fetchFeedings();
      const updated = [newLog, ...current];
      localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  }

  return newLog;
}

export async function removeFeeding(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('feedings').delete().eq('id', id);
    } catch (e) {
      console.error(e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const current = await fetchFeedings();
      const filtered = current.filter((item) => item.id !== id);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error(e);
    }
  }
}
