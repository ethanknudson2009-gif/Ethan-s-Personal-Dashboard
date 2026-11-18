"use client";

/**
 * Upload a syllabus (PDF or photo) for a class. The file goes to your
 * private storage folder; for PDFs, the text is pulled out on this device
 * so Claude can read it through the connector and send the assignments
 * to your Inbox.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { extractPdfText } from "@/lib/pdf-text";
import { cx } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

type Step = "idle" | "uploading" | "reading" | "saving";
const LABEL: Record<Step, string> = { idle: "", uploading: "Uploading…", reading: "Reading the PDF…", saving: "Saving…" };
const MAX_BYTES = 10 * 1024 * 1024;

export function SyllabusUpload({ classId, className }: { classId: string; className: string }) {
  const sheet = useTaskSheet();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("idle");

  async function upload(file: File) {
    if (file.size > MAX_BYTES) return sheet.toast("That file is over 10 MB");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return sheet.toast("Please sign in again");

    try {
      setStep("uploading");
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const ext = isPdf ? "pdf" : (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("user-files")
        .upload(path, file, { contentType: isPdf ? "application/pdf" : file.type || "image/jpeg" });
      if (upErr) throw new Error(upErr.message);

      let text = "";
      if (isPdf) {
        setStep("reading");
        try {
          text = await extractPdfText(file);
        } catch {
          text = ""; // unreadable PDF: Claude can read it directly instead
        }
      }

      setStep("saving");
      const { error } = await supabase.from("files").insert({
        storage_path: path,
        filename: file.name.slice(0, 200),
        mime_type: isPdf ? "application/pdf" : file.type || "image/jpeg",
        size_bytes: file.size,
        class_id: classId,
        kind: "syllabus",
        extracted_text: text || null,
        status: text ? "text_ready" : "needs_claude",
      });
      if (error) throw new Error(error.message);
      sheet.toast(text ? `Uploaded ✓ Now ask Claude: “import my ${className} syllabus”` : "Uploaded ✓ (a scan: attach it in Claude to read it)");
      router.refresh();
    } catch (e) {
      sheet.toast(`Upload failed: ${(e as Error).message}`);
    } finally {
      setStep("idle");
      if (input.current) input.current.value = "";
    }
  }

  const busy = step !== "idle";
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className={cx(
          "flex items-center gap-1.5 rounded-xl border border-electric/40 bg-electric/10 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-electric/20 active:scale-95",
          busy && "animate-pulse",
        )}
      >
        📄 {busy ? LABEL[step] : "Upload syllabus"}
      </button>
    </>
  );
}
