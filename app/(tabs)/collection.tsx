import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  Modal, ScrollView, ActivityIndicator, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";

type Perfume = {
  id: number; name: string; brand?: string | null; year?: number | null;
  status?: string | null; category?: string | null; is_favorite?: boolean | null;
  concentration?: string | null; size_ml?: number | null; rating?: number | null; image_url?: string | null;
};

const STATUS_OPTIONS = ["Owned", "Wishlist", "Sample", "Archived"];
const CATEGORY_OPTIONS = ["Designer", "Luxury", "Niche", "Artisan/Indie", "Celebrity", "Mass/Drugstore", "Vintage", "Custom/Bespoke"];
const CONCENTRATION_OPTIONS = ["Parfum/Extrait", "EDP", "EDT", "Cologne", "Oil"];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={s.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

function AddPerfumeModal({ visible, userId, onClose, onSaved }: {
  visible: boolean; userId?: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", brand: "", house: "", concentration: "", size_ml: "", year: "", category: "", notes: "", rating: "", is_favorite: false });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) setForm({ name: "", brand: "", house: "", concentration: "", size_ml: "", year: "", category: "", notes: "", rating: "", is_favorite: false }); }, [visible]);
  const set = (key: string, val: any) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await supabase.from("perfumes").insert([{
      name: form.name.trim(), brand: form.brand.trim() || null, house: form.house.trim() || null,
      concentration: form.concentration || null, size_ml: form.size_ml ? parseFloat(form.size_ml) : null,
      year: form.year ? parseInt(form.year) : null, category: form.category || null,
      notes: form.notes.trim() || null, rating: form.rating ? parseFloat(form.rating) : null,
      is_favorite: form.is_favorite, status: "Owned", user_id: userId,
    }]);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Add Perfume</Text>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
          {[
            { label: "Name *", key: "name", placeholder: "Perfume name" },
            { label: "Brand", key: "brand", placeholder: "Brand name" },
            { label: "House", key: "house", placeholder: "Perfume house" },
            { label: "Year", key: "year", placeholder: "2023", keyboard: "numeric" },
            { label: "Notes", key: "notes", placeholder: "Bergamot, rose, sandalwood...", multiline: true },
          ].map(({ label, key, placeholder, keyboard, multiline }) => (
            <View key={key}>
              <Text style={s.fieldLabel}>{label}</Text>
              <TextInput style={[s.input, multiline && { height: 80, textAlignVertical: "top" }]} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.35)" value={(form as any)[key]} onChangeText={(v) => set(key, v)} keyboardType={(keyboard as any) ?? "default"} multiline={multiline} />
            </View>
          ))}

          <Text style={s.fieldLabel}>Concentration</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {CONCENTRATION_OPTIONS.map((opt) => <Chip key={opt} label={opt} active={form.concentration === opt} onPress={() => set("concentration", form.concentration === opt ? "" : opt)} />)}
          </ScrollView>

          <Text style={s.fieldLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {CATEGORY_OPTIONS.map((opt) => <Chip key={opt} label={opt} active={form.category === opt} onPress={() => set("category", form.category === opt ? "" : opt)} />)}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Size (ml)</Text>
              <TextInput style={s.input} placeholder="100" placeholderTextColor="rgba(255,255,255,0.35)" value={form.size_ml} onChangeText={(v) => set("size_ml", v)} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Rating (0-10)</Text>
              <TextInput style={s.input} placeholder="8.5" placeholderTextColor="rgba(255,255,255,0.35)" value={form.rating} onChangeText={(v) => set("rating", v)} keyboardType="decimal-pad" />
            </View>
          </View>

          <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }} onPress={() => set("is_favorite", !form.is_favorite)}>
            <Text style={{ fontSize: 22 }}>{form.is_favorite ? "❤️" : "🤍"}</Text>
            <Text style={{ color: "#fff", fontSize: 15 }}>Favorite</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.saveBtn, (!form.name.trim() || saving) && { opacity: 0.5 }]} onPress={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function PerfumeCard({ item, onFavoriteToggle }: { item: Perfume; onFavoriteToggle: () => void }) {
  return (
    <TouchableOpacity onPress={() => router.push(`/collection/${item.id}` as any)} activeOpacity={0.75}>
      <GlassRow style={s.card}>
        <View style={{ flexDirection: "row" }}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={s.cardImage} resizeMode="cover" />
          ) : (
            <View style={s.cardImagePlaceholder}><Text style={{ fontSize: 28 }}>🌸</Text></View>
          )}
          <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <Text style={[s.cardTitle, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{item.name}</Text>
              <TouchableOpacity onPress={onFavoriteToggle}>
                <Text style={{ fontSize: 18 }}>{item.is_favorite ? "❤️" : "🤍"}</Text>
              </TouchableOpacity>
            </View>
            {item.brand ? <Text style={s.cardBrand} numberOfLines={1}>{item.brand}</Text> : null}
            <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              {item.category ? <Text style={s.cardMeta}>{item.category}</Text> : null}
              {item.concentration ? <Text style={s.cardMeta}>· {item.concentration}</Text> : null}
              {item.rating != null ? <Text style={s.cardRating}>· ★ {item.rating}</Text> : null}
            </View>
          </View>
        </View>
      </GlassRow>
    </TouchableOpacity>
  );
}

export default function Collection() {
  const { user } = useAuth();
  const [items, setItems] = useState<Perfume[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [favOnly, setFavOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addVisible, setAddVisible] = useState(false);

  const fetchPerfumes = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("perfumes").select("id,name,brand,year,status,category,is_favorite,concentration,size_ml,rating,image_url").order("name", { ascending: true });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (favOnly) query = query.eq("is_favorite", true);
    const { data } = await query;
    setItems((data as Perfume[]) ?? []);
    setLoading(false);
  }, [statusFilter, favOnly]);

  useEffect(() => { fetchPerfumes(); }, [fetchPerfumes]);

  const filtered = items.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const toggleFavorite = async (item: Perfume) => {
    await supabase.from("perfumes").update({ is_favorite: !item.is_favorite }).eq("id", item.id);
    setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, is_favorite: !p.is_favorite } : p));
  };

  return (
    <GradientScreen gradient="collection">
      <View style={s.header}>
        <Text style={s.pageTitle}>Collection</Text>
        <TextInput style={s.searchBar} placeholder="Search perfumes..." placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <Chip label="All" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
          {STATUS_OPTIONS.map((s2) => <Chip key={s2} label={s2} active={statusFilter === s2} onPress={() => setStatusFilter(s2)} />)}
          <Chip label="❤️ Favorites" active={favOnly} onPress={() => setFavOnly((v) => !v)} />
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator color="#a78bfa" style={{ marginTop: 48 }} /> : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={s.empty}>{search ? "No perfumes match your search" : "Your collection is empty. Add one!"}</Text>}
          renderItem={({ item }) => <PerfumeCard item={item} onFavoriteToggle={() => toggleFavorite(item)} />}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => setAddVisible(true)}>
        <Text style={s.fabIcon}>+</Text>
      </TouchableOpacity>

      <AddPerfumeModal visible={addVisible} userId={user?.id} onClose={() => setAddVisible(false)} onSaved={() => { setAddVisible(false); fetchPerfumes(); }} />
    </GradientScreen>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 12 },
  searchBar: { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: "#fff", marginBottom: 10 },
  chip: { marginRight: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.08)" },
  chipActive: { backgroundColor: "#a78bfa", borderColor: "#a78bfa" },
  chipText: { color: "#fff", fontSize: 12 },
  card: { marginBottom: 10, overflow: "hidden" },
  cardImage: { width: 80, height: 80 },
  cardImagePlaceholder: { width: 80, height: 80, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  cardTitle: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cardBrand: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  cardMeta: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  cardRating: { color: "#a78bfa", fontSize: 12 },
  empty: { color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 48, fontSize: 14 },
  fab: { position: "absolute", bottom: 24, right: 24, backgroundColor: "#a78bfa", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32 },
  modal: { flex: 1, backgroundColor: "#160a30" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  modalClose: { color: "rgba(255,255,255,0.5)", fontSize: 18 },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 15, marginBottom: 14 },
  saveBtn: { backgroundColor: "#a78bfa", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
