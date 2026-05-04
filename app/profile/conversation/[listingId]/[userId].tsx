import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import GradientScreen from "@/components/GradientScreen";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

function timeLabel(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ConversationDetail() {
  const { listingId, userId: otherUserId } = useLocalSearchParams<{ listingId: string; userId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [otherUsername, setOtherUsername] = useState("User");
  const flatRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    if (!user || !listingId || !otherUserId) return;
    const { data } = await (supabase as any)
      .from("marketplace_messages")
      .select("id,sender_id,content,created_at,read_at")
      .eq("listing_id", listingId)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
    setLoading(false);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);

    await (supabase as any).from("marketplace_messages").update({ read_at: new Date().toISOString() })
      .eq("receiver_id", user.id).eq("listing_id", listingId).is("read_at", null);
  }, [user, listingId, otherUserId]);

  useEffect(() => {
    fetchMessages();
    (async () => {
      const { data } = await (supabase as any).from("profiles").select("username").eq("id", otherUserId).single();
      if (data?.username) setOtherUsername(data.username);
    })();

    const channel = supabase.channel(`conversation-${listingId}-${otherUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "marketplace_messages" }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchMessages]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !user || !listingId || !otherUserId) return;
    setSending(true);
    await (supabase as any).from("marketplace_messages").insert([{
      listing_id: listingId,
      sender_id: user.id,
      receiver_id: otherUserId,
      content: newMsg.trim(),
    }]);
    setNewMsg("");
    setSending(false);
    fetchMessages();
  };

  return (
    <GradientScreen gradient="profile">
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.username}>{otherUsername}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        {loading ? <ActivityIndicator color="#a78bfa" style={{ marginTop: 48 }} /> : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            renderItem={({ item }) => {
              const isMine = item.sender_id === user?.id;
              return (
                <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleOther]}>
                  <View style={[s.bubbleInner, isMine ? s.bubbleInnerMine : s.bubbleInnerOther]}>
                    <Text style={{ color: "#fff" }}>{item.content}</Text>
                  </View>
                  <Text style={s.timeLabel}>{timeLabel(item.created_at)}</Text>
                </View>
              );
            }}
          />
        )}

        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="Type a message..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={newMsg}
            onChangeText={setNewMsg}
            multiline
          />
          <TouchableOpacity style={[s.sendBtn, (!newMsg.trim() || sending) && { opacity: 0.5 }]} onPress={sendMessage} disabled={sending || !newMsg.trim()}>
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.sendIcon}>↑</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </GradientScreen>
  );
}

const s = StyleSheet.create({
  navBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)", gap: 12 },
  back: { color: "#a78bfa", fontSize: 16 },
  username: { color: "#fff", fontWeight: "700", fontSize: 16 },
  bubble: { marginBottom: 12 },
  bubbleMine: { alignItems: "flex-end" },
  bubbleOther: { alignItems: "flex-start" },
  bubbleInner: { maxWidth: "80%", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18 },
  bubbleInnerMine: { backgroundColor: "#a78bfa", borderBottomRightRadius: 4 },
  bubbleInnerOther: { backgroundColor: "rgba(255,255,255,0.15)", borderBottomLeftRadius: 4 },
  timeLabel: { color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 3 },
  inputBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", gap: 10 },
  input: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: "#fff", fontSize: 14 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#a78bfa", alignItems: "center", justifyContent: "center" },
  sendIcon: { color: "#fff", fontSize: 18 },
});
