import { Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  LoadedService,
  ManifestValidationError,
  validateManifest,
} from './manifest.types';

@Injectable()
export class ServiceLoader {
  private readonly logger = new Logger(ServiceLoader.name);
  private readonly servicesRoot = ServiceLoader.resolveServicesRoot();

  get root() {
    return this.servicesRoot;
  }

  private static resolveServicesRoot(): string {
    const fallback = resolve(process.cwd(), 'services');
    const candidates = [
      fallback,
      resolve(process.cwd(), '..', 'services'),
      resolve(process.cwd(), '..', '..', 'services'),
      resolve(__dirname, '..', '..', '..', '..', 'services'),
    ];

    const found = candidates.find((candidate) => existsSync(candidate));
    return found ?? fallback;
  }

  async discover(): Promise<LoadedService[]> {
    let entries: Awaited<ReturnType<typeof readdir>> = [];

    try {
      entries = await readdir(this.servicesRoot, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        this.logger.warn(
          `Services directory not found at ${this.servicesRoot}, continuing with no services`,
        );
        return [];
      }

      throw error;
    }

    const services: LoadedService[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const serviceId = entry.name;
      const servicePath = join(this.servicesRoot, serviceId);
      const manifestPath = join(servicePath, 'manifest.json');

      try {
        await stat(manifestPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          throw new ManifestValidationError(
            `Missing manifest.json for service "${serviceId}"`,
          );
        }

        throw error;
      }

      let rawManifest = '';
      try {
        rawManifest = await readFile(manifestPath, 'utf8');
      } catch (error) {
        throw new ManifestValidationError(
          `Unable to read manifest for service "${serviceId}": ${error instanceof Error ? error.message : error}`,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawManifest);
      } catch (error) {
        throw new ManifestValidationError(
          `Invalid JSON in manifest for service "${serviceId}": ${error instanceof Error ? error.message : error}`,
        );
      }

      const manifest = validateManifest(
        parsed,
        serviceId,
        manifestPath,
        servicePath,
      );

      services.push(manifest);
    }

    return services;
  }
}
