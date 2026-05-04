import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, StyleSheet, Image,
  Linking, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";

// ─── Tag Chip Input (shared) ──────────────────────────────────────────────────

const NOTE_SUGGESTIONS = [
  "Bergamot","Lemon","Lime","Orange","Grapefruit","Neroli",
  "Rose","Jasmine","Iris","Lily","Peony","Violet","Tuberose","Gardenia","Ylang-Ylang",
  "Cedar","Sandalwood","Vetiver","Guaiac Wood",
  "Musk","Amber","Tonka Bean","Vanilla",
  "Apple","Pear","Peach","Plum","Blackcurrant","Fig",
  "Black Pepper","Pink Pepper","Cardamom","Cinnamon","Ginger","Saffron",
  "Green Tea","Mint","Basil","Sea Salt","Marine",
];

const FRAGRANCE_FAMILIES = [
  { label: "Floral",   bg: "rgba(252,167,167,0.2)", border: "rgba(252,167,167,0.5)" },
  { label: "Woody",    bg: "rgba(180,120,60,0.2)",  border: "rgba(180,120,60,0.5)"  },
  { label: "Citrus",   bg: "rgba(253,230,60,0.15)", border: "rgba(253,230,60,0.4)"  },
  { label: "Amber",    bg: "rgba(251,146,60,0.2)",  border: "rgba(251,146,60,0.5)"  },
  { label: "Aquatic",  bg: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.4)"  },
  { label: "Green",    bg: "rgba(74,222,128,0.15)", border: "rgba(74,222,128,0.4)"  },
  { label: "Spicy",    bg: "rgba(248,113,113,0.15)",border: "rgba(248,113,113,0.4)" },
  { label: "Gourmand", bg: "rgba(192,132,252,0.15)",border: "rgba(192,132,252,0.4)" },
  { label: "Aromatic", bg: "rgba(52,211,153,0.15)", border: "rgba(52,211,153,0.4)"  },
  { label: "Chypre",   bg: "rgba(163,230,53,0.15)", border: "rgba(163,230,53,0.4)"  },
  { label: "Leather",  bg: "rgba(120,80,40,0.25)",  border: "rgba(120,80,40,0.5)"   },
  { label: "Fougère",  bg: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.4)"   },
];

function TagChipInput({
  tags, onAdd, onRemove, placeholder, suggestions,
}: {
  tags: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder: string;
  suggestions?: string[];
}) {
  const [val, setVal] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const filtered = (suggestions ?? [])
    .filter((s) => val.length > 0 && s.toLowerCase().includes(val.toLowerCase()) && !tags.includes(s))
    .slice(0, 5);
  const commit = (v: string) => {
    const t = v.trim();
    if (t && !tags.includes(t)) onAdd(t);
    setVal(""); setShowSuggest(false);
  };
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={tci.wrap}>
        {tags.map((tag, i) => (
          <TouchableOpacity key={i} style={tci.chip} onPress={() => onRemove(i)}>
            <Text style={tci.chipText}>{tag} ✕</Text>
          </TouchableOpacity>
        ))}
        <TextInput
          style={tci.input}
          value={val}
          onChangeText={(t) => { setVal(t); setShowSuggest(true); }}
          onSubmitEditing={() => commit(val)}
          placeholder={tags.length === 0 ? placeholder : "+"}
          placeholderTextColor="rgba(255,255,255,0.3)"
          returnKeyType="done"
        />
      </View>
      {showSuggest && filtered.length > 0 && (
        <BlurView intensity={24} tint="dark" style={tci.suggest}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(30,10,5,0.85)", borderRadius: 12 }]} />
          {filtered.map((s) => (
            <TouchableOpacity key={s} style={tci.suggestRow} onPress={() => commit(s)}>
              <Text style={tci.suggestText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </BlurView>
      )}
    </View>
  );
}

const tci = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 10, minHeight: 44 },
  chip: { backgroundColor: "rgba(167,139,250,0.2)", borderWidth: 1, borderColor: "rgba(167,139,250,0.4)", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { color: "#d8b4fe", fontSize: 12 },
  input: { color: "#fff", fontSize: 13, minWidth: 60, flex: 1, paddingVertical: 2 },
  suggest: { borderRadius: 12, overflow: "hidden", marginTop: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  suggestRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  suggestText: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
});

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
const SEASON_ICONS: Record<string, string> = { Spring: "🌸", Summer: "☀️", Fall: "🍂", Winter: "❄️" };

// ─── Glass helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <BlurView intensity={28} tint="dark" style={sd.section}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18 }]} />
      <Text style={sd.sectionTitle}>{title}</Text>
      {children}
    </BlurView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={sd.infoRow}>
      <Text style={sd.infoLabel}>{label}</Text>
      <Text style={sd.infoValue}>{value}</Text>
    </View>
  );
}

function TagRow({ items, accent }: { items: string[]; accent?: boolean }) {
  return (
    <View style={sd.tagRow}>
      {items.map((item) => (
        <View key={item} style={[sd.tag, accent && sd.tagAccent]}>
          <Text style={[sd.tagText, accent && sd.tagTextAccent]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────

const SEASONS_LIST = SEASONS;

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[em.chip, active && em.chipActive]}>
      <Text style={em.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={em.label}>{text}</Text>;
}

function Field({ style, ...props }: React.ComponentProps<typeof TextInput> & { style?: object }) {
  return <TextInput style={[em.input, style]} placeholderTextColor="rgba(255,255,255,0.3)" {...props} />;
}

function EditModal({ visible, entry, onClose, onSaved }: {
  visible: boolean; entry: JournalEntry; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [perfumer, setPerfumer] = useState("");
  const [year, setYear] = useState("");
  const [gender, setGender] = useState("");
  const [priceText, setPriceText] = useState("");
  const [rating, setRating] = useState("");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [entryDate, setEntryDate] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [notesTop, setNotesTop] = useState<string[]>([]);
  const [notesHeart, setNotesHeart] = useState<string[]>([]);
  const [notesBase, setNotesBase] = useState<string[]>([]);
  const [accords, setAccords] = useState<string[]>([]);
  const [projection, setProjection] = useState("");
  const [sillage, setSillage] = useState("");
  const [longevity, setLongevity] = useState("");
  const [dryDown, setDryDown] = useState("");
  const [emotions, setEmotions] = useState<string[]>([]);
  const [musicUrl, setMusicUrl] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(entry.title ?? "");
    setDescription(entry.description ?? "");
    setBrand(entry.brand ?? "");
    setPerfumer(entry.perfumer ?? "");
    setYear(entry.year?.toString() ?? "");
    setGender(entry.gender ?? "");
    setPriceText(entry.price_text ?? "");
    setRating(entry.rating_10?.toString() ?? "");
    setSeasons(entry.seasons ?? []);
    setIsPublic(entry.is_public);
    setEntryDate(entry.entry_date);
    setTimeOfDay(entry.time_of_day ?? "");
    setNotesTop(entry.notes_top ?? []);
    setNotesHeart(entry.notes_heart ?? []);
    setNotesBase(entry.notes_base ?? []);
    setAccords(entry.accords ?? []);
    setProjection(entry.projection ?? "");
    setSillage(entry.sillage ?? "");
    setLongevity(entry.longevity ?? "");
    setDryDown(entry.dry_down ?? "");
    setEmotions(entry.emotions ?? []);
    setMusicUrl(entry.music_url ?? "");
    setMusicTitle(entry.music_title ?? "");
  }, [visible, entry]);

  const handleSave = async () => {
    setSaving(true);
    await (supabase as any).from("journal_entries").update({
      title: title.trim() || null,
      description: description.trim() || null,
      brand: brand.trim() || null,
      perfumer: perfumer.trim() || null,
      year: year ? parseInt(year) : null,
      gender: gender.trim() || null,
      price_text: priceText.trim() || null,
      rating_10: rating ? parseFloat(rating) : null,
      seasons: seasons.length ? seasons : null,
      is_public: isPublic,
      entry_date: entryDate,
      time_of_day: timeOfDay.trim() || null,
      notes_top: notesTop.length ? notesTop : null,
      notes_heart: notesHeart.length ? notesHeart : null,
      notes_base: notesBase.length ? notesBase : null,
      accords: accords.length ? accords : null,
      projection: projection.trim() || null,
      sillage: sillage.trim() || null,
      longevity: longevity.trim() || null,
      dry_down: dryDown.trim() || null,
      emotions: emotions.length ? emotions : null,
      music_url: musicUrl.trim() || null,
      music_title: musicTitle.trim() || null,
    }).eq("id", entry.id);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={em.screen}>
        <View style={em.header}>
          <TouchableOpacity onPress={onClose}><Text style={em.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={em.headerTitle}>Edit Entry</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#a78bfa" size="small" /> : <Text style={em.save}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {/* Core */}
          <Text style={em.sectionLabel}>Core</Text>
          <FieldLabel text="Title" /><Field placeholder="Entry title…" value={title} onChangeText={setTitle} />
          <FieldLabel text="Description / Notes" />
          <Field placeholder="How did it smell, perform, make you feel…" value={description} onChangeText={setDescription} multiline style={{ height: 90, textAlignVertical: "top" }} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}><FieldLabel text="Date" /><Field placeholder="YYYY-MM-DD" value={entryDate} onChangeText={setEntryDate} /></View>
            <View style={{ flex: 1 }}><FieldLabel text="Rating (0–10)" /><Field placeholder="8.5" value={rating} onChangeText={setRating} keyboardType="decimal-pad" /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}><FieldLabel text="Time of Day" /><Field placeholder="Morning, Evening…" value={timeOfDay} onChangeText={setTimeOfDay} /></View>
            <View style={{ flex: 1 }}><FieldLabel text="Visibility" />
              <TouchableOpacity style={em.toggleVis} onPress={() => setIsPublic((v) => !v)}>
                <Text style={{ color: "#fff", fontSize: 14 }}>{isPublic ? "🌐 Public" : "🔒 Private"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={em.sectionLabel}>Season</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {SEASONS_LIST.map((s) => (
              <Chip key={s} label={`${SEASON_ICONS[s]} ${s}`} active={seasons.includes(s)} onPress={() => setSeasons((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])} />
            ))}
          </View>

          {/* Fragrance Info */}
          <Text style={em.sectionLabel}>Fragrance Info</Text>
          <FieldLabel text="Brand" /><Field placeholder="Chanel, Dior…" value={brand} onChangeText={setBrand} />
          <FieldLabel text="Perfumer" /><Field placeholder="Jacques Polge…" value={perfumer} onChangeText={setPerfumer} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}><FieldLabel text="Year" /><Field placeholder="2019" value={year} onChangeText={setYear} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><FieldLabel text="Gender" /><Field placeholder="Unisex, Feminine…" value={gender} onChangeText={setGender} /></View>
          </View>
          <FieldLabel text="Price" /><Field placeholder="$180 / 100ml" value={priceText} onChangeText={setPriceText} />

          {/* Fragrance Family */}
          <Text style={em.sectionLabel}>Fragrance Family</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {FRAGRANCE_FAMILIES.map(({ label, bg, border }) => {
              const active = accords.includes(label);
              return (
                <TouchableOpacity
                  key={label}
                  style={[em.familyChip, { backgroundColor: bg, borderColor: active ? border : "rgba(255,255,255,0.12)" }]}
                  onPress={() => setAccords((p) => p.includes(label) ? p.filter((x) => x !== label) : [...p, label])}
                >
                  <Text style={[em.familyChipText, active && { color: "#fff", fontWeight: "700" }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Fragrance Pyramid */}
          <Text style={em.sectionLabel}>Fragrance Pyramid</Text>
          <FieldLabel text="▲ Top Notes" />
          <TagChipInput tags={notesTop} onAdd={(v) => setNotesTop((p) => [...p, v])} onRemove={(i) => setNotesTop((p) => p.filter((_, j) => j !== i))} placeholder="Type + done…" suggestions={NOTE_SUGGESTIONS} />
          <FieldLabel text="◆ Heart Notes" />
          <TagChipInput tags={notesHeart} onAdd={(v) => setNotesHeart((p) => [...p, v])} onRemove={(i) => setNotesHeart((p) => p.filter((_, j) => j !== i))} placeholder="Type + done…" suggestions={NOTE_SUGGESTIONS} />
          <FieldLabel text="● Base Notes" />
          <TagChipInput tags={notesBase} onAdd={(v) => setNotesBase((p) => [...p, v])} onRemove={(i) => setNotesBase((p) => p.filter((_, j) => j !== i))} placeholder="Type + done…" suggestions={NOTE_SUGGESTIONS} />

          {/* Performance */}
          <Text style={em.sectionLabel}>Performance</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}><FieldLabel text="Projection" /><Field placeholder="Moderate" value={projection} onChangeText={setProjection} /></View>
            <View style={{ flex: 1 }}><FieldLabel text="Sillage" /><Field placeholder="Heavy" value={sillage} onChangeText={setSillage} /></View>
          </View>
          <FieldLabel text="Longevity" /><Field placeholder="8 hours" value={longevity} onChangeText={setLongevity} />
          <FieldLabel text="Dry Down" />
          <Field placeholder="Describe the dry down character…" value={dryDown} onChangeText={setDryDown} multiline style={{ height: 70, textAlignVertical: "top" }} />

          {/* Mood */}
          <Text style={em.sectionLabel}>Mood</Text>
          <FieldLabel text="Emotions" />
          <TagChipInput tags={emotions} onAdd={(v) => setEmotions((p) => [...p, v])} onRemove={(i) => setEmotions((p) => p.filter((_, j) => j !== i))} placeholder="Nostalgic, Confident…" />

          {/* Music */}
          <Text style={em.sectionLabel}>Music</Text>
          <FieldLabel text="Music URL (Spotify / YouTube)" /><Field placeholder="https://open.spotify.com/…" value={musicUrl} onChangeText={setMusicUrl} keyboardType="url" />
          <FieldLabel text="Music Title" /><Field placeholder="Song name" value={musicTitle} onChangeText={setMusicTitle} />

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const em = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#1a0e05" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  cancel: { color: "rgba(255,255,255,0.5)", fontSize: 16 },
  save: { color: "#a78bfa", fontSize: 16, fontWeight: "700" },
  sectionLabel: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 24, marginBottom: 12 },
  hint: { color: "rgba(255,255,255,0.3)", fontSize: 12, marginBottom: 8, marginTop: -8 },
  label: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: "#fff", fontSize: 14, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.06)" },
  chipActive: { backgroundColor: "rgba(167,139,250,0.3)", borderColor: "#a78bfa" },
  chipText: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  toggleVis: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14 },
  familyChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  familyChipText: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
});

// ─── Detail Screen ────────────────────────────────────────────────────────────

export default function JournalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);

  const fetchEntry = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("journal_entries")
      .select("*, perfumes:perfume_id (name)")
      .eq("id", id)
      .single();
    setEntry(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchEntry(); }, [fetchEntry]);

  const handleDelete = () => {
    Alert.alert("Delete Entry", "Remove this journal entry? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await (supabase as any).from("journal_entries").delete().eq("id", id);
          router.back();
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!entry) return;
    try {
      await Share.share({ message: `${entry.title || "Journal Entry"} — ${entry.brand ?? ""}\n${entry.description ?? ""}`.trim() });
    } catch {}
  };

  if (loading) {
    return (
      <GradientScreen gradient="journal">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#a78bfa" size="large" />
        </View>
      </GradientScreen>
    );
  }

  if (!entry) {
    return (
      <GradientScreen gradient="journal">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.5)" }}>Entry not found</Text>
        </View>
      </GradientScreen>
    );
  }

  const date = new Date(entry.entry_date).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const displayName = entry.title || entry.perfumes?.name || `Entry ${date}`;
  const hasFragranceInfo = entry.brand || entry.perfumer || entry.year || entry.gender || entry.price_text;
  const hasPyramid = entry.notes_top?.length || entry.notes_heart?.length || entry.notes_base?.length;
  const hasPerformance = entry.projection || entry.sillage || entry.longevity || entry.dry_down;

  return (
    <GradientScreen gradient="journal">
      {/* Nav bar */}
      <View style={sd.nav}>
        <TouchableOpacity onPress={() => router.back()} style={sd.navBtn}>
          <Text style={sd.navBack}>‹ Back</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity onPress={handleShare} style={sd.navIconBtn}>
            <Text style={sd.navIconText}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditVisible(true)} style={sd.navIconBtn}>
            <Text style={sd.navIconText}>✎</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={[sd.navIconBtn, { borderColor: "rgba(248,113,113,0.4)" }]}>
            <Text style={[sd.navIconText, { color: "#f87171" }]}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        {/* Hero image */}
        {entry.image_url && (
          <BlurView intensity={20} tint="dark" style={sd.heroWrap}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20 }]} />
            <Image source={{ uri: entry.image_url }} style={sd.heroImage} resizeMode="cover" />
          </BlurView>
        )}

        {/* Title block */}
        <View style={sd.titleBlock}>
          <View style={sd.titleRow}>
            <Text style={sd.entryTitle}>{displayName}</Text>
            <View style={sd.visTag}>
              <Text style={sd.visTagText}>{entry.is_public ? "🌐" : "🔒"}</Text>
            </View>
          </View>
          <View style={sd.metaRow}>
            <Text style={sd.metaText}>📅 {date}</Text>
            {entry.time_of_day ? <Text style={sd.metaDot}>·</Text> : null}
            {entry.time_of_day ? <Text style={sd.metaText}>🕐 {entry.time_of_day}</Text> : null}
          </View>
          {entry.rating_10 != null && (
            <View style={sd.ratingRow}>
              {Array.from({ length: 10 }).map((_, i) => (
                <Text key={i} style={[sd.star, i < Math.round(entry.rating_10!) && sd.starFilled]}>★</Text>
              ))}
              <Text style={sd.ratingNum}>{entry.rating_10}/10</Text>
            </View>
          )}
          {entry.seasons?.length ? (
            <View style={sd.tagRow}>
              {entry.seasons.map((s) => (
                <View key={s} style={sd.tag}>
                  <Text style={sd.tagText}>{SEASON_ICONS[s]} {s}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Description */}
        {entry.description ? (
          <GlassRow style={sd.descBlock}>
            <Text style={sd.descText}>{entry.description}</Text>
          </GlassRow>
        ) : null}

        {/* Fragrance Info */}
        {hasFragranceInfo ? (
          <Section title="Fragrance Information">
            {entry.brand ? <InfoRow label="Brand" value={entry.brand} /> : null}
            {entry.perfumer ? <InfoRow label="Perfumer" value={entry.perfumer} /> : null}
            {entry.year ? <InfoRow label="Year" value={String(entry.year)} /> : null}
            {entry.gender ? <InfoRow label="Gender" value={entry.gender} /> : null}
            {entry.price_text ? <InfoRow label="Price" value={entry.price_text} /> : null}
          </Section>
        ) : null}

        {/* Fragrance Pyramid */}
        {hasPyramid ? (
          <Section title="Fragrance Pyramid">
            {entry.notes_top?.length ? (
              <View style={sd.pyramidBlock}>
                <Text style={sd.pyramidLabel}>▲ Top Notes</Text>
                <TagRow items={entry.notes_top} />
              </View>
            ) : null}
            {entry.notes_heart?.length ? (
              <View style={sd.pyramidBlock}>
                <Text style={sd.pyramidLabel}>◆ Heart Notes</Text>
                <TagRow items={entry.notes_heart} />
              </View>
            ) : null}
            {entry.notes_base?.length ? (
              <View style={sd.pyramidBlock}>
                <Text style={sd.pyramidLabel}>● Base Notes</Text>
                <TagRow items={entry.notes_base} accent />
              </View>
            ) : null}
          </Section>
        ) : null}

        {/* Accords */}
        {entry.accords?.length ? (
          <Section title="Accords">
            <TagRow items={entry.accords} />
          </Section>
        ) : null}

        {/* Performance */}
        {hasPerformance ? (
          <Section title="Performance">
            {entry.projection ? <InfoRow label="Projection" value={entry.projection} /> : null}
            {entry.sillage ? <InfoRow label="Sillage" value={entry.sillage} /> : null}
            {entry.longevity ? <InfoRow label="Longevity" value={entry.longevity} /> : null}
            {entry.dry_down ? (
              <View style={sd.dryDownBlock}>
                <Text style={sd.infoLabel}>Dry Down</Text>
                <Text style={sd.dryDownText}>{entry.dry_down}</Text>
              </View>
            ) : null}
          </Section>
        ) : null}

        {/* Colors */}
        {entry.colors?.length ? (
          <Section title="Colors">
            <View style={sd.colorsRow}>
              {entry.colors.map((c, i) => (
                <View key={i} style={[sd.colorSwatch, { backgroundColor: c }]} />
              ))}
            </View>
          </Section>
        ) : null}

        {/* Emotions */}
        {entry.emotions?.length ? (
          <Section title="Emotions">
            <TagRow items={entry.emotions} />
          </Section>
        ) : null}

        {/* Music */}
        {(entry.music_url || entry.music_title) ? (
          <Section title="Music">
            {entry.music_title ? <Text style={sd.musicTitle}>🎵 {entry.music_title}</Text> : null}
            {entry.music_url ? (
              <TouchableOpacity
                style={sd.musicLink}
                onPress={() => Linking.openURL(entry.music_url!)}
              >
                <Text style={sd.musicLinkText}>
                  Open in {entry.music_source === "spotify" ? "Spotify" : entry.music_source === "youtube" ? "YouTube" : "Browser"} ↗
                </Text>
              </TouchableOpacity>
            ) : null}
          </Section>
        ) : null}
      </ScrollView>

      {entry && (
        <EditModal
          visible={editVisible}
          entry={entry}
          onClose={() => setEditVisible(false)}
          onSaved={() => { setEditVisible(false); fetchEntry(); }}
        />
      )}
    </GradientScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sd = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  navBtn: { paddingVertical: 4 },
  navBack: { color: "#a78bfa", fontSize: 17, fontWeight: "600" },
  navIconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  navIconText: { color: "rgba(255,255,255,0.8)", fontSize: 16 },
  heroWrap: { borderRadius: 20, overflow: "hidden", marginBottom: 16, height: 260, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  heroImage: { width: "100%", height: "100%" },
  titleBlock: { marginBottom: 16 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  entryTitle: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.5, flex: 1, marginRight: 10, lineHeight: 30 },
  visTag: { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  visTagText: { fontSize: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  metaText: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
  metaDot: { color: "rgba(255,255,255,0.25)", fontSize: 13 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 10 },
  star: { color: "rgba(255,255,255,0.2)", fontSize: 16 },
  starFilled: { color: "#f59e0b" },
  ratingNum: { color: "#f59e0b", fontSize: 13, fontWeight: "700", marginLeft: 6 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  tagAccent: { backgroundColor: "rgba(167,139,250,0.15)", borderColor: "rgba(167,139,250,0.35)" },
  tagTextAccent: { color: "#c4b5fd" },
  descBlock: { padding: 16, marginBottom: 12 },
  descText: { color: "rgba(255,255,255,0.85)", lineHeight: 24, fontSize: 15 },
  section: { borderRadius: 18, overflow: "hidden", padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  sectionTitle: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  infoLabel: { color: "rgba(255,255,255,0.4)", fontSize: 13 },
  infoValue: { color: "#fff", fontSize: 13, fontWeight: "500", flex: 1, textAlign: "right", marginLeft: 16 },
  pyramidBlock: { marginBottom: 12 },
  pyramidLabel: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 6 },
  dryDownBlock: { paddingTop: 8 },
  dryDownText: { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 20, marginTop: 4 },
  colorsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  musicTitle: { color: "rgba(255,255,255,0.8)", fontSize: 15, marginBottom: 12 },
  musicLink: { backgroundColor: "rgba(167,139,250,0.2)", borderWidth: 1, borderColor: "rgba(167,139,250,0.4)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
  musicLinkText: { color: "#a78bfa", fontSize: 14, fontWeight: "600" },
});
