import { Coffee, Download, QrCode } from "lucide-react";
import { Modal } from "./ui.tsx";

export function SupportButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Buy me a coffee (Support)"
      title="Buy me a coffee (DuitNow QR)"
      className={`rounded-lg border border-line bg-panel p-2 text-soft transition-colors hover:border-accent/40 hover:bg-raised hover:text-accent ${className}`}
    >
      <Coffee className="size-4 text-accent" />
    </button>
  );
}

export default function SupportDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Support & Tip (Buy Me a Coffee)" onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        {/* Intro */}
        <div className="mb-4 flex flex-col items-center gap-1.5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-inner">
            <Coffee className="size-6" />
          </div>
          <h3 className="text-base font-bold text-ink">Buy the Dev a Coffee!</h3>
          <p className="max-w-xs text-xs text-soft leading-relaxed">
            JadualUiTMKu is free &amp; ad-free for all UiTM students. If this helped you plan your timetable clash-free, consider tipping RM1–RM5 or helping with server costs!
          </p>
        </div>

        {/* QR Code Container */}
        <div className="relative mb-3 w-full max-w-[280px] rounded-2xl border border-line bg-white p-4 shadow-xl">
          <div className="mb-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-wider text-[#ea1a65] uppercase">
            <QrCode className="size-4" /> DuitNow QR
          </div>
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100">
            <img
              src="/duitnow-qr.jpg"
              alt="DuitNow QR code for JadualUiTMKu"
              className="size-full object-contain"
            />
          </div>
          <p className="mt-2 text-[10px] font-medium text-neutral-500">
            Malaysia National QR Standard
          </p>
        </div>

        {/* Supported Apps Badges */}
        <div className="mb-4 flex flex-wrap justify-center gap-1.5 text-[10px] font-medium text-soft">
          <span className="rounded-md border border-line bg-raised px-2 py-0.5">Touch 'n Go eWallet</span>
          <span className="rounded-md border border-line bg-raised px-2 py-0.5">MAE (Maybank)</span>
          <span className="rounded-md border border-line bg-raised px-2 py-0.5">CIMB Octo</span>
          <span className="rounded-md border border-line bg-raised px-2 py-0.5">Bank Islam</span>
          <span className="rounded-md border border-line bg-raised px-2 py-0.5">All Banks</span>
        </div>

        {/* Action Button & Tip */}
        <div className="w-full space-y-2">
          <a
            href="/duitnow-qr.jpg"
            download="duitnow-qr-jadualku.jpg"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            <Download className="size-4" /> Download QR Image
          </a>
          <p className="text-[11px] text-faint">
            On mobile? Save the image and use <strong className="font-semibold text-soft">“Scan from Gallery”</strong> in Touch 'n Go or your banking app.
          </p>
        </div>
      </div>
    </Modal>
  );
}
