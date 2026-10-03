import { useState } from "react";
import { Check, Copy, ExternalLink, Link2, Share2, X } from "lucide-react";

interface ShareLinkModalProps {
  url: string;
  planName: string;
  onClose: () => void;
}

export default function ShareLinkModal({ url, planName, onClose }: ShareLinkModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your share link:", url);
    }
  };

  const messageText = `Here is my UiTM timetable (${planName}):\n${url}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`My UiTM timetable (${planName})`)}`;

  const handleSystemShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: `JadualKu — ${planName}`,
          text: `View my UiTM timetable (${planName}):`,
          url,
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error(e);
        }
      }
    }
  };

  const canSystemShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div
      className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-label="Share timetable link"
      onClick={onClose}
    >
      <div
        className="anim-sheet relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Share2 className="size-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-ink">Share timetable</h3>
              <p className="max-w-[240px] truncate text-xs text-faint">{planName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-[11px] font-bold tracking-wide text-faint uppercase">
              Short share link
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-line bg-raised/50 p-1.5 focus-within:border-accent">
              <Link2 className="ml-2 size-4 shrink-0 text-faint" />
              <input
                type="text"
                readOnly
                value={url}
                className="w-full select-all bg-transparent px-1 font-mono text-xs text-ink outline-none"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                onClick={handleCopy}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-on-accent transition-colors hover:bg-accent/90"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div className={`grid ${canSystemShare ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20"
            >
              <span>WhatsApp</span>
              <ExternalLink className="size-3" />
            </a>
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-2.5 py-2 text-xs font-bold text-sky-400 transition-colors hover:bg-sky-500/20"
            >
              <span>Telegram</span>
              <ExternalLink className="size-3" />
            </a>
            {canSystemShare && (
              <button
                type="button"
                onClick={handleSystemShare}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-raised px-2.5 py-2 text-xs font-semibold text-soft transition-colors hover:bg-raised/80 hover:text-ink"
              >
                <Share2 className="size-3" />
                <span>More</span>
              </button>
            )}
          </div>

          <p className="text-center text-[11px] text-faint">
            Friends who open this link can preview your timetable, import it, or compare schedules to find free slots.
          </p>
        </div>
      </div>
    </div>
  );
}
