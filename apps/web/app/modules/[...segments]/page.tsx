import { redirect } from "next/navigation";

export default async function ModuleRoute({
  params
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  redirect(`/${segments.join("/")}`);
}
