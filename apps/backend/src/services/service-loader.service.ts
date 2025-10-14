import { Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';

import {
  LoadedService,
  ManifestValidationError,
  ServiceManifest,
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
    let entries: import('fs').Dirent[] = [];

    try {
      entries = (await readdir(this.servicesRoot, {
        withFileTypes: true,
      })) as import('fs').Dirent[];
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

      const serviceId = entry.name as string;
      const servicePath = join(this.servicesRoot, serviceId);

      try {
        const sdkService = await this.discoverSDKService(
          serviceId,
          servicePath,
        );
        if (sdkService) {
          services.push(sdkService);
          continue;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to load SDK service ${serviceId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const manifestPath = join(servicePath, 'manifest.json');

      try {
        await stat(manifestPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          throw new ManifestValidationError(
            `Missing manifest.json or SDK service for "${serviceId}"`,
          );
        }

        throw error;
      }

      let rawManifest = '';
      try {
        rawManifest = await readFile(manifestPath, 'utf8');
      } catch (error) {
        throw new ManifestValidationError(
          `Unable to read manifest for service "${serviceId}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawManifest);
      } catch (error) {
        throw new ManifestValidationError(
          `Invalid JSON in manifest for service "${serviceId}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const manifest = validateManifest(
        parsed,
        serviceId as string,
        manifestPath,
        servicePath,
      );

      services.push(manifest);
    }

    return services;
  }

  private async discoverSDKService(
    serviceId: string,
    servicePath: string,
  ): Promise<LoadedService | null> {
    const candidateFiles = ['index.ts', 'index.js', 'service.ts', 'service.js'];

    type SDKService = {
      __isSDKService: true;
      getManifest(): ServiceManifest;
    };

    let serviceDef: SDKService | null = null;
    let handlerPath: string | null = null;

    for (const candidate of candidateFiles) {
      const candidatePath = join(servicePath, candidate);

      if (!existsSync(candidatePath)) {
        continue;
      }

      try {
        let moduleExports: any;

        if (candidate.endsWith('.ts')) {
          const jiti = createJiti(candidatePath, {
            interopDefault: true,
          });
          moduleExports = await jiti.import(candidatePath);
        } else {
          const moduleUrl = pathToFileURL(candidatePath);
          moduleUrl.searchParams.set('t', Date.now().toString());
          moduleExports = await import(moduleUrl.href);
        }

        const candidateModule =
          moduleExports.default || moduleExports.service || moduleExports;

        if (
          candidateModule &&
          typeof candidateModule === 'object' &&
          '__isSDKService' in candidateModule
        ) {
          serviceDef = candidateModule as SDKService;
          handlerPath = candidatePath;
          break;
        }
      } catch (error) {
        this.logger.debug(
          `Failed to load ${candidatePath}: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
    }

    if (!serviceDef) {
      return null;
    }

    try {
      const manifest = serviceDef.getManifest();

      if (manifest.id !== serviceId) {
        throw new ManifestValidationError(
          `SDK Service id (${manifest.id}) does not match directory name (${serviceId})`,
        );
      }

      return {
        ...manifest,
        manifestPath: handlerPath!,
        servicePath,
        handlerPath,
      };
    } catch (error) {
      throw new ManifestValidationError(
        `Failed to generate manifest from SDK service ${serviceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
