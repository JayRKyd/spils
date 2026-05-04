import { useState, useEffect, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, StyleSheet,
  Image, Linking, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";

interface JournalEntry {
  id: string;
  title: string | null;
  description: string | null;
  entry_date: string;
  rating_10: number | null;
  is_public: boolean;
  seasons: string[] | null;
  image_url: string | null;
  brand: string | null;
  perfumer: string | null;
  year: number | null;
  perfume_id: number | null;
  accords: string[] | null;
  notes_top: string[] | null;
  notes_heart: string[] | null;
  notes_base: string[] | null;
  projection: string | null;
  sillage: string | null;
  longevity: string | null;
  dry_down: string | null;
  gender: string | null;
  time_of_day: string | null;
  emotions: string[] | null;
  colors: string[] | null;
  price_text: string | null;
  music_url: string | null;
  music_source: string | null;
  music_title: string | null;
  perfumes?: { name: string } | null;
}

const SEASONS = ["Spring", "Summer", "Fall", "Winter"];
const SEASON_ICONS: Record<string, string> = {
  Spring: "🌸", Summer: "☀️", Fall: "🍂", Winter: "❄️",
};

// ─── Glassmorphism helpers ──────────────────────────────────────────────────

function GlassPanel({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <BlurView intensity={30} tint="dark" style={[gp.blur, style]}>
      <View style={[StyleSheet.absoluteFill, gp.overlay]} />
      {children}
    </BlurView>
  );
}

const gp = StyleSheet.create({
  blur: { borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  overlay: { backgroundColor: "rgba(255,255,255,0.07)" },
});

// ─── Chip ───────────────────────────────────────────────────────────────────

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={s.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Filter Modal ────────────────────────────────────────────────────────────

interface Filters {
  seasons: string[];
  minRating: number;
  visibility: "all" | "public" | "private";
}

function FilterModal({
  visible, filters, onApply, onClose,
}: {
  visible: boolean;
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<Filters>(filters);

  useEffect(() => { if (visible) setLocal(filters); }, [visible]);

  const toggleSeason = (s: string) =>
    setLocal((p) => ({
      ...p,
      seasons: p.seasons.includes(s) ? p.seasons.filter((x) => x !== s) : [...p.seasons, s],
    }));

  const ratingSteps = [0, 2, 4, 6, 7, 8, 9, 10];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={fm.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <BlurView intensity={40} tint="dark" style={fm.sheet}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(60,24,10,0.82)", borderRadius: 24 }]} />
          <View style={{ position: "relative" }}>
            <View style={fm.handle} />
            <View style={fm.header}>
              <Text style={fm.title}>Filters</Text>
              <TouchableOpacity onPress={() => setLocal({ seasons: [], minRating: 0, visibility: "all" })}>
                <Text style={fm.clear}>Clear all</Text>
              </TouchableOpacity>
            </View>

            <Text style={fm.label}>Season</Text>
            <View style={fm.row}>
              {SEASONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => toggleSeason(s)}
                  style={[fm.seasonChip, local.seasons.includes(s) && fm.seasonChipActive]}
                >
                  <Text style={fm.seasonIcon}>{SEASON_ICONS[s]}</Text>
                  <Text style={[fm.seasonText, local.seasons.includes(s) && { color: "#fff" }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={fm.label}>Minimum Rating</Text>
            <View style={fm.ratingRow}>
              {ratingSteps.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setLocal((p) => ({ ...p, minRating: r }))}
                  style={[fm.ratingBtn, local.minRating === r && fm.ratingBtnActive]}
                >
                  <Text style={[fm.ratingBtnText, local.minRating === r && { color: "#fff" }]}>
                    {r === 0 ? "Any" : `${r}+`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={fm.label}>Visibility</Text>
            <View style={fm.row}>
              {(["all", "public", "private"] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => setLocal((p) => ({ ...p, visibility: v }))}
                  style={[fm.visBtn, local.visibility === v && fm.visBtnActive]}
                >
                  <Text style={[fm.visBtnText, local.visibility === v && { color: "#fff" }]}>
                    {v === "all" ? "All" : v === "public" ? "🌐 Public" : "🔒 Private"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={fm.applyBtn} onPress={() => { onApply(local); onClose(); }}>
              <Text style={fm.applyText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const fm = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, overflow: "hidden" },
  handle: { width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  clear: { color: "rgba(255,255,255,0.4)", fontSize: 14 },
  label: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  seasonChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.06)" },
  seasonChipActive: { backgroundColor: "rgba(167,139,250,0.3)", borderColor: "#a78bfa" },
  seasonIcon: { fontSize: 14 },
  seasonText: { color: "rgba(255,255,255,0.65)", fontSize: 13 },
  ratingRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  ratingBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.06)" },
  ratingBtnActive: { backgroundColor: "rgba(167,139,250,0.3)", borderColor: "#a78bfa" },
  ratingBtnText: { color: "rgba(255,255,255,0.65)", fontSize: 13 },
  visBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.06)" },
  visBtnActive: { backgroundColor: "rgba(167,139,250,0.3)", borderColor: "#a78bfa" },
  visBtnText: { color: "rgba(255,255,255,0.65)", fontSize: 13 },
  applyBtn: { backgroundColor: "#a78bfa", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  applyText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

// ─── Entry Card ──────────────────────────────────────────────────────────────

function EntryCard({ entry }: { entry: JournalEntry }) {
  const date = new Date(entry.entry_date).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const displayName = entry.title || entry.perfumes?.name || `Entry ${date}`;

  return (
    <TouchableOpacity onPress={() => router.push(`/journal/${entry.id}` as any)} activeOpacity={0.75}>
      <GlassRow style={s.card}>
        {/* Thumbnail */}
        <View style={s.thumb}>
          {entry.image_url ? (
            <Image source={{ uri: entry.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Text style={s.thumbEmoji}>📔</Text>
          )}
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={s.cardTopRow}>
            <Text style={s.cardTitle} numberOfLines={1}>{displayName}</Text>
            <Text style={s.cardDate}>{date}</Text>
          </View>

          {entry.brand ? <Text style={s.cardBrand} numberOfLines={1}>{entry.brand}</Text> : null}
          {entry.description ? (
            <Text style={s.cardDesc} numberOfLines={2}>{entry.description}</Text>
          ) : null}

          <View style={s.cardMeta}>
            {entry.rating_10 != null && (
              <View style={s.ratingPill}>
                <Text style={s.ratingText}>★ {entry.rating_10}/10</Text>
              </View>
            )}
            {entry.seasons?.slice(0, 2).map((season) => (
              <View key={season} style={s.seasonPill}>
                <Text style={s.seasonPillText}>{SEASON_ICONS[season]} {season}</Text>
              </View>
            ))}
            <Text style={[s.cardMetaText, { marginLeft: "auto" }]}>
              {entry.is_public ? "🌐" : "🔒"}
            </Text>
          </View>
        </View>
      </GlassRow>
    </TouchableOpacity>
  );
}

// ─── Calendar View ───────────────────────────────────────────────────────────

function CalendarView({ entries, onSelectEntry }: { entries: JournalEntry[]; onSelectEntry: (e: JournalEntry) => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const entryMap: Record<string, JournalEntry[]> = {};
  entries.forEach((e) => {
    const key = e.entry_date.slice(0, 10);
    if (!entryMap[key]) entryMap[key] = [];
    entryMap[key].push(e);
  });

  const monthName = new Date(year, month).toLocaleString("en-US", { month: "long", year: "numeric" });
  const todayStr = now.toISOString().slice(0, 10);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const selectedEntries = selectedDate ? (entryMap[selectedDate] ?? []) : [];

  return (
    <View>
      {/* Month nav */}
      <GlassPanel style={{ marginBottom: 12 }}>
        <View style={cal.nav}>
          <TouchableOpacity onPress={prevMonth} style={cal.navBtn}><Text style={cal.navArrow}>‹</Text></TouchableOpacity>
          <Text style={cal.monthTitle}>{monthName}</Text>
          <TouchableOpacity onPress={nextMonth} style={cal.navBtn}><Text style={cal.navArrow}>›</Text></TouchableOpacity>
        </View>
        {/* Day headers */}
        <View style={cal.weekRow}>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <Text key={d} style={cal.dayHeader}>{d}</Text>
          ))}
        </View>
        {/* Grid */}
        <View style={cal.grid}>
          {days.map((d, i) => {
            if (!d) return <View key={`e-${i}`} style={cal.cell} />;
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const hasEntries = !!entryMap[key];
            const isToday = key === todayStr;
            const isSelected = key === selectedDate;
            return (
              <TouchableOpacity
                key={key}
                style={[cal.cell, isToday && cal.cellToday, isSelected && cal.cellSelected]}
                onPress={() => setSelectedDate(isSelected ? null : key)}
              >
                <Text style={[cal.cellText, isToday && cal.cellTextToday, isSelected && { color: "#fff", fontWeight: "700" }]}>{d}</Text>
                {hasEntries && (
                  <View style={cal.dot}>
                    {entryMap[key].slice(0, 3).map((_, idx) => (
                      <View key={idx} style={cal.dotDot} />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassPanel>

      {/* Selected day entries */}
      {selectedDate && (
        <View>
          <Text style={cal.dayLabel}>
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          {selectedEntries.length === 0 ? (
            <Text style={cal.noEntries}>No entries this day</Text>
          ) : (
            selectedEntries.map((e) => <EntryCard key={e.id} entry={e} />)
          )}
        </View>
      )}
    </View>
  );
}

const cal = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  navBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navArrow: { color: "#a78bfa", fontSize: 28, lineHeight: 32 },
  monthTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  weekRow: { flexDirection: "row", paddingHorizontal: 8, paddingBottom: 4 },
  dayHeader: { flex: 1, textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingBottom: 12 },
  cell: { width: "14.285%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  cellToday: { borderWidth: 1, borderColor: "rgba(167,139,250,0.5)" },
  cellSelected: { backgroundColor: "#a78bfa" },
  cellText: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  cellTextToday: { color: "#a78bfa", fontWeight: "700" },
  dot: { flexDirection: "row", gap: 2, marginTop: 2 },
  dotDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#a78bfa" },
  dayLabel: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600", marginBottom: 10, marginTop: 4 },
  noEntries: { color: "rgba(255,255,255,0.35)", textAlign: "center", paddingVertical: 20, fontSize: 14 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState<Filters>({ seasons: [], minRating: 0, visibility: "all" });
  const [view, setView] = useState<"list" | "calendar">("list");

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("journal_entries")
      .select("*, perfumes:perfume_id (name)")
      .order("entry_date", { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchEntries(); }, [fetchEntries]));

  const activeFilterCount =
    filters.seasons.length +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.visibility !== "all" ? 1 : 0);

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    if (q && !((e.title ?? "").toLowerCase().includes(q) || (e.brand ?? "").toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q) || (e.perfumes?.name ?? "").toLowerCase().includes(q))) return false;
    if (filters.seasons.length && !e.seasons?.some((s) => filters.seasons.includes(s))) return false;
    if (filters.minRating > 0 && (e.rating_10 == null || e.rating_10 < filters.minRating)) return false;
    if (filters.visibility === "public" && !e.is_public) return false;
    if (filters.visibility === "private" && e.is_public) return false;
    return true;
  });

  return (
    <GradientScreen gradient="journal">
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.pageTitle}>Journal</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={[s.iconBtn, activeFilterCount > 0 && s.iconBtnActive]}
              onPress={() => setFilterVisible(true)}
            >
              <Text style={s.iconBtnText}>⚙</Text>
              {activeFilterCount > 0 && (
                <View style={s.badge}><Text style={s.badgeText}>{activeFilterCount}</Text></View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <GlassPanel style={s.searchWrap}>
          <View style={s.searchInner}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder="Search entries, brands, perfumes…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </GlassPanel>

        {/* View toggle */}
        <GlassPanel style={s.toggle}>
          <View style={s.toggleInner}>
            <TouchableOpacity
              style={[s.toggleBtn, view === "list" && s.toggleBtnActive]}
              onPress={() => setView("list")}
            >
              <Text style={[s.toggleText, view === "list" && s.toggleTextActive]}>≡ List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleBtn, view === "calendar" && s.toggleBtnActive]}
              onPress={() => setView("calendar")}
            >
              <Text style={[s.toggleText, view === "calendar" && s.toggleTextActive]}>📅 Calendar</Text>
            </TouchableOpacity>
          </View>
        </GlassPanel>
      </View>

      {loading ? (
        <ActivityIndicator color="#a78bfa" style={{ marginTop: 48 }} />
      ) : view === "list" ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Text style={s.emptyEmoji}>📔</Text>
              <Text style={s.emptyTitle}>{search || activeFilterCount ? "No matching entries" : "No journal entries yet"}</Text>
              <Text style={s.emptySubtitle}>{search || activeFilterCount ? "Try adjusting your filters" : "Tap + to start your fragrance journal"}</Text>
            </View>
          }
          renderItem={({ item }) => <EntryCard entry={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
          <CalendarView entries={entries} onSelectEntry={(e) => router.push(`/journal/${e.id}` as any)} />
        </ScrollView>
      )}

      {/* FAB */}
      <BlurView intensity={40} tint="dark" style={s.fab}>
        <TouchableOpacity style={s.fabInner} onPress={() => router.push("/journal/new" as any)}>
          <Text style={s.fabIcon}>+</Text>
        </TouchableOpacity>
      </BlurView>

      <FilterModal
        visible={filterVisible}
        filters={filters}
        onApply={setFilters}
        onClose={() => setFilterVisible(false)}
      />
    </GradientScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 10 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  iconBtnActive: { backgroundColor: "rgba(167,139,250,0.25)", borderColor: "#a78bfa" },
  iconBtnText: { fontSize: 18 },
  badge: { position: "absolute", top: -4, right: -4, backgroundColor: "#a78bfa", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  searchWrap: { borderRadius: 16 },
  searchInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },
  toggle: { borderRadius: 14 },
  toggleInner: { flexDirection: "row", padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  toggleBtnActive: { backgroundColor: "rgba(167,139,250,0.35)" },
  toggleText: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  card: { flexDirection: "row", gap: 12, paddingHorizontal: 12, paddingVertical: 12 },
  thumb: { width: 62, height: 62, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  thumbEmoji: { fontSize: 26 },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 2 },
  cardTitle: { color: "#fff", fontWeight: "700", fontSize: 14, flex: 1, marginRight: 8 },
  cardDate: { color: "rgba(255,255,255,0.35)", fontSize: 11 },
  cardBrand: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 2 },
  cardDesc: { color: "rgba(255,255,255,0.45)", fontSize: 12, lineHeight: 17 },
  cardMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 },
  cardMetaText: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  ratingPill: { backgroundColor: "rgba(167,139,250,0.2)", borderWidth: 1, borderColor: "rgba(167,139,250,0.4)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  ratingText: { color: "#a78bfa", fontSize: 11, fontWeight: "600" },
  seasonPill: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  seasonPillText: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
  emptyState: { alignItems: "center", paddingVertical: 64 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center" },
  fab: { position: "absolute", bottom: 28, right: 20, borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: "rgba(167,139,250,0.5)" },
  fabInner: { width: 56, height: 56, backgroundColor: "rgba(167,139,250,0.35)", alignItems: "center", justifyContent: "center" },
  fabIcon: { color: "#fff", fontSize: 30, fontWeight: "300", lineHeight: 34 },
});
