import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FolderSearch,
  GraduationCap,
  HelpCircle,
  Layers,
  LayoutGrid,
  Palette,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { usePlanner, activePlan } from "../store/usePlanner.ts";
import { useAcademic } from "../lib/useAcademic.ts";
import { weekInfo } from "../lib/academic.ts";

export default function HomeView() {
  const plan = usePlanner(activePlan);
  const ac = useAcademic();
  const [activeStep, setActiveStep] = useState(0);

  const weekNo = ac.semester ? weekInfo(ac.semester, ac.today, ac.state).week : null;

  const goTo = (view: string, tab?: string) => {
    location.hash = `#/${view}`;
    if (tab) {
      window.dispatchEvent(new CustomEvent("jadualku:tab", { detail: tab }));
    }
  };

  const steps = [
    {
      step: "01",
      title: "Masukkan Kursus & Kumpulan",
      desc: "Pilih salah satu daripada 4 cara mudah untuk masukkan jadual kuliah anda:",
      bullets: [
        {
          tag: "Paling Digemari",
          tagCls: "bg-accent/15 text-accent",
          name: "Cari Kod Kumpulan",
          text: "Taip kod seperti RCS2404A, CS1102A, atau BA243. Semua subjek kumpulan tersebut akan dimasukkan serta-merta!",
        },
        {
          tag: "Rasmi iCress",
          tagCls: "bg-blue-500/15 text-blue-400",
          name: "Teroka Kampus & Fakulti",
          text: "Pilih kampus anda (Shah Alam, Puncak Alam, Machang, Samarahan dll.) dan pilih subjek satu per satu.",
        },
        {
          tag: "UiTM Link",
          tagCls: "bg-purple-500/15 text-purple-400",
          name: "Import No Matrik",
          text: "Masukkan no pelajar anda untuk tarik subjek yang telah anda daftarkan dalam sistem UiTM secara automatik.",
        },
        {
          tag: "Fleksibel",
          tagCls: "bg-emerald-500/15 text-emerald-400",
          name: "Slot Manual",
          text: "Tambah aktiviti peribadi seperti solat Jumaat, sesi persatuan, sukan, kerja sambilan atau tuisyen.",
        },
      ],
      action: { label: "Cuba Tambah Subjek", onClick: () => goTo("timetable", "group") },
    },
    {
      step: "02",
      title: "Kesan & Selesaikan Pertembungan (Clash)",
      desc: "Jangan risau tentang waktu kuliah yang berlanggar. JadualKu menyemak setiap saat untuk anda:",
      bullets: [
        {
          tag: "Automatik",
          tagCls: "bg-red-500/15 text-red-400",
          name: "Amaran Pertembungan Pintar",
          text: "Jika dua kelas jatuh pada waktu yang sama, amaran merah dan blok berjalur akan dipaparkan dengan jelas.",
        },
        {
          tag: "Pantas",
          tagCls: "bg-accent/15 text-accent",
          name: "Tukar Kumpulan 1-Klik",
          text: "Klik pada mana-tana subjek bertindih untuk melihat kumpulan lain dan tukar waktu dengan serta-merta.",
        },
        {
          tag: "Auto-Planner",
          tagCls: "bg-amber-500/15 text-amber-400",
          name: "Penjana Jadual Tanpa Clash",
          text: "Kumpul senarai subjek anda dalam 'Basket', dan tekan Generate untuk jana semua kombinasi jadual bebas pertembungan!",
        },
      ],
      action: { label: "Buka Auto-Planner", onClick: () => goTo("timetable", "planner") },
    },
    {
      step: "03",
      title: "Hias Tema & Gambar Wallpaper Sendiri",
      desc: "Jadikan jadual anda cantik dan aesthetic mengikut cita rasa unik anda:",
      bullets: [
        {
          tag: "Preset",
          tagCls: "bg-accent/15 text-accent",
          name: "Pilihan Tema Warna Menarik",
          text: "Pilih daripada pelbagai tema siap bina: UiTM Ungu/Emas, Midnight Dark, Paper Minimalis, Matcha Strawberry, Sunset, dan Pastel.",
        },
        {
          tag: "Kustom",
          tagCls: "bg-pink-500/15 text-pink-400",
          name: "Muat Naik Gambar Wallpaper Sendiri",
          text: "Gunakan gambar anime kegemaran, kucing, pemandangan, atau aesthetic wallpaper anda sebagai latar belakang jadual.",
        },
        {
          tag: "Live Preview",
          tagCls: "bg-emerald-500/15 text-emerald-400",
          name: "Paparan Langsung Real-Time",
          text: "Laraskan kelegapan panel kaca (frosted glass), kabur (blur), dan saiz teks sambil melihat perubahan secara langsung di sebelah!",
        },
      ],
      action: {
        label: "Kustomisasi Reka Bentuk",
        onClick: () => {
          goTo("timetable");
          window.dispatchEvent(new CustomEvent("jadualku:design"));
        },
      },
    },
    {
      step: "04",
      title: "Eksport ke Telefon Pintar & Kalendar",
      desc: "Bawa jadual anda ke mana sahaja tanpa perlu buka aplikasi setiap kali:",
      bullets: [
        {
          tag: "Wallpaper",
          tagCls: "bg-purple-500/15 text-purple-400",
          name: "Wallpaper Skrin Kunci Telefon (Lockscreen)",
          text: "Dilaraskan mengikut model iPhone & Android dengan zon selamat supaya jadual tidak terlindung di sebalik jam telefon.",
        },
        {
          tag: "Imej & PDF",
          tagCls: "bg-blue-500/15 text-blue-400",
          name: "Muat Turun PNG HD & PDF",
          text: "Sesuai untuk dicetak atau dikongsi dalam group WhatsApp kelas dan Telegram bersama rakan.",
        },
        {
          tag: "Kalendar",
          tagCls: "bg-amber-500/15 text-amber-400",
          name: "Segerak ke Google / Apple Calendar",
          text: "Eksport fail .ics untuk dimasukkan terus ke Google Calendar atau Apple Calendar dengan pengulangan setiap minggu.",
        },
      ],
      action: { label: "Pergi ke Halaman Eksport", onClick: () => goTo("export") },
    },
  ];

  const faqs = [
    {
      q: "Bagaimana cara memuat naik gambar latar belakang (wallpaper)?",
      a: "Klik butang 'Customize' (ikon palet) di bahagian atas kanan. Di bahagian 'Background', pilih tab 'Image' dan muat naik gambar dari peranti anda. Anda boleh laraskan zoom, kedudukan fokus, kekaburan (blur), dan kelegapan panel kaca.",
    },
    {
      q: "Adakah data dan gambar saya disimpan ke mana-mana pelayan luar?",
      a: "Tidak sama sekali! JadualKu beroperasi 100% pada peranti anda (offline-first & client-side). Semua jadual, tema, dan gambar disimpan terus dalam memori pelayar anda (localStorage). Tiada data peribadi anda yang dihantar ke luar.",
    },
    {
      q: "Bolehkah saya membuat lebih daripada 1 jadual (contoh: Plan A & Plan B)?",
      a: "Boleh! Klik menu nama jadual di atas (contoh: 'My Timetable') dan pilih 'New plan' atau 'Duplicate'. Anda boleh bina seberapa banyak variasi jadual yang anda mahu untuk persediaan pendaftaran kursus (add/drop).",
    },
    {
      q: "Kenapa sesetengah kod kumpulan tiada dalam sistem?",
      a: "Data diambil terus secara langsung daripada pelayan iCress UiTM. Sekiranya fakulti belum memuat naik jadual bagi sesi terkini atau kod kumpulan baharu, anda boleh memasukkan subjek tersebut menggunakan ciri 'Manual'.",
    },
    {
      q: "Bolehkah saya gunakan JadualKu pada telefon pintar (iPhone / Android)?",
      a: "Ya! JadualKu dioptimumkan sepenuhnya untuk telefon pintar dengan paparan Agenda yang kemas, sokongan sentuhan, dan ciri eksport wallpaper skrin kunci telefon khas.",
    },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-bg text-ink">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-line bg-panel/40 px-4 py-12 sm:px-6 lg:py-16">
        <div className="absolute inset-0 pointer-events-none opacity-20 [background:radial-gradient(circle_at_50%_0%,var(--accent)_0%,transparent_60%)]" />

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-soft shadow-sm">
            <span className="flex size-2 rounded-full bg-good animate-pulse" />
            <span>UiTM Sesi {ac.semester?.session ?? "20264"}</span>
            {weekNo ? <span>· Minggu ke-{weekNo}</span> : null}
          </div>

          {/* Main Title */}
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-ink">
            Penjana &amp; Perancang <br className="hidden sm:inline" />
            <span className="text-accent">Jadual Waktu UiTM</span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-soft sm:text-base">
            Susun jadual kuliah UiTM tanpa pening kepala. Cari kod kumpulan dengan pantas, elak waktu bertindih (clash),
            hias tema mengikut citarasa estetik anda, dan simpan sebagai wallpaper skrin kunci telefon pintar.
          </p>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => goTo("timetable")}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-on-accent shadow-md shadow-accent/20 transition-all hover:brightness-110 active:scale-95"
            >
              <LayoutGrid className="size-4" />
              <span>Bina Jadual Sekarang</span>
              <ArrowRight className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                document.getElementById("guide-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-5 py-3 text-sm font-bold text-soft transition-colors hover:bg-raised hover:text-ink"
            >
              <BookOpen className="size-4" />
              <span>Panduan Pengguna</span>
            </button>
          </div>

          {/* Plan status indicator */}
          {plan.entries.length > 0 && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-good/40 bg-good/10 px-3 py-1.5 text-xs font-semibold text-good">
              <CheckCircle2 className="size-4" />
              <span>Anda mempunyai {plan.entries.length} kursus aktif dalam jadual ({plan.name}).</span>
              <button
                type="button"
                onClick={() => goTo("timetable")}
                className="underline hover:text-ink font-bold ml-1"
              >
                Lihat Jadual →
              </button>
            </div>
          )}

          {/* Quick Shortcuts Grid */}
          <div className="mt-10 grid grid-cols-2 gap-2.5 sm:grid-cols-4 text-left">
            <button
              type="button"
              onClick={() => goTo("timetable", "group")}
              className="group flex flex-col gap-1 rounded-xl border border-line bg-panel p-3.5 transition-all hover:border-accent hover:bg-raised"
            >
              <div className="flex items-center justify-between text-accent">
                <FolderSearch className="size-5" />
                <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="text-xs font-bold text-ink">Cari Kod Kumpulan</div>
              <div className="text-[11px] text-faint">RCS2404A, BA243, dll.</div>
            </button>

            <button
              type="button"
              onClick={() => goTo("timetable", "matric")}
              className="group flex flex-col gap-1 rounded-xl border border-line bg-panel p-3.5 transition-all hover:border-accent hover:bg-raised"
            >
              <div className="flex items-center justify-between text-accent">
                <GraduationCap className="size-5" />
                <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="text-xs font-bold text-ink">Import No Matrik</div>
              <div className="text-[11px] text-faint">Tarik jadual pelajar rasmi</div>
            </button>

            <button
              type="button"
              onClick={() => goTo("timetable", "planner")}
              className="group flex flex-col gap-1 rounded-xl border border-line bg-panel p-3.5 transition-all hover:border-accent hover:bg-raised"
            >
              <div className="flex items-center justify-between text-accent">
                <Wand2 className="size-5" />
                <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="text-xs font-bold text-ink">Auto-Planner</div>
              <div className="text-[11px] text-faint">Jana jadual tanpa clash</div>
            </button>

            <button
              type="button"
              onClick={() => goTo("calendar")}
              className="group flex flex-col gap-1 rounded-xl border border-line bg-panel p-3.5 transition-all hover:border-accent hover:bg-raised"
            >
              <div className="flex items-center justify-between text-accent">
                <CalendarRange className="size-5" />
                <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="text-xs font-bold text-ink">Kalendar Akademik</div>
              <div className="text-[11px] text-faint">Minggu kuliah &amp; cuti</div>
            </button>
          </div>
        </div>
      </section>

      {/* Feature Badges Bar */}
      <section className="border-b border-line bg-panel/70 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-around gap-4 text-xs font-semibold text-soft">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-accent" />
            <span>Pantas &amp; Terus dari iCress</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-good" />
            <span>100% Privasi, Tiada Akaun Diperlukan</span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="size-4 text-accent" />
            <span>Wallpaper Khas iPhone &amp; Android</span>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-amber-400" />
            <span>Kalis Luar Talian (Offline-Ready)</span>
          </div>
        </div>
      </section>

      {/* Interactive Step-by-Step Guide */}
      <section id="guide-section" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-ink">
            Panduan Lengkap: Cara Guna JadualKu
          </h2>
          <p className="mt-2 text-sm text-soft">
            Ikuti 4 langkah mudah ini untuk membina dan menyesuaikan jadual waktu kuliah impian anda.
          </p>
        </div>

        {/* Step selector tabs */}
        <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((s, idx) => (
            <button
              key={s.step}
              type="button"
              onClick={() => setActiveStep(idx)}
              className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-all ${
                activeStep === idx
                  ? "border-accent bg-accent/10 shadow-sm"
                  : "border-line bg-panel text-soft hover:bg-raised"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold ${activeStep === idx ? "text-accent" : "text-faint"}`}>
                  Langkah {s.step}
                </span>
                {activeStep === idx && <span className="size-1.5 rounded-full bg-accent" />}
              </div>
              <span className={`text-xs font-bold truncate ${activeStep === idx ? "text-ink" : "text-soft"}`}>
                {s.title}
              </span>
            </button>
          ))}
        </div>

        {/* Active Step Card */}
        <div className="mt-4 rounded-2xl border border-line bg-panel p-5 sm:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <span className="inline-block text-xs font-extrabold uppercase tracking-wider text-accent">
                Langkah {steps[activeStep].step}
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-ink mt-0.5">
                {steps[activeStep].title}
              </h3>
              <p className="text-xs sm:text-sm text-soft mt-1">
                {steps[activeStep].desc}
              </p>
            </div>
            <button
              type="button"
              onClick={steps[activeStep].action.onClick}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-on-accent transition-transform hover:scale-102 active:scale-98"
            >
              <span>{steps[activeStep].action.label}</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {steps[activeStep].bullets.map((b) => (
              <div key={b.name} className="flex flex-col gap-1 rounded-xl border border-line bg-paper/50 p-3.5">
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${b.tagCls}`}>
                    {b.tag}
                  </span>
                  <span className="text-xs font-bold text-ink">{b.name}</span>
                </div>
                <p className="text-xs leading-relaxed text-soft mt-1">{b.text}</p>
              </div>
            ))}
          </div>

          {/* Navigation between steps */}
          <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-xs font-semibold">
            <button
              type="button"
              disabled={activeStep === 0}
              onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
              className="rounded-lg border border-line px-3 py-1.5 text-soft hover:bg-raised disabled:opacity-30"
            >
              ← Langkah Sebelumnya
            </button>
            <span className="text-faint">{activeStep + 1} daripada {steps.length}</span>
            <button
              type="button"
              disabled={activeStep === steps.length - 1}
              onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))}
              className="rounded-lg border border-line px-3 py-1.5 text-soft hover:bg-raised disabled:opacity-30"
            >
              Langkah Seterusnya →
            </button>
          </div>
        </div>
      </section>

      {/* Key Highlights Grid */}
      <section className="border-t border-line bg-panel/30 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-ink">
              Ciri-Ciri Hebat JadualKu
            </h2>
            <p className="mt-2 text-sm text-soft">
              Segala alat yang diperlukan oleh mahasiswa UiTM untuk perancangan semester yang sempurna.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col rounded-2xl border border-line bg-panel p-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Palette className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-ink">Kustomisasi Tanpa Had</h3>
              <p className="mt-1 text-xs leading-relaxed text-soft">
                Pilih palet warnaUiTM atau pastel, tukar jenis fon (Jakarta, Inter, JetBrains Mono dll.), dan muat naik
                gambar wallpaper anda sendiri dengan paparan langsung secara langsung.
              </p>
            </div>

            <div className="flex flex-col rounded-2xl border border-line bg-panel p-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
                <CalendarDays className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-ink">Paparan Hari Ini (Today View)</h3>
              <p className="mt-1 text-xs leading-relaxed text-soft">
                Lihat jadual kelas hari ini, masa yang tinggal, lokasi bilik kuliah, makmal, serta makluman cuti umum
                mengikut negeri kampus anda.
              </p>
            </div>

            <div className="flex flex-col rounded-2xl border border-line bg-panel p-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <Phone className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-ink">Eksport Lockscreen Telefon</h3>
              <p className="mt-1 text-xs leading-relaxed text-soft">
                Hasilkan gambar wallpaper skrin kunci telefon dengan kedudukan safe-zone yang tidak menutup jam dan
                widget iOS/Android anda.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-ink">
            Soalan Lazim (FAQ)
          </h2>
          <p className="mt-2 text-sm text-soft">
            Ada soalan mengenai JadualKu? Berikut adalah jawapan untuk persoalan yang sering ditanya.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <div key={f.q} className="rounded-xl border border-line bg-panel p-4 text-left">
              <h4 className="text-xs sm:text-sm font-bold text-ink flex items-center gap-2">
                <HelpCircle className="size-4 shrink-0 text-accent" />
                <span>{f.q}</span>
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-soft pl-6">
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="border-t border-line bg-panel/80 px-4 py-12 text-center sm:px-6">
        <div className="mx-auto max-w-2xl">
          <Sparkles className="mx-auto size-8 text-accent mb-3" />
          <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">
            Sedia untuk Menyusun Jadual Kuliah Anda?
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-soft">
            Mulakan sekarang secara percuma tanpa pendaftaran. Jimat masa dan rancang semester UiTM anda dengan lebih bijak!
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => goTo("timetable")}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-on-accent shadow-lg shadow-accent/20 transition-all hover:brightness-110 active:scale-95"
            >
              <span>Bina Jadual Saya Sekarang 🚀</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
