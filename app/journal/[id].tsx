import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, StyleSheet, Image,
  Linking, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  inspiration_image_url: string | null;
  perfumes?: { name: string } | null;
}

const SEASONS = ["Spring", "Summer", "Fall", "Winter"];
const SEASON_ICONS: Record<string, string> = { Spring: "🌸", Summer: "☀️", Fall: "🍂", Winter: "❄️" };

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ visible, entry, onClose, onSaved }: {
  visible: boolean; entry: JournalEntry; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [perfumer, setPerfumer] = useState("");
  const [gender, setGender] = useState("");
  const [priceText, setPriceText] = useState("");
  const [rating, setRating] = useState("");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [entryDate, setEntryDate] = useState("");
  const [notesTop, setNotesTop] = useState<string[]>([]);
  const [notesHeart, setNotesHeart] = useState<string[]>([]);
  const [notesBase, setNotesBase] = useState<string[]>([]);
  const [accords, setAccords] = useState<string[]>([]);
  const [musicUrl, setMusicUrl] = useState("");
  const [dryDown, setDryDown] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(entry.title ?? "");
    setDescription(entry.description ?? "");
    setBrand(entry.brand ?? "");
    setPerfumer(entry.perfumer ?? "");
    setGender(entry.gender ?? "");
    setPriceText(entry.price_text ?? "");
    setRating(entry.rating_10?.toString() ?? "");
    setSeasons(entry.seasons ?? []);
    setIsPublic(entry.is_public);
    setEntryDate(entry.entry_date);
    setNotesTop(entry.notes_top ?? []);
    setNotesHeart(entry.notes_heart ?? []);
    setNotesBase(entry.notes_base ?? []);
    setAccords(entry.accords ?? []);
    setMusicUrl(entry.music_url ?? "");
    setDryDown(entry.dry_down ?? "");
  }, [visible, entry]);

  const handleSave = async () => {
    setSaving(true);
    await (supabase as any).from("journal_entries").update({
      title: title.trim() || null,
      description: description.trim() || null,
      brand: brand.trim() || null,
      perfumer: perfumer.trim() || null,
      gender: gender.trim() || null,
      price_text: priceText.trim() || null,
      rating_10: rating ? parseFloat(rating) : null,
      seasons: seasons.length ? seasons : null,
      is_public: isPublic,
      entry_date: entryDate,
      notes_top: notesTop.length ? notesTop : null,
      notes_heart: notesHeart.length ? notesHeart : null,
      notes_base: notesBase.length ? notesBase : null,
      accords: accords.length ? accords : null,
      music_url: musicUrl.trim() || null,
      dry_down: dryDown.trim() || null,
    }).eq("id", entry.id);
    setSaving(false);
    onSaved();
  };

  const F = (props: React.ComponentProps<typeof TextInput>) => (
    <TextInput style={em.input} placeholderTextColor="rgba(255,255,255,0.3)" {...props} />
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={em.screen}>
        <View style={em.header}>
          <TouchableOpacity onPress={onClose}><Text style={em.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={em.headerTitle}>Edit Entry</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#a78bfa" size="small" /> : <Text style={em.saveBtn}>Save</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Text style={em.label}>Title</Text><F placeholder="Perfume name…" value={title} onChangeText={setTitle} />
          <Text style={em.label}>Brand</Text><F placeholder="Brand…" value={brand} onChangeText={setBrand} />
          <Text style={em.label}>Perfumer</Text><F placeholder="Perfumer…" value={perfumer} onChangeText={setPerfumer} />
          <Text style={em.label}>Gender</Text><F placeholder="Unisex, Feminine…" value={gender} onChangeText={setGender} />
          <Text style={em.label}>Price</Text><F placeholder="190.00" value={priceText} onChangeText={setPriceText} />
          <Text style={em.label}>Rating (0–10)</Text><F placeholder="8.5" value={rating} onChangeText={setRating} keyboardType="decimal-pad" />
          <Text style={em.label}>Date</Text><F placeholder="YYYY-MM-DD" value={entryDate} onChangeText={setEntryDate} />
          <Text style={em.label}>Notes</Text>
          <F placeholder="Your thoughts…" value={description} onChangeText={setDescription} multiline style={{ height: 90, textAlignVertical: "top" }} />
          <Text style={em.label}>Dry Down</Text>
          <F placeholder="Describe the dry down…" value={dryDown} onChangeText={setDryDown} multiline style={{ height: 80, textAlignVertical: "top" }} />
          <Text style={em.label}>Music URL</Text><F placeholder="Spotify / YouTube link…" value={musicUrl} onChangeText={setMusicUrl} keyboardType="url" />
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const em = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0e0e16" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  cancel: { color: "rgba(255,255,255,0.5)", fontSize: 16 },
  saveBtn: { color: "#a78bfa", fontSize: 16, fontWeight: "700" },
  label: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 6, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.6 },
  input: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: "#fff", fontSize: 14 },
});

// ─── Detail Row ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={d.row}>
      <Text style={d.rowLabel}>{label}</Text>
      <Text style={d.rowValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}

// ─── More Sheet Styles (defined before component to avoid TDZ) ───────────────

const ms = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 10 },
  handle: { width: 40, height: 4, backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  btn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.15)", borderRadius: 100, paddingVertical: 16, alignItems: "center" },
  btnBlue: { backgroundColor: "#30B8E8", borderColor: "#30B8E8" },
  btnDanger: { borderColor: "rgba(220,50,50,0.25)" },
  btnText: { color: "#13131a", fontSize: 15, fontWeight: "500" as const },
  btnTextLight: { color: "#fff" },
});

// ─── Detail Screen ────────────────────────────────────────────────────────────

export default function JournalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);

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

  const handleAddToCollection = async () => {
    if (!entry) return;
    setMoreVisible(false);
    try {
      const { error } = await (supabase as any).from("collection_items").insert([{
        fragrance: entry.title || "Untitled",
        brand: entry.brand || "",
        rating: entry.rating_10 ?? null,
        sillage: entry.sillage ?? null,
        longevity: entry.longevity ?? null,
        gender: entry.gender ?? null,
        color_tags: entry.colors ?? [],
        accords: entry.accords ?? [],
        top_notes: entry.notes_top ?? [],
        heart_notes: entry.notes_heart ?? [],
        base_notes: entry.notes_base ?? [],
        notes: entry.description ?? null,
        image_url: entry.image_url ?? null,
      }]);
      if (error) throw error;
      Alert.alert("Added to Collection", `${entry.title || "Entry"} added to your collection.`);
    } catch {
      Alert.alert("Error", "Could not add to collection.");
    }
  };

  const [inspirationSaving, setInspirationSaving] = useState(false);

  const pickInspirationPhoto = () => {
    Alert.alert("Inspiration Photo", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permission needed", "Allow camera access."); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7, base64: true });
          if (!result.canceled && result.assets[0]) saveInspirationPhoto(result.assets[0]);
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permission needed", "Allow photo library access."); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7, base64: true });
          if (!result.canceled && result.assets[0]) saveInspirationPhoto(result.assets[0]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const saveInspirationPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!entry) return;
    setInspirationSaving(true);
    const imageData = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    await (supabase as any).from("journal_entries").update({ inspiration_image_url: imageData }).eq("id", entry.id);
    setInspirationSaving(false);
    fetchEntry();
  };

  const handleShare = async () => {
    if (!entry) return;
    try {
      await Share.share({ message: `${entry.title || "Journal Entry"} — ${entry.brand ?? ""}\n${entry.description ?? ""}`.trim() });
    } catch {}
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <LinearGradient colors={["#E5F772", "#F2C842"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>{children}</SafeAreaView>
    </LinearGradient>
  );

  if (loading) {
    return <Wrapper><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#13131a" size="large" /></View></Wrapper>;
  }

  if (!entry) {
    return <Wrapper><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "rgba(19,19,26,0.5)" }}>Entry not found</Text></View></Wrapper>;
  }

  const d_ = new Date(entry.entry_date + "T12:00:00");
  const dateStr = `${String(d_.getMonth() + 1).padStart(2, "0")}.${String(d_.getDate()).padStart(2, "0")}.${String(d_.getFullYear()).slice(2)}`;
  const displayName = entry.title || entry.perfumes?.name || "Untitled";

  return (
    <Wrapper>
      {/* Top Nav */}
      <View style={d.topNav}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity style={d.backBtn} onPress={() => router.back()}>
            <Text style={d.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={d.logoText}>SP/LS.</Text>
        </View>
        <TouchableOpacity style={d.profileBtn} onPress={() => router.push("/(tabs)/profile" as any)}>
          <Text style={d.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Page title */}
        <Text style={d.pageTitle}>Journal</Text>

        {/* Entry Header */}
        <View style={d.entryHeader}>
          <View style={d.photoBox}>
            {entry.image_url
              ? <Image source={{ uri: entry.image_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
              : <Text style={d.photoPlaceholder}>Photo</Text>}
          </View>
          <View style={d.entryMeta}>
            <Text style={d.entryTitle} numberOfLines={2}>{displayName}</Text>
            {entry.brand ? <Text style={d.entryBrand}>by {entry.brand}</Text> : null}
            <Text style={d.entryDate}>{dateStr}</Text>
          </View>
        </View>

        {/* Main details card */}
        <View style={d.card}>
          {entry.brand ? <Row label="Brand" value={entry.brand} /> : null}
          {entry.perfumer ? <Row label="Perfumer" value={entry.perfumer} /> : null}
          {entry.gender ? <Row label="Gender" value={entry.gender} /> : null}
          {entry.seasons?.length ? <Row label="Season(s)" value={entry.seasons.map(s => `${SEASON_ICONS[s]} ${s}`).join(", ")} /> : null}
          {entry.price_text ? <Row label="Price" value={entry.price_text} /> : null}
          {entry.rating_10 != null ? <Row label="Rating" value={String(entry.rating_10)} /> : null}

          {/* Divider before notes */}
          {(entry.notes_top?.length || entry.notes_heart?.length || entry.notes_base?.length) ? (
            <View style={d.divider} />
          ) : null}

          {entry.notes_top?.length ? <Row label="Top Notes" value={entry.notes_top.join(", ")} /> : null}
          {entry.notes_heart?.length ? <Row label="Middle Notes" value={entry.notes_heart.join(", ")} /> : null}
          {entry.notes_base?.length ? <Row label="Base Notes" value={entry.notes_base.join(", ")} /> : null}
        </View>

        {/* Accords */}
        {entry.accords?.length ? (
          <View style={d.card}>
            <Text style={d.cardSectionLabel}>Fragrance Family</Text>
            <View style={d.tagRow}>
              {entry.accords.map((a) => (
                <View key={a} style={d.tag}><Text style={d.tagText}>{a}</Text></View>
              ))}
            </View>
          </View>
        ) : null}

        {/* One unified card: Performance + Inspiration + Colors + Music + Notes */}
        <View style={d.card}>
          {entry.projection ? <Row label="Projection" value={entry.projection} /> : null}
          {entry.sillage ? <Row label="Sillage" value={entry.sillage} /> : null}
          {entry.longevity ? <Row label="Longevity" value={entry.longevity} /> : null}
          {entry.dry_down ? <Row label="Dry Down" value={entry.dry_down} /> : null}

          {/* Inspiration photo box inside the card */}
          <TouchableOpacity style={d.inspirationInCard} onPress={pickInspirationPhoto} activeOpacity={0.8}>
            {entry.inspiration_image_url ? (
              <Image source={{ uri: entry.inspiration_image_url }} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} resizeMode="cover" />
            ) : null}
            {inspirationSaving ? (
              <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)", borderRadius: 14 }]}>
                <ActivityIndicator color="#13131a" />
              </View>
            ) : !entry.inspiration_image_url ? (
              <Text style={d.photoPlaceholder}>Tap to upload inspiration photo</Text>
            ) : (
              <View style={{ position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#fff", fontSize: 11 }}>Tap to change</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Colors row */}
          <View style={d.row}>
            <Text style={d.rowLabel}>Colors</Text>
            {entry.colors?.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", flex: 2 }}>
                {entry.colors.map((c, i) => (
                  <View key={i} style={[d.colorSwatch, { backgroundColor: c }]} />
                ))}
              </View>
            ) : (
              <Text style={d.rowValue}>—</Text>
            )}
          </View>

          {/* Music row */}
          {entry.music_url ? (
            <TouchableOpacity style={d.row} onPress={() => Linking.openURL(entry.music_url!)}>
              <Text style={d.rowLabel}>Music</Text>
              <Text style={[d.rowValue, { flexShrink: 1 }]} numberOfLines={2}>
                {entry.music_title || entry.music_url}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={d.row}>
              <Text style={d.rowLabel}>Music</Text>
              <Text style={d.rowValue}>—</Text>
            </View>
          )}

          {/* Notes */}
          <Text style={d.cardSectionLabel}>Notes</Text>
          <Text style={[d.descText, !entry.description && { color: "rgba(19,19,26,0.3)" }]}>
            {entry.description || "No notes added."}
          </Text>
        </View>
        {/* Centered Edit button */}
        <TouchableOpacity style={d.editPill} onPress={() => setEditVisible(true)}>
          <Text style={d.editPillText}>Edit</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={d.bottomBar}>
        <TouchableOpacity style={d.moreBtn} onPress={() => setMoreVisible(true)}>
          <Text style={d.moreBtnText}>More</Text>
        </TouchableOpacity>
        <TouchableOpacity style={d.saveBottomBtn} onPress={() => setEditVisible(true)}>
          <Text style={d.saveBottomBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      {entry && (
        <EditModal
          visible={editVisible}
          entry={entry}
          onClose={() => setEditVisible(false)}
          onSaved={() => { setEditVisible(false); fetchEntry(); }}
        />
      )}
      {/* More Sheet */}
      <Modal visible={moreVisible} transparent animationType="slide" onRequestClose={() => setMoreVisible(false)}>
        <View style={ms.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setMoreVisible(false)} />
          <View style={ms.sheet}>
            <View style={ms.handle} />
            <TouchableOpacity style={ms.btn} onPress={handleShare}>
              <Text style={ms.btnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.btn} onPress={handleAddToCollection}>
              <Text style={ms.btnText}>+Collection</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.btn} onPress={() => { setMoreVisible(false); Alert.alert("Print", "Print coming soon."); }}>
              <Text style={ms.btnText}>Print</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ms.btn, ms.btnDanger]} onPress={() => { setMoreVisible(false); handleDelete(); }}>
              <Text style={[ms.btnText, { color: "#dc2626" }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Wrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const d = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  logoText: { color: "#13131a", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.08)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center" },
  backIcon: { color: "#13131a", fontSize: 24, fontWeight: "300", lineHeight: 28, marginTop: -2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.08)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center" },
  iconBtnText: { fontSize: 15 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.08)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },

  pageTitle: { color: "#13131a", fontSize: 26, fontWeight: "800", letterSpacing: -0.5, marginBottom: 20, paddingHorizontal: 2 },

  entryHeader: { flexDirection: "row", gap: 16, marginBottom: 16 },
  photoBox: { width: 150, height: 150, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  photoPlaceholder: { color: "rgba(19,19,26,0.35)", fontSize: 13 },
  entryMeta: { flex: 1, justifyContent: "center", gap: 4 },
  entryTitle: { color: "#13131a", fontSize: 20, fontWeight: "800", lineHeight: 26 },
  entryBrand: { color: "rgba(19,19,26,0.55)", fontSize: 14, fontWeight: "500" },
  entryDate: { color: "rgba(19,19,26,0.45)", fontSize: 13, marginTop: 4 },

  card: { backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(0,0,0,0.07)", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, marginBottom: 12 },
  cardSectionLabel: { color: "rgba(19,19,26,0.4)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", paddingTop: 12, paddingBottom: 8 },

  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 16 },
  rowLabel: { color: "rgba(19,19,26,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", flex: 1, paddingTop: 1 },
  rowValue: { color: "#13131a", fontSize: 13, fontWeight: "500", flex: 2, textAlign: "right" },

  divider: { height: 1, backgroundColor: "rgba(0,0,0,0.1)", marginVertical: 4 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 12 },
  tag: { backgroundColor: "rgba(0,0,0,0.08)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { color: "#13131a", fontSize: 12, fontWeight: "500" },

  colorSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },

  descText: { color: "rgba(19,19,26,0.75)", fontSize: 14, lineHeight: 22, paddingBottom: 14 },

  inspirationInCard: { height: 180, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.5)", borderWidth: 1, borderColor: "rgba(0,0,0,0.07)", alignItems: "center", justifyContent: "center", marginVertical: 12 },

  editPill: { alignSelf: "center", backgroundColor: "#13131a", borderRadius: 100, paddingHorizontal: 48, paddingVertical: 14, marginTop: 8, marginBottom: 24 },
  editPillText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  moreBtn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.2)", borderRadius: 100, paddingHorizontal: 24, paddingVertical: 13 },
  moreBtnText: { color: "#13131a", fontSize: 14 },
  saveBottomBtn: { backgroundColor: "#13131a", borderRadius: 100, paddingHorizontal: 32, paddingVertical: 14 },
  saveBottomBtnText: { color: "#E5F772", fontSize: 15, fontWeight: "700" },
});

