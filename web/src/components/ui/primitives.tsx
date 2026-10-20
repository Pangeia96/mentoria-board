"use client";

import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Dialog, DropdownMenu, Select as RSelect, Switch as RSwitch, Toast as RToast, Tooltip as RTooltip } from "radix-ui";
import { Check, ChevronDown, X } from "lucide-react";
import clsx from "clsx";

/* ----------------------------------------------------------------- Spinner / Skeleton */
export function Spinner({ size = 16, className }: { size?: 16 | 20; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("inline-block rounded-full border-2 border-current border-r-transparent", className)}
      style={{ width: size, height: size, animation: "mb-spin 0.8s linear infinite" }}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("rounded-md bg-surface-muted", className)} style={{ animation: "mb-pulse 1.6s ease-in-out infinite" }} />;
}

/* ----------------------------------------------------------------- Button */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
};

const buttonVariant = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-surface text-text border border-border hover:bg-surface-hover",
  ghost: "bg-transparent text-text hover:bg-surface-hover",
  danger: "bg-danger text-on-danger hover:brightness-95",
};
const buttonSize = { sm: "h-8 px-3 gap-1.5", md: "h-10 px-4 gap-2", lg: "h-12 px-5 gap-2 text-md" };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex items-center justify-center rounded-md text-sm font-semibold whitespace-nowrap select-none",
        "transition-[background-color,filter,transform] duration-(--mb-motion-fast) active:translate-y-px",
        "disabled:opacity-50 disabled:pointer-events-none",
        buttonVariant[variant],
        buttonSize[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

/* ----------------------------------------------------------------- Tooltip + IconButton */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RTooltip.Provider delayDuration={400}>{children}</RTooltip.Provider>;
}

export function Tooltip({ label, shortcut, side = "right", children }: { label: string; shortcut?: string; side?: "top" | "right" | "bottom" | "left"; children: ReactNode }) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={8} className="z-50 flex items-center gap-2 rounded-sm bg-text px-2 py-1 text-xs font-medium text-surface shadow-md">
          {label}
          {shortcut && <kbd className="rounded-sm bg-text-muted px-1 text-xs font-semibold text-surface">{shortcut}</kbd>}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  shortcut?: string;
  size?: "sm" | "md";
  pressed?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  /** false = sem tooltip (use em botões que recebem o foco ao abrir um modal: o Esc fecharia o tooltip, não o modal) */
  tooltip?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, size = "md", pressed, tooltipSide, tooltip = true, className, children, ...rest },
  ref,
) {
  const button = (
      <button
        ref={ref}
        aria-label={label}
        aria-pressed={pressed}
        className={clsx(
          "inline-flex items-center justify-center rounded-md transition-colors duration-(--mb-motion-fast)",
          "disabled:opacity-50 disabled:pointer-events-none",
          size === "md" ? "size-10 [&_svg]:size-5" : "size-8 [&_svg]:size-4.5",
          pressed ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface-hover hover:text-text",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
  );
  return tooltip ? <Tooltip label={label} shortcut={shortcut} side={tooltipSide}>{button}</Tooltip> : button;
});

/* ----------------------------------------------------------------- Field / Input / Textarea */
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode }) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">{label}</label>
      {children({ id, describedBy: error || hint ? msgId : undefined, invalid: !!error })}
      {(error || hint) && (
        <p id={msgId} className={clsx("text-xs", error ? "text-danger" : "text-text-muted")}>{error ?? hint}</p>
      )}
    </div>
  );
}

const inputBase =
  "w-full rounded-md border bg-surface px-3 text-sm text-text placeholder:text-text-subtle " +
  "transition-[border-color,box-shadow] duration-(--mb-motion-fast) " +
  "focus-visible:outline-none focus-visible:border-focus focus-visible:shadow-[0_0_0_3px_var(--mb-accent-soft)] " +
  "disabled:bg-surface-muted disabled:text-text-subtle aria-invalid:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode }>(function Input(
  { className, leading, ...rest },
  ref,
) {
  if (!leading) return <input ref={ref} className={clsx(inputBase, "h-10 border-border-input", className)} {...rest} />;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-subtle [&_svg]:size-4">{leading}</span>
      <input ref={ref} className={clsx(inputBase, "h-10 border-border-input pl-9", className)} {...rest} />
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(inputBase, "min-h-20 resize-y border-border-input py-2", className)} {...rest} />;
});

/* ----------------------------------------------------------------- Switch */
export function Switch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-text">{label}</label>
      <RSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-4.5 w-8 shrink-0 rounded-full bg-border-input transition-colors data-[state=checked]:bg-accent"
      >
        <RSwitch.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-surface shadow-sm transition-transform duration-(--mb-motion-fast) data-[state=checked]:translate-x-4" />
      </RSwitch.Root>
    </div>
  );
}

/* ----------------------------------------------------------------- Select */
export function Select({ value, onValueChange, options, label }: { value: string; onValueChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange}>
      <RSelect.Trigger aria-label={label} className={clsx(inputBase, "inline-flex h-10 w-auto min-w-40 items-center justify-between gap-2 border-border-input")}>
        <RSelect.Value />
        <RSelect.Icon><ChevronDown className="size-4 text-text-muted" /></RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content position="popper" sideOffset={4} className="z-50 min-w-(--radix-select-trigger-width) rounded-md border border-border bg-surface p-1 shadow-lg">
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item key={o.value} value={o.value} className="flex h-8 cursor-default items-center justify-between gap-4 rounded-sm px-2 text-sm text-text outline-none data-highlighted:bg-surface-hover">
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                <RSelect.ItemIndicator><Check className="size-4 text-accent" /></RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}

/* ----------------------------------------------------------------- Menu */
export type MenuItem = { label: string; icon?: ReactNode; shortcut?: string; danger?: boolean; onSelect?: () => void } | "separator";

export function Menu({ trigger, items, align = "end" }: { trigger: ReactNode; items: MenuItem[]; align?: "start" | "end" }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={4} className="z-50 min-w-48 rounded-md border border-border bg-surface p-1 shadow-lg" style={{ animation: "mb-in var(--mb-motion-base) var(--mb-motion-ease)" }}>
          {items.map((it, i) =>
            it === "separator" ? (
              <DropdownMenu.Separator key={i} className="my-1 h-px bg-border" />
            ) : (
              <DropdownMenu.Item
                key={i}
                onSelect={it.onSelect}
                className={clsx(
                  "flex h-8 cursor-default items-center gap-2 rounded-sm px-2 text-sm outline-none data-highlighted:bg-surface-hover [&_svg]:size-4",
                  it.danger ? "text-danger" : "text-text",
                )}
              >
                {it.icon}
                <span className="flex-1">{it.label}</span>
                {it.shortcut && <span className="text-xs text-text-subtle">{it.shortcut}</span>}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ----------------------------------------------------------------- Modal */
export function Modal({ open, onOpenChange, title, description, children, footer, size = "md" }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode; size?: "sm" | "md";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" style={{ animation: "mb-in var(--mb-motion-base) var(--mb-motion-ease)" }} />
        <Dialog.Content
          className={clsx(
            "fixed left-1/2 top-1/2 z-40 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-lg",
            size === "md" ? "max-w-120" : "max-w-100",
          )}
          style={{ animation: "mb-in var(--mb-motion-base) var(--mb-motion-ease)" }}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-text">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Fechar" size="sm" tooltip={false} title="Fechar (Esc)"><X /></IconButton>
            </Dialog.Close>
          </div>
          {children}
          {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ----------------------------------------------------------------- Drawer (não modal, à direita) */
export function Drawer({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed inset-y-0 right-0 z-30 flex w-(--mb-drawer-w) max-w-full flex-col border-l border-border bg-surface shadow-lg"
          style={{ animation: "mb-in var(--mb-motion-slow) var(--mb-motion-ease)" }}
        >
          <div className="flex h-(--mb-header-h) items-center justify-between border-b border-border px-4">
            <Dialog.Title className="text-md font-semibold">{title}</Dialog.Title>
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
            <Dialog.Close asChild>
              <IconButton label="Fechar painel" size="sm" tooltip={false} title="Fechar (Esc)"><X /></IconButton>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ----------------------------------------------------------------- Toast */
export type ToastData = { id: number; kind: "info" | "success" | "error"; title: string };

export function Toaster({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: number) => void }) {
  return (
    <RToast.Provider swipeDirection="down">
      {toasts.map((t) => (
        <RToast.Root
          key={t.id}
          type={t.kind === "error" ? "foreground" : "background"}
          duration={t.kind === "error" ? Infinity : 4000}
          onOpenChange={(o) => !o && onDismiss(t.id)}
          className="flex items-center gap-3 rounded-md bg-text px-4 py-3 text-sm text-surface shadow-lg"
          style={{ animation: "mb-in var(--mb-motion-base) var(--mb-motion-ease)" }}
        >
          <span aria-hidden className={clsx("size-2 rounded-full", t.kind === "error" ? "bg-danger" : t.kind === "success" ? "bg-success" : "bg-accent")} />
          <RToast.Title className="flex-1">{t.title}</RToast.Title>
          <RToast.Close aria-label="Fechar aviso" className="rounded-sm p-0.5 text-surface hover:bg-text-muted"><X className="size-4" /></RToast.Close>
        </RToast.Root>
      ))}
      <RToast.Viewport className="fixed bottom-4 left-1/2 z-50 flex w-90 max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col gap-2 outline-none" />
    </RToast.Provider>
  );
}
