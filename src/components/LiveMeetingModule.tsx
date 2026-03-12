import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Users, Lock, Unlock,
  LogIn, Crown, VolumeX, Volume2, Eye, EyeOff, RefreshCw,
  AlertCircle, X, Send, MessageSquare, RotateCcw, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Room {
  id: string;
  name: string;
  room_number: number;
  owner_id: string | null;
  owner_name: string | null;
  is_locked: boolean;
  participant_count: number;
  max_participants: number;
  password?: string | null;
}

interface Participant {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
  is_audio_muted: boolean;
  is_video_off: boolean;
  is_admin_muted: boolean;
  is_admin_video_off: boolean;
  last_heartbeat?: string;
}

interface PeerState {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  stream: MediaStream | null;
  pc: RTCPeerConnection;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isAdminMuted: boolean;
  isAdminVideoOff: boolean;
}

interface ChatMessage {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
}

// ─── ICE ──────────────────────────────────────────────────────────────────────

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

// ─── VideoTile ────────────────────────────────────────────────────────────────

const VideoTile = ({
  stream, name, avatarUrl, isLocal, isMuted, isVideoOff, isAdminMuted, isAdminVideoOff, isOwner, onKick,
}: {
  stream: MediaStream | null;
  name: string;
  avatarUrl?: string | null;
  isLocal: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isAdminMuted?: boolean;
  isAdminVideoOff?: boolean;
  isOwner?: boolean;
  onKick?: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const videoHidden = isVideoOff || isAdminVideoOff;
  const audioMuted = isMuted || isAdminMuted;

  return (
    <div className="relative rounded-xl overflow-hidden bg-muted/30 border border-border aspect-video flex items-center justify-center group">
      {!videoHidden && stream ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-16 h-16 rounded-full object-cover border-2 border-primary/30" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">{name.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <span className="text-xs text-muted-foreground">Kamera kapalı</span>
        </div>
      )}

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isOwner && <Crown className="w-3 h-3 text-yellow-400" />}
          <span className="text-xs text-white font-medium truncate max-w-[120px]">
            {isLocal ? `${name} (Sen)` : name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {audioMuted && <MicOff className="w-3 h-3 text-red-400" />}
          {videoHidden && <VideoOff className="w-3 h-3 text-red-400" />}
        </div>
      </div>

      {/* Kick button - top-right on hover */}
      {onKick && (
        <button
          onClick={onKick}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          title="Odadan Çıkar"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

// ─── Room Card ────────────────────────────────────────────────────────────────

const RoomCard = ({ room, onJoin, currentUserId }: { room: Room; onJoin: (r: Room) => void; currentUserId: string }) => {
  const isFull = room.participant_count >= room.max_participants;
  const isEmpty = room.participant_count === 0;

  return (
    <div className={`bg-card border rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 hover:border-primary/40 hover:shadow-lg ${isFull ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{room.name}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            {room.owner_id ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Crown className="w-3 h-3 text-yellow-400" />
                {room.owner_name || "Yönetici"}
              </span>
            ) : (
              <span className="text-xs text-emerald-400">Boş oda</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {room.is_locked && (
            <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
              <Lock className="w-3 h-3" />Şifreli
            </span>
          )}
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
            <Users className="w-3 h-3" />
            {room.participant_count}/{room.max_participants}
          </span>
        </div>
      </div>

      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${isFull ? "bg-red-500" : room.participant_count > 0 ? "bg-emerald-500" : "bg-muted-foreground/20"}`}
          style={{ width: `${Math.min((room.participant_count / room.max_participants) * 100, 100)}%` }}
        />
      </div>

      <Button size="sm" disabled={isFull} onClick={() => onJoin(room)} className="w-full" variant={isEmpty ? "default" : "outline"}>
        <LogIn className="w-4 h-4 mr-2" />
        {isFull ? "Oda Dolu" : room.owner_id === currentUserId ? "Odana Geri Dön" : isEmpty ? "Oda Aç" : "Katıl"}
      </Button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const LiveMeetingModule = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState("");
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [pendingRoom, setPendingRoom] = useState<Room | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadChat, setUnreadChat] = useState(0);
  const [myProfile, setMyProfile] = useState<{ display_name: string; avatar_url: string | null }>({ display_name: "", avatar_url: null });

  const signalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const participantChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const participantIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const activeRoomRef = useRef<Room | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isOwnerRef = useRef(false);
  const isLeavingRef = useRef(false);
  peersRef.current = peers;

  // ── Load profile ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setMyProfile({
          display_name: data.display_name || user.email?.split("@")[0] || "Kullanıcı",
          avatar_url: data.avatar_url || null,
        });
      } else {
        setMyProfile({ display_name: user.email?.split("@")[0] || "Kullanıcı", avatar_url: null });
      }
    });
  }, [user]);

  const displayName = myProfile.display_name || user?.email?.split("@")[0] || "Kullanıcı";

  // ── Load rooms ────────────────────────────────────────────────────────────────

  const loadRooms = useCallback(async () => {
    const { data } = await supabase
      .from("meeting_rooms" as any)
      .select("*")
      .eq("is_active", true)
      .order("room_number");
    if (data) setRooms(data as unknown as Room[]);
    setRoomsLoading(false);
  }, []);

  useEffect(() => {
    loadRooms();
    const ch = supabase
      .channel("meeting-rooms-list-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_rooms" }, loadRooms)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadRooms]);

  // ── Join flow ─────────────────────────────────────────────────────────────────

  const handleJoinAttempt = (room: Room) => {
    setPendingRoom(room);
    if (room.is_locked && room.owner_id !== user?.id) {
      setPasswordInput("");
      setShowPasswordDialog(true);
    } else {
      enterRoom(room);
    }
  };

  const handlePasswordSubmit = () => {
    if (!pendingRoom) return;
    if (passwordInput !== (pendingRoom as any).password) {
      toast({ title: "Yanlış şifre", variant: "destructive" });
      return;
    }
    setShowPasswordDialog(false);
    enterRoom(pendingRoom);
  };

  // ── Get participant profiles ───────────────────────────────────────────────────

  const enrichParticipantsWithProfiles = async (parts: Participant[]): Promise<Participant[]> => {
    if (!parts.length) return parts;
    const userIds = parts.map(p => p.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", userIds);
    if (!profiles) return parts;
    return parts.map(p => {
      const profile = profiles.find(pr => pr.user_id === p.user_id);
      return {
        ...p,
        display_name: profile?.display_name || p.display_name || "Kullanıcı",
        avatar_url: profile?.avatar_url || null,
      };
    });
  };

  // ── Enter room ────────────────────────────────────────────────────────────────

  const enterRoom = useCallback(async (room: Room) => {
    if (!user) return;
    if (room.participant_count >= room.max_participants && room.owner_id !== user.id) {
      toast({ title: "Oda dolu", variant: "destructive" });
      return;
    }

    setMediaError(null);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localStreamRef.current = stream;
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(stream);
        localStreamRef.current = stream;
        setIsVideoOff(true);
        setMediaError("Kamera erişimi sağlanamadı, sadece sesle devam ediliyor.");
      } catch {
        setMediaError("Mikrofon/kamera erişimi reddedildi.");
        toast({ title: "Medya hatası", description: "İzinleri kontrol edin.", variant: "destructive" });
        return;
      }
    }

    // Remove any stale participant entry for this user in this room first
    await supabase.from("meeting_participants" as any).delete().eq("room_id", room.id).eq("user_id", user.id);

    // Claim room if empty
    const amOwner = !room.owner_id || room.owner_id === user.id;
    if (!room.owner_id) {
      await supabase.from("meeting_rooms" as any).update({ owner_id: user.id, owner_name: displayName }).eq("id", room.id);
    }

    // Insert participant with profile data
    const { data: pData } = await supabase
      .from("meeting_participants" as any)
      .insert({ room_id: room.id, user_id: user.id, display_name: displayName })
      .select()
      .single();

    if (pData) participantIdRef.current = (pData as any).id;

    // Recalculate participant count from DB
    const { count } = await supabase
      .from("meeting_participants" as any)
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id);

    await supabase.from("meeting_rooms" as any)
      .update({ participant_count: count ?? 1 })
      .eq("id", room.id);

    const finalRoom = { ...room, owner_id: amOwner ? user.id : room.owner_id, owner_name: amOwner ? displayName : room.owner_name };
    setIsOwner(amOwner);
    isOwnerRef.current = amOwner;
    setActiveRoom(finalRoom);
    activeRoomRef.current = finalRoom;

    // Heartbeat every 8s
    heartbeatRef.current = setInterval(async () => {
      if (participantIdRef.current) {
        await supabase.from("meeting_participants" as any).update({ last_heartbeat: new Date().toISOString() }).eq("id", participantIdRef.current);
      }
    }, 8000);

    // Cleanup stale participants every 30s
    cleanupRef.current = setInterval(async () => {
      const cutoff = new Date(Date.now() - 30000).toISOString();
      await supabase.from("meeting_participants" as any).delete().eq("room_id", room.id).lt("last_heartbeat", cutoff);
    }, 30000);

    setupSignaling(room.id, stream, amOwner);
    loadChatMessages(room.id);
    setupChatChannel(room.id);
  }, [user, displayName, toast]);

  // ── Chat ──────────────────────────────────────────────────────────────────────

  const loadChatMessages = async (roomId: string) => {
    const { data } = await supabase
      .from("chat_messages" as any)
      .select("*")
      .eq("channel_id", roomId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (data) setChatMessages(data as unknown as ChatMessage[]);
  };

  const setupChatChannel = (roomId: string) => {
    chatChannelRef.current = supabase
      .channel(`meeting-chat-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${roomId}` }, (payload) => {
        const msg = payload.new as ChatMessage;
        setChatMessages(prev => [...prev, msg]);
        if (!showChat) setUnreadChat(c => c + 1);
      })
      .subscribe();
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !activeRoom || !user) return;
    await supabase.from("chat_messages" as any).insert({
      user_id: user.id,
      channel_id: activeRoom.id,
      display_name: displayName,
      content: chatInput.trim(),
    });
    setChatInput("");
  };

  // ── WebRTC ────────────────────────────────────────────────────────────────────

  const createPeerConnection = useCallback((
    targetUserId: string, targetName: string, targetAvatar: string | null,
    stream: MediaStream | null, roomId: string, isInitiator: boolean,
  ) => {
    // Don't create duplicate connections
    const existing = peersRef.current.get(targetUserId);
    if (existing) { existing.pc.close(); }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));

    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
      setPeers(prev => {
        const next = new Map(prev);
        const p = next.get(targetUserId);
        if (p) next.set(targetUserId, { ...p, stream: remoteStream });
        return next;
      });
    };

    pc.onicecandidate = async (e) => {
      if (e.candidate && user) {
        await supabase.from("meeting_signals" as any).insert({
          room_id: roomId,
          from_user_id: user.id,
          to_user_id: targetUserId,
          signal_type: "ice",
          payload: { candidate: e.candidate },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setPeers(prev => {
          const next = new Map(prev);
          next.delete(targetUserId);
          return next;
        });
      }
    };

    const peerState: PeerState = {
      userId: targetUserId, displayName: targetName, avatarUrl: targetAvatar,
      stream: null, pc, isAudioMuted: false, isVideoOff: false, isAdminMuted: false, isAdminVideoOff: false,
    };

    setPeers(prev => { const n = new Map(prev); n.set(targetUserId, peerState); return n; });

    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true }).then(offer => {
        pc.setLocalDescription(offer).then(async () => {
          if (user) {
            await supabase.from("meeting_signals" as any).insert({
              room_id: roomId, from_user_id: user.id, to_user_id: targetUserId,
              signal_type: "offer", payload: { sdp: offer },
            });
          }
        });
      });
    }

    return pc;
  }, [user]);

  const setupSignaling = useCallback(async (roomId: string, stream: MediaStream | null, _amOwner: boolean) => {
    if (!user) return;

    // Load existing participants (excluding self)
    const { data: existing } = await supabase
      .from("meeting_participants" as any)
      .select("*")
      .eq("room_id", roomId)
      .neq("user_id", user.id);

    const enriched = await enrichParticipantsWithProfiles((existing as unknown as Participant[]) || []);
    setParticipants(enriched);

    // Create connections to all existing participants
    for (const p of enriched) {
      createPeerConnection(p.user_id, p.display_name || "Kullanıcı", p.avatar_url || null, stream, roomId, true);
    }

    // Listen for signals (only for this room + this user)
    const signalCh = supabase
      .channel(`signals-${roomId}-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "meeting_signals",
        filter: `to_user_id=eq.${user.id}`,
      }, async (payload) => {
        const signal = payload.new as any;
        // Isolate: ignore signals from other rooms
        if (signal.room_id !== roomId) return;

        const fromId = signal.from_user_id;
        let pc = peersRef.current.get(fromId)?.pc;

        if (!pc || pc.connectionState === "closed" || pc.connectionState === "failed") {
          // Get this user's name and avatar
          const { data: pProfile } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", fromId).single();
          const name = pProfile?.display_name || "Kullanıcı";
          const avatar = pProfile?.avatar_url || null;
          pc = createPeerConnection(fromId, name, avatar, stream, roomId, false);
        }

        if (signal.signal_type === "offer") {
          if (pc.signalingState !== "stable") return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await supabase.from("meeting_signals" as any).insert({
            room_id: roomId, from_user_id: user.id, to_user_id: fromId,
            signal_type: "answer", payload: { sdp: answer },
          });
        } else if (signal.signal_type === "answer") {
          if (pc.signalingState !== "have-local-offer") return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
        } else if (signal.signal_type === "ice") {
          try { await pc.addIceCandidate(new RTCIceCandidate(signal.payload.candidate)); } catch {}
        } else if (signal.signal_type === "admin_control") {
          // Received admin command → apply locally
          const payload_data = signal.payload as any;
          if (payload_data.kick && payload_data.target_user_id === user.id) {
            toast({ title: "Odadan çıkarıldınız", description: "Toplantı yöneticisi sizi odadan çıkardı.", variant: "destructive" });
            performLeave(false);
            return;
          }
          if (payload_data.owner_left) {
            toast({ title: "Yönetici odayı kapattı", description: "Toplantı sona erdi." });
            performLeave(false);
            return;
          }
          if (payload_data.isAdminMuted !== undefined) {
            // Update our local audio
            const localStreamNow = localStreamRef.current;
            if (localStreamNow) {
              localStreamNow.getAudioTracks().forEach(t => { t.enabled = !payload_data.isAdminMuted; });
            }
            if (participantIdRef.current) {
              await supabase.from("meeting_participants" as any).update({ is_admin_muted: payload_data.isAdminMuted }).eq("id", participantIdRef.current);
            }
          }
          if (payload_data.isAdminVideoOff !== undefined) {
            const localStreamNow = localStreamRef.current;
            if (localStreamNow) {
              localStreamNow.getVideoTracks().forEach(t => { t.enabled = !payload_data.isAdminVideoOff; });
            }
            if (participantIdRef.current) {
              await supabase.from("meeting_participants" as any).update({ is_admin_video_off: payload_data.isAdminVideoOff }).eq("id", participantIdRef.current);
            }
          }
        }
      })
      .subscribe();

    // Listen for participant changes in this room
    const participantCh = supabase
      .channel(`participants-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_participants", filter: `room_id=eq.${roomId}` }, async () => {
        const { data } = await supabase.from("meeting_participants" as any).select("*").eq("room_id", roomId).neq("user_id", user.id);
        const enriched2 = await enrichParticipantsWithProfiles((data as unknown as Participant[]) || []);
        setParticipants(enriched2);

        // Update room participant count
        const { count } = await supabase.from("meeting_participants" as any).select("*", { count: "exact", head: true }).eq("room_id", roomId);
        await supabase.from("meeting_rooms" as any).update({ participant_count: count ?? 0 }).eq("id", roomId);
      })
      .subscribe();

    signalChannelRef.current = signalCh;
    participantChannelRef.current = participantCh;
  }, [user, createPeerConnection]);

  // ── Leave room ────────────────────────────────────────────────────────────────

  const performLeave = useCallback(async (isInitiator = true) => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;

    const room = activeRoomRef.current;
    const amOwner = isOwnerRef.current;

    // Stop media
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    // Close peer connections
    peersRef.current.forEach(p => p.pc.close());
    setPeers(new Map());

    // Remove participant
    if (participantIdRef.current) {
      await supabase.from("meeting_participants" as any).delete().eq("id", participantIdRef.current);
      participantIdRef.current = null;
    }

    if (room) {
      if (amOwner && isInitiator) {
        // Kick all participants from this room
        const { data: allParts } = await supabase.from("meeting_participants" as any).select("user_id").eq("room_id", room.id);
        if (allParts && (allParts as any[]).length > 0) {
          for (const p of allParts as any[]) {
            await supabase.from("meeting_signals" as any).insert({
              room_id: room.id, from_user_id: user!.id, to_user_id: p.user_id,
              signal_type: "admin_control", payload: { owner_left: true },
            });
          }
        }
        // Delete all participants and reset room
        await supabase.from("meeting_participants" as any).delete().eq("room_id", room.id);
        await supabase.from("meeting_rooms" as any)
          .update({ owner_id: null, owner_name: null, is_locked: false, password: null, participant_count: 0 })
          .eq("id", room.id);
      } else {
        // Recalculate count
        const { count } = await supabase.from("meeting_participants" as any).select("*", { count: "exact", head: true }).eq("room_id", room.id);
        await supabase.from("meeting_rooms" as any).update({ participant_count: count ?? 0 }).eq("id", room.id);
      }
    }

    // Cleanup channels and intervals
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (cleanupRef.current) clearInterval(cleanupRef.current);
    if (signalChannelRef.current) supabase.removeChannel(signalChannelRef.current);
    if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current);
    if (participantChannelRef.current) supabase.removeChannel(participantChannelRef.current);

    setActiveRoom(null);
    activeRoomRef.current = null;
    setIsOwner(false);
    isOwnerRef.current = false;
    setParticipants([]);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setChatMessages([]);
    setUnreadChat(0);
    setShowChat(false);
    isLeavingRef.current = false;
    loadRooms();
  }, [user, loadRooms]);

  const leaveRoom = useCallback(() => performLeave(true), [performLeave]);

  // ── Media controls ────────────────────────────────────────────────────────────

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const newMuted = !isAudioMuted;
    stream.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setIsAudioMuted(newMuted);
    if (participantIdRef.current) {
      supabase.from("meeting_participants" as any).update({ is_audio_muted: newMuted }).eq("id", participantIdRef.current);
    }
  }, [isAudioMuted]);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const newOff = !isVideoOff;
    stream.getVideoTracks().forEach(t => { t.enabled = !newOff; });
    setIsVideoOff(newOff);
    if (participantIdRef.current) {
      supabase.from("meeting_participants" as any).update({ is_video_off: newOff }).eq("id", participantIdRef.current);
    }
  }, [isVideoOff]);

  // ── Admin controls ────────────────────────────────────────────────────────────

  const adminMute = async (targetUserId: string, currentlyMuted: boolean) => {
    if (!isOwner || !activeRoom || !user) return;
    const newMuted = !currentlyMuted;
    await supabase.from("meeting_signals" as any).insert({
      room_id: activeRoom.id, from_user_id: user.id, to_user_id: targetUserId,
      signal_type: "admin_control", payload: { isAdminMuted: newMuted },
    });
    await supabase.from("meeting_participants" as any).update({ is_admin_muted: newMuted }).eq("user_id", targetUserId).eq("room_id", activeRoom.id);
  };

  const adminVideoOff = async (targetUserId: string, currentlyOff: boolean) => {
    if (!isOwner || !activeRoom || !user) return;
    const newOff = !currentlyOff;
    await supabase.from("meeting_signals" as any).insert({
      room_id: activeRoom.id, from_user_id: user.id, to_user_id: targetUserId,
      signal_type: "admin_control", payload: { isAdminVideoOff: newOff },
    });
    await supabase.from("meeting_participants" as any).update({ is_admin_video_off: newOff }).eq("user_id", targetUserId).eq("room_id", activeRoom.id);
  };

  const adminKick = async (targetUserId: string) => {
    if (!isOwner || !activeRoom || !user) return;
    await supabase.from("meeting_signals" as any).insert({
      room_id: activeRoom.id, from_user_id: user.id, to_user_id: targetUserId,
      signal_type: "admin_control", payload: { kick: true, target_user_id: targetUserId },
    });
    // Remove from participants
    await supabase.from("meeting_participants" as any).delete().eq("user_id", targetUserId).eq("room_id", activeRoom.id);
    toast({ title: "Kullanıcı odadan çıkarıldı" });
  };

  const lockRoom = async () => {
    if (!isOwner || !activeRoom) return;
    if (activeRoom.is_locked) {
      await supabase.from("meeting_rooms" as any).update({ is_locked: false, password: null }).eq("id", activeRoom.id);
      setActiveRoom({ ...activeRoom, is_locked: false });
      toast({ title: "Oda kilidi kaldırıldı" });
    } else {
      setNewRoomPassword("");
      setShowLockDialog(true);
    }
  };

  const confirmLock = async () => {
    if (!activeRoom || !newRoomPassword.trim()) return;
    await supabase.from("meeting_rooms" as any).update({ is_locked: true, password: newRoomPassword }).eq("id", activeRoom.id);
    setActiveRoom({ ...activeRoom, is_locked: true });
    setShowLockDialog(false);
    toast({ title: "Oda şifrelendi" });
  };

  // ── Cleanup on unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (activeRoomRef.current) performLeave(true);
    };
  }, []); // eslint-disable-line

  // ── Chat scroll ───────────────────────────────────────────────────────────────

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Room list
  // ─────────────────────────────────────────────────────────────────────────────

  if (!activeRoom) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Canlı Toplantı</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Bir odaya katılın veya boş oda açın</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadRooms}>
            <RefreshCw className="w-4 h-4 mr-2" />Yenile
          </Button>
        </div>

        {mediaError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{mediaError}
          </div>
        )}

        {roomsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-40" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {rooms.map(room => <RoomCard key={room.id} room={room} onJoin={handleJoinAttempt} currentUserId={user?.id || ""} />)}
          </div>
        )}

        {/* Password dialog */}
        {showPasswordDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-foreground">Şifreli Oda</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                <strong className="text-foreground">{pendingRoom?.name}</strong> için şifre gereklidir.
              </p>
              <Input
                type="password" placeholder="Oda şifresini girin"
                value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handlePasswordSubmit()}
                className="mb-4"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPasswordDialog(false)}>İptal</Button>
                <Button className="flex-1" onClick={handlePasswordSubmit}>Katıl</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Active meeting
  // ─────────────────────────────────────────────────────────────────────────────

  const allPeers = Array.from(peers.values());
  const totalParticipants = allPeers.length + 1;

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-220px)] min-h-[600px]">
      {/* Room header */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" />
          <span className="font-bold text-foreground">{activeRoom.name}</span>
          {isOwner && <Crown className="w-4 h-4 text-yellow-400" />}
          {activeRoom.is_locked && <Lock className="w-3 h-3 text-amber-400" />}
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
            <Users className="w-3 h-3" />{totalParticipants}/{activeRoom.max_participants}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button size="sm" variant="outline" className={`h-7 px-2.5 text-xs ${activeRoom.is_locked ? "border-amber-500/40 text-amber-400" : ""}`} onClick={lockRoom}>
              {activeRoom.is_locked ? <><Unlock className="w-3 h-3 mr-1" />Kilidi Kaldır</> : <><Lock className="w-3 h-3 mr-1" />Kilitle</>}
            </Button>
          )}
          <Button
            size="sm" variant="outline"
            className={`h-7 px-2.5 text-xs relative ${unreadChat > 0 ? "border-primary text-primary" : ""}`}
            onClick={() => { setShowChat(!showChat); setUnreadChat(0); }}
          >
            <MessageSquare className="w-3 h-3 mr-1" />Sohbet
            {unreadChat > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[9px] flex items-center justify-center font-bold">
                {unreadChat}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Video grid */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div
            className="flex-1 overflow-auto"
            style={{ display: "grid", gap: "12px",
              gridTemplateColumns: totalParticipants === 1 ? "1fr" : totalParticipants === 2 ? "1fr 1fr" : totalParticipants <= 4 ? "repeat(2,1fr)" : totalParticipants <= 9 ? "repeat(3,1fr)" : "repeat(4,1fr)",
              alignContent: "start",
            }}
          >
            {/* Local tile */}
            <VideoTile
              stream={localStream} name={displayName} avatarUrl={myProfile.avatar_url}
              isLocal={true} isMuted={isAudioMuted} isVideoOff={isVideoOff} isOwner={isOwner}
            />
            {/* Remote tiles */}
            {allPeers.map(peer => (
              <VideoTile
                key={peer.userId}
                stream={peer.stream} name={peer.displayName} avatarUrl={peer.avatarUrl}
                isLocal={false} isMuted={peer.isAudioMuted} isVideoOff={peer.isVideoOff}
                isAdminMuted={peer.isAdminMuted} isAdminVideoOff={peer.isAdminVideoOff}
                isOwner={activeRoom.owner_id === peer.userId}
                onKick={isOwner && activeRoom.owner_id !== peer.userId ? () => adminKick(peer.userId) : undefined}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl py-3 flex-shrink-0">
            <Button
              size="icon" variant={isAudioMuted ? "destructive" : "outline"} className="w-11 h-11 rounded-full"
              onClick={toggleAudio} title={isAudioMuted ? "Mikrofonu Aç" : "Mikrofonu Kapat"}
            >
              {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            <Button
              size="icon" variant={isVideoOff ? "destructive" : "outline"} className="w-11 h-11 rounded-full"
              onClick={toggleVideo} title={isVideoOff ? "Kamerayı Aç" : "Kamerayı Kapat"}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>
            <Button
              size="icon" variant="destructive" className="w-12 h-12 rounded-full"
              onClick={leaveRoom} title="Toplantıdan Ayrıl"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Right panel: participants + chat */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-3">
          {/* Participants */}
          <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden" style={{ maxHeight: showChat ? "45%" : "100%" }}>
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 flex-shrink-0">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">Katılımcılar</span>
              <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{totalParticipants}</span>
            </div>
            <div className="overflow-y-auto divide-y divide-border/50">
              {/* Self */}
              <div className="px-3 py-2 flex items-center gap-2">
                {myProfile.avatar_url ? (
                  <img src={myProfile.avatar_url} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt={displayName} />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{displayName.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{displayName} <span className="text-muted-foreground">(Sen)</span></p>
                  {isOwner && <p className="text-[10px] text-yellow-400 flex items-center gap-1"><Crown className="w-2.5 h-2.5" />Yönetici</p>}
                </div>
                <div className="flex gap-1">
                  {isAudioMuted && <MicOff className="w-3 h-3 text-red-400" />}
                  {isVideoOff && <VideoOff className="w-3 h-3 text-red-400" />}
                </div>
              </div>

              {/* Others */}
              {participants.map(p => {
                const peer = peers.get(p.user_id);
                return (
                  <div key={p.id} className="px-3 py-2 flex items-center gap-2 group">
                    {(p as any).avatar_url ? (
                      <img src={(p as any).avatar_url} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt={p.display_name || ""} />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-muted-foreground">{(p.display_name || "K").charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{p.display_name || "Kullanıcı"}</p>
                      {activeRoom.owner_id === p.user_id && <p className="text-[10px] text-yellow-400 flex items-center gap-1"><Crown className="w-2.5 h-2.5" />Yönetici</p>}
                    </div>
                    <div className="flex items-center gap-0.5">
                      {(p.is_audio_muted || p.is_admin_muted || peer?.isAdminMuted) && <MicOff className="w-3 h-3 text-red-400" />}
                      {(p.is_video_off || p.is_admin_video_off || peer?.isAdminVideoOff) && <VideoOff className="w-3 h-3 text-red-400" />}
                      {isOwner && activeRoom.owner_id !== p.user_id && (
                        <div className="flex gap-0.5 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="w-5 h-5 rounded hover:bg-muted flex items-center justify-center" title={p.is_admin_muted ? "Sesi Aç" : "Sesi Kapat"} onClick={() => adminMute(p.user_id, p.is_admin_muted)}>
                            {p.is_admin_muted ? <Volume2 className="w-3 h-3 text-emerald-400" /> : <VolumeX className="w-3 h-3 text-muted-foreground" />}
                          </button>
                          <button className="w-5 h-5 rounded hover:bg-muted flex items-center justify-center" title={p.is_admin_video_off ? "Kamerayı Aç" : "Kamerayı Kapat"} onClick={() => adminVideoOff(p.user_id, p.is_admin_video_off)}>
                            {p.is_admin_video_off ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                          </button>
                          <button className="w-5 h-5 rounded hover:bg-red-500/20 flex items-center justify-center" title="Odadan Çıkar" onClick={() => adminKick(p.user_id)}>
                            <X className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat panel */}
          {showChat && (
            <div className="bg-card border border-border rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm text-foreground">Toplantı Sohbeti</span>
                <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setShowChat(false)}><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
                {chatMessages.length === 0 ? (
                  <p className="text-center text-muted-foreground pt-4">Henüz mesaj yok</p>
                ) : chatMessages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.user_id === user?.id ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-muted-foreground mb-0.5">{msg.display_name}</span>
                    <div className={`px-2.5 py-1.5 rounded-xl max-w-[90%] break-words ${msg.user_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-2 border-t border-border flex gap-2 flex-shrink-0">
                <Input
                  value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChatMessage()}
                  placeholder="Mesaj yaz..." className="h-8 text-xs"
                />
                <Button size="icon" className="h-8 w-8 flex-shrink-0" onClick={sendChatMessage}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lock dialog */}
      {showLockDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-foreground">Odayı Şifrele</h3>
            </div>
            <Input
              type="text" placeholder="Oda şifresini belirleyin"
              value={newRoomPassword} onChange={e => setNewRoomPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmLock()}
              className="mb-4"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowLockDialog(false)}>İptal</Button>
              <Button className="flex-1" onClick={confirmLock}>Kilitle</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMeetingModule;
