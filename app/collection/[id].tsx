import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, StyleSheet, Image, Share, Linking,
  KeyboardAvoidingView, Platform, PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import ColorPicker from "react-native-wheel-color-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { SpilsLogo } from "@/components/SpilsLogo";

// ─── Types ────────────────────────────────────────────────────────────────────

type Perfume = {
  id: number;
  name: string;
  brand?: string | null;
  nose?: string | null;
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
  reminds_me_of?: string | null;
  temperature?: number | null;
  created_at?: string | null;
};

function temperatureColor(t: number): string {
  if (t <= 2) return "#2E6BE8";
  if (t <= 4) return "#3BA7E8";
  if (t <= 6) return "#3BC9A0";
  if (t <= 8) return "#F0A93B";
  return "#E8503B";
}

// Legacy performance words → 0–10 scale (matches Journal's numeric display)
const PERF_WORDS: Record<string, string> = {
  "VW": "1", "VERY WEAK": "1", "SKIN": "2", "CLOSE TO SKIN": "2",
  "W": "3", "WEAK": "3", "MOD": "5", "MODERATE": "5",
  "STRONG": "8", "BEAST": "10", "BEAST MODE": "10",
};
function perfNum(v?: string | null): string {
  if (!v) return "—";
  const t = v.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return t;
  return PERF_WORDS[t.toUpperCase()] ?? t;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEASONS = ["Spring", "Summer", "Fall", "Winter"];
const SEASON_ICONS: Record<string, string> = { Spring: "🌸", Summer: "☀️", Fall: "🍂", Winter: "❄️" };
const GENDER_OPTIONS = ["Female", "Male", "Unisex"];
const CATEGORY_OPTIONS = ["Designer", "Luxury", "Niche", "Artisan/Indie", "Celebrity", "Mass/Drugstore", "Vintage", "Custom/Bespoke"];
const CONCENTRATION_OPTIONS = ["Parfum", "Extrait", "EDP", "EDT", "Cologne", "Oil"];
const STATUS_OPTIONS = ["Favorite", "Wishlist", "Sell/Trade"];

const TEAL: [string, string, string] = ["#008fc4", "#00AEEF", "#33c1f2"];

// ─── Edit Modal Styles (hoisted so F + TagInput can reference em) ─────────────

const em = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 12, paddingBottom: 4 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },
  backCarrot: { color: "#fff", fontSize: 30, fontWeight: "300", lineHeight: 30, marginTop: -3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 18 },
  pageTitle: { color: "#fff", fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },

  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingVertical: 16 },
  cancelBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 100, paddingHorizontal: 32, paddingVertical: 15 },
  cancelBtnText: { color: "#fff", fontSize: 14 },
  savePill: { backgroundColor: "#00AEEF", borderRadius: 100, paddingHorizontal: 44, paddingVertical: 15 },
  savePillText: { color: "#13131a", fontSize: 15, fontWeight: "700" },

  label: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", marginBottom: 6, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.8 },
  input: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 14, marginBottom: 4 },
  row: { flexDirection: "row", gap: 10 },

  topRow: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "stretch" },
  photoBox: { flex: 1.15, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  captureTitle: { color: "#13131a", fontSize: 14, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  captureSub: { color: "rgba(19,19,26,0.5)", fontSize: 11, textAlign: "center", lineHeight: 17 },
  topFields: { flex: 1 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", backgroundColor: "rgba(255,255,255,0.05)" },
  chipActive: { backgroundColor: "#00AEEF", borderColor: "#00AEEF" },
  chipText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  chipTextActive: { color: "#13131a" },

  seasonIcons: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 10 },
  seasonIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  seasonIconActive: { backgroundColor: "#00AEEF", borderColor: "#00AEEF" },
  seasonIconText: { fontSize: 14 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tag: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { color: "#fff", fontSize: 13 },
  noteTag: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#00AEEF", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  noteTagText: { color: "#00AEEF", fontSize: 12, fontWeight: "600" },
  organDropdown: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", marginTop: 4, marginBottom: 4, overflow: "hidden" },
  organDropdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  organDropdownText: { color: "#13131a", fontSize: 14 },
  organDropdownHint: { color: "#00AEEF", fontSize: 11, fontWeight: "600" },
  sliderTrack: { height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.4)", overflow: "hidden", justifyContent: "center" },
  sliderFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 22, backgroundColor: "#00AEEF" },
  sliderThumb: { position: "absolute", width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", top: 1, transform: [{ translateX: -34 }], shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  addBtn: { borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 13, justifyContent: "center" as const, marginBottom: 10 },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" as const },
  chooser: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 10 },
  chooserEmpty: { color: "rgba(255,255,255,0.4)", fontSize: 14 },
  chooserFilled: { color: "#fff", fontSize: 14 },
  chevron: { color: "rgba(255,255,255,0.5)", fontSize: 20 },
  inlineList: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.4)", borderRadius: 12, marginBottom: 10, overflow: "hidden" as const },
  inlineRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  inlineRowActive: { backgroundColor: "rgba(0,174,239,0.15)" },
  inlineRowText: { color: "#fff", fontSize: 14 },
  inlineRowTextActive: { color: "#00AEEF", fontWeight: "600" as const },

  sectionBox: { borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  boxLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  boxInput: { color: "#fff", fontSize: 14, padding: 0, minHeight: 24, textAlignVertical: "top" as const },
  inspBoxWhite: { alignSelf: "center", width: "62%", aspectRatio: 3 / 4, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden" as const },
  deleteLink: { color: "#ff6b6b", fontSize: 13, fontWeight: "600" },
  tempSlider: { height: 44, borderRadius: 22, overflow: "hidden", justifyContent: "center", marginBottom: 12, position: "relative" as const },
  tempSliderLabel: { position: "absolute" as const, left: 0, right: 0, textAlign: "center" as const, color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 1, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 3 },
});

// ─── Edit Modal Components (module-level to avoid remount on re-render) ────────

function F({ style, ...props }: React.ComponentProps<typeof TextInput>) {
  return <TextInput style={[em.input, style]} placeholderTextColor="rgba(255,255,255,0.4)" {...props} />;
}

function TemperatureSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const containerRef = useRef<View>(null);
  const info = useRef({ x: 0, width: 1 });
  const measure = () => { containerRef.current?.measureInWindow((x, _y, width) => { if (width > 0) info.current = { x, width }; }); };
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => { measure(); onChange(Math.round(clamp((evt.nativeEvent.pageX - info.current.x) / info.current.width) * 10)); },
      onPanResponderMove: (evt) => { onChange(Math.round(clamp((evt.nativeEvent.pageX - info.current.x) / info.current.width) * 10)); },
    })
  ).current;
  const pct = value / 10;
  return (
    <View ref={containerRef} onLayout={measure} style={em.tempSlider} {...panResponder.panHandlers}>
      <LinearGradient colors={["#2E6BE8", "#3BA7E8", "#3BC9A0", "#F0A93B", "#E8503B"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill as any} />
      <Text style={em.tempSliderLabel}>TEMPERATURE</Text>
      <View style={[em.sliderThumb, { left: `${pct * 100}%` as any }]} />
    </View>
  );
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
        placeholderTextColor="rgba(255,255,255,0.4)"
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

function clamp(v: number) { return Math.min(1, Math.max(0, v)); }

function SliderRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const containerRef = useRef<View>(null);
  const info = useRef({ x: 0, width: 1 });
  const numValue = Number(value) || 0;

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
        onChange(String(Math.round(clamp((evt.nativeEvent.pageX - info.current.x) / info.current.width) * 10)));
      },
      onPanResponderMove: (evt) => {
        onChange(String(Math.round(clamp((evt.nativeEvent.pageX - info.current.x) / info.current.width) * 10)));
      },
    })
  ).current;

  const pct = numValue / 10;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={em.label}>{label}</Text>
      <View ref={containerRef} onLayout={measure} style={em.sliderTrack} {...panResponder.panHandlers}>
        <View style={[em.sliderFill, { width: `${pct * 100}%` as any }]} />
        <View style={[em.sliderThumb, { left: `${pct * 100}%` as any }]} />
      </View>
    </View>
  );
}

function NoteInput({ tags, inputVal, placeholder, onChangeInput, onAdd, onRemove }: {
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
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={inputVal}
        onChangeText={onChangeInput}
        onSubmitEditing={() => { if (inputVal.trim()) { onAdd(inputVal.trim()); setSuggestions([]); } }}
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
            <TouchableOpacity key={i} style={em.noteTag} onPress={() => onRemove(i)}>
              <Text style={em.noteTagText}>{t} ×</Text>
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
  const [remindsMeOf, setRemindsMeOf] = useState("");
  const [temperature, setTemperature] = useState(5);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [concentration, setConcentration] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [genderOpen, setGenderOpen] = useState(false);
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
    setPerfumer(perfume.nose ?? "");
    setGender(perfume.gender ?? "");
    setSizeText(perfume.size_ml != null ? String(perfume.size_ml) : "");
    setPriceText(perfume.price != null ? String(perfume.price) : "");
    setRating(perfume.rating != null ? String(perfume.rating) : "");
    setRemindsMeOf(perfume.reminds_me_of ?? "");
    setTemperature(perfume.temperature ?? 5);
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
      nose: perfumer.trim() || null,
      gender: gender || null,
      size_ml: sizeText ? parseFloat(sizeText) : null,
      price: priceText ? parseFloat(priceText) : null,
      rating: rating ? parseFloat(rating) : null,
      reminds_me_of: remindsMeOf.trim() || null,
      temperature: temperature,
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
      <LinearGradient colors={["#000000", "#000000", "#00AEEF"]} locations={[0, 0.82, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={em.topNav}>
            <SpilsLogo height={22} color="#edff8d" />
            <TouchableOpacity style={em.profileBtn} onPress={onClose}>
              <Text style={em.profileIcon}>👤</Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={em.titleRow}>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={em.backCarrot}>‹</Text>
              </TouchableOpacity>
              <Text style={em.pageTitle}>Collection</Text>
            </View>

            {/* Photo + basic fields */}
            <View style={em.topRow}>
              <TouchableOpacity style={em.photoBox} onPress={pickPhoto} activeOpacity={0.85}>
                {image
                  ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
                  : (
                    <View style={{ alignItems: "center", paddingHorizontal: 16 }}>
                      <Text style={em.captureTitle}>Tap to Capture</Text>
                      <Text style={em.captureSub}>(Best if shot on clean background)</Text>
                      <Text style={em.captureSub}>or</Text>
                      <Text style={em.captureSub}>Upload an Image</Text>
                    </View>
                  )}
              </TouchableOpacity>
              <View style={em.topFields}>
                <F placeholder="Perfume" value={name} onChangeText={setName} style={{ marginBottom: 10 }} />
                <F placeholder="Brand" value={brand} onChangeText={setBrand} style={{ marginBottom: 10 }} />
                <F placeholder="Perfumer" value={perfumer} onChangeText={setPerfumer} style={{ marginBottom: 10 }} />
                <View style={[em.row, { marginBottom: 10 }]}>
                  <F placeholder="Price" value={priceText} onChangeText={setPriceText} keyboardType="decimal-pad" style={{ flex: 1, marginBottom: 0 }} />
                  <F placeholder="Size" value={sizeText} onChangeText={setSizeText} keyboardType="decimal-pad" style={{ flex: 1, marginBottom: 0 }} />
                </View>
                <F placeholder="Rating" value={rating} onChangeText={setRating} keyboardType="decimal-pad" style={{ alignSelf: "flex-start", minWidth: 90, marginBottom: 0 }} />
              </View>
            </View>

            {/* Reminds me of */}
            <F placeholder="Reminds me of..." value={remindsMeOf} onChangeText={setRemindsMeOf} style={{ marginBottom: 10 }} />

            <Text style={em.label}>Gender</Text>
            <View style={em.chipRow}>
              {GENDER_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} style={[em.chip, gender === opt && em.chipActive]} onPress={() => setGender(gender === opt ? "" : opt)}>
                  <Text style={[em.chipText, gender === opt && em.chipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
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
                    {concentration === opt ? <Text style={{ color: "#00AEEF" }}>✓</Text> : null}
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
                    {category === opt ? <Text style={{ color: "#00AEEF" }}>✓</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={em.label}>Olfactive Profile</Text>
            <TagInput tags={accords} inputVal={accordInput} placeholder="Add profile…" onChangeInput={setAccordInput} onAdd={(v) => setAccords((p) => [...p, v])} onRemove={(i) => setAccords((p) => p.filter((_, j) => j !== i))} />

            <Text style={[em.label, { marginTop: 18 }]}>Pyramid</Text>
            <NoteInput tags={notesTop} inputVal={topInput} placeholder="TOP NOTES" onChangeInput={setTopInput} onAdd={(v) => setNotesTop((p) => [...p, v])} onRemove={(i) => setNotesTop((p) => p.filter((_, j) => j !== i))} />
            <NoteInput tags={notesHeart} inputVal={heartInput} placeholder="MIDDLE NOTES" onChangeInput={setHeartInput} onAdd={(v) => setNotesHeart((p) => [...p, v])} onRemove={(i) => setNotesHeart((p) => p.filter((_, j) => j !== i))} />
            <NoteInput tags={notesBase} inputVal={baseInput} placeholder="BASE NOTES" onChangeInput={setBaseInput} onAdd={(v) => setNotesBase((p) => [...p, v])} onRemove={(i) => setNotesBase((p) => p.filter((_, j) => j !== i))} />

            <View style={{ marginTop: 8 }}>
              <SliderRow label="Projection" value={projection} onChange={setProjection} />
              <SliderRow label="Sillage" value={sillage} onChange={setSillage} />
              <SliderRow label="Longevity" value={longevity} onChange={setLongevity} />
            </View>

            {/* Drydown */}
            <View style={em.sectionBox}>
              <Text style={em.boxLabel}>DRYDOWN</Text>
              <TextInput style={em.boxInput} placeholder="Describe the dry down..." placeholderTextColor="rgba(255,255,255,0.3)" value={dryDown} onChangeText={setDryDown} multiline />
            </View>

            {/* Color(s) */}
            <View style={em.sectionBox}>
              <Text style={em.boxLabel}>COLOR(S)</Text>
              <View style={{ height: 280, marginBottom: 12 }}>
                <ColorPicker color={selectedColor} onColorChange={setSelectedColor} thumbSize={28} sliderSize={28} noSnap={true} row={false} swatches={false} discrete={false} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {colors.map((c, i) => (
                    <TouchableOpacity key={i} style={[em.colorDot, { backgroundColor: c }]} onPress={() => setColors((p) => p.filter((_, j) => j !== i))} />
                  ))}
                </View>
                <TouchableOpacity style={[em.addBtn, { marginBottom: 0 }, colors.length >= 3 && { opacity: 0.35 }]} onPress={() => { if (colors.length < 3 && !colors.includes(selectedColor)) setColors((p) => [...p, selectedColor]); }}>
                  <Text style={em.addBtnText}>{colors.length >= 3 ? "Max 3" : "Add"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Temperature */}
            <TemperatureSlider value={temperature} onChange={setTemperature} />

            {/* Music */}
            <F placeholder="MUSIC (URL, Spotify, YouTube Links...)" value={music} onChangeText={setMusic} style={{ marginBottom: 10 }} />

            {/* Inspiration */}
            <Text style={[em.boxLabel, { marginTop: 4 }]}>INSPIRATION</Text>
            <TouchableOpacity style={em.inspBoxWhite} onPress={pickInspirationPhoto} activeOpacity={0.85}>
              {inspirationImage
                ? <Image source={{ uri: inspirationImage }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
                : (
                  <View style={{ alignItems: "center", paddingHorizontal: 16 }}>
                    <Text style={em.captureTitle}>Tap to Capture</Text>
                    <Text style={em.captureSub}>(Best if shot on clean background)</Text>
                    <Text style={em.captureSub}>or</Text>
                    <Text style={em.captureSub}>Upload an Image</Text>
                  </View>
                )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setInspirationImage(null)} style={{ alignSelf: "flex-end", marginTop: 6, marginBottom: 12 }}>
              <Text style={em.deleteLink}>Delete</Text>
            </TouchableOpacity>

            {/* Notes */}
            <View style={[em.sectionBox, { minHeight: 170 }]}>
              <Text style={em.boxLabel}>NOTES</Text>
              <TextInput style={[em.boxInput, { minHeight: 120 }]} placeholder="Write your notes..." placeholderTextColor="rgba(255,255,255,0.3)" value={notes} onChangeText={setNotes} multiline />
            </View>

            {/* Status */}
            <Text style={em.label}>Status</Text>
            <View style={em.chipRow}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} style={[em.chip, status === opt && em.chipActive]} onPress={() => setStatus(opt)}>
                  <Text style={[em.chipText, status === opt && em.chipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          </KeyboardAvoidingView>

          <View style={em.bottomBar}>
            <TouchableOpacity style={em.cancelBtn} onPress={onClose}>
              <Text style={em.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[em.savePill, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#13131a" size="small" /> : <Text style={em.savePillText}>Save</Text>}
            </TouchableOpacity>
          </View>
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
  btnGrey: { backgroundColor: "#E5E5E5", borderColor: "#E5E5E5" },
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

  const handleToggleFavorite = async () => {
    if (!perfume) return;
    const newVal = !perfume.is_favorite;
    setPerfume((prev) => prev ? { ...prev, is_favorite: newVal } : prev);
    await supabase.from("perfumes").update({ is_favorite: newVal }).eq("id", id);
  };

  const handleShare = async () => {
    if (!perfume) return;
    try {
      await Share.share({ message: `${perfume.name}${perfume.brand ? ` — ${perfume.brand}` : ""}${perfume.notes ? `\n${perfume.notes}` : ""}`.trim() });
    } catch {}
  };

  const handleAddToWishlist = async () => {
    if (!perfume) return;
    setMoreVisible(false);
    setPerfume((prev) => prev ? { ...prev, status: "Wishlist" } : prev);
    await supabase.from("perfumes").update({ status: "Wishlist" }).eq("id", id);
    Alert.alert("Added to Wishlist", `${perfume.name} was moved to your wishlist.`);
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <LinearGradient colors={["#000000", "#000000", "#00AEEF"]} locations={[0, 0.82, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>{children}</SafeAreaView>
    </LinearGradient>
  );

  if (loading) return <Wrapper><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#fff" size="large" /></View></Wrapper>;
  if (!perfume) return <Wrapper><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "rgba(255,255,255,0.5)" }}>Not found</Text></View></Wrapper>;

  const createdD = perfume.created_at ? new Date(perfume.created_at) : new Date();
  const dateStr = `${String(createdD.getMonth() + 1).padStart(2, "0")}.${String(createdD.getDate()).padStart(2, "0")}.${String(createdD.getFullYear()).slice(2)}`;

  return (
    <Wrapper>
      {/* Top Nav */}
      <View style={d.topNav}>
        <SpilsLogo height={22} color="#edff8d" />
        <TouchableOpacity style={d.profileBtn} onPress={() => router.push("/(tabs)/profile" as any)}>
          <Text style={d.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Back carrot + header */}
        <View style={d.titleRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={d.backCarrot}>‹</Text>
          </TouchableOpacity>
          <Text style={d.pageTitle}>Collection</Text>
        </View>

        {/* Summary card */}
        <View style={d.summaryCard}>
          <View style={d.summaryThumb}>
            {perfume.image_url ? <Image source={{ uri: perfume.image_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <View style={d.summaryTopRow}>
              <Text style={d.summaryName} numberOfLines={1}>{perfume.name}</Text>
              <Text style={d.summaryDate}>{dateStr}</Text>
            </View>
            {perfume.brand ? <Text style={d.summaryBrand} numberOfLines={1}>{perfume.brand}</Text> : null}
            <View style={d.summaryMeta}>
              {perfume.rating != null && <View style={d.ratingPill}><Text style={d.ratingText}>★ {perfume.rating}</Text></View>}
              {perfume.season?.slice(0, 3).map((sn) => <Text key={sn} style={d.summaryMetaIcon}>{SEASON_ICONS[sn]}</Text>)}
            </View>
          </View>
        </View>

        {/* Details box */}
        <View style={d.card}>
          <Row label="Perfumer" value={perfume.nose ?? "—"} />
          <Row label="Price" value={perfume.price != null ? String(perfume.price) : "—"} />
          <Row label="Size" value={perfume.size_ml != null ? `${perfume.size_ml}ml` : "—"} />
          <Row label="Rating" value={perfume.rating != null ? String(perfume.rating) : "—"} />
          <Row label="Category" value={perfume.category ?? "—"} />
          <Row label="Concentration" value={perfume.concentration ?? "—"} />
          <Row label="Gender" value={perfume.gender ?? "—"} />
          <View style={d.row}>
            <Text style={d.rowLabel}>Season(s)</Text>
            <Text style={d.rowValueIcons}>{perfume.season?.length ? perfume.season.map((sn) => SEASON_ICONS[sn]).join("  ") : "—"}</Text>
          </View>
          <Row label="Reminds me of..." value={perfume.reminds_me_of ?? "—"} />
        </View>

        {/* Olfactive Profile box */}
        <View style={d.card}>
          <Row label="Olfactive Profile" value={perfume.accords?.length ? perfume.accords.join(", ") : "—"} />
        </View>

        {/* Notes box */}
        <View style={d.card}>
          <Row label="Top Notes" value={perfume.top_notes?.length ? perfume.top_notes.join(", ") : "—"} />
          <Row label="Middle Notes" value={perfume.heart_notes?.length ? perfume.heart_notes.join(", ") : "—"} />
          <Row label="Base Notes" value={perfume.base_notes?.length ? perfume.base_notes.join(", ") : "—"} />
        </View>

        {/* Performance — 3-column */}
        <View style={[d.card, d.perfCard]}>
          <View style={d.perfCol}><Text style={d.perfLabel}>PROJECTION</Text><Text style={d.perfValue}>{perfNum(perfume.projection)}</Text></View>
          <View style={d.perfCol}><Text style={d.perfLabel}>SILLAGE</Text><Text style={d.perfValue}>{perfNum(perfume.sillage)}</Text></View>
          <View style={d.perfCol}><Text style={d.perfLabel}>LONGEVITY</Text><Text style={d.perfValue}>{perfNum(perfume.longevity)}</Text></View>
        </View>

        {/* Drydown */}
        <View style={d.card}>
          <Text style={d.blockLabel}>DRYDOWN</Text>
          <Text style={[d.blockText, !perfume.dry_down && d.blockTextEmpty]}>{perfume.dry_down || "—"}</Text>
        </View>

        {/* Inspiration + Colors + Temperature */}
        <View style={d.inspRow}>
          <View style={d.inspBox}>
            {perfume.inspiration_image_url ? <Image source={{ uri: perfume.inspiration_image_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" /> : null}
            <Text style={d.inspLabel}>INSPIRATION</Text>
          </View>
          <View style={d.inspRight}>
            <View style={[d.card, d.colorsBox]}>
              <Text style={d.blockLabel}>COLORS</Text>
              {perfume.colors?.length ? (
                <View style={d.colorGrid}>{perfume.colors.map((c, i) => <View key={i} style={[d.colorCircle, { backgroundColor: c }]} />)}</View>
              ) : <Text style={[d.blockText, d.blockTextEmpty]}>—</Text>}
            </View>
            <View style={[d.card, d.tempBox]}>
              <Text style={d.blockLabel}>TEMPERATURE</Text>
              <View style={d.tempCircleWrap}>
                {perfume.temperature != null ? <View style={[d.colorCircle, { backgroundColor: temperatureColor(perfume.temperature) }]} /> : <Text style={[d.blockText, d.blockTextEmpty]}>—</Text>}
              </View>
            </View>
          </View>
        </View>

        {/* Music */}
        {perfume.music ? (
          <TouchableOpacity style={[d.card, d.musicBox]} onPress={() => { if (perfume.music?.startsWith("http")) Linking.openURL(perfume.music); }}>
            <Text style={d.musicLabel}>MUSIC</Text>
            <Text style={d.musicValue} numberOfLines={1}>{perfume.music}</Text>
          </TouchableOpacity>
        ) : (
          <View style={[d.card, d.musicBox]}>
            <Text style={d.musicLabel}>MUSIC</Text>
            <Text style={d.musicValue}>—</Text>
          </View>
        )}

        {/* Notes */}
        <View style={d.card}>
          <Text style={d.blockLabel}>NOTES</Text>
          <Text style={[d.blockText, !perfume.notes && d.blockTextEmpty]}>{perfume.notes || "—"}</Text>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={d.bottomBar}>
        <TouchableOpacity style={d.moreBtn} onPress={() => setMoreVisible(true)}>
          <Text style={d.moreBtnText}>More</Text>
        </TouchableOpacity>
        <TouchableOpacity style={d.saveBottomBtn} onPress={() => setEditVisible(true)}>
          <Text style={d.saveBottomBtnText}>Edit</Text>
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
            <TouchableOpacity style={ms.btn} onPress={handleAddToWishlist}>
              <Text style={ms.btnText}>Add to Wishlist</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ms.btn, ms.btnGrey]} onPress={() => { setMoreVisible(false); Alert.alert("Print", "Print coming soon."); }}>
              <Text style={[ms.btnText, { color: "rgba(19,19,26,0.4)" }]}>Print</Text>
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
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 12, paddingBottom: 4 },
  backCarrot: { color: "#fff", fontSize: 30, fontWeight: "300", lineHeight: 30, marginTop: -3 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 20 },
  pageTitle: { color: "#fff", fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },

  summaryCard: { flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 16 },
  summaryThumb: { width: 62, height: 62, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.12)", overflow: "hidden" },
  summaryTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  summaryName: { color: "#13131a", fontWeight: "700", fontSize: 15, flex: 1, marginRight: 8 },
  summaryDate: { color: "rgba(19,19,26,0.5)", fontSize: 12 },
  summaryBrand: { color: "rgba(19,19,26,0.55)", fontSize: 13, marginTop: 2 },
  summaryMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  summaryMetaIcon: { fontSize: 14 },
  ratingPill: { borderWidth: 1, borderColor: "rgba(0,0,0,0.25)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  ratingText: { color: "#13131a", fontSize: 11, fontWeight: "600" },

  card: { borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 2, marginBottom: 12, backgroundColor: "transparent" },

  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  rowLabel: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "500", flex: 1 },
  rowValue: { color: "#fff", fontSize: 11, fontWeight: "600", flex: 2, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.3 },
  rowValueIcons: { color: "#fff", fontSize: 15, flex: 2, textAlign: "right" },

  perfCard: { flexDirection: "row", alignItems: "center", paddingVertical: 18 },
  perfCol: { flex: 1, alignItems: "center" },
  perfLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600", letterSpacing: 0.5, marginBottom: 8 },
  perfValue: { color: "#fff", fontSize: 20, fontWeight: "600" },

  blockLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 14, marginBottom: 10 },
  blockText: { color: "#fff", fontSize: 13, lineHeight: 20, paddingBottom: 14 },
  blockTextEmpty: { color: "rgba(255,255,255,0.3)" },

  inspRow: { flexDirection: "row", gap: 12, marginBottom: 12, alignItems: "stretch" },
  inspBox: { flex: 1.25, minHeight: 230, borderRadius: 16, overflow: "hidden", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", backgroundColor: "rgba(255,255,255,0.04)" },
  inspLabel: { position: "absolute", top: 12, left: 12, color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4, zIndex: 2 },
  inspRight: { flex: 1, gap: 12 },
  colorsBox: { marginBottom: 0, paddingHorizontal: 12 },
  tempBox: { marginBottom: 0 },
  colorGrid: { flexDirection: "row", flexWrap: "wrap-reverse", gap: 12, justifyContent: "center", alignContent: "center", alignItems: "center", paddingTop: 6, paddingBottom: 24 },
  colorCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  tempCircleWrap: { alignItems: "center", justifyContent: "center", paddingTop: 4, paddingBottom: 18 },

  musicBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 },
  musicLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  musicValue: { color: "rgba(255,255,255,0.7)", fontSize: 12, flexShrink: 1, textAlign: "right", marginLeft: 12 },

  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 12, paddingBottom: 24 },
  moreBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 100, paddingHorizontal: 30, paddingVertical: 15 },
  moreBtnText: { color: "#fff", fontSize: 14 },
  saveBottomBtn: { backgroundColor: "#13131a", borderRadius: 100, paddingHorizontal: 42, paddingVertical: 15 },
  saveBottomBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
