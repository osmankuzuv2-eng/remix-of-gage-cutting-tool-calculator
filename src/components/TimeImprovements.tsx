import { useState } from "react";
import { useTimeImprovements, TimeImprovement } from "@/hooks/useTimeImprovements";
import { useCustomers } from "@/hooks/useCustomers";
import { useMachines } from "@/hooks/useMachines";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, TrendingDown, Clock, RefreshCw, Loader2, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";

const OPERATION_TYPES = [
  { value: "turning", label: "Tornalama" },
  { value: "milling", label: "Frezeleme" },
  { value: "drilling", label: "Delme" },
  { value: "grinding", label: "Taşlama" },
  { value: "threading", label: "Diş Açma" },
  { value: "other", label: "Diğer" },
];

const emptyForm = {
  reference_code: "",
  customer_name: "",
  machine_id: "",
  machine_name: "",
  part_name: "",
  operation_type: "turning",
  old_time_minutes: 0,
  new_time_minutes: 0,
  improvement_details: "",
  tool_changes: "",
  parameter_changes: "",
  notes: "",
  improvement_date: new Date().toISOString().split("T")[0],
};

interface Props {
  isAdmin?: boolean;
}

const TimeImprovements = ({ isAdmin }: Props) => {
  const { improvements, loading, reload, add, update, remove } = useTimeImprovements();
  const { activeCustomers } = useCustomers();
  const { machines, getMachineLabel } = useMachines();
  const { language } = useLanguage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterCustomer, setFilterCustomer] = useState<string>("all");

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: TimeImprovement) => {
    setEditId(item.id);
    setForm({
      reference_code: item.reference_code,
      customer_name: item.customer_name,
      machine_id: item.machine_id || "",
      machine_name: item.machine_name || "",
      part_name: item.part_name,
      operation_type: item.operation_type,
      old_time_minutes: item.old_time_minutes,
      new_time_minutes: item.new_time_minutes,
      improvement_details: item.improvement_details || "",
      tool_changes: item.tool_changes || "",
      parameter_changes: item.parameter_changes || "",
      notes: item.notes || "",
      improvement_date: item.improvement_date,
    });
    setDialogOpen(true);
  };

  const handleMachineChange = (machineId: string) => {
    const machine = machines.find((m) => m.id === machineId);
    setForm((prev) => ({
      ...prev,
      machine_id: machineId,
      machine_name: machine ? machine.label : "",
    }));
  };

  const handleSave = async () => {
    if (!form.reference_code || !form.customer_name || !form.part_name || !form.old_time_minutes) {
      toast.error("Lütfen zorunlu alanları doldurun");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      machine_id: form.machine_id || null,
      machine_name: form.machine_name || null,
      old_time_minutes: Number(form.old_time_minutes),
      new_time_minutes: Number(form.new_time_minutes),
      improvement_details: form.improvement_details || null,
      tool_changes: form.tool_changes || null,
      parameter_changes: form.parameter_changes || null,
      notes: form.notes || null,
    };
    const error = editId ? await update(editId, payload) : await add(payload as any);
    setSaving(false);
    if (!error) {
      toast.success(editId ? "Kayıt güncellendi" : "Kayıt eklendi");
      setDialogOpen(false);
    } else {
      toast.error("Hata oluştu");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    const error = await remove(id);
    if (!error) toast.success("Kayıt silindi");
    else toast.error("Silme hatası");
  };

  const filtered = filterCustomer === "all" ? improvements : improvements.filter((i) => i.customer_name === filterCustomer);

  const totalSaved = filtered.reduce((sum, i) => sum + (i.old_time_minutes - i.new_time_minutes), 0);
  const avgImprovement = filtered.length > 0 ? filtered.reduce((sum, i) => sum + Number(i.improvement_percent), 0) / filtered.length : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-primary" />
              Parça Süre İyileştirmeleri
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={reload}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button size="sm" onClick={openNew} className="gap-1.5">
                <Plus className="w-4 h-4" /> Yeni Kayıt
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <SummaryCard label="Toplam Kayıt" value={filtered.length.toString()} />
            <SummaryCard label="Kazanılan Süre" value={`${totalSaved.toFixed(1)} dk`} />
            <SummaryCard label="Ort. İyileştirme" value={`%${avgImprovement.toFixed(1)}`} />
            <SummaryCard label="Müşteri Sayısı" value={new Set(improvements.map((i) => i.customer_name)).size.toString()} />
          </div>

          {/* Filter */}
          <div className="flex items-center gap-3 mb-4">
            <Label className="text-sm whitespace-nowrap">Müşteri Filtre:</Label>
            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {[...new Set(improvements.map((i) => i.customer_name))].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Henüz kayıt bulunmuyor</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Referans</TableHead>
                    <TableHead>Müşteri</TableHead>
                    <TableHead>Parça</TableHead>
                    <TableHead>Tezgah</TableHead>
                    <TableHead>İşlem</TableHead>
                    <TableHead className="text-right">Eski (dk)</TableHead>
                    <TableHead className="text-right">Yeni (dk)</TableHead>
                    <TableHead className="text-right">İyileştirme</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">{item.improvement_date}</TableCell>
                      <TableCell className="font-mono text-xs">{item.reference_code}</TableCell>
                      <TableCell>{item.customer_name}</TableCell>
                      <TableCell>{item.part_name}</TableCell>
                      <TableCell className="text-xs">{item.machine_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="text-xs">
                          {OPERATION_TYPES.find((o) => o.value === item.operation_type)?.label || item.operation_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{item.old_time_minutes}</TableCell>
                      <TableCell className="text-right font-mono">{item.new_time_minutes}</TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1 text-green-600 font-semibold">
                          <ArrowDownRight className="w-3 h-3" />
                          %{Number(item.improvement_percent).toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Kaydı Düzenle" : "Yeni İyileştirme Kaydı"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Referans Kodu *</Label>
              <Input value={form.reference_code} onChange={(e) => setForm((p) => ({ ...p, reference_code: e.target.value }))} placeholder="REF-001" />
            </div>
            <div>
              <Label>Tarih *</Label>
              <Input type="date" value={form.improvement_date} onChange={(e) => setForm((p) => ({ ...p, improvement_date: e.target.value }))} />
            </div>
            <div>
              <Label>Müşteri *</Label>
              <Select value={form.customer_name} onValueChange={(v) => setForm((p) => ({ ...p, customer_name: v }))}>
                <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                <SelectContent>
                  {activeCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tezgah</Label>
              <Select value={form.machine_id} onValueChange={handleMachineChange}>
                <SelectTrigger><SelectValue placeholder="Tezgah seçin" /></SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Parça Adı *</Label>
              <Input value={form.part_name} onChange={(e) => setForm((p) => ({ ...p, part_name: e.target.value }))} />
            </div>
            <div>
              <Label>İşlem Tipi</Label>
              <Select value={form.operation_type} onValueChange={(v) => setForm((p) => ({ ...p, operation_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATION_TYPES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Eski Süre (dk) *</Label>
              <Input type="number" min={0} value={form.old_time_minutes || ""} onChange={(e) => setForm((p) => ({ ...p, old_time_minutes: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Yeni Süre (dk) *</Label>
              <Input type="number" min={0} value={form.new_time_minutes || ""} onChange={(e) => setForm((p) => ({ ...p, new_time_minutes: Number(e.target.value) }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Yapılan İyileştirmeler</Label>
              <Textarea value={form.improvement_details} onChange={(e) => setForm((p) => ({ ...p, improvement_details: e.target.value }))} placeholder="Hangi değişiklikler yapıldı?" rows={2} />
            </div>
            <div>
              <Label>Takım Değişiklikleri</Label>
              <Textarea value={form.tool_changes} onChange={(e) => setForm((p) => ({ ...p, tool_changes: e.target.value }))} placeholder="Kullanılan yeni takımlar..." rows={2} />
            </div>
            <div>
              <Label>Parametre Değişiklikleri</Label>
              <Textarea value={form.parameter_changes} onChange={(e) => setForm((p) => ({ ...p, parameter_changes: e.target.value }))} placeholder="Değiştirilen parametreler..." rows={2} />
            </div>
            <div className="md:col-span-2">
              <Label>Notlar</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
            {form.old_time_minutes > 0 && form.new_time_minutes > 0 && (
              <div className="md:col-span-2 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-4 text-sm">
                  <span>Kazanç: <strong className="text-green-600">{(form.old_time_minutes - form.new_time_minutes).toFixed(1)} dk</strong></span>
                  <span>İyileştirme: <strong className="text-green-600">%{((1 - form.new_time_minutes / form.old_time_minutes) * 100).toFixed(1)}</strong></span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {editId ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SummaryCard = ({ label, value }: { label: string; value: string }) => (
  <div className="p-3 rounded-lg bg-card border border-border text-center">
    <span className="text-xl font-bold text-primary">{value}</span>
    <span className="block text-xs text-muted-foreground mt-1">{label}</span>
  </div>
);

export default TimeImprovements;
