import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";

interface Message {
  id: string;
  listing_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  marketplace_listings?: { title: string; type: string } | null;
  sender?: { username: string | null } | null;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Messages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("marketplace_messages")
      .select("*, marketplace_listings(title,type), sender:sender_id(username)")
      .eq("receiver_id", user.id)
      .order("created_at", { ascending: false });
    setMessages(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <GradientScreen gradient="profile">
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Messages</Text>
      </View>
      {loading ? <ActivityIndicator color="#a78bfa" style={{ marginTop: 48 }} /> : (
        <FlatList
          data={messages}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={s.empty}>No messages yet</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/profile/conversation/${item.listing_id}/${item.sender_id}` as any)}
              activeOpacity={0.75}
            >
              <GlassRow style={[s.card, !item.read_at && s.cardUnread]}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {!item.read_at ? <View style={s.unreadDot} /> : null}
                    <Text style={s.cardTitle}>{item.sender?.username ?? "Anonymous"}</Text>
                  </View>
                  <Text style={s.cardMeta}>{timeAgo(item.created_at)}</Text>
                </View>
                {item.marketplace_listings?.title ? <Text style={s.cardSub}>Re: {item.marketplace_listings.title}</Text> : null}
                <Text style={s.cardContent} numberOfLines={2}>{item.content}</Text>
              </GlassRow>
            </TouchableOpacity>
          )}
        />
      )}
    </GradientScreen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 12 },
  back: { color: "#a78bfa", fontSize: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  card: { paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  cardUnread: { backgroundColor: "rgba(167,139,250,0.1)", borderColor: "rgba(167,139,250,0.3)" },
  cardTitle: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cardSub: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 4 },
  cardContent: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  cardMeta: { color: "rgba(255,255,255,0.3)", fontSize: 12 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#a78bfa" },
  empty: { color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 48, fontSize: 14 },
});
