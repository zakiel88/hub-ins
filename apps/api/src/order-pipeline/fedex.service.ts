import { Injectable, Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Ensure .env is loaded from the correct path
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

@Injectable()
export class FedexService {
    private readonly logger = new Logger(FedexService.name);
    private accessToken: string | null = null;
    private tokenExpiry: number = 0;

    constructor() {
        this.logger.log(`FedEx config loaded — API Key: ${this.apiKey.substring(0, 10)}... URL: ${this.apiUrl}`);
    }

    private get apiUrl() { return process.env.FEDEX_API_URL || 'https://apis.fedex.com'; }
    private get apiKey() { return process.env.FEDEX_API_KEY || ''; }
    private get secretKey() { return process.env.FEDEX_SECRET_KEY || ''; }
    private get accountNumber() { return process.env.FEDEX_ACCOUNT_NUMBER || ''; }

    /* ── OAuth2 Token ── */
    private async getToken(): Promise<string> {
        // Return cached token if still valid (with 60s buffer)
        if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
            return this.accessToken;
        }

        this.logger.log('Requesting new FedEx OAuth token...');

        const res = await fetch(`${this.apiUrl}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.apiKey,
                client_secret: this.secretKey,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            this.logger.error(`FedEx OAuth error: ${res.status} — ${err}`);
            throw new Error(`FedEx auth failed: ${res.status}`);
        }

        const data: any = await res.json();
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in * 1000);
        this.logger.log('FedEx OAuth token obtained');
        return this.accessToken!;
    }

    /* ── Validate Address ── */
    async validateAddress(address: {
        streetLines: string[];
        city?: string;
        stateOrProvinceCode?: string;
        postalCode?: string;
        countryCode: string;
    }): Promise<{
        valid: boolean;
        classification: string; // BUSINESS | RESIDENTIAL | MIXED | UNKNOWN
        resolvedAddress: Record<string, any> | null;
        changes: string[];
        raw: any;
    }> {
        const token = await this.getToken();

        const body = {
            addressesToValidate: [
                {
                    address: {
                        streetLines: address.streetLines,
                        city: address.city,
                        stateOrProvinceCode: address.stateOrProvinceCode,
                        postalCode: address.postalCode,
                        countryCode: address.countryCode,
                    },
                },
            ],
        };

        this.logger.log(`Validating address: ${address.streetLines.join(', ')} ${address.city} ${address.postalCode} ${address.countryCode}`);

        const res = await fetch(`${this.apiUrl}/address/v1/addresses/resolve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-locale': 'en_US',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            this.logger.error(`FedEx Address Validation error: ${res.status} — ${err}`);
            throw new Error(`FedEx address validation failed: ${res.status}`);
        }

        const data: any = await res.json();
        const result = data?.output?.resolvedAddresses?.[0];

        if (!result) {
            return {
                valid: false,
                classification: 'UNKNOWN',
                resolvedAddress: null,
                changes: ['No resolution found'],
                raw: data,
            };
        }

        // Determine if address is valid based on state and attributes
        const state = result.customerMessages?.find((m: any) => m.code === 'STANDARDIZED')
            ? true
            : result.attributes?.Resolved === 'true';

        // Collect changes/issues
        const changes: string[] = [];
        if (result.customerMessages) {
            for (const msg of result.customerMessages) {
                changes.push(msg.message || msg.code);
            }
        }

        // Check DPV (Delivery Point Validation) for US addresses
        const dpv = result.attributes?.DPV;
        const matched = result.attributes?.Matched;
        const resolved = result.attributes?.Resolved;

        const isValid = (resolved === 'true' || matched === 'true') && dpv !== 'false';

        return {
            valid: isValid,
            classification: result.classification || 'UNKNOWN',
            resolvedAddress: result.streetLinesToken || result.resolvedAddress || {
                streetLines: result.streetLinesToken,
                city: result.city,
                stateOrProvince: result.stateOrProvinceCode,
                postalCode: result.postalCode,
                countryCode: result.countryCode,
            },
            changes,
            raw: result,
        };
    }

    /* ── Map Shopify address to FedEx format ── */
    mapShopifyAddress(addr: Record<string, any>) {
        const streetLines: string[] = [];
        if (addr.address1) streetLines.push(addr.address1);
        if (addr.address2) streetLines.push(addr.address2);

        // Convert country name to ISO code if needed
        const countryCode = this.getCountryCode(addr.country, addr.countryCode);

        // Convert province/state to 2-letter code
        const stateCode = this.getStateCode(addr.provinceCode || addr.province, countryCode);

        return {
            streetLines,
            city: addr.city || undefined,
            stateOrProvinceCode: stateCode || undefined,
            postalCode: addr.zip || undefined,
            countryCode,
        };
    }

    private getCountryCode(name?: string, code?: string): string {
        if (code && code.length === 2) return code;
        const map: Record<string, string> = {
            'United States': 'US', 'Canada': 'CA', 'United Kingdom': 'GB',
            'Saudi Arabia': 'SA', 'Kuwait': 'KW', 'Vietnam': 'VN',
            'Australia': 'AU', 'Japan': 'JP', 'South Korea': 'KR',
            'Singapore': 'SG', 'Malaysia': 'MY', 'Thailand': 'TH',
            'France': 'FR', 'Germany': 'DE', 'Italy': 'IT', 'Spain': 'ES',
        };
        return map[name || ''] || code || 'US';
    }

    private getStateCode(state?: string, country?: string): string | null {
        if (!state) return null;
        if (state.length <= 2) return state.toUpperCase();

        // US state name → code mapping
        const usStates: Record<string, string> = {
            'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
            'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
            'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
            'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
            'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
            'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
            'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
            'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
            'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
            'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
            'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
            'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
            'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
        };

        // Canadian province mapping
        const caProvinces: Record<string, string> = {
            'Alberta': 'AB', 'British Columbia': 'BC', 'Manitoba': 'MB',
            'New Brunswick': 'NB', 'Newfoundland and Labrador': 'NL',
            'Nova Scotia': 'NS', 'Ontario': 'ON', 'Prince Edward Island': 'PE',
            'Quebec': 'QC', 'Saskatchewan': 'SK',
        };

        const all = { ...usStates, ...caProvinces };
        return all[state] || state.substring(0, 2).toUpperCase();
    }

    /* ══════════════════════════════════════════════════════════
       Google Geocoding Fallback
       (for countries FedEx doesn't support: SA, KW, etc.)
       ══════════════════════════════════════════════════════════ */

    private get googleApiKey() { return process.env.GOOGLE_GEOCODING_API_KEY || ''; }

    async validateWithGoogle(addr: Record<string, any>): Promise<{
        valid: boolean;
        classification: string;
        resolvedAddress: Record<string, any> | null;
        changes: string[];
        provider: string;
        raw: any;
    }> {
        const parts = [
            addr.address1,
            addr.address2,
            addr.city,
            addr.province,
            addr.zip,
            addr.country,
        ].filter(Boolean);
        const addressStr = parts.join(', ');

        this.logger.log(`Google Geocoding: "${addressStr}"`);

        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressStr)}&key=${this.googleApiKey}`;

        const res = await fetch(url);
        const data: any = await res.json();

        if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
            return {
                valid: false,
                classification: 'UNKNOWN',
                resolvedAddress: null,
                changes: ['Google Geocoding: Không tìm thấy địa chỉ'],
                provider: 'google',
                raw: data,
            };
        }

        if (data.status !== 'OK') {
            this.logger.error(`Google Geocoding error: ${data.status} — ${data.error_message || ''}`);
            throw new Error(`Google Geocoding failed: ${data.status}`);
        }

        const result = data.results[0];
        const location = result.geometry?.location;
        const locationType = result.geometry?.location_type; // ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE
        const types: string[] = result.types || [];
        const isPartial = result.partial_match === true;

        // Only ROOFTOP (exact) or RANGE_INTERPOLATED (close) = valid/deliverable
        // GEOMETRIC_CENTER (area) or APPROXIMATE (rough) = not specific enough
        const isHighPrecision = locationType === 'ROOFTOP' || locationType === 'RANGE_INTERPOLATED';
        const isValid = isHighPrecision;

        // Classify: check place types
        let classification = 'UNKNOWN';
        if (types.includes('premise') || types.includes('subpremise') || types.includes('street_address')) {
            classification = 'RESIDENTIAL';
        } else if (types.includes('establishment')) {
            classification = 'BUSINESS';
        } else if (types.includes('route') || types.includes('neighborhood') || types.includes('locality')) {
            classification = 'RESIDENTIAL'; // area-level but still deliverable
        }

        // Build changes/notes
        const changes: string[] = [];
        changes.push(`Google: ${result.formatted_address}`);
        changes.push(`Độ chính xác: ${locationType === 'ROOFTOP' ? '📍 Chính xác (ROOFTOP)' : locationType === 'RANGE_INTERPOLATED' ? '📍 Gần đúng' : locationType === 'GEOMETRIC_CENTER' ? '📌 Khu vực' : '📌 Ước lượng'}`);
        if (location) changes.push(`Tọa độ: ${location.lat}, ${location.lng}`);
        if (isPartial) changes.push('ℹ Khớp một phần — nên xác nhận lại với KH');
        if (!isHighPrecision && isValid) changes.push('ℹ Địa chỉ tồn tại nhưng độ chính xác thấp');

        return {
            valid: isValid,
            classification,
            resolvedAddress: {
                formattedAddress: result.formatted_address,
                lat: location?.lat,
                lng: location?.lng,
                placeId: result.place_id,
            },
            changes,
            provider: 'google',
            raw: result,
        };
    }

    /* ── Auto Validate: FedEx first, Google fallback ── */
    async validateAddressAuto(shopifyAddr: Record<string, any>): Promise<{
        valid: boolean;
        classification: string;
        resolvedAddress: Record<string, any> | null;
        changes: string[];
        provider: string;
    }> {
        const fedexAddr = this.mapShopifyAddress(shopifyAddr);

        try {
            // Try FedEx first
            const fedexResult = await this.validateAddress(fedexAddr);

            // Check if FedEx actually supports this country
            const countrySupported = fedexResult.raw?.attributes?.CountrySupported;
            if (countrySupported === 'false') {
                this.logger.log(`FedEx doesn't support country ${fedexAddr.countryCode}, falling back to Google`);

                if (!this.googleApiKey) {
                    return {
                        valid: false,
                        classification: 'UNKNOWN',
                        resolvedAddress: null,
                        changes: [`FedEx không hỗ trợ quốc gia ${fedexAddr.countryCode}`, 'Google API chưa được cấu hình'],
                        provider: 'fedex',
                    };
                }

                const googleResult = await this.validateWithGoogle(shopifyAddr);
                return googleResult;
            }

            return {
                valid: fedexResult.valid,
                classification: fedexResult.classification,
                resolvedAddress: fedexResult.resolvedAddress,
                changes: fedexResult.changes,
                provider: 'fedex',
            };
        } catch (error: any) {
            this.logger.warn(`FedEx failed: ${error.message}, trying Google...`);

            if (this.googleApiKey) {
                try {
                    const googleResult = await this.validateWithGoogle(shopifyAddr);
                    return googleResult;
                } catch (gErr: any) {
                    this.logger.error(`Google also failed: ${gErr.message}`);
                }
            }

            throw error;
        }
    }
}
