const MAX_ENTRIES_PER_SESSION = 1000;
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

interface SessionData {
  entries: Map<string, unknown>;
  lastAccess: number;
}

const sessions = new Map<string, SessionData>();

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of sessions) {
    if (now - data.lastAccess > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000).unref();

function getSession(sessionId: string): SessionData {
  let session = sessions.get(sessionId);
  if (!session) {
    session = { entries: new Map(), lastAccess: Date.now() };
    sessions.set(sessionId, session);
  }
  session.lastAccess = Date.now();
  return session;
}

export const SessionStateStore = {
  get(sessionId: string, key: string): unknown | undefined {
    return getSession(sessionId).entries.get(key);
  },

  set(sessionId: string, key: string, value: unknown): void {
    const session = getSession(sessionId);
    if (!session.entries.has(key) && session.entries.size >= MAX_ENTRIES_PER_SESSION) {
      throw new Error(`Session state limit reached (max ${MAX_ENTRIES_PER_SESSION} entries).`);
    }
    session.entries.set(key, value);
  },

  list(sessionId: string): string[] {
    return Array.from(getSession(sessionId).entries.keys());
  },

  delete(sessionId: string, key: string): boolean {
    return getSession(sessionId).entries.delete(key);
  },
};
