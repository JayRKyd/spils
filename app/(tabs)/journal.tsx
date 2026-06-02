import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, StyleSheet,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
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

interface ScentOfDayEntry {
  id: string;
  perfume_name: string;
  entry_date: string;
}

const SEASONS = ["Spring", "Summer", "Fall", "Winter"];
const SEASON_ICONS: Record<string, string> = {
  Spring: "🌸", Summer: "☀️", Fall: "🍂", Winter: "❄️",
};

// ─── Glass Panel ─────────────────────────────────────────────────────────────

function GlassPanel({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[gp.panel, style]}>
      {children}
    </View>
  );
}

const gp = StyleSheet.create({
  panel: { borderRadius: 20, backgroundColor: "rgba(0,0,0,0.06)", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", overflow: "hidden" },
});

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
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(14,14,22,0.88)", borderRadius: 24 }]} />
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
  applyBtn: { backgroundColor: "#13131a", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  applyText: { color: "#E5F772", fontWeight: "700", fontSize: 15 },
});

// ─── Entry Card ──────────────────────────────────────────────────────────────

function EntryCard({ entry }: { entry: JournalEntry }) {
  const d = new Date(entry.entry_date + "T12:00:00");
  const date = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
  const displayName = entry.title || entry.perfumes?.name || `Entry ${date}`;

  return (
    <TouchableOpacity onPress={() => router.push(`/journal/${entry.id}` as any)} activeOpacity={0.75}>
      <View style={s.card}>
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
      </View>
    </TouchableOpacity>
  );
}

// ─── Archive Card ────────────────────────────────────────────────────────────

function ArchiveCard({ entry }: { entry: JournalEntry }) {
  const d = new Date(entry.entry_date + "T12:00:00");
  const date = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
  const displayName = entry.title || entry.perfumes?.name || `Entry ${date}`;

  return (
    <TouchableOpacity onPress={() => router.push(`/journal/${entry.id}` as any)} activeOpacity={0.75}>
      <View style={arc.card}>
        {/* Thumbnail */}
        <View style={arc.thumb}>
          {entry.image_url ? (
            <Image source={{ uri: entry.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Text style={arc.thumbEmoji}>📔</Text>
          )}
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={arc.topRow}>
            <Text style={arc.title} numberOfLines={1}>{displayName}</Text>
            <Text style={arc.date}>{date}</Text>
          </View>
          {entry.brand ? <Text style={arc.brand} numberOfLines={1}>{entry.brand}</Text> : null}
          {entry.description ? (
            <Text style={arc.desc} numberOfLines={2}>{entry.description}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const arc = StyleSheet.create({
  card: { flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  thumb: { width: 62, height: 62, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.08)", overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  thumbEmoji: { fontSize: 26 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 2 },
  title: { color: "#13131a", fontWeight: "700", fontSize: 14, flex: 1, marginRight: 8 },
  date: { color: "rgba(19,19,26,0.4)", fontSize: 11 },
  brand: { color: "rgba(19,19,26,0.5)", fontSize: 12, marginBottom: 3 },
  desc: { color: "rgba(19,19,26,0.5)", fontSize: 12, lineHeight: 17 },
});

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
    <View style={{ flex: 1 }}>
      {/* Calendar — fixed, does not scroll */}
      <GlassPanel style={{ marginBottom: 12 }}>
        <View style={cal.nav}>
          <TouchableOpacity onPress={prevMonth} style={cal.navBtn}><Text style={cal.navArrow}>‹</Text></TouchableOpacity>
          <Text style={cal.monthTitle}>{monthName}</Text>
          <TouchableOpacity onPress={nextMonth} style={cal.navBtn}><Text style={cal.navArrow}>›</Text></TouchableOpacity>
        </View>
        <View style={cal.weekRow}>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <Text key={d} style={cal.dayHeader}>{d}</Text>
          ))}
        </View>
        <View style={cal.grid}>
          {days.map((d, i) => {
            if (!d) return <View key={`e-${i}`} style={cal.cell} />;
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const hasEntries = !!entryMap[key];
            const isToday = key === todayStr;
            const isSelected = key === selectedDate;
            const filled = isSelected || isToday;
            return (
              <TouchableOpacity
                key={key}
                style={[cal.cell, hasEntries && !filled && cal.cellHasEntry, filled && cal.cellFilled]}
                onPress={() => setSelectedDate(isSelected ? null : key)}
              >
                <Text style={[cal.cellText, filled && cal.cellTextFilled]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassPanel>

      {/* Selected day entries — independently scrollable */}
      {selectedDate && (
        <View style={{ flex: 1 }}>
          <Text style={cal.dayLabel}>
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {selectedEntries.length === 0 ? (
              <Text style={cal.noEntries}>No entries this day</Text>
            ) : (
              selectedEntries.map((e) => (
                <View key={e.id} style={{ marginBottom: 10 }}>
                  <EntryCard entry={e} />
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const cal = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  navBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navArrow: { color: "#13131a", fontSize: 22, fontWeight: "300" },
  monthTitle: { color: "#13131a", fontSize: 15, fontWeight: "700", letterSpacing: 1 },
  weekRow: { flexDirection: "row", paddingHorizontal: 8, paddingBottom: 6 },
  dayHeader: { flex: 1, textAlign: "center", color: "rgba(19,19,26,0.4)", fontSize: 11, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingBottom: 14 },
  cell: { width: "14.285%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 100 },
  cellHasEntry: { borderWidth: 1, borderColor: "rgba(19,19,26,0.35)" },
  cellFilled: { backgroundColor: "#13131a" },
  cellText: { color: "rgba(19,19,26,0.75)", fontSize: 13 },
  cellTextFilled: { color: "#E5F772", fontWeight: "700" },
  dayLabel: { color: "rgba(19,19,26,0.55)", fontSize: 13, fontWeight: "600", marginBottom: 10, marginTop: 4 },
  noEntries: { color: "rgba(19,19,26,0.4)", textAlign: "center", paddingVertical: 20, fontSize: 14 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function Journal() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState<Filters>({ seasons: [], minRating: 0, visibility: "all" });
  const [view, setView] = useState<"landing" | "list" | "calendar" | "sotd">("landing");
  const [sotdInput, setSotdInput] = useState("");
  const [sotdSaving, setSotdSaving] = useState(false);
  const [sotdEntries, setSotdEntries] = useState<ScentOfDayEntry[]>([]);
  const [sotdLoading, setSotdLoading] = useState(false);

  const handleSotdSave = async () => {
    if (!sotdInput.trim()) return;
    setSotdSaving(true);
    await (supabase as any).from("scent_of_day").insert([{
      user_id: user?.id,
      perfume_name: sotdInput.trim(),
      entry_date: new Date().toISOString().slice(0, 10),
    }]);
    setSotdInput("");
    setSotdSaving(false);
    fetchSotdEntries();
  };

  const fetchSotdEntries = useCallback(async () => {
    setSotdLoading(true);
    const { data } = await (supabase as any)
      .from("scent_of_day")
      .select("*")
      .order("created_at", { ascending: false });
    setSotdEntries(data ?? []);
    setSotdLoading(false);
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("journal_entries")
      .select("*, perfumes:perfume_id (name)")
      .order("entry_date", { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchEntries(); fetchSotdEntries(); }, [fetchEntries, fetchSotdEntries]));

  const activeFilterCount =
    filters.seasons.length +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.visibility !== "all" ? 1 : 0);


  const toggleView = (v: "sotd" | "calendar") =>
    setView((prev) => (prev === v ? "landing" : v));

  return (
    <LinearGradient colors={["#E5F772", "#F2C842"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top nav */}
        <View style={s.topNav}>
          <Text style={s.logoText}>SP/LS.</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)} style={s.profileBtn}>
            <Text style={s.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <Text style={s.pageTitle}>Journal</Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity style={s.iconBtn} onPress={() => setFilterVisible(true)}>
                <Text style={s.iconBtnText}>⚙</Text>
                <View style={s.badge}><Text style={s.badgeText}>{activeFilterCount}</Text></View>
              </TouchableOpacity>
            )}
          </View>

          {/* Search */}
          <GlassPanel style={s.searchWrap}>
            <View style={s.searchInner}>
              <Text style={s.searchIcon}>🔍</Text>
              <TextInput
                style={s.searchInput}
                placeholder="Search entries, brands, perfumes…"
                placeholderTextColor="rgba(19,19,26,0.35)"
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Text style={{ color: "rgba(19,19,26,0.4)", fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </GlassPanel>

          {/* View chips */}
          <View style={s.chipRow}>
            <TouchableOpacity
              style={[s.viewChip, view === "sotd" && s.viewChipActive]}
              onPress={() => toggleView("sotd")}
            >
              <Text style={[s.viewChipText, view === "sotd" && s.viewChipTextActive]} numberOfLines={1}>Scent of the Day</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.viewChip, view === "calendar" && s.viewChipActive]}
              onPress={() => toggleView("calendar")}
            >
              <Text style={[s.viewChipText, view === "calendar" && s.viewChipTextActive]} numberOfLines={1}>Calendar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#13131a" style={{ marginTop: 48 }} />
        ) : view === "landing" ? (
          <View style={s.heroWrap}>
            <Image
              source={require("../../assets/magnific__create-a-modern-fashion-editorial-with-this-refere__42180.png")}
              style={s.heroImage}
              resizeMode="cover"
            />
          </View>
        ) : view === "calendar" ? (
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            <CalendarView entries={entries} onSelectEntry={(e) => router.push(`/journal/${e.id}` as any)} />
          </View>
        ) : view === "sotd" ? (
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            {/* Quick log input */}
            <View style={s.sotdInputRow}>
              <TextInput
                style={s.sotdInput}
                placeholder="Perfume No. 5"
                placeholderTextColor="rgba(19,19,26,0.35)"
                value={sotdInput}
                onChangeText={setSotdInput}
                returnKeyType="done"
                onSubmitEditing={handleSotdSave}
              />
              <TouchableOpacity
                style={[s.sotdSaveBtn, (!sotdInput.trim() || sotdSaving) && { opacity: 0.4 }]}
                onPress={handleSotdSave}
                disabled={!sotdInput.trim() || sotdSaving}
              >
                {sotdSaving ? <ActivityIndicator size="small" color="#13131a" /> : <Text style={s.sotdSaveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>

            {/* Entry history — minimal rows */}
            <FlatList
              data={sotdEntries}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 100, gap: 8 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const d = new Date(item.entry_date + "T12:00:00");
                const date = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
                return (
                  <View style={s.sotdRow}>
                    <Text style={s.sotdRowName} numberOfLines={1}>{item.perfume_name}</Text>
                    <Text style={s.sotdRowDate}>{date}</Text>
                  </View>
                );
              }}
            />
          </View>
        ) : (
          <FlatList
            data={entries.filter((e) => {
              const q = search.toLowerCase();
              if (q && !((e.title ?? "").toLowerCase().includes(q) || (e.brand ?? "").toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q) || (e.perfumes?.name ?? "").toLowerCase().includes(q))) return false;
              if (filters.seasons.length && !e.seasons?.some((season) => filters.seasons.includes(season))) return false;
              if (filters.minRating > 0 && (e.rating_10 == null || e.rating_10 < filters.minRating)) return false;
              if (filters.visibility === "public" && !e.is_public) return false;
              if (filters.visibility === "private" && e.is_public) return false;
              return true;
            })}
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
        )}

        <FilterModal
          visible={filterVisible}
          filters={filters}
          onApply={setFilters}
          onClose={() => setFilterVisible(false)}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  logoText: { color: "#13131a", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.08)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },
  header: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 10 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { color: "#13131a", fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.08)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center" },
  iconBtnText: { fontSize: 18 },
  badge: { position: "absolute", top: -4, right: -4, backgroundColor: "#13131a", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: "#E5F772", fontSize: 10, fontWeight: "700" },
  searchWrap: { borderRadius: 16 },
  searchInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: "#13131a", fontSize: 14 },
  chipRow: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  viewChip: { flex: 1, height: 40, borderRadius: 24, borderWidth: 1, borderColor: "rgba(0,0,0,0.2)", backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },
  viewChipActive: { backgroundColor: "#13131a", borderColor: "#13131a" },
  viewChipText: { color: "rgba(19,19,26,0.55)", fontSize: 13, fontWeight: "600", textAlign: "center" },
  viewChipTextActive: { color: "#E5F772" },
  card: { flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  thumb: { width: 62, height: 62, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.08)", overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  thumbEmoji: { fontSize: 26 },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 2 },
  cardTitle: { color: "#13131a", fontWeight: "700", fontSize: 14, flex: 1, marginRight: 8 },
  cardDate: { color: "rgba(19,19,26,0.4)", fontSize: 11 },
  cardBrand: { color: "rgba(19,19,26,0.55)", fontSize: 12, marginBottom: 2 },
  cardDesc: { color: "rgba(19,19,26,0.5)", fontSize: 12, lineHeight: 17 },
  cardMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 },
  cardMetaText: { color: "rgba(19,19,26,0.4)", fontSize: 12 },
  ratingPill: { backgroundColor: "rgba(19,19,26,0.08)", borderWidth: 1, borderColor: "rgba(19,19,26,0.2)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  ratingText: { color: "#13131a", fontSize: 11, fontWeight: "600" },
  seasonPill: { backgroundColor: "rgba(0,0,0,0.06)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  seasonPillText: { color: "rgba(19,19,26,0.6)", fontSize: 11 },
  sotdInputRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.06)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 50, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, marginBottom: 12 },
  sotdInput: { flex: 1, color: "#13131a", fontSize: 14, paddingVertical: 6 },
  sotdSaveBtn: { backgroundColor: "rgba(0,0,0,0.08)", borderRadius: 50, paddingHorizontal: 18, paddingVertical: 8 },
  sotdSaveBtnText: { color: "#13131a", fontSize: 13, fontWeight: "600" },
  sotdRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.04)", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  sotdRowName: { color: "#13131a", fontWeight: "600", fontSize: 14, flex: 1, marginRight: 12 },
  sotdRowDate: { color: "rgba(19,19,26,0.4)", fontSize: 12 },
  heroWrap: { flex: 1, marginHorizontal: 16, marginBottom: 100, borderRadius: 24, overflow: "hidden" },
  heroImage: { width: "100%", height: "100%" },
  emptyState: { alignItems: "center", paddingVertical: 64 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: "#13131a", fontSize: 17, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { color: "rgba(19,19,26,0.45)", fontSize: 14, textAlign: "center" },
  fab: { position: "absolute", bottom: 28, alignSelf: "center", left: "50%", marginLeft: -28, width: 56, height: 56, borderRadius: 28, backgroundColor: "#13131a", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabIcon: { color: "#E5F772", fontSize: 30, fontWeight: "300", lineHeight: 34 },
});
