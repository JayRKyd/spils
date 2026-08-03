import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, Alert, Image,
  KeyboardAvoidingView, Platform, PanResponder, Modal, Share, Linking,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { stripMarkdown } from "@/lib/text";
import { useAuth } from "@/context/AuthContext";
import { SpilsLogo } from "@/components/SpilsLogo";
import ColorPicker from "react-native-wheel-color-picker";

// ─── Constants ────────────────────────────────────────────────────────────────

const FRAGRANCE_FAMILIES = [
  "Aldehydic", "Amber", "Amber Floral", "Amber Woody", "Aquatic",
  "Aromatic", "Aromatic Fougère", "Chypre", "Citrus", "Citrus Woods",
  "Floral", "Fresh", "Fougère", "Fruity", "Gourmand", "Green",
  "Leather", "Mossy Woods", "Musky", "Oriental", "Oriental Floral",
  "Oriental Woody", "Spicy", "Umami", "Woody", "Woody Aromatic",
  "Woody Green", "Woody Spicy",
];

const CATEGORY_OPTIONS = ["Designer", "Niche", "Luxury", "Artisan/Indie", "Celebrity", "Mass/Drugstore", "Vintage", "Custom/Bespoke"];
const CONCENTRATION_OPTIONS = ["Parfum", "Extrait", "EDP", "EDT", "EDC", "Cologne", "Oil"];
const SEASON_LIST = ["Spring", "Summer", "Fall", "Winter"];
const SEASON_ICONS: Record<string, string> = { Spring: "🌸", Summer: "☀️", Fall: "🍂", Winter: "❄️" };

const AI_ACTIONS = [
  { key: "facts",          label: "FACTS"            },
  { key: "similar_market", label: "SIMILAR PERFUMES" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SH({ text }: { text: string }) {
  return <Text style={s.sectionHeader}>{text}</Text>;
}

function clamp(v: number) { return Math.min(1, Math.max(0, v)); }

// ─── Slider ───────────────────────────────────────────────────────────────────

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
      <Text style={[s.fieldLabel, { marginBottom: 6 }]}>{label}</Text>
      <View ref={containerRef} onLayout={measure} style={s.sliderTrack} {...panResponder.panHandlers}>
        <View style={[s.sliderFill, { width: `${pct * 100}%` as any }]} />
        <View style={[s.sliderThumb, { left: `${pct * 100}%` as any }]} />
      </View>
    </View>
  );
}

// ─── Temperature Slider (cold → hot gradient) ─────────────────────────────────

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
    <View ref={containerRef} onLayout={measure} style={s.tempSlider} {...panResponder.panHandlers}>
      <LinearGradient colors={["#2E6BE8", "#3BA7E8", "#3BC9A0", "#F0A93B", "#E8503B"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill as any} />
      <Text style={s.tempSliderLabel}>TEMPERATURE</Text>
      <View style={[s.sliderThumb, { left: `${pct * 100}%` as any }]} />
    </View>
  );
}

// ─── Note Input ───────────────────────────────────────────────────────────────

function NoteInput({ placeholder, tags, inputVal, onChangeInput, onAdd, onRemove }: {
  placeholder: string; tags: string[]; inputVal: string;
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
    <View style={{ marginBottom: 10 }}>
      <TextInput
        style={s.field}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={inputVal}
        onChangeText={onChangeInput}
        onSubmitEditing={() => { if (inputVal.trim()) { onAdd(inputVal.trim()); setSuggestions([]); } }}
        returnKeyType="done"
        blurOnSubmit={false}
      />
      {suggestions.length > 0 && (
        <View style={s.organDropdown}>
          {suggestions.map((name) => (
            <TouchableOpacity key={name} style={s.organDropdownRow} onPress={() => addSuggestion(name)}>
              <Text style={s.organDropdownText}>{name}</Text>
              <Text style={s.organDropdownHint}>Organ</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {tags.length > 0 && (
        <View style={s.tagRow}>
          {tags.map((t, i) => (
            <TouchableOpacity key={i} style={s.noteTag} onPress={() => onRemove(i)}>
              <Text style={s.noteTagText}>{t} ×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function JournalNew() {
  const { user } = useAuth();
  const scrollRef = useRef<any>(null);
  const scrollY = useRef(0);

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
  const [entryDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });

  const [families, setFamilies] = useState<string[]>([]);
  const [pendingFamily, setPendingFamily] = useState("");
  const [customFamily, setCustomFamily] = useState("");
  const [familyPickerVisible, setFamilyPickerVisible] = useState(false);
  const [genderPickerVisible, setGenderPickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [concentrationPickerVisible, setConcentrationPickerVisible] = useState(false);

  const [notesTop, setNotesTop] = useState<string[]>([]);
  const [notesHeart, setNotesHeart] = useState<string[]>([]);
  const [notesBase, setNotesBase] = useState<string[]>([]);
  const [topInput, setTopInput] = useState("");
  const [midInput, setMidInput] = useState("");
  const [baseInput, setBaseInput] = useState("");

  const [projectionVal, setProjectionVal] = useState(5);
  const [sillageVal, setSillageVal] = useState(5);
  const [longevityVal, setLongevityVal] = useState(5);
  const [dryDownVal, setDryDownVal] = useState(5);
  const [dryDownText, setDryDownText] = useState("");

  const [colors, setColors] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState("#a78bfa");
  const [temperatureVal, setTemperatureVal] = useState(5);
  const [musicUrl, setMusicUrl] = useState("");

  const [bottleImage, setBottleImage] = useState<string | null>(null);
  const [bottleBase64, setBottleBase64] = useState<string | null>(null);
  const [inspirationImage, setInspirationImage] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiActionLoading, setAiActionLoading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [moreView, setMoreView] = useState<"main" | "delete" | "share">("main");
  const [isWishlisted, setIsWishlisted] = useState(false);

  // ─── Image Picker ──────────────────────────────────────────────────────────

  const pickPhoto = () => {
    const savedY = scrollY.current;
    Alert.alert("Upload Photo", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permission needed", "Allow camera access."); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7, base64: true });
          if (!result.canceled && result.assets[0]) {
            setBottleImage(result.assets[0].uri);
            if (result.assets[0].base64) runVisionAI(`data:image/jpeg;base64,${result.assets[0].base64}`);
            requestAnimationFrame(() => { scrollRef.current?.scrollToPosition(0, savedY, false); });
          }
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permission needed", "Allow photo library access."); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7, base64: true });
          if (!result.canceled && result.assets[0]) {
            setBottleImage(result.assets[0].uri);
            if (result.assets[0].base64) runVisionAI(`data:image/jpeg;base64,${result.assets[0].base64}`);
            requestAnimationFrame(() => { scrollRef.current?.scrollToPosition(0, savedY, false); });
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const pickInspirationPhoto = () => {
    const savedY = scrollY.current;
    Alert.alert("Inspiration Photo", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7 });
          if (!result.canceled && result.assets[0]) {
            setInspirationImage(result.assets[0].uri);
            requestAnimationFrame(() => { scrollRef.current?.scrollToPosition(0, savedY, false); });
          }
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7 });
          if (!result.canceled && result.assets[0]) {
            setInspirationImage(result.assets[0].uri);
            requestAnimationFrame(() => { scrollRef.current?.scrollToPosition(0, savedY, false); });
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ─── AI ────────────────────────────────────────────────────────────────────

  const runVisionAI = async (dataUrl: string) => {
    setAiLoading(true);
    setAiStatus("Analyzing label…");
    setBottleBase64(dataUrl);
    try {
      const resp = await (supabase as any).functions.invoke("journal-ai", { body: { mode: "vision", imageDataUrl: dataUrl } });
      if (resp.error) throw resp.error;
      const a = resp.data?.autofill;
      if (a && typeof a === "object") {
        if (!title && a.perfume) setTitle(a.perfume);
        if (!brand && a.brand) setBrand(a.brand);
        if (!perfumer && a.perfumer) setPerfumer(a.perfumer);
        if (a.gender) setGender(a.gender);
        if (Array.isArray(a.seasons) && !seasons.length) {
          const validSeasons = ["Spring", "Summer", "Fall", "Winter"];
          const valid = a.seasons.filter((x: any) => typeof x === "string" && validSeasons.includes(x));
          if (valid.length) setSeasons(valid);
        }
        if (Array.isArray(a.fragrance_families) && !families.length) {
          setFamilies(a.fragrance_families.filter((x: any) => typeof x === "string"));
        }
        if (Array.isArray(a.top_notes) && !notesTop.length) setNotesTop(a.top_notes.filter((x: any) => typeof x === "string"));
        if (Array.isArray(a.heart_notes) && !notesHeart.length) setNotesHeart(a.heart_notes.filter((x: any) => typeof x === "string"));
        if (Array.isArray(a.base_notes) && !notesBase.length) setNotesBase(a.base_notes.filter((x: any) => typeof x === "string"));
        setAiStatus("✦ Auto-filled from label");
      } else {
        setAiStatus("Couldn't read the label.");
      }
    } catch {
      setAiStatus("AI scan failed.");
    } finally {
      setAiLoading(false);
    }
  };

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

  // ─── More Sheet ────────────────────────────────────────────────────────────

  const closeMore = () => { setMoreVisible(false); setMoreView("main"); };

  const shareText = `${title || "Untitled"}${brand ? ` by ${brand}` : ""} — logged in Spils`;

  const handleOSShare = async () => {
    closeMore();
    await Share.share({ message: shareText });
  };

  const handleEmailShare = () => {
    closeMore();
    Linking.openURL(`mailto:?subject=${encodeURIComponent(title || "Spils Entry")}&body=${encodeURIComponent(shareText)}`);
  };

  const handleSMSShare = () => {
    closeMore();
    Linking.openURL(`sms:?body=${encodeURIComponent(shareText)}`);
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(shareText);
    closeMore();
    Alert.alert("Copied!", "Entry text copied to clipboard.");
  };

  const handleDiscard = () => {
    closeMore();
    router.back();
  };

  const handleAddToCollection = async () => {
    setMoreVisible(false);
    try {
      const { error } = await (supabase as any).from("perfumes").insert([{
        user_id: user?.id,
        name: title.trim() || "Untitled",
        brand: brand.trim() || null,
        nose: perfumer.trim() || null,
        gender: gender.trim() || null,
        price: priceText ? (parseFloat(priceText) || null) : null,
        size_ml: sizeText ? (parseFloat(sizeText) || null) : null,
        rating: rating ? parseFloat(rating) : null,
        reminds_me_of: remindsMeOf.trim() || null,
        temperature: temperatureVal,
        season: seasons.length ? seasons : null,
        concentration: concentration || null,
        category: category || null,
        status: "Owned",
        top_notes: notesTop.length ? notesTop : null,
        heart_notes: notesHeart.length ? notesHeart : null,
        base_notes: notesBase.length ? notesBase : null,
        accords: families.length ? families : null,
        projection: String(projectionVal),
        sillage: String(sillageVal),
        longevity: String(longevityVal),
        dry_down: dryDownText.trim() || null,
        colors: colors.length ? colors : null,
        music: musicUrl.trim() || null,
        image_url: bottleBase64 ?? null,
        inspiration_image_url: inspirationImage ?? null,
        notes: description.trim() || null,
      }]);
      if (error) throw error;
      Alert.alert("Added to Collection", `"${title || "Entry"}" is now in your Collection.`);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not add to collection. Please try again.");
    }
  };

  const handleAddToWishlist = () => {
    setIsWishlisted(true);
    setMoreVisible(false);
    Alert.alert("Wishlisted ✓", "This entry will be marked as wishlisted when you save.");
  };

  const handleClearAll = () => {
    setTitle(""); setDescription(""); setBrand(""); setPerfumer("");
    setGender(""); setPriceText(""); setSizeText(""); setRating(""); setSeasons([]);
    setCategory(""); setConcentration(""); setRemindsMeOf("");
    setFamilies([]); setPendingFamily("");
    setNotesTop([]); setNotesHeart([]); setNotesBase([]);
    setTopInput(""); setMidInput(""); setBaseInput("");
    setProjectionVal(5); setSillageVal(5); setLongevityVal(5); setDryDownVal(5); setDryDownText("");
    setColors([]); setSelectedColor("#a78bfa"); setTemperatureVal(5); setMusicUrl("");
    setBottleImage(null); setBottleBase64(null); setInspirationImage(null);
    setAiResult(null); setAiStatus(null);
    setMoreVisible(false);
  };

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    const detectSource = (url: string) => url.includes("spotify") ? "spotify" : url.includes("youtube") ? "youtube" : "link";
    const { error } = await (supabase as any).from("journal_entries").insert([{
      user_id: user?.id,
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
      is_public: false,
      entry_date: entryDate,
      notes_top: notesTop.length ? notesTop : null,
      notes_heart: notesHeart.length ? notesHeart : null,
      notes_base: notesBase.length ? notesBase : null,
      accords: families.length ? families : null,
      projection: String(projectionVal),
      sillage: String(sillageVal),
      longevity: String(longevityVal),
      dry_down: dryDownText.trim() || null,
      colors: colors.length ? colors : null,
      temperature: temperatureVal,
      music_url: musicUrl.trim() || null,
      music_source: musicUrl.trim() ? detectSource(musicUrl.trim()) : null,
      image_url: bottleBase64 ?? null,
      inspiration_image_url: inspirationImage ?? null,
      is_wishlisted: isWishlisted,
    }]);
    setSaving(false);
    if (error) { console.error("Journal save error:", error.message); Alert.alert("Error", "Failed to save. Please try again."); return; }
    router.back();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <LinearGradient colors={["#000000", "#000000", "#C9F24D"]} locations={[0, 0.82, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <>
          <KeyboardAwareScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} enableOnAndroid extraScrollHeight={40} keyboardOpeningTime={0} onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}>

            {/* Top nav */}
            <View style={s.topNav}>
              <SpilsLogo height={22} color="#edff8d" />
              <TouchableOpacity style={s.profileBtn} onPress={() => router.push("/(tabs)/profile" as any)}>
                <Text style={s.profileIcon}>👤</Text>
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 30 }}>
              {/* Back carrot + header */}
              <View style={s.titleRow}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={s.backCarrot}>‹</Text>
                </TouchableOpacity>
                <Text style={s.pageTitle}>Journal</Text>
              </View>

              {/* Photo + basic fields row */}
              <View style={s.topRow}>
                {/* Bottle photo — white capture box */}
                <TouchableOpacity style={s.photoBox} onPress={pickPhoto} activeOpacity={0.85}>
                  {bottleImage && <Image source={{ uri: bottleImage }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />}
                  {aiLoading && (
                    <View style={s.loadingOverlay}>
                      <ActivityIndicator color="#13131a" size="large" />
                      <Text style={s.loadingText}>{aiStatus}</Text>
                    </View>
                  )}
                  {!bottleImage && !aiLoading && (
                    <View style={{ alignItems: "center", paddingHorizontal: 16 }}>
                      <Text style={s.captureTitle}>Tap to Capture</Text>
                      <Text style={s.captureSub}>(Best if shot on clean background)</Text>
                      <Text style={s.captureSub}>or</Text>
                      <Text style={s.captureSub}>Upload an Image</Text>
                    </View>
                  )}
                  {bottleImage && !aiLoading && aiStatus && (
                    <View style={s.aiStatusBar}><Text style={s.aiStatusText}>{aiStatus}</Text></View>
                  )}
                </TouchableOpacity>

                {/* Right column fields */}
                <View style={s.topFields}>
                  <TextInput style={s.field} placeholder="Perfume" placeholderTextColor="rgba(255,255,255,0.4)" value={title} onChangeText={setTitle} />
                  <TextInput style={s.field} placeholder="Brand" placeholderTextColor="rgba(255,255,255,0.4)" value={brand} onChangeText={setBrand} />
                  <TextInput style={s.field} placeholder="Perfumer" placeholderTextColor="rgba(255,255,255,0.4)" value={perfumer} onChangeText={setPerfumer} />
                  <View style={s.row}>
                    <TextInput style={[s.field, { flex: 1 }]} placeholder="Price" placeholderTextColor="rgba(255,255,255,0.4)" value={priceText} onChangeText={setPriceText} keyboardType="decimal-pad" />
                    <TextInput style={[s.field, { flex: 1 }]} placeholder="Size" placeholderTextColor="rgba(255,255,255,0.4)" value={sizeText} onChangeText={setSizeText} />
                  </View>
                  <TextInput style={[s.field, { alignSelf: "flex-start", minWidth: 90 }]} placeholder="Rating" placeholderTextColor="rgba(255,255,255,0.4)" value={rating} onChangeText={setRating} keyboardType="decimal-pad" />
                </View>
              </View>

              {/* Category | Concentration */}
              <View style={s.row}>
                <TouchableOpacity style={[s.chooser, { flex: 1 }]} onPress={() => setCategoryPickerVisible(true)}>
                  <Text style={category ? s.chooserFilled : s.chooserEmpty}>{category || "Category"}</Text>
                  <Text style={s.chevron}>▾</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.chooser, { flex: 1 }]} onPress={() => setConcentrationPickerVisible(true)}>
                  <Text style={concentration ? s.chooserFilled : s.chooserEmpty}>{concentration || "Concentration"}</Text>
                  <Text style={s.chevron}>▾</Text>
                </TouchableOpacity>
              </View>

              {/* Gender | Season icons */}
              <View style={[s.row, { marginTop: 10 }]}>
                <TouchableOpacity style={[s.chooser, { flex: 1 }]} onPress={() => setGenderPickerVisible(true)}>
                  <Text style={gender ? s.chooserFilled : s.chooserEmpty}>{gender || "Gender"}</Text>
                  <Text style={s.chevron}>▾</Text>
                </TouchableOpacity>
                <View style={s.seasonIcons}>
                  {SEASON_LIST.map((sn) => {
                    const active = seasons.includes(sn);
                    return (
                      <TouchableOpacity key={sn} style={[s.seasonIcon, active && s.seasonIconActive]} onPress={() => setSeasons((p) => active ? p.filter((x) => x !== sn) : [...p, sn])}>
                        <Text style={s.seasonIconText}>{SEASON_ICONS[sn]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Reminds me of */}
              <TextInput style={[s.field, { marginTop: 10 }]} placeholder="Reminds me of..." placeholderTextColor="rgba(255,255,255,0.4)" value={remindsMeOf} onChangeText={setRemindsMeOf} />

              {/* Olfactive Profile */}
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <TouchableOpacity style={s.chooser} onPress={() => setFamilyPickerVisible(true)}>
                  <Text style={pendingFamily ? s.chooserFilled : s.chooserEmpty}>{pendingFamily || "OLFACTIVE PROFILE"}</Text>
                  <Text style={s.chevron}>▾</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.addBtn, (!pendingFamily || families.includes(pendingFamily)) && { opacity: 0.4 }]}
                  onPress={() => { if (pendingFamily && !families.includes(pendingFamily)) { setFamilies((p) => [...p, pendingFamily]); setPendingFamily(""); } }}
                  disabled={!pendingFamily || families.includes(pendingFamily)}
                >
                  <Text style={s.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
              {families.length > 0 && (
                <View style={s.tagRow}>
                  {families.map((f, i) => (
                    <TouchableOpacity key={i} style={s.tag} onPress={() => setFamilies((p) => p.filter((_, j) => j !== i))}>
                      <Text style={s.tagText}>{f} ×</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Pyramid */}
              <SH text="Pyramid" />
              <NoteInput placeholder="TOP NOTES" tags={notesTop} inputVal={topInput} onChangeInput={setTopInput} onAdd={(v) => { setNotesTop((p) => [...p, v]); setTopInput(""); }} onRemove={(i) => setNotesTop((p) => p.filter((_, j) => j !== i))} />
              <NoteInput placeholder="MIDDLE NOTES" tags={notesHeart} inputVal={midInput} onChangeInput={setMidInput} onAdd={(v) => { setNotesHeart((p) => [...p, v]); setMidInput(""); }} onRemove={(i) => setNotesHeart((p) => p.filter((_, j) => j !== i))} />
              <NoteInput placeholder="BASE NOTES" tags={notesBase} inputVal={baseInput} onChangeInput={setBaseInput} onAdd={(v) => { setNotesBase((p) => [...p, v]); setBaseInput(""); }} onRemove={(i) => setNotesBase((p) => p.filter((_, j) => j !== i))} />

              {/* Performance Sliders */}
              <SH text="Performance" />
              <SliderRow label="Projection" value={projectionVal} onChange={setProjectionVal} />
              <SliderRow label="Sillage" value={sillageVal} onChange={setSillageVal} />
              <SliderRow label="Longevity" value={longevityVal} onChange={setLongevityVal} />
              {/* Drydown */}
              <View style={s.sectionBox}>
                <Text style={s.boxLabel}>DRYDOWN</Text>
                <TextInput
                  style={s.boxInput}
                  placeholder="Describe the dry down..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={dryDownText}
                  onChangeText={setDryDownText}
                  multiline
                />
              </View>

              {/* Color(s) */}
              <View style={s.sectionBox}>
                <Text style={s.boxLabel}>COLOR(S)</Text>
                <View style={{ height: 280, marginBottom: 12 }}>
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
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {colors.map((c, i) => (
                      <TouchableOpacity key={i} style={[s.colorDot, { backgroundColor: c }]} onPress={() => setColors((p) => p.filter((_, j) => j !== i))} />
                    ))}
                  </View>
                  <TouchableOpacity style={[s.addBtn, { marginBottom: 0 }, colors.length >= 3 && { opacity: 0.35 }]} onPress={() => { if (colors.length < 3 && !colors.includes(selectedColor)) setColors((p) => [...p, selectedColor]); }}>
                    <Text style={s.addBtnText}>{colors.length >= 3 ? "Max 3" : "Add"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Temperature — cold → hot gradient */}
              <TemperatureSlider value={temperatureVal} onChange={setTemperatureVal} />

              {/* Music */}
              <TextInput style={s.field} placeholder="MUSIC (URL, Spotify, YouTube Links...)" placeholderTextColor="rgba(255,255,255,0.4)" value={musicUrl} onChangeText={setMusicUrl} keyboardType="url" autoCapitalize="none" />

              {/* Inspiration — white capture box (same size as PDP) */}
              <Text style={[s.boxLabel, { marginTop: 4 }]}>INSPIRATION</Text>
              <TouchableOpacity style={s.inspBoxWhite} onPress={pickInspirationPhoto} activeOpacity={0.85}>
                {inspirationImage
                  ? <Image source={{ uri: inspirationImage }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
                  : (
                    <View style={{ alignItems: "center", paddingHorizontal: 16 }}>
                      <Text style={s.captureTitle}>Tap to Capture</Text>
                      <Text style={s.captureSub}>(Best if shot on clean background)</Text>
                      <Text style={s.captureSub}>or</Text>
                      <Text style={s.captureSub}>Upload an Image</Text>
                    </View>
                  )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setInspirationImage(null)} style={{ alignSelf: "flex-end", marginTop: 6, marginBottom: 12 }}>
                <Text style={s.deleteLink}>Delete</Text>
              </TouchableOpacity>

              {/* Notes */}
              <View style={[s.sectionBox, { minHeight: 170 }]}>
                <Text style={s.boxLabel}>NOTES</Text>
                <TextInput
                  style={[s.boxInput, { minHeight: 120 }]}
                  placeholder="Write your notes..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />
              </View>

              {/* Ask Scent Somm AI */}
              <View style={s.aiHeaderRow}>
                <Text style={s.aiHeader}>ASK SCENT SOMM AI</Text>
                <View style={s.betaBadge}><Text style={s.betaText}>Beta</Text></View>
              </View>
              {AI_ACTIONS.map((a) => (
                <TouchableOpacity key={a.key} style={s.aiBtnFull} onPress={() => runAIAction(a.key)} disabled={!!aiActionLoading}>
                  {aiActionLoading === a.key
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.aiBtnText}>{a.label}</Text>}
                </TouchableOpacity>
              ))}
              <TextInput
                style={s.aiAnswerBox}
                placeholder="(ANSWERS SHOW UP HERE)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={aiResult ?? ""}
                editable={false}
                multiline
              />
            </View>
          </KeyboardAwareScrollView>

          {/* Bottom action bar — lifted above keyboard */}
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={s.bottomBar}>
              <TouchableOpacity style={s.moreBtn} onPress={() => router.back()}>
                <Text style={s.moreBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#13131a" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>

        {/* More Bottom Sheet */}
        <Modal visible={moreVisible} transparent animationType="slide" onRequestClose={closeMore}>
          <View style={ms.backdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeMore} />
            <View style={ms.sheet}>
              <View style={ms.handle} />

              {moreView === "main" && (
                <>
                  <TouchableOpacity style={ms.btn} onPress={handleAddToCollection}>
                    <Text style={ms.btnText}>Add to Collection</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[ms.btn, isWishlisted && ms.btnWishlisted]} onPress={handleAddToWishlist}>
                    <Text style={ms.btnText}>{isWishlisted ? "✓ Wishlisted" : "Add to Wishlist"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[ms.btn, ms.btnDark]} onPress={handleClearAll}>
                    <Text style={[ms.btnText, ms.btnTextLight]}>Clear All</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[ms.btn, ms.btnDelete]} onPress={() => setMoreView("delete")}>
                    <Text style={[ms.btnText, ms.btnTextLight]}>Delete</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[ms.btn, ms.btnBlue]} onPress={() => setMoreView("share")}>
                    <Text style={[ms.btnText, ms.btnTextLight]}>Share</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[ms.btn, ms.btnGrey]} onPress={() => { closeMore(); Alert.alert("Print", "Print coming soon."); }}>
                    <Text style={[ms.btnText, { color: "rgba(19,19,26,0.4)" }]}>Print</Text>
                  </TouchableOpacity>
                </>
              )}

              {moreView === "delete" && (
                <>
                  <View style={[ms.btn, ms.btnDelete]}>
                    <Text style={[ms.btnText, ms.btnTextLight]}>Delete</Text>
                  </View>
                  <Text style={ms.confirmText}>Are you sure?</Text>
                  <View style={ms.confirmRow}>
                    <TouchableOpacity style={[ms.btn, { flex: 1 }]} onPress={handleDiscard}>
                      <Text style={ms.btnText}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[ms.btn, { flex: 1 }]} onPress={() => setMoreView("main")}>
                      <Text style={ms.btnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {moreView === "share" && (
                <>
                  <View style={[ms.btn, ms.btnBlue]}>
                    <Text style={[ms.btnText, ms.btnTextLight]}>Share</Text>
                  </View>

                  <TouchableOpacity style={ms.btn} onPress={handleOSShare}>
                    <Text style={ms.btnText}>Share</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={ms.btn} onPress={handleEmailShare}>
                    <Text style={ms.btnText}>Email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={ms.btn} onPress={handleSMSShare}>
                    <Text style={ms.btnText}>Text (SMS)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={ms.btn} onPress={handleCopyLink}>
                    <Text style={ms.btnText}>Copy Link</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Gender Picker */}
        <Modal visible={genderPickerVisible} transparent animationType="slide" onRequestClose={() => setGenderPickerVisible(false)}>
          <View style={ms.backdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setGenderPickerVisible(false)} />
            <View style={ms.sheet}>
              <View style={ms.handle} />
              {["Female", "Male", "Unisex"].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[ms.btn, gender === g && ms.btnDark]}
                  onPress={() => { setGender(g); setGenderPickerVisible(false); }}
                >
                  <Text style={[ms.btnText, gender === g && ms.btnTextLight]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Category Picker */}
        <Modal visible={categoryPickerVisible} transparent animationType="slide" onRequestClose={() => setCategoryPickerVisible(false)}>
          <View style={ms.backdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setCategoryPickerVisible(false)} />
            <View style={ms.sheet}>
              <View style={ms.handle} />
              {CATEGORY_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} style={[ms.btn, category === opt && ms.btnDark]} onPress={() => { setCategory(opt); setCategoryPickerVisible(false); }}>
                  <Text style={[ms.btnText, category === opt && ms.btnTextLight]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Concentration Picker */}
        <Modal visible={concentrationPickerVisible} transparent animationType="slide" onRequestClose={() => setConcentrationPickerVisible(false)}>
          <View style={ms.backdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setConcentrationPickerVisible(false)} />
            <View style={ms.sheet}>
              <View style={ms.handle} />
              {CONCENTRATION_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} style={[ms.btn, concentration === opt && ms.btnDark]} onPress={() => { setConcentration(opt); setConcentrationPickerVisible(false); }}>
                  <Text style={[ms.btnText, concentration === opt && ms.btnTextLight]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Family Picker Modal */}
        <Modal visible={familyPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFamilyPickerVisible(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#0e0e16" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Olfactive Profile</Text>
              <TouchableOpacity onPress={() => setFamilyPickerVisible(false)}>
                <Text style={{ color: "#edff8d", fontSize: 15 }}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
              <TextInput
                style={{
                  flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
                  borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 15,
                }}
                placeholder="Type a custom profile…"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={customFamily}
                onChangeText={setCustomFamily}
                onSubmitEditing={() => {
                  if (customFamily.trim()) { setPendingFamily(customFamily.trim()); setCustomFamily(""); setFamilyPickerVisible(false); }
                }}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[s.addBtn, !customFamily.trim() && { opacity: 0.4 }]}
                disabled={!customFamily.trim()}
                onPress={() => {
                  if (customFamily.trim()) { setPendingFamily(customFamily.trim()); setCustomFamily(""); setFamilyPickerVisible(false); }
                }}
              >
                <Text style={s.addBtnText}>Use</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {FRAGRANCE_FAMILIES.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)", flexDirection: "row", justifyContent: "space-between" }}
                  onPress={() => { setPendingFamily(f); setFamilyPickerVisible(false); }}
                >
                  <Text style={{ color: "#fff", fontSize: 16 }}>{f}</Text>
                  {pendingFamily === f ? <Text style={{ color: "#edff8d" }}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 12, paddingBottom: 4 },
  logoText: { color: "#edff8d", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  backCarrot: { color: "#fff", fontSize: 30, fontWeight: "300", lineHeight: 30, marginTop: -3 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 18 },
  pageTitle: { color: "#fff", fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },

  // Photo + fields top row
  topRow: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "stretch" },
  photoBox: { flex: 1.15, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  captureTitle: { color: "#13131a", fontSize: 14, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  captureSub: { color: "rgba(19,19,26,0.5)", fontSize: 11, textAlign: "center", lineHeight: 17 },
  topFields: { flex: 1 },

  photoUpload: { width: "100%", height: 320, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center", marginBottom: 16, overflow: "hidden" },
  uploadIcon: { fontSize: 32, marginBottom: 10, color: "rgba(255,255,255,0.5)" },
  uploadLabel: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject as any, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "rgba(237,255,141,0.85)" },
  loadingText: { color: "rgba(19,19,26,0.6)", fontSize: 12 },
  aiStatusBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 6, paddingHorizontal: 12 },
  aiStatusText: { color: "#edff8d", fontSize: 12, textAlign: "center" },

  field: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 14, marginBottom: 10 },
  row: { flexDirection: "row", gap: 10 },

  sectionHeader: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 18, marginBottom: 12 },
  fieldLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },

  chooser: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 10 },
  chooserEmpty: { color: "rgba(255,255,255,0.4)", fontSize: 14 },
  chooserFilled: { color: "#fff", fontSize: 14 },
  chevron: { color: "rgba(255,255,255,0.5)", fontSize: 20 },
  addBtn: { borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 13, justifyContent: "center", marginBottom: 10 },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  seasonIcons: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 10 },
  seasonIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  seasonIconActive: { backgroundColor: "#edff8d", borderColor: "#edff8d" },
  seasonIconText: { fontSize: 14 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  tag: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  tagText: { color: "#fff", fontSize: 13 },
  noteTag: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#edff8d", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  noteTagText: { color: "#edff8d", fontSize: 12, fontWeight: "600" },

  organDropdown: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", marginTop: 4, marginBottom: 4, overflow: "hidden" },
  organDropdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  organDropdownText: { color: "#13131a", fontSize: 14 },
  organDropdownHint: { color: "rgba(0,0,0,0.3)", fontSize: 11 },

  sliderTrack: { height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.4)", overflow: "hidden", justifyContent: "center" },
  sliderFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 22, backgroundColor: "#C9F24D" },
  sliderThumb: { position: "absolute", width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", top: 1, transform: [{ translateX: -34 }], shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },

  colorWheelWrap: { height: 320, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.4)", padding: 12, marginBottom: 14 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },

  sectionBox: { borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  boxLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  inspBoxWhite: { alignSelf: "center", width: "62%", aspectRatio: 3 / 4, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  deleteLink: { color: "#ff6b6b", fontSize: 13, fontWeight: "600" },
  boxInput: { color: "#fff", fontSize: 14, padding: 0, minHeight: 24, textAlignVertical: "top" },
  tempSlider: { height: 44, borderRadius: 22, overflow: "hidden", justifyContent: "center", marginBottom: 12, position: "relative" },
  tempSliderLabel: { position: "absolute", left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 1, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 3 },

  aiHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, marginBottom: 12 },
  aiHeader: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  betaBadge: { backgroundColor: "#edff8d", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  betaText: { color: "#13131a", fontSize: 9, fontWeight: "700" },
  aiBtnFull: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, alignItems: "flex-start", justifyContent: "center", marginBottom: 10 },
  aiBtnText: { color: "#fff", fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  aiAnswerBox: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 14, height: 240, textAlignVertical: "top", marginTop: 4 },

  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingVertical: 16 },
  moreBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 100, paddingHorizontal: 32, paddingVertical: 15 },
  moreBtnText: { color: "#fff", fontSize: 14 },
  saveBtn: { backgroundColor: "#edff8d", borderRadius: 100, paddingHorizontal: 44, paddingVertical: 15 },
  saveBtnText: { color: "#13131a", fontSize: 15, fontWeight: "700" },
});

const ms = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 10 },
  handle: { width: 40, height: 4, backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  btn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.15)", borderRadius: 100, paddingVertical: 16, alignItems: "center" },
  btnDark: { backgroundColor: "#13131a", borderColor: "#13131a" },
  btnBlue: { backgroundColor: "#30B8E8", borderColor: "#30B8E8" },
  btnBeige: { backgroundColor: "#EDE5D8", borderColor: "#EDE5D8" },
  btnGrey: { backgroundColor: "#E5E5E5", borderColor: "#E5E5E5" },
  btnWishlisted: { backgroundColor: "#E5F772", borderColor: "#E5F772" },
  btnDelete: { backgroundColor: "#FF2D55", borderColor: "#FF2D55" },
  btnText: { color: "#13131a", fontSize: 15, fontWeight: "500" },
  btnTextLight: { color: "#fff" },
  confirmText: { color: "#13131a", fontSize: 17, fontWeight: "600", textAlign: "center", marginVertical: 16 },
  confirmRow: { flexDirection: "row", gap: 12 },
});
