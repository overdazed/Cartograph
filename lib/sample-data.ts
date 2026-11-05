import raw from "@/data/excalidraw.json";

import type { ParseResult } from "@/parser/types";

// Scaffolding for phase 4: a real parse checked into the repo so the interface
// can be built without an account, a database or a network. Goes away once
// analyses are stored properly. The parser's shape is the contract; this file
// only re-types it.
export const sampleParseResult: ParseResult = raw as ParseResult;
