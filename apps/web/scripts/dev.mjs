#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOGGER_PREFIX = '[web-dev]';
const projectRoot = resolve(globalThis.process.cwd());
const monorepoRoot = resolve(projectRoot, '..', '..');

const candidatePaths = [
  resolve(projectRoot, '.env.local'),
  resolve(projectRoot, '.env.development'),
  resolve(projectRoot, '.env'),
  resolve(monorepoRoot, '.env.local'),
  resolve(monorepoRoot, '.env.development'),
  resolve(monorepoRoot, '.env'),
];

const env = { ...globalThis.process.env };

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    console.log(`${LOGGER_PREFIX} env candidate missing: ${filePath}`);
    return;
  }
  try {
    const content = readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      } 
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        return;
      }
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      env[key] = value.replace(/^['"]|['"]$/g, '');
    });
    console.log(`${LOGGER_PREFIX} loaded env file: ${filePath}`);
  } catch (error) {
    console.error(`${LOGGER_PREFIX} failed to read ${filePath}:`, error);
  }
}

candidatePaths.forEach(loadEnvFile);

const desiredPort =
  env.WEB_PORT ?? env.NEXT_PORT ?? env.NEXT_PUBLIC_PORT ?? '8081';

env.WEB_PORT = desiredPort;
env.PORT = desiredPort;

console.log(`${LOGGER_PREFIX} starting Next.js on port ${env.PORT}`);

const nextBin = resolve(projectRoot, 'node_modules', '.bin', globalThis.process.platform === 'win32' ? 'next.cmd' : 'next');
if (!existsSync(nextBin)) {
  console.error(`${LOGGER_PREFIX} could not find Next.js binary at ${nextBin}. Did you run pnpm install?`);
  globalThis.process.exit(1);
}

const child = spawn(nextBin, ['dev', '--turbopack'], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    globalThis.process.kill(globalThis.process.pid, signal);
    return;
  }
  globalThis.process.exit(code ?? 0);
});
