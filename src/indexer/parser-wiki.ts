/**
 * Markdown parser for wiki pages (ψ/wiki/<topic>.md).
 *
 * Wiki pages are the AI-maintained synthesis layer of the LLM Wiki pattern.
 * Mirrors parseLearningFile: split by ## headers into granular docs, fall back
 * to a whole-file document. type='wiki' so results are distinguishable from
 * learnings/retros while still surfacing in default ('all') search.
 *
 * Navigation files (index.md, log.md) are excluded by the collector, not here.
 */

import type { OracleDocument } from '../types.ts';
import { extractConcepts, mergeConceptsWithTags } from './concepts.ts';
import { inferProjectFromPath } from './discovery.ts';
import { parseFrontmatterTags, parseFrontmatterString, parseFrontmatterProject, stripFrontmatter } from './frontmatter.ts';

export function parseWikiFile(relativePath: string, content: string, sourceFileOverride?: string): OracleDocument[] {
  const documents: OracleDocument[] = [];
  const sourceFile = sourceFileOverride || relativePath;
  const now = Date.now();

  const filename = relativePath.split('/').pop()?.replace('.md', '') || relativePath;
  const fileTags = parseFrontmatterTags(content);
  const fileProject = parseFrontmatterProject(content) || inferProjectFromPath(sourceFile);
  const title = parseFrontmatterString(content, ['title']) || filename;
  const body = stripFrontmatter(content).trim() || content;

  const sections = /^##\s+/m.test(body) ? body.split(/^##\s+/m).filter(s => s.trim()) : [];

  sections.forEach((section, index) => {
    const lines = section.split('\n');
    const sectionTitle = lines[0].trim();
    const sectionBody = lines.slice(1).join('\n').trim();
    if (!sectionBody) return;

    const extracted = extractConcepts(sectionTitle, sectionBody);
    documents.push({
      id: `wiki_${filename}_${index}`, type: 'wiki', source_file: sourceFile,
      content: `${title} - ${sectionTitle}: ${sectionBody}`,
      concepts: mergeConceptsWithTags(extracted, fileTags),
      created_at: now, updated_at: now, project: fileProject || undefined,
    });
  });

  if (documents.length === 0) {
    const extracted = extractConcepts(title, body);
    documents.push({
      id: `wiki_${filename}`, type: 'wiki', source_file: sourceFile,
      content: `${title}: ${body}`,
      concepts: mergeConceptsWithTags(extracted, fileTags),
      created_at: now, updated_at: now, project: fileProject || undefined,
    });
  }

  return documents;
}
