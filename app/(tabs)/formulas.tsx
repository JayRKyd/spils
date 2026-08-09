import { useState, useEffect, useCallback, useRef } from "react";
import { ProfileIcon } from "@/components/ProfileIcon";
import { SpilsLogo } from "../../components/SpilsLogo";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, StyleSheet, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const ACCENT = "#EC008C";
const HEART = "#edff8d";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Formula {
  id: number;
  name: string;
  description: string | null;
  date_created: string;
  material_count?: number;
  is_favorite?: boolean;
  status?: string | null;
}

interface FormulaVersion {
  id: string;
  formula_id: number;
  version_num: number;
  label: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}.${dd}.${yy}`;
}

function getStatus(formula: Formula) {
  if (formula.status) return formula.status;
  const count = formula.material_count ?? 0;
  if (count === 0) return "Draft";
  if (count < 10) return "In Progress";
  return "Final";
}

// ─── Formula Card ─────────────────────────────────────────────────────────────

function FormulaCard({ formula, onToggleFavorite }: {
  formula: Formula;
  onToggleFavorite: () => void;
}) {
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<FormulaVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const status = getStatus(formula);
  const date = formatDate(formula.date_created);

  const openVersions = async () => {
    setVersionsOpen(true);
    if (versions.length === 0) {
      setVersionsLoading(true);
      const { data } = await supabase
        .from("formula_versions")
        .select("*")
        .eq("formula_id", formula.id)
        .order("created_at", { ascending: false });
      setVersions((data as FormulaVersion[]) ?? []);
      setVersionsLoading(false);
    }
  };

  const openVersion = (id: string) => {
    setVersionsOpen(false);
    router.push(`/formula/version/${id}` as any);
  };

  // Shared card body (reused inside the Versions drawer)
  const cardBody = (
    <>
      <View style={c.topRow}>
        <Text style={c.name} numberOfLines={1}>{formula.name}</Text>
        <Text style={c.date}>{date}</Text>
      </View>
      <Text style={c.desc} numberOfLines={1}>
        {formula.description || "One line of notes will go here..."}
      </Text>
      <View style={c.bottomRow}>
        <View style={c.bottomLeft}>
          <View style={c.statusPill}>
            <Text style={c.statusPillText}>{status.toUpperCase()}</Text>
          </View>
          <Text style={c.meta}>{formula.material_count ?? 0} MATERIAL{(formula.material_count ?? 0) === 1 ? "" : "S"}</Text>
          <Text style={c.sep}>  |  </Text>
          <TouchableOpacity onPress={openVersions}>
            <Text style={c.versionsLink}>VERSIONS</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onToggleFavorite(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[c.heart, formula.is_favorite && c.heartActive]}>{formula.is_favorite ? "♥" : "♡"}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={c.card}>
      {/* Top half (name + date + description) opens the PDP */}
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => router.push(`/formula/${formula.id}` as any)}
      >
        <View style={c.topRow}>
          <Text style={c.name} numberOfLines={1}>{formula.name}</Text>
          <Text style={c.date}>{date}</Text>
        </View>
        <Text style={c.desc} numberOfLines={1}>
          {formula.description || "One line of notes will go here..."}
        </Text>
      </TouchableOpacity>

      {/* Bottom row */}
      <View style={c.bottomRow}>
        <View style={c.bottomLeft}>
          <View style={c.statusPill}>
            <Text style={c.statusPillText}>{status.toUpperCase()}</Text>
          </View>
          <Text style={c.meta}>{formula.material_count ?? 0} MATERIAL{(formula.material_count ?? 0) === 1 ? "" : "S"}</Text>
          <Text style={c.sep}>  |  </Text>
          <TouchableOpacity onPress={openVersions}>
            <Text style={c.versionsLink}>VERSIONS</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onToggleFavorite(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[c.heart, formula.is_favorite && c.heartActive]}>{formula.is_favorite ? "♥" : "♡"}</Text>
        </TouchableOpacity>
      </View>

      {/* Versions drawer */}
      <Modal visible={versionsOpen} transparent animationType="fade" onRequestClose={() => setVersionsOpen(false)}>
        <View style={c.drawerBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} activeOpacity={1} onPress={() => setVersionsOpen(false)} />
          <View style={c.drawerCard}>
            {/* Card header replica */}
            {cardBody}

            <View style={c.drawerDivider} />

            {/* Versions list */}
            <Text style={c.drawerTitle}>Versions</Text>
            {versionsLoading ? (
              <ActivityIndicator size="small" color={ACCENT} style={{ marginTop: 12, marginBottom: 4 }} />
            ) : versions.length === 0 ? (
              <Text style={c.drawerEmpty}>No saved versions yet.</Text>
            ) : (
              versions.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={c.versionPill}
                  activeOpacity={0.75}
                  onPress={() => openVersion(v.id)}
                >
                  <Text style={c.versionName} numberOfLines={1}>
                    {v.label ?? `${formula.name} [version ${v.version_num}]`}
                  </Text>
                  <Text style={c.versionDate}>{formatDate(v.created_at)}</Text>
                </TouchableOpacity>
              ))
            )}

            {/* Hide */}
            <TouchableOpacity style={c.drawerHide} onPress={() => setVersionsOpen(false)}>
              <Text style={c.drawerHideText}>Hide</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Formulas() {
  const { user } = useAuth();
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortOpen, setSortOpen] = useState(false);
  const { openAdd } = useLocalSearchParams<{ openAdd?: string }>();
  const [ifraVisible, setIfraVisible] = useState(false);
  const [secureVisible, setSecureVisible] = useState(false);
  const [focusKey, setFocusKey] = useState(0);

  useEffect(() => { if (openAdd) router.push("/formula/new" as any); }, [openAdd]);

  const fetchFormulas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("formulas")
      .select("*, formula_lines(count)")
      .order("date_created", { ascending: false });
    const mapped = (data ?? []).map((f: any) => ({
      ...f,
      material_count: f.formula_lines?.[0]?.count ?? 0,
    }));
    setFormulas(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchFormulas(); }, [fetchFormulas]);

  useFocusEffect(useCallback(() => {
    setFocusKey((k) => k + 1);
    fetchFormulas();
  }, [fetchFormulas]));

  const filtered = formulas.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    if (!matchesSearch) return false;
    if (activeFilter === "All") return true;
    if (activeFilter === "Favorites") return !!f.is_favorite;
    // Plural menu labels map to singular status values
    const statusFilter = activeFilter === "Drafts" ? "Draft" : activeFilter === "Finals" ? "Final" : activeFilter;
    return getStatus(f) === statusFilter;
  });

  const handleToggleFavorite = async (formula: Formula) => {
    const newVal = !formula.is_favorite;
    setFormulas((prev) => prev.map((f) => f.id === formula.id ? { ...f, is_favorite: newVal } : f));
    await supabase.from("formulas").update({ is_favorite: newVal }).eq("id", formula.id);
  };

  return (
    <LinearGradient
      colors={["#000000", "#000000", ACCENT]}
      locations={[0, 0.82, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top nav */}
        <View style={s.topNav}>
          <SpilsLogo height={22} color="#edff8d" />
          <TouchableOpacity style={[s.profileCircle, { backgroundColor: "transparent", borderWidth: 0 }]} onPress={() => router.push("/(tabs)/profile" as any)}>
            <ProfileIcon size={34} />
          </TouchableOpacity>
        </View>

        {/* Title + Sort */}
        <View style={s.headerRow}>
          <Text style={s.pageTitle}>Lab</Text>
          <TouchableOpacity onPress={() => setSortOpen(true)}>
            <Text style={[s.sortText, activeFilter !== "All" && s.sortTextActive]}>{activeFilter === "All" ? "Sort" : activeFilter}</Text>
          </TouchableOpacity>
        </View>

        {/* Search — button lives inside the bar */}
        <View style={s.searchRow}>
          <View style={s.searchWrap}>
            <TextInput
              style={s.searchInput}
              placeholder=""
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Text style={s.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.searchBtn} onPress={() => {}}>
              <Text style={s.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Chips */}
        <View style={s.filterRow}>
          <TouchableOpacity style={[s.secureBadge, { flex: 1.1 }]} onPress={() => setSecureVisible(true)}>
            <Text style={s.secureBadgeText}>Your Formulas are Secure</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.ifraPill, { flex: 1 }]} onPress={() => setIfraVisible(true)}>
            <Text style={s.ifraPillText}>IFRA</Text>
          </TouchableOpacity>
        </View>

        {/* Section label */}
        <Text style={s.sectionLabel}>Your Formulas...</Text>

        {/* List */}
        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 48 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 30, paddingTop: 8, paddingBottom: 100 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListEmptyComponent={
              <Text style={s.empty}>
                {search ? "No projects match your search." : activeFilter !== "All" ? `No ${activeFilter.toLowerCase()} formulas.` : "No projects yet. Tap + to create one."}
              </Text>
            }
            renderItem={({ item }) => (
              <FormulaCard
                key={`${item.id}-${focusKey}`}
                formula={item}
                onToggleFavorite={() => handleToggleFavorite(item)}
              />
            )}
          />
        )}

        {/* Sort picker */}
        <Modal visible={sortOpen} transparent animationType="slide" onRequestClose={() => setSortOpen(false)}>
          <View style={s.pickerBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setSortOpen(false)} />
            <View style={s.pickerSheet}>
              <View style={s.pickerHandle} />
              {["All", "Favorites", "Drafts", "In Progress", "Finals"].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={s.pickerBtn}
                  onPress={() => { setActiveFilter(opt); setSortOpen(false); }}
                >
                  <Text style={[s.pickerBtnText, activeFilter === opt && s.pickerBtnTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Secure modal */}
        <Modal visible={secureVisible} transparent animationType="fade" onRequestClose={() => setSecureVisible(false)}>
          <View style={s.bannerOverlay}>
            <View style={s.secureCard}>
              <TouchableOpacity style={s.bannerClose} onPress={() => setSecureVisible(false)}>
                <Text style={s.bannerCloseText}>✕</Text>
              </TouchableOpacity>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={s.secureTitle}>YOUR FORMULAS ARE SECURE</Text>
                <Text style={s.secureBody}>
                  Your formulas and notes are private and securely stored. No one including SPILS can see them unless you choose to share. You are in full control. Export your creations as a .CSV or share them with collaborators any time.
                </Text>
                <Text style={s.secureSection}>LEGAL & PRIVACY NOTE:</Text>
                <Text style={s.secureBody}>
                  All Lab data is encrypted in transit and at rest using industry-standard security measures. Data is stored securely with our backend provider and cannot be accessed by SPILS personnel. SPILS is not responsible for unauthorized access outside our systems. SPILS is not liable for lost, deleted, or inaccessible formulas due to user error or events beyond our control. Please back up or export your creations regularly.
                </Text>
                <Text style={s.secureSection}>SHARING REMINDER:</Text>
                <Text style={s.secureBody}>
                  If you share a formula externally, SPILS cannot guarantee its privacy. You are responsible for any use outside the app.
                </Text>
                <Text style={s.secureFooter}>For any questions about your data, contact{" "}
                  <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL("mailto:info@spils.app")}>info@spils.app</Text>
                </Text>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* IFRA notice modal */}
        <Modal visible={ifraVisible} transparent animationType="fade" onRequestClose={() => setIfraVisible(false)}>
          <View style={s.bannerOverlay}>
            <View style={s.bannerCard}>
              <TouchableOpacity style={s.bannerClose} onPress={() => setIfraVisible(false)}>
                <Text style={s.bannerCloseText}>✕</Text>
              </TouchableOpacity>
              <Text style={s.bannerHeading}>IFRA Compliance Coming Soon:</Text>
              <Text style={s.bannerBody}>
                Always double-check your formulas{"\n"}against IFRA guidelines.{"\n"}Our full IFRA assistant will arrive in future updates.
              </Text>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 2,
  },
  logo: { fontSize: 20, fontWeight: "900", color: "#edff8d", letterSpacing: -0.5 },
  profileCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  profileIcon: { fontSize: 16 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 30,
    paddingTop: 73,
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 23, fontWeight: "800", color: "#fff",
    letterSpacing: -0.5,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 30,
    marginBottom: 14,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 5,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.6)",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#fff", paddingVertical: 7 },
  searchClear: { color: "rgba(255,255,255,0.4)", fontSize: 15, paddingHorizontal: 6 },
  searchBtn: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  searchBtnText: { fontSize: 12, fontWeight: "600", color: "#13131a" },

  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 30,
    marginBottom: 22,
  },
  secureBadge: {
    backgroundColor: "#edff8d",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: "center",
  },
  secureBadgeText: { fontSize: 12, fontWeight: "700", color: "#13131a" },
  ifraPill: {
    backgroundColor: "transparent",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: "center",
  },
  ifraPillText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  sortText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  sortTextActive: { fontWeight: "700", textDecorationLine: "underline", color: ACCENT },
  sectionLabel: {
    fontSize: 14, fontWeight: "700", color: "#fff",
    paddingHorizontal: 30, marginBottom: 12, letterSpacing: 0.2,
  },
  pickerBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  pickerSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12 },
  pickerHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.15)", alignSelf: "center", marginBottom: 16 },
  pickerBtn: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  pickerBtnText: { color: "#13131a", fontSize: 15 },
  pickerBtnTextActive: { fontWeight: "700", color: "#EC008C" },
  empty: {
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 56,
    fontSize: 14,
  },

  bannerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  bannerCard: {
    backgroundColor: "#141414",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 26,
    width: "100%",
  },
  bannerClose: {
    position: "absolute",
    top: 14,
    right: 16,
    padding: 6,
  },
  bannerCloseText: { color: "rgba(255,255,255,0.5)", fontSize: 16 },
  bannerHeading: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 8,
    paddingRight: 24,
    textAlign: "center",
  },
  bannerBody: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  secureCard: {
    backgroundColor: "#141414",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    width: "100%",
    maxHeight: "85%",
  },
  secureTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 14,
    marginTop: 8,
    letterSpacing: 0.3,
  },
  secureSection: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  secureBody: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    lineHeight: 22,
  },
  secureFooter: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginTop: 24,
    lineHeight: 18,
  },
});

// Card styles
const c = StyleSheet.create({
  card: {
    backgroundColor: "transparent",
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.6)",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  name: { fontSize: 15, fontWeight: "700", color: "#fff", flex: 1, marginRight: 8 },
  heart: { fontSize: 22, color: "rgba(255,255,255,0.4)" },
  heartActive: { color: HEART },

  desc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 18,
    marginBottom: 14,
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomLeft: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  statusPill: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 10,
  },
  statusPillText: { fontSize: 9, color: "rgba(255,255,255,0.8)", fontWeight: "700", letterSpacing: 0.6 },
  sep: { fontSize: 11, color: "rgba(255,255,255,0.3)" },
  meta: { fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: "600", letterSpacing: 0.5 },
  versionsLink: {
    fontSize: 10,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "600",
    letterSpacing: 0.5,
    textDecorationLine: "underline",
  },
  date: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginLeft: 8 },

  versionPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "transparent",
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.55)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  versionName: { fontSize: 14, fontWeight: "600", color: "#fff", flex: 1, marginRight: 8 },
  versionTag: { fontWeight: "400", color: "rgba(255,255,255,0.6)" },
  versionDate: { fontSize: 12, color: "rgba(255,255,255,0.5)" },

  // ─── Versions drawer ───
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  drawerCard: {
    backgroundColor: "#0c0c0c",
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.6)",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    width: "100%",
  },
  drawerDivider: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginTop: 18,
    marginBottom: 4,
  },
  drawerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    marginTop: 14,
    marginBottom: 2,
  },
  drawerEmpty: {
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    marginTop: 12,
    marginBottom: 4,
  },
  drawerHide: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 14,
  },
  drawerHideText: { fontSize: 14, color: "rgba(255,255,255,0.7)", fontWeight: "500" },
});

// Create modal styles
const mo = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 4,
  },
  logo: { fontSize: 20, fontWeight: "800", color: "#13131a", letterSpacing: 1 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderWidth: 1, borderColor: "rgba(0,0,0,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  backIcon: { color: "#13131a", fontSize: 24, fontWeight: "300", lineHeight: 28, marginTop: -2 },
  profileCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderWidth: 1, borderColor: "rgba(0,0,0,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  profileIcon: { fontSize: 16 },
  pageTitle: {
    fontSize: 32, fontWeight: "800", color: "#13131a",
    letterSpacing: -1, paddingHorizontal: 20, marginTop: 6, marginBottom: 16,
  },
  fieldWrap: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 12,
  },
  input: { fontSize: 15, color: "#13131a", fontWeight: "500" },
  descWrap: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    marginBottom: 16,
  },
  descLabel: { fontSize: 12, fontWeight: "600", color: "rgba(0,0,0,0.45)", marginBottom: 6 },
  descInput: { fontSize: 14, color: "#13131a", minHeight: 80 },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  cancelBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  cancelBtnText: { color: "#13131a", fontSize: 14 },
  saveBtn: {
    backgroundColor: "#C6FF00",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  saveBtnText: { color: "#13131a", fontSize: 15, fontWeight: "700" },
});
