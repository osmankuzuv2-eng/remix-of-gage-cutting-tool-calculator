import { useState } from "react";
import { Play, Search, BookOpen, Clock, Star, Filter, Youtube, ExternalLink, Plus, Trash2, Edit } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useCallback } from "react";
import { toast } from "sonner";

interface TrainingVideo {
  id: string;
  title: string;
  description: string | null;
  url: string;
  thumbnail_url: string | null;
  operation_type: string;
  difficulty: string;
  duration_minutes: number | null;
  author: string | null;
  view_count: number;
  created_at: string;
  created_by: string | null;
}

const OPERATION_TYPES = [
  { value: "all", label: "Tümü" },
  { value: "turning", label: "Tornalama" },
  { value: "milling", label: "Frezeleme" },
  { value: "grinding", label: "Taşlama" },
  { value: "drilling", label: "Delme" },
  { value: "threading", label: "Diş Açma" },
  { value: "programming", label: "CNC Programlama" },
  { value: "measurement", label: "Ölçüm" },
  { value: "maintenance", label: "Bakım" },
  { value: "other", label: "Diğer" },
];

const DIFFICULTY_LEVELS = [
  { value: "beginner", label: "Başlangıç", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { value: "intermediate", label: "Orta", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "advanced", label: "İleri", color: "bg-red-500/20 text-red-400 border-red-500/30" },
];

const getYoutubeThumbnail = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (match) return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  return null;
};

const getEmbedUrl = (url: string): string => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
};

export default function VideoTrainingModule() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOp, setFilterOp] = useState("all");
  const [filterDiff, setFilterDiff] = useState("all");
  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "", description: "", url: "", operation_type: "turning",
    difficulty: "beginner", duration_minutes: "", author: "",
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setIsAdmin(data?.some(r => r.role === "admin") ?? false);
    });
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("training_videos").select("*").order("created_at", { ascending: false });
    if (data) setVideos(data as TrainingVideo[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.title || !form.url) return toast.error("Başlık ve URL zorunludur.");
    const thumbnail = getYoutubeThumbnail(form.url) || null;
    const { error } = await (supabase as any).from("training_videos").insert({
      title: form.title,
      description: form.description || null,
      url: form.url,
      thumbnail_url: thumbnail,
      operation_type: form.operation_type,
      difficulty: form.difficulty,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      author: form.author || null,
      created_by: user?.id,
    });
    if (error) { toast.error("Video eklenemedi."); return; }
    toast.success("Video eklendi!");
    setShowAddDialog(false);
    setForm({ title: "", description: "", url: "", operation_type: "turning", difficulty: "beginner", duration_minutes: "", author: "" });
    load();
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from("training_videos").delete().eq("id", id);
    toast.success("Video silindi.");
    load();
  };

  const handleWatch = async (video: TrainingVideo) => {
    setSelectedVideo(video);
    await (supabase as any).from("training_videos").update({ view_count: video.view_count + 1 }).eq("id", video.id);
  };

  const filtered = videos.filter(v => {
    const matchSearch = v.title.toLowerCase().includes(search.toLowerCase()) ||
      (v.description || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.author || "").toLowerCase().includes(search.toLowerCase());
    const matchOp = filterOp === "all" || v.operation_type === filterOp;
    const matchDiff = filterDiff === "all" || v.difficulty === filterDiff;
    return matchSearch && matchOp && matchDiff;
  });

  const getDiffLabel = (val: string) => DIFFICULTY_LEVELS.find(d => d.value === val);
  const getOpLabel = (val: string) => OPERATION_TYPES.find(o => o.value === val)?.label || val;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-violet-400" />
            Video Eğitim Kütüphanesi
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Operasyon bazlı CNC eğitim videoları</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAddDialog(true)} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Video Ekle
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Video ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterOp} onValueChange={setFilterOp}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {OPERATION_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDiff} onValueChange={setFilterDiff}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Seviye" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Seviyeler</SelectItem>
            {DIFFICULTY_LEVELS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-violet-400">{videos.length}</div>
          <div className="text-xs text-muted-foreground">Toplam Video</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-violet-400">{[...new Set(videos.map(v => v.operation_type))].length}</div>
          <div className="text-xs text-muted-foreground">Operasyon</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-violet-400">{videos.reduce((s, v) => s + v.view_count, 0)}</div>
          <div className="text-xs text-muted-foreground">Toplam İzlenme</div>
        </div>
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Youtube className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground">
            {videos.length === 0 ? "Henüz video eklenmemiş." : "Arama sonucu bulunamadı."}
          </p>
          {isAdmin && videos.length === 0 && (
            <Button onClick={() => setShowAddDialog(true)} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" /> İlk Videoyu Ekle
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(video => {
            const diff = getDiffLabel(video.difficulty);
            return (
              <div key={video.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-violet-500/40 hover:shadow-lg transition-all duration-200 group">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-muted cursor-pointer" onClick={() => handleWatch(video)}>
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Youtube className="w-12 h-12 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-14 h-14 bg-violet-600 rounded-full flex items-center justify-center shadow-lg">
                      <Play className="w-6 h-6 text-white ml-1" />
                    </div>
                  </div>
                  {video.duration_minutes && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {video.duration_minutes} dk
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-foreground line-clamp-2 flex-1">{video.title}</h3>
                    {isAdmin && (
                      <button onClick={() => handleDelete(video.id)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-400 border-violet-500/30">
                      {getOpLabel(video.operation_type)}
                    </Badge>
                    {diff && (
                      <Badge variant="outline" className={`text-xs ${diff.color}`}>
                        {diff.label}
                      </Badge>
                    )}
                  </div>

                  {video.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{video.description}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>{video.author || "Anonim"}</span>
                    <span className="flex items-center gap-1">
                      <Play className="w-3 h-3" /> {video.view_count}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Watch Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedVideo?.title}</DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <div className="space-y-4">
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                <iframe
                  src={getEmbedUrl(selectedVideo.url)}
                  className="w-full h-full"
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/30">
                  {getOpLabel(selectedVideo.operation_type)}
                </Badge>
                {getDiffLabel(selectedVideo.difficulty) && (
                  <Badge variant="outline" className={getDiffLabel(selectedVideo.difficulty)!.color}>
                    {getDiffLabel(selectedVideo.difficulty)!.label}
                  </Badge>
                )}
                {selectedVideo.duration_minutes && (
                  <Badge variant="outline" className="text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" />{selectedVideo.duration_minutes} dk
                  </Badge>
                )}
              </div>
              {selectedVideo.description && (
                <p className="text-sm text-muted-foreground">{selectedVideo.description}</p>
              )}
              <a href={selectedVideo.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline">
                <ExternalLink className="w-3 h-3" /> YouTube'da Aç
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Video Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Başlık *</label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Video başlığı" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">YouTube URL *</label>
              <Input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Açıklama</label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Kısa açıklama" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Operasyon</label>
                <Select value={form.operation_type} onValueChange={v => setForm(p => ({ ...p, operation_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OPERATION_TYPES.filter(o => o.value !== "all").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Seviye</label>
                <Select value={form.difficulty} onValueChange={v => setForm(p => ({ ...p, difficulty: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DIFFICULTY_LEVELS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Süre (dk)</label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} placeholder="15" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Yazar</label>
                <Input value={form.author} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} placeholder="Eğitmen adı" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleAdd} className="flex-1 bg-violet-600 hover:bg-violet-700">Ekle</Button>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>İptal</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
