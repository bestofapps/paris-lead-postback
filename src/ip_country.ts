/**
 * IP Country Module
 * Looks up the country for an IP address using ip-api.com (free, 45 req/min).
 */

export async function getCountryByIp(ipAddress: string): Promise<string | null> {
  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ipAddress)}?fields=status,countryCode`
    );

    if (!response.ok) {
      console.error(`IP country lookup failed for ${ipAddress}: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { status: string; countryCode?: string };

    if (data.status !== "success" || !data.countryCode) {
      console.error(`IP country lookup returned status "${data.status}" for ${ipAddress}`);
      return null;
    }

    return data.countryCode.toUpperCase();
  } catch (error) {
    console.error(`IP country lookup error for ${ipAddress}:`, error);
    return null;
  }
}

export function isUSCountry(countryCode: string | null): boolean {
  return countryCode === "US";
}
