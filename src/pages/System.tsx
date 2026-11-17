import { useEffect, useState } from "react";
import { useApp } from "../store/AppContext";
import { Card, Page, Pill, SearchBox, Table, Td } from "../components/kit";

export function AuditPage() {
  const { audit, reloadAudit } = useApp();
  const [q, setQ] = useState("");
  useEffect(() => {
    reloadAudit();
  }, [reloadAudit]);
  const list = audit.filter((a) => `${a.user} ${a.action} ${a.object} ${a.objectId} ${a.newValue ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page title="Audit log" subtitle="Tashkilotdagi barcha muhim o'zgarishlar — kim, qachon, nimani o'zgartirdi" actions={<SearchBox value={q} onChange={setQ} placeholder="Qidirish..." className="w-64" />}>
      <Card className="overflow-hidden">
        <Table head={["Vaqt", "Foydalanuvchi", "Harakat", "Obyekt", "O'zgarish", "IP"]} minWidth={900}>
          {list.map((a) => (
            <tr key={a.id}>
              <Td className="whitespace-nowrap text-ts-sub">{a.date}</Td>
              <Td className="font-medium">{a.user}</Td>
              <Td>
                <Pill tone={a.action === "DELETE" ? "red" : a.action === "CREATE" ? "green" : a.action.startsWith("LOG") ? "gray" : "blue"}>{a.action}</Pill>
              </Td>
              <Td className="text-ts-sub">
                {a.object} <span className="text-ts-muted">{a.objectId}</span>
              </Td>
              <Td className="max-w-[320px] text-xs">
                {a.oldValue && <span className="text-ts-muted line-through">{a.oldValue}</span>} {a.newValue}
              </Td>
              <Td className="text-ts-sub">{a.ip}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </Page>
  );
}
