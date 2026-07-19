const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  import("./lib/group-routine-awards").then(({ runDueWeeklyAwardChecks }) => {
    const run = () => runDueWeeklyAwardChecks().catch((err) => console.error("[scheduler] weekly award check failed", err));
    run();
    setInterval(run, CHECK_INTERVAL_MS);
  });
}
