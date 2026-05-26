export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  const { preloadMt5ModuleStates } = await import("@/app/api/mt5/_lib/persistence");
  await preloadMt5ModuleStates();
}
