import { NoticeMessage } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';

const LOCAL_NOTICE_KEY = 'katzen_latest_notice_v1';

export async function fetchLatestNotice(): Promise<NoticeMessage | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('feedings')
        .select('id, created_at, user_name, notes')
        .eq('type', 'notice')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const item = data[0];
        const notice: NoticeMessage = {
          id: item.id,
          created_at: item.created_at,
          user_name: item.user_name,
          message: item.notes || '',
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_NOTICE_KEY, JSON.stringify(notice));
        }
        return notice;
      } else if (!error && data && data.length === 0) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(LOCAL_NOTICE_KEY);
        }
        return null;
      }
    } catch (e) {
      console.error('Fetch notice error:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(LOCAL_NOTICE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }

  return null;
}

export async function postNotice(userName: string, message: string): Promise<NoticeMessage> {
  const newNotice: NoticeMessage = {
    id: `notice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    created_at: new Date().toISOString(),
    user_name: userName,
    message: message.trim(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('feedings').insert([{
        id: newNotice.id,
        created_at: newNotice.created_at,
        user_name: newNotice.user_name,
        user_id: newNotice.user_name,
        type: 'notice',
        notes: newNotice.message,
      }]);

      // Keep DB clean: remove older notice rows so only the latest is kept
      await supabase.from('feedings').delete().eq('type', 'notice').neq('id', newNotice.id);
    } catch (e) {
      console.error('Post notice error:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_NOTICE_KEY, JSON.stringify(newNotice));
    } catch (e) {
      console.error(e);
    }
  }

  return newNotice;
}

export async function deleteNotice(id?: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      if (id) {
        await supabase.from('feedings').delete().eq('id', id);
      } else {
        await supabase.from('feedings').delete().eq('type', 'notice');
      }
    } catch (e) {
      console.error('Delete notice error:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_NOTICE_KEY);
    } catch (e) {
      console.error(e);
    }
  }
}
