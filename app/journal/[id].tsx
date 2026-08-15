import { useState, useEffect, useCallback, useRef } from "react";
import { ProfileIcon } from "@/components/ProfileIcon";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, StyleSheet, Image,
  Linking, Share, PanResponder, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import ColorPicker from "react-native-wheel-color-picker";
import { supabase } from "@/lib/supabase";
import { stripMarkdown } from "@/lib/text";
import { useAuth } from "@/context/AuthContext";
import { SpilsLogo } from "@/components/SpilsLogo";
import { SeasonIcon } from "@/components/SeasonIcon";
import { ConfirmModal, ConfirmConfig } from "@/components/ConfirmModal";
import { uploadImageIfNeeded } from "@/lib/uploadImage";

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
  temperature: number | null;
  size: string | null;
  category: string | null;
  concentration: string | null;
  reminds_me_of: string | null;
  price_text: string | null;
  music_url: string | null;
  music_source: string | null;
  music_title: string | null;
  inspiration_image_url: string | null;
  ai_notes: string | null;
  perfumes?: { name: string } | null;
}

const SEASONS = ["Spring", "Summer", "Fall", "Winter"];

function temperatureColor(t: number): string {
  if (t <= 2) return "#2E6BE8";
  if (t <= 4) return "#3BA7E8";
  if (t <= 6) return "#3BC9A0";
  if (t <= 8) return "#F0A93B";
  return "#E8503B";
}
const FRAGRANCE_FAMILIES = [
  "Aldehydic", "Amber", "Amber Floral", "Amber Woody", "Animalic",
  "Aquatic", "Aromatic", "Aromatic Fougère", "Aromatic Green", "Balsamic",
  "Boozy", "Camphorous", "Chypre", "Citrus", "Citrus Aromatic",
  "Citrus Floral", "Citrus Gourmand", "Citrus Woody", "Dry Woods", "Earthy",
  "Floral", "Floral Aldehydic", "Floral Aquatic", "Floral Fruity", "Floral Green",
  "Floral Woody", "Fougère", "Fresh", "Fresh Spicy", "Fruity",
  "Fruity Floral", "Gourmand", "Green", "Green Aromatic", "Honeyed",
  "Incense", "Lactonic", "Leather", "Leather Floral", "Leather Woody",
  "Marine", "Metallic", "Mineral", "Mossy Woods", "Musky",
  "Musky Floral", "Ozonic", "Powdery", "Resinous", "Salty",
  "Smoky", "Solar", "Spicy", "Tea", "Tobacco",
  "Umami", "White Floral", "Woody", "Woody Aromatic", "Woody Floral",
  "Woody Green", "Woody Musky", "Woody Spicy",
];
const CATEGORY_OPTIONS = ["Designer", "Luxury", "Niche", "Artisan/Indie", "Celebrity", "Mass Market", "Private Collection", "Classic/Vintage", "Limited Edition", "Discontinued", "Other"];
const CONCENTRATION_OPTIONS = ["Extrait", "Parfum", "EDP", "EDT", "Cologne", "Oil", "Other"];

// ─── Edit Modal Styles (hoisted so TagInput + F can reference em) ────────────

const em = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 12, paddingBottom: 4 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },
  backCarrot: { color: "#fff", fontSize: 30, fontWeight: "300", lineHeight: 30, marginTop: -3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 18 },
  pageTitle: { color: "#fff", fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },

  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 },
  cancelBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 100, paddingHorizontal: 32, paddingVertical: 15 },
  cancelBtnText: { color: "#fff", fontSize: 14 },
  savePill: { backgroundColor: "#edff8d", borderRadius: 100, paddingHorizontal: 44, paddingVertical: 15 },
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
  chipActive: { backgroundColor: "#edff8d", borderColor: "#edff8d" },
  chipText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  chipTextActive: { color: "#13131a" },

  seasonIcons: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 10 },
  seasonIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  seasonIconActive: {},

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tag: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { color: "#fff", fontSize: 13 },
  noteTag: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#edff8d", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  noteTagText: { color: "#edff8d", fontSize: 12, fontWeight: "600" },

  organDropdown: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", marginTop: 4, marginBottom: 4, overflow: "hidden" },
  organDropdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  organDropdownText: { color: "#13131a", fontSize: 14 },
  organDropdownHint: { color: "rgba(0,0,0,0.3)", fontSize: 11 },

  publicRow: { marginTop: 8, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  publicLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
  publicSub: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },

  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  addBtn: { borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 13, justifyContent: "center" as const, marginBottom: 10 },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" as const },
  chooser: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 10 },
  chooserEmpty: { color: "rgba(255,255,255,0.4)", fontSize: 14 },
  chooserFilled: { color: "#fff", fontSize: 14 },
  chevron: { color: "rgba(255,255,255,0.5)", fontSize: 20 },
  inlineList: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.4)", borderRadius: 12, marginBottom: 10, overflow: "hidden" as const },
  inlineRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  inlineRowActive: { backgroundColor: "rgba(237,255,141,0.15)" },
  inlineRowText: { color: "#fff", fontSize: 14 },
  inlineRowTextActive: { color: "#edff8d", fontWeight: "600" as const },

  photoUpload: { width: "100%", height: 320, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center", marginBottom: 16, overflow: "hidden" as const },
  uploadIcon: { fontSize: 32, marginBottom: 10, color: "rgba(255,255,255,0.5)" },
  uploadLabel: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  aiStatusBar: { position: "absolute" as const, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 6, paddingHorizontal: 12 },
  aiStatusText: { color: "#edff8d", fontSize: 12, textAlign: "center" as const },

  sliderTrack: { height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.4)", overflow: "hidden", justifyContent: "center" },
  sliderFill: { position: "absolute" as const, left: 0, top: 0, bottom: 0, borderRadius: 22, backgroundColor: "#C9F24D" },
  sliderThumb: { position: "absolute" as const, width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", top: 1, transform: [{ translateX: -34 }], shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },

  sectionBox: { borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  boxLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  boxInput: { color: "#fff", fontSize: 14, padding: 0, minHeight: 24, textAlignVertical: "top" as const },
  inspBoxWhite: { alignSelf: "center", width: "62%", aspectRatio: 3 / 4, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden" as const },
  deleteLink: { color: "#ff6b6b", fontSize: 13, fontWeight: "600" },
  tempSlider: { height: 44, borderRadius: 22, overflow: "hidden", justifyContent: "center", marginBottom: 12, position: "relative" as const },
  tempSliderLabel: { position: "absolute" as const, left: 0, right: 0, textAlign: "center" as const, color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 1, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 3 },

  aiHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, marginBottom: 12 },
  aiHeader: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  betaBadge: { backgroundColor: "#edff8d", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  betaText: { color: "#13131a", fontSize: 9, fontWeight: "700" },
  aiBtnFull: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, alignItems: "flex-start" as const, justifyContent: "center", marginBottom: 10 },
  aiBtnText: { color: "#fff", fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  aiAnswerBox: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 14, height: 240, textAlignVertical: "top" as const, marginTop: 4 },
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
      <Text style={[em.label, { marginTop: 0, marginBottom: 8 }]}>{label}</Text>
      <View ref={containerRef} onLayout={measure} style={em.sliderTrack} {...panResponder.panHandlers}>
        <View style={[em.sliderFill, { width: `${pct * 100}%` as any }]} />
        <View style={[em.sliderThumb, { left: `${pct * 100}%` as any }]} />
      </View>
    </View>
  );
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

// ─── Edit Modal Components ────────────────────────────────────────────────────

function F({ style, ...props }: React.ComponentProps<typeof TextInput>) {
  return <TextInput style={[em.input, style]} placeholderTextColor="rgba(255,255,255,0.4)" {...props} />;
}

function TagInput({ tags, inputVal, placeholder, onChangeInput, onAdd, onRemove, onScrollRequest }: {
  tags: string[]; inputVal: string; placeholder: string;
  onChangeInput: (v: string) => void; onAdd: (v: string) => void; onRemove: (i: number) => void;
  onScrollRequest?: () => void;
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
        onFocus={() => onScrollRequest?.()}
        onSubmitEditing={() => {
          if (inputVal.trim()) { onAdd(inputVal.trim()); onChangeInput(""); setSuggestions([]); }
          setTimeout(() => onScrollRequest?.(), 100);
        }}
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

function EditModal({ visible, entry, onClose, onSaved }: {
  visible: boolean; entry: JournalEntry; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [perfumer, setPerfumer] = useState("");
  const [gender, setGender] = useState("");
  const [priceText, setPriceText] = useState("");
  const [sizeText, setSizeText] = useState("");
  const [rating, setRating] = useState("");
  const [category, setCategory] = useState("");
  const [concentration, setConcentration] = useState("");
  const [remindsMeOf, setRemindsMeOf] = useState("");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState("#a78bfa");
  const [temperature, setTemperature] = useState(5);
  const [genderOpen, setGenderOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [concentrationOpen, setConcentrationOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [aiActionLoading, setAiActionLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [pendingFamily, setPendingFamily] = useState("");
  const [customFamily, setCustomFamily] = useState("");
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
    setSizeText(entry.size ?? "");
    setRating(entry.rating_10?.toString() ?? "");
    setCategory(entry.category ?? "");
    setConcentration(entry.concentration ?? "");
    setRemindsMeOf(entry.reminds_me_of ?? "");
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
    setTemperature(entry.temperature ?? 5);
    setSelectedColor("#a78bfa");
    setBottleImage(entry.image_url ?? null);
    setInspirationImage(entry.inspiration_image_url ?? null);
    setAiResult(entry.ai_notes ?? null);
    setTopInput(""); setHeartInput(""); setBaseInput(""); setAccordInput("");
  }, [visible, entry]);

  const handleSave = async () => {
    setSaving(true);
    let upBottle: string | null = null;
    let upInsp: string | null = null;
    try {
      [upBottle, upInsp] = await Promise.all([
        uploadImageIfNeeded(bottleImage, "journal"),
        uploadImageIfNeeded(inspirationImage, "journal"),
      ]);
    } catch (e: any) {
      setSaving(false);
      Alert.alert("Image upload failed", e?.message ?? "Please try again.");
      return;
    }
    await (supabase as any).from("journal_entries").update({
      title: title.trim() || null,
      description: description.trim() || null,
      brand: brand.trim() || null,
      perfumer: perfumer.trim() || null,
      gender: gender.trim() || null,
      price_text: priceText.trim() || null,
      size: sizeText.trim() || null,
      category: category.trim() || null,
      concentration: concentration.trim() || null,
      reminds_me_of: remindsMeOf.trim() || null,
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
      temperature: temperature,
      image_url: upBottle,
      inspiration_image_url: upInsp,
      ai_notes: aiResult ?? null,
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

  const runAIAction = async (action: string) => {
    setAiActionLoading(action);
    setAiResult(null);
    try {
      const resp = await (supabase as any).functions.invoke("journal-ai", {
        body: {
          mode: "action", action,
          context: { perfume: title, brand, gender, seasons: seasons.join(", "), notes: description, pyramid: { top: notesTop, heart: notesHeart, base: notesBase } },
        },
      });
      if (resp.error) throw resp.error;
      setAiResult(stripMarkdown(resp.data?.text ?? "No result returned."));
    } catch {
      setAiResult("AI request failed. Please try again.");
    } finally {
      setAiActionLoading(null);
    }
  };

  const AI_ACTIONS = [
    { key: "facts", label: "FACTS" },
    { key: "similar_market", label: "SIMILAR PERFUMES" },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient colors={["#000000", "#000000", "#C9F24D"]} locations={[0, 0.82, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          {/* Top nav */}
          <View style={em.topNav}>
            <SpilsLogo height={22} color="#edff8d" />
            <TouchableOpacity style={[em.profileBtn, { backgroundColor: "transparent", borderWidth: 0 }]} onPress={onClose}>
              <ProfileIcon size={34} />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} enableOnAndroid extraScrollHeight={140} keyboardOpeningTime={0} enableResetScrollToCoords={false}>
            {/* Back carrot + header */}
            <View style={em.titleRow}>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={em.backCarrot}>‹</Text>
              </TouchableOpacity>
              <Text style={em.pageTitle}>Journal</Text>
            </View>

            {/* Photo + basic fields */}
            <View style={em.topRow}>
              <TouchableOpacity style={em.photoBox} onPress={pickBottlePhoto} activeOpacity={0.85}>
                {bottleImage
                  ? <Image source={{ uri: bottleImage }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
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
                <F placeholder="Perfume" value={title} onChangeText={setTitle} style={{ marginBottom: 10 }} />
                <F placeholder="Brand" value={brand} onChangeText={setBrand} style={{ marginBottom: 10 }} />
                <F placeholder="Perfumer" value={perfumer} onChangeText={setPerfumer} style={{ marginBottom: 10 }} />
                <View style={[em.row, { marginBottom: 10 }]}>
                  <F placeholder="Price" value={priceText} onChangeText={setPriceText} keyboardType="decimal-pad" style={{ flex: 1, marginBottom: 0 }} />
                  <F placeholder="Size" value={sizeText} onChangeText={setSizeText} style={{ flex: 1, marginBottom: 0 }} />
                </View>
                <F placeholder="Rating" value={rating} onChangeText={setRating} keyboardType="decimal-pad" style={{ alignSelf: "flex-start", minWidth: 90, marginBottom: 0 }} />
              </View>
            </View>

            {/* Category | Concentration */}
            <View style={[em.row, { alignItems: "flex-start" }]}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity style={em.chooser} onPress={() => setCategoryOpen((v) => !v)}>
                  <Text style={category ? em.chooserFilled : em.chooserEmpty}>{category || "Category"}</Text>
                  <Text style={em.chevron}>▾</Text>
                </TouchableOpacity>
                {categoryOpen && (
                  <View style={em.inlineList}>
                    {CATEGORY_OPTIONS.map((o) => (
                      <TouchableOpacity key={o} style={[em.inlineRow, category === o && em.inlineRowActive]} onPress={() => { setCategory(o); setCategoryOpen(false); }}>
                        <Text style={[em.inlineRowText, category === o && em.inlineRowTextActive]}>{o}</Text>
                        {category === o ? <Text style={{ color: "#edff8d" }}>✓</Text> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <TouchableOpacity style={em.chooser} onPress={() => setConcentrationOpen((v) => !v)}>
                  <Text style={concentration ? em.chooserFilled : em.chooserEmpty}>{concentration || "Concentration"}</Text>
                  <Text style={em.chevron}>▾</Text>
                </TouchableOpacity>
                {concentrationOpen && (
                  <View style={em.inlineList}>
                    {CONCENTRATION_OPTIONS.map((o) => (
                      <TouchableOpacity key={o} style={[em.inlineRow, concentration === o && em.inlineRowActive]} onPress={() => { setConcentration(o); setConcentrationOpen(false); }}>
                        <Text style={[em.inlineRowText, concentration === o && em.inlineRowTextActive]}>{o}</Text>
                        {concentration === o ? <Text style={{ color: "#edff8d" }}>✓</Text> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Gender | Season icons */}
            <View style={[em.row, { alignItems: "flex-start" }]}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity style={em.chooser} onPress={() => setGenderOpen((v) => !v)}>
                  <Text style={gender ? em.chooserFilled : em.chooserEmpty}>{gender || "Gender"}</Text>
                  <Text style={em.chevron}>▾</Text>
                </TouchableOpacity>
                {genderOpen && (
                  <View style={em.inlineList}>
                    {["Male", "Female", "Unisex", "Genderless"].map((g) => (
                      <TouchableOpacity key={g} style={[em.inlineRow, gender === g && em.inlineRowActive]} onPress={() => { setGender(g); setGenderOpen(false); }}>
                        <Text style={[em.inlineRowText, gender === g && em.inlineRowTextActive]}>{g}</Text>
                        {gender === g ? <Text style={{ color: "#edff8d" }}>✓</Text> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={em.seasonIcons}>
                {SEASONS.map((sn) => {
                  const active = seasons.includes(sn);
                  return (
                    <TouchableOpacity key={sn} style={[em.seasonIcon, active && em.seasonIconActive]} onPress={() => toggleSeason(sn)}>
                      <SeasonIcon season={sn} size={26} color={active ? "#edff8d" : "#fff"} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Reminds me of */}
            <F placeholder="Reminds me of..." value={remindsMeOf} onChangeText={setRemindsMeOf} style={{ marginBottom: 10 }} />

            {/* Olfactive Profile */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity style={[em.chooser, { flex: 1 }]} onPress={() => setFamilyOpen((v) => !v)}>
                <Text style={pendingFamily ? em.chooserFilled : em.chooserEmpty}>{pendingFamily || "OLFACTIVE PROFILE"}</Text>
                <Text style={em.chevron}>▾</Text>
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
                {/* Custom profile input */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: "#fff", fontSize: 13 }}
                    placeholder="Type a custom profile…"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={customFamily}
                    onChangeText={setCustomFamily}
                    onSubmitEditing={() => { if (customFamily.trim()) { setPendingFamily(customFamily.trim()); setCustomFamily(""); setFamilyOpen(false); } }}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={[em.addBtn, { marginBottom: 0, paddingVertical: 8, paddingHorizontal: 14 }, !customFamily.trim() && { opacity: 0.4 }]}
                    disabled={!customFamily.trim()}
                    onPress={() => { if (customFamily.trim()) { setPendingFamily(customFamily.trim()); setCustomFamily(""); setFamilyOpen(false); } }}
                  >
                    <Text style={em.addBtnText}>Use</Text>
                  </TouchableOpacity>
                </View>
                {FRAGRANCE_FAMILIES.map((f) => (
                  <TouchableOpacity key={f} style={[em.inlineRow, pendingFamily === f && em.inlineRowActive]} onPress={() => { setPendingFamily(f); setFamilyOpen(false); }}>
                    <Text style={[em.inlineRowText, pendingFamily === f && em.inlineRowTextActive]}>{f}</Text>
                    {pendingFamily === f ? <Text style={{ color: "#edff8d" }}>✓</Text> : null}
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

            {/* Pyramid */}
            <TagInput tags={notesTop} inputVal={topInput} placeholder="TOP NOTES" onChangeInput={setTopInput} onAdd={(v) => setNotesTop((p) => [...p, v])} onRemove={(i) => setNotesTop((p) => p.filter((_, j) => j !== i))} />
            <TagInput tags={notesHeart} inputVal={heartInput} placeholder="MIDDLE NOTES" onChangeInput={setHeartInput} onAdd={(v) => setNotesHeart((p) => [...p, v])} onRemove={(i) => setNotesHeart((p) => p.filter((_, j) => j !== i))} />
            <TagInput tags={notesBase} inputVal={baseInput} placeholder="BASE NOTES" onChangeInput={setBaseInput} onAdd={(v) => setNotesBase((p) => [...p, v])} onRemove={(i) => setNotesBase((p) => p.filter((_, j) => j !== i))} />

            {/* Performance */}
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
                <ColorPicker color={selectedColor} onColorChange={setSelectedColor} thumbSize={28} sliderSize={28} noSnap={true} row={false} swatches={false} discrete={false} shadeSliderThumb={true} />
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
            <F placeholder="MUSIC (URL, Spotify, YouTube Links...)" value={musicUrl} onChangeText={setMusicUrl} keyboardType="url" autoCapitalize="none" style={{ marginBottom: 10 }} />

            {/* Inspiration */}
            <Text style={[em.boxLabel, { marginTop: 4 }]}>INSPIRATION</Text>
            <TouchableOpacity style={em.inspBoxWhite} onPress={pickInspirationPhotoEdit} activeOpacity={0.85}>
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
              <TextInput style={[em.boxInput, { minHeight: 120 }]} placeholder="Write your notes..." placeholderTextColor="rgba(255,255,255,0.3)" value={description} onChangeText={setDescription} multiline />
            </View>


            {/* Ask Scent Somm AI */}
            <View style={em.aiHeaderRow}>
              <Text style={em.aiHeader}>ASK SCENT SOMM AI</Text>
              <View style={em.betaBadge}><Text style={em.betaText}>Beta</Text></View>
            </View>
            {AI_ACTIONS.map((a) => (
              <TouchableOpacity key={a.key} style={em.aiBtnFull} onPress={() => runAIAction(a.key)} disabled={!!aiActionLoading}>
                {aiActionLoading === a.key ? <ActivityIndicator color="#fff" size="small" /> : <Text style={em.aiBtnText}>{a.label}</Text>}
              </TouchableOpacity>
            ))}
            <TextInput style={em.aiAnswerBox} placeholder="(ANSWERS SHOW UP HERE)" placeholderTextColor="rgba(255,255,255,0.4)" value={aiResult ?? ""} editable={false} multiline />

            {/* Cancel / Save — at the end of the form */}
            <View style={em.bottomBar}>
              <TouchableOpacity style={em.cancelBtn} onPress={onClose}>
                <Text style={em.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[em.savePill, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#13131a" size="small" /> : <Text style={em.savePillText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
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
  btnGrey: { backgroundColor: "#E5E5E5", borderColor: "#E5E5E5" },
  btnDanger: { borderColor: "rgba(220,50,50,0.25)" },
  btnText: { color: "#13131a", fontSize: 15, fontWeight: "500" as const },
  btnTextLight: { color: "#fff" },
});

// ─── Detail Screen ────────────────────────────────────────────────────────────

export default function JournalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
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
    setConfirm({
      title: "Delete Entry",
      message: "Remove this journal entry? This cannot be undone.",
      onConfirm: async () => {
        await (supabase as any).from("journal_entries").delete().eq("id", id);
        router.back();
      },
    });
  };

  const handleAddToCollection = async () => {
    if (!entry) return;
    setMoreVisible(false);
    try {
      const { error } = await (supabase as any).from("perfumes").insert([{
        user_id: user?.id,
        name: entry.title || "Untitled",
        brand: entry.brand || null,
        nose: entry.perfumer || null,
        gender: entry.gender || null,
        price: entry.price_text ? (parseFloat(entry.price_text) || null) : null,
        size_ml: entry.size ? (parseFloat(entry.size) || null) : null,
        rating: entry.rating_10 ?? null,
        reminds_me_of: entry.reminds_me_of || null,
        temperature: entry.temperature ?? null,
        season: entry.seasons?.length ? entry.seasons : null,
        concentration: entry.concentration || null,
        category: entry.category || null,
        status: "Owned",
        top_notes: entry.notes_top?.length ? entry.notes_top : null,
        heart_notes: entry.notes_heart?.length ? entry.notes_heart : null,
        base_notes: entry.notes_base?.length ? entry.notes_base : null,
        accords: entry.accords?.length ? entry.accords : null,
        projection: entry.projection ?? null,
        sillage: entry.sillage ?? null,
        longevity: entry.longevity ?? null,
        dry_down: entry.dry_down || null,
        colors: entry.colors?.length ? entry.colors : null,
        music: entry.music_url || null,
        image_url: entry.image_url ?? null,
        inspiration_image_url: entry.inspiration_image_url ?? null,
        notes: entry.description || null,
      }]);
      if (error) throw error;
      setConfirm({ title: "Added to Collection", message: `"${entry.title || "Entry"}" is now in your Collection.`, infoOnly: true });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not add to collection.");
    }
  };


  const handleShare = async () => {
    if (!entry) return;
    try {
      await Share.share({ message: `${entry.title || "Journal Entry"} — ${entry.brand ?? ""}\n${entry.description ?? ""}`.trim() });
    } catch {}
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <LinearGradient colors={["#000000", "#000000", "#C9F24D"]} locations={[0, 0.82, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>{children}</SafeAreaView>
    </LinearGradient>
  );

  if (loading) {
    return <Wrapper><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#fff" size="large" /></View></Wrapper>;
  }

  if (!entry) {
    return <Wrapper><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "rgba(255,255,255,0.5)" }}>Entry not found</Text></View></Wrapper>;
  }

  const d_ = new Date(entry.entry_date + "T12:00:00");
  const dateStr = `${String(d_.getMonth() + 1).padStart(2, "0")}.${String(d_.getDate()).padStart(2, "0")}.${String(d_.getFullYear()).slice(2)}`;
  const displayName = entry.title || entry.perfumes?.name || "Untitled";

  return (
    <Wrapper>
      {/* Top Nav */}
      <View style={d.topNav}>
        <SpilsLogo height={22} color="#edff8d" />
        <TouchableOpacity style={[d.profileBtn, { backgroundColor: "transparent", borderWidth: 0 }]} onPress={() => router.push("/(tabs)/profile" as any)}>
          <ProfileIcon size={34} />
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 140 }} showsVerticalScrollIndicator={false} onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}>
        {/* Back carrot + section header */}
        <View style={d.titleRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={d.backCarrot}>‹</Text>
          </TouchableOpacity>
          <Text style={d.pageTitle}>Journal</Text>
        </View>

        {/* Summary card — same container as Calendar page */}
        <View style={d.summaryCard}>
          <View style={d.summaryThumb}>
            {entry.image_url
              ? <Image source={{ uri: entry.image_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
              : null}
          </View>
          <View style={{ flex: 1 }}>
            <View style={d.summaryTopRow}>
              <Text style={d.summaryName} numberOfLines={1}>{displayName}</Text>
              <Text style={d.summaryDate}>{dateStr}</Text>
            </View>
            {entry.brand ? <Text style={d.summaryBrand} numberOfLines={1}>{entry.brand}</Text> : null}
            <View style={d.summaryMeta}>
              {entry.rating_10 != null && (
                <View style={d.ratingPill}><Text style={d.ratingText}>★ {entry.rating_10}</Text></View>
              )}
              {entry.seasons?.slice(0, 3).map((s) => (
                <SeasonIcon key={s} season={s} size={16} color="#fff" />
              ))}
            </View>
          </View>
        </View>

        {/* Details box */}
        <View style={d.card}>
          <Row label="Perfumer" value={entry.perfumer ?? "—"} />
          <Row label="Price" value={entry.price_text ?? "—"} />
          <Row label="Size" value={entry.size ?? "—"} />
          <Row label="Rating" value={entry.rating_10 != null ? String(entry.rating_10) : "—"} />
          <Row label="Category" value={entry.category ?? "—"} />
          <Row label="Concentration" value={entry.concentration ?? "—"} />
          <Row label="Gender" value={entry.gender ?? "—"} />
          <View style={d.row}>
            <Text style={d.rowLabel}>Season(s)</Text>
            {entry.seasons?.length ? (
              <View style={{ flex: 2, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                {entry.seasons.map((s) => <SeasonIcon key={s} season={s} size={18} color="#fff" />)}
              </View>
            ) : (
              <Text style={d.rowValueIcons}>—</Text>
            )}
          </View>
          <Row label="Reminds me of..." value={entry.reminds_me_of ?? "—"} />
        </View>

        {/* Olfactive Profile box */}
        <View style={d.card}>
          <Row label="Olfactive Profile" value={entry.accords?.length ? entry.accords.join(", ") : "—"} />
        </View>

        {/* Notes box */}
        <View style={d.card}>
          <Row label="Top Notes" value={entry.notes_top?.length ? entry.notes_top.join(", ") : "—"} />
          <Row label="Middle Notes" value={entry.notes_heart?.length ? entry.notes_heart.join(", ") : "—"} />
          <Row label="Base Notes" value={entry.notes_base?.length ? entry.notes_base.join(", ") : "—"} />
        </View>

        {/* Performance — text only, 3-column centered */}
        <View style={[d.card, d.perfCard]}>
          <View style={d.perfCol}>
            <Text style={d.perfLabel}>PROJECTION</Text>
            <Text style={d.perfValue}>{entry.projection ?? "—"}</Text>
          </View>
          <View style={d.perfCol}>
            <Text style={d.perfLabel}>SILLAGE</Text>
            <Text style={d.perfValue}>{entry.sillage ?? "—"}</Text>
          </View>
          <View style={d.perfCol}>
            <Text style={d.perfLabel}>LONGEVITY</Text>
            <Text style={d.perfValue}>{entry.longevity ?? "—"}</Text>
          </View>
        </View>

        {/* Drydown */}
        <View style={d.card}>
          <Text style={d.blockLabel}>DRYDOWN</Text>
          <Text style={[d.blockText, !entry.dry_down && d.blockTextEmpty]}>{entry.dry_down || "—"}</Text>
        </View>

        {/* Inspiration + Colors + Temperature */}
        <View style={d.inspRow}>
          <View style={d.inspBox}>
            {entry.inspiration_image_url
              ? <Image source={{ uri: entry.inspiration_image_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
              : null}
            <Text style={d.inspLabel}>INSPIRATION</Text>
          </View>
          <View style={d.inspRight}>
            <View style={[d.card, d.colorsBox]}>
              <Text style={d.blockLabel}>COLORS</Text>
              {entry.colors?.length ? (
                <View style={d.colorGrid}>
                  {entry.colors.map((c, i) => (
                    <View key={i} style={[d.colorCircle, { backgroundColor: c }]} />
                  ))}
                </View>
              ) : (
                <Text style={[d.blockText, d.blockTextEmpty]}>—</Text>
              )}
            </View>
            <View style={[d.card, d.tempBox]}>
              <Text style={d.blockLabel}>TEMPERATURE</Text>
              <View style={d.tempCircleWrap}>
                {entry.temperature != null ? (
                  <View style={[d.colorCircle, { backgroundColor: temperatureColor(entry.temperature) }]} />
                ) : (
                  <Text style={[d.blockText, d.blockTextEmpty]}>—</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Music */}
        {entry.music_url ? (
          <TouchableOpacity style={[d.card, d.musicBox]} onPress={() => Linking.openURL(entry.music_url!)}>
            <Text style={d.musicLabel}>MUSIC</Text>
            <Text style={d.musicValue} numberOfLines={1}>{entry.music_title || entry.music_url}</Text>
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
          <Text style={[d.blockText, !entry.description && d.blockTextEmpty]}>{entry.description || "—"}</Text>
        </View>

        {/* Scent Somm AI */}
        <View style={d.card}>
          <Text style={d.blockLabel}>SCENT SOMM AI</Text>
          <Text style={[d.blockText, !entry.ai_notes && d.blockTextEmpty]}>{entry.ai_notes || "—"}</Text>
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

      {entry && (
        <EditModal
          visible={editVisible}
          entry={entry}
          onClose={() => setEditVisible(false)}
          onSaved={() => { setEditVisible(false); router.back(); }}
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
              <Text style={ms.btnText}>Add to Collection</Text>
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

      <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
    </Wrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const d = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 12, paddingBottom: 4 },
  logoText: { color: "#13131a", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  backCarrot: { color: "#fff", fontSize: 30, fontWeight: "300", lineHeight: 30, marginTop: -3 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  iconBtnText: { fontSize: 15 },
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
  cardSectionLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", paddingTop: 12, paddingBottom: 8 },

  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  rowLabel: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "500", flex: 1 },
  rowValue: { color: "#fff", fontSize: 11, fontWeight: "600", flex: 2, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.3 },
  rowValueIcons: { color: "#fff", fontSize: 15, flex: 2, textAlign: "right" },

  // Performance — 3-column centered
  perfCard: { flexDirection: "row", alignItems: "center", paddingVertical: 18 },
  perfCol: { flex: 1, alignItems: "center" },
  perfLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600", letterSpacing: 0.5, marginBottom: 8 },
  perfValue: { color: "#fff", fontSize: 20, fontWeight: "600" },

  // Block sections (label on top + content below)
  blockLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 14, marginBottom: 10 },
  blockText: { color: "#fff", fontSize: 13, lineHeight: 20, paddingBottom: 14 },
  blockTextEmpty: { color: "rgba(255,255,255,0.3)" },

  // Inspiration + Colors + Temperature row
  inspRow: { flexDirection: "row", gap: 12, marginBottom: 12, alignItems: "stretch" },
  inspBox: { flex: 1.25, minHeight: 230, borderRadius: 16, overflow: "hidden", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", backgroundColor: "rgba(255,255,255,0.04)" },
  inspLabel: { position: "absolute", top: 12, left: 12, color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4, zIndex: 2 },
  inspRight: { flex: 1, gap: 12 },
  colorsBox: { flex: 1, marginBottom: 0, paddingHorizontal: 12 },
  tempBox: { marginBottom: 0 },
  colorGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap-reverse", gap: 12, justifyContent: "center", alignContent: "center", alignItems: "center", paddingVertical: 6, marginBottom: 10 },
  colorCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  tempCircleWrap: { alignItems: "center", justifyContent: "center", paddingTop: 4, paddingBottom: 18 },

  // Music single-row box
  musicBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 },
  musicLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  musicValue: { color: "rgba(255,255,255,0.7)", fontSize: 12, flexShrink: 1, textAlign: "right", marginLeft: 12 },

  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 4 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 12 },
  tag: { backgroundColor: "rgba(0,0,0,0.08)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { color: "#13131a", fontSize: 12, fontWeight: "500" },

  colorSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },

  descText: { color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 22, paddingBottom: 14 },

  inspirationInCard: { height: 420, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginVertical: 12, overflow: "hidden" },

  editPill: { alignSelf: "center", backgroundColor: "#13131a", borderRadius: 100, paddingHorizontal: 48, paddingVertical: 14, marginTop: 8, marginBottom: 24 },
  editPillText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 12, paddingBottom: 24 },
  moreBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 100, paddingHorizontal: 30, paddingVertical: 15 },
  moreBtnText: { color: "#fff", fontSize: 14 },
  saveBottomBtn: { backgroundColor: "#13131a", borderRadius: 100, paddingHorizontal: 42, paddingVertical: 15 },
  saveBottomBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

