#!/usr/bin/env node
// Client verification — catches known bug patterns before deploy
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(__dirname, '..', 'client', 'dist', 'bundle.js');

console.log('Verifying client bundle...');
const code = readFileSync(bundlePath, 'utf8');
const lines = code.split('\n');
let errors = [];

// Check 1: Double-reference patterns (e.e.dead, e.e.sleeping)
const doubleRefs = code.match(/e\.e\.\w+/g);
if (doubleRefs) {
  errors.push(`Found double-reference patterns: ${[...new Set(doubleRefs)].join(', ')}`);
}

// Check 2: Check source files for known bad patterns
const entitiesPath = join(__dirname, '..', 'client', 'renderer', 'entities.js');
try {
  const src = readFileSync(entitiesPath, 'utf8');
  const srcLines = src.split('\n');

  // Find drawHeldWeapon function boundaries
  let heldStart = -1, heldEnd = -1;
  for (let i = 0; i < srcLines.length; i++) {
    if (srcLines[i].includes('function drawHeldWeapon')) heldStart = i;
    if (heldStart >= 0 && heldEnd < 0 && i > heldStart) {
      // Next function definition marks the end
      if (srcLines[i].match(/^\s+function draw\w+/) && i > heldStart + 2) {
        heldEnd = i;
      }
    }
  }

  if (heldStart >= 0 && heldEnd >= 0) {
    for (let i = heldStart + 1; i < heldEnd; i++) {
      const line = srcLines[i].trim();
      if (line.startsWith('//')) continue;
      if (/\be\.\w+/.test(line)) {
        errors.push(`entities.js:${i + 1}: 'e.' reference in drawHeldWeapon (no 'e' param): ${line}`);
      }
    }
  }
} catch (e) {
  // Source check optional
}

// Check 3: Bundle has content
if (code.length < 1000) {
  errors.push('Bundle is suspiciously small');
}

if (errors.length > 0) {
  console.error('FAIL:');
  errors.forEach(e => console.error(`  ❌ ${e}`));
  process.exit(1);
} else {
  console.log(`PASS: ${lines.length} lines, ${(code.length / 1024).toFixed(1)}kb`);
  process.exit(0);
}
