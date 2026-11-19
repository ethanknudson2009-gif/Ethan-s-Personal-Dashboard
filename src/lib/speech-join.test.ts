import { describe, expect, it } from "vitest";
import { joinHeard, joinPieces } from "./speech-join";

describe("stitching speech pieces", () => {
  it("joins pieces with a sentence break at each pause", () => {
    expect(joinPieces(["call Mike tomorrow", "buy milk", "english essay due Friday"])).toBe("call Mike tomorrow. buy milk. english essay due Friday");
  });
  it("keeps punctuation the recognizer already added", () => {
    expect(joinPieces(["Call Mike tomorrow.", "Buy milk,", "then eggs"])).toBe("Call Mike tomorrow. Buy milk, then eggs");
  });
  it("Safari re-sending everything so far is not repeated", () => {
    expect(joinPieces(["call Mike", "call Mike tomorrow about the loan", "call Mike tomorrow about the loan and buy milk"])).toBe(
      "call Mike tomorrow about the loan and buy milk",
    );
  });
  it("a piece that overlaps the end of the last one is merged", () => {
    expect(joinHeard("I need to call Mike tomorrow", "Mike tomorrow about the Johnson file", true)).toBe("I need to call Mike tomorrow about the Johnson file");
  });
  it("a repeated piece is dropped", () => {
    expect(joinHeard("buy milk and eggs and bread", "and eggs and bread", true)).toBe("buy milk and eggs and bread");
  });
  it("case and punctuation differences don't count as new words", () => {
    expect(joinHeard("Call mike tomorrow", "call Mike tomorrow, buy milk", true)).toBe("call Mike tomorrow, buy milk");
  });
  it("empty pieces are ignored", () => {
    expect(joinPieces(["", "buy milk", "  "])).toBe("buy milk");
  });
  it("a 40-second talk in 8 pieces with Safari repeats", () => {
    const pieces = [
      "okay so tomorrow",
      "okay so tomorrow I have a lot going on",
      "in the morning I need to drop off my car",
      "drop off my car at the shop",
      "then at work call Mike about the Henderson refi",
      "he wants the bank statements",
      "he wants the bank statements and the W2s",
      "and don't let me forget to pay my phone bill",
    ];
    expect(joinPieces(pieces)).toBe(
      "okay so tomorrow I have a lot going on. in the morning I need to drop off my car at the shop. then at work call Mike about the Henderson refi. he wants the bank statements and the W2s. and don't let me forget to pay my phone bill",
    );
  });
});
