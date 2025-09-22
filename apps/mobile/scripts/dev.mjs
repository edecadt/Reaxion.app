#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const LOGGER_PREFIX = '[mobile-dev]';
const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const projectRoot = resolve(scriptDir, '..');
const monorepoRoot = resolve(projectRoot, '..', '..');

const candidatePaths = [
  resolve(projectRoot, '.env.local'),
  resolve(projectRoot, '.env.development'),
  resolve(projectRoot, '.env'),
  resolve(monorepoRoot, '.env.local'),
  resolve(monorepoRoot, '.env.development'),
  resolve(monorepoRoot, '.env'),
];

const env = { ...process.env };

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

const desiredPort = env.MOBILE_PORT ?? env.EXPO_DEV_SERVER_PORT ?? env.PORT ?? '19000';
env.PORT = desiredPort;
env.EXPO_DEV_SERVER_PORT = desiredPort;
env.EXPO_METRO_PORT = desiredPort;

console.log(`${LOGGER_PREFIX} starting Expo on port ${env.EXPO_DEV_SERVER_PORT}`);

const expoBin = resolve(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'expo.cmd' : 'expo',
);

if (!existsSync(expoBin)) {
  console.error(`${LOGGER_PREFIX} could not find Expo CLI at ${expoBin}. Did you run pnpm install?`);
  process.exit(1);
}

const child = spawn(expoBin, ['start', '--port', env.EXPO_DEV_SERVER_PORT], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
