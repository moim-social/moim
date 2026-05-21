/**
 * Browser-side memory of fediverse instances the user has interacted from.
 *
 * Remote follow / vote / reply all send the user to their *home* instance. By
 * remembering which instance that is, repeat interactions become a single
 * click instead of re-typing a handle every time.
 */

export interface CachedInstance {
  domain: string;
  title: string;
  software: string | null;
  lastUsedAt: number;
}

interface RemoteInstanceStore {
  /** Domain the user explicitly prefers, if any. */
  defaultInstance: string | null;
  instances: CachedInstance[];
}

const STORAGE_KEY = "moim:remote-instance";
const EMPTY: RemoteInstanceStore = { defaultInstance: null, instances: [] };

export function getStore(): RemoteInstanceStore {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as RemoteInstanceStore;
    return {
      defaultInstance: parsed.defaultInstance ?? null,
      instances: Array.isArray(parsed.instances) ? parsed.instances : [],
    };
  } catch {
    return EMPTY;
  }
}

function writeStore(store: RemoteInstanceStore): RemoteInstanceStore {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* storage unavailable (private mode / quota) — degrade silently */
    }
  }
  return store;
}

/** Records (or refreshes) an instance and marks it most-recently-used. */
export function rememberInstance(
  instance: Pick<CachedInstance, "domain" | "title" | "software">,
): RemoteInstanceStore {
  const store = getStore();
  const others = store.instances.filter((i) => i.domain !== instance.domain);
  return writeStore({
    // First instance the user ever uses becomes the implicit default.
    defaultInstance: store.defaultInstance ?? instance.domain,
    instances: [{ ...instance, lastUsedAt: Date.now() }, ...others],
  });
}

export function setDefaultInstance(domain: string | null): RemoteInstanceStore {
  return writeStore({ ...getStore(), defaultInstance: domain });
}

export function removeInstance(domain: string): RemoteInstanceStore {
  const store = getStore();
  return writeStore({
    defaultInstance:
      store.defaultInstance === domain ? null : store.defaultInstance,
    instances: store.instances.filter((i) => i.domain !== domain),
  });
}
