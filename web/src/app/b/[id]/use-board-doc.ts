"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import type { Actor } from "@/lib/auth";

/** Origem das transações deste navegador: o UndoManager só desfaz o que tiver esta origem. */
export const LOCAL = Symbol("local");

import type { Item, ItemPatch } from "./board/model";
export type { Item } from "./board/model";

/** Itens antigos (M1) não tinham rotation/locked: completa com padrões ao ler. */
const normalize = (raw: Record<string, unknown>, id: string): Item => ({ rotation: 0, locked: false, ...raw, id }) as Item;

export type PresenceState = {
  user: { id: string; name: string; color: string; kind: Actor["kind"] };
  cursor?: { x: number; y: number } | null;
  selection?: string[];
};
export type RemotePeer = PresenceState & { clientId: number };

export type ConnState = "connecting" | "connected" | "reconnecting" | "offline";

export function useBoardDoc({ boardId, token, wsUrl, me }: { boardId: string; token: string; wsUrl: string; me: Actor }) {
  const doc = useMemo(() => new Y.Doc(), []);
  const items = useMemo(() => doc.getMap<Y.Map<unknown>>("items"), [doc]);
  const undo = useMemo(() => new Y.UndoManager(items, { trackedOrigins: new Set([LOCAL]), captureTimeout: 400 }), [items]);

  const providerRef = useRef<HocuspocusProvider | null>(null);
  const [justSynced, setJustSynced] = useState(false);
  const [snapshot, setSnapshot] = useState<Item[]>([]);
  const [synced, setSynced] = useState(false);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [authError, setAuthError] = useState<string | null>(null);
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [undoState, setUndoState] = useState({ canUndo: false, canRedo: false });

  useEffect(() => {
    let everConnected = false;
    let dropped = false;
    let syncedTimer: ReturnType<typeof setTimeout> | undefined;
    const p = new HocuspocusProvider({
      url: wsUrl,
      name: `board:${boardId}`,
      document: doc,
      token,
      onStatus: ({ status }) => {
        if (status === "connected") {
          everConnected = true;
          setConn("connected");
          if (dropped) {
            dropped = false;
            setJustSynced(true);
            clearTimeout(syncedTimer);
            syncedTimer = setTimeout(() => setJustSynced(false), 2000);
          }
          return;
        }
        if (everConnected) dropped = true;
        else if (status === "disconnected") setConn(navigator.onLine ? (everConnected ? "reconnecting" : "connecting") : "offline");
        else setConn(everConnected ? "reconnecting" : "connecting");
      },
      onSynced: () => setSynced(true),
      onAuthenticationFailed: ({ reason }) => setAuthError(reason || "Acesso negado"),
    });
    p.awareness?.setLocalStateField("user", { id: me.id, name: me.name, color: me.color, kind: me.kind });

    const readPeers = () => {
      const out: RemotePeer[] = [];
      p.awareness?.getStates().forEach((s, clientId) => {
        if (clientId !== p.awareness?.clientID && (s as PresenceState).user) out.push({ ...(s as PresenceState), clientId });
      });
      setPeers(out);
    };
    p.awareness?.on("change", readPeers);
    const goOffline = () => { dropped = true; setConn("offline"); };
    window.addEventListener("offline", goOffline);
    providerRef.current = p;
    return () => {
      window.removeEventListener("offline", goOffline);
      p.awareness?.off("change", readPeers);
      clearTimeout(syncedTimer);
      p.destroy();
      providerRef.current = null;
    };
  }, [boardId, doc, token, wsUrl, me.id, me.name, me.color, me.kind]);

  useEffect(() => {
    const read = () =>
      setSnapshot(
        [...items.entries()]
          .map(([id, m]) => normalize(m.toJSON(), id))
          .sort((a, b) => a.z - b.z),
      );
    read();
    items.observeDeep(read);
    const u = () => setUndoState({ canUndo: undo.canUndo(), canRedo: undo.canRedo() });
    undo.on("stack-item-added", u);
    undo.on("stack-item-popped", u);
    undo.on("stack-cleared", u);
    return () => {
      items.unobserveDeep(read);
      undo.off("stack-item-added", u);
      undo.off("stack-item-popped", u);
      undo.off("stack-cleared", u);
    };
  }, [items, undo]);

  const actions = useMemo(
    () => ({
      /** Cria um item (z no topo) e devolve o id. */
      add(fields: Omit<Item, "id" | "z" | "createdBy">) {
        const id = crypto.randomUUID();
        const maxZ = Math.max(0, ...[...items.values()].map((m) => Number(m.get("z") ?? 0)));
        doc.transact(() => {
          const m = new Y.Map<unknown>();
          Object.entries({ ...fields, z: maxZ + 1, createdBy: me.id }).forEach(([k, v]) => m.set(k, v));
          items.set(id, m);
        }, LOCAL);
        return id;
      },
      /** Duplica itens (deslocados) numa transação; devolve os novos ids na mesma ordem. */
      clone(list: Item[], dx: number, dy: number) {
        let z = Math.max(0, ...[...items.values()].map((m) => Number(m.get("z") ?? 0)));
        const map = new Map<string, string>();
        list.forEach((it) => map.set(it.id, crypto.randomUUID()));
        doc.transact(() => {
          [...list].sort((a, b) => a.z - b.z).forEach((it) => {
            const m = new Y.Map<unknown>();
            const copy: Record<string, unknown> = { ...it, x: it.x + dx, y: it.y + dy, z: ++z, createdBy: me.id };
            delete copy.id;
            if (it.type === "connector") {
              // a seta continua presa às cópias, se elas vieram junto; senão vira ponta solta
              const end = (e: typeof it.from) => (e.itemId && map.has(e.itemId) ? { ...e, itemId: map.get(e.itemId)! } : { itemId: null, x: e.x + dx, y: e.y + dy });
              copy.from = end(it.from);
              copy.to = end(it.to);
            }
            Object.entries(copy).forEach(([k, v]) => m.set(k, v));
            items.set(map.get(it.id)!, m);
          });
        }, LOCAL);
        return list.map((it) => map.get(it.id)!);
      },
      update(id: string, patch: ItemPatch) {
        const m = items.get(id);
        if (!m) return;
        doc.transact(() => Object.entries(patch).forEach(([k, v]) => m.set(k, v)), LOCAL);
      },
      updateMany(patches: { id: string; patch: ItemPatch }[]) {
        doc.transact(() => patches.forEach(({ id, patch }) => {
          const m = items.get(id);
          if (m) Object.entries(patch).forEach(([k, v]) => m.set(k, v));
        }), LOCAL);
      },
      remove(ids: string[]) {
        doc.transact(() => {
          const gone = new Set(ids);
          ids.forEach((id) => items.delete(id));
          // setas presas a itens apagados viram pontas soltas no lugar onde estavam
          items.forEach((m) => {
            if (m.get("type") !== "connector") return;
            (["from", "to"] as const).forEach((k) => {
              const e = m.get(k) as { itemId: string | null; x: number; y: number };
              if (e?.itemId && gone.has(e.itemId)) m.set(k, { ...e, itemId: null });
            });
          });
        }, LOCAL);
      },
      /** Traz para a frente (+1) ou manda para trás (-1) mantendo a ordem relativa. */
      reorder(ids: string[], dir: 1 | -1) {
        const zs = [...items.values()].map((m) => Number(m.get("z") ?? 0));
        let next = dir === 1 ? Math.max(0, ...zs) : Math.min(0, ...zs);
        const sel = ids.map((id) => ({ id, z: Number(items.get(id)?.get("z") ?? 0) })).sort((a, b) => (a.z - b.z) * dir);
        doc.transact(() => sel.forEach(({ id }) => items.get(id)?.set("z", (next += dir))), LOCAL);
      },
      undo: () => undo.undo(),
      redo: () => undo.redo(),
      stopCapturing: () => undo.stopCapturing(),
      setCursor(c: { x: number; y: number } | null) {
        providerRef.current?.awareness?.setLocalStateField("cursor", c);
      },
      setSelection(ids: string[]) {
        providerRef.current?.awareness?.setLocalStateField("selection", ids);
      },
    }),
    [doc, items, undo, me.id],
  );

  return { items: snapshot, synced, conn, justSynced, authError, peers, actions, ...undoState };
}
