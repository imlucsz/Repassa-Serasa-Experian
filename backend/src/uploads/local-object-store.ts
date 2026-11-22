import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.validation';
import { ObjectStore, OBJECT_KEY_PATTERN } from './object-store';

/**
 * Local-disk object store — development and test driver. NOT production-durable:
 * on platforms with ephemeral filesystems (e.g. Render without a persistent
 * disk) objects are lost on restart/redeploy, see docs/repassa/DEPLOYMENT.md.
 * Env validation refuses this driver in production.
 */
@Injectable()
export class LocalObjectStore extends ObjectStore {
  private readonly rootDir: string;

  constructor(config: ConfigService<EnvConfig, true>) {
    super();
    this.rootDir = resolve(config.get('uploadDir', { infer: true }));
  }

  async put(key: string, body: Buffer): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    await writeFile(join(this.rootDir, key), body, { flag: 'wx' });
  }

  async get(key: string): Promise<Buffer | undefined> {
    if (!OBJECT_KEY_PATTERN.test(key)) return undefined;
    const path = join(this.rootDir, key);
    if (!existsSync(path)) return undefined;
    try {
      return await readFile(path);
    } catch {
      return undefined;
    }
  }
}
