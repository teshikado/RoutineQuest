import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroupDetail } from "@/lib/group-data";
import { GroupDetailClient } from "@/components/groups/group-detail-client";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const group = await getGroupDetail(id, session.user.id);
  if (!group) notFound();

  return <GroupDetailClient group={group} />;
}
