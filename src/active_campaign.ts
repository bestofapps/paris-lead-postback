/**
 * Active Campaign Email Collection Module
 *
 * Sends contacts to Active Campaign when:
 * - t5 matches a configured list (e.g. 'iq', 'security')
 * - The IP address resolves to US
 * - The random sample rate is met (default 100%)
 */

import { getCountryByIp, isUSCountry } from "./ip_country";

// ── Configuration ──────────────────────────────────────────────────
const ACTIVE_CAMPAIGN_URL = "https://cliqdigital77287.api-us1.com";

interface ListConfig {
  listId: number;
  dailyCap: number;
  sendPercentage: number;
}

// Map t5 values to their Active Campaign list configuration.
// To add a new list, simply add an entry here.
const LIST_CONFIG: Record<string, ListConfig> = {
  iq: { listId: 9, dailyCap: 100, sendPercentage: 100 },
  security: { listId: 5, dailyCap: 100, sendPercentage: 100 },
};

// ── Helpers ────────────────────────────────────────────────────────

function shouldSend(sendPercentage: number): boolean {
  if (sendPercentage >= 100) return true;
  if (sendPercentage <= 0) return false;
  return Math.random() * 100 < sendPercentage;
}

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function getDailyCount(db: D1Database, listId: number): Promise<number> {
  const today = getTodayUTC();
  const row = await db.prepare("SELECT count FROM ac_daily_counts WHERE date = ? AND list_id = ?").bind(today, listId).first<{ count: number }>();
  return row?.count ?? 0;
}

async function incrementDailyCount(db: D1Database, listId: number): Promise<void> {
  const today = getTodayUTC();
  await db.prepare(
    "INSERT INTO ac_daily_counts (date, list_id, count) VALUES (?, ?, 1) ON CONFLICT(date, list_id) DO UPDATE SET count = count + 1"
  ).bind(today, listId).run();
}

async function syncContact(apiKey: string, email: string, firstName?: string, lastName?: string): Promise<number | null> {
  const body: Record<string, any> = {
    contact: {
      email,
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
    },
  };

  const response = await fetch(`${ACTIVE_CAMPAIGN_URL}/api/3/contact/sync`, {
    method: "POST",
    headers: {
      "Api-Token": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`ActiveCampaign contact/sync failed (${response.status}): ${text}`);
    return null;
  }

  const data = (await response.json()) as { contact: { id: string } };
  return parseInt(data.contact.id, 10);
}

async function addContactToList(apiKey: string, contactId: number, listId: number): Promise<boolean> {
  const response = await fetch(`${ACTIVE_CAMPAIGN_URL}/api/3/contactLists`, {
    method: "POST",
    headers: {
      "Api-Token": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contactList: {
        list: listId,
        contact: contactId,
        status: 1, // 1 = subscribe
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`ActiveCampaign contactLists failed (${response.status}): ${text}`);
    return false;
  }

  return true;
}

// ── Public API ─────────────────────────────────────────────────────

export interface ActiveCampaignResult {
  sent: boolean;
  reason?: string;
  contactId?: number;
}

export async function processActiveCampaign(
  params: Record<string, string>,
  apiKey: string,
  db: D1Database
): Promise<ActiveCampaignResult> {
  // 1. Check t5 matches a configured list
  const t5 = params.t5?.toLowerCase();
  if (!t5 || !(t5 in LIST_CONFIG)) {
    return { sent: false, reason: `t5 "${t5 ?? ""}" has no configured list` };
  }

  const config = LIST_CONFIG[t5];

  // 2. Check email exists
  if (!params.email) {
    return { sent: false, reason: "no email provided" };
  }

  // 3. Check IP is US (lookup via ip-api.com using the lead's ip_address)
  if (!params.ip_address) {
    return { sent: false, reason: "no ip_address provided" };
  }

  const country = await getCountryByIp(params.ip_address);
  if (!isUSCountry(country)) {
    return { sent: false, reason: `country is ${country ?? "unknown"}, not US` };
  }

  // 4. Sampling
  if (!shouldSend(config.sendPercentage)) {
    return { sent: false, reason: "skipped by sampling" };
  }

  // 5. Daily cap check
  const dailyCount = await getDailyCount(db, config.listId);
  if (dailyCount >= config.dailyCap) {
    return { sent: false, reason: `daily cap reached for list ${config.listId} (${dailyCount}/${config.dailyCap})` };
  }

  // 6. Sync contact to Active Campaign
  const contactId = await syncContact(apiKey, params.email, params.name);
  if (contactId === null) {
    return { sent: false, reason: "failed to sync contact" };
  }

  // 7. Add to list
  const added = await addContactToList(apiKey, contactId, config.listId);
  if (!added) {
    return { sent: false, reason: "failed to add contact to list" };
  }

  // 8. Increment daily counter
  await incrementDailyCount(db, config.listId);

  console.log(`ActiveCampaign: synced contact ${contactId} (${params.email}) to list ${config.listId} [t5=${t5}] (${dailyCount + 1}/${config.dailyCap} today)`);
  return { sent: true, contactId };
}
