import { sleep } from './utils.js';

export interface ImwebClient {
  updateProductCode(externalId: string, masterCode: string): Promise<void>;
}

export interface MockImwebClientOptions {
  latencyMs?: number;
  jitterMs?: number;
  logger?: (message: string) => void;
}

interface HttpImwebClientConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  shopId: string;
  timeoutMs: number;
  tokenSkewMs: number;
}

interface AccessToken {
  value: string;
  expiresAt: number;
}

type FetchImplementation = typeof fetch;

class ImwebApiError extends Error {
  readonly status?: number;
  readonly responseBody?: unknown;

  constructor(message: string, status?: number, responseBody?: unknown) {
    super(message);
    this.name = 'ImwebApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

class HttpImwebClient implements ImwebClient {
  private readonly config: HttpImwebClientConfig;
  private readonly fetchImpl: FetchImplementation;
  private cachedToken?: AccessToken;
  private inflightToken?: Promise<AccessToken>;

  constructor(config: HttpImwebClientConfig, fetchImpl: FetchImplementation = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async updateProductCode(externalId: string, masterCode: string): Promise<void> {
    if (!externalId.trim()) {
      throw new Error('externalId 가 비어있어 Imweb 연동을 수행할 수 없습니다.');
    }
    if (!masterCode.trim()) {
      throw new Error('masterCode 가 비어있어 Imweb 연동을 수행할 수 없습니다.');
    }

    await this.request(`/v2/shop/products/${encodeURIComponent(externalId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ custom_prod_code: masterCode }),
    });
  }

  private async request(path: string, init: RequestInit): Promise<void> {
    const token = await this.ensureAccessToken();
    const url = new URL(path, this.config.baseUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        headers: this.withHeaders(init.headers, token),
        signal: controller.signal,
      });

      if (!response.ok) {
        let body: unknown = undefined;
        try {
          body = await response.json();
        } catch {
          try {
            body = await response.text();
          } catch {
            body = undefined;
          }
        }
        throw new ImwebApiError(
          `Imweb API 호출 실패 (${response.status})`,
          response.status,
          body
        );
      }
    } catch (error) {
      if (error instanceof ImwebApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ImwebApiError('Imweb API 요청이 시간 초과되었습니다.', undefined, {
          timeoutMs: this.config.timeoutMs,
        });
      }
      throw new ImwebApiError(`Imweb API 요청 중 오류: ${error}`, undefined);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async ensureAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt - this.config.tokenSkewMs > now) {
      return this.cachedToken.value;
    }

    if (!this.inflightToken) {
      this.inflightToken = this.fetchAccessToken()
        .then((token) => {
          this.cachedToken = token;
          return token;
        })
        .finally(() => {
          this.inflightToken = undefined;
        });
    }

    const token = await this.inflightToken;
    return token.value;
  }

  private async fetchAccessToken(): Promise<AccessToken> {
    const url = new URL('/v2/auth', this.config.baseUrl);
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      let body: unknown = undefined;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }
      throw new ImwebApiError(`Imweb 토큰 발급 실패 (${response.status})`, response.status, body);
    }

    const payload = (await response.json()) as {
      data?: { access_token?: string; expires_in?: number; expired_in?: number; token_type?: string; };
    };
    const accessToken = payload.data?.access_token;
    const expiresInSec = payload.data?.expires_in ?? payload.data?.expired_in ?? 0;
    if (!accessToken || !expiresInSec) {
      throw new ImwebApiError('Imweb 토큰 응답 형식이 올바르지 않습니다.', response.status, payload);
    }

    const expiresAt = Date.now() + Math.max(1, expiresInSec) * 1000;
    return { value: accessToken, expiresAt };
  }

  private withHeaders(headers: HeadersInit | undefined, token: string): HeadersInit {
    const baseHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'x-shop-id': this.config.shopId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (!headers) {
      return baseHeaders;
    }

    if (headers instanceof Headers) {
      const merged = new Headers(headers);
      Object.entries(baseHeaders).forEach(([key, value]) => merged.set(key, value));
      return merged;
    }

    if (Array.isArray(headers)) {
      const merged = new Headers();
      headers.forEach(([key, value]) => merged.append(key, value));
      Object.entries(baseHeaders).forEach(([key, value]) => merged.set(key, value));
      return merged;
    }

    return { ...headers, ...baseHeaders };
  }
}

export class MockImwebClient implements ImwebClient {
  private readonly latencyMs: number;
  private readonly jitterMs: number;
  private readonly logger: (message: string) => void;

  constructor(options: MockImwebClientOptions = {}) {
    this.latencyMs = options.latencyMs ?? 100;
    this.jitterMs = options.jitterMs ?? 50;
    this.logger = options.logger ?? console.log;
  }

  async updateProductCode(externalId: string, masterCode: string): Promise<void> {
    const jitter = Math.floor(Math.random() * this.jitterMs);
    await sleep(this.latencyMs + jitter);
    this.logger(`Mock Imweb 업데이트 완료: ${externalId} => ${masterCode}`);
  }
}

let warnedMissingCredentials = false;

export function createImwebClient(): ImwebClient {
  const clientId = process.env.IMWEB_API_CLIENT_ID ?? '';
  const clientSecret = process.env.IMWEB_API_CLIENT_SECRET ?? '';
  const shopId = process.env.IMWEB_API_SHOP_ID ?? '';
  const baseUrl = process.env.IMWEB_API_BASE_URL?.trim() || 'https://api.imweb.me';
  const timeoutMs = Number(process.env.IMWEB_API_TIMEOUT_MS ?? '15000');
  const tokenSkewMs = 30_000;

  if (clientId && clientSecret && shopId) {
    return new HttpImwebClient({
      baseUrl: ensureTrailingSlash(baseUrl),
      clientId,
      clientSecret,
      shopId,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000,
      tokenSkewMs,
    });
  }

  if (!warnedMissingCredentials && process.env.NODE_ENV !== 'test') {
    console.warn('IMWEB API 환경 변수가 설정되지 않아 MockImwebClient 를 사용합니다.');
    warnedMissingCredentials = true;
  }

  return new MockImwebClient();
}

function ensureTrailingSlash(value: string): string {
  try {
    const url = new URL(value);
    return url.toString();
  } catch {
    throw new Error(`잘못된 IMWEB_API_BASE_URL 값입니다: ${value}`);
  }
}
