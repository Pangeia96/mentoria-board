import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { data } from "@/lib/data";
import { Dashboard } from "./dashboard";

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const q = typeof (await searchParams).q === "string" ? ((await searchParams).q as string) : "";
  const boards = await data.listBoards(user.id, { q });
  return <Dashboard user={{ name: user.name, email: user.email }} boards={boards} q={q} />;
}
