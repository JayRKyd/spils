import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";
import { ConfirmModal, ConfirmConfig } from "@/components/ConfirmModal";

interface WatchItem {
  id: string;
  listing_id: string;
  marketplace_listings: {
    title: string;
    type: string;
    price: number | null;
    condition: string | null;
  } | null;
}

export default function Watchlist() {
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const { user } = useAuth();
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("marketplace_watchlist")
      .select("id,listing_id,marketplace_listings(title,type,price,condition)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleRemove = (id: string) => {
    setConfirm({
      title: "Remove from Watchlist",
      message: "Remove this item?",
      confirmLabel: "Remove",
      onConfirm: async () => { await (supabase as any).from("marketplace_watchlist").delete().eq("id", id); fetch(); },
    });
  };

  return (
    <GradientScreen gradient="profile">
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Watchlist</Text>
      </View>
      {loading ? <ActivityIndicator color="#a78bfa" style={{ marginTop: 48 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={s.empty}>Your watchlist is empty</Text>}
          renderItem={({ item }) => (
            <GlassRow style={s.card}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                <Text style={[s.cardTitle, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{item.marketplace_listings?.title ?? "Listing"}</Text>
                {item.marketplace_listings?.price != null ? <Text style={s.cardPrice}>${item.marketplace_listings.price}</Text> : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                {item.marketplace_listings?.type ? <Text style={s.cardMeta}>{item.marketplace_listings.type}</Text> : null}
                {item.marketplace_listings?.condition ? <Text style={s.cardMeta}>· {item.marketplace_listings.condition}</Text> : null}
              </View>
              <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: 8 }} onPress={() => handleRemove(item.id)}>
                <Text style={s.removeBtn}>Remove</Text>
              </TouchableOpacity>
            </GlassRow>
          )}
        />
      )}
      <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
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
  removeBtn: { color: "#f87171", fontSize: 12 },
  empty: { color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 48, fontSize: 14 },
});
