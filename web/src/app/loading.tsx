import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="mx-auto flex w-full max-w-(--mb-dashboard-max) flex-col gap-6 px-4 py-8 md:px-8">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[16/10] rounded-lg" />)}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
