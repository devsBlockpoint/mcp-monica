import { describe, test, expect } from "vitest";
import { loadTools } from "../src/tools-loader.ts";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "fixtures/manifest.fixture.json");

describe("loadTools", () => {
  test("returns parsed tools with normalized field names", async () => {
    const tools = await loadTools(FIXTURE);
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe("agendar_cita");
    expect(tools[0].edgeFunction).toBe("book-appointment");
    expect(tools[0].description).toBe("Crea una cita.");
    expect(tools[0].inputSchema).toEqual({
      type: "object",
      required: ["fecha"],
      properties: { fecha: { type: "string" } },
    });
  });

  test("throws on missing file", async () => {
    await expect(loadTools("/tmp/does-not-exist.json")).rejects.toThrow();
  });

  test("throws on missing required field", async () => {
    const badPath = join(__dirname, "fixtures/bad-manifest.tmp.json");
    await writeFile(badPath, JSON.stringify({ tools: [{ description: "no name" }] }));
    await expect(loadTools(badPath)).rejects.toThrow(/tool_name|edge_function/);
  });
});
