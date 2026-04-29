import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

function createStubSupabase() {
  const noEnv = {
    message:
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo.',
  };

  const warn = () => {
    console.warn(
      'Supabase env vars are missing. Add EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo.'
    );
  };

  const stubResult = async () => ({ data: null, error: noEnv as any, count: null as number | null });

  /**
   * Infinite fluent chain + thenable, like PostgrestBuilder, so patterns such as
   * `await supabase.from('x').select().eq().order()` or `.insert().select()` resolve safely.
   */
  function queryChain(): any {
    const exec = () => stubResult();
    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            return (onFulfilled: any, onRejected: any) => exec().then(onFulfilled, onRejected);
          }
          if (prop === 'catch') {
            return (onRejected: any) => exec().catch(onRejected);
          }
          if (prop === 'finally') {
            return (onFinally: any) => exec().finally(onFinally);
          }
          return () => queryChain();
        },
      }
    );
  }

  return {
    auth: {
      onAuthStateChange: () => {
        warn();
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getSession: async () => {
        warn();
        return { data: { session: null }, error: noEnv as any };
      },
      getUser: async () => {
        warn();
        return { data: { user: null }, error: noEnv as any };
      },
      signUp: async () => {
        warn();
        return { data: { user: null, session: null }, error: noEnv as any };
      },
      signInWithPassword: async () => {
        warn();
        return { data: { user: null, session: null }, error: noEnv as any };
      },
      signInWithOtp: async () => {
        warn();
        return { data: { user: null, session: null }, error: noEnv as any };
      },
      verifyOtp: async () => {
        warn();
        return { data: { user: null, session: null }, error: noEnv as any };
      },
      resend: async () => {
        warn();
        return { data: {}, error: noEnv as any };
      },
      signOut: async () => {
        return { error: null };
      },
    },
    from: () => queryChain(),
  } as any;
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : createStubSupabase();
