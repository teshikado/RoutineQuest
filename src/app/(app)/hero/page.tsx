import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getHeroPageData } from "@/lib/hero-service";
import { HeroClient } from "@/components/hero/hero-client";

export default async function HeroPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const data = await getHeroPageData(session.user.id);

  return <HeroClient data={data} />;
}
