import { useState, useEffect, useCallback, useRef } from "react";
import { ProfileIcon } from "@/components/ProfileIcon";
import { useFocusEffect } from "@react-navigation/native";
import { SpilsLogo } from "../../components/SpilsLogo";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, StyleSheet,
  Image, KeyboardAvoidingView, Platform, Alert, AppState, AppStateStatus,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Video, ResizeMode } from "expo-av";
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
  gender?: string | null;
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
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, overflow: "hidden", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.9)", borderBottomWidth: 0 },
  confirmBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: 36 },
  confirmCard: { backgroundColor: "#141414", borderRadius: 20, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.9)", padding: 24 },
  confirmTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 8 },
  confirmMsg: { color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 20, marginBottom: 20 },
  confirmRow: { flexDirection: "row", gap: 12 },
  confirmBtn: { flex: 1, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 100, paddingVertical: 13, alignItems: "center" },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  confirmDeleteText: { color: "#ff5252", fontSize: 15, fontWeight: "600" },
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
  genderLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginHorizontal: 20, marginBottom: 8 },
  genderRow: { flexDirection: "row", gap: 8, marginHorizontal: 20, marginBottom: 16 },
  genderChip: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center" },
  genderChipActive: { backgroundColor: "#a78bfa", borderColor: "#a78bfa" },
  genderChipText: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" },
  genderChipTextActive: { color: "#fff" },
});

// ─── Entry Card ──────────────────────────────────────────────────────────────

function EntryCard({ entry, light }: { entry: JournalEntry; light?: boolean }) {
  const d = new Date(entry.entry_date + "T12:00:00");
  const date = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
  const displayName = entry.title || entry.perfumes?.name || `Entry ${date}`;

  return (
    <TouchableOpacity onPress={() => router.push(`/journal/${entry.id}` as any)} activeOpacity={0.75}>
      <View style={[s.card, light && s.cardLight]}>
        {/* Thumbnail */}
        <View style={[s.thumb, light && s.thumbLight]}>
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
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const entryMap: Record<string, JournalEntry[]> = {};
  entries.forEach((e) => {
    const key = e.entry_date.slice(0, 10);
    if (!entryMap[key]) entryMap[key] = [];
    entryMap[key].push(e);
  });

  const monthName = new Date(year, month).toLocaleString("en-US", { month: "long" }).toUpperCase();

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  type Cell = { day: number; current: boolean; key: string };
  const cells: Cell[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ day: d, current: false, key: `${py}-${String(pm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true, key: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  const remaining = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ day: d, current: false, key: `${ny}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }

  const selectedEntries = selectedDate ? (entryMap[selectedDate] ?? []) : [];

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["rgba(237,255,141,0.18)", "rgba(28,28,26,0.9)", "rgba(28,28,26,0.9)"]}
        locations={[0, 0.42, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={cal.panel}
      >
        {/* Month nav */}
        <View style={cal.nav}>
          <TouchableOpacity onPress={prevMonth} style={cal.navBtn}><Text style={cal.navArrow}>‹</Text></TouchableOpacity>
          <Text style={cal.monthTitle}>{monthName}</Text>
          <TouchableOpacity onPress={nextMonth} style={cal.navBtn}><Text style={cal.navArrow}>›</Text></TouchableOpacity>
        </View>

        {/* Grid */}
        <View style={cal.grid}>
          {cells.map((cell, i) => {
            if (!cell.current) return <View key={i} style={cal.cell} />;
            const isSelected = cell.key === selectedDate;
            const hasEntries = !!entryMap[cell.key];
            return (
              <TouchableOpacity
                key={i}
                style={cal.cell}
                onPress={() => setSelectedDate(isSelected ? null : cell.key)}
                activeOpacity={0.7}
              >
                <View style={[cal.dayCircle, hasEntries && !isSelected && cal.dayOutlined, isSelected && cal.dayActive]}>
                  <Text style={[cal.cellText, isSelected && cal.cellTextActive]}>{cell.day}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* Selected day entries */}
      {selectedDate && (
        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {selectedEntries.length === 0 ? (
              <Text style={cal.noEntries}>No entries this day</Text>
            ) : (
              selectedEntries.map((e) => (
                <View key={e.id} style={{ marginBottom: 10 }}>
                  <EntryCard entry={e} light />
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
  panel: { borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", marginBottom: 16, paddingBottom: 16, overflow: "hidden" },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18 },
  navBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navArrow: { color: "rgba(255,255,255,0.75)", fontSize: 26, fontWeight: "300" },
  monthTitle: { color: "#fff", fontSize: 30, fontWeight: "300", letterSpacing: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingBottom: 4 },
  cell: { width: "14.285%", height: 46, alignItems: "center", justifyContent: "center" },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  dayOutlined: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.45)" },
  dayActive: { backgroundColor: "#edff8d" },
  cellText: { color: "#fff", fontSize: 14 },
  cellTextActive: { color: "#13131a", fontWeight: "700" },
  noEntries: { color: "rgba(255,255,255,0.45)", textAlign: "center", paddingVertical: 20, fontSize: 14 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function Journal() {
  const { user } = useAuth();
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
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
  const [sotdSelected, setSotdSelected] = useState<ScentOfDayEntry | null>(null);
  const [sotdEditValue, setSotdEditValue] = useState("");
  const [sotdActionSaving, setSotdActionSaving] = useState(false);
  const [sotdEditGender, setSotdEditGender] = useState("");
  const [sotdDeleteConfirm, setSotdDeleteConfirm] = useState(false);

  const handleSotdSave = async () => {
    if (!sotdInput.trim()) return;
    setSotdSaving(true);
    await (supabase as any).from("scent_of_day").insert([{
      user_id: user?.id,
      perfume_name: sotdInput.trim(),
      entry_date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })(),
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

  const handleSotdEdit = async () => {
    if (!sotdSelected || !sotdEditValue.trim()) return;
    setSotdActionSaving(true);
    await (supabase as any).from("scent_of_day").update({ perfume_name: sotdEditValue.trim() }).eq("id", sotdSelected.id);
    setSotdActionSaving(false);
    setSotdSelected(null);
    fetchSotdEntries();
  };

  const handleSotdDelete = () => {
    if (!sotdSelected) return;
    setSotdDeleteConfirm(true);
  };

  const confirmSotdDelete = async () => {
    if (!sotdSelected) return;
    setSotdDeleteConfirm(false);
    setSotdActionSaving(true);
    await (supabase as any).from("scent_of_day").delete().eq("id", sotdSelected.id);
    setSotdActionSaving(false);
    setSotdSelected(null);
    fetchSotdEntries();
  };

  const fetchEntries = useCallback(async () => {
    if (!userRef.current?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("journal_entries")
      .select("*, perfumes:perfume_id (name)")
      .eq("user_id", userRef.current.id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) console.error("fetchEntries error:", error.message);
    if (!error && data) setEntries(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchEntries(); fetchSotdEntries(); }, [fetchEntries, fetchSotdEntries]));

  // Refetch when app comes back to foreground (covers the case where useFocusEffect
  // doesn't re-fire after returning from journal/new via router.back())
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        fetchEntries();
        fetchSotdEntries();
      }
    });
    return () => sub.remove();
  }, [fetchEntries, fetchSotdEntries]);

  // Real-time subscription — keeps calendar dots live without any user action.
  // We use a full refetch on INSERT/UPDATE (instead of relying on payload.new)
  // because Supabase Realtime with RLS doesn't populate payload.new reliably.
  useEffect(() => {
    if (!userRef.current?.id) return;
    const uid = userRef.current.id;
    const channel = (supabase as any)
      .channel(`journal-entries-live-${uid}`)
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "journal_entries", filter: `user_id=eq.${uid}` },
        (payload: any) => {
          setEntries((prev) => prev.filter((e) => e.id !== payload.old?.id));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "journal_entries", filter: `user_id=eq.${uid}` },
        () => { fetchEntries(); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "journal_entries", filter: `user_id=eq.${uid}` },
        () => { fetchEntries(); }
      )
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [fetchEntries]);

  const activeFilterCount =
    filters.seasons.length +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.visibility !== "all" ? 1 : 0);


  const toggleView = (v: "sotd" | "calendar") =>
    setView((prev) => (prev === v ? "landing" : v));

  return (
    <LinearGradient colors={["#000000", "#000000", "#C9F24D"]} locations={[0, 0.82, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top nav */}
        <View style={s.topNav}>
          <SpilsLogo height={22} color="#edff8d" />
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)} style={[s.profileBtn, { backgroundColor: "transparent", borderWidth: 0 }]}>
            <ProfileIcon size={34} />
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

        {/* Hero video — always mounted so it's loaded and ready instantly */}
        <View style={[s.heroWrap, view !== "landing" && { display: "none" }]}>
          <Video
            source={require("../../assets/JOURNAL VIDEO - ORB.mp4")}
            style={s.heroImage}
            resizeMode={ResizeMode.COVER}
            shouldPlay={view === "landing"}
            isLooping
            isMuted
          />
        </View>

        {view !== "landing" && (loading && entries.length === 0 ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 48 }} />
        ) : view === "calendar" ? (
          <View style={{ flex: 1, paddingHorizontal: 30 }}>
            <CalendarView entries={entries} onSelectEntry={(e) => router.push(`/journal/${e.id}` as any)} />
          </View>
        ) : view === "sotd" ? (
          <View style={{ flex: 1, paddingHorizontal: 30 }}>
            {/* Quick log input */}
            <View style={s.sotdInputRow}>
              <TextInput
                style={s.sotdInput}
                placeholder="Your SOTD..."
                placeholderTextColor="#fff"
                value={sotdInput}
                onChangeText={setSotdInput}
                returnKeyType="done"
                onSubmitEditing={handleSotdSave}
              />
              <TouchableOpacity
                style={s.sotdSaveBtn}
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
              contentContainerStyle={{ paddingBottom: 100, gap: 10 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const d = new Date(item.entry_date + "T12:00:00");
                const date = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
                return (
                  <View style={s.sotdRow}>
                    <Text style={s.sotdRowName} numberOfLines={1}>{item.perfume_name}</Text>
                    <View style={s.sotdActions}>
                      <Text style={s.sotdRowDate}>{date}</Text>
                      <Text style={s.sotdActionSep}>|</Text>
                      <TouchableOpacity onPress={() => { setSotdSelected(item); setSotdEditValue(item.perfume_name); setSotdEditGender(item.gender ?? ""); }}>
                        <Text style={s.sotdActionBtn}>Edit</Text>
                      </TouchableOpacity>
                    </View>
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
        ))}

        <FilterModal
          visible={filterVisible}
          filters={filters}
          onApply={setFilters}
          onClose={() => setFilterVisible(false)}
        />

        {/* SOTD edit / delete modal */}
        <Modal visible={!!sotdSelected} transparent animationType="slide" onRequestClose={() => setSotdSelected(null)}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={fm.backdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSotdSelected(null)} />
            <BlurView intensity={40} tint="dark" style={fm.sheet}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(14,14,22,0.88)", borderRadius: 24 }]} />
              <View style={{ position: "relative" }}>
                <View style={fm.handle} />
                <View style={fm.header}>
                  <Text style={fm.title}>Edit Entry</Text>
                  <TouchableOpacity onPress={() => setSotdSelected(null)}>
                    <Text style={fm.clear}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={s.sotdEditInput}
                  value={sotdEditValue}
                  onChangeText={setSotdEditValue}
                  placeholder="Perfume name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoFocus={false}
                />
                <TouchableOpacity
                  style={[s.sotdModalBtn, { backgroundColor: "#E5F772", marginBottom: 10 }, (!sotdEditValue.trim() || sotdActionSaving) && { opacity: 0.4 }]}
                  onPress={handleSotdEdit}
                  disabled={!sotdEditValue.trim() || sotdActionSaving}
                >
                  {sotdActionSaving ? <ActivityIndicator size="small" color="#13131a" /> : <Text style={[s.sotdModalBtnText, { color: "#13131a" }]}>Save changes</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.sotdModalBtn, { backgroundColor: "rgba(255,60,60,0.18)", borderWidth: 1, borderColor: "rgba(255,60,60,0.35)" }, sotdActionSaving && { opacity: 0.4 }]}
                  onPress={handleSotdDelete}
                  disabled={sotdActionSaving}
                >
                  <Text style={[s.sotdModalBtnText, { color: "#ff6b6b" }]}>Delete entry</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Delete confirm — custom card w/ 0.5 white stroke */}
        <Modal visible={sotdDeleteConfirm} transparent animationType="fade" onRequestClose={() => setSotdDeleteConfirm(false)}>
          <View style={fm.confirmBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSotdDeleteConfirm(false)} />
            <View style={fm.confirmCard}>
              <Text style={fm.confirmTitle}>Delete Entry</Text>
              <Text style={fm.confirmMsg}>Are you sure you want to delete this entry?</Text>
              <View style={fm.confirmRow}>
                <TouchableOpacity style={fm.confirmBtn} onPress={() => setSotdDeleteConfirm(false)}>
                  <Text style={fm.confirmBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={fm.confirmBtn} onPress={confirmSotdDelete}>
                  <Text style={fm.confirmDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 12, paddingBottom: 4 },
  logoText: { color: "#13131a", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },
  header: { paddingHorizontal: 30, paddingTop: 73, paddingBottom: 12, gap: 10 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { color: "#fff", fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  iconBtnText: { fontSize: 18, color: "#fff" },
  badge: { position: "absolute", top: -4, right: -4, backgroundColor: "#edff8d", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: "#13131a", fontSize: 10, fontWeight: "700" },
  searchWrap: { borderRadius: 16 },
  searchInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: "#13131a", fontSize: 14 },
  chipRow: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  viewChip: { flex: 1, height: 40, borderRadius: 100, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  viewChipActive: { backgroundColor: "#edff8d", borderColor: "#edff8d" },
  viewChipText: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center" },
  viewChipTextActive: { color: "#13131a" },
  card: { flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  thumb: { width: 62, height: 62, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.08)", overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  thumbEmoji: { fontSize: 26 },
  cardLight: { backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" },
  thumbLight: { backgroundColor: "rgba(0,0,0,0.12)", borderColor: "rgba(0,0,0,0.08)" },
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
  sotdInputRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 50, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, marginBottom: 16 },
  sotdInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 6 },
  sotdSaveBtn: { backgroundColor: "#fff", borderRadius: 50, paddingHorizontal: 18, paddingVertical: 8 },
  sotdSaveBtnText: { color: "#13131a", fontSize: 13, fontWeight: "600" },
  sotdRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16 },
  sotdRowName: { color: "#fff", fontWeight: "600", fontSize: 14, flex: 1, marginRight: 8 },
  sotdRowDate: { color: "#fff", fontSize: 12 },
  sotdActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  sotdActionBtn: { color: "#fff", fontSize: 12, fontWeight: "600" },
  sotdActionSep: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  sotdEditInput: { color: "#fff", fontSize: 15, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 20, marginBottom: 16 },
  sotdModalBtn: { marginHorizontal: 20, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  sotdModalBtnText: { fontSize: 14, fontWeight: "700" },
  heroWrap: { flex: 1, marginHorizontal: 30, marginBottom: 100, borderRadius: 24, overflow: "hidden" },
  heroImage: { width: "100%", height: "100%" },
  emptyState: { alignItems: "center", paddingVertical: 64 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: "#13131a", fontSize: 17, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { color: "rgba(19,19,26,0.45)", fontSize: 14, textAlign: "center" },
  fab: { position: "absolute", bottom: 28, alignSelf: "center", left: "50%", marginLeft: -28, width: 56, height: 56, borderRadius: 28, backgroundColor: "#13131a", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabIcon: { color: "#E5F772", fontSize: 30, fontWeight: "300", lineHeight: 34 },
});
