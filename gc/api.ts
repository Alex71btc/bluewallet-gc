import { GC_BASE_URL } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GC_TOKEN_KEY = 'gc.jwt';
let GC_TOKEN: string | null = null;

// -------------------- token helpers --------------------

export function gcGetToken(): string | null {
  return GC_TOKEN;
}

export async function gcLoadToken(): Promise<string | null> {
  const t = await AsyncStorage.getItem(GC_TOKEN_KEY);
  GC_TOKEN = t;
  return t;
}

export async function gcSaveToken(t: string | null): Promise<void> {
  GC_TOKEN = t;
  if (t) {
    await AsyncStorage.setItem(GC_TOKEN_KEY, t);
  } else {
    await AsyncStorage.removeItem(GC_TOKEN_KEY);
  }
}

// -------------------- low-level fetch --------------------

async function fetchText(path: string, options?: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(`${GC_BASE_URL}${path}`, options);
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (GC_TOKEN) {
    headers.Authorization = `Bearer ${GC_TOKEN}`;
  }

  const { ok, status, text } = await fetchText(path, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as any),
    },
  });

  if (!ok) {
    throw new Error(`GC ${path} failed: ${status} ${text}`);
  }

  // Try JSON first; fall back to raw text
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// -------------------- public API --------------------

export async function gcHealth(): Promise<string> {
  const { ok, status, text } = await fetchText('/health');
  if (!ok) throw new Error(`GC /health failed: ${status} ${text}`);
  return text;
}

export async function gcInfo(): Promise<any> {
  return fetchJSON('/gc/info');
}

export async function gcAuthNonce(): Promise<{ nonce: string; expiresInSec: number }> {
  return fetchJSON('/gc/auth/nonce', { method: 'POST' });
}

export async function gcVerify(
  nonce: string,
  signature: string,
  address: string,
): Promise<{ ok: boolean; verified: boolean; token?: string; error?: string }> {
  return fetchJSON('/gc/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ nonce, signature, address }),
  });
}

/**
 * Protected endpoint: requires JWT saved via gcSaveToken(...)
 */
export async function gcMe(): Promise<any> {
  return fetchJSON('/gc/me');
}

/**
 * Protected endpoint: requires JWT saved via gcSaveToken(...)
 */
export async function gcPingAuth(): Promise<any> {
  return fetchJSON('/gc/ping-auth');
}
export async function gcPushRegister(platform: string, token: string): Promise<any> {
  return fetchJSON('/gc/push/register', {
    method: 'POST',
    body: JSON.stringify({ platform, token }),
  });
}

export async function gcPushMe(): Promise<any> {
  return fetchJSON('/gc/push/me');
}
