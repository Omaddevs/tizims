import { useState } from "react";
import { Ban, Download, FileArchive, Gauge, KeyRound, Trash2 } from "lucide-react";
import { Btn, Card, CardHead, FieldLabel, Modal, Page, Pill, Progress, QueryState, ScopeNote, Stat, Table, Tabs, Td, TextInput, fmtDate, useToast, type Tone } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import type { DataRequest } from "../../data/platform";
import { useTenants } from "./Tenants";

const DR_STATUS: Record<DataRequest["status"], { label: string; tone: Tone }> = {
  awaiting_owner: { label: "Ega tasdig'i kutilmoqda", tone: "amber" },
  processing: { label: "Tayyorlanmoqda", tone: "blue" },
  ready: { label: "Yuklab olishga tayyor", tone: "green" },
  done: { label: "Bajarildi", tone: "gray" },
  rejected: { label: "Rad etildi", tone: "red" },
};

type Limit = { slug: string; perMinute: number; used24h: number; keys: number; blocked: number };

export function DataApiPage() {
  const [toast, showToast] = useToast();
  const [tenants] = useTenants();
  const lq = useApi<Limit[]>("/platform/api-limits");
  const rq = useApi<DataRequest[]>("/platform/data-requests");
  const limits: Record<string, Limit> = Object.fromEntries((lq.data ?? []).map((l) => [l.slug, l]));
  const requests = rq.data ?? [];
  const [tab, setTab] = useState<"api" | "data">("api");
  const [editing, setEditing] = useState<string | null>(null);
  const name = (slug: string) => tenants.find((t) => t.slug === slug)?.name ?? slug;

  const blocked = Object.values(limits).reduce((a, l) => a + l.blocked, 0);
  const calls = Object.values(limits).reduce((a, l) => a + l.used24h, 0);

  async function patchReq(id: string, p: Pick<DataRequest, "status">, msg: string) {
    try {
      const next = await api<DataRequest>(`/platform/data-requests/${id}`, { method: "PATCH", body: p });
      rq.setData(requests.map((r) => (r.id === id ? next : r)));
      showToast(msg);
    } catch (e) {
      showToast(errorText(e));
    }
  }

  return (
    <Page title="API va ma'lumotlar" subtitle="Tashkilotlarning API limitlari va ma'lumotlarni eksport qilish yoki o'chirish so'rovlari">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="API so'rovlar (24 soat)" value={calls.toLocaleString("ru-RU")} icon={Gauge} />
        <Stat label="Limitdan oshgani uchun bloklangan" value={blocked} tone="amber" icon={Ban} />
        <Stat label="Faol API kalitlar" value={Object.values(limits).reduce((a, l) => a + l.keys, 0)} icon={KeyRound} />
        <Stat label="Ochiq ma'lumot so'rovlari" value={requests.filter((r) => r.status !== "done" && r.status !== "rejected").length} icon={FileArchive} />
      </div>

      {(lq.error || rq.error) && <QueryState error={lq.error ?? rq.error} loading={false} onRetry={() => { void lq.reload(); void rq.reload(); }}>{null}</QueryState>}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "api", label: "API limitlar" },
          { key: "data", label: "Ma'lumot so'rovlari", count: requests.length },
        ]}
      />

      {tab === "api" && (
        <Card className="overflow-hidden">
          <CardHead title="Limitlar" desc="Daqiqasiga ruxsat etilgan so'rovlar — ortig'i 429 bilan bloklanadi" className="pb-4" />
          <Table head={["Tashkilot", "Limit / daqiqa", "Yuklama (cho'qqi)", "24 soatda", "Bloklangan", "Kalitlar", ""]} minWidth={900}>
            {tenants.map((t) => {
              const l = limits[t.slug] ?? { slug: t.slug, perMinute: 0, used24h: 0, keys: 0, blocked: 0 };
              const peak = l.perMinute ? Math.min(100, Math.round((l.used24h / 1440 / l.perMinute) * 100 * 6)) : 0;
              return (
                <tr key={t.id}>
                  <Td className="font-medium">{t.name}</Td>
                  <Td className="tabular-nums">{l.perMinute ? l.perMinute.toLocaleString("ru-RU") : <Pill tone="red">O'chirilgan</Pill>}</Td>
                  <Td className="w-40">
                    <div className="flex items-center gap-2">
                      <Progress value={peak} tone={peak > 80 ? "red" : peak > 50 ? "amber" : "green"} />
                      <span className="w-9 text-xs tabular-nums text-ts-sub">{peak}%</span>
                    </div>
                  </Td>
                  <Td className="tabular-nums">{l.used24h.toLocaleString("ru-RU")}</Td>
                  <Td className={l.blocked ? "tabular-nums text-amber-600 dark:text-amber-400" : "tabular-nums text-ts-muted"}>{l.blocked}</Td>
                  <Td className="tabular-nums">{l.keys}</Td>
                  <Td className="text-right">
                    <Btn size="sm" onClick={() => setEditing(t.slug)}>
                      O'zgartirish
                    </Btn>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}

      {tab === "data" && (
        <>
          <ScopeNote>
            Eksport yoki o'chirish faqat <b>tashkilot egasi</b> so'rovi va tasdig'i bilan bajariladi. Super admin jarayonni boshqaradi, lekin fayl ichini ko'rmaydi: arxiv shifrlangan holda to'g'ridan-to'g'ri egaga yuboriladi.
            O'chirish qaytarib bo'lmaydi va 30 kunlik kutish muddatidan so'ng bajariladi.
          </ScopeNote>
          <Card className="overflow-hidden">
            <Table head={["ID", "Tashkilot", "Turi", "Sabab", "So'ragan", "Sana", "Holat", ""]} minWidth={1040}>
              {requests.map((r) => (
                <tr key={r.id}>
                  <Td className="text-ts-sub">{r.id}</Td>
                  <Td className="font-medium">{name(r.tenant)}</Td>
                  <Td>
                    {r.kind === "export" ? (
                      <Pill tone="blue">
                        <Download className="h-3 w-3" /> Eksport
                      </Pill>
                    ) : (
                      <Pill tone="red">
                        <Trash2 className="h-3 w-3" /> O'chirish
                      </Pill>
                    )}
                  </Td>
                  <Td className="max-w-[240px] truncate text-ts-sub">{r.reason}</Td>
                  <Td className="text-ts-sub">{r.requestedBy}</Td>
                  <Td className="whitespace-nowrap text-ts-sub">{fmtDate(r.requestedAt)}</Td>
                  <Td>
                    <Pill tone={DR_STATUS[r.status].tone} dot>
                      {DR_STATUS[r.status].label}
                    </Pill>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {r.status === "processing" && (
                      <Btn size="sm" onClick={() => patchReq(r.id, { status: "ready" }, "Arxiv tayyor · havola egaga yuborildi")}>
                        Tayyor deb belgilash
                      </Btn>
                    )}
                    {r.status === "ready" && (
                      <Btn size="sm" onClick={() => patchReq(r.id, { status: "done" }, "Yopildi")}>
                        Yopish
                      </Btn>
                    )}
                    {r.status === "awaiting_owner" && <span className="text-xs text-ts-muted">Ega o'z panelida tasdiqlaydi</span>}
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      )}

      {editing && (
        <LimitModal
          tenant={name(editing)}
          value={limits[editing]?.perMinute ?? 120}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            try {
              const next = await api<Limit>(`/platform/api-limits/${editing}`, { method: "PATCH", body: { perMinute: v } });
              lq.setData([...(lq.data ?? []).filter((l) => l.slug !== editing), next]);
              setEditing(null);
              showToast(v ? `Limit: ${v} so'rov/daqiqa` : "API kirish o'chirildi");
            } catch (e) {
              showToast(errorText(e));
            }
          }}
        />
      )}
      {toast}
    </Page>
  );
}

function LimitModal({ tenant, value, onClose, onSave }: { tenant: string; value: number; onClose: () => void; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  const n = Math.max(0, Math.min(10_000, Number(v) || 0));
  return (
    <Modal
      open
      onClose={onClose}
      title={`API limiti · ${tenant}`}
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn variant="primary" onClick={() => onSave(n)}>
            Saqlash
          </Btn>
        </>
      }
    >
      <FieldLabel label="So'rovlar / daqiqa (0 — API o'chiriladi)">
        <TextInput type="number" min={0} max={10000} value={v} onChange={(e) => setV(e.target.value)} />
      </FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {[120, 300, 600, 1200].map((p) => (
          <Btn key={p} size="sm" onClick={() => setV(String(p))}>
            {p}
          </Btn>
        ))}
      </div>
      <div className="text-xs text-ts-sub">Tavsiya: Starter 120 · Business 300 · Enterprise 1200</div>
    </Modal>
  );
}
