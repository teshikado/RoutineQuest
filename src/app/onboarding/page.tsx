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
    <div className="relative min-h-screen overflow-hidden bg-[#050507] flex items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute -top-24 -right-16 h-96 w-96 rounded-full opacity-50 blur-3xl animate-soft-drift"
        style={{ background: "radial-gradient(circle, #A855F7 0%, transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full opacity-35 blur-3xl animate-soft-drift"
        style={{ background: "radial-gradient(circle, #C026FF 0%, transparent 70%)", animationDelay: "2s" }}
        aria-hidden="true"
      />
      <div className="relative">
        <OnboardingWizard />
      </div>
    </div>
  );
}
