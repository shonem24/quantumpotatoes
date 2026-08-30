const DEFAULT_TTL_MS = 60 * 1000;

const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) {
    return undefined;
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlMs) {
  const ttl = typeof ttlMs === "number" ? ttlMs : DEFAULT_TTL_MS;
  store.set(key, {
    value: value,
    expiresAt: Date.now() + ttl,
  });
}

function del(key) {
  store.delete(key);
}

function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

module.exports = {
  DEFAULT_TTL_MS,
  get,
  set,
  del,
  invalidatePrefix,
};
