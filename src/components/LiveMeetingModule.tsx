import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Users, Lock, Unlock,
  LogIn, Shield, VolumeX, Volume2, Settings, RefreshCw, Crown,
  Eye, EyeOff, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Room {
  id: string;
  name: string;
  room_number: number;
  owner_id: string | null;
  owner_name: string | null;
  is_locked: boolean;
  participant_count: number;
  max_participants: number;
}

interface Participant {
  id: string;
  user_id: string;
  display_name: string | null;
  is_audio_muted: boolean;
  is_video_off: boolean;
  is_admin_muted: boolean;
  is_admin_video_off: boolean;
}

interface PeerState {
  userId: string;
  displayName: string;
  stream: MediaStream | null;
  pc: RTCPeerConnection;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isAdminMuted: boolean;
  isAdminVideoOff: boolean;
}

// ─── ICE Config ──────────────────────────────────────────────────────────────

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// ─── VideoTile ────────────────────────────────────────────────────────────────

const VideoTile = ({
  stream,
  name,
  isLocal,
  isMuted,
  isVideoOff,
  isAdminMuted,
  isAdminVideoOff,
  isOwner,
}: {
  stream: MediaStream | null;
  name: string;
  isLocal: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isAdminMuted?: boolean;
  isAdminVideoOff?: boolean;
  isOwner?: boolean;
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
    <div className="relative rounded-xl overflow-hidden bg-muted/50 border border-border aspect-video flex items-center justify-center">
      {!videoHidden && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center">
            <span className="text-xl font-bold text-primary">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Kamera kapalı</span>
        </div>
      )}

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isOwner && <Crown className="w-3 h-3 text-yellow-400" />}
          <span className="text-xs text-white font-medium truncate max-w-[100px]">
            {isLocal ? `${name} (Sen)` : name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(audioMuted) && <MicOff className="w-3 h-3 text-red-400" />}
          {(videoHidden) && <VideoOff className="w-3 h-3 text-red-400" />}
        </div>
      </div>
    </div>
  );
};

// ─── Room Card ────────────────────────────────────────────────────────────────

const RoomCard = ({
  room,
  onJoin,
  currentUserId,
}: {
  room: Room;
  onJoin: (room: Room) => void;
  currentUserId: string;
}) => {
  const isFull = room.participant_count >= room.max_participants;
  const isOwner = room.owner_id === currentUserId;

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
              <Lock className="w-3 h-3" />
              Şifreli
            </span>
          )}
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
            <Users className="w-3 h-3" />
            {room.participant_count}/{room.max_participants}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${
            isFull ? "bg-red-500" : room.participant_count > 0 ? "bg-emerald-500" : "bg-muted-foreground/20"
          }`}
          style={{ width: `${(room.participant_count / room.max_participants) * 100}%` }}
        />
      </div>

      <Button
        size="sm"
        disabled={isFull}
        onClick={() => onJoin(room)}
        className="w-full"
        variant={room.participant_count === 0 ? "default" : "outline"}
      >
        <LogIn className="w-4 h-4 mr-2" />
        {isFull ? "Oda Dolu" : isOwner ? "Odana Geri Dön" : room.participant_count === 0 ? "Oda Aç" : "Katıl"}
      </Button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const LiveMeetingModule = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Room list state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  // Meeting state
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());

  // Local media
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // UI state
  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState("");
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [pendingRoom, setPendingRoom] = useState<Room | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const signalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const participantIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  peersRef.current = peers;

  const displayName = user
    ? (user as any).user_metadata?.display_name || user.email?.split("@")[0] || "Kullanıcı"
    : "Misafir";

  // ── Load rooms ──────────────────────────────────────────────────────────────

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
    const channel = supabase
      .channel("meeting-rooms-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_rooms" }, () => {
        loadRooms();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadRooms]);

  // ── Join room flow ──────────────────────────────────────────────────────────

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
    // Simple password check (stored as plaintext for internal tool)
    if (passwordInput !== (pendingRoom as any).password) {
      toast({ title: "Yanlış şifre", description: "Lütfen tekrar deneyin.", variant: "destructive" });
      return;
    }
    setShowPasswordDialog(false);
    enterRoom(pendingRoom);
  };

  // ── Enter room ──────────────────────────────────────────────────────────────

  const enterRoom = useCallback(async (room: Room) => {
    if (!user) return;

    // Check capacity
    if (room.participant_count >= room.max_participants && room.owner_id !== user.id) {
      toast({ title: "Oda dolu", description: "Bu oda maksimum kapasiteye ulaştı.", variant: "destructive" });
      return;
    }

    setMediaError(null);

    // Get media
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
    } catch (e) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(stream);
        setIsVideoOff(true);
        setMediaError("Kamera erişimi sağlanamadı, sadece ses ile devam ediliyor.");
      } catch {
        setMediaError("Mikrofon/kamera erişimi reddedildi. Tarayıcı izinlerini kontrol edin.");
        toast({ title: "Medya hatası", description: "Kamera/mikrofon erişimi sağlanamadı.", variant: "destructive" });
        return;
      }
    }

    // Claim room if empty
    const amOwner = !room.owner_id || room.owner_id === user.id;
    if (!room.owner_id) {
      await supabase
        .from("meeting_rooms" as any)
        .update({ owner_id: user.id, owner_name: displayName })
        .eq("id", room.id);
    }

    // Insert participant
    const { data: participantData } = await supabase
      .from("meeting_participants" as any)
      .insert({
        room_id: room.id,
        user_id: user.id,
        display_name: displayName,
      })
      .select()
      .single();

    if (participantData) {
      participantIdRef.current = (participantData as any).id;
    }

    // Update participant count
    await supabase
      .from("meeting_rooms" as any)
      .update({ participant_count: room.participant_count + 1 })
      .eq("id", room.id);

    setIsOwner(amOwner);
    setActiveRoom({ ...room, owner_id: amOwner ? user.id : room.owner_id, owner_name: amOwner ? displayName : room.owner_name });

    // Start heartbeat
    heartbeatRef.current = setInterval(async () => {
      if (participantIdRef.current) {
        await supabase
          .from("meeting_participants" as any)
          .update({ last_heartbeat: new Date().toISOString() })
          .eq("id", participantIdRef.current);
      }
    }, 10000);

    // Setup signaling
    setupSignaling(room.id, stream, amOwner);
  }, [user, displayName, toast]);

  // ── WebRTC Signaling ────────────────────────────────────────────────────────

  const createPeerConnection = useCallback((
    targetUserId: string,
    targetName: string,
    stream: MediaStream | null,
    roomId: string,
    isInitiator: boolean,
  ) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    const peerState: PeerState = {
      userId: targetUserId,
      displayName: targetName,
      stream: null,
      pc,
      isAudioMuted: false,
      isVideoOff: false,
      isAdminMuted: false,
      isAdminVideoOff: false,
    };

    // On remote stream
    pc.ontrack = (event) => {
      setPeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(targetUserId);
        if (existing) {
          next.set(targetUserId, { ...existing, stream: event.streams[0] });
        }
        return next;
      });
    };

    // On ICE candidate
    pc.onicecandidate = async (event) => {
      if (event.candidate && user) {
        await supabase.from("meeting_signals" as any).insert({
          room_id: roomId,
          from_user_id: user.id,
          to_user_id: targetUserId,
          signal_type: "ice",
          payload: { candidate: event.candidate },
        });
      }
    };

    // Initiate offer
    if (isInitiator) {
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer).then(async () => {
          if (user) {
            await supabase.from("meeting_signals" as any).insert({
              room_id: roomId,
              from_user_id: user.id,
              to_user_id: targetUserId,
              signal_type: "offer",
              payload: { sdp: offer },
            });
          }
        });
      });
    }

    setPeers((prev) => {
      const next = new Map(prev);
      next.set(targetUserId, peerState);
      return next;
    });

    return pc;
  }, [user]);

  const setupSignaling = useCallback(async (roomId: string, stream: MediaStream | null, amOwner: boolean) => {
    if (!user) return;

    // Load existing participants
    const { data: existingParticipants } = await supabase
      .from("meeting_participants" as any)
      .select("*")
      .eq("room_id", roomId)
      .neq("user_id", user.id);

    setParticipants((existingParticipants as unknown as Participant[]) || []);

    // Create peer connections for existing participants (we are initiator)
    if (existingParticipants) {
      for (const p of existingParticipants as unknown as Participant[]) {
        createPeerConnection(p.user_id, p.display_name || "Kullanıcı", stream, roomId, true);
      }
    }

    // Subscribe to signals
    const signalChannel = supabase
      .channel(`room-signals-${roomId}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "meeting_signals",
          filter: `to_user_id=eq.${user.id}`,
        },
        async (payload) => {
          const signal = payload.new as any;
          if (signal.room_id !== roomId) return;

          const fromUserId = signal.from_user_id;
          let pc = peersRef.current.get(fromUserId)?.pc;

          if (!pc) {
            // New participant joined → create peer (they are initiator, we answer)
            pc = createPeerConnection(fromUserId, "Kullanıcı", stream, roomId, false);
          }

          if (signal.signal_type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await supabase.from("meeting_signals" as any).insert({
              room_id: roomId,
              from_user_id: user.id,
              to_user_id: fromUserId,
              signal_type: "answer",
              payload: { sdp: answer },
            });
          } else if (signal.signal_type === "answer") {
            if (pc.signalingState !== "have-local-offer") return;
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
          } else if (signal.signal_type === "ice") {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.payload.candidate));
            } catch {}
          } else if (signal.signal_type === "admin_control") {
            setPeers((prev) => {
              const next = new Map(prev);
              const p = next.get(fromUserId);
              if (p) next.set(fromUserId, { ...p, ...signal.payload });
              return next;
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_participants", filter: `room_id=eq.${roomId}` },
        () => {
          loadRoomParticipants(roomId);
        }
      )
      .subscribe();

    signalChannelRef.current = signalChannel;
  }, [user, createPeerConnection]);

  const loadRoomParticipants = async (roomId: string) => {
    const { data } = await supabase
      .from("meeting_participants" as any)
      .select("*")
      .eq("room_id", roomId);
    if (data) setParticipants(data as unknown as Participant[]);
  };

  // ── Leave room ──────────────────────────────────────────────────────────────

  const leaveRoom = useCallback(async () => {
    if (!user || !activeRoom) return;

    // Stop local stream
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);

    // Close all peer connections
    peersRef.current.forEach((p) => p.pc.close());
    setPeers(new Map());

    // Remove participant
    if (participantIdRef.current) {
      await supabase
        .from("meeting_participants" as any)
        .delete()
        .eq("id", participantIdRef.current);
      participantIdRef.current = null;
    }

    // Update room
    const newCount = Math.max(0, activeRoom.participant_count - 1);
    if (isOwner) {
      // Release ownership
      await supabase
        .from("meeting_rooms" as any)
        .update({ owner_id: null, owner_name: null, is_locked: false, password: null, participant_count: newCount })
        .eq("id", activeRoom.id);
    } else {
      await supabase
        .from("meeting_rooms" as any)
        .update({ participant_count: newCount })
        .eq("id", activeRoom.id);
    }

    // Cleanup
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (signalChannelRef.current) supabase.removeChannel(signalChannelRef.current);

    setActiveRoom(null);
    setIsOwner(false);
    setParticipants([]);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    loadRooms();
  }, [user, activeRoom, localStream, isOwner, loadRooms]);

  // ── Local media controls ────────────────────────────────────────────────────

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => { t.enabled = isAudioMuted; });
      setIsAudioMuted(!isAudioMuted);
      if (participantIdRef.current) {
        supabase.from("meeting_participants" as any).update({ is_audio_muted: !isAudioMuted }).eq("id", participantIdRef.current);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => { t.enabled = isVideoOff; });
      setIsVideoOff(!isVideoOff);
      if (participantIdRef.current) {
        supabase.from("meeting_participants" as any).update({ is_video_off: !isVideoOff }).eq("id", participantIdRef.current);
      }
    }
  };

  // ── Admin controls ──────────────────────────────────────────────────────────

  const adminToggleMute = async (targetUserId: string, currentlyMuted: boolean) => {
    if (!isOwner || !activeRoom || !user) return;
    const newMuted = !currentlyMuted;
    await supabase
      .from("meeting_participants" as any)
      .update({ is_admin_muted: newMuted })
      .eq("user_id", targetUserId)
      .eq("room_id", activeRoom.id);

    await supabase.from("meeting_signals" as any).insert({
      room_id: activeRoom.id,
      from_user_id: user.id,
      to_user_id: targetUserId,
      signal_type: "admin_control",
      payload: { isAdminMuted: newMuted },
    });
  };

  const adminToggleVideo = async (targetUserId: string, currentlyOff: boolean) => {
    if (!isOwner || !activeRoom || !user) return;
    const newOff = !currentlyOff;
    await supabase
      .from("meeting_participants" as any)
      .update({ is_admin_video_off: newOff })
      .eq("user_id", targetUserId)
      .eq("room_id", activeRoom.id);

    await supabase.from("meeting_signals" as any).insert({
      room_id: activeRoom.id,
      from_user_id: user.id,
      to_user_id: targetUserId,
      signal_type: "admin_control",
      payload: { isAdminVideoOff: newOff },
    });
  };

  const lockRoom = async () => {
    if (!isOwner || !activeRoom) return;
    if (activeRoom.is_locked) {
      // Unlock
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

  // ── Cleanup on unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (activeRoom) leaveRoom();
    };
  }, []);

  // ── Render: Room list ───────────────────────────────────────────────────────

  if (!activeRoom) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Canlı Toplantı</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Bir odaya katılın veya boş oda açın</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadRooms}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Yenile
          </Button>
        </div>

        {mediaError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {mediaError}
          </div>
        )}

        {roomsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-36" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} onJoin={handleJoinAttempt} currentUserId={user?.id || ""} />
            ))}
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
                type="password"
                placeholder="Oda şifresini girin"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
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

  // ── Render: Meeting room ────────────────────────────────────────────────────

  const allPeers = Array.from(peers.values());
  const allParticipantsInRoom = participants.filter(p => p.user_id !== user?.id);

  return (
    <div className="flex gap-4 h-[calc(100vh-240px)] min-h-[600px]">
      {/* Main video area */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Room header */}
        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">{activeRoom.name}</span>
            {isOwner && <Crown className="w-4 h-4 text-yellow-400" />}
            {activeRoom.is_locked && <Lock className="w-3 h-3 text-amber-400" />}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
              <Users className="w-3 h-3" />
              {allPeers.length + 1}/{activeRoom.max_participants}
            </span>
            {isOwner && (
              <Button
                size="sm"
                variant="outline"
                className={`h-7 px-2 text-xs ${activeRoom.is_locked ? "border-amber-500/40 text-amber-400" : ""}`}
                onClick={lockRoom}
              >
                {activeRoom.is_locked ? <Unlock className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                {activeRoom.is_locked ? "Kilidi Kaldır" : "Kilitle"}
              </Button>
            )}
          </div>
        </div>

        {/* Video grid */}
        <div className="flex-1 overflow-auto">
          <div
            className="grid gap-3 h-full"
            style={{
              gridTemplateColumns: allPeers.length === 0
                ? "1fr"
                : allPeers.length === 1
                ? "1fr 1fr"
                : allPeers.length <= 3
                ? "repeat(2, 1fr)"
                : allPeers.length <= 8
                ? "repeat(3, 1fr)"
                : "repeat(4, 1fr)",
            }}
          >
            {/* Local video */}
            <VideoTile
              stream={localStream}
              name={displayName}
              isLocal={true}
              isMuted={isAudioMuted}
              isVideoOff={isVideoOff}
              isOwner={isOwner}
            />
            {/* Remote peers */}
            {allPeers.map((peer) => (
              <VideoTile
                key={peer.userId}
                stream={peer.stream}
                name={peer.displayName}
                isLocal={false}
                isMuted={peer.isAudioMuted}
                isVideoOff={peer.isVideoOff}
                isAdminMuted={peer.isAdminMuted}
                isAdminVideoOff={peer.isAdminVideoOff}
                isOwner={activeRoom.owner_id === peer.userId}
              />
            ))}
          </div>
        </div>

        {/* Controls bar */}
        <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl py-3">
          <Button
            size="icon"
            variant={isAudioMuted ? "destructive" : "outline"}
            className="w-11 h-11 rounded-full"
            onClick={toggleAudio}
            title={isAudioMuted ? "Mikrofonu Aç" : "Mikrofonu Kapat"}
          >
            {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
          <Button
            size="icon"
            variant={isVideoOff ? "destructive" : "outline"}
            className="w-11 h-11 rounded-full"
            onClick={toggleVideo}
            title={isVideoOff ? "Kamerayı Aç" : "Kamerayı Kapat"}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="w-12 h-12 rounded-full"
            onClick={leaveRoom}
            title="Toplantıdan Ayrıl"
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Side panel: participants */}
      <div className="w-64 flex-shrink-0 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Katılımcılar</span>
          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {allPeers.length + 1}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {/* Self */}
          <div className="px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">{displayName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{displayName} (Sen)</p>
              {isOwner && <p className="text-xs text-yellow-400 flex items-center gap-1"><Crown className="w-2.5 h-2.5" />Yönetici</p>}
            </div>
            <div className="flex gap-1">
              {isAudioMuted && <MicOff className="w-3 h-3 text-red-400" />}
              {isVideoOff && <VideoOff className="w-3 h-3 text-red-400" />}
            </div>
          </div>

          {/* Other participants from DB (includes those without WebRTC yet) */}
          {allParticipantsInRoom.map((participant) => {
            const peerState = peers.get(participant.user_id);
            return (
              <div key={participant.id} className="px-3 py-2.5 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-muted-foreground">
                    {(participant.display_name || "K").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{participant.display_name || "Kullanıcı"}</p>
                  {activeRoom.owner_id === participant.user_id && (
                    <p className="text-xs text-yellow-400 flex items-center gap-1"><Crown className="w-2.5 h-2.5" />Yönetici</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {(peerState?.isAudioMuted || peerState?.isAdminMuted || participant.is_audio_muted || participant.is_admin_muted) && (
                    <MicOff className="w-3 h-3 text-red-400" />
                  )}
                  {(peerState?.isVideoOff || peerState?.isAdminVideoOff || participant.is_video_off || participant.is_admin_video_off) && (
                    <VideoOff className="w-3 h-3 text-red-400" />
                  )}
                  {/* Admin controls */}
                  {isOwner && activeRoom.owner_id !== participant.user_id && (
                    <div className="flex gap-0.5 ml-1">
                      <button
                        className="w-5 h-5 rounded hover:bg-muted flex items-center justify-center transition-colors"
                        title={participant.is_admin_muted ? "Sesi Aç" : "Sesi Kapat"}
                        onClick={() => adminToggleMute(participant.user_id, participant.is_admin_muted)}
                      >
                        {participant.is_admin_muted
                          ? <Volume2 className="w-3 h-3 text-emerald-400" />
                          : <VolumeX className="w-3 h-3 text-muted-foreground hover:text-red-400" />
                        }
                      </button>
                      <button
                        className="w-5 h-5 rounded hover:bg-muted flex items-center justify-center transition-colors"
                        title={participant.is_admin_video_off ? "Kamerayı Aç" : "Kamerayı Kapat"}
                        onClick={() => adminToggleVideo(participant.user_id, participant.is_admin_video_off)}
                      >
                        {participant.is_admin_video_off
                          ? <Eye className="w-3 h-3 text-emerald-400" />
                          : <EyeOff className="w-3 h-3 text-muted-foreground hover:text-red-400" />
                        }
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lock dialog */}
      {showLockDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-foreground">Odayı Kilitle</h3>
            </div>
            <Input
              type="password"
              placeholder="Oda şifresi belirle"
              value={newRoomPassword}
              onChange={(e) => setNewRoomPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmLock()}
              className="mb-4"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowLockDialog(false)}>İptal</Button>
              <Button className="flex-1" onClick={confirmLock} disabled={!newRoomPassword.trim()}>
                <Lock className="w-4 h-4 mr-2" />
                Kilitle
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMeetingModule;
