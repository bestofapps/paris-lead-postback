import { processActiveCampaign } from "./active_campaign";

export class LeadManager {
  private db: D1Database;
  private activeCampaignApiKey: string;

  constructor(db: D1Database, activeCampaignApiKey: string) {
    this.db = db;
    this.activeCampaignApiKey = activeCampaignApiKey;
  }

  async processPostback(params: Record<string, string>): Promise<boolean> {
    let externalStatus: number | null = null;
    let externalResponse: string | null = null;

    // If it's a sale and we have a click_id, send to the external endpoint
    if (params.event_type === "sale" && params.click_id) {
      const url = `https://crucosemagerfly.com/postback?cid=${encodeURIComponent(params.click_id)}`;
      try {
        const response = await fetch(url, { method: "GET" });
        externalStatus = response.status;
        externalResponse = await response.text();
        console.log(`External postback to ${url} returned ${externalStatus}: ${externalResponse}`);
      } catch (error) {
        console.error(`Failed to send external postback to ${url}`, error);
        externalResponse = error instanceof Error ? error.message : "Unknown error";
      }
    }

    // Active Campaign email collection (t5=iq, US only)
    const acResult = await processActiveCampaign(params, this.activeCampaignApiKey, this.db);
    if (acResult.sent) {
      console.log(`ActiveCampaign: contact sent (id: ${acResult.contactId})`);
    } else {
      console.log(`ActiveCampaign: skipped - ${acResult.reason}`);
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO postbacks (
          name, origin, description, carrier, transaction_type, referrer, timestamp,
          country_code, transaction_id, tracker_id, currency, payout, email,
          t1, t2, t3, t4, t5, sub_id, gclid, wbraid, gbraid, pubid, click_id,
          campaign_id, offer_id, ip_address, event_type,
          external_status, external_response
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30
        )
      `).bind(
        params.name || null,
        params.origin || null,
        params.description || null,
        params.carrier || null,
        params.transaction_type || null,
        params.referrer || null,
        params.timestamp || null,
        params.country_code || null,
        params.transaction_id || null,
        params.tracker_id || null,
        params.currency || null,
        params.payout || null,
        params.email || null,
        params.t1 || null,
        params.t2 || null,
        params.t3 || null,
        params.t4 || null,
        params.t5 || null,
        params.sub_id || null,
        params.gclid || null,
        params.wbraid || null,
        params.gbraid || null,
        params.pubid || null,
        params.click_id || null,
        params.campaign_id || null,
        params.offer_id || null,
        params.ip_address || null,
        params.event_type || null,
        externalStatus,
        externalResponse
      );

      await stmt.run();
      return true;
    } catch (error) {
      console.error("Failed to insert postback into D1", error);
      return false;
    }
  }
}
