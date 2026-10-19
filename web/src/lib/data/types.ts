// Formas espelham as tabelas de replica/schema.sql (camelCase no app).
export type Role = "owner" | "editor" | "commenter" | "viewer";
export type LinkRole = Exclude<Role, "owner">;

export type Profile = { id: string; email: string; name: string; createdAt: string };

export type Board = {
  id: string;
  ownerId: string;
  title: string;
  clientName: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShareLink = {
  id: string;
  boardId: string;
  token: string;
  role: LinkRole;
  askVisitorName: boolean;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
};

export type Guest = {
  id: string;
  boardId: string;
  shareLinkId: string;
  displayName: string;
  color: string; // p1..p8 (token de presença)
  revokedAt: string | null;
  createdAt: string;
};

export type Author = { kind: "user" | "guest"; id: string; name: string; color: string };

export type Comment = { id: string; threadId: string; author: Author; body: string; createdAt: string };
export type CommentThread = {
  id: string;
  boardId: string;
  itemId: string | null; // preso a um objeto do quadro (id no Yjs) ou solto no ponto (x, y)
  x: number;
  y: number;
  resolvedAt: string | null;
  createdAt: string;
  comments: Comment[];
};

export type Asset = { id: string; boardId: string; mimeType: string; sizeBytes: number; width: number | null; height: number | null; createdAt: string };

/** Contrato da camada de dados. A versão fake (JSON) e a do Supabase implementam o mesmo. */
export interface DataLayer {
  /** Só na camada fake (login de dev). No Supabase o perfil nasce pelo trigger do auth.users. */
  upsertProfileByEmail?(email: string, name: string): Promise<Profile>;
  getProfile(id: string): Promise<Profile | null>;

  listBoards(ownerId: string, opts?: { q?: string }): Promise<Board[]>;
  createBoard(ownerId: string, input: { title: string; clientName?: string | null }): Promise<Board>;
  getBoard(id: string): Promise<Board | null>;
  getMemberRole(boardId: string, userId: string): Promise<Role | null>;

  getOrCreateShareLink(boardId: string, createdBy: string): Promise<ShareLink>;
  getShareLinkByToken(token: string): Promise<ShareLink | null>;
  getShareLinkById(id: string): Promise<ShareLink | null>;

  updateShareLink(id: string, patch: { role?: LinkRole; askVisitorName?: boolean }): Promise<ShareLink>;
  /** Desativa o link (quem entrou por ele perde acesso). O próximo getOrCreateShareLink gera outro token. */
  disableShareLink(id: string): Promise<void>;

  createGuest(input: { boardId: string; shareLinkId: string; displayName: string; color: string }): Promise<Guest>;
  getGuest(id: string): Promise<Guest | null>;
  /** Visitantes ainda com acesso (não removidos, de links ativos). */
  listGuests(boardId: string): Promise<Guest[]>;
  revokeGuest(id: string): Promise<void>;

  renameBoard(id: string, title: string): Promise<Board>;
  /** Copia o quadro e o conteúdo (doc Yjs); o dono da cópia é quem duplicou. */
  duplicateBoard(id: string, ownerId: string): Promise<Board>;
  trashBoard(id: string): Promise<void>;

  /* comentários: a autorização (papel do actor) é feita na server action, antes de chamar */
  listThreads(boardId: string): Promise<CommentThread[]>;
  createThread(input: { boardId: string; itemId: string | null; x: number; y: number; author: Author; body: string }): Promise<CommentThread>;
  addComment(input: { threadId: string; author: Author; body: string }): Promise<Comment>;
  getThread(id: string): Promise<CommentThread | null>;
  setThreadResolved(id: string, resolved: boolean): Promise<void>;

  /* imagens no quadro */
  saveAsset(input: { boardId: string; mimeType: string; bytes: Uint8Array; width: number | null; height: number | null; author: Author }): Promise<Asset>;
  /** Arquivo de um asset (só depois de conferir acesso ao quadro). */
  readAsset(boardId: string, id: string): Promise<{ asset: Asset; bytes: Uint8Array } | null>;
}
