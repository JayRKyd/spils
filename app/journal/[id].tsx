import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, StyleSheet, Image,
  Linking, Share, PanResponder, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import ColorPicker from "react-native-wheel-color-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

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
const FRAGRANCE_FAMILIES = [
  "Aldehydic", "Amber", "Amber Floral", "Amber Woody", "Aquatic",
  "Aromatic", "Aromatic Fougère", "Chypre", "Citrus", "Citrus Woods",
  "Floral", "Fresh", "Fougère", "Fruity", "Gourmand", "Green",
  "Leather", "Mossy Woods", "Musky", "Oriental", "Oriental Floral",
  "Oriental Woody", "Spicy", "Umami", "Woody", "Woody Aromatic",
  "Woody Green", "Woody Spicy",
];

// ─── Edit Modal Styles (hoisted so TagInput + F can reference em) ────────────

const em = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.1)" },
  headerTitle: { color: "#13131a", fontSize: 17, fontWeight: "700" },
  cancel: { color: "rgba(19,19,26,0.5)", fontSize: 16 },
  saveBtn: { color: "#13131a", fontSize: 16, fontWeight: "700" },
  label: { color: "rgba(19,19,26,0.5)", fontSize: 11, fontWeight: "700", marginBottom: 6, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.8 },
  input: { backgroundColor: "rgba(0,0,0,0.07)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: "#13131a", fontSize: 14, marginBottom: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(0,0,0,0.2)", backgroundColor: "rgba(0,0,0,0.06)" },
  chipActive: { backgroundColor: "#13131a", borderColor: "#13131a" },
  chipText: { color: "rgba(19,19,26,0.6)", fontSize: 13 },
  chipTextActive: { color: "#E5F772" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tag: { backgroundColor: "rgba(0,0,0,0.08)", borderWidth: 1, borderColor: "rgba(0,0,0,0.14)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { color: "#13131a", fontSize: 13 },
  organDropdown: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", marginTop: 4, marginBottom: 4, overflow: "hidden" },
  organDropdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  organDropdownText: { color: "#13131a", fontSize: 14 },
  organDropdownHint: { color: "rgba(0,0,0,0.3)", fontSize: 11 },
  publicRow: { marginTop: 20, backgroundColor: "rgba(0,0,0,0.06)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  publicLabel: { color: "#13131a", fontSize: 15, fontWeight: "600" },
  publicSub: { color: "rgba(19,19,26,0.4)", fontSize: 12, marginTop: 2 },
  colorWheelWrap: { height: 320, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", padding: 12, marginBottom: 14 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "rgba(0,0,0,0.15)" },
  addBtn: { backgroundColor: "#13131a", borderRadius: 24, paddingHorizontal: 22, paddingVertical: 13, justifyContent: "center" as const },
  addBtnText: { color: "#E5F772", fontSize: 14, fontWeight: "600" as const },
  chooser: { flex: 1, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, backgroundColor: "rgba(0,0,0,0.07)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  chooserEmpty: { color: "rgba(19,19,26,0.4)", fontSize: 14 },
  chooserFilled: { color: "#13131a", fontSize: 14 },
  chevron: { color: "rgba(19,19,26,0.4)", fontSize: 12 },
  inlineList: { backgroundColor: "rgba(0,0,0,0.06)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 14, marginBottom: 10, overflow: "hidden" as const },
  inlineRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.07)" },
  inlineRowActive: { backgroundColor: "#13131a" },
  inlineRowText: { color: "#13131a", fontSize: 14 },
  inlineRowTextActive: { color: "#E5F772", fontWeight: "600" as const },
  photoUpload: { width: "100%", height: 320, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.06)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 16, overflow: "hidden" as const },
  uploadIcon: { fontSize: 32, marginBottom: 10, opacity: 0.4 },
  uploadLabel: { color: "rgba(19,19,26,0.4)", fontSize: 14 },
  aiStatusBar: { position: "absolute" as const, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.25)", paddingVertical: 6, paddingHorizontal: 12 },
  aiStatusText: { color: "#fff", fontSize: 12, textAlign: "center" as const },
  sliderTrack: { height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.07)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", overflow: "hidden", justifyContent: "center" },
  sliderFill: { position: "absolute" as const, left: 0, top: 0, bottom: 0, borderRadius: 22, backgroundColor: "rgba(19,19,26,0.25)" },
  sliderThumb: { position: "absolute" as const, width: 34, height: 34, borderRadius: 17, backgroundColor: "#13131a", top: 4, transform: [{ translateX: -28 }], shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
});

// ─── Slider ───────────────────────────────────────────────────────────────────

function clamp(v: number) { return Math.min(1, Math.max(0, v)); }

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const containerRef = useRef<View>(null);
  const info = useRef({ x: 0, width: 1 });

  const measure = () => {
    containerRef.current?.measureInWindow((x, _y, width) => {
      if (width > 0) info.current = { x, width };
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        measure();
        onChange(Math.round(clamp((evt.nativeEvent.pageX - info.current.x) / info.current.width) * 10));
      },
      onPanResponderMove: (evt) => {
        onChange(Math.round(clamp((evt.nativeEvent.pageX - info.current.x) / info.current.width) * 10));
      },
    })
  ).current;

  const pct = value / 10;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={em.label}>{label}  <Text style={{ color: "#13131a", fontWeight: "700" }}>{value}</Text></Text>
      <View ref={containerRef} onLayout={measure} style={em.sliderTrack} {...panResponder.panHandlers}>
        <View style={[em.sliderFill, { width: `${pct * 100}%` as any }]} />
        <View style={[em.sliderThumb, { left: `${pct * 100}%` as any }]} />
      </View>
    </View>
  );
}

// ─── Edit Modal Components ────────────────────────────────────────────────────

function F({ style, ...props }: React.ComponentProps<typeof TextInput>) {
  return <TextInput style={[em.input, style]} placeholderTextColor="rgba(19,19,26,0.4)" {...props} />;
}

function TagInput({ tags, inputVal, placeholder, onChangeInput, onAdd, onRemove }: {
  tags: string[]; inputVal: string; placeholder: string;
  onChangeInput: (v: string) => void; onAdd: (v: string) => void; onRemove: (i: number) => void;
}) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!inputVal.trim() || !user?.id) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("materials")
        .select("name")
        .eq("user_id", user.id)
        .ilike("name", `%${inputVal}%`)
        .limit(8);
      setSuggestions(
        (data ?? []).map((m: any) => m.name as string).filter((n) => !tags.includes(n))
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [inputVal, user?.id, tags]);

  const addSuggestion = (name: string) => { onAdd(name); onChangeInput(""); setSuggestions([]); };

  return (
    <View style={{ marginBottom: 4 }}>
      <TextInput
        style={em.input}
        placeholder={placeholder}
        placeholderTextColor="rgba(19,19,26,0.4)"
        value={inputVal}
        onChangeText={onChangeInput}
        onSubmitEditing={() => { if (inputVal.trim()) { onAdd(inputVal.trim()); onChangeInput(""); setSuggestions([]); } }}
        returnKeyType="done"
        blurOnSubmit={false}
      />
      {suggestions.length > 0 && (
        <View style={em.organDropdown}>
          {suggestions.map((name) => (
            <TouchableOpacity key={name} style={em.organDropdownRow} onPress={() => addSuggestion(name)}>
              <Text style={em.organDropdownText}>{name}</Text>
              <Text style={em.organDropdownHint}>Organ</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {tags.length > 0 && (
        <View style={em.tagRow}>
          {tags.map((t, i) => (
            <TouchableOpacity key={i} style={em.tag} onPress={() => onRemove(i)}>
              <Text style={em.tagText}>{t} ×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

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
  const scrollRef = useRef<ScrollView>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState("#a78bfa");
  const [genderOpen, setGenderOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [pendingFamily, setPendingFamily] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [notesTop, setNotesTop] = useState<string[]>([]);
  const [notesHeart, setNotesHeart] = useState<string[]>([]);
  const [notesBase, setNotesBase] = useState<string[]>([]);
  const [accords, setAccords] = useState<string[]>([]);
  const [musicUrl, setMusicUrl] = useState("");
  const [dryDown, setDryDown] = useState("");
  const [projection, setProjection] = useState(5);
  const [sillage, setSillage] = useState(5);
  const [longevity, setLongevity] = useState(5);
  const [topInput, setTopInput] = useState("");
  const [heartInput, setHeartInput] = useState("");
  const [baseInput, setBaseInput] = useState("");
  const [accordInput, setAccordInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [bottleImage, setBottleImage] = useState<string | null>(null);
  const [inspirationImage, setInspirationImage] = useState<string | null>(null);

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
    setProjection(entry.projection ? parseFloat(entry.projection) || 5 : 5);
    setSillage(entry.sillage ? parseFloat(entry.sillage) || 5 : 5);
    setLongevity(entry.longevity ? parseFloat(entry.longevity) || 5 : 5);
    setColors(entry.colors ?? []);
    setSelectedColor("#a78bfa");
    setBottleImage(entry.image_url ?? null);
    setInspirationImage(entry.inspiration_image_url ?? null);
    setTopInput(""); setHeartInput(""); setBaseInput(""); setAccordInput("");
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
      projection: String(projection),
      sillage: String(sillage),
      longevity: String(longevity),
      colors: colors.length ? colors : null,
      image_url: bottleImage ?? null,
      inspiration_image_url: inspirationImage ?? null,
    }).eq("id", entry.id);
    setSaving(false);
    onSaved();
  };

  const pickBottlePhoto = () => {
    Alert.alert("Upload Photo", "Choose an option", [
      { text: "Take Photo", onPress: async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission needed", "Allow camera access."); return; }
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7, base64: true });
        if (!result.canceled && result.assets[0]) setBottleImage(result.assets[0].base64 ? `data:image/jpeg;base64,${result.assets[0].base64}` : result.assets[0].uri);
      }},
      { text: "Choose from Library", onPress: async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission needed", "Allow photo library access."); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7, base64: true });
        if (!result.canceled && result.assets[0]) setBottleImage(result.assets[0].base64 ? `data:image/jpeg;base64,${result.assets[0].base64}` : result.assets[0].uri);
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const pickInspirationPhotoEdit = () => {
    Alert.alert("Inspiration Photo", "Choose an option", [
      { text: "Take Photo", onPress: async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7, base64: true });
        if (!result.canceled && result.assets[0]) setInspirationImage(result.assets[0].base64 ? `data:image/jpeg;base64,${result.assets[0].base64}` : result.assets[0].uri);
      }},
      { text: "Choose from Library", onPress: async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7, base64: true });
        if (!result.canceled && result.assets[0]) setInspirationImage(result.assets[0].base64 ? `data:image/jpeg;base64,${result.assets[0].base64}` : result.assets[0].uri);
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const toggleSeason = (s: string) =>
    setSeasons((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient colors={["#E5F772", "#F2C842"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={em.header}>
            <TouchableOpacity onPress={onClose}><Text style={em.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={em.headerTitle}>Edit Entry</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#13131a" size="small" /> : <Text style={em.saveBtn}>Save</Text>}
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, paddingBottom: 300 }} keyboardShouldPersistTaps="handled">
            {/* Bottle photo */}
            <TouchableOpacity style={em.photoUpload} onPress={pickBottlePhoto} activeOpacity={0.85}>
              {bottleImage && <Image source={{ uri: bottleImage }} style={[StyleSheet.absoluteFill as any, { borderRadius: 18 }]} resizeMode="contain" />}
              {!bottleImage && (
                <>
                  <Text style={em.uploadIcon}>📷</Text>
                  <Text style={em.uploadLabel}>Tap to capture or upload</Text>
                </>
              )}
              {bottleImage && (
                <View style={em.aiStatusBar}><Text style={em.aiStatusText}>Tap to change</Text></View>
              )}
            </TouchableOpacity>

            <Text style={em.label}>Title</Text>
            <F placeholder="Perfume name…" value={title} onChangeText={setTitle} />

            <Text style={em.label}>Brand</Text>
            <F placeholder="Brand…" value={brand} onChangeText={setBrand} />

            <Text style={em.label}>Perfumer</Text>
            <F placeholder="Perfumer…" value={perfumer} onChangeText={setPerfumer} />

            <Text style={em.label}>Gender</Text>
            <TouchableOpacity style={em.chooser} onPress={() => setGenderOpen((v) => !v)}>
              <Text style={gender ? em.chooserFilled : em.chooserEmpty}>{gender || "Select gender"}</Text>
              <Text style={em.chevron}>{genderOpen ? "▴" : "▾"}</Text>
            </TouchableOpacity>
            {genderOpen && (
              <View style={em.inlineList}>
                {["Female", "Male", "Unisex"].map((g) => (
                  <TouchableOpacity key={g} style={[em.inlineRow, gender === g && em.inlineRowActive]} onPress={() => { setGender(g); setGenderOpen(false); }}>
                    <Text style={[em.inlineRowText, gender === g && em.inlineRowTextActive]}>{g}</Text>
                    {gender === g ? <Text style={{ color: "#E5F772" }}>✓</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={em.label}>Price</Text>
                <F placeholder="190.00" value={priceText} onChangeText={setPriceText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={em.label}>Rating (0–10)</Text>
                <F placeholder="8.5" value={rating} onChangeText={setRating} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={em.label}>Date</Text>
            <F placeholder="YYYY-MM-DD" value={entryDate} onChangeText={setEntryDate} />

            <Text style={em.label}>Season(s)</Text>
            <View style={em.chipRow}>
              {SEASONS.map((s) => (
                <TouchableOpacity key={s} style={[em.chip, seasons.includes(s) && em.chipActive]} onPress={() => toggleSeason(s)}>
                  <Text style={[em.chipText, seasons.includes(s) && em.chipTextActive]}>{SEASON_ICONS[s]} {s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={em.label}>Fragrance Family</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <TouchableOpacity style={em.chooser} onPress={() => setFamilyOpen((v) => !v)}>
                <Text style={pendingFamily ? em.chooserFilled : em.chooserEmpty}>{pendingFamily || "Choose family"}</Text>
                <Text style={em.chevron}>{familyOpen ? "▴" : "▾"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[em.addBtn, (!pendingFamily || accords.includes(pendingFamily)) && { opacity: 0.4 }]}
                onPress={() => { if (pendingFamily && !accords.includes(pendingFamily)) { setAccords((p) => [...p, pendingFamily]); setPendingFamily(""); setFamilyOpen(false); } }}
                disabled={!pendingFamily || accords.includes(pendingFamily)}
              >
                <Text style={em.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {familyOpen && (
              <View style={em.inlineList}>
                {FRAGRANCE_FAMILIES.map((f) => (
                  <TouchableOpacity key={f} style={[em.inlineRow, pendingFamily === f && em.inlineRowActive]} onPress={() => { setPendingFamily(f); setFamilyOpen(false); }}>
                    <Text style={[em.inlineRowText, pendingFamily === f && em.inlineRowTextActive]}>{f}</Text>
                    {pendingFamily === f ? <Text style={{ color: "#E5F772" }}>✓</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {accords.length > 0 && (
              <View style={em.tagRow}>
                {accords.map((f, i) => (
                  <TouchableOpacity key={i} style={em.tag} onPress={() => setAccords((p) => p.filter((_, j) => j !== i))}>
                    <Text style={em.tagText}>{f} ×</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={em.label}>Top Notes</Text>
            <TagInput tags={notesTop} inputVal={topInput} placeholder="Add note…" onChangeInput={setTopInput} onAdd={(v) => setNotesTop((p) => [...p, v])} onRemove={(i) => setNotesTop((p) => p.filter((_, j) => j !== i))} />

            <Text style={em.label}>Middle Notes</Text>
            <TagInput tags={notesHeart} inputVal={heartInput} placeholder="Add note…" onChangeInput={setHeartInput} onAdd={(v) => setNotesHeart((p) => [...p, v])} onRemove={(i) => setNotesHeart((p) => p.filter((_, j) => j !== i))} />

            <Text style={em.label}>Base Notes</Text>
            <TagInput tags={notesBase} inputVal={baseInput} placeholder="Add note…" onChangeInput={setBaseInput} onAdd={(v) => setNotesBase((p) => [...p, v])} onRemove={(i) => setNotesBase((p) => p.filter((_, j) => j !== i))} />

            <SliderRow label="Projection" value={projection} onChange={setProjection} />
            <SliderRow label="Sillage" value={sillage} onChange={setSillage} />
            <SliderRow label="Longevity" value={longevity} onChange={setLongevity} />

            <Text style={em.label}>Dry Down</Text>
            <F placeholder="Describe the dry down…" value={dryDown} onChangeText={setDryDown} multiline style={{ height: 80, textAlignVertical: "top" }} onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)} />

            {/* Inspiration photo */}
            <Text style={em.label}>Inspiration</Text>
            <TouchableOpacity style={em.photoUpload} onPress={pickInspirationPhotoEdit} activeOpacity={0.85}>
              {inspirationImage && <Image source={{ uri: inspirationImage }} style={[StyleSheet.absoluteFill as any, { borderRadius: 18 }]} resizeMode="contain" />}
              {!inspirationImage && <Text style={em.uploadLabel}>Upload Inspiration Photo</Text>}
              {inspirationImage && (
                <View style={em.aiStatusBar}><Text style={em.aiStatusText}>Tap to change</Text></View>
              )}
            </TouchableOpacity>

            <Text style={em.label}>Color(s)</Text>
            <View style={em.colorWheelWrap}>
              <ColorPicker
                color={selectedColor}
                onColorChange={setSelectedColor}
                thumbSize={28}
                sliderSize={28}
                noSnap={true}
                row={false}
                swatches={false}
                discrete={false}
              />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {colors.map((c, i) => (
                  <TouchableOpacity key={i} style={[em.colorDot, { backgroundColor: c }]} onPress={() => setColors((p) => p.filter((_, j) => j !== i))} />
                ))}
              </View>
              <TouchableOpacity style={[em.addBtn, colors.length >= 3 && { opacity: 0.35 }]} onPress={() => { if (colors.length < 3 && !colors.includes(selectedColor)) setColors((p) => [...p, selectedColor]); }}>
                <Text style={em.addBtnText}>{colors.length >= 3 ? "Max 3" : "Add"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={em.label}>Music URL</Text>
            <F placeholder="Spotify / YouTube link…" value={musicUrl} onChangeText={setMusicUrl} keyboardType="url" autoCapitalize="none" onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)} />

            <Text style={em.label}>Notes</Text>
            <F placeholder="Your thoughts…" value={description} onChangeText={setDescription} multiline style={{ height: 120, textAlignVertical: "top" }} onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)} />

            <TouchableOpacity style={em.publicRow} onPress={() => setIsPublic((v) => !v)}>
              <Text style={em.publicLabel}>{isPublic ? "🌐 Public" : "🔒 Private"}</Text>
              <Text style={em.publicSub}>Tap to toggle visibility</Text>
            </TouchableOpacity>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

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
  const scrollRef = useRef<any>(null);
  const scrollY = useRef(0);

  const fetchEntry = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const { data } = await (supabase as any)
      .from("journal_entries")
      .select("*, perfumes:perfume_id (name)")
      .eq("id", id)
      .single();
    setEntry(data);
    if (showLoading) setLoading(false);
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
    const savedY = scrollY.current;
    Alert.alert("Inspiration Photo", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permission needed", "Allow camera access."); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7, base64: true });
          if (!result.canceled && result.assets[0]) saveInspirationPhoto(result.assets[0], savedY);
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permission needed", "Allow photo library access."); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7, base64: true });
          if (!result.canceled && result.assets[0]) saveInspirationPhoto(result.assets[0], savedY);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const saveInspirationPhoto = async (asset: ImagePicker.ImagePickerAsset, savedY: number) => {
    if (!entry) return;
    setInspirationSaving(true);
    const imageData = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    await (supabase as any).from("journal_entries").update({ inspiration_image_url: imageData }).eq("id", entry.id);
    setInspirationSaving(false);
    fetchEntry(false);
    requestAnimationFrame(() => { scrollRef.current?.scrollTo({ y: savedY, animated: false }); });
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

      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false} onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}>
        {/* Page title */}
        <Text style={d.pageTitle}>Journal</Text>

        {/* Entry Header */}
        <View style={d.entryHeader}>
          <View style={d.photoBox}>
            {entry.image_url
              ? <Image source={{ uri: entry.image_url }} style={StyleSheet.absoluteFill as any} resizeMode="contain" />
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
          <Row label="Brand" value={entry.brand ?? "—"} />
          <Row label="Perfumer" value={entry.perfumer ?? "—"} />
          <Row label="Gender" value={entry.gender ?? "—"} />
          <Row label="Season(s)" value={entry.seasons?.length ? entry.seasons.map(s => `${SEASON_ICONS[s]} ${s}`).join(", ") : "—"} />
          <Row label="Price" value={entry.price_text ?? "—"} />
          <Row label="Rating" value={entry.rating_10 != null ? String(entry.rating_10) : "—"} />
          <Row label="Fragrance Family" value={entry.accords?.length ? entry.accords.join(", ") : "—"} />

          <View style={d.divider} />

          <Row label="Top Notes" value={entry.notes_top?.length ? entry.notes_top.join(", ") : "—"} />
          <Row label="Middle Notes" value={entry.notes_heart?.length ? entry.notes_heart.join(", ") : "—"} />
          <Row label="Base Notes" value={entry.notes_base?.length ? entry.notes_base.join(", ") : "—"} />
        </View>

        {/* One unified card: Performance + Inspiration + Colors + Music + Notes */}
        <View style={d.card}>
          <Row label="Projection" value={entry.projection ?? "—"} />
          <Row label="Sillage" value={entry.sillage ?? "—"} />
          <Row label="Longevity" value={entry.longevity ?? "—"} />
          <Row label="Dry Down" value={entry.dry_down ?? "—"} />

          {/* Inspiration photo box inside the card */}
          <TouchableOpacity style={d.inspirationInCard} onPress={pickInspirationPhoto} activeOpacity={0.8}>
            {entry.inspiration_image_url ? (
              <Image source={{ uri: entry.inspiration_image_url }} style={{ width: "100%", height: "100%", borderRadius: 14 }} resizeMode="contain" />
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
          onSaved={() => { setEditVisible(false); fetchEntry(false); }}
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

  inspirationInCard: { height: 420, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.5)", borderWidth: 1, borderColor: "rgba(0,0,0,0.07)", alignItems: "center", justifyContent: "center", marginVertical: 12, overflow: "hidden" },

  editPill: { alignSelf: "center", backgroundColor: "#13131a", borderRadius: 100, paddingHorizontal: 48, paddingVertical: 14, marginTop: 8, marginBottom: 24 },
  editPillText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  moreBtn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.2)", borderRadius: 100, paddingHorizontal: 24, paddingVertical: 13 },
  moreBtnText: { color: "#13131a", fontSize: 14 },
  saveBottomBtn: { backgroundColor: "#13131a", borderRadius: 100, paddingHorizontal: 32, paddingVertical: 14 },
  saveBottomBtnText: { color: "#E5F772", fontSize: 15, fontWeight: "700" },
});

