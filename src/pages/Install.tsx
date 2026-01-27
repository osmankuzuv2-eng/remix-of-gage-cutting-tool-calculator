import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Check, Share, MoreVertical, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md industrial-card">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <CardTitle className="text-2xl text-foreground">Uygulama Kuruldu!</CardTitle>
            <CardDescription>
              GAGE Toolroom artık ana ekranınızda. Uygulamayı oradan açabilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/">
              <Button className="btn-primary">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Ana Sayfaya Dön
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md industrial-card">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-foreground">Uygulamayı Kur</CardTitle>
          <CardDescription>
            GAGE Toolroom'u ana ekranınıza ekleyerek çevrimdışı kullanabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full btn-primary">
              <Download className="w-4 h-4 mr-2" />
              Şimdi Kur
            </Button>
          ) : isIOS ? (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-foreground">iPhone/iPad için kurulum:</h3>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">1</span>
                    <span>Safari'de <Share className="w-4 h-4 inline mx-1" /> (Paylaş) butonuna dokunun</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">2</span>
                    <span>Aşağı kaydırın ve "Ana Ekrana Ekle" seçeneğini bulun</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">3</span>
                    <span>"Ekle" butonuna dokunun</span>
                  </li>
                </ol>
              </div>
            </div>
          ) : isAndroid ? (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-foreground">Android için kurulum:</h3>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">1</span>
                    <span>Chrome menüsünde <MoreVertical className="w-4 h-4 inline mx-1" /> (üç nokta) butonuna dokunun</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">2</span>
                    <span>"Ana ekrana ekle" veya "Uygulamayı yükle" seçeneğini bulun</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">3</span>
                    <span>"Yükle" butonuna dokunun</span>
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground">Masaüstü için kurulum:</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">1</span>
                  <span>Adres çubuğundaki kurulum ikonuna tıklayın</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">2</span>
                  <span>"Yükle" butonuna tıklayın</span>
                </li>
              </ol>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <Link to="/">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Ana Sayfaya Dön
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
