/**
 * The shared recognizer, with a pretend browser recognizer: one is made and
 * reused, an old round is cut off before a new one starts, and `fresh`
 * really makes a new one.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fake = {
  started: number;
  running: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onend: (() => void) | null;
  onresult: ((e: unknown) => void) | null;
};
let made: Fake[] = [];

class FakeRecognition {
  started = 0;
  running = false;
  onend: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  constructor() {
    made.push(this as unknown as Fake);
  }
  start() {
    if (this.running) throw new Error("InvalidStateError");
    this.running = true;
    this.started++;
  }
  stop() {
    this.end();
  }
  abort() {
    this.end();
  }
  end() {
    if (!this.running) return;
    this.running = false;
    queueMicrotask(() => this.onend?.());
  }
}

const handlers = () => ({ result: vi.fn(), error: vi.fn(), end: vi.fn() });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  made = [];
  vi.resetModules();
  (globalThis as unknown as { window: unknown }).window = { webkitSpeechRecognition: FakeRecognition };
});

describe("speech engine", () => {
  it("reuses one recognizer for every tap (iPhone only listens with the first)", async () => {
    const { listen } = await import("./speech-engine");
    const a = listen(handlers())!;
    a.stop();
    await flush();
    listen(handlers());
    expect(made).toHaveLength(1);
    expect(made[0].started).toBe(2);
  });

  it("cuts off a round still running, then starts the new one when it lets go", async () => {
    const { listen } = await import("./speech-engine");
    const first = handlers();
    listen(first);
    const second = handlers();
    const r2 = listen(second)!;
    expect(r2.isCurrent()).toBe(true);
    await flush();
    expect(made).toHaveLength(1);
    expect(made[0].started).toBe(2);
    expect(made[0].running).toBe(true);
    // The old round's end isn't sent to anyone (its screen moved on).
    expect(first.end).not.toHaveBeenCalled();
    expect(second.end).not.toHaveBeenCalled();
  });

  it("only the current round hears words", async () => {
    const { listen } = await import("./speech-engine");
    const h = handlers();
    listen(h);
    made[0].onresult?.({ resultIndex: 0, results: [[{ transcript: "hi" }]] });
    expect(h.result).toHaveBeenCalledTimes(1);
  });

  it("fresh makes a brand-new recognizer and ignores the old one", async () => {
    const { listen } = await import("./speech-engine");
    const old = handlers();
    listen(old);
    const h = handlers();
    listen(h, { fresh: true });
    await flush();
    expect(made).toHaveLength(2);
    expect(made[0].running).toBe(false);
    expect(made[1].running).toBe(true);
    expect(old.end).not.toHaveBeenCalled();
  });

  it("a recognizer that never lets go is replaced", async () => {
    vi.useFakeTimers();
    const { listen } = await import("./speech-engine");
    listen(handlers());
    made[0].abort = () => {}; // stuck: never ends
    listen(handlers());
    vi.advanceTimersByTime(700);
    expect(made).toHaveLength(2);
    expect(made[1].running).toBe(true);
    vi.useRealTimers();
  });

  it("short mode: a new recognizer every round, one phrase at a time", async () => {
    const { listen } = await import("./speech-engine");
    const a = listen(handlers(), { mode: "short" })!;
    a.stop();
    await flush();
    listen(handlers(), { mode: "short" });
    expect(made).toHaveLength(2);
    expect((made[1] as unknown as { continuous: boolean }).continuous).toBe(false);
    expect(made[1].running).toBe(true);
  });

  it("switching from long to short mid-tap drops the long one", async () => {
    const { listen } = await import("./speech-engine");
    listen(handlers());
    listen(handlers(), { mode: "short", fresh: true });
    expect(made).toHaveLength(2);
    expect(made[0].running).toBe(false);
    expect((made[1] as unknown as { continuous: boolean }).continuous).toBe(false);
  });

  it("the mic log records what happened", async () => {
    const { listen, micTapped, micLog } = await import("./speech-engine");
    micTapped("long");
    const r = listen(handlers())!;
    made[0].onresult?.({ resultIndex: 0, results: [[{ transcript: "hi" }]] });
    r.stop();
    await flush();
    expect(micLog()).toMatch(/words .*end/);
  });
});
