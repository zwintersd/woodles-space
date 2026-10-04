// In-memory SQL boundary for API and browser integration tests. The actual
// endpoint and password/session code run unchanged; Neon itself is not used.
export function scheduleStore() {
  const publications = new Map(), revisions = new Map(), sessions = new Map(), attempts = new Map();
  const calls = [];
  const copy = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  async function sql(strings, ...v) {
    const q = strings.join('?').replace(/\s+/g, ' ').trim(); calls.push({ q, values: copy(v) });
    if (q.startsWith('DELETE FROM schedule_attempts')) { for (const [key, row] of attempts) if (row.window < v[0]) attempts.delete(key); return []; }
    if (q.startsWith('DELETE FROM schedule_sessions WHERE expires_at')) { for (const [key, row] of sessions) if (row.expires_at <= Date.now()) sessions.delete(key); return []; }
    if (q.startsWith('INSERT INTO schedule_attempts')) { const key = v[0] + ':' + v[1]; const row = { attempts: (attempts.get(key)?.attempts || 0) + 1, window: v[1] }; attempts.set(key, row); return [row]; }
    if (q.startsWith('INSERT INTO schedule_sessions')) { sessions.set(v[0], { token_hash: v[0], scope: v[1], access_version: v[2], publisher_hash: v[3], expires_at: Date.now() + v[4] * 1000 }); return []; }
    if (q.startsWith('SELECT token_hash FROM schedule_sessions')) { const row = sessions.get(v[0]); return row && row.scope === v[1] && row.access_version === v[2] && row.publisher_hash === v[3] && row.expires_at > Date.now() ? [{ token_hash: row.token_hash }] : []; }
    if (q.startsWith('DELETE FROM schedule_sessions WHERE token_hash')) { const row = sessions.get(v[0]); if (row?.scope === v[1]) sessions.delete(v[0]); return []; }
    if (q.includes('FROM schedule_publications ORDER')) return [...publications.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(row => ({ id: row.id, source_id: row.source_id, version: row.version, active: row.active, expires_at: row.expires_at, updated_at: row.updated_at, learner: row.payload.plan.learner, name: row.payload.plan.name, days: row.payload.plan.days.length, items: row.payload.plan.days.reduce((sum, day) => sum + day.activities.length, 0) }));
    if (q.startsWith('SELECT') && q.includes('FROM schedule_publications WHERE id')) {
      const row = publications.get(v[0]); if (!row) return [];
      if (q.startsWith('SELECT payload, version')) return row.active && row.access_version === v[1] && (!row.expires_at || Date.parse(row.expires_at) > Date.now()) ? [copy(row)] : [];
      return [copy(row)];
    }
    if (q.startsWith('SELECT') && q.includes('FROM schedule_revisions')) {
      const rows = [...revisions.values()].filter(row => row.publication_id === v[0]);
      const selected = rows.filter(row => v.length === 1 || row.version === v[1]).sort((a, b) => b.version - a.version).slice(0, 10);
      return q.startsWith('SELECT version, published_at') ? selected.map(row => ({ version: row.version, published_at: row.published_at, name: row.payload.plan.name, learner: row.payload.plan.learner })) : selected.map(copy);
    }
    if (q.startsWith('WITH changed AS (INSERT INTO schedule_publications')) {
      if (publications.has(v[0]) || [...publications.values()].some(row => row.source_id === v[1])) return [];
      const row = { id: v[0], source_id: v[1], payload: JSON.parse(v[2]), password_hash: v[3], expires_at: v[4], version: 1, access_version: 1, active: true, created_at: now(), updated_at: now() };
      publications.set(row.id, row); revisions.set(row.id + ':1', { publication_id: row.id, version: 1, payload: copy(row.payload), published_at: now() }); return [copy(row)];
    }
    if (q.startsWith('WITH changed AS (UPDATE schedule_publications')) {
      const row = publications.get(v[4]); if (!row || row.version !== v[5]) return [];
      Object.assign(row, { payload: JSON.parse(v[0]), password_hash: v[1], expires_at: v[2], access_version: v[3], active: true, version: row.version + 1, updated_at: now() });
      revisions.set(row.id + ':' + row.version, { publication_id: row.id, version: row.version, payload: copy(row.payload), published_at: now() }); return [copy(row)];
    }
    if (q.startsWith('UPDATE schedule_publications SET password_hash')) {
      const row = publications.get(v[4]); if (!row || row.version !== v[5]) return [];
      Object.assign(row, { password_hash: v[0], expires_at: v[1], active: v[2], access_version: v[3], version: row.version + 1, updated_at: now() }); return [copy(row)];
    }
    if (q.startsWith('DELETE FROM schedule_revisions')) { const keep = [...revisions.values()].filter(row => row.publication_id === v[0]).sort((a, b) => b.version - a.version).slice(0, 10).map(row => row.version); for (const [key, row] of revisions) if (row.publication_id === v[0] && !keep.includes(row.version)) revisions.delete(key); return []; }
    throw new Error('Unexpected fixture query: ' + q);
  }
  return { sql, publications, revisions, sessions, attempts, calls };
}
