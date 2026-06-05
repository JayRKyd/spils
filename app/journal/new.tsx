import { useState, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, Alert, Image,
  KeyboardAvoidingView, Platform, PanResponder, Modal, Share, Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
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

const AI_ACTIONS = [
  { key: "facts",           label: "FACTS"        },
  { key: "description",    label: "DESCRIPTION"  },
  { key: "when",           label: "WHEN TO WEAR" },
  { key: "similar_market", label: "SIMILAR PICKS" },
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

// ─── Note Input ───────────────────────────────────────────────────────────────

function NoteInput({ placeholder, tags, inputVal, onChangeInput, onAdd, onRemove }: {
  placeholder: string; tags: string[]; inputVal: string;
  onChangeInput: (v: string) => void; onAdd: (v: string) => void; onRemove: (i: number) => void;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <TextInput
        style={s.field}
        placeholder={placeholder}
        placeholderTextColor="rgba(19,19,26,0.4)"
        value={inputVal}
        onChangeText={onChangeInput}
        onSubmitEditing={() => { if (inputVal.trim()) onAdd(inputVal.trim()); }}
        returnKeyType="done"
        blurOnSubmit={false}
      />
      {tags.length > 0 && (
        <View style={s.tagRow}>
          {tags.map((t, i) => (
            <TouchableOpacity key={i} style={s.tag} onPress={() => onRemove(i)}>
              <Text style={s.tagText}>{t} ×</Text>
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [perfumer, setPerfumer] = useState("");
  const [gender, setGender] = useState("");
  const [priceText, setPriceText] = useState("");
  const [rating, setRating] = useState("");
  const [seasons, setSeasons] = useState("");
  const [entryDate] = useState(new Date().toISOString().slice(0, 10));

  const [families, setFamilies] = useState<string[]>([]);
  const [pendingFamily, setPendingFamily] = useState("");
  const [familyPickerVisible, setFamilyPickerVisible] = useState(false);
  const [genderPickerVisible, setGenderPickerVisible] = useState(false);

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
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const pickInspirationPhoto = () => {
    Alert.alert("Inspiration Photo", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7 });
          if (!result.canceled && result.assets[0]) setInspirationImage(result.assets[0].uri);
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7 });
          if (!result.canceled && result.assets[0]) setInspirationImage(result.assets[0].uri);
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
        if (a.gender) setGender(a.gender);
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
          context: { perfume: title, brand, gender, seasons, notes: description, pyramid: { top: notesTop, heart: notesHeart, base: notesBase } },
        },
      });
      if (resp.error) throw resp.error;
      setAiResult(resp.data?.text ?? "No result returned.");
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
      const { error } = await (supabase as any).from("collection_items").insert([{
        fragrance: title.trim() || "Untitled",
        brand: brand.trim() || "",
        rating: rating ? parseFloat(rating) : null,
        sillage: String(sillageVal),
        longevity: String(longevityVal),
        gender: gender.trim() || null,
        color_tags: colors.length ? colors : [],
        accords: families.length ? families : [],
        top_notes: notesTop.length ? notesTop : [],
        heart_notes: notesHeart.length ? notesHeart : [],
        base_notes: notesBase.length ? notesBase : [],
        notes: description.trim() || null,
        image_url: bottleBase64 ?? null,
      }]);
      if (error) throw error;
      Alert.alert("Added to Collection", `${title || "Entry"} was added to your collection.`);
    } catch {
      Alert.alert("Error", "Could not add to collection. Please try again.");
    }
  };

  const handleAddToWishlist = () => {
    setIsWishlisted(true);
    setMoreVisible(false);
    Alert.alert("Wishlisted ✓", "This entry will be marked as wishlisted when you save.");
  };

  const handleClearAll = () => {
    setTitle(""); setDescription(""); setBrand(""); setPerfumer("");
    setGender(""); setPriceText(""); setRating(""); setSeasons("");
    setFamilies([]); setPendingFamily("");
    setNotesTop([]); setNotesHeart([]); setNotesBase([]);
    setTopInput(""); setMidInput(""); setBaseInput("");
    setProjectionVal(5); setSillageVal(5); setLongevityVal(5); setDryDownVal(5); setDryDownText("");
    setColors([]); setSelectedColor("#a78bfa"); setMusicUrl("");
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
      rating_10: rating ? parseFloat(rating) : null,
      seasons: seasons.trim() ? seasons.split(",").map((x) => x.trim()).filter(Boolean) : null,
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
      music_url: musicUrl.trim() || null,
      music_source: musicUrl.trim() ? detectSource(musicUrl.trim()) : null,
      image_url: bottleBase64 ?? null,
      is_wishlisted: isWishlisted,
    }]);
    setSaving(false);
    if (error) { console.error("Journal save error:", error.message); Alert.alert("Error", "Failed to save. Please try again."); return; }
    router.back();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <LinearGradient colors={["#E5F772", "#F2C842"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Top nav */}
            <View style={s.topNav}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                  <Text style={s.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={s.logoText}>SP/LS.</Text>
              </View>
              <TouchableOpacity style={s.profileBtn} onPress={() => router.push("/(tabs)/profile" as any)}>
                <Text style={s.profileIcon}>👤</Text>
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16 }}>
              <Text style={s.pageTitle}>Journal</Text>

              {/* Bottle photo */}
              <TouchableOpacity style={s.photoUpload} onPress={pickPhoto} activeOpacity={0.85}>
                {bottleImage && <Image source={{ uri: bottleImage }} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} resizeMode="contain" />}
                {aiLoading && (
                  <View style={s.loadingOverlay}>
                    <ActivityIndicator color="#13131a" size="large" />
                    <Text style={s.loadingText}>{aiStatus}</Text>
                  </View>
                )}
                {!bottleImage && !aiLoading && (
                  <>
                    {/* Corner brackets */}
                    <View style={[s.corner, s.cornerTL]} />
                    <View style={[s.corner, s.cornerTR]} />
                    <View style={[s.corner, s.cornerBL]} />
                    <View style={[s.corner, s.cornerBR]} />
                    <Text style={s.uploadIcon}>📷</Text>
                    <Text style={s.uploadLabel}>Tap to capture or upload</Text>
                  </>
                )}
                {bottleImage && !aiLoading && aiStatus && (
                  <View style={s.aiStatusBar}><Text style={s.aiStatusText}>{aiStatus}</Text></View>
                )}
              </TouchableOpacity>

              {/* Basic fields */}
              <TextInput style={s.field} placeholder="Perfume" placeholderTextColor="rgba(19,19,26,0.4)" value={title} onChangeText={setTitle} />
              <View style={s.row}>
                <TextInput style={[s.field, { flex: 1 }]} placeholder="Brand" placeholderTextColor="rgba(19,19,26,0.4)" value={brand} onChangeText={setBrand} />
                <TextInput style={[s.field, { flex: 1 }]} placeholder="Perfumer" placeholderTextColor="rgba(19,19,26,0.4)" value={perfumer} onChangeText={setPerfumer} />
              </View>
              <View style={s.row}>
                <TouchableOpacity style={[s.field, { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]} onPress={() => setGenderPickerVisible(true)}>
                  <Text style={gender ? s.chooserFilled : s.chooserEmpty}>{gender || "Gender"}</Text>
                  <Text style={s.chevron}>▾</Text>
                </TouchableOpacity>
                <TextInput style={[s.field, { flex: 1 }]} placeholder="Season" placeholderTextColor="rgba(19,19,26,0.4)" value={seasons} onChangeText={setSeasons} />
              </View>
              <View style={s.row}>
                <TextInput style={[s.field, { flex: 1 }]} placeholder="Price" placeholderTextColor="rgba(19,19,26,0.4)" value={priceText} onChangeText={setPriceText} />
                <TextInput style={[s.field, { flex: 1 }]} placeholder="Rating (0-10)" placeholderTextColor="rgba(19,19,26,0.4)" value={rating} onChangeText={setRating} keyboardType="decimal-pad" />
              </View>

              {/* Fragrance Family */}
              <SH text="Fragrance Family" />
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <TouchableOpacity style={s.chooser} onPress={() => setFamilyPickerVisible(true)}>
                  <Text style={pendingFamily ? s.chooserFilled : s.chooserEmpty}>{pendingFamily || "Choose"}</Text>
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
              <NoteInput placeholder="Top Notes" tags={notesTop} inputVal={topInput} onChangeInput={setTopInput} onAdd={(v) => { setNotesTop((p) => [...p, v]); setTopInput(""); }} onRemove={(i) => setNotesTop((p) => p.filter((_, j) => j !== i))} />
              <NoteInput placeholder="Middle Notes" tags={notesHeart} inputVal={midInput} onChangeInput={setMidInput} onAdd={(v) => { setNotesHeart((p) => [...p, v]); setMidInput(""); }} onRemove={(i) => setNotesHeart((p) => p.filter((_, j) => j !== i))} />
              <NoteInput placeholder="Base Notes" tags={notesBase} inputVal={baseInput} onChangeInput={setBaseInput} onAdd={(v) => { setNotesBase((p) => [...p, v]); setBaseInput(""); }} onRemove={(i) => setNotesBase((p) => p.filter((_, j) => j !== i))} />

              {/* Performance Sliders */}
              <SH text="Performance" />
              <SliderRow label="Projection" value={projectionVal} onChange={setProjectionVal} />
              <SliderRow label="Sillage" value={sillageVal} onChange={setSillageVal} />
              <SliderRow label="Longevity" value={longevityVal} onChange={setLongevityVal} />
              <View style={{ marginBottom: 14 }}>
                <Text style={[s.fieldLabel, { marginBottom: 6 }]}>Dry Down</Text>
                <TextInput
                  style={s.field}
                  placeholder="Describe the dry down..."
                  placeholderTextColor="rgba(19,19,26,0.4)"
                  value={dryDownText}
                  onChangeText={setDryDownText}
                  multiline
                />
              </View>

              {/* Inspiration Photo */}
              <SH text="Inspiration" />
              <TouchableOpacity style={[s.photoUpload, { height: 180 }]} onPress={pickInspirationPhoto} activeOpacity={0.85}>
                {inspirationImage && <Image source={{ uri: inspirationImage }} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} resizeMode="cover" />}
                {!inspirationImage && <Text style={s.uploadLabel}>Upload Inspiration Photo</Text>}
                {inspirationImage && (
                  <View style={s.aiStatusBar}><Text style={s.aiStatusText}>Tap to change</Text></View>
                )}
              </TouchableOpacity>

              {/* Color(s) */}
              <SH text="Color(s)" />
              <View style={s.colorWheelWrap}>
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
                    <TouchableOpacity key={i} style={[s.colorDot, { backgroundColor: c }]} onPress={() => setColors((p) => p.filter((_, j) => j !== i))} />
                  ))}
                </View>
                <TouchableOpacity style={s.addBtn} onPress={() => { if (!colors.includes(selectedColor)) setColors((p) => [...p, selectedColor]); }}>
                  <Text style={s.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>

              {/* Music */}
              <SH text="Music" />
              <TextInput style={s.field} placeholder="URL..." placeholderTextColor="rgba(19,19,26,0.4)" value={musicUrl} onChangeText={setMusicUrl} keyboardType="url" autoCapitalize="none" />

              {/* Notes */}
              <SH text="Notes" />
              <TextInput
                style={[s.field, { height: 160, textAlignVertical: "top", paddingTop: 14 }]}
                placeholder="Notes..."
                placeholderTextColor="rgba(19,19,26,0.4)"
                value={description}
                onChangeText={setDescription}
                multiline
              />

              {/* Scent Somm AI */}
              <SH text="Ask Scent Somm AI (Beta)" />
              <Text style={s.aiHint}>Fill in perfume name and brand first for best results...</Text>
              <View style={s.aiGrid}>
                {AI_ACTIONS.map((a) => (
                  <TouchableOpacity key={a.key} style={s.aiBtn} onPress={() => runAIAction(a.key)} disabled={!!aiActionLoading}>
                    {aiActionLoading === a.key
                      ? <ActivityIndicator color="#13131a" size="small" />
                      : <Text style={s.aiBtnText}>{a.label}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[s.field, { height: 120, textAlignVertical: "top", paddingTop: 14 }]}
                placeholder="Answers..."
                placeholderTextColor="rgba(19,19,26,0.4)"
                value={aiResult ?? ""}
                editable={false}
                multiline
              />
            </View>
          </ScrollView>

          {/* Bottom action bar */}
          <View style={s.bottomBar}>
            <TouchableOpacity style={s.moreBtn} onPress={() => setMoreVisible(true)}>
              <Text style={s.moreBtnText}>More</Text>
            </TouchableOpacity>
            <View style={s.fabBtn}>
              <Text style={s.fabBtnText}>+</Text>
            </View>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* More Bottom Sheet */}
        <Modal visible={moreVisible} transparent animationType="slide" onRequestClose={closeMore}>
          <View style={ms.backdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeMore} />
            <View style={ms.sheet}>
              <View style={ms.handle} />

              {moreView === "main" && (
                <>
                  <TouchableOpacity style={ms.btn} onPress={handleAddToCollection}>
                    <Text style={ms.btnText}>+Collection</Text>
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

                  <TouchableOpacity style={[ms.btn, ms.btnBeige]} onPress={() => { closeMore(); Alert.alert("Print", "Print coming soon."); }}>
                    <Text style={ms.btnText}>Print</Text>
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

        {/* Family Picker Modal */}
        <Modal visible={familyPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFamilyPickerVisible(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#0e0e16" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Select Family</Text>
              <TouchableOpacity onPress={() => setFamilyPickerVisible(false)}>
                <Text style={{ color: "#a78bfa", fontSize: 15 }}>Done</Text>
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
                  {pendingFamily === f ? <Text style={{ color: "#a78bfa" }}>✓</Text> : null}
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
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  logoText: { color: "#13131a", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.08)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center" },
  backIcon: { color: "#13131a", fontSize: 24, fontWeight: "300", lineHeight: 28, marginTop: -2 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.08)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },
  pageTitle: { color: "#13131a", fontSize: 26, fontWeight: "800", letterSpacing: -0.5, marginBottom: 16 },

  photoUpload: { width: "100%", height: 380, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.06)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 16, overflow: "hidden" },
  uploadIcon: { fontSize: 32, marginBottom: 10, opacity: 0.4 },
  uploadLabel: { color: "rgba(19,19,26,0.4)", fontSize: 14 },
  corner: { position: "absolute", width: 22, height: 22, borderColor: "rgba(19,19,26,0.3)", borderWidth: 0 },
  cornerTL: { top: 16, left: 16, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
  cornerTR: { top: 16, right: 16, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
  cornerBL: { bottom: 16, left: 16, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 16, right: 16, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject as any, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "rgba(237,255,141,0.6)" },
  loadingText: { color: "rgba(19,19,26,0.6)", fontSize: 12 },
  aiStatusBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(167,139,250,0.3)", paddingVertical: 6, paddingHorizontal: 12 },
  aiStatusText: { color: "#7c3aed", fontSize: 12, textAlign: "center" },

  field: { backgroundColor: "rgba(0,0,0,0.07)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 13, color: "#13131a", fontSize: 14, marginBottom: 10 },
  row: { flexDirection: "row", gap: 10 },

  sectionHeader: { color: "rgba(19,19,26,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 18, marginBottom: 12 },
  fieldLabel: { color: "rgba(19,19,26,0.55)", fontSize: 13 },

  chooser: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.07)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 13 },
  chooserEmpty: { color: "rgba(19,19,26,0.4)", fontSize: 14 },
  chooserFilled: { color: "#13131a", fontSize: 14 },
  chevron: { color: "rgba(19,19,26,0.4)", fontSize: 12 },
  addBtn: { backgroundColor: "#13131a", borderRadius: 24, paddingHorizontal: 22, paddingVertical: 13, justifyContent: "center" },
  addBtnText: { color: "#E5F772", fontSize: 14, fontWeight: "600" },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  tag: { backgroundColor: "rgba(0,0,0,0.08)", borderWidth: 1, borderColor: "rgba(0,0,0,0.14)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  tagText: { color: "#13131a", fontSize: 13 },

  sliderTrack: { height: 46, borderRadius: 23, backgroundColor: "rgba(0,0,0,0.07)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", overflow: "hidden", justifyContent: "center" },
  sliderFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.55)" },
  sliderThumb: { position: "absolute", width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", top: 5, transform: [{ translateX: -28 }], shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },

  colorWheelWrap: { height: 320, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", padding: 12, marginBottom: 14 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "rgba(0,0,0,0.15)" },

  aiHint: { color: "rgba(19,19,26,0.5)", fontSize: 13, marginBottom: 14 },
  aiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  aiBtn: { width: "47%", backgroundColor: "rgba(0,0,0,0.07)", borderWidth: 1, borderColor: "rgba(0,0,0,0.14)", borderRadius: 14, paddingVertical: 18, alignItems: "center", justifyContent: "center" },
  aiBtnText: { color: "#13131a", fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },

  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.1)" },
  moreBtn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.2)", borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12 },
  moreBtnText: { color: "#13131a", fontSize: 14 },
  fabBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: "rgba(0,0,0,0.2)", backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },
  fabBtnText: { color: "rgba(19,19,26,0.5)", fontSize: 26, fontWeight: "300", lineHeight: 30 },
  saveBtn: { backgroundColor: "#C6FF00", borderRadius: 24, paddingHorizontal: 28, paddingVertical: 13 },
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
  btnWishlisted: { backgroundColor: "#E5F772", borderColor: "#E5F772" },
  btnDelete: { backgroundColor: "#FF2D55", borderColor: "#FF2D55" },
  btnText: { color: "#13131a", fontSize: 15, fontWeight: "500" },
  btnTextLight: { color: "#fff" },
  confirmText: { color: "#13131a", fontSize: 17, fontWeight: "600", textAlign: "center", marginVertical: 16 },
  confirmRow: { flexDirection: "row", gap: 12 },
});
