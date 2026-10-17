#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { main } from './commands.js';

process.exitCode = main(process.argv.slice(2), fileURLToPath(new URL('../../../../', import.meta.url)));
