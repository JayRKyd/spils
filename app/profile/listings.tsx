import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";

interface Listing {
  id: string;
  title: string;
  type: string;
  price: number | null;
  condition: string | null;
  created_at: string;
}

const TYPE_BG: Record<string, { bg: string; border: string; text: string }> = {
  "For Sale": { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.3)", text: "#4ade80" },
  Trade:      { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.3)", text: "#60a5fa" },
  Wanted:     { bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.3)",  text: "#f87171" },
  Free:       { bg: "rgba(168,85,247,0.15)", border: "rgba(168,85,247,0.3)", text: "#c084fc" },
};

export default function MyListings() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any).from("marketplace_listings").select("id,title,type,price,condition,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    setListings(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = (id: string, title: string) => {
    Alert.alert("Delete Listing", `Remove "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await (supabase as any).from("marketplace_listings").delete().eq("id", id); fetch(); } },
    ]);
  };

  return (
    <GradientScreen gradient="profile">
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>My Listings</Text>
      </View>
      {loading ? <ActivityIndicator color="#a78bfa" style={{ marginTop: 48 }} /> : (
        <FlatList
          data={listings}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={s.empty}>No listings yet. Post one from the Marketplace!</Text>}
          renderItem={({ item }) => {
            const colors = TYPE_BG[item.type];
            return (
              <GlassRow style={s.card}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <Text style={[s.cardTitle, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{item.title}</Text>
                  {item.price != null ? <Text style={s.cardPrice}>${item.price}</Text> : null}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                  {colors ? (
                    <View style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: colors.text, fontSize: 12 }}>{item.type}</Text>
                    </View>
                  ) : null}
                  {item.condition ? <Text style={s.cardMeta}>{item.condition}</Text> : null}
                  <Text style={[s.cardMeta, { marginLeft: "auto" as any }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: 8 }} onPress={() => handleDelete(item.id, item.title)}>
                  <Text style={s.deleteBtn}>Delete</Text>
                </TouchableOpacity>
              </GlassRow>
            );
          }}
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
  cardTitle: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cardPrice: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cardMeta: { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  deleteBtn: { color: "#f87171", fontSize: 12 },
  empty: { color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 48, fontSize: 14 },
});
