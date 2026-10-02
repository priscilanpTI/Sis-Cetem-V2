const API_URL = (import.meta.env.VITE_APPS_SCRIPT_URL || import.meta.env.VITE_API_URL || '').trim();

export type ApiBase = {
  sucesso: boolean;
  mensagem?: string;
};

function getApiUrl(): string {
  if (!API_URL) {
    throw new Error('URL da API não configurada. Defina VITE_APPS_SCRIPT_URL no arquivo .env.');
  }
  return API_URL;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Falha de comunicação com a API (${response.status}).`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('A API retornou uma resposta inválida.');
  }
}

function cacheKey(key: string): string {
  return `sgd-cache:${key}`;
}

type CacheEnvelope<T> = { expiresAt: number; data: T };

export function getSessionCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(cacheKey(key));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function setSessionCache<T>(key: string, data: T, ttlMs: number): void {
  try {
    const envelope: CacheEnvelope<T> = {
      expiresAt: Date.now() + ttlMs,
      data,
    };
    sessionStorage.setItem(cacheKey(key), JSON.stringify(envelope));
  } catch {
    // Cache é apenas otimização; falhas não devem interromper o sistema.
  }
}

export function clearSessionCache(prefix = ''): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(`sgd-cache:${prefix}`)) toRemove.push(key);
    }
    toRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Ignora falhas de cache.
  }
}

export async function apiGet<T extends ApiBase>(
  acao: string,
  params: Record<string, string> = {},
  cache?: { key: string; ttlMs: number }
): Promise<T> {
  if (cache) {
    const cached = getSessionCache<T>(cache.key);
    if (cached) return cached;
  }

  const url = new URL(getApiUrl());
  url.searchParams.set('acao', acao);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  });
  const parsed = await parseJson<T>(response);

  if (cache && parsed.sucesso) setSessionCache(cache.key, parsed, cache.ttlMs);
  return parsed;
}

export async function apiPost<T extends ApiBase>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });

  return parseJson<T>(response);
}
