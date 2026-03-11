import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Users, Wifi } from "lucide-react";

const OnlineUsersPanel = () => {
  const { onlineUsers } = useOnlineUsers();
  const { user } = useAuth();

  return (
    <Card className="flex flex-col h-full border-border/60 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Wifi className="w-4 h-4 text-emerald-400" />
          </div>
          <span>Çevrimiçi Kullanıcılar</span>
          <Badge
            variant="secondary"
            className="ml-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-xs font-mono"
          >
            {onlineUsers.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0 px-4 pb-4">
        <ScrollArea className="h-full max-h-[1040px]">
          {onlineUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Şu an kimse çevrimiçi değil</p>
            </div>
          ) : (
            <ul className="space-y-1.5 pr-2">
              {onlineUsers.map((u) => {
                const isMe = u.user_id === user?.id;
                const initials = (u.display_name ?? "?")
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <li
                    key={u.user_id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                      isMe
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : "bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isMe
                          ? "bg-emerald-500/25 text-emerald-300"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {initials}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm font-medium truncate block ${
                          isMe ? "text-emerald-300" : "text-foreground"
                        }`}
                      >
                        {u.display_name ?? "Bilinmeyen"}
                        {isMe && (
                          <span className="text-xs text-emerald-500/70 ml-1">(siz)</span>
                        )}
                      </span>
                    </div>

                    {/* Online dot */}
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        {/* Footer info */}
        <p className="text-[10px] text-muted-foreground/50 mt-3 text-center">
          Her 5 dakikada bir güncellenir
        </p>
      </CardContent>
    </Card>
  );
};

export default OnlineUsersPanel;
