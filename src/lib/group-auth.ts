import { prisma } from "./prisma";
import type { GroupRole } from "@prisma/client";

export async function getMembership(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
}

export function hasRole(role: GroupRole | undefined, allowed: GroupRole[]): boolean {
  return !!role && allowed.includes(role);
}
