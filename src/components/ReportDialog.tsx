import { useEffect, useState } from "react";
import { AlertCircle, Bug, Check, CheckCircle2, Clock, Copy, Loader2, Send, X } from "lucide-react";
import { submitReport } from "../lib/api.ts";
import { usePlanner } from "../store/usePlanner.ts";

const CATEGORIES = [
  "Timetable or clash issue",
  "Campus or course missing",
  "Matric import failed",
  "Display or styling glitch",
  "Feature request or feedback",
  "Other issue",
] as const;

const COOLDOWN_KEY = "jadualku:last_report_ts";
const COOLDOWN_SECONDS = 60;

function getStoredCooldownRemaining(): number {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    if (!raw) return 0;
    const past = Number(raw);
    if (isNaN(past)) return 0;
    const diffSec = Math.ceil((COOLDOWN_SECONDS * 1000 - (Date.now() - past)) / 1000);
    return diffSec > 0 ? diffSec : 0;
  } catch {
    return 0;
  }
}

export function ReportButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Report an issue"
      title="Report an issue"
      className={`rounded-lg border border-line bg-panel p-2 text-soft transition-colors hover:bg-raised hover:text-accent ${className}`}
    >
      <Bug className="size-4" />
    </button>
  );
}

export default function ReportDialog({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(getStoredCooldownRemaining);
  const [showFallback, setShowFallback] = useState(false);
  const [copied, setCopied] = useState(false);

  const { lastCampus, lastFaculty, plans, activePlanId } = usePlanner();
  const currentPlan = plans.find((p) => p.id === activePlanId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      const remaining = getStoredCooldownRemaining();
      setCooldown(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const generateDiagnostics = () => ({
    url: window.location.href,
    campus: lastCampus || "None",
    faculty: lastFaculty || "None",
    classCount: currentPlan?.entries.length ?? 0,
    screen: `${window.innerWidth}x${window.innerHeight} (dpr: ${window.devicePixelRatio})`,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0 || loading) return;

    if (description.trim().length < 5) {
      setError("Please write at least 5 characters to describe the issue.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await submitReport({
        category,
        summary: summary.trim() || undefined,
        description: description.trim(),
        diagnostics: includeDiagnostics ? generateDiagnostics() : undefined,
        honeypot: honeypot.trim() || undefined,
      });

      try {
        localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      } catch {
        /* storage may be disabled */
      }
      setCooldown(COOLDOWN_SECONDS);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateReportFallbackBody = () => {
    let text = `[JadualUiTMKu Issue Report]\n\n`;
    text += `Category: ${category}\n`;
    if (summary.trim()) text += `Summary: ${summary.trim()}\n`;
    text += `\n--- Description ---\n${description.trim() || "(No description provided)"}\n\n`;

    if (includeDiagnostics) {
      text += `--- Diagnostics ---\n`;
      text += JSON.stringify(generateDiagnostics(), null, 2);
    }
    return text;
  };

  const fallbackBody = generateReportFallbackBody();

  const handleCopyFallback = async () => {
    try {
      await navigator.clipboard.writeText(fallbackBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="anim-fade fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-label="Report an issue"
      onClick={onClose}
    >
      <div
        className="anim-sheet flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-panel shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <Bug className="size-4 text-warn" />
            <h2 className="text-sm font-bold text-ink">Report an Issue</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-xs text-soft">
          {submitted ? (
            <div className="flex flex-col items-center py-6 text-center space-y-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-accent/15 text-accent">
                <CheckCircle2 className="size-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink">Report Sent Directly!</h3>
                <p className="max-w-sm text-xs leading-relaxed text-soft">
                  Thank you for helping improve JadualUiTMKu. Your report has been delivered directly to the developer.
                </p>
              </div>

              {cooldown > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-line bg-raised px-3 py-1 text-[11px] font-medium text-faint">
                  <Clock className="size-3 text-accent" />
                  Anti-spam cooldown: wait {cooldown}s before submitting another report.
                </div>
              )}

              <div className="flex w-full flex-col gap-2 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setDescription("");
                    setSummary("");
                    setError(null);
                  }}
                  disabled={cooldown > 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5 font-semibold text-ink transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send another report
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-bold text-on-accent transition-opacity hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-[13px] leading-relaxed">
                Found a schedule discrepancy, missing course, or bug? Submit details below — it sends directly to developer email without needing to open your email client.
              </p>

              {/* Bot Honeypot (hidden from real users) */}
              <input
                type="text"
                name="hp_website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                aria-hidden="true"
                autoComplete="off"
                className="hidden"
              />

              {/* Category */}
              <div className="space-y-1.5">
                <label htmlFor="issue-category" className="block text-[11px] font-bold tracking-wide uppercase text-faint">
                  Issue Type
                </label>
                <select
                  id="issue-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink outline-none transition focus:border-accent"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject / Summary */}
              <div className="space-y-1.5">
                <label htmlFor="issue-summary" className="block text-[11px] font-bold tracking-wide uppercase text-faint">
                  Summary / Course Code <span className="font-normal lowercase text-faint">(optional)</span>
                </label>
                <input
                  id="issue-summary"
                  type="text"
                  placeholder="e.g. CSC128 group RCS1101A is missing"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  maxLength={150}
                  className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint outline-none transition focus:border-accent"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="issue-desc" className="block text-[11px] font-bold tracking-wide uppercase text-faint">
                    What went wrong? <span className="text-warn">*</span>
                  </label>
                  <span className={`text-[10px] ${description.length < 5 ? "text-faint" : "text-accent"}`}>
                    {description.length}/3000
                  </span>
                </div>
                <textarea
                  id="issue-desc"
                  rows={4}
                  required
                  placeholder="Describe what happened, what was expected, or any error message you saw..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={3000}
                  className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint outline-none transition focus:border-accent"
                />
              </div>

              {/* Diagnostics Checkbox */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-bg/50 p-2.5">
                <input
                  type="checkbox"
                  checked={includeDiagnostics}
                  onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                  className="mt-0.5 size-4 rounded accent-accent"
                />
                <div className="text-[11px]">
                  <span className="font-semibold text-ink">Include technical diagnostics</span>
                  <p className="text-faint">
                    Attaches current campus, timetable count, device screen size, and browser user agent to pinpoint the problem.
                  </p>
                </div>
              </label>

              {/* Error message */}
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold">{error}</p>
                    <button
                      type="button"
                      onClick={() => setShowFallback(true)}
                      className="text-[11px] underline underline-offset-2 hover:opacity-80"
                    >
                      Need fallback? Send via email app or copy instead
                    </button>
                  </div>
                </div>
              )}

              {/* Cooldown notice if active */}
              {cooldown > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-line bg-raised/60 p-2.5 text-[11px] text-soft">
                  <Clock className="size-4 shrink-0 text-accent" />
                  <span>
                    Anti-spam cooldown active: please wait{" "}
                    <strong className="text-ink font-semibold">{cooldown}s</strong> before submitting again.
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading || cooldown > 0 || description.trim().length < 5}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Sending Report...
                    </>
                  ) : cooldown > 0 ? (
                    <>
                      <Clock className="size-4" /> Wait {cooldown}s (Cooldown)
                    </>
                  ) : (
                    <>
                      <Send className="size-4" /> Send Report Directly
                    </>
                  )}
                </button>
                <p className="mt-1.5 text-center text-[10px] text-faint">
                  Submits directly to developer · 60s cooldown prevents spam
                </p>
              </div>

              {/* Fallback copy */}
              <div className="pt-1 text-center">
                {!showFallback ? (
                  <button
                    type="button"
                    onClick={() => setShowFallback(true)}
                    className="text-[11px] text-faint hover:text-soft underline underline-offset-2"
                  >
                    Alternative: copy issue details to clipboard
                  </button>
                ) : (
                  <div className="space-y-2 rounded-xl border border-line bg-raised/30 p-3 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-ink">Copy Details</span>
                      <button
                        type="button"
                        onClick={() => setShowFallback(false)}
                        className="text-[10px] text-faint hover:text-soft"
                      >
                        Hide
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyFallback}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-panel py-2 text-xs font-semibold text-soft transition-colors hover:bg-raised hover:text-ink"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3.5 text-accent" /> Copied details to clipboard!
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" /> Copy details to clipboard
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
