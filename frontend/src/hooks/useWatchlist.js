import { useState, useCallback } from 'react';

const KEY = 'rustwipe_watchlist';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

function write(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function useWatchlist() {
  const [list, setList] = useState(read);

  const toggle = useCallback((server) => {
    setList(prev => {
      const exists = prev.some(s => s.id === server.id);
      const next = exists
        ? prev.filter(s => s.id !== server.id)
        : [...prev, { id: server.id, name: server.name, country: server.country }];
      write(next);
      return next;
    });
  }, []);

  const isWatched = useCallback((id) => list.some(s => s.id === id), [list]);

  const ids = list.map(s => s.id);

  return { list, ids, toggle, isWatched };
}
