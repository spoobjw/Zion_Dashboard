import { useCallback, useRef, useState } from 'react';
export function useRequest() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(0);
  const mutations = useRef(new Set<string>());
  const request = useCallback(async (url: string, options?: RequestInit): Promise<Response | null> => {
    const mutation = options?.method && options.method !== 'GET';
    if (mutation && mutations.current.has(url)) return null;
    if (mutation) mutations.current.add(url);
    setError(''); setPending(n => n + 1);
    try {
      const response = await fetch(url, { ...options, cache: 'no-store' });
      if (!response.ok) {
        const body = await response.clone().json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${response.status}). Please try again.`);
      }
      return response;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to connect. Please try again.');
      return null;
    } finally {
      if (mutation) mutations.current.delete(url);
      setPending(n => n - 1);
    }
  }, []);
  return { request, error, busy: pending > 0 };
}
