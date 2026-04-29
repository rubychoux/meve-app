import { Linking } from 'react-native';
import { supabase } from './supabase';

export type AffiliateTarget = 'oliveyoung';

export interface AffiliateClickMeta {
  source: string; // e.g. scan_result | ingredient_result | routine | product_card
  item_name?: string;
  item_id?: string;
}

function withUtm(url: string, params: Record<string, string>): string {
  const hasQuery = url.includes('?');
  const base = url + (hasQuery ? '&' : '?');
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return base + qs;
}

export function oliveYoungSearchDeepLink(query: string, meta: AffiliateClickMeta): string {
  const base = `https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query=${encodeURIComponent(query)}`;
  return withUtm(base, {
    utm_source: 'meve',
    utm_medium: 'affiliate',
    utm_campaign: 'oliveyoung',
    utm_content: meta.source,
  });
}

export async function logAffiliateClick(target: AffiliateTarget, url: string, meta: AffiliateClickMeta) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id ?? null;
    await supabase.from('affiliate_clicks').insert({
      user_id: userId,
      target,
      url,
      source: meta.source,
      item_name: meta.item_name ?? null,
      item_id: meta.item_id ?? null,
    });
  } catch (e) {
    console.warn('[affiliate_clicks] insert failed (non-fatal):', e);
  }
}

export async function openOliveYoungSearch(query: string, meta: AffiliateClickMeta) {
  const url = oliveYoungSearchDeepLink(query, meta);
  await logAffiliateClick('oliveyoung', url, meta);
  await Linking.openURL(url);
}

