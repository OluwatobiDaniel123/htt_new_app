import { useCallback, useEffect, useRef, useState } from 'react';
import { listResource, supportsResource } from '@/api/resources';

/**
 * Server-driven collection loader: one page at a time plus a real total count.
 */
export default function useCollection(entityName, query = {}, options = {}) {
  const { sort = '-created_date', limit = 50, enabled = true } = options;
  const queryKey = JSON.stringify(query || {});
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
      if (supportsResource(entityName)) {
        const page = await listResource(entityName, JSON.parse(queryKey), { sort, limit, page: 1 });
        if (cancelled) return;
        setItems(page.items || []);
        setTotal(page.total ?? page.items?.length ?? 0);
        setHasMore((page.page || 1) * (page.limit || Math.min(limit, 100)) < (page.total ?? 0));
        cursorRef.current = page.page || 1;
        setLoading(false);
        return;
      }
      throw new Error(`${entityName} is not available through the custom API.`);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError);
        setItems([]);
        setTotal(0);
        setHasMore(false);
        setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [entityName, queryKey, sort, limit, enabled, tick]);

  const loadMore = useCallback(async () => {
    if (supportsResource(entityName)) {
      if (!cursorRef.current || !hasMore) return;
      const nextPage = cursorRef.current + 1;
      setLoading(true);
      try {
        const page = await listResource(entityName, JSON.parse(queryKey), { sort, limit, page: nextPage });
        setItems((prev) => [...prev, ...(page.items || [])]);
        setHasMore(nextPage * (page.limit || Math.min(limit, 100)) < (page.total ?? 0));
        cursorRef.current = nextPage;
      } catch (loadError) { setError(loadError); }
      finally { setLoading(false); }
      return;
    }
    if (!cursorRef.current) return;
    setError(new Error(`${entityName} pagination is not available through the custom API.`));
  }, [entityName, queryKey, sort, limit, hasMore]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { items, total, loading, hasMore, loadMore, reload, setItems, error };
}
