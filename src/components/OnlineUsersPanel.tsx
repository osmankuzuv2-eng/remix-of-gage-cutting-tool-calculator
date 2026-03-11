import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Users, Wifi } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
          <span>Çevrimiçi</span>
          <Badge
            variant="secondary"
            className="ml-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-xs font-mono"
          >
            {onlineUsers.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0 px-3 pb-0 flex flex-col">
        <ScrollArea className="flex-1 max-h-[1040px]">
          {onlineUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Şu an kimse çevrimiçi değil</p>
            </div>
          ) : (
            <TooltipProvider delayDuration={300}>
              <div className="flex flex-wrap gap-3 py-2 justify-center">
                {onlineUsers.map((u) => {
                  const isMe = u.user_id === user?.id;
                  const initials = (u.display_name ?? "?")
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const displayName = u.display_name ?? "Bilinmeyen";

                  return (
                    <Tooltip key={u.user_id}>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col items-center gap-1 w-[72px] cursor-default">
                          <div className="relative">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden ${
                                isMe
                                  ? "ring-2 ring-emerald-500/40"
                                  : ""
                              }`}
                            >
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                              ) : (
                                <div className={`w-full h-full flex items-center justify-center ${
                                  isMe
                                    ? "bg-emerald-500/25 text-emerald-300"
                                    : "bg-primary/15 text-primary"
                                }`}>
                                  {initials}
                                </div>
                              )}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-card animate-pulse" />
                          </div>
                          <span
                            className={`text-[11px] leading-tight text-center w-full line-clamp-2 ${
                              isMe ? "text-emerald-300 font-semibold" : "text-foreground/80"
                            }`}
                          >
                            {displayName}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {displayName}{isMe ? " (siz)" : ""}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
        </ScrollArea>
        <p className="text-[10px] text-muted-foreground/50 py-2 text-center border-t border-border/30 mt-1 flex-shrink-0">
          Her 5 dakikada bir güncellenir
        </p>
      </CardContent>
    </Card>
  );
};

export default OnlineUsersPanel;
