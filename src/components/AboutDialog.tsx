import { useEffect, useState } from "react";
import { Bug, Coffee, ExternalLink, Info, ShieldAlert, X } from "lucide-react";
import { CREATOR, DISCLAIMER_LONG, DISCLAIMER_SHORT, GITHUB_URL } from "../data/links.ts";

const ACK_KEY = "jadualku:disclaimer-ack";

function GithubMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export function FooterLinks({
  className = "",
  onReport,
  onSupport,
}: {
  className?: string;
  onReport?: () => void;
  onSupport?: () => void;
}) {
  const link = "inline-flex items-center gap-1 font-semibold text-soft underline-offset-2 transition-colors hover:text-accent hover:underline";
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      {onReport && (
        <button type="button" onClick={onReport} className={link}>
          <Bug className="size-3.5 text-warn" /> Report issue
        </button>
      )}
      {onSupport && (
        <button type="button" onClick={onSupport} className={link}>
          <Coffee className="size-3.5 text-accent" /> Belanja Kopi
        </button>
      )}
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={link}>
        <GithubMark className="size-3.5" /> GitHub
      </a>
    </span>
  );
}

/** Slim desktop footer shown under every view. */
export function AppFooter({
  onAbout,
  onReport,
  onSupport,
}: {
  onAbout: () => void;
  onReport?: () => void;
  onSupport?: () => void;
}) {
  return (
    <footer className="hidden shrink-0 items-center gap-x-4 border-t border-line bg-panel px-4 py-1.5 text-[11px] text-faint lg:flex print:hidden">
      <span className="truncate">{DISCLAIMER_SHORT}</span>
      <button type="button" onClick={onAbout} className="shrink-0 font-semibold text-soft underline-offset-2 hover:text-accent hover:underline">
        Read more
      </button>
      <span className="ml-auto flex shrink-0 items-center gap-4">
        <span>
          Created by <b className="text-soft">{CREATOR}</b>
        </span>
        <FooterLinks onReport={onReport} onSupport={onSupport} />
      </span>
    </footer>
  );
}

/** First-visit banner (remembered once dismissed). */
export function DisclaimerBanner({ onAbout }: { onAbout: () => void }) {
  const [show, setShow] = useState(() => localStorage.getItem(ACK_KEY) !== "1");
  if (!show) return null;
  return (
    <div className="anim-fade flex items-start gap-2 border-b border-warn/30 bg-warn/10 px-3 py-2 text-xs text-soft print:hidden" role="note">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" />
      <p className="min-w-0 flex-1">
        <b className="text-ink">Unofficial student project.</b> Not affiliated with UiTM. Class data can be wrong or out of date, so always check iCress.{" "}
        <button type="button" onClick={onAbout} className="font-semibold text-accent underline underline-offset-2">
          Details
        </button>
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(ACK_KEY, "1");
          setShow(false);
        }}
        className="shrink-0 rounded-md px-2 py-0.5 font-semibold text-soft hover:bg-raised"
      >
        Got it
      </button>
    </div>
  );
}

export function AboutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="About and disclaimer"
      title="About and disclaimer"
      className="rounded-lg border border-line bg-panel p-2 text-soft hover:bg-raised"
    >
      <Info className="size-4" />
    </button>
  );
}

export default function AboutDialog({
  onClose,
  onReport,
  onSupport,
}: {
  onClose: () => void;
  onReport?: () => void;
  onSupport?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="anim-fade fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal aria-label="About JadualUiTMKu" onClick={onClose}>
      <div className="anim-sheet flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-panel shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-bold">About JadualUiTMKu</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-raised" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm text-soft">
          <p>
            A timetable planner for UiTM students. Created by <b className="text-ink">{CREATOR}</b>.
          </p>
          <div className="rounded-xl border border-warn/30 bg-warn/10 p-3">
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide text-warn uppercase">
              <ShieldAlert className="size-4" /> Disclaimer
            </h3>
            <div className="space-y-2 text-[13px] leading-relaxed">
              {DISCLAIMER_LONG.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {onReport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReport();
                }}
                className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 font-semibold text-ink transition-colors hover:border-accent hover:bg-raised"
              >
                <span className="flex items-center gap-2">
                  <Bug className="size-4 text-warn" /> Report issue
                </span>
              </button>
            )}
            {onSupport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSupport();
                }}
                className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 font-semibold text-ink transition-colors hover:border-accent hover:bg-raised"
              >
                <span className="flex items-center gap-2">
                  <Coffee className="size-4 text-accent" /> Belanja Kopi
                </span>
                <span className="text-[11px] font-bold text-[#ea1a65]">QR</span>
              </button>
            )}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 font-semibold text-ink transition-colors hover:border-accent hover:bg-raised"
            >
              <span className="flex items-center gap-2">
                <GithubMark /> GitHub
              </span>
              <ExternalLink className="size-3.5 text-faint" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
