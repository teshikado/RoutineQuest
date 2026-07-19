import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (user.onboarded) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#A7D8F0] to-[#EAF7FC] flex items-center justify-center px-4 py-10">
      <OnboardingWizard />
    </div>
  );
}
