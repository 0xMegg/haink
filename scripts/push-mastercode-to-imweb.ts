#!/usr/bin/env tsx
import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import pLimit from 'p-limit';
import { PrismaClient, ExternalSystem, SyncDirection, SourceOfTruth } from '@prisma/client';

import { createImwebClient } from '../src/lib/imwebClient.js';
import { ensureDir, resolveReportPath, sleep } from '../src/lib/utils.js';

interface PushCliArgs {
  limit: number;
  concurrency: number;
  rateLimit: number;
  retries: number;
  backoffMs: number;
  report?: string;
  dryRun: boolean;
  onlyUnsynced: boolean;
}

interface PushResultLine {
  timestamp: string;
  externalId: string;
  productId: string;
  masterCode: string;
  status: 'success' | 'error';
  message?: string;
}

type ExternalMapWithProduct = {
  id: string;
  external_id: string;
  product: {
    id: string;
    master_code: string;
    name: string;
  };
};

const prisma = new PrismaClient();
const imwebClient = createImwebClient();

class RateLimiter {
  private nextAvailable = Date.now();
  private readonly minInterval: number;

  constructor(eventsPerSecond: number) {
    if (eventsPerSecond <= 0) {
      throw new Error('rateLimit 은 1 이상이어야 합니다.');
    }
    this.minInterval = Math.ceil(1000 / eventsPerSecond);
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const waitUntil = Math.max(this.nextAvailable, now);
    const delay = waitUntil - now;
    this.nextAvailable = waitUntil + this.minInterval;
    if (delay > 0) {
      await sleep(delay);
    }
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('limit', { type: 'number', default: 100, describe: '처리할 최대 상품 수' })
    .option('concurrency', { type: 'number', default: 3, describe: '동시 처리 개수' })
    .option('rate-limit', { type: 'number', default: 5, describe: '초당 요청 수 제한' })
    .option('retries', { type: 'number', default: 3, describe: '실패 시 재시도 횟수' })
    .option('backoff-ms', { type: 'number', default: 500, describe: '초기 백오프(ms)' })
    .option('report', { type: 'string', describe: '결과 JSONL 경로' })
    .option('dry-run', { type: 'boolean', default: false, describe: 'Imweb 실제 호출 없이 시뮬레이션' })
    .option('only-unsynced', { type: 'boolean', default: true, describe: '최근 PUSH 되지 않은 항목만 선택' })
    .help()
    .parseAsync();

  const args: PushCliArgs = {
    limit: Math.max(1, argv.limit ?? 100),
    concurrency: Math.max(1, argv.concurrency ?? 3),
    rateLimit: Math.max(1, argv['rate-limit'] ?? 5),
    retries: Math.max(0, argv.retries ?? 3),
    backoffMs: Math.max(100, argv['backoff-ms'] ?? 500),
    report: argv.report,
    dryRun: argv['dry-run'] ?? false,
    onlyUnsynced: argv['only-unsynced'] ?? true,
  };

  const reportPath = path.resolve(resolveReportPath(args.report ?? path.join('reports', `imweb-push-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`)));
  await ensureDir(path.dirname(reportPath));

  try {
    const targets = (await prisma.externalProductMap.findMany({
      where: {
        system: ExternalSystem.IMWEB,
        ...(args.onlyUnsynced
          ? {
              OR: [
                { last_sync_direction: null },
                { last_sync_direction: { not: SyncDirection.PUSH } },
                { last_synced_at: null },
              ],
            }
          : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            master_code: true,
            name: true,
          },
        },
      },
      orderBy: [
        { last_synced_at: 'asc' },
        { created_at: 'asc' },
      ],
      take: args.limit,
    })) as ExternalMapWithProduct[];

    if (targets.length === 0) {
      console.log('푸시할 대상이 없습니다.');
      return;
    }

    console.log(`총 ${targets.length}건을 처리합니다. (dryRun=${args.dryRun})`);

    const limiter = pLimit(args.concurrency);
    const rateLimiter = new RateLimiter(args.rateLimit);

    let success = 0;
    let failure = 0;

    const tasks = targets.map((target) =>
      limiter(async () => {
        const result = await processSingle(target, { rateLimiter, args, reportPath });
        if (result.status === 'success') {
          success += 1;
        } else {
          failure += 1;
        }
      })
    );

    await Promise.all(tasks);
    console.log(`완료: success=${success}, failure=${failure}`);
  } catch (error) {
    console.error('마스터 코드 푸시 중 오류:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

async function processSingle(target: ExternalMapWithProduct, context: { rateLimiter: RateLimiter; args: PushCliArgs; reportPath: string; }): Promise<PushResultLine> {
  const { rateLimiter, args, reportPath } = context;
  const externalId = target.external_id;
  const masterCode = target.product.master_code;

  const lineBase: PushResultLine = {
    timestamp: new Date().toISOString(),
    externalId,
    productId: target.product.id,
    masterCode,
    status: 'success',
  };

  try {
    if (!masterCode) {
      throw new Error('master_code 가 비어있습니다.');
    }

    await rateLimiter.wait();

    if (!args.dryRun) {
      await runWithRetry(() => imwebClient.updateProductCode(externalId, masterCode), args.retries, args.backoffMs);

      await prisma.externalProductMap.update({
        where: { id: target.id },
        data: {
          last_sync_direction: SyncDirection.PUSH,
          last_synced_at: new Date(),
          source_of_truth: SourceOfTruth.MASTER,
        },
      });
    } else {
      console.log(`[DRY-RUN] ${externalId} => ${masterCode}`);
    }

    await appendReportLine(reportPath, lineBase);
    return lineBase;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorLine: PushResultLine = { ...lineBase, status: 'error', message };
    await appendReportLine(reportPath, errorLine);
    console.error(`푸시 실패 (${externalId}): ${message}`);
    return errorLine;
  }
}

async function appendReportLine(reportPath: string, line: PushResultLine): Promise<void> {
  const data = JSON.stringify(line);
  await fs.appendFile(reportPath, data + '\n', 'utf8');
}

async function runWithRetry<T>(fn: () => Promise<T>, retries: number, backoffMs: number): Promise<T> {
  let attempt = 0;
  // retries 는 실패 후 재시도 횟수
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      const delay = backoffMs * 2 ** attempt;
      attempt += 1;
      console.warn(`오류 발생, ${delay}ms 후 재시도 (${attempt}/${retries})`);
      await sleep(delay);
    }
  }
}

void main();
