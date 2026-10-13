import { redirect } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";

/** /app/diario → el día de hoy en la zona horaria del usuario. */
export default async function DiaryIndexPage() {
  await requireUser("/app/diario");
  const profile = await getProfile();
  redirect(`/app/diario/${todayInTz(profile?.timezone ?? DEFAULT_TIMEZONE)}`);
}
