import { useState, useRef, useEffect } from "react";
import { useTimeImprovements, TimeImprovement, TimeImprovementImage } from "@/hooks/useTimeImprovements";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomers } from "@/hooks/useCustomers";
import { useMachines } from "@/hooks/useMachines";
import { useLanguage } from "@/i18n/LanguageContext";
import { translations } from "@/i18n/translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, TrendingDown, RefreshCw, Loader2, ArrowDownRight, ImagePlus, X, Image as ImageIcon, FileDown, FileSpreadsheet, User } from "lucide-react";
import { toast } from "sonner";
import { exportTimeImprovementsPdf } from "@/lib/exportTimeImprovementsPdf";
import { exportTimeImprovementsExcel } from "@/lib/exportTimeImprovementsExcel";

const OPERATION_TYPE_KEYS = ["turning", "milling", "drilling", "grinding", "threading", "other"] as const;

const FACTORIES = ["Havacılık", "Raylı Sistemler"];

const emptyForm = {
  reference_code: "",
  customer_name: "",
  factory: "Havacılık",
  machine_id: "",
  machine_name: "",
  part_name: "",
  operation_type: "turning",
  old_time_minutes: 0,
  new_time_minutes: 0,
  old_price: 0,
  new_price: 0,
  order_quantity: 1,
  team_members: [] as string[],
  improvement_details: "",
  tool_changes: "",
  parameter_changes: "",
  notes: "",
  images: [] as TimeImprovementImage[],
  improvement_date: new Date().toISOString().split("T")[0],
};

interface Props {
  isAdmin?: boolean;
  canRecord?: boolean;
}

const TimeImprovements = ({ isAdmin, canRecord = true }: Props) => {
  const { improvements, loading, reload, add, update, remove } = useTimeImprovements();
  const { user } = useAuth();
  const { activeCustomers } = useCustomers();
  const { machines, getMachineLabel } = useMachines();
  const { language, t } = useLanguage();
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).single()
      .then(({ data }) => { if (data?.display_name) setDisplayName(data.display_name); });
  }, [user]);

  const OPERATION_TYPES = OPERATION_TYPE_KEYS.map((key) => ({
    value: key,
    label: t("improvements", `op${key.charAt(0).toUpperCase() + key.slice(1)}` as any),
  }));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [filterFactory, setFilterFactory] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      factory: item.factory || "Havacılık",
      machine_id: item.machine_id || "",
      machine_name: item.machine_name || "",
      part_name: item.part_name,
      operation_type: item.operation_type,
      old_time_minutes: item.old_time_minutes,
      new_time_minutes: item.new_time_minutes,
      old_price: Number(item.old_price) || 0,
      new_price: Number(item.new_price) || 0,
      order_quantity: (item as any).order_quantity || 1,
      team_members: (item as any).team_members || [],
      improvement_details: item.improvement_details || "",
      tool_changes: item.tool_changes || "",
      parameter_changes: item.parameter_changes || "",
      notes: item.notes || "",
      images: item.images || [],
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const newImages: TimeImprovementImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) { toast.error(t("improvements", "imageOnlyError")); continue; }
      if (file.size > 5 * 1024 * 1024) { toast.error(t("improvements", "imageSizeError")); continue; }
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("time-improvement-images").upload(path, file);
      if (error) { toast.error(t("improvements", "uploadError")); continue; }
      const { data: urlData } = supabase.storage.from("time-improvement-images").getPublicUrl(path);
      newImages.push({ url: urlData.publicUrl, caption: "", uploaded_at: new Date().toISOString() });
    }
    setForm((p) => ({ ...p, images: [...p.images, ...newImages] }));
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.reference_code || !form.customer_name || !form.part_name || !form.old_time_minutes) {
      toast.error(t("improvements", "requiredFields"));
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      machine_id: form.machine_id || null,
      machine_name: form.machine_name || null,
      old_time_minutes: Number(form.old_time_minutes),
      new_time_minutes: Number(form.new_time_minutes),
      old_price: Number(form.old_price),
      new_price: Number(form.new_price),
      improvement_details: form.improvement_details || null,
      tool_changes: form.tool_changes || null,
      parameter_changes: form.parameter_changes || null,
      notes: form.notes || null,
      images: form.images,
      ...(!editId ? { created_by_name: displayName || user?.email || "Bilinmiyor" } : {}),
    };
    const error = editId ? await update(editId, payload) : await add(payload as any);
    setSaving(false);
    if (!error) {
      toast.success(editId ? t("improvements", "recordUpdated") : t("improvements", "recordSaved"));
      setDialogOpen(false);
    } else {
      toast.error(t("improvements", "saveError"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("improvements", "confirmDelete"))) return;
    const error = await remove(id);
    if (!error) toast.success(t("improvements", "recordDeleted"));
    else toast.error(t("improvements", "deleteError"));
  };

  // Build month options from data
  const monthOptions = [...new Set(improvements.map((i) => i.improvement_date?.slice(0, 7)).filter(Boolean))].sort().reverse();

  const filtered = improvements
    .filter((i) => filterCustomer === "all" || i.customer_name === filterCustomer)
    .filter((i) => filterFactory === "all" || i.factory === filterFactory)
    .filter((i) => filterMonth === "all" || i.improvement_date?.startsWith(filterMonth));

  const totalTimeSaved = filtered.reduce((sum, i) => sum + (i.old_time_minutes - i.new_time_minutes) * ((i as any).order_quantity || 1), 0);
  const avgTimeImpr = filtered.length > 0 ? filtered.reduce((sum, i) => sum + Number(i.improvement_percent), 0) / filtered.length : 0;
  const totalPriceSaved = filtered.reduce((sum, i) => sum + (Number(i.old_price) - Number(i.new_price)) * ((i as any).order_quantity || 1), 0);

  const monthNames = (translations as any).export?.months?.[language] || (translations as any).export?.months?.["tr"];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-primary" />
              {t("improvements", "title")}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => exportTimeImprovementsPdf(filtered, filterFactory === "all" ? t("improvements", "allFactories") : filterFactory, t)} className="gap-1.5">
                <FileDown className="w-4 h-4" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportTimeImprovementsExcel(filtered, filterFactory === "all" ? t("improvements", "allFactories") : filterFactory, t)} className="gap-1.5">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={reload}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              {canRecord && (
                <Button size="sm" onClick={openNew} className="gap-1.5">
                  <Plus className="w-4 h-4" /> {t("improvements", "newRecord")}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <SummaryCard label={t("improvements", "totalRecords")} value={filtered.length.toString()} />
            <SummaryCard label={t("improvements", "timeSaved")} value={`${totalTimeSaved.toFixed(1)} ${t("common", "minute")}`} />
            <SummaryCard label={t("improvements", "avgTimeImpr")} value={`%${avgTimeImpr.toFixed(1)}`} />
            <SummaryCard label={t("improvements", "priceSaved")} value={`€${totalPriceSaved.toFixed(2)}`} />
            <SummaryCard label={t("improvements", "customerCount")} value={new Set(filtered.map((i) => i.customer_name)).size.toString()} />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">{t("improvements", "filterFactory")}:</Label>
              <Select value={filterFactory} onValueChange={setFilterFactory}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("improvements", "filterAll")}</SelectItem>
                  {FACTORIES.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">{t("improvements", "filterCustomer")}:</Label>
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("improvements", "filterAll")}</SelectItem>
                  {[...new Set(improvements.map((i) => i.customer_name))].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">{t("improvements", "filterMonth")}:</Label>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("improvements", "filterAll")}</SelectItem>
                  {monthOptions.map((m) => {
                    const [y, mo] = m.split("-");
                    return <SelectItem key={m} value={m}>{monthNames[parseInt(mo) - 1]} {y}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("improvements", "noRecords")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("improvements", "colDate")}</TableHead>
                    <TableHead>{t("improvements", "colFactory")}</TableHead>
                    <TableHead>{t("improvements", "colRef")}</TableHead>
                    <TableHead>{t("improvements", "colCustomer")}</TableHead>
                    <TableHead>{t("improvements", "colPart")}</TableHead>
                    <TableHead>{t("improvements", "colMachine")}</TableHead>
                    <TableHead>{t("improvements", "colProcess")}</TableHead>
                    <TableHead className="text-right">{t("improvements", "colOldMin")}</TableHead>
                    <TableHead className="text-right">{t("improvements", "colNewMin")}</TableHead>
                    <TableHead className="text-right">{t("improvements", "colTimePercent")}</TableHead>
                    <TableHead className="text-right">{t("improvements", "colOldPrice")}</TableHead>
                    <TableHead className="text-right">{t("improvements", "colNewPrice")}</TableHead>
                    <TableHead className="text-right">{t("improvements", "colPricePercent")}</TableHead>
                    <TableHead>{t("improvements", "colImage")}</TableHead>
                    <TableHead>{t("improvements", "colSavedBy")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">{item.improvement_date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{item.factory}</Badge>
                      </TableCell>
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
                        <span className="flex items-center justify-end gap-1 text-success font-semibold">
                          <ArrowDownRight className="w-3 h-3" />
                          %{Number(item.improvement_percent).toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">{Number(item.old_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">{Number(item.new_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {Number(item.old_price) > 0 ? (
                          <span className="flex items-center justify-end gap-1 text-success font-semibold">
                            <ArrowDownRight className="w-3 h-3" />
                            %{Number(item.price_improvement_percent).toFixed(1)}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {item.images && item.images.length > 0 && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <ImageIcon className="w-3 h-3" /> {item.images.length}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          {item.created_by_name || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(canRecord || isAdmin) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
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
            <div className="flex items-center justify-between">
              <DialogTitle>{editId ? t("improvements", "editRecord") : t("improvements", "newImprovement")}</DialogTitle>
              <div className="flex gap-1.5">
                {FACTORIES.map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={form.factory === f ? "default" : "outline"}
                    onClick={() => setForm((p) => ({ ...p, factory: f }))}
                    className="text-xs"
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t("improvements", "referenceCode")}</Label>
              <Input value={form.reference_code} onChange={(e) => setForm((p) => ({ ...p, reference_code: e.target.value }))} placeholder="REF-001" />
            </div>
            <div>
              <Label>{t("improvements", "date")}</Label>
              <Input type="date" value={form.improvement_date} onChange={(e) => setForm((p) => ({ ...p, improvement_date: e.target.value }))} />
            </div>
            <div>
              <Label>{t("improvements", "customer")}</Label>
              <Select value={form.customer_name} onValueChange={(v) => setForm((p) => ({ ...p, customer_name: v }))}>
                <SelectTrigger><SelectValue placeholder={t("improvements", "selectCustomer")} /></SelectTrigger>
                <SelectContent>
                  {activeCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("improvements", "machine")}</Label>
              <Select value={form.machine_id} onValueChange={handleMachineChange}>
                <SelectTrigger><SelectValue placeholder={t("improvements", "selectMachine")} /></SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("improvements", "partName")}</Label>
              <Input value={form.part_name} onChange={(e) => setForm((p) => ({ ...p, part_name: e.target.value }))} />
            </div>
            <div>
              <Label>{t("improvements", "operationType")}</Label>
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
              <Label>{t("improvements", "orderQty")}</Label>
              <Input type="number" min={1} value={form.order_quantity || 1} onChange={(e) => setForm((p) => ({ ...p, order_quantity: Number(e.target.value) }))} />
            </div>

            {/* Time fields - side by side */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <div>
                <Label>{t("improvements", "oldTime")}</Label>
                <Input type="number" min={0} value={form.old_time_minutes || ""} onChange={(e) => setForm((p) => ({ ...p, old_time_minutes: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>{t("improvements", "newTime")}</Label>
                <Input type="number" min={0} value={form.new_time_minutes || ""} onChange={(e) => setForm((p) => ({ ...p, new_time_minutes: Number(e.target.value) }))} />
              </div>
            </div>

            {/* Price fields - side by side */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <div>
                <Label>{t("improvements", "oldPrice")}</Label>
                <Input type="number" min={0} step="0.01" value={form.old_price || ""} onChange={(e) => setForm((p) => ({ ...p, old_price: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>{t("improvements", "newPrice")}</Label>
                <Input type="number" min={0} step="0.01" value={form.new_price || ""} onChange={(e) => setForm((p) => ({ ...p, new_price: Number(e.target.value) }))} />
              </div>
            </div>

            {/* Team Members */}
            <div className="md:col-span-2">
              <Label className="flex items-center gap-1.5 mb-2">
                <User className="w-4 h-4" /> {t("improvements", "projectTeam")}
              </Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.team_members.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-sm">
                    <span>{name}</span>
                    <button type="button" onClick={() => setForm((p) => ({ ...p, team_members: p.team_members.filter((_, i) => i !== idx) }))} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              {form.team_members.length < 5 && (
                <div className="flex gap-2">
                  <Input
                    placeholder={t("improvements", "enterName")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && form.team_members.length < 5) {
                          setForm((p) => ({ ...p, team_members: [...p.team_members, val] }));
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={(e) => {
                    const input = (e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement;
                    const val = input?.value.trim();
                    if (val && form.team_members.length < 5) {
                      setForm((p) => ({ ...p, team_members: [...p.team_members, val] }));
                      input.value = "";
                    }
                  }}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <Label>{t("improvements", "improvements")}</Label>
              <Textarea value={form.improvement_details} onChange={(e) => setForm((p) => ({ ...p, improvement_details: e.target.value }))} placeholder={t("improvements", "improvementsPlaceholder")} rows={2} />
            </div>
            <div>
              <Label>{t("improvements", "toolChanges")}</Label>
              <Textarea value={form.tool_changes} onChange={(e) => setForm((p) => ({ ...p, tool_changes: e.target.value }))} placeholder={t("improvements", "toolChangesPlaceholder")} rows={2} />
            </div>
            <div>
              <Label>{t("improvements", "paramChanges")}</Label>
              <Textarea value={form.parameter_changes} onChange={(e) => setForm((p) => ({ ...p, parameter_changes: e.target.value }))} placeholder={t("improvements", "paramChangesPlaceholder")} rows={2} />
            </div>
            {/* Image Upload */}
            <div className="md:col-span-2">
              <Label className="flex items-center gap-1.5 mb-2">
                <ImageIcon className="w-4 h-4" /> {t("improvements", "images")}
              </Label>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              <div className="flex flex-wrap gap-2 mb-2">
                {form.images.map((img, idx) => (
                  <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <img src={img.url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewImage(img.url)} />
                    <button type="button" onClick={() => removeImage(idx)} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                  <span className="text-[10px]">{uploading ? t("improvements", "uploading") : t("improvements", "addImage")}</span>
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>{t("improvements", "notes")}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>

            {/* Preview calculations */}
            {(form.old_time_minutes > 0 || form.old_price > 0) && (
              <div className="md:col-span-2 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  {form.old_time_minutes > 0 && form.new_time_minutes > 0 && (
                    <>
                      <span>{t("improvements", "timeSavings")}: <strong className="text-success">{(form.old_time_minutes - form.new_time_minutes).toFixed(1)} {t("common", "minute")}</strong></span>
                      <span>{t("improvements", "timeImprLabel")}: <strong className="text-success">%{((1 - form.new_time_minutes / form.old_time_minutes) * 100).toFixed(1)}</strong></span>
                    </>
                  )}
                  {form.old_price > 0 && form.new_price > 0 && (
                    <>
                      <span>{t("improvements", "priceGain")}: <strong className="text-success">{(form.old_price - form.new_price).toFixed(2)} ₺</strong></span>
                      <span>{t("improvements", "priceImprLabel")}: <strong className="text-success">%{((1 - form.new_price / form.old_price) * 100).toFixed(1)}</strong></span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common", "cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {editId ? t("common", "save") : t("common", "save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          {previewImage && <img src={previewImage} alt={t("improvements", "preview")} className="w-full h-auto rounded-lg" />}
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

