import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Download, Link2, Pencil, Plus, Share2, Trash2, Upload, X } from "lucide-react";
import { activePlan, usePlanner } from "../store/usePlanner.ts";
import { decodeBackup, encodeBackup, encodePlan, type Backup } from "../lib/share.ts";
import { shortenUrl } from "../lib/api.ts";
import ShareLinkModal from "./ShareLinkModal.tsx";

function uid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function shareUrlFor(payload: string): string {
  return `${location.origin}${location.pathname}?s=${payload}`;
}

export default function PlansMenu() {
  const plans = usePlanner((s) => s.plans);
  const activeId = usePlanner((s) => s.activePlanId);
  const theme = usePlanner((s) => s.theme);
  const { setActivePlan, createPlan, duplicatePlan, renamePlan, deletePlan, replaceAll } = usePlanner();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareModalUrl, setShareModalUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [importError, setImportError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = usePlanner(activePlan);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const shareLink = async (openModal: boolean) => {
    if (!current || sharing) return;
    setSharing(true);
    try {
      const longUrl = shareUrlFor(await encodePlan(current, theme));
      const url = await shortenUrl(longUrl);

      if (openModal) {
        setShareModalUrl(url);
        setOpen(false);
        return;
      }

      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const fallbackUrl = shareUrlFor(await encodePlan(current, theme));
      window.prompt("Copy your share link:", fallbackUrl);
    } finally {
      setSharing(false);
    }
  };

  const exportAll = () => {
    const s = usePlanner.getState();
    const json = encodeBackup({ plans: s.plans, sharedPlans: s.sharedPlans, theme: s.theme, savedThemes: s.savedThemes });
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "jadualku-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setOpen(false);
  };

  const onFile = async (file: File | undefined) => {
    setImportError("");
    if (!file) return;
    try {
      setPending(decodeBackup(await file.text(), uid));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Not a valid JadualKu backup");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const menuBtn = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-raised";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-semibold hover:bg-raised"
      >
        <span className="max-w-20 truncate sm:max-w-36">{current?.name ?? "Plans"}</span>
        <ChevronDown className="size-4 text-faint" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-64 overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
          <div className="max-h-64 overflow-y-auto py-1">
            {plans.map((p) => (
              <div key={p.id} className="group flex items-center gap-1 px-2">
                {renaming === p.id ? (
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renamePlan(p.id, name);
                        setRenaming(null);
                      }
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    onBlur={() => {
                      renamePlan(p.id, name);
                      setRenaming(null);
                    }}
                    className="w-full rounded-md border border-line bg-raised px-2 py-1 text-sm outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActivePlan(p.id);
                      setOpen(false);
                    }}
                    className="flex flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-raised"
                  >
                    <span className="truncate">
                      {p.name}
                      {p.source === "friend" && (
                        <span className="ml-1 rounded-full bg-accent/15 px-1.5 py-px text-[9px] font-bold text-accent">Friend</span>
                      )}
                    </span>
                    {p.id === activeId && <Check className="size-4 text-accent" />}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 border-t border-line p-2">
            <button
              type="button"
              onClick={() => {
                createPlan();
                setOpen(false);
              }}
              className={menuBtn}
            >
              <Plus className="size-4" /> New
            </button>
            <button
              type="button"
              onClick={() => {
                duplicatePlan(activeId);
                setOpen(false);
              }}
              className={menuBtn}
            >
              <Copy className="size-4" /> Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(activeId);
                setName(current?.name ?? "");
              }}
              className={menuBtn}
            >
              <Pencil className="size-4" /> Rename
            </button>
            <button
              type="button"
              onClick={() => {
                if (plans.length > 1 || current?.entries.length === 0 || window.confirm(`Delete "${current?.name}"?`)) {
                  deletePlan(activeId);
                  setOpen(false);
                }
              }}
              className={`${menuBtn} text-bad hover:bg-bad/10`}
            >
              <Trash2 className="size-4" /> Delete
            </button>
          </div>
          <div className="border-t border-line p-2">
            <button
              type="button"
              disabled={sharing}
              onClick={() => void shareLink(true)}
              className={`${menuBtn} disabled:opacity-50`}
            >
              <Share2 className="size-4 text-faint" /> {sharing ? "Shortening…" : "Share…"}
            </button>
            <button
              type="button"
              disabled={sharing}
              onClick={() => void shareLink(false)}
              className={`${menuBtn} disabled:opacity-50`}
            >
              {copied ? (
                <>
                  <Check className="size-4 text-good" /> <span className="font-semibold text-good">Short link copied!</span>
                </>
              ) : (
                <>
                  <Link2 className={`size-4 text-faint ${sharing ? "animate-pulse" : ""}`} />{" "}
                  {sharing ? "Shortening link…" : "Copy share link"}
                </>
              )}
            </button>
          </div>
          <div className="border-t border-line p-2">
            <button type="button" onClick={exportAll} className={menuBtn}>
              <Download className="size-4 text-faint" /> Export all data (.json)
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className={menuBtn}>
              <Upload className="size-4 text-faint" /> Import backup
            </button>
            {importError && <p className="px-2 py-1 text-xs text-bad">{importError}</p>}
          </div>
        </div>
      )}
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />

      {pending && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Import backup">
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute top-1/2 left-1/2 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-panel p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Import backup</h3>
              <button type="button" onClick={() => setPending(null)} className="rounded-md p-1 text-faint hover:bg-raised">
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-soft">
              {pending.plans.length} plan{pending.plans.length === 1 ? "" : "s"}
              {pending.sharedPlans?.length ? `, ${pending.sharedPlans.length} shared` : ""}
              {pending.savedThemes?.length ? `, ${pending.savedThemes.length} saved themes` : ""}.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  replaceAll(pending, true);
                  setPending(null);
                  setOpen(false);
                }}
                className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-soft hover:bg-raised"
              >
                Merge
              </button>
              <button
                type="button"
                onClick={() => {
                  replaceAll(pending, false);
                  setPending(null);
                  setOpen(false);
                }}
                className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-on-accent"
              >
                Replace all
              </button>
            </div>
          </div>
        </div>
      )}

      {shareModalUrl && current && (
        <ShareLinkModal
          url={shareModalUrl}
          planName={current.name}
          onClose={() => setShareModalUrl(null)}
        />
      )}
    </div>
  );
}
