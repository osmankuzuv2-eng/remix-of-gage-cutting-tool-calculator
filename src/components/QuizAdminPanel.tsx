import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Loader2, Users, BarChart3, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const QuizAdminPanel = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<{ totalResults: number; uniqueUsers: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("quiz_results").select("id, user_id");
      if (error) throw error;
      const uniqueUsers = new Set(data?.map((r) => r.user_id) || []).size;
      setStats({ totalResults: data?.length || 0, uniqueUsers });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleResetAll = async () => {
    setResetting(true);
    try {
      const { error } = await supabase.from("quiz_results").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      toast({ title: "Başarılı", description: "Tüm quiz sonuçları, istatistikler ve liderlik tablosu sıfırlandı." });
      loadStats();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Toplam Quiz Sonucu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-mono font-bold text-primary">{stats?.totalResults || 0}</span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" /> Aktif Kullanıcı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-mono font-bold text-accent">{stats?.uniqueUsers || 0}</span>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" /> Quiz Verilerini Sıfırla
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bu işlem tüm kullanıcıların quiz sonuçlarını, istatistiklerini ve liderlik tablosunu kalıcı olarak siler. Bu işlem geri alınamaz.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2" disabled={resetting || (stats?.totalResults === 0)}>
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                Tüm Quiz Verilerini Sıfırla
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bu işlem <strong>{stats?.totalResults || 0}</strong> quiz sonucunu ve <strong>{stats?.uniqueUsers || 0}</strong> kullanıcının istatistiklerini kalıcı olarak silecektir. Bu işlem geri alınamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Evet, Sıfırla
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizAdminPanel;
