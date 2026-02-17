import { sleep } from './utils.js';

export interface ImwebClient {
  updateProductCode(externalId: string, masterCode: string): Promise<void>;
}

export interface MockImwebClientOptions {
  latencyMs?: number;
  jitterMs?: number;
  logger?: (message: string) => void;
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

export function createImwebClient(): ImwebClient {
  return new MockImwebClient();
}
