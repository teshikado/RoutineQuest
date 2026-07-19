import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/dashboard-data";
import { generateAmbientNotifications } from "@/lib/notifications";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await generateAmbientNotifications(session.user.id);
  const data = await getDashboardData(session.user.id);

  return <DashboardClient data={data} />;
}
