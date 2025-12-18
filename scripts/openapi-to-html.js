#!/usr/bin/env node

// @ts-check

import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { argv, cwd } from 'node:process';
import { execSync } from 'node:child_process';

const [, , absOrRelOpenApiPath] = argv;

if (typeof absOrRelOpenApiPath !== 'string' || absOrRelOpenApiPath.trim() === '') {
  throw new Error('Please provide a relative path to the OpenAPI file.');
}

const absOpenApiPath = absOrRelOpenApiPath.startsWith('/') ? absOrRelOpenApiPath : join(cwd(), absOrRelOpenApiPath);

// Check if file has a valid OpenAPI extension
const validExtensions = ['.yaml', '.yml', '.json'];
if (!validExtensions.some(ext => absOpenApiPath.toLowerCase().endsWith(ext))) {
  throw new Error('The provided path must point to an OpenAPI file (.yaml, .yml, or .json).');
}

if (!(await stat(absOpenApiPath).catch(() => false))) {
  throw new Error(`OpenAPI file does not exist at path: ${absOpenApiPath}`);
}

const outputHtmlPath = absOpenApiPath.replace(/\.(yaml|yml|json)$/i, '.html');

try {
  console.log(`Converting OpenAPI file: ${absOpenApiPath}`);
  console.log(`Output HTML will be: ${outputHtmlPath}`);
  
  // Use npx to run Redocly CLI build-docs command
  // This generates a standalone HTML file with all assets embedded
  execSync(`npx @redocly/cli build-docs "${absOpenApiPath}" --output "${outputHtmlPath}"`, {
    stdio: 'inherit',
    encoding: 'utf8',
    cwd: cwd()
  });

  console.log(`HTML generated successfully at: ${outputHtmlPath}`);
} catch (error) {
  console.error('Error generating HTML:', error.message);
  throw error;
}