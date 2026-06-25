import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet, Image, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import { supabase } from "@/lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────

const MOOD_BUCKET = "moodboard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapshotLine {
  material_id: number;
  amount_g: number;
  name: string | null;
}

interface Snapshot {
  bottle_ml: number;
  concentration_pct: number;
  diluent: string;
  lines: SnapshotLine[];
}

interface VersionRow {
  id: string;
  formula_id: number;
  version_num: number;
  notes: string | null;
  label: string | null;
  created_at: string;
  formulas?: { name: string; description: string | null } | null;
}

interface MoodItem {
  id: string;
  file_url: string;
  media_type: "image" | "note" | "audio" | "video";
  caption: string | null;
  display_url?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function extractStoragePath(fileUrl: string): string | null {
  const v = (fileUrl ?? "").trim();
  if (!v || v === "EMPTY") return null;
  if (!v.startsWith("http")) return v.replace(/^\/+/, "");
  const idx = v.indexOf("/moodboard/");
  if (idx === -1) return null;
  return decodeURIComponent(v.slice(idx + "/moodboard/".length).split("?")[0]);
}

async function resolveSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(MOOD_BUCKET).createSignedUrl(path, 86400);
  return data?.signedUrl ?? null;
}

// ─── Editable Line Row ────────────────────────────────────────────────────────

function EditableLine({ line, pct, onUpdate }: { line: SnapshotLine; pct: string; onUpdate: (g: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(line.amount_g.toFixed(3));

  const commit = () => {
    const n = parseFloat(val);
    if (Number.isFinite(n) && n >= 0) onUpdate(n);
    else setVal(line.amount_g.toFixed(3));
    setEditing(false);
  };

  return (
    <View style={s.lineRow}>
      <Text style={s.lineName} numberOfLines={1}>
        {line.name ?? `Material #${line.material_id}`}
      </Text>
      <View style={s.lineRight}>
        {editing ? (
          <TextInput
            style={s.lineInput}
            value={val}
            onChangeText={setVal}
            keyboardType="decimal-pad"
            onBlur={commit}
            onSubmitEditing={commit}
            autoFocus
            selectTextOnFocus
          />
        ) : (
          <TouchableOpacity onPress={() => { setVal(line.amount_g.toFixed(3)); setEditing(true); }}>
            <Text style={s.lineAmt}>{line.amount_g.toFixed(3)}g</Text>
          </TouchableOpacity>
        )}
        <Text style={s.linePct}>{pct}%</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FormulaVersionDetail() {
  const { versionId } = useLocalSearchParams<{ versionId: string }>();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<VersionRow | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [moodItems, setMoodItems] = useState<MoodItem[]>([]);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelVal, setLabelVal] = useState("");
  const [saving, setSaving] = useState(false);
  const labelRef = useRef<TextInput>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Load version row
      const { data, error } = await supabase
        .from("formula_versions")
        .select("*, formulas(name, description)")
        .eq("id", versionId)
        .single();
      if (error || !data) { setLoading(false); return; }
      const row = data as VersionRow;
      setVersion(row);
      setLabelVal(row.label ?? `Version ${row.version_num}`);

      if (row.notes) {
        try {
          const parsed: Snapshot = JSON.parse(row.notes);
          // Backfill names for old snapshots that stored null
          const missingIds = parsed.lines.filter((l) => !l.name).map((l) => l.material_id);
          if (missingIds.length) {
            const { data: mats } = await supabase
              .from("materials").select("id,name").in("id", missingIds);
            const nameMap: Record<number, string> = {};
            (mats ?? []).forEach((m: any) => { nameMap[m.id] = m.name; });
            parsed.lines = parsed.lines.map((l) => ({ ...l, name: l.name ?? nameMap[l.material_id] ?? null }));
          }
          setSnapshot(parsed);
        } catch { /* non-JSON notes */ }
      }

      // Load mood board items for this formula
      const { data: moodData } = await supabase
        .from("formula_moodboard_assets")
        .select("*")
        .eq("formula_id", row.formula_id)
        .order("created_at", { ascending: false });

      const raw = (moodData ?? []) as MoodItem[];
      const resolved: MoodItem[] = [];
      for (const item of raw) {
        if (item.media_type === "note") { resolved.push({ ...item, display_url: null }); continue; }
        const path = extractStoragePath(item.file_url);
        if (!path) { resolved.push({ ...item, display_url: item.file_url || null }); continue; }
        resolved.push({ ...item, display_url: await resolveSignedUrl(path) });
      }
      setMoodItems(resolved);

      setLoading(false);
    };
    load();
  }, [versionId]);

  const updateLineAmount = (index: number, amount_g: number) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      const lines = prev.lines.map((l, i) => i === index ? { ...l, amount_g } : l);
      return { ...prev, lines };
    });
  };

  const handleSave = async () => {
    if (!version) return;
    setSaving(true);
    await supabase.from("formula_versions")
      .update({
        label: labelVal.trim() || null,
        ...(snapshot ? { notes: JSON.stringify(snapshot) } : {}),
      })
      .eq("id", versionId);
    setSaving(false);
    router.back();
  };

  const totalG = snapshot?.lines?.reduce((s, l) => s + l.amount_g, 0) ?? 0;
  const noteItems = moodItems.filter((i) => i.media_type === "note");
  const mediaItems = moodItems.filter((i) => i.media_type !== "note" && i.display_url);

  return (
    <LinearGradient colors={["#FFD4E6", "#F5AEC8", "#EC8FB5"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>← Lab</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : !version ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16 }}>Version not found.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {/* Title block */}
            <View style={s.titleBlock}>
              <Text style={s.formulaName}>{version.formulas?.name ?? "Formula"}</Text>
              <TouchableOpacity
                style={s.versionBadge}
                onPress={() => { setEditingLabel(true); setTimeout(() => labelRef.current?.focus(), 50); }}
                activeOpacity={0.7}
              >
                {editingLabel ? (
                  <TextInput
                    ref={labelRef}
                    style={s.versionBadgeInput}
                    value={labelVal}
                    onChangeText={setLabelVal}
                    onBlur={() => {
                      setEditingLabel(false);
                      if (!labelVal.trim()) setLabelVal(`Version ${version.version_num}`);
                    }}
                    onSubmitEditing={() => labelRef.current?.blur()}
                    returnKeyType="done"
                    selectTextOnFocus
                    autoCorrect={false}
                  />
                ) : (
                  <Text style={s.versionBadgeText}>{labelVal}</Text>
                )}
              </TouchableOpacity>
              {version.formulas?.description ? (
                <Text style={s.desc}>{version.formulas.description}</Text>
              ) : null}
              <Text style={s.savedOn}>Saved {formatDate(version.created_at)}</Text>
            </View>

            {/* Mood Board */}
            {moodItems.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>MOOD BOARD</Text>

                {/* Notes */}
                {noteItems.map((item) => (
                  <View key={item.id} style={s.noteCard}>
                    <Text style={s.noteText}>{item.caption}</Text>
                  </View>
                ))}

                {/* Images / Videos */}
                {mediaItems.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: noteItems.length > 0 ? 10 : 0 }}>
                    {mediaItems.map((item) => (
                      <View key={item.id} style={s.imageCard}>
                        {item.media_type === "video" ? (
                          <Video
                            source={{ uri: item.display_url! }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode={ResizeMode.COVER}
                            useNativeControls
                            isLooping={false}
                          />
                        ) : (
                          <Image
                            source={{ uri: item.display_url! }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Parameters + Ingredients */}
            {snapshot ? (
              <>
                <View style={s.section}>
                  <Text style={s.sectionTitle}>FORMULA PARAMETERS</Text>
                  <View style={s.paramRow}>
                    <View style={s.paramCard}>
                      <Text style={s.paramLabel}>Bottle Size</Text>
                      <Text style={s.paramValue}>{snapshot.bottle_ml} mL</Text>
                    </View>
                    <View style={s.paramCard}>
                      <Text style={s.paramLabel}>Concentration</Text>
                      <Text style={s.paramValue}>{snapshot.concentration_pct}%</Text>
                    </View>
                  </View>
                  <View style={s.diluentCard}>
                    <Text style={s.paramLabel}>Diluent</Text>
                    <Text style={s.paramValue}>{snapshot.diluent}</Text>
                  </View>
                </View>

                <View style={s.section}>
                  <Text style={s.sectionTitle}>INGREDIENTS</Text>
                  <Text style={s.totalG}>{totalG.toFixed(3)}g total</Text>
                  {snapshot.lines.length === 0 ? (
                    <Text style={s.empty}>No ingredients in this version.</Text>
                  ) : (
                    snapshot.lines
                      .map((line, i) => ({ line, originalIndex: i }))
                      .sort((a, b) => b.line.amount_g - a.line.amount_g)
                      .map(({ line, originalIndex }) => {
                        const pct = totalG > 0 ? ((line.amount_g / totalG) * 100).toFixed(1) : "0.0";
                        return (
                          <EditableLine
                            key={originalIndex}
                            line={line}
                            pct={pct}
                            onUpdate={(g) => updateLineAmount(originalIndex, g)}
                          />
                        );
                      })
                  )}
                </View>
              </>
            ) : (
              <View style={s.section}>
                <Text style={s.empty}>No snapshot data available for this version.</Text>
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        )}

        {!loading && version && (
          <View style={s.bottomBar}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#13131a" size="small" />
                : <Text style={s.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn: { paddingVertical: 6 },
  backText: { color: "rgba(0,0,0,0.6)", fontSize: 15, fontWeight: "600" },
  scroll: { paddingHorizontal: 16, paddingBottom: 60 },
  titleBlock: { marginBottom: 24, marginTop: 8 },
  formulaName: { fontSize: 26, fontWeight: "800", color: "#13131a", letterSpacing: -0.5, marginBottom: 6 },
  versionBadge: { alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.12)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 },
  versionBadgeText: { fontSize: 13, fontWeight: "700", color: "#13131a" },
  versionBadgeInput: { fontSize: 13, fontWeight: "700", color: "#13131a", minWidth: 80, padding: 0, margin: 0 },
  desc: { fontSize: 14, color: "rgba(19,19,26,0.6)", marginBottom: 4, lineHeight: 20 },
  savedOn: { fontSize: 12, color: "rgba(19,19,26,0.45)", marginTop: 4 },
  section: { backgroundColor: "rgba(255,255,255,0.45)", borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "rgba(19,19,26,0.5)", letterSpacing: 1, marginBottom: 12 },
  noteCard: { backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 14, padding: 12, marginBottom: 8 },
  noteText: { fontSize: 14, color: "#13131a", lineHeight: 20 },
  imageCard: { width: "47%", aspectRatio: 1, borderRadius: 14, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.08)" },
  paramRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  paramCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 14, padding: 12, alignItems: "center" },
  diluentCard: { backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 14, padding: 12, alignItems: "center" },
  paramLabel: { fontSize: 11, color: "rgba(19,19,26,0.5)", marginBottom: 4, fontWeight: "600" },
  paramValue: { fontSize: 16, fontWeight: "700", color: "#13131a" },
  totalG: { fontSize: 13, color: "rgba(19,19,26,0.5)", marginBottom: 10, textAlign: "right" },
  lineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  lineName: { flex: 1, fontSize: 14, fontWeight: "600", color: "#13131a", marginRight: 12 },
  lineRight: { flexDirection: "row", gap: 10, alignItems: "center" },
  lineAmt: { fontSize: 14, color: "#13131a", fontWeight: "500" },
  linePct: { fontSize: 12, color: "rgba(19,19,26,0.45)", minWidth: 38, textAlign: "right" },
  empty: { color: "rgba(19,19,26,0.45)", fontSize: 14, textAlign: "center", paddingVertical: 12 },
  lineInput: { borderWidth: 1, borderColor: "rgba(0,0,0,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, fontSize: 14, color: "#13131a", width: 72, textAlign: "right", backgroundColor: "rgba(255,255,255,0.7)" },
  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.08)" },
  cancelBtn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.18)", borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12 },
  cancelBtnText: { color: "#13131a", fontSize: 14, fontWeight: "600" },
  saveBtn: { backgroundColor: "#C6FF00", borderRadius: 24, paddingHorizontal: 32, paddingVertical: 13 },
  saveBtnText: { color: "#13131a", fontSize: 15, fontWeight: "700" },
});
