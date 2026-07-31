import { eq } from "drizzle-orm";
import { db } from "../db";
import { siteSettings, type SelectSiteSettings } from "../schema/settings";

const SITE_SETTINGS_KEY = "global";

export async function getSiteSettings(): Promise<SelectSiteSettings> {
  const [existing] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, SITE_SETTINGS_KEY))
    .limit(1);
  if (existing) return existing;

  await db
    .insert(siteSettings)
    .values({ key: SITE_SETTINGS_KEY })
    .onConflictDoNothing({ target: siteSettings.key });

  const [created] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, SITE_SETTINGS_KEY))
    .limit(1);
  return created;
}

export async function updateSiteSettings(
  data: Partial<Pick<SelectSiteSettings, "allowedDomains" | "requireMailConfirmation">>,
) {
  const settings = await getSiteSettings();
  const [updated] = await db
    .update(siteSettings)
    .set(data)
    .where(eq(siteSettings.id, settings.id))
    .returning();
  return updated;
}
