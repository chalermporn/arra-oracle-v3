#!/usr/bin/env bun
/**
 * Additive wiki indexer.
 *
 * Collects ψ/wiki/ pages and upserts them into SQLite + FTS5 WITHOUT running the
 * full reindex's smart-delete pass — safe to run against an existing DB built by
 * another indexer version (no risk of dropping/duplicating non-wiki docs).
 *
 * After this, run `bun src/scripts/index-model.ts bge-m3` to embed into LanceDB.
 *
 * Usage:
 *   ORACLE_REPO_ROOT=/path/to/vault bun src/scripts/index-wiki.ts
 */

import { createDatabase } from '../db/index.ts';
import { collectWiki } from '../indexer/collectors.ts';
import { storeDocuments } from '../indexer/storage.ts';
import { resolveIndexerRepoRoot, createIndexerConfig } from '../indexer/runner.ts';
import { detectProject } from '../server/project-detect.ts';

async function main() {
  const repoRoot = resolveIndexerRepoRoot();
  const config = createIndexerConfig(repoRoot);
  console.log(`=== Wiki Indexer (additive) ===`);
  console.log(`repoRoot: ${repoRoot}`);
  console.log(`DB:       ${config.dbPath}`);
  console.log(`Wiki:     ${config.sourcePaths.wiki ?? '(disabled)'}`);

  const { db, sqlite } = createDatabase(config.dbPath);
  try {
    const project = detectProject(repoRoot);
    const docs = collectWiki({ config, seenContentHashes: new Set() });
    if (docs.length === 0) {
      console.log('No wiki documents found — nothing to do.');
      return;
    }
    // vectorClient = null → SQLite + FTS5 only; embedding is a separate step.
    await storeDocuments(sqlite, db, null, project, docs);
    console.log(`\n=== Done ===`);
    console.log(`Stored ${docs.length} wiki docs (SQLite + FTS5).`);
    console.log(`Next: bun src/scripts/index-model.ts bge-m3`);
  } finally {
    sqlite.close();
  }
}

main();
