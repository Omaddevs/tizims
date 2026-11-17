/** E'lonlar va bloglar — rahbariyat/nazoratchi yozadi, talaba o'z auditoriyasiga tegishlilarini o'qiydi */
import { useState } from "react";
import { Heart, Megaphone, Newspaper, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { Btn, Card, Empty, FieldLabel, Modal, Page, Pill, QueryState, SearchBox, SelectBox, TextArea, TextInput, useToast } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { GROUPS } from "../../data/academic";
import { useScope } from "./scope";

type Post = {
  id: string;
  kind: "news" | "blog";
  title: string;
  body: string;
  audience: "all" | "students" | "staff";
  groups: string[];
  pinned: boolean;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
  likes: number;
  likedByMe: boolean;
  canEdit: boolean;
};

const AUDIENCE: Record<Post["audience"], string> = { all: "Hammaga", students: "Talabalarga", staff: "Xodimlarga" };

export function NewsPage() {
  return <PostsPage kind="news" />;
}

export function BlogPage() {
  return <PostsPage kind="blog" />;
}

function PostsPage({ kind }: { kind: "news" | "blog" }) {
  const s = useScope(kind);
  const [toast, showToast] = useToast();
  const q = useApi<Post[]>(`/edu/posts?kind=${kind}`);
  const posts = q.data ?? [];
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Post | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const list = posts.filter((p) => `${p.title} ${p.body}`.toLowerCase().includes(query.toLowerCase()));
  const Icon = kind === "news" ? Megaphone : Newspaper;

  async function like(p: Post) {
    try {
      const next = await api<Post>(`/edu/posts/${p.id}/like`, { method: "POST" });
      q.setData(posts.map((x) => (x.id === p.id ? next : x)));
    } catch (e) {
      showToast(errorText(e));
    }
  }

  async function remove(p: Post) {
    if (!window.confirm(`"${p.title}" o'chirilsinmi?`)) return;
    try {
      await api(`/edu/posts/${p.id}`, { method: "DELETE" });
      q.setData(posts.filter((x) => x.id !== p.id));
      showToast("O'chirildi");
    } catch (e) {
      showToast(errorText(e));
    }
  }

  return (
    <Page
      title={s.title}
      subtitle={s.description}
      actions={
        <>
          <SearchBox value={query} onChange={setQuery} placeholder="Qidirish..." className="w-56" />
          {s.isManage && (
            <Btn variant="primary" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> {kind === "news" ? "E'lon yozish" : "Maqola yozish"}
            </Btn>
          )}
        </>
      }
    >
      <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
        {list.length === 0 ? (
          <Card>
            <Empty text={kind === "news" ? "Hozircha e'lon yo'q" : "Hozircha maqola yo'q"} icon={Icon} />
          </Card>
        ) : (
          <div className={cn("grid gap-4", kind === "blog" && "lg:grid-cols-2")}>
            {list.map((p) => {
              const expanded = open === p.id || p.body.length <= 280;
              return (
                <Card key={p.id} className={cn("flex flex-col", p.pinned && "border-amber-500/40")}>
                  <div className="flex items-start gap-3 p-4 pb-2">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", kind === "news" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-violet-500/10 text-violet-600 dark:text-violet-400")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {p.pinned && (
                          <Pill tone="amber">
                            <Pin className="h-3 w-3" /> Muhim
                          </Pill>
                        )}
                        <h3 className="text-base font-semibold leading-snug">{p.title}</h3>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ts-sub">
                        <span>{p.authorName}</span>
                        <span>·</span>
                        <span>{p.createdAt}</span>
                        {p.canEdit && (
                          <>
                            <span>·</span>
                            <span>{AUDIENCE[p.audience]}</span>
                            {p.groups.length > 0 && <span>({p.groups.join(", ")})</span>}
                          </>
                        )}
                      </div>
                    </div>
                    {p.canEdit && (
                      <div className="flex shrink-0 gap-1">
                        <Btn size="sm" variant="ghost" title="Tahrirlash" onClick={() => setEditing(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Btn>
                        <Btn size="sm" variant="ghost" title="O'chirish" onClick={() => void remove(p)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Btn>
                      </div>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap px-4 pb-3 pl-16 text-sm leading-relaxed text-ts-fg">
                    {expanded ? p.body : `${p.body.slice(0, 280)}…`}
                    {!expanded && (
                      <button type="button" onClick={() => setOpen(p.id)} className="ml-1 font-medium text-ts-blue hover:underline">
                        Davomini o'qish
                      </button>
                    )}
                  </div>
                  {kind === "blog" && (
                    <div className="mt-auto flex items-center gap-2 border-t border-ts-line px-4 py-2.5 pl-16">
                      <button
                        type="button"
                        onClick={() => void like(p)}
                        className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition hover:bg-ts-hover", p.likedByMe ? "text-red-500" : "text-ts-sub")}
                      >
                        <Heart className={cn("h-4 w-4", p.likedByMe && "fill-current")} /> {p.likes}
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </QueryState>

      {editing && (
        <PostEditor
          kind={kind}
          post={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(p, isNew) => {
            q.setData(isNew ? [p, ...posts] : posts.map((x) => (x.id === p.id ? p : x)));
            setEditing(null);
            showToast(isNew ? "E'lon qilindi" : "Saqlandi");
          }}
        />
      )}
      {toast}
    </Page>
  );
}

function PostEditor({ kind, post, onClose, onSaved }: { kind: "news" | "blog"; post: Post | null; onClose: () => void; onSaved: (p: Post, isNew: boolean) => void }) {
  const [f, setF] = useState({ title: post?.title ?? "", body: post?.body ?? "", audience: post?.audience ?? ("all" as Post["audience"]), groups: post?.groups ?? [], pinned: post?.pinned ?? false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = f.title.trim().length >= 4 && f.body.trim().length >= 10;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...f, kind, title: f.title.trim(), body: f.body.trim(), groups: f.audience === "staff" ? [] : f.groups };
      const p = post ? await api<Post>(`/edu/posts/${post.id}`, { method: "PATCH", body: payload }) : await api<Post>("/edu/posts", { body: payload });
      onSaved(p, !post);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={post ? "Tahrirlash" : kind === "news" ? "Yangi e'lon" : "Yangi maqola"}
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn variant="primary" disabled={!ok || saving} onClick={save}>
            {saving ? "Saqlanmoqda..." : post ? "Saqlash" : "E'lon qilish"}
          </Btn>
        </>
      }
    >
      <FieldLabel label="Sarlavha">
        <TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </FieldLabel>
      <FieldLabel label="Matn">
        <TextArea rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      </FieldLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="Kimga">
          <SelectBox value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as Post["audience"] })}>
            {(Object.keys(AUDIENCE) as Post["audience"][]).map((k) => (
              <option key={k} value={k}>
                {AUDIENCE[k]}
              </option>
            ))}
          </SelectBox>
        </FieldLabel>
        <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} className="h-4 w-4" />
          Muhim — ro'yxat boshida turadi
        </label>
      </div>
      {f.audience !== "staff" && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-ts-sub">Guruhlar (tanlanmasa — barcha talabalarga)</div>
          <div className="flex flex-wrap gap-1.5">
            {GROUPS.map((g) => {
              const on = f.groups.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setF({ ...f, groups: on ? f.groups.filter((x) => x !== g.id) : [...f.groups, g.id] })}
                  className={on ? "rounded-md bg-ts-inv px-2.5 py-1 text-xs font-medium text-ts-invfg" : "rounded-md border border-ts-line2 px-2.5 py-1 text-xs text-ts-sub hover:bg-ts-hover"}
                >
                  {g.id}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
    </Modal>
  );
}
