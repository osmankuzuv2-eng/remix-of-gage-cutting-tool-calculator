import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Hash, Loader2, MessageSquare, GripVertical } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
  "#f97316", "#06b6d4", "#84cc16", "#a855f7",
];

interface Props {
  readOnly?: boolean;
}

const ChatChannelManager = ({ readOnly = false }: Props) => {
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Channel | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    color: "#6366f1",
    is_active: true,
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("chat_channels" as any)
      .select("*")
      .order("sort_order");
    if (data) setChannels(data as unknown as Channel[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: "", description: "", color: "#6366f1", is_active: true });
    setShowDialog(true);
  };

  const openEdit = (ch: Channel) => {
    setEditTarget(ch);
    setForm({ name: ch.name, description: ch.description ?? "", color: ch.color, is_active: ch.is_active });
    setShowDialog(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Kanal adı boş olamaz", variant: "destructive" });
      return;
    }
    const slug = form.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    if (editTarget) {
      const { error } = await (supabase.from("chat_channels" as any) as any)
        .update({ name: slug, description: form.description || null, color: form.color, is_active: form.is_active })
        .eq("id", editTarget.id);
      if (error) { toast({ title: "Hata", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Kanal güncellendi" });
    } else {
      const maxOrder = channels.reduce((m, c) => Math.max(m, c.sort_order), 0);
      const { error } = await (supabase.from("chat_channels" as any) as any)
        .insert({ name: slug, description: form.description || null, color: form.color, is_active: form.is_active, sort_order: maxOrder + 1 });
      if (error) { toast({ title: "Hata", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Kanal oluşturuldu" });
    }
    setShowDialog(false);
    load();
  };

  const deleteChannel = async (ch: Channel) => {
    if (!window.confirm(`"${ch.name}" kanalını silmek istediğinize emin misiniz? İçindeki tüm mesajlar da silinir.`)) return;
    await (supabase.from("chat_channels" as any) as any).delete().eq("id", ch.id);
    toast({ title: "Kanal silindi" });
    load();
  };

  const toggleActive = async (ch: Channel) => {
    await (supabase.from("chat_channels" as any) as any)
      .update({ is_active: !ch.is_active }).eq("id", ch.id);
    load();
  };

  const moveOrder = async (ch: Channel, dir: "up" | "down") => {
    const idx = channels.findIndex((c) => c.id === ch.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= channels.length) return;
    const swap = channels[swapIdx];
    await Promise.all([
      (supabase.from("chat_channels" as any) as any).update({ sort_order: swap.sort_order }).eq("id", ch.id),
      (supabase.from("chat_channels" as any) as any).update({ sort_order: ch.sort_order }).eq("id", swap.id),
    ]);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Chat Kanal Yönetimi
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">{channels.length} kanal tanımlı</p>
        </div>
        {!readOnly && (
          <Button onClick={openCreate} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Yeni Kanal
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-3">
          {channels.map((ch, idx) => (
            <Card key={ch.id} className="border-border/60 bg-card/60">
              <CardContent className="flex items-center gap-3 p-4">
                {/* Drag handle / sort */}
                {!readOnly && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveOrder(ch, "up")}
                      disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-muted disabled:opacity-20 text-muted-foreground hover:text-foreground"
                    >
                      <GripVertical className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Color swatch + icon */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${ch.color}20`, border: `1.5px solid ${ch.color}40` }}
                >
                  <Hash className="w-4 h-4" style={{ color: ch.color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: ch.color }}>#{ch.name}</span>
                    <Badge variant={ch.is_active ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">
                      {ch.is_active ? "Aktif" : "Pasif"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">sıra: {ch.sort_order}</span>
                  </div>
                  {ch.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{ch.description}</p>
                  )}
                </div>

                {/* Color preview */}
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 border border-border/40"
                  style={{ background: ch.color }}
                  title={ch.color}
                />

                {/* Actions */}
                {!readOnly && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={ch.is_active}
                      onCheckedChange={() => toggleActive(ch)}
                      className="scale-75"
                    />
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(ch)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="w-7 h-7 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => deleteChannel(ch)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-primary" />
              {editTarget ? "Kanalı Düzenle" : "Yeni Kanal Oluştur"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Kanal Adı</Label>
              <Input
                placeholder="örn: genel, teknik, random"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">Boşluklar otomatik tireli yazar, Türkçe karakter dönüştürülür.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Açıklama</Label>
              <Input
                placeholder="Kanalın amacı..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Renk</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{
                      background: c,
                      borderColor: form.color === c ? "white" : "transparent",
                      transform: form.color === c ? "scale(1.2)" : "scale(1)",
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="w-7 h-7 rounded-full cursor-pointer border border-border"
                  title="Özel renk"
                />
              </div>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg mt-1"
                style={{ background: `${form.color}18`, border: `1px solid ${form.color}30` }}
              >
                <Hash className="w-4 h-4" style={{ color: form.color }} />
                <span className="text-sm font-medium" style={{ color: form.color }}>
                  #{form.name || "kanal-adı"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="is-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="is-active">Kanal aktif</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>İptal</Button>
            <Button onClick={save}>{editTarget ? "Güncelle" : "Oluştur"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatChannelManager;
