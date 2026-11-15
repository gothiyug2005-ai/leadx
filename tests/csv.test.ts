import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "@/lib/export/csv";

describe("CSV export", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Raman, Priya")).toBe('"Raman, Priya"');
    expect(csvCell('She said "hi"')).toBe('"She said ""hi"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(["IIT Bombay", "Bengaluru"])).toBe("IIT Bombay; Bengaluru");
  });

  it("defuses anything a spreadsheet would run as a formula", () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(
      '"\'=HYPERLINK(""http://evil"",""x"")"',
    );
    expect(csvCell("+1 555")).toBe("'+1 555");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell(42)).toBe("42");
  });

  it("writes a UTF-8 file Excel opens correctly", () => {
    const csv = toCsv(["Name", "City"], [["José", "São Paulo"]]);
    expect(csv.startsWith("﻿Name,City\r\n")).toBe(true);
    expect(csv.endsWith("José,São Paulo\r\n")).toBe(true);
  });
});
