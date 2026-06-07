import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  Modal, ScrollView, ActivityIndicator, StyleSheet, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Perfume = {
  id: number; name: string; brand?: string | null; year?: number | null;
  status?: string | null; category?: string | null; is_favorite?: boolean | null;
  concentration?: string | null; size_ml?: number | null; rating?: number | null;
  image_url?: string | null; created_at?: string | null;
};

const CATEGORY_OPTIONS = ["Designer", "Luxury", "Niche", "Artisan/Indie", "Celebrity", "Mass/Drugstore", "Vintage", "Custom/Bespoke"];
const CATEGORY_DROPDOWN = ["All", ...CATEGORY_OPTIONS];

const STATUS_CHIPS = [
  { label: "Favorites",  key: "favorites"  },
  { label: "Wishlist",   key: "Wishlist"   },
  { label: "Sell-Trade", key: "Sell-Trade" },
];

// ─── Cards ────────────────────────────────────────────────────────────────────

function ListCard({ item, onFavoriteToggle }: { item: Perfume; onFavoriteToggle: () => void }) {
  return (
    <TouchableOpacity style={s.listCard} onPress={() => router.push(`/collection/${item.id}` as any)} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
        {item.brand ? <Text style={s.cardBrand} numberOfLines={1}>{item.brand}</Text> : null}
      </View>
      <TouchableOpacity onPress={onFavoriteToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[s.heart, item.is_favorite && s.heartFilled]}>{item.is_favorite ? "♥" : "♡"}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function CollectionCard({ item, onFavoriteToggle }: { item: Perfume; onFavoriteToggle: () => void }) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - 12 * 2 - 10) / 2;
  return (
    <TouchableOpacity style={[s.card, { width: cardWidth }]} onPress={() => router.push(`/collection/${item.id}` as any)} activeOpacity={0.8}>
      <View style={s.cardImageWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
        ) : null}
      </View>
      <View style={s.cardInfo}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
          {item.brand ? <Text style={s.cardBrand} numberOfLines={1}>{item.brand}</Text> : null}
        </View>
        <TouchableOpacity onPress={onFavoriteToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[s.heart, item.is_favorite && s.heartFilled]}>{item.is_favorite ? "♥" : "♡"}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Collection() {
  const [items, setItems] = useState<Perfume[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [sortOrder, setSortOrder] = useState<"A-Z" | "Z-A" | "Recently Added">("A-Z");
  const [sortPickerVisible, setSortPickerVisible] = useState(false);

  const fetchPerfumes = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("perfumes").select("id,name,brand,year,status,category,is_favorite,concentration,size_ml,rating,image_url,created_at");
    if (sortOrder === "A-Z") query = query.order("name", { ascending: true });
    else if (sortOrder === "Z-A") query = query.order("name", { ascending: false });
    else query = query.order("created_at", { ascending: false });
    if (activeFilter === "favorites") query = query.eq("is_favorite", true);
    else if (activeFilter !== "all") query = query.eq("status", activeFilter);
    if (categoryFilter !== "All") query = query.eq("category", categoryFilter);
    const { data } = await query;
    setItems((data as Perfume[]) ?? []);
    setLoading(false);
  }, [activeFilter, categoryFilter, sortOrder]);

  useFocusEffect(useCallback(() => { fetchPerfumes(); }, [fetchPerfumes]));

  const filtered = items.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const toggleFavorite = async (item: Perfume) => {
    await supabase.from("perfumes").update({ is_favorite: !item.is_favorite }).eq("id", item.id);
    setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, is_favorite: !p.is_favorite } : p));
  };

  return (
    <LinearGradient colors={["#0d9488", "#0fb8aa", "#12ccba"]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Top nav */}
        <View style={s.topNav}>
          <Text style={s.logo}>SP/LS.</Text>
          <TouchableOpacity style={s.profileBtn} onPress={() => router.push("/(tabs)/profile" as any)}>
            <Text style={s.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* Title + View|Sort */}
        <View style={s.titleRow}>
          <Text style={s.pageTitle}>Collection</Text>
          <View style={s.viewSortBtn}>
            <TouchableOpacity onPress={() => setViewMode((v) => v === "grid" ? "list" : "grid")}>
              <Text style={[s.viewSortText, viewMode === "list" && s.viewSortActive]}>View</Text>
            </TouchableOpacity>
            <Text style={s.viewSortSep}> | </Text>
            <TouchableOpacity onPress={() => setSortPickerVisible(true)}>
              <Text style={[s.viewSortText, sortOrder !== "A-Z" && s.viewSortActive]}>Sort</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search..."
            placeholderTextColor="rgba(19,19,26,0.35)"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={s.chipsRow}>
          {/* Category dropdown chip */}
          <TouchableOpacity style={[s.chip, categoryFilter !== "All" && s.chipActive]} onPress={() => setCategoryPickerVisible(true)}>
            <Text style={[s.chipText, categoryFilter !== "All" && s.chipTextActive]}>{categoryFilter} ▾</Text>
          </TouchableOpacity>
          {/* Status chips */}
          {STATUS_CHIPS.map(({ label, key }) => (
            <TouchableOpacity
              key={key}
              style={[s.chip, activeFilter === key && s.chipActive]}
              onPress={() => { setActiveFilter((prev) => prev === key ? "all" : key); setCategoryFilter("All"); }}
            >
              <Text style={[s.chipText, activeFilter === key && s.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Grid / List */}
        {loading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 48 }} />
        ) : (
          <FlatList
            key={viewMode}
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            numColumns={viewMode === "grid" ? 2 : 1}
            contentContainerStyle={viewMode === "grid" ? s.grid : s.listGrid}
            columnWrapperStyle={viewMode === "grid" ? s.row : undefined}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={s.empty}>{search ? "No results" : "Your collection is empty"}</Text>
            }
            renderItem={({ item }) =>
              viewMode === "grid"
                ? <CollectionCard item={item} onFavoriteToggle={() => toggleFavorite(item)} />
                : <ListCard item={item} onFavoriteToggle={() => toggleFavorite(item)} />
            }
          />
        )}

        {/* Category picker */}
        <Modal visible={categoryPickerVisible} transparent animationType="slide" onRequestClose={() => setCategoryPickerVisible(false)}>
          <View style={s.pickerBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setCategoryPickerVisible(false)} />
            <View style={s.pickerSheet}>
              <View style={s.pickerHandle} />
              {CATEGORY_DROPDOWN.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[s.pickerBtn, categoryFilter === cat && s.pickerBtnActive]}
                  onPress={() => { setCategoryFilter(cat); setActiveFilter("all"); setCategoryPickerVisible(false); }}
                >
                  <Text style={[s.pickerBtnText, categoryFilter === cat && s.pickerBtnTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Sort picker */}
        <Modal visible={sortPickerVisible} transparent animationType="slide" onRequestClose={() => setSortPickerVisible(false)}>
          <View style={s.pickerBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setSortPickerVisible(false)} />
            <View style={s.pickerSheet}>
              <View style={s.pickerHandle} />
              {(["A-Z", "Z-A", "Recently Added"] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[s.pickerBtn, sortOrder === opt && s.pickerBtnActive]}
                  onPress={() => { setSortOrder(opt); setSortPickerVisible(false); }}
                >
                  <Text style={[s.pickerBtnText, sortOrder === opt && s.pickerBtnTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  logo: { color: "#13131a", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.08)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },

  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  pageTitle: { color: "#13131a", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  viewSortBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewSortText: { color: "#13131a", fontSize: 12, fontWeight: "500" },
  viewSortActive: { fontWeight: "700", textDecorationLine: "underline" },
  viewSortSep: { color: "rgba(19,19,26,0.3)", fontSize: 12 },

  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", borderRadius: 50, marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 12, gap: 8 },
  searchIcon: { color: "rgba(19,19,26,0.4)", fontSize: 18 },
  searchInput: { flex: 1, color: "#13131a", fontSize: 14 },

  chipsRow: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 },
  chip: { marginRight: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50, borderWidth: 1, borderColor: "rgba(0,0,0,0.2)", backgroundColor: "rgba(255,255,255,0.3)" },
  chipActive: { backgroundColor: "#13131a", borderColor: "#13131a" },
  chipText: { color: "rgba(19,19,26,0.7)", fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: "#fff" },

  grid: { paddingHorizontal: 12, paddingBottom: 100 },
  row: { gap: 10, marginBottom: 10, justifyContent: "flex-start" },

  card: { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" },
  cardImageWrap: { margin: 10, height: 180, backgroundColor: "#fff", borderRadius: 12 },
  cardInfo: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 14, paddingTop: 6 },
  cardName: { color: "#13131a", fontWeight: "700", fontSize: 13 },
  cardBrand: { color: "rgba(19,19,26,0.55)", fontSize: 12, marginTop: 1 },
  heart: { fontSize: 18, color: "rgba(19,19,26,0.4)" },
  heartFilled: { color: "#13131a" },

  listGrid: { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },
  listCard: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", paddingHorizontal: 16, paddingVertical: 18 },

  empty: { color: "rgba(19,19,26,0.5)", textAlign: "center", marginTop: 60, fontSize: 14 },

  pickerBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  pickerSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12 },
  pickerHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.15)", alignSelf: "center", marginBottom: 16 },
  pickerBtn: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  pickerBtnActive: { },
  pickerBtnText: { color: "#13131a", fontSize: 15 },
  pickerBtnTextActive: { fontWeight: "700", color: "#0d9488" },
});
