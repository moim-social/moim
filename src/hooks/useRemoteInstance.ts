import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type CachedInstance,
  getStore,
  rememberInstance,
  removeInstance,
  setDefaultInstance,
} from "~/lib/remote-instance";

/**
 * Domain of the user's primary linked fediverse account, fetched at most once
 * per page load and shared across every remote-interaction button on the page.
 */
let primaryLinkedDomain: Promise<string | null> | null = null;

function getPrimaryLinkedDomain(): Promise<string | null> {
  primaryLinkedDomain ??= fetch("/api/auth/linked-accounts")
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const accounts: Array<{ fediverseHandle?: string; isPrimary?: boolean }> =
        data?.accounts ?? [];
      const primary = accounts.find((a) => a.isPrimary) ?? accounts[0];
      const domain = primary?.fediverseHandle?.split("@").pop();
      return domain ? domain.toLowerCase() : null;
    })
    .catch(() => null); // anonymous or offline — localStorage only
  return primaryLinkedDomain;
}

/**
 * Surfaces the user's remembered fediverse instances for remote interactions.
 *
 * The default instance is, in priority order: an explicitly chosen one, the
 * domain of the user's primary linked fediverse account (logged-in users), or
 * the most recently used instance.
 */
export function useRemoteInstance() {
  const [store, setStore] = useState(getStore);
  const [linkedDomain, setLinkedDomain] = useState<string | null>(null);

  // Derive an implicit default from the primary linked fediverse account.
  useEffect(() => {
    let cancelled = false;
    getPrimaryLinkedDomain().then((domain) => {
      if (!cancelled && domain) setLinkedDomain(domain);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const knownInstances = useMemo<CachedInstance[]>(() => {
    const list = [...store.instances];
    if (linkedDomain && !list.some((i) => i.domain === linkedDomain)) {
      list.push({
        domain: linkedDomain,
        title: linkedDomain,
        software: null,
        lastUsedAt: 0,
      });
    }
    return list;
  }, [store.instances, linkedDomain]);

  const defaultInstance =
    store.defaultInstance ?? linkedDomain ?? store.instances[0]?.domain ?? null;

  const remember = useCallback(
    (instance: Pick<CachedInstance, "domain" | "title" | "software">) => {
      setStore(rememberInstance(instance));
    },
    [],
  );

  const setDefault = useCallback((domain: string | null) => {
    setStore(setDefaultInstance(domain));
  }, []);

  const remove = useCallback((domain: string) => {
    setStore(removeInstance(domain));
  }, []);

  return { defaultInstance, knownInstances, remember, setDefault, remove };
}
