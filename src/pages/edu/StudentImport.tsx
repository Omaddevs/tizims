/**
 * Talabalarni Excel/CSV'dan ommaviy yuklash: fayl → server tekshiruvi (quruq) → ko'rib chiqish → saqlash.
 * Tekshiruv va saqlash serverda; saqlashda server hamma qatorni qayta tekshiradi.
 */
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import { Btn, Modal, Pill, ScopeNote, Table, Tabs, Td } from "../../components/kit";
import { api, errorText } from "../../lib/api";
import { cn } from "../../lib/utils";
import { IMPORT_TEMPLATE, detectColumns, readSpreadsheet, type ImportField } from "../../lib/sheet";
import { downloadCsv } from "../EducationDashboard";

type CheckedRow = {
  row: number;
  status: "ok" | "error" | "duplicate";
  errors: string[];
  warnings: string[];
  data: { name: string; group: string; funding: string; phone: string; parent: string };
};
type Summary = { total: number; ok: number; errors: number; duplicates: number; created?: number };

const FIELD_LABEL: Record<ImportField, string> = { name: "F.I.Sh.", group: "Guruh", funding: "Ta'lim shakli", phone: "Telefon", parent: "Ota-ona" };

export function StudentImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (created: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"pick" | "review" | "done">("pick");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<{ header: boolean; fields: ImportField[] }>({ header: false, fields: [] });
  const [checked, setChecked] = useState<CheckedRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<"all" | "ok" | "problems">("all");

  function reset() {
    setStep("pick");
    setFileName("");
    setError(null);
    setInput([]);
    setChecked([]);
    setSummary(null);
    setFilter("all");
    if (fileRef.current) fileRef.current.value = "";
  }

  function close() {
    reset();
    onClose();
  }

  async function onFile(file: File) {
    setError(null);
    setBusy(true);
    setFileName(file.name);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Fayl 5 MB dan katta.");
      const rows = await readSpreadsheet(file);
      if (rows.length === 0) throw new Error("Faylda ma'lumot topilmadi.");
      const det = detectColumns(rows);
      const body = det.header ? rows.slice(1) : rows;
      const firstRow = det.header ? 2 : 1;
      const prepared = body.map((r, i) => {
        const o: Record<string, unknown> = { row: firstRow + i };
        for (const [f, idx] of Object.entries(det.map)) if (idx !== undefined) o[f] = r[idx] ?? "";
        return o;
      });
      setMapping({ header: det.header, fields: Object.keys(det.map) as ImportField[] });
      setInput(prepared);
      const res = await api<{ summary: Summary; rows: CheckedRow[] }>("/edu/students/import", { body: { rows: prepared, dryRun: true } });
      setChecked(res.rows);
      setSummary(res.summary);
      setStep("review");
    } catch (e) {
      setError(errorText(e));
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ summary: Summary }>("/edu/students/import", { body: { rows: input, dryRun: false } });
      setSummary(res.summary);
      setStep("done");
      onDone(res.summary.created ?? 0);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function downloadProblems() {
    downloadCsv(`import-xatolar-${new Date().toISOString().slice(0, 10)}`, [
      ["Qator", "F.I.Sh.", "Guruh", "Ta'lim shakli", "Telefon", "Ota-ona", "Muammo"],
      ...checked.filter((r) => r.status !== "ok").map((r) => [r.row, r.data.name, r.data.group, r.data.funding, r.data.phone, r.data.parent, r.errors.join("; ")]),
    ]);
  }

  const shown = checked.filter((r) => filter === "all" || (filter === "ok" ? r.status === "ok" : r.status !== "ok")).slice(0, 300);
  const withWarnings = checked.filter((r) => r.status === "ok" && r.warnings.length).length;

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="Talabalarni Excel'dan yuklash"
      footer={
        step === "pick" ? (
          <Btn onClick={close}>Yopish</Btn>
        ) : step === "review" ? (
          <>
            <Btn onClick={reset} disabled={busy}>
              Boshqa fayl
            </Btn>
            {summary && summary.errors + summary.duplicates > 0 && (
              <Btn onClick={downloadProblems}>
                <Download className="h-4 w-4" /> Xatolar ro'yxati
              </Btn>
            )}
            <Btn variant="primary" disabled={busy || !summary?.ok} onClick={commit}>
              {busy ? "Saqlanmoqda..." : `${summary?.ok ?? 0} ta talabani saqlash`}
            </Btn>
          </>
        ) : (
          <>
            <Btn onClick={reset}>Yana yuklash</Btn>
            <Btn variant="primary" onClick={close}>
              Tayyor
            </Btn>
          </>
        )
      }
    >
      {/* Bosqichlar */}
      <div className="flex items-center gap-2 text-xs">
        {(["Fayl", "Tekshirish", "Natija"] as const).map((l, i) => {
          const idx = step === "pick" ? 0 : step === "review" ? 1 : 2;
          return (
            <span key={l} className="flex items-center gap-2">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold", i <= idx ? "bg-ts-inv text-ts-invfg" : "bg-ts-chip text-ts-muted")}>{i + 1}</span>
              <span className={i <= idx ? "font-medium" : "text-ts-muted"}>{l}</span>
              {i < 2 && <span className="mx-1 h-px w-8 bg-ts-line" />}
            </span>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {step === "pick" && (
        <>
          <label
            className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-ts-line2 p-10 text-center transition hover:bg-ts-hover", busy && "pointer-events-none opacity-60")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void onFile(f);
            }}
          >
            {busy ? <FileSpreadsheet className="h-8 w-8 animate-pulse text-ts-sub" /> : <Upload className="h-8 w-8 text-ts-sub" />}
            <span className="text-sm font-medium">{busy ? `${fileName} tekshirilmoqda...` : "Faylni shu yerga tashlang yoki tanlang"}</span>
            <span className="text-xs text-ts-sub">Excel (.xlsx) yoki CSV · 5000 qatorgacha · 5 MB gacha</span>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-ts-tile p-3 text-sm">
            <div>
              <div className="font-medium">Ustunlar</div>
              <div className="text-xs text-ts-sub">F.I.Sh. va Guruh — majburiy · Ta'lim shakli (Grant/Kontrakt), Telefon, Ota-ona — ixtiyoriy. Birinchi qator — sarlavha.</div>
            </div>
            <Btn size="sm" onClick={() => downloadCsv("talabalar-shablon", IMPORT_TEMPLATE)}>
              <Download className="h-3.5 w-3.5" /> Shablonni yuklab olish
            </Btn>
          </div>
        </>
      )}

      {step === "review" && summary && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile label="Jami qator" value={summary.total} />
            <SummaryTile label="Saqlanadi" value={summary.ok} tone="green" />
            <SummaryTile label="Xato" value={summary.errors} tone={summary.errors ? "red" : undefined} />
            <SummaryTile label="Takror" value={summary.duplicates} tone={summary.duplicates ? "amber" : undefined} />
          </div>
          <div className="text-xs text-ts-sub">
            {fileName} · {mapping.header ? `Aniqlangan ustunlar: ${mapping.fields.map((f) => FIELD_LABEL[f]).join(", ")}` : "Sarlavha topilmadi — ustunlar tartibi: F.I.Sh., Guruh, Ta'lim shakli, Telefon, Ota-ona"}
            {withWarnings > 0 && ` · ${withWarnings} qatorda ogohlantirish`}
          </div>
          {summary.errors + summary.duplicates > 0 && (
            <ScopeNote>Xato va takroriy qatorlar saqlanmaydi. Ularni tuzatib, faqat shu qatorlarni qayta yuklashingiz mumkin — "Xatolar ro'yxati" faylini yuklab oling.</ScopeNote>
          )}
          <Tabs
            value={filter}
            onChange={setFilter}
            tabs={[
              { key: "all", label: "Hammasi", count: checked.length },
              { key: "ok", label: "To'g'ri", count: summary.ok },
              { key: "problems", label: "Muammoli", count: summary.errors + summary.duplicates },
            ]}
          />
          <div className="max-h-[42vh] overflow-auto rounded-md border border-ts-line">
            <Table head={["Qator", "F.I.Sh.", "Guruh", "Shakl", "Telefon", "Holat"]} minWidth={760}>
              {shown.map((r) => (
                <tr key={r.row} className={r.status !== "ok" ? "bg-red-500/[0.03]" : undefined}>
                  <Td className="text-ts-muted">{r.row}</Td>
                  <Td className="font-medium">{r.data.name || <span className="text-ts-muted">—</span>}</Td>
                  <Td>{r.data.group || "—"}</Td>
                  <Td className="text-ts-sub">{r.data.funding}</Td>
                  <Td className="whitespace-nowrap text-ts-sub">{r.data.phone}</Td>
                  <Td className="max-w-[260px]">
                    {r.status === "ok" ? (
                      <span className="flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        {r.warnings.length ? <span className="text-amber-600">{r.warnings.join("; ")}</span> : "To'g'ri"}
                      </span>
                    ) : (
                      <span className="flex items-start gap-1.5 text-xs">
                        {r.status === "duplicate" ? <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500" /> : <XCircle className="mt-px h-3.5 w-3.5 shrink-0 text-red-500" />}
                        <span className={r.status === "duplicate" ? "text-amber-700 dark:text-amber-300" : "text-red-600 dark:text-red-400"}>{r.errors.join("; ")}</span>
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          </div>
          {checked.length > 300 && <div className="text-xs text-ts-muted">Birinchi 300 qator ko'rsatildi — saqlashda hammasi hisobga olinadi.</div>}
        </>
      )}

      {step === "done" && summary && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <div className="text-lg font-semibold">{summary.created} ta talaba qo'shildi</div>
          <div className="text-sm text-ts-sub">
            {summary.total - (summary.created ?? 0) > 0 ? `${summary.total - (summary.created ?? 0)} ta qator o'tkazib yuborildi. ` : ""}Amal audit logga yozildi.
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-1.5">
            <Pill tone="green">Talaba kartalari yaratildi</Pill>
            <Pill>Talaba/ota-ona akkauntlari — "Foydalanuvchilar"da</Pill>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: "green" | "red" | "amber" }) {
  return (
    <div className="rounded-md border border-ts-line p-3">
      <div className="text-xs text-ts-sub">{label}</div>
      <div className={cn("mt-0.5 text-xl font-semibold tabular-nums", tone === "green" && "text-emerald-600 dark:text-emerald-400", tone === "red" && "text-red-600 dark:text-red-400", tone === "amber" && "text-amber-600")}>{value}</div>
    </div>
  );
}
