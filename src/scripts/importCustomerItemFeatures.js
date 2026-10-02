/**
 * One-off importer: populates the existing CustomerItemFeature collection from
 * the model's training CSV (retailbrain_training_data_v2.csv).
 *
 * Usage (from /backend):
 *   node src/scripts/importCustomerItemFeatures.js [path/to/csv] [--dry-run]
 *
 * Default CSV path: <repo>/ml/data/training/retailbrain_training_data_v2.csv
 *
 * Rules this script follows:
 *  - Only the 19 trained feature columns are copied (REQUIRED_FEATURES, the
 *    same list mlService.js sends to the model). Values are copied verbatim.
 *  - `target` and `split` are never read into the stored record, and
 *    `prediction_point` is used ONLY to choose which snapshot to keep.
 *  - A (visitor_id, item_id) pair can appear at up to 5 prediction points.
 *    The snapshot with the LATEST prediction_point is kept, because it is the
 *    most recent state of that pair's history.
 *  - IDs: CSV ids are plain integers; they are stored as CUST-<visitor_id>
 *    and ITEM-<item_id> (no zero padding) to match the identifiers the app uses.
 *  - Nothing is defaulted or coerced: a malformed row aborts the import.
 *  - Safe to re-run: records are upserted on (customerId, itemId).
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { connectDB, disconnectDB } from '../config/db.js';
import CustomerItemFeature from '../models/CustomerItemFeature.js';
import { REQUIRED_FEATURES } from '../services/mlService.js';

const CUSTOMER_PREFIX = 'CUST-';
const ITEM_PREFIX = 'ITEM-';
const BATCH_SIZE = 5000;
const MAX_PAIRS = 100000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = path.resolve(
  __dirname,
  '../../../ml/data/training/retailbrain_training_data_v2.csv'
);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const csvPath = path.resolve(
  args.find((a) => !a.startsWith('--')) || DEFAULT_CSV
);

async function readLatestSnapshots() {
  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath),
    crlfDelay: Infinity,
  });

  let columnIndex = null;
  let lineNo = 0;
  let rowsRead = 0;

  // key "visitorId|itemId" -> { pp: prediction_point, values: [19 numbers] }
  const latest = new Map();

  for await (const rawLine of rl) {
    lineNo += 1;
    const line = rawLine.trim();

    if (!line) continue;

    const cells = line.split(',');

    if (!columnIndex) {
      columnIndex = Object.fromEntries(
        cells.map((name, i) => [name.trim(), i])
      );

      const needed = [
        'visitor_id',
        'item_id',
        'prediction_point',
        ...REQUIRED_FEATURES,
      ];

      const missing = needed.filter((c) => !(c in columnIndex));

      if (missing.length) {
        throw new Error(
          `CSV is missing required column(s): ${missing.join(', ')}`
        );
      }

      continue;
    }

    rowsRead += 1;

    const visitorId = cells[columnIndex.visitor_id];
    const itemId = cells[columnIndex.item_id];

    if (!/^\d+$/.test(visitorId) || !/^\d+$/.test(itemId)) {
      throw new Error(
        `Line ${lineNo}: invalid visitor_id/item_id (${visitorId}, ${itemId})`
      );
    }

    const pp = Number(cells[columnIndex.prediction_point]);

    if (!Number.isFinite(pp)) {
      throw new Error(`Line ${lineNo}: invalid prediction_point`);
    }

    const key = `${visitorId}|${itemId}`;
    const existing = latest.get(key);

    if (existing && existing.pp >= pp) {
      continue;
    }

    const values = REQUIRED_FEATURES.map((name) => {
      const v = Number(cells[columnIndex[name]]);

      if (
        cells[columnIndex[name]] === '' ||
        !Number.isFinite(v)
      ) {
        throw new Error(
          `Line ${lineNo}: feature "${name}" is not numeric (${cells[columnIndex[name]]})`
        );
      }

      return v;
    });

    latest.set(key, { pp, values });
  }

  return { latest, rowsRead };
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }

  console.log(`[import] reading ${csvPath}`);

  const { latest, rowsRead } = await readLatestSnapshots();

  const limitedLatest = new Map(
    [...latest].slice(0, MAX_PAIRS)
  );

  console.log(
    `[import] ${rowsRead} CSV rows -> ${latest.size} unique customer/item pairs ` +
      `(${rowsRead - latest.size} older snapshots skipped)`
  );

  console.log(
    `[import] importing ${limitedLatest.size} pairs (limit: ${MAX_PAIRS})`
  );

  if (dryRun) {
    console.log('[import] --dry-run: database not touched.');
    return;
  }

  await connectDB();

  let ops = [];
  let written = 0;

  const flush = async () => {
    if (!ops.length) return;

    await CustomerItemFeature.bulkWrite(ops, {
      ordered: false,
    });

    written += ops.length;
    ops = [];

    if (written % (BATCH_SIZE * 10) === 0) {
      console.log(
        `[import] upserted ${written}/${limitedLatest.size}`
      );
    }
  };

  for (const [key, { values }] of limitedLatest) {
    const [visitorId, itemId] = key.split('|');

    const customerId = `${CUSTOMER_PREFIX}${visitorId}`;
    const itemKey = `${ITEM_PREFIX}${itemId}`;

    const features = {};

    REQUIRED_FEATURES.forEach((name, i) => {
      features[name] = values[i];
    });

    ops.push({
      updateOne: {
        filter: {
          customerId,
          itemId: itemKey,
        },
        update: {
          $set: features,
        },
        upsert: true,
      },
    });

    if (ops.length >= BATCH_SIZE) {
      await flush();
    }
  }

  await flush();

  const total = await CustomerItemFeature.countDocuments();

  console.log(
    `[import] done. ${written} pairs upserted; collection now holds ${total} records.`
  );
}

main()
  .then(async () => {
    if (!dryRun) {
      await disconnectDB();
    }

    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[import] FAILED:', err.message);

    try {
      if (!dryRun) {
        await disconnectDB();
      }
    } catch {
      // ignore
    }

    process.exit(1);
  });