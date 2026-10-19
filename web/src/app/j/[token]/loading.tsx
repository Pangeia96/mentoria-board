import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-1 items-center justify-center px-4 py-12">
      <Skeleton className="h-72 w-full max-w-100 rounded-lg" />
    </div>
  );
}
