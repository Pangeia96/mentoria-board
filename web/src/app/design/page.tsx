"use client";

import { useState, type ReactNode } from "react";
import { LayoutGrid, Link2, Plus, Search, ShieldOff } from "lucide-react";
import {
  Button, Drawer, Field, IconButton, Input, Menu, Modal, Select, Skeleton, Spinner, Switch, Textarea, Toaster, TooltipProvider, type ToastData,
} from "@/components/ui/primitives";
import { Avatar, AvatarStack, BoardCard, EmptyState, PRESENCE, type Person } from "@/components/ui/board";
import {
  ColorPicker, CommentPin, ConnectionBanner, ContextToolbar, CreationToolbar, PeopleBar, RemoteCursor, StickyPreview, ZoomControl,
  type SelectionKind, type Tool,
} from "@/components/ui/canvas-chrome";

const people: Person[] = [
  { id: "1", name: "Você Mentor", color: "p4" },
  { id: "2", name: "Ana Souza", color: "p2", guest: true },
  { id: "3", name: "Bruno Lima", color: "p6", guest: true },
  { id: "4", name: "Carla Dias", color: "p3" },
  { id: "5", name: "Davi Reis", color: "p1", guest: true },
  { id: "6", name: "Eva Prado", color: "p7" },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
      <h2 id={id} className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
const Row = ({ children, label }: { children: ReactNode; label?: string }) => (
  <div className="flex flex-col gap-2">
    {label && <span className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{label}</span>}
    <div className="flex flex-wrap items-center gap-3">{children}</div>
  </div>
);

const COLOR_ROLES = ["bg", "surface", "surface-muted", "surface-hover", "canvas", "border", "border-input", "text", "text-muted", "text-subtle", "accent", "accent-hover", "accent-soft", "danger", "danger-soft", "success", "success-soft", "warning", "warning-soft"];

export default function DesignPage() {
  const [tool, setTool] = useState<Tool>("sticky");
  const [kind, setKind] = useState<SelectionKind>("sticky");
  const [sticky, setSticky] = useState("yellow");
  const [zoom, setZoom] = useState(1);
  const [minimap, setMinimap] = useState(false);
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [role, setRole] = useState("editor");
  const [askName, setAskName] = useState(true);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toast = (kind: ToastData["kind"], title: string) => setToasts((t) => [...t, { id: Date.now(), kind, title }]);

  return (
    <TooltipProvider>
      <main className="mx-auto flex w-full max-w-(--mb-dashboard-max) flex-col gap-6 px-4 py-8 md:px-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Sistema de design · mentoria-board</h1>
          <p className="text-sm text-text-muted">Primitivos isolados. Só tokens; accent é placeholder até o /replica-brand.</p>
        </header>

        <Section id="cores" title="Cores (papéis)">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {COLOR_ROLES.map((c) => (
              <div key={c} className="flex items-center gap-2 text-xs">
                <span className="size-8 shrink-0 rounded-md border border-border" style={{ background: `var(--mb-${c})` }} />
                <code className="truncate">{c}</code>
              </div>
            ))}
          </div>
          <Row label="sticky">
            {["yellow", "orange", "pink", "violet", "blue", "teal", "green", "gray"].map((c) => (
              <span key={c} className="flex size-10 items-center justify-center text-xs font-medium text-sticky-ink shadow-sticky" style={{ background: `var(--mb-sticky-${c})` }}>Aa</span>
            ))}
          </Row>
          <Row label="presença">
            {PRESENCE.map((c) => (
              <span key={c} className="rounded-full px-2 py-0.5 text-xs font-semibold text-presence-on-presence" style={{ background: `var(--mb-presence-${c})` }}>{c}</span>
            ))}
          </Row>
        </Section>

        <Section id="tipo" title="Tipografia, raio e sombra">
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-semibold">2xl 40/48</span>
            <span className="text-xl font-semibold">xl 28/36</span>
            <span className="text-lg font-semibold">lg 20/28</span>
            <span className="text-md">md 16/24 corpo grande</span>
            <span className="text-sm">sm 14/20 corpo padrão da interface</span>
            <span className="text-xs text-text-muted">xs 12/16 metadados</span>
          </div>
          <Row>
            {([["sm", "rounded-sm"], ["md", "rounded-md"], ["lg", "rounded-lg"], ["full", "rounded-full"]] as const).map(([r, cls]) => (
              <span key={r} className={`flex size-16 items-center justify-center border border-border bg-surface-muted text-xs ${cls}`}>{r}</span>
            ))}
            {([["sm", "shadow-sm"], ["md", "shadow-md"], ["lg", "shadow-lg"], ["sticky", "shadow-sticky"]] as const).map(([s, cls]) => (
              <span key={s} className={`flex size-16 items-center justify-center bg-surface text-xs ${cls}`}>{s}</span>
            ))}
          </Row>
        </Section>

        <Section id="botoes" title="Button · IconButton">
          <Row label="variantes">
            <Button>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="danger">Apagar</Button>
          </Row>
          <Row label="tamanhos e estados">
            <Button size="sm" icon={<Plus className="size-4" />}>Novo quadro</Button>
            <Button size="md">Médio</Button>
            <Button size="lg">Grande</Button>
            <Button loading>Salvando</Button>
            <Button disabled>Desabilitado</Button>
          </Row>
          <Row label="ícone (passe o mouse: tooltip com atalho)">
            <IconButton label="Grade" shortcut="G" tooltipSide="top"><LayoutGrid /></IconButton>
            <IconButton label="Grade" shortcut="G" tooltipSide="top" pressed><LayoutGrid /></IconButton>
            <IconButton label="Grade" size="sm" tooltipSide="top"><LayoutGrid /></IconButton>
            <IconButton label="Grade" disabled tooltipSide="top"><LayoutGrid /></IconButton>
          </Row>
        </Section>

        <Section id="form" title="Formulário">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do quadro">{(p) => <Input id={p.id} placeholder="Ex.: Plano de carreira" aria-describedby={p.describedBy} />}</Field>
            <Field label="Seu nome" error="Digite como quer aparecer para o mentor">{(p) => <Input id={p.id} aria-invalid={p.invalid} aria-describedby={p.describedBy} />}</Field>
            <Field label="Buscar" hint="Por título ou mentorado">{(p) => <Input id={p.id} leading={<Search />} placeholder="Buscar quadros" aria-describedby={p.describedBy} />}</Field>
            <Field label="Desabilitado">{(p) => <Input id={p.id} disabled value="Somente leitura" readOnly />}</Field>
            <Field label="Comentário">{(p) => <Textarea id={p.id} placeholder="Escreva algo…" />}</Field>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">Quem tem o link</span>
                <Select label="Papel de quem tem o link" value={role} onValueChange={setRole} options={[
                  { value: "editor", label: "Pode editar" }, { value: "commenter", label: "Pode comentar" }, { value: "viewer", label: "Só ver" },
                ]} />
              </div>
              <Switch label="Pedir nome ao entrar" checked={askName} onCheckedChange={setAskName} />
            </div>
          </div>
        </Section>

        <Section id="overlays" title="Modal · Drawer · Menu · Toast">
          <Row>
            <Button variant="secondary" onClick={() => setModal(true)}>Abrir modal (S05)</Button>
            <Button variant="secondary" onClick={() => setConfirm(true)}>Confirmação</Button>
            <Button variant="secondary" onClick={() => setDrawer(true)}>Drawer de pessoas (S09)</Button>
            <Menu trigger={<Button variant="secondary">Menu</Button>} align="start" items={[
              { label: "Renomear", shortcut: "F2" }, { label: "Duplicar", shortcut: "Ctrl+D" }, "separator", { label: "Apagar", danger: true },
            ]} />
            <Button variant="secondary" onClick={() => toast("success", "Link copiado")}>Toast sucesso</Button>
            <Button variant="secondary" onClick={() => toast("error", "Não foi possível salvar o comentário")}>Toast erro</Button>
          </Row>
          <Row label="carregando">
            <Spinner /> <Spinner size={20} className="text-accent" />
            <Skeleton className="h-10 w-48" /> <Skeleton className="h-24 w-36 rounded-lg" />
          </Row>
        </Section>

        <Section id="painel" title="Painel (S02): BoardCard · EmptyState">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BoardCard title="Plano de carreira" client="Ana Souza" updated="há 2 h" href="#" />
            <BoardCard title="Roda da vida — sessão 3" client="Bruno Lima" updated="ontem" href="#" />
            <BoardCard title="Mapa de metas 2027" updated="há 5 dias" href="#" />
            <div className="flex flex-col gap-2"><Skeleton className="aspect-[16/10] rounded-lg" /><Skeleton className="h-4 w-2/3" /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-dashed border-border">
              <EmptyState icon={<LayoutGrid />} title="Nenhum quadro ainda" action={<Button icon={<Plus className="size-4" />}>Criar quadro</Button>}>
                Crie o primeiro quadro para um mentorado e mande o link para ele entrar.
              </EmptyState>
            </div>
            <div className="rounded-lg border border-dashed border-border">
              <EmptyState icon={<ShieldOff />} title="Este link não funciona mais" action={<Button variant="secondary">Voltar</Button>}>
                O link foi desativado ou expirou. Peça um novo link ao seu mentor.
              </EmptyState>
            </div>
          </div>
        </Section>

        <Section id="canvas" title="Quadro (S04): barras, cursores e seleção">
          <Row label="tipo de seleção">
            {(["sticky", "shape", "text", "connector", "pen", "multi"] as const).map((k) => (
              <Button key={k} size="sm" variant={kind === k ? "primary" : "secondary"} onClick={() => setKind(k)}>{k}</Button>
            ))}
          </Row>
          <div
            className="relative h-140 overflow-hidden rounded-lg border border-border bg-canvas"
            style={{ backgroundImage: "radial-gradient(var(--mb-canvas-grid) 1px, transparent 1px)", backgroundSize: `${24 * zoom}px ${24 * zoom}px` }}
            role="application"
            aria-label="Quadro de demonstração"
          >
            <div className="absolute left-3 top-1/2 -translate-y-1/2"><CreationToolbar tool={tool} onTool={setTool} /></div>
            <div className="absolute right-3 top-3">
              <PeopleBar people={people} onOpenPeople={() => setDrawer(true)} onShare={() => setModal(true)} following={people[1]} />
            </div>
            <div className="absolute left-1/2 top-3 -translate-x-1/2"><ConnectionBanner state="reconnecting" /></div>
            <div className="absolute bottom-3 right-3"><ZoomControl zoom={zoom} onZoom={setZoom} minimap={minimap} onMinimap={() => setMinimap(!minimap)} /></div>

            <div className="absolute left-36 top-20"><ContextToolbar kind={kind} color={sticky} onColor={setSticky} /></div>
            <div className="absolute left-40 top-36"><StickyPreview color={sticky} text="Onde quero estar em 1 ano?" selectedBy="me" /></div>
            <div className="absolute left-96 top-44"><StickyPreview color="pink" text="Medo de mudar de área" selectedBy={people[1]} /></div>
            <div className="absolute left-148 top-28"><StickyPreview color="teal" text="Estrutura da sessão (travado)" locked /></div>
            <div className="absolute left-120 top-96"><CommentPin author={people[1]} count={2} thread={[
              { id: "a", author: people[1], at: "10:42", body: "Posso detalhar esse ponto na próxima sessão?" },
              { id: "b", author: people[0], at: "10:45", body: "Sim! Traga 3 exemplos concretos." },
            ]} /></div>

            <RemoteCursor person={people[1]} x={560} y={300} />
            <RemoteCursor person={people[2]} x={760} y={180} />
            <RemoteCursor person={people[4]} x={300} y={460} idle />
          </div>
          <div className="flex flex-wrap gap-3">
            <ConnectionBanner state="offline" />
            <ConnectionBanner state="synced" />
          </div>
          <Row label="ColorPicker isolado"><div className="rounded-md bg-surface shadow-md"><ColorPicker value={sticky} onChange={setSticky} /></div></Row>
          <Row label="CreationToolbar para quem só pode comentar/ver"><CreationToolbar tool="select" onTool={() => {}} canEdit={false} /></Row>
        </Section>

        <Section id="avatares" title="Avatar">
          <Row>
            {people.map((p) => <Avatar key={p.id} person={p} />)}
            <Avatar person={people[1]} ring />
            <Avatar person={people[2]} following />
            <Avatar person={people[3]} size={24} />
            <AvatarStack people={people} />
          </Row>
        </Section>
      </main>

      <Modal open={modal} onOpenChange={setModal} title="Compartilhar quadro" description="Qualquer pessoa com o link entra sem criar conta."
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Fechar</Button><Button icon={<Link2 className="size-4" />} onClick={() => { setModal(false); toast("success", "Link copiado"); }}>Copiar link</Button></>}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Quem tem o link</span>
            <Select label="Papel de quem tem o link" value={role} onValueChange={setRole} options={[
              { value: "editor", label: "Pode editar" }, { value: "commenter", label: "Pode comentar" }, { value: "viewer", label: "Só ver" },
            ]} />
          </div>
          <Switch label="Pedir nome ao entrar" checked={askName} onCheckedChange={setAskName} />
        </div>
      </Modal>

      <Modal size="sm" open={confirm} onOpenChange={setConfirm} title="Mover para a lixeira?" description="O quadro some do painel e é apagado de vez em 30 dias."
        footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Cancelar</Button><Button variant="danger" onClick={() => setConfirm(false)}>Mover para a lixeira</Button></>} />

      <Drawer open={drawer} onOpenChange={setDrawer} title={`No quadro agora (${people.length})`}>
        <ul className="flex flex-col gap-1">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-hover">
              <Avatar person={p} />
              <span className="flex-1 text-sm">{p.name}{p.guest && <span className="text-xs text-text-muted"> · visitante</span>}</span>
              <Button size="sm" variant="ghost">Seguir</Button>
            </li>
          ))}
        </ul>
        <Button className="mt-4 w-full" variant="secondary">Trazer todos para mim</Button>
      </Drawer>

      <Toaster toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </TooltipProvider>
  );
}
