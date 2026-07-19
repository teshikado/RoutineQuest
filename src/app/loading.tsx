import Image from "next/image";

// Next.js shows this automatically while an async server component further
// down the tree (e.g. the (app) layout's session/user lookup) is resolving —
// no client JS, no artificial delay, and it disappears the instant real
// content is ready. This is the "Splash-Screen beim Programmstart" from the
// brief: same mechanism covers cold app start and route-level data fetches.
export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050507]">
      <Image
        src="/logo/logo-mark.png"
        alt="RoutineQuest"
        width={72}
        height={54}
        className="animate-logo-pulse"
        priority
      />
    </div>
  );
}
