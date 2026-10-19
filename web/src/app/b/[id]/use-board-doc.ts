"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import type { Actor } from "@/lib/auth";

/** Origem das transações deste navegador: o UndoManager só desfaz o que tiver esta origem. */
export const LOCAL = Symbol("local");

export type StickyItem = {
  id: string;
  type: "sticky";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string; // nome do token sticky.*
  text: string;
  z: number;
  createdBy: string;
};
export type Item = StickyItem;

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
          .map(([id, m]) => ({ ...(m.toJSON() as Omit<Item, "id">), id }) as Item)
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
      addSticky(pos: { x: number; y: number }, color: string) {
        const id = crypto.randomUUID();
        const maxZ = Math.max(0, ...[...items.values()].map((m) => Number(m.get("z") ?? 0)));
        doc.transact(() => {
          const m = new Y.Map<unknown>();
          const it: Omit<StickyItem, "id"> = { type: "sticky", x: pos.x, y: pos.y, w: 200, h: 200, color, text: "", z: maxZ + 1, createdBy: me.id };
          Object.entries(it).forEach(([k, v]) => m.set(k, v));
          items.set(id, m);
        }, LOCAL);
        return id;
      },
      update(id: string, patch: Partial<Omit<Item, "id" | "type">>) {
        const m = items.get(id);
        if (!m) return;
        doc.transact(() => Object.entries(patch).forEach(([k, v]) => m.set(k, v)), LOCAL);
      },
      remove(ids: string[]) {
        doc.transact(() => ids.forEach((id) => items.delete(id)), LOCAL);
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
