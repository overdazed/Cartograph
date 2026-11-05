import fs from "node:fs";

import { foldDirectories, buildFoldedNodes, buildEdges } from "../lib/graph/index.ts";

const file = process.argv[2];
if (!file) {
  console.error("Usage: map-counts <analysis.json>");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const surviving = foldDirectories(data.files);
const nodes = buildFoldedNodes(data.files, surviving);
const ids = new Set(nodes.map((n) => n.id));
const edges = buildEdges(data.edges, surviving);

console.log(`files: ${data.files.length}`);
console.log(`node count: ${nodes.length}`);
console.log(`min files/node: ${Math.min(...nodes.map((n) => n.fileCount))}`);
console.log(`single-file nodes: ${nodes.filter((n) => n.fileCount <= 1).length}`);
console.log(`edges: ${edges.length}`);
console.log(`bad edges: ${edges.filter((e) => !ids.has(e.from) || !ids.has(e.to)).length}`);