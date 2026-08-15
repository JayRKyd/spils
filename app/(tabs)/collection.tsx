import { useState, useEffect, useCallback } from "react";
import { ProfileIcon } from "@/components/ProfileIcon";
import { useFocusEffect } from "@react-navigation/native";
import { SpilsLogo } from "../../components/SpilsLogo";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  Modal, ScrollView, ActivityIndicator, StyleSheet, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Perfume = {
  id: number; name: string; brand?: string | null; year?: number | null;
  status?: string | null; category?: string | null; is_favorite?: boolean | null;
  concentration?: string | null; size_ml?: number | null; rating?: number | null;
  image_url?: string | null; created_at?: string | null;
  nose?: string | null;
  accords?: string[] | null;
  top_notes?: string[] | null;
  heart_notes?: string[] | null;
  base_notes?: string[] | null;
};

const CATEGORY_DROPDOWN = ["All", "Designer", "Luxury", "Niche", "Artisan/Indie", "Celebrity", "Mass Market", "Private Collection", "Classic/Vintage", "Limited Edition", "Discontinued", "Other"];

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
        <Text style={s.listCardName} numberOfLines={1}>{item.name}</Text>
        {item.brand ? <Text style={s.listCardBrand} numberOfLines={1}>{item.brand}</Text> : null}
      </View>
      <TouchableOpacity onPress={onFavoriteToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[s.listHeart, item.is_favorite && s.listHeartFilled]}>{item.is_favorite ? "♥" : "♡"}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function CollectionCard({ item, onFavoriteToggle }: { item: Perfume; onFavoriteToggle: () => void }) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - 30 * 2 - 12) / 2;
  return (
    <TouchableOpacity style={[s.card, { width: cardWidth }]} onPress={() => router.push(`/collection/${item.id}` as any)} activeOpacity={0.8}>
      <View style={s.cardImageWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill as any} resizeMode="contain" />
        ) : (
          <View style={s.cardPlaceholder}>
            <View style={s.cardPlaceholderCap} />
            <View style={s.cardPlaceholderBody} />
          </View>
        )}
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
  const { user } = useAuth();
  const [items, setItems] = useState<Perfume[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [sortOrder, setSortOrder] = useState<"A-Z" | "Z-A" | "Recently Added">("A-Z");
  const [sortPickerVisible, setSortPickerVisible] = useState(false);

  // One-time: copy the shared starter bottles into this user's own collection
  // so they fully own them (favorite/delete work — RLS only allows owner writes).
  const seedStarters = useCallback(async () => {
    if (!user?.id) return;
    const { data: prof } = await supabase.from("profiles").select("starter_seeded").eq("id", user.id).single();
    if (!prof || (prof as any).starter_seeded) return;
    const { data: starters } = await supabase.from("perfumes").select("*").eq("is_starter", true);
    const { data: mine } = await supabase.from("perfumes").select("name").eq("user_id", user.id);
    const myNames = new Set((mine ?? []).map((m: any) => m.name));
    const clones = (starters ?? [])
      .filter((st: any) => !myNames.has(st.name) && st.user_id !== user.id)
      .map(({ id: _id, created_at: _c, ...rest }: any) => ({ ...rest, user_id: user.id, is_starter: false, is_favorite: false }));
    if (clones.length) await supabase.from("perfumes").insert(clones);
    await supabase.from("profiles").update({ starter_seeded: true }).eq("id", user.id);
  }, [user?.id]);

  const fetchPerfumes = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    await seedStarters();
    let query = supabase.from("perfumes")
      .select("id,name,brand,year,status,category,is_favorite,concentration,size_ml,rating,image_url,created_at,nose,accords,top_notes,heart_notes,base_notes")
      .eq("user_id", user.id);
    if (sortOrder === "A-Z") query = query.order("name", { ascending: true });
    else if (sortOrder === "Z-A") query = query.order("name", { ascending: false });
    else query = query.order("created_at", { ascending: false });
    if (activeFilter === "favorites") query = query.eq("is_favorite", true);
    else if (activeFilter !== "all") query = query.eq("status", activeFilter);
    if (categoryFilter !== "All") query = query.eq("category", categoryFilter);
    const { data } = await query;
    setItems((data as Perfume[]) ?? []);
    setLoading(false);
  }, [activeFilter, categoryFilter, sortOrder, user?.id, seedStarters]);

  useFocusEffect(useCallback(() => { fetchPerfumes(); }, [fetchPerfumes]));

  const filtered = items.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand?.toLowerCase().includes(q) ?? false) ||
      (p.nose?.toLowerCase().includes(q) ?? false) ||
      (p.accords?.some((a) => a.toLowerCase().includes(q)) ?? false) ||
      (p.top_notes?.some((n) => n.toLowerCase().includes(q)) ?? false) ||
      (p.heart_notes?.some((n) => n.toLowerCase().includes(q)) ?? false) ||
      (p.base_notes?.some((n) => n.toLowerCase().includes(q)) ?? false)
    );
  });

  const toggleFavorite = async (item: Perfume) => {
    await supabase.from("perfumes").update({ is_favorite: !item.is_favorite }).eq("id", item.id);
    setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, is_favorite: !p.is_favorite } : p));
  };

  return (
    <LinearGradient colors={["#000000", "#000000", "#00AEEF"]} locations={[0, 0.82, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Top nav */}
        <View style={s.topNav}>
          <SpilsLogo height={22} color="#edff8d" />
          <TouchableOpacity style={[s.profileBtn, { backgroundColor: "transparent", borderWidth: 0 }]} onPress={() => router.push("/(tabs)/profile" as any)}>
            <ProfileIcon size={34} />
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
          <TextInput
            style={s.searchInput}
            placeholder="Search..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={search}
            onChangeText={setSearch}
          />
          <View style={s.searchBtn}><Text style={s.searchBtnText}>Search</Text></View>
        </View>

        {/* Filter chips — spaced evenly */}
        <View style={s.chipsRow}>
          {/* Category dropdown chip */}
          <TouchableOpacity style={[s.chip, categoryFilter !== "All" && s.chipActive]} onPress={() => setCategoryPickerVisible(true)}>
            <Text style={[s.chipText, categoryFilter !== "All" && s.chipTextActive]} numberOfLines={1}>{categoryFilter} ▾</Text>
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
        </View>

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
              {(["Recently Added", "A-Z", "Z-A"] as const).map((opt) => (
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
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 12, paddingBottom: 4 },
  logo: { color: "#edff8d", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },

  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 73, paddingBottom: 16 },
  pageTitle: { color: "#fff", fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },
  viewSortBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewSortText: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "500" },
  viewSortActive: { color: "#fff", fontWeight: "700" },
  viewSortSep: { color: "rgba(255,255,255,0.35)", fontSize: 13 },

  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 24, marginHorizontal: 30, paddingLeft: 16, paddingRight: 5, paddingVertical: 5, marginBottom: 14 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 7 },
  searchBtn: { backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 7 },
  searchBtnText: { color: "#13131a", fontSize: 12, fontWeight: "600" },

  chipsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingBottom: 14, paddingTop: 2, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", backgroundColor: "transparent" },
  chipActive: { backgroundColor: "#00AEEF", borderColor: "#00AEEF" },
  chipText: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: "#13131a", fontWeight: "700" },

  grid: { paddingHorizontal: 30, paddingBottom: 120 },
  row: { gap: 12, marginBottom: 12, justifyContent: "flex-start" },

  card: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" },
  cardImageWrap: { margin: 10, height: 170, backgroundColor: "#f2f2f2", borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cardPlaceholder: { alignItems: "center", justifyContent: "flex-end" },
  cardPlaceholderCap: { width: 26, height: 20, backgroundColor: "#b8b8b8", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  cardPlaceholderBody: { width: 62, height: 82, backgroundColor: "#c9c9c9", borderRadius: 8, marginTop: 2 },
  cardInfo: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 14, paddingTop: 4 },
  cardName: { color: "#13131a", fontWeight: "700", fontSize: 13 },
  cardBrand: { color: "rgba(19,19,26,0.55)", fontSize: 12, marginTop: 1 },
  heart: { fontSize: 18, color: "rgba(19,19,26,0.35)" },
  heartFilled: { color: "#13131a" },

  listGrid: { paddingHorizontal: 30, paddingBottom: 120, gap: 12 },
  listCard: { flexDirection: "row", alignItems: "center", backgroundColor: "transparent", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 18 },
  listCardName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  listCardBrand: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  listHeart: { fontSize: 18, color: "rgba(255,255,255,0.55)" },
  listHeartFilled: { color: "#fff" },

  empty: { color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 60, fontSize: 14 },

  pickerBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  pickerSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12 },
  pickerHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.15)", alignSelf: "center", marginBottom: 16 },
  pickerBtn: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  pickerBtnActive: { },
  pickerBtnText: { color: "#13131a", fontSize: 15 },
  pickerBtnTextActive: { fontWeight: "700", color: "#0d9488" },
});
