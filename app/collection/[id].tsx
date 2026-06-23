import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, StyleSheet, Image, Share, Linking,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import ColorPicker from "react-native-wheel-color-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Perfume = {
  id: number;
  name: string;
  brand?: string | null;
  perfumer?: string | null;
  gender?: string | null;
  season?: string[] | null;
  year?: number | null;
  status?: string | null;
  category?: string | null;
  is_favorite?: boolean | null;
  concentration?: string | null;
  size_ml?: number | null;
  rating?: number | null;
  price?: number | null;
  image_url?: string | null;
  inspiration_image_url?: string | null;
  notes?: string | null;
  music?: string | null;
  top_notes?: string[] | null;
  heart_notes?: string[] | null;
  base_notes?: string[] | null;
  accords?: string[] | null;
  projection?: string | null;
  longevity?: string | null;
  sillage?: string | null;
  dry_down?: string | null;
  colors?: string[] | null;
  retailer?: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SEASONS = ["Spring", "Summer", "Fall", "Winter"];
const SEASON_ICONS: Record<string, string> = { Spring: "🌸", Summer: "☀️", Fall: "🍂", Winter: "❄️" };
const GENDER_OPTIONS = ["Female", "Male", "Unisex"];
const CATEGORY_OPTIONS = ["Designer", "Luxury", "Niche", "Artisan/Indie", "Celebrity", "Mass/Drugstore", "Vintage", "Custom/Bespoke"];
const CONCENTRATION_OPTIONS = ["Parfum", "Extrait", "EDP", "EDT", "Cologne", "Oil"];
const STATUS_OPTIONS = ["Favorite", "Wishlist", "Sell/Trade"];

const TEAL: [string, string, string] = ["#0d9488", "#0fb8aa", "#12ccba"];

// ─── Edit Modal Styles (hoisted so F + TagInput can reference em) ─────────────

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
  colorWheelWrap: { height: 320, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", padding: 12, marginBottom: 14 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "rgba(0,0,0,0.15)" },
  addBtn: { backgroundColor: "#13131a", borderRadius: 24, paddingHorizontal: 22, paddingVertical: 13, justifyContent: "center" as const },
  addBtnText: { color: "#E5F772", fontSize: 14, fontWeight: "600" as const },
  chooser: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, backgroundColor: "rgba(0,0,0,0.07)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 4 },
  chooserEmpty: { color: "rgba(19,19,26,0.4)", fontSize: 14 },
  chooserFilled: { color: "#13131a", fontSize: 14 },
  chevron: { color: "rgba(19,19,26,0.4)", fontSize: 12 },
  inlineList: { backgroundColor: "rgba(0,0,0,0.06)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 14, marginBottom: 10, overflow: "hidden" as const },
  inlineRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.07)" },
  inlineRowActive: { backgroundColor: "#13131a" },
  inlineRowText: { color: "#13131a", fontSize: 14 },
  inlineRowTextActive: { color: "#E5F772", fontWeight: "600" as const },
});

// ─── Edit Modal Components (module-level to avoid remount on re-render) ────────

function F({ style, ...props }: React.ComponentProps<typeof TextInput>) {
  return <TextInput style={[em.input, style]} placeholderTextColor="rgba(19,19,26,0.4)" {...props} />;
}

function TagInput({ tags, inputVal, placeholder, onChangeInput, onAdd, onRemove }: {
  tags: string[]; inputVal: string; placeholder: string;
  onChangeInput: (v: string) => void; onAdd: (v: string) => void; onRemove: (i: number) => void;
}) {
  return (
    <View style={{ marginBottom: 4 }}>
      <TextInput
        style={em.input}
        placeholder={placeholder}
        placeholderTextColor="rgba(19,19,26,0.4)"
        value={inputVal}
        onChangeText={onChangeInput}
        onSubmitEditing={() => { if (inputVal.trim()) { onAdd(inputVal.trim()); onChangeInput(""); } }}
        returnKeyType="done"
        blurOnSubmit={false}
      />
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

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ visible, perfume, onClose, onSaved }: {
  visible: boolean; perfume: Perfume; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [perfumer, setPerfumer] = useState("");
  const [gender, setGender] = useState("");
  const [sizeText, setSizeText] = useState("");
  const [priceText, setPriceText] = useState("");
  const [rating, setRating] = useState("");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [concentration, setConcentration] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [notesTop, setNotesTop] = useState<string[]>([]);
  const [notesHeart, setNotesHeart] = useState<string[]>([]);
  const [notesBase, setNotesBase] = useState<string[]>([]);
  const [accords, setAccords] = useState<string[]>([]);
  const [projection, setProjection] = useState("");
  const [sillage, setSillage] = useState("");
  const [longevity, setLongevity] = useState("");
  const [dryDown, setDryDown] = useState("");
  const [music, setMusic] = useState("");
  const [notes, setNotes] = useState("");
  const [topInput, setTopInput] = useState("");
  const [heartInput, setHeartInput] = useState("");
  const [baseInput, setBaseInput] = useState("");
  const [accordInput, setAccordInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [inspirationImage, setInspirationImage] = useState<string | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState("#a78bfa");
  const [concentrationOpen, setConcentrationOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(perfume.name ?? "");
    setBrand(perfume.brand ?? "");
    setPerfumer(perfume.perfumer ?? "");
    setGender(perfume.gender ?? "");
    setSizeText(perfume.size_ml != null ? String(perfume.size_ml) : "");
    setPriceText(perfume.price != null ? String(perfume.price) : "");
    setRating(perfume.rating != null ? String(perfume.rating) : "");
    setSeasons(perfume.season ?? []);
    setConcentration(perfume.concentration ?? "");
    setCategory(perfume.category ?? "");
    setStatus(perfume.status ?? "");
    setNotesTop(perfume.top_notes ?? []);
    setNotesHeart(perfume.heart_notes ?? []);
    setNotesBase(perfume.base_notes ?? []);
    setAccords(perfume.accords ?? []);
    setProjection(perfume.projection ?? "");
    setSillage(perfume.sillage ?? "");
    setLongevity(perfume.longevity ?? "");
    setDryDown(perfume.dry_down ?? "");
    setMusic(perfume.music ?? "");
    setNotes(perfume.notes ?? "");
    setImage(perfume.image_url ?? null);
    setInspirationImage(perfume.inspiration_image_url ?? null);
    setColors(perfume.colors ?? []);
    setSelectedColor("#a78bfa");
    setTopInput(""); setHeartInput(""); setBaseInput(""); setAccordInput("");
  }, [visible, perfume]);

  const toggleSeason = (s: string) =>
    setSeasons((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow photo library access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] as any, allowsEditing: false, quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
    }
  };

  const pickInspirationPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow photo library access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] as any, allowsEditing: false, quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setInspirationImage(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("perfumes").update({
      name: name.trim() || perfume.name,
      brand: brand.trim() || null,
      perfumer: perfumer.trim() || null,
      gender: gender || null,
      size_ml: sizeText ? parseFloat(sizeText) : null,
      price: priceText ? parseFloat(priceText) : null,
      rating: rating ? parseFloat(rating) : null,
      season: seasons.length ? seasons : null,
      concentration: concentration || null,
      category: category || null,
      status: status || null,
      image_url: image ?? null,
      inspiration_image_url: inspirationImage ?? null,
      colors: colors.length ? colors : null,
      top_notes: notesTop.length ? notesTop : null,
      heart_notes: notesHeart.length ? notesHeart : null,
      base_notes: notesBase.length ? notesBase : null,
      accords: accords.length ? accords : null,
      projection: projection.trim() || null,
      sillage: sillage.trim() || null,
      longevity: longevity.trim() || null,
      dry_down: dryDown.trim() || null,
      music: music.trim() || null,
      notes: notes.trim() || null,
    }).eq("id", perfume.id);
    setSaving(false);
    if (error) { Alert.alert("Save failed", error.message); return; }
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient colors={TEAL} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={em.header}>
            <TouchableOpacity onPress={onClose}><Text style={em.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={em.headerTitle}>Edit Entry</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#13131a" size="small" /> : <Text style={em.saveBtn}>Save</Text>}
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            {/* Photo upload box */}
            <Text style={em.label}>Photo</Text>
            <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}
              style={{ height: 180, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.07)", borderWidth: 1, borderColor: "rgba(0,0,0,0.14)", alignItems: "center", justifyContent: "center", marginBottom: 4, overflow: "hidden" }}>
              {image ? (
                <Image source={{ uri: image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <Text style={{ color: "rgba(19,19,26,0.35)", fontSize: 14 }}>Upload Photo</Text>
              )}
              {image ? (
                <View style={{ position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: "#fff", fontSize: 11 }}>Tap to change</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            <Text style={em.label}>Name</Text>
            <F placeholder="Perfume name…" value={name} onChangeText={setName} />

            <Text style={em.label}>Brand</Text>
            <F placeholder="Brand…" value={brand} onChangeText={setBrand} />

            <Text style={em.label}>Perfumer</Text>
            <F placeholder="Perfumer…" value={perfumer} onChangeText={setPerfumer} />

            <Text style={em.label}>Gender</Text>
            <View style={em.chipRow}>
              {GENDER_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} style={[em.chip, gender === opt && em.chipActive]} onPress={() => setGender(gender === opt ? "" : opt)}>
                  <Text style={[em.chipText, gender === opt && em.chipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={em.label}>Size (ml)</Text>
                <F placeholder="50" value={sizeText} onChangeText={setSizeText} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={em.label}>Price</Text>
                <F placeholder="190.00" value={priceText} onChangeText={setPriceText} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={em.label}>Rating (0–10)</Text>
                <F placeholder="8.5" value={rating} onChangeText={setRating} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={em.label}>Season(s)</Text>
            <View style={em.chipRow}>
              {SEASONS.map((s) => (
                <TouchableOpacity key={s} style={[em.chip, seasons.includes(s) && em.chipActive]} onPress={() => toggleSeason(s)}>
                  <Text style={[em.chipText, seasons.includes(s) && em.chipTextActive]}>{SEASON_ICONS[s]} {s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={em.label}>Concentration</Text>
            <TouchableOpacity style={em.chooser} onPress={() => setConcentrationOpen((v) => !v)}>
              <Text style={concentration ? em.chooserFilled : em.chooserEmpty}>{concentration || "Select concentration"}</Text>
              <Text style={em.chevron}>{concentrationOpen ? "▴" : "▾"}</Text>
            </TouchableOpacity>
            {concentrationOpen && (
              <View style={em.inlineList}>
                {CONCENTRATION_OPTIONS.map((opt) => (
                  <TouchableOpacity key={opt} style={[em.inlineRow, concentration === opt && em.inlineRowActive]} onPress={() => { setConcentration(opt); setConcentrationOpen(false); }}>
                    <Text style={[em.inlineRowText, concentration === opt && em.inlineRowTextActive]}>{opt}</Text>
                    {concentration === opt ? <Text style={{ color: "#E5F772" }}>✓</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={em.label}>Category</Text>
            <TouchableOpacity style={em.chooser} onPress={() => setCategoryOpen((v) => !v)}>
              <Text style={category ? em.chooserFilled : em.chooserEmpty}>{category || "Select category"}</Text>
              <Text style={em.chevron}>{categoryOpen ? "▴" : "▾"}</Text>
            </TouchableOpacity>
            {categoryOpen && (
              <View style={em.inlineList}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <TouchableOpacity key={opt} style={[em.inlineRow, category === opt && em.inlineRowActive]} onPress={() => { setCategory(opt); setCategoryOpen(false); }}>
                    <Text style={[em.inlineRowText, category === opt && em.inlineRowTextActive]}>{opt}</Text>
                    {category === opt ? <Text style={{ color: "#E5F772" }}>✓</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={em.label}>Status</Text>
            <View style={em.chipRow}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} style={[em.chip, status === opt && em.chipActive]} onPress={() => setStatus(opt)}>
                  <Text style={[em.chipText, status === opt && em.chipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={em.label}>Fragrance Family</Text>
            <TagInput tags={accords} inputVal={accordInput} placeholder="Add accord…" onChangeInput={setAccordInput} onAdd={(v) => setAccords((p) => [...p, v])} onRemove={(i) => setAccords((p) => p.filter((_, j) => j !== i))} />

            <Text style={em.label}>Top Notes</Text>
            <TagInput tags={notesTop} inputVal={topInput} placeholder="Add note…" onChangeInput={setTopInput} onAdd={(v) => setNotesTop((p) => [...p, v])} onRemove={(i) => setNotesTop((p) => p.filter((_, j) => j !== i))} />

            <Text style={em.label}>Middle Notes</Text>
            <TagInput tags={notesHeart} inputVal={heartInput} placeholder="Add note…" onChangeInput={setHeartInput} onAdd={(v) => setNotesHeart((p) => [...p, v])} onRemove={(i) => setNotesHeart((p) => p.filter((_, j) => j !== i))} />

            <Text style={em.label}>Base Notes</Text>
            <TagInput tags={notesBase} inputVal={baseInput} placeholder="Add note…" onChangeInput={setBaseInput} onAdd={(v) => setNotesBase((p) => [...p, v])} onRemove={(i) => setNotesBase((p) => p.filter((_, j) => j !== i))} />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={em.label}>Projection</Text>
                <F placeholder="1–10" value={projection} onChangeText={setProjection} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={em.label}>Sillage</Text>
                <F placeholder="1–10" value={sillage} onChangeText={setSillage} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={em.label}>Longevity</Text>
                <F placeholder="1–10" value={longevity} onChangeText={setLongevity} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={em.label}>Dry Down</Text>
            <F placeholder="Describe the dry down…" value={dryDown} onChangeText={setDryDown} multiline style={{ height: 80, textAlignVertical: "top" }} />

            <Text style={em.label}>Music</Text>
            <F placeholder="Hallelujah by Jeff Buckley…" value={music} onChangeText={setMusic} />

            {/* Inspiration Photo */}
            <Text style={em.label}>Inspiration Photo</Text>
            <TouchableOpacity onPress={pickInspirationPhoto} activeOpacity={0.8}
              style={{ height: 180, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.07)", borderWidth: 1, borderColor: "rgba(0,0,0,0.14)", alignItems: "center", justifyContent: "center", marginBottom: 4, overflow: "hidden" }}>
              {inspirationImage ? (
                <Image source={{ uri: inspirationImage }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <Text style={{ color: "rgba(19,19,26,0.35)", fontSize: 14 }}>Upload Inspiration Photo</Text>
              )}
              {inspirationImage ? (
                <View style={{ position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: "#fff", fontSize: 11 }}>Tap to change</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            {/* Color Wheel */}
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
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {colors.map((c, i) => (
                  <TouchableOpacity key={i} style={[em.colorDot, { backgroundColor: c }]} onPress={() => setColors((p) => p.filter((_, j) => j !== i))} />
                ))}
              </View>
              <TouchableOpacity style={[em.addBtn, colors.length >= 3 && { opacity: 0.35 }]} onPress={() => { if (colors.length < 3 && !colors.includes(selectedColor)) setColors((p) => [...p, selectedColor]); }}>
                <Text style={em.addBtnText}>{colors.length >= 3 ? "Max 3" : "Add"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={em.label}>Notes</Text>
            <F placeholder="Your thoughts…" value={notes} onChangeText={setNotes} multiline style={{ height: 120, textAlignVertical: "top" }} />
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

// ─── More Sheet Styles ────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 10 },
  handle: { width: 40, height: 4, backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  btn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.15)", borderRadius: 100, paddingVertical: 16, alignItems: "center" },
  btnDanger: { borderColor: "rgba(220,50,50,0.25)" },
  btnText: { color: "#13131a", fontSize: 15, fontWeight: "500" as const },
});

// ─── Detail Screen ────────────────────────────────────────────────────────────

export default function CollectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [perfume, setPerfume] = useState<Perfume | null>(null);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [inspirationSaving, setInspirationSaving] = useState(false);

  const fetchPerfume = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const { data } = await supabase.from("perfumes").select("*").eq("id", id).single();
    setPerfume(data as Perfume);
    if (showLoading) setLoading(false);
  }, [id]);

  useEffect(() => { fetchPerfume(); }, [fetchPerfume]);

  const handleDelete = () => {
    Alert.alert("Delete Perfume", `Remove "${perfume?.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => { await supabase.from("perfumes").delete().eq("id", id); router.back(); },
      },
    ]);
  };

  const handleShare = async () => {
    if (!perfume) return;
    try {
      await Share.share({ message: `${perfume.name}${perfume.brand ? ` — ${perfume.brand}` : ""}${perfume.notes ? `\n${perfume.notes}` : ""}`.trim() });
    } catch {}
  };

  const pickInspirationPhoto = () => {
    Alert.alert("Inspiration Photo", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permission needed", "Allow camera access."); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"] as any, allowsEditing: false, quality: 0.7, base64: true });
          if (!result.canceled && result.assets[0]) saveInspirationPhoto(result.assets[0]);
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permission needed", "Allow photo library access."); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] as any, allowsEditing: false, quality: 0.7, base64: true });
          if (!result.canceled && result.assets[0]) saveInspirationPhoto(result.assets[0]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const saveInspirationPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!perfume) return;
    setInspirationSaving(true);
    const imageData = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    await supabase.from("perfumes").update({ inspiration_image_url: imageData }).eq("id", perfume.id);
    setInspirationSaving(false);
    fetchPerfume(false);
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <LinearGradient colors={TEAL} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>{children}</SafeAreaView>
    </LinearGradient>
  );

  if (loading) return <Wrapper><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#13131a" size="large" /></View></Wrapper>;
  if (!perfume) return <Wrapper><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "rgba(19,19,26,0.5)" }}>Not found</Text></View></Wrapper>;

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
        <Text style={d.pageTitle}>Collection</Text>

        {/* Entry Header */}
        <View style={d.entryHeader}>
          {/* Photo card with name + heart inside */}
          <View style={d.photoCard}>
            <View style={d.photoBox}>
              {perfume.image_url
                ? <Image source={{ uri: perfume.image_url }} style={StyleSheet.absoluteFill as any} resizeMode="contain" />
                : <Text style={d.photoPlaceholder}>Photo</Text>}
            </View>
            <Text style={d.photoName} numberOfLines={1}>{perfume.name}</Text>
            <Text style={d.photoHeart}>{perfume.is_favorite ? "♥" : "♡"}</Text>
          </View>

          <View style={d.entryMeta}>
            <Text style={d.entryTitle} numberOfLines={2}>{perfume.name}</Text>
            {perfume.brand ? <Text style={d.entryBrand}>{perfume.brand}</Text> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {perfume.status ? <View style={d.tag}><Text style={d.tagText}>{perfume.status}</Text></View> : null}
              {perfume.concentration ? <View style={d.tag}><Text style={d.tagText}>{perfume.concentration}</Text></View> : null}
              {perfume.category ? <View style={d.tag}><Text style={d.tagText}>{perfume.category}</Text></View> : null}
            </View>
          </View>
        </View>

        {/* ONE big card — all info */}
        <View style={d.card}>
          <Row label="Brand" value={perfume.brand ?? "—"} />
          <Row label="Perfumer" value={perfume.perfumer ?? "—"} />
          <Row label="Gender" value={perfume.gender ?? "—"} />
          <Row label="Season(s)" value={perfume.season?.length ? perfume.season.map(s => `${SEASON_ICONS[s]} ${s}`).join(", ") : "—"} />
          <Row label="Concentration" value={perfume.concentration ?? "—"} />
          <Row label="Category" value={perfume.category ?? "—"} />
          <Row label="Size" value={perfume.size_ml != null ? `${perfume.size_ml} ml` : "—"} />
          <Row label="Price" value={perfume.price != null ? `$${perfume.price}` : "—"} />
          <Row label="Rating" value={perfume.rating != null ? String(perfume.rating) : "—"} />

          {/* Accords */}
          <Row label="Fragrance Family" value={perfume.accords?.length ? perfume.accords.join(", ") : "—"} />

          <View style={d.divider} />

          <Row label="Top Notes" value={perfume.top_notes?.length ? perfume.top_notes.join(", ") : "—"} />
          <Row label="Middle Notes" value={perfume.heart_notes?.length ? perfume.heart_notes.join(", ") : "—"} />
          <Row label="Base Notes" value={perfume.base_notes?.length ? perfume.base_notes.join(", ") : "—"} />

          <View style={d.divider} />

          <Row label="Projection" value={perfume.projection ?? "—"} />
          <Row label="Sillage" value={perfume.sillage ?? "—"} />
          <Row label="Longevity" value={perfume.longevity ?? "—"} />
          <Row label="Dry Down" value={perfume.dry_down ?? "—"} />

          {/* Inspiration photo */}
          <TouchableOpacity style={d.inspirationInCard} onPress={pickInspirationPhoto} activeOpacity={0.8}>
            {perfume.inspiration_image_url ? (
              <Image source={{ uri: perfume.inspiration_image_url }} style={{ width: "100%", height: "100%", borderRadius: 14 }} resizeMode="contain" />
            ) : null}
            {inspirationSaving ? (
              <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)", borderRadius: 14 }]}>
                <ActivityIndicator color="#13131a" />
              </View>
            ) : !perfume.inspiration_image_url ? (
              <Text style={d.photoPlaceholder}>Upload Inspiration Photo</Text>
            ) : (
              <View style={{ position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#fff", fontSize: 11 }}>Tap to change</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Colors */}
          <View style={d.row}>
            <Text style={d.rowLabel}>Colors</Text>
            {perfume.colors?.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", flex: 2 }}>
                {perfume.colors.map((c, i) => (
                  <View key={i} style={[d.colorSwatch, { backgroundColor: c }]} />
                ))}
              </View>
            ) : (
              <Text style={d.rowValue}>—</Text>
            )}
          </View>

          {/* Music */}
          <View style={d.row}>
            <Text style={d.rowLabel}>Music</Text>
            {perfume.music?.startsWith("http") ? (
              <TouchableOpacity onPress={() => Linking.openURL(perfume.music!)} style={{ flexShrink: 1 }}>
                <Text style={[d.rowValue, { flexShrink: 1, textDecorationLine: "underline" }]} numberOfLines={2}>
                  {perfume.music}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[d.rowValue, { flexShrink: 1 }]} numberOfLines={2}>
                {perfume.music || "—"}
              </Text>
            )}
          </View>

          {/* Notes */}
          <Text style={d.cardSectionLabel}>Notes</Text>
          <Text style={[d.descText, !perfume.notes && { color: "rgba(19,19,26,0.3)" }]}>
            {perfume.notes || "No notes added."}
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

      {perfume && (
        <EditModal
          visible={editVisible}
          perfume={perfume}
          onClose={() => setEditVisible(false)}
          onSaved={() => { setEditVisible(false); fetchPerfume(false); }}
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
            <TouchableOpacity style={ms.btn} onPress={() => { setMoreVisible(false); Alert.alert("+Collection", "Already in your collection."); }}>
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
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.08)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },

  pageTitle: { color: "#13131a", fontSize: 26, fontWeight: "800", letterSpacing: -0.5, marginBottom: 20, paddingHorizontal: 2 },

  entryHeader: { flexDirection: "row", gap: 16, marginBottom: 16 },

  photoCard: { width: 140, backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.07)", overflow: "hidden", paddingBottom: 10 },
  photoBox: { width: "100%", height: 140, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  photoPlaceholder: { color: "rgba(19,19,26,0.35)", fontSize: 13 },
  photoName: { color: "#13131a", fontSize: 11, fontWeight: "600", marginTop: 8, paddingHorizontal: 8, textAlign: "center" },
  photoHeart: { color: "#13131a", fontSize: 18, marginTop: 4, alignSelf: "flex-end", paddingRight: 10 },

  entryMeta: { flex: 1, justifyContent: "center", paddingLeft: 4, gap: 4 },
  entryTitle: { color: "#13131a", fontSize: 20, fontWeight: "800", lineHeight: 26 },
  entryBrand: { color: "rgba(19,19,26,0.55)", fontSize: 14, fontWeight: "500" },

  tag: { backgroundColor: "rgba(0,0,0,0.08)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { color: "#13131a", fontSize: 12, fontWeight: "500" },

  card: { backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(0,0,0,0.07)", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, marginBottom: 12 },
  cardSectionLabel: { color: "rgba(19,19,26,0.4)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", paddingTop: 12, paddingBottom: 8 },

  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 16 },
  rowLabel: { color: "rgba(19,19,26,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", flex: 1, paddingTop: 1 },
  rowValue: { color: "#13131a", fontSize: 13, fontWeight: "500", flex: 2, textAlign: "right" },

  divider: { height: 1, backgroundColor: "rgba(0,0,0,0.1)", marginVertical: 4 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 12 },

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
