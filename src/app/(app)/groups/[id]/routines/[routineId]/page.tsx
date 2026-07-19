import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGroupRoutineDetail } from "@/lib/group-routine-data";
import { GroupRoutineDetailClient } from "@/components/groups/group-routine-detail-client";

export default async function GroupRoutineDetailPage({
  params,
}: {
  params: Promise<{ id: string; routineId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, routineId } = await params;

  const detail = await getGroupRoutineDetail(routineId, session.user.id);
  if (!detail || detail.groupId !== id) notFound();

  return <GroupRoutineDetailClient detail={detail} />;
}
