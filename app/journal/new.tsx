import { useState, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, Alert, Image,
  FlatList, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const SEASONS = ["Spring", "Summer", "Fall", "Winter"] as const;
const SEASON_ICONS: Record<string, string> = { Spring: "🌸", Summer: "☀️", Fall: "🍂", Winter: "❄️" };

const FRAGRANCE_FAMILIES = [
  { label: "Floral",    bg: "rgba(252,167,167,0.25)",  border: "rgba(252,167,167,0.5)"  },
  { label: "Woody",     bg: "rgba(180,120,60,0.25)",   border: "rgba(180,120,60,0.5)"   },
  { label: "Citrus",    bg: "rgba(253,230,60,0.2)",    border: "rgba(253,230,60,0.45)"  },
  { label: "Amber",     bg: "rgba(251,146,60,0.25)",   border: "rgba(251,146,60,0.5)"   },
  { label: "Aquatic",   bg: "rgba(96,165,250,0.2)",    border: "rgba(96,165,250,0.45)"  },
  { label: "Green",     bg: "rgba(74,222,128,0.2)",    border: "rgba(74,222,128,0.45)"  },
  { label: "Spicy",     bg: "rgba(248,113,113,0.2)",   border: "rgba(248,113,113,0.45)" },
  { label: "Gourmand",  bg: "rgba(192,132,252,0.2)",   border: "rgba(192,132,252,0.45)" },
  { label: "Aromatic",  bg: "rgba(52,211,153,0.2)",    border: "rgba(52,211,153,0.45)"  },
  { label: "Chypre",    bg: "rgba(163,230,53,0.2)",    border: "rgba(163,230,53,0.45)"  },
  { label: "Leather",   bg: "rgba(120,80,40,0.3)",     border: "rgba(120,80,40,0.5)"    },
  { label: "Fougère",   bg: "rgba(34,197,94,0.2)",     border: "rgba(34,197,94,0.45)"   },
];

const NOTE_SUGGESTIONS = [
  "Bergamot","Lemon","Lime","Orange","Grapefruit","Neroli","Petitgrain",
  "Rose","Jasmine","Iris","Orris","Lily","Peony","Violet","Tuberose","Gardenia","Ylang-Ylang",
  "Cedar","Sandalwood","Vetiver","Guaiac Wood","Birch",
  "Musk","Amber","Tonka Bean","Vanilla","Benzoin",
  "Apple","Pear","Peach","Plum","Blackcurrant","Fig","Pomegranate",
  "Black Pepper","Pink Pepper","Cardamom","Cinnamon","Nutmeg","Ginger","Saffron",
  "Green Tea","Mint","Basil","Galbanum",
  "Sea Salt","Ozone","Marine",
];

const AI_ACTIONS = [
  { key: "facts",            label: "✦ Facts",          desc: "Key facts about this fragrance" },
  { key: "description",     label: "✦ Description",    desc: "Poetic scent description" },
  { key: "when",            label: "✦ When to Wear",   desc: "Best occasions & seasons" },
  { key: "similar_market",  label: "✦ Similar Picks",  desc: "Fragrances you might love" },
];

// ─── Glass helpers ─────────────────────────────────────────────────────────────

function GlassBox({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <BlurView intensity={28} tint="dark" style={[g.box, style]}>
      <View style={[StyleSheet.absoluteFill, g.overlay]} />
      {children}
    </BlurView>
  );
}

const g = StyleSheet.create({
  box: { borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  overlay: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20 },
});

// ─── Section Header ───────────────────────────────────────────────────────────

function SH({ text }: { text: string }) {
  return <Text style={s.sectionHeader}>{text}</Text>;
}

// ─── Field Label ──────────────────────────────────────────────────────────────

function FL({ text }: { text: string }) {
  return <Text style={s.fieldLabel}>{text}</Text>;
}

// ─── Glass TextInput ──────────────────────────────────────────────────────────

function GInput({ style, ...props }: React.ComponentProps<typeof TextInput> & { style?: object }) {
  return (
    <TextInput
      style={[s.input, style]}
      placeholderTextColor="rgba(255,255,255,0.3)"
      {...props}
    />
  );
}

// ─── Tag Chip Input ───────────────────────────────────────────────────────────

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
    setVal("");
    setShowSuggest(false);
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <View style={s.tagWrap}>
        {tags.map((tag, i) => (
          <TouchableOpacity key={i} style={s.tagChip} onPress={() => onRemove(i)}>
            <Text style={s.tagChipText}>{tag} ✕</Text>
          </TouchableOpacity>
        ))}
        <TextInput
          style={s.tagInput}
          value={val}
          onChangeText={(t) => { setVal(t); setShowSuggest(true); }}
          onSubmitEditing={() => commit(val)}
          placeholder={tags.length === 0 ? placeholder : "+"}
          placeholderTextColor="rgba(255,255,255,0.3)"
          returnKeyType="done"
        />
      </View>
      {showSuggest && filtered.length > 0 && (
        <GlassBox style={{ marginTop: 4 }}>
          {filtered.map((s) => (
            <TouchableOpacity key={s} style={s2.suggestRow} onPress={() => commit(s)}>
              <Text style={s2.suggestText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </GlassBox>
      )}
    </View>
  );
}

const s2 = StyleSheet.create({
  suggestRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  suggestText: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function JournalNew() {
  const { user } = useAuth();

  // Core
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [perfumer, setPerfumer] = useState("");
  const [year, setYear] = useState("");
  const [gender, setGender] = useState("Unisex");
  const [priceText, setPriceText] = useState("");
  const [rating, setRating] = useState("");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [timeOfDay, setTimeOfDay] = useState("");

  // Pyramid
  const [notesTop, setNotesTop] = useState<string[]>([]);
  const [notesHeart, setNotesHeart] = useState<string[]>([]);
  const [notesBase, setNotesBase] = useState<string[]>([]);
  const [families, setFamilies] = useState<string[]>([]);
  const [accords, setAccords] = useState<string[]>([]);

  // Performance
  const [projection, setProjection] = useState("");
  const [sillage, setSillage] = useState("");
  const [longevity, setLongevity] = useState("");
  const [dryDown, setDryDown] = useState("");

  // Mood
  const [emotions, setEmotions] = useState<string[]>([]);

  // Music
  const [musicUrl, setMusicUrl] = useState("");
  const [musicTitle, setMusicTitle] = useState("");

  // Images
  const [bottleImage, setBottleImage] = useState<string | null>(null);
  const [bottleBase64, setBottleBase64] = useState<string | null>(null);
  const [inspirationImage, setInspirationImage] = useState<string | null>(null);

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiActionLoading, setAiActionLoading] = useState<string | null>(null);

  // Save
  const [saving, setSaving] = useState(false);

  // ─── Image picker helpers ──────────────────────────────────────────────────

  const launchPicker = async (
    source: "camera" | "library",
    opts: ImagePicker.ImagePickerOptions,
  ) => {
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow camera access to take a photo.");
        return null;
      }
      return ImagePicker.launchCameraAsync(opts);
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo library access to choose a photo.");
        return null;
      }
      return ImagePicker.launchImageLibraryAsync(opts);
    }
  };

  const pickBottlePhoto = () => {
    Alert.alert("Bottle Photo", "How would you like to add the photo?", [
      {
        text: "Take Photo",
        onPress: async () => {
          const result = await launchPicker("camera", {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.55,
            base64: true,
          });
          if (!result || result.canceled || !result.assets[0]) return;
          const asset = result.assets[0];
          setBottleImage(asset.uri);
          if (asset.base64) {
            const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
            setBottleBase64(dataUrl);
            runVisionAI(dataUrl);
          }
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const result = await launchPicker("library", {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.55,
            base64: true,
          });
          if (!result || result.canceled || !result.assets[0]) return;
          const asset = result.assets[0];
          setBottleImage(asset.uri);
          if (asset.base64) {
            const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
            setBottleBase64(dataUrl);
            runVisionAI(dataUrl);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const pickInspirationPhoto = () => {
    Alert.alert("Inspiration Image", "How would you like to add the photo?", [
      {
        text: "Take Photo",
        onPress: async () => {
          const result = await launchPicker("camera", {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.7,
          });
          if (!result || result.canceled || !result.assets[0]) return;
          setInspirationImage(result.assets[0].uri);
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const result = await launchPicker("library", {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.7,
          });
          if (!result || result.canceled || !result.assets[0]) return;
          setInspirationImage(result.assets[0].uri);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ─── AI Vision OCR ────────────────────────────────────────────────────────

  const runVisionAI = async (dataUrl: string) => {
    setAiLoading(true);
    setAiStatus("Analyzing bottle label…");
    setAiResult(null);
    try {
      const resp = await (supabase as any).functions.invoke("journal-ai", {
        body: { mode: "vision", imageDataUrl: dataUrl },
      });
      if (resp.error) throw resp.error;
      const a = resp.data?.autofill;
      if (!a || typeof a !== "object") {
        setAiStatus("Couldn't read the label. Try a clearer photo.");
        return;
      }
      // Auto-fill fields (only if currently empty to avoid overwriting user edits)
      if (!title && typeof a.perfume === "string") setTitle(a.perfume);
      if (!brand && typeof a.brand === "string") setBrand(a.brand);
      if (typeof a.gender === "string") setGender(a.gender);
      if (Array.isArray(a.seasons) && seasons.length === 0) {
        const norm = (x: string) => {
          const v = x.trim().toLowerCase();
          if (v === "autumn" || v === "fall") return "Fall";
          if (v === "spring") return "Spring";
          if (v === "summer") return "Summer";
          if (v === "winter") return "Winter";
          return "";
        };
        setSeasons(
          a.seasons.map((x: any) => norm(String(x))).filter(Boolean) as string[]
        );
      }
      if (Array.isArray(a.fragrance_families) && families.length === 0) {
        setFamilies(a.fragrance_families.filter((x: any) => typeof x === "string").slice(0, 4));
      }
      if (Array.isArray(a.top_notes) && notesTop.length === 0) {
        setNotesTop(a.top_notes.filter((x: any) => typeof x === "string"));
      }
      if (Array.isArray(a.heart_notes) && notesHeart.length === 0) {
        setNotesHeart(a.heart_notes.filter((x: any) => typeof x === "string"));
      }
      if (Array.isArray(a.base_notes) && notesBase.length === 0) {
        setNotesBase(a.base_notes.filter((x: any) => typeof x === "string"));
      }
      setAiStatus("✦ Auto-fill complete");
      if (typeof a.observations === "string" && a.observations.trim()) {
        setAiResult(a.observations.trim());
      }
      setAiPanelOpen(true);
    } catch (err) {
      console.error("[journal-ai vision]", err);
      setAiStatus("AI scan failed — fill in details manually.");
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Scent Somm AI Actions ─────────────────────────────────────────────────

  const runAIAction = async (action: string) => {
    setAiActionLoading(action);
    setAiResult(null);
    try {
      const context = {
        perfume: title,
        brand,
        gender,
        seasons,
        fragrance_families: families,
        notes: description,
        pyramid: { top: notesTop, heart: notesHeart, base: notesBase },
        performance: { sillage, longevity_hours: longevity, projection },
        dry_down: dryDown,
        music_link: musicUrl,
        date: entryDate,
        time: timeOfDay,
      };
      const resp = await (supabase as any).functions.invoke("journal-ai", {
        body: { mode: "action", action, context },
      });
      if (resp.error) throw resp.error;
      setAiResult(resp.data?.text ?? "No result returned.");
    } catch (err) {
      console.error("[journal-ai action]", err);
      setAiResult("AI request failed. Please try again.");
    } finally {
      setAiActionLoading(null);
    }
  };

  // ─── Save ──────────────────────────────────────────────────────────────────

  const detectMusicSource = (url: string) => {
    if (url.includes("spotify.com")) return "spotify";
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
    return "link";
  };

  const handleSave = async () => {
    if (!entryDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Invalid Date", "Use YYYY-MM-DD format.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("journal_entries").insert([{
      user_id: user?.id,
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
      accords: families.length ? families : null,
      projection: projection.trim() || null,
      sillage: sillage.trim() || null,
      longevity: longevity.trim() || null,
      dry_down: dryDown.trim() || null,
      emotions: emotions.length ? emotions : null,
      music_url: musicUrl.trim() || null,
      music_source: musicUrl.trim() ? detectMusicSource(musicUrl.trim()) : null,
      music_title: musicTitle.trim() || null,
      image_url: bottleBase64 ?? null,
    }]);
    setSaving(false);
    if (error) {
      Alert.alert("Error", "Failed to save. Please try again.");
      return;
    }
    router.back();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: "#1a0e05" }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Nav */}
        <View style={s.nav}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.navCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.navTitle}>New Entry</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#a78bfa" size="small" />
              : <Text style={s.navSave}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Photo Row ─────────────────────────────────────────────── */}
            <View style={s.photoRow}>
              {/* Bottle upload */}
              <TouchableOpacity style={s.photoCardWrap} onPress={pickBottlePhoto} activeOpacity={0.82}>
                <BlurView intensity={38} tint="dark" style={s.photoCardBlur}>
                  {/* glass overlay */}
                  <View style={[StyleSheet.absoluteFill, s.photoCardOverlay]} />

                  {/* uploaded image */}
                  {bottleImage
                    ? <Image source={{ uri: bottleImage }} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} resizeMode="cover" />
                    : null}

                  {/* empty state — dashed inner rect */}
                  {!bottleImage && !aiLoading && (
                    <View style={s.dashedInner}>
                      <Text style={s.uploadIcon}>📸</Text>
                      <Text style={s.uploadLabel}>Upload bottle photo</Text>
                      <Text style={s.uploadHint}>AI reads the label{"\n"}&amp; prefills your entry</Text>
                    </View>
                  )}

                  {/* AI loading overlay */}
                  {aiLoading && (
                    <View style={s.loadingOverlay}>
                      <ActivityIndicator color="#a78bfa" size="large" />
                      <Text style={s.loadingText}>{aiStatus}</Text>
                    </View>
                  )}

                  {/* AI badge after photo loaded */}
                  {bottleImage && !aiLoading && (
                    <View style={s.aiBadge}>
                      <Text style={s.aiBadgeText}>✦ Scent Somm AI Beta</Text>
                    </View>
                  )}

                  {/* AI status strip at bottom */}
                  {aiStatus && !aiLoading && (
                    <View style={s.aiStatusBar}>
                      <Text style={s.aiStatusText}>{aiStatus}</Text>
                    </View>
                  )}
                </BlurView>
              </TouchableOpacity>

              {/* Inspiration upload */}
              <TouchableOpacity style={s.photoCardWrapSm} onPress={pickInspirationPhoto} activeOpacity={0.82}>
                <BlurView intensity={38} tint="dark" style={s.photoCardBlur}>
                  <View style={[StyleSheet.absoluteFill, s.photoCardOverlay]} />

                  {inspirationImage
                    ? <Image source={{ uri: inspirationImage }} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} resizeMode="cover" />
                    : null}

                  {!inspirationImage && (
                    <View style={s.dashedInner}>
                      <Text style={s.uploadIcon}>🖼</Text>
                      <Text style={s.uploadLabel}>Inspiration</Text>
                      <Text style={s.uploadHint}>Upload a mood image</Text>
                    </View>
                  )}

                  {inspirationImage && (
                    <View style={[s.aiBadge, { backgroundColor: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.3)" }]}>
                      <Text style={[s.aiBadgeText, { color: "rgba(255,255,255,0.8)" }]}>Tap to change</Text>
                    </View>
                  )}
                </BlurView>
              </TouchableOpacity>
            </View>

            {/* AI Observation */}
            {aiResult && (
              <GlassBox style={{ marginBottom: 14, padding: 14 }}>
                <View style={s.aiResultHeader}>
                  <Text style={s.aiResultIcon}>✦</Text>
                  <Text style={s.aiResultLabel}>Scent Somm AI</Text>
                </View>
                <Text style={s.aiResultText}>{aiResult}</Text>
              </GlassBox>
            )}

            {/* ── Core ─────────────────────────────────────────────────── */}
            <SH text="Core" />

            <FL text="Perfume Name" />
            <GInput placeholder="e.g. Bleu de Chanel" value={title} onChangeText={setTitle} />

            <FL text="Description / Notes" />
            <GInput
              placeholder="How did it smell, perform, make you feel…"
              value={description}
              onChangeText={setDescription}
              multiline
              style={{ height: 80, textAlignVertical: "top" }}
            />

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <FL text="Date" />
                <GInput placeholder="YYYY-MM-DD" value={entryDate} onChangeText={setEntryDate} />
              </View>
              <View style={{ flex: 1 }}>
                <FL text="Rating (0–10)" />
                <GInput placeholder="8.5" value={rating} onChangeText={setRating} keyboardType="decimal-pad" />
              </View>
            </View>

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <FL text="Time of Day" />
                <GInput placeholder="Morning, Evening…" value={timeOfDay} onChangeText={setTimeOfDay} />
              </View>
              <View style={{ flex: 1 }}>
                <FL text="Visibility" />
                <TouchableOpacity style={s.toggleBtn} onPress={() => setIsPublic((v) => !v)}>
                  <Text style={s.toggleBtnText}>{isPublic ? "🌐 Public" : "🔒 Private"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Season ───────────────────────────────────────────────── */}
            <SH text="Season" />
            <View style={s.chipRow}>
              {SEASONS.map((season) => {
                const active = seasons.includes(season);
                return (
                  <TouchableOpacity
                    key={season}
                    style={[s.seasonChip, active && s.seasonChipActive]}
                    onPress={() => setSeasons((p) =>
                      p.includes(season) ? p.filter((x) => x !== season) : [...p, season]
                    )}
                  >
                    <Text style={s.seasonEmoji}>{SEASON_ICONS[season]}</Text>
                    <Text style={[s.seasonLabel, active && { color: "#fff", fontWeight: "700" }]}>{season}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Fragrance Info ────────────────────────────────────────── */}
            <SH text="Fragrance Info" />
            <FL text="Brand" />
            <GInput placeholder="Chanel, Dior, Maison Margiela…" value={brand} onChangeText={setBrand} />
            <FL text="Perfumer" />
            <GInput placeholder="Jacques Polge…" value={perfumer} onChangeText={setPerfumer} />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <FL text="Year" />
                <GInput placeholder="2019" value={year} onChangeText={setYear} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <FL text="Gender" />
                <GInput placeholder="Unisex, Masc, Fem…" value={gender} onChangeText={setGender} />
              </View>
            </View>
            <FL text="Price" />
            <GInput placeholder="$180 / 100ml" value={priceText} onChangeText={setPriceText} />

            {/* ── Fragrance Family ──────────────────────────────────────── */}
            <SH text="Fragrance Family" />
            <View style={s.chipRow}>
              {FRAGRANCE_FAMILIES.map(({ label, bg, border }) => {
                const active = families.includes(label);
                return (
                  <TouchableOpacity
                    key={label}
                    style={[s.familyChip, { backgroundColor: bg, borderColor: active ? border : "rgba(255,255,255,0.12)" }, active && { borderColor: border }]}
                    onPress={() => setFamilies((p) =>
                      p.includes(label) ? p.filter((x) => x !== label) : [...p, label]
                    )}
                  >
                    <Text style={[s.familyChipText, active && { color: "#fff", fontWeight: "700" }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Fragrance Pyramid ─────────────────────────────────────── */}
            <SH text="Fragrance Pyramid" />
            <FL text="▲ Top Notes" />
            <TagChipInput
              tags={notesTop}
              onAdd={(v) => setNotesTop((p) => [...p, v])}
              onRemove={(i) => setNotesTop((p) => p.filter((_, j) => j !== i))}
              placeholder="Type note + done to add…"
              suggestions={NOTE_SUGGESTIONS}
            />
            <FL text="◆ Heart Notes" />
            <TagChipInput
              tags={notesHeart}
              onAdd={(v) => setNotesHeart((p) => [...p, v])}
              onRemove={(i) => setNotesHeart((p) => p.filter((_, j) => j !== i))}
              placeholder="Type note + done to add…"
              suggestions={NOTE_SUGGESTIONS}
            />
            <FL text="● Base Notes" />
            <TagChipInput
              tags={notesBase}
              onAdd={(v) => setNotesBase((p) => [...p, v])}
              onRemove={(i) => setNotesBase((p) => p.filter((_, j) => j !== i))}
              placeholder="Type note + done to add…"
              suggestions={NOTE_SUGGESTIONS}
            />

            {/* ── Accords ───────────────────────────────────────────────── */}
            <SH text="Accords" />
            <TagChipInput
              tags={accords}
              onAdd={(v) => setAccords((p) => [...p, v])}
              onRemove={(i) => setAccords((p) => p.filter((_, j) => j !== i))}
              placeholder="e.g. Fresh, Earthy, Sweet…"
            />

            {/* ── Performance ───────────────────────────────────────────── */}
            <SH text="Performance" />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <FL text="Projection" />
                <GInput placeholder="Moderate" value={projection} onChangeText={setProjection} />
              </View>
              <View style={{ flex: 1 }}>
                <FL text="Sillage" />
                <GInput placeholder="Heavy" value={sillage} onChangeText={setSillage} />
              </View>
            </View>
            <FL text="Longevity" />
            <GInput placeholder="8 hours" value={longevity} onChangeText={setLongevity} />
            <FL text="Dry Down" />
            <GInput
              placeholder="Describe the dry down character…"
              value={dryDown}
              onChangeText={setDryDown}
              multiline
              style={{ height: 70, textAlignVertical: "top" }}
            />

            {/* ── Mood ──────────────────────────────────────────────────── */}
            <SH text="Mood & Emotions" />
            <TagChipInput
              tags={emotions}
              onAdd={(v) => setEmotions((p) => [...p, v])}
              onRemove={(i) => setEmotions((p) => p.filter((_, j) => j !== i))}
              placeholder="Nostalgic, Confident, Sensual…"
            />

            {/* ── Music ─────────────────────────────────────────────────── */}
            <SH text="Music" />
            <FL text="Spotify / YouTube URL" />
            <GInput
              placeholder="https://open.spotify.com/…"
              value={musicUrl}
              onChangeText={setMusicUrl}
              keyboardType="url"
              autoCapitalize="none"
            />
            <FL text="Track Name" />
            <GInput placeholder="Song name" value={musicTitle} onChangeText={setMusicTitle} />

            {/* ── Scent Somm AI ─────────────────────────────────────────── */}
            <SH text="Scent Somm™ AI" />
            <GlassBox style={{ marginBottom: 14 }}>
              {/* Header toggle */}
              <TouchableOpacity
                style={s.aiPanelHeader}
                onPress={() => setAiPanelOpen((v) => !v)}
              >
                <View style={s.aiPanelLeft}>
                  <Text style={s.aiPanelIcon}>✦</Text>
                  <Text style={s.aiPanelTitle}>Ask Scent Somm AI</Text>
                  <View style={s.betaBadge}><Text style={s.betaBadgeText}>BETA</Text></View>
                </View>
                <Text style={s.aiPanelChevron}>{aiPanelOpen ? "▲" : "▼"}</Text>
              </TouchableOpacity>

              {aiPanelOpen && (
                <View style={s.aiPanelBody}>
                  <Text style={s.aiPanelHint}>
                    Fill in perfume name & brand first for best results.
                  </Text>
                  <View style={s.aiActionGrid}>
                    {AI_ACTIONS.map((action) => (
                      <TouchableOpacity
                        key={action.key}
                        style={s.aiActionBtn}
                        onPress={() => runAIAction(action.key)}
                        disabled={!!aiActionLoading}
                      >
                        {aiActionLoading === action.key ? (
                          <ActivityIndicator color="#a78bfa" size="small" />
                        ) : (
                          <>
                            <Text style={s.aiActionLabel}>{action.label}</Text>
                            <Text style={s.aiActionDesc}>{action.desc}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  {aiResult && (
                    <View style={s.aiResultBox}>
                      <Text style={s.aiResultText}>{aiResult}</Text>
                    </View>
                  )}
                </View>
              )}
            </GlassBox>

            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Nav
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 4, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  navTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  navCancel: { color: "rgba(255,255,255,0.45)", fontSize: 16 },
  navSave: { color: "#a78bfa", fontSize: 16, fontWeight: "700" },

  // Photo cards — BlurView as outer shell, matching GlassCard pattern
  photoRow: { flexDirection: "row", gap: 12, marginBottom: 16 },

  // Larger card (bottle) — 3 flex units
  photoCardWrap: { flex: 3, aspectRatio: 3 / 4 },
  // Smaller card (inspiration) — 2 flex units
  photoCardWrapSm: { flex: 2, aspectRatio: 3 / 4 },

  // BlurView fills the touchable, acts as the glass shell
  photoCardBlur: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
  },
  // Frosted glass tint overlay (matches GlassCard)
  photoCardOverlay: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 20,
  },

  // Empty state inner container
  dashedInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  uploadIcon: { fontSize: 30, marginBottom: 10 },
  uploadLabel: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 4 },
  uploadHint: { color: "rgba(255,255,255,0.4)", fontSize: 11, textAlign: "center", lineHeight: 16 },

  // Loading overlay
  loadingOverlay: { ...StyleSheet.absoluteFillObject as any, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "rgba(0,0,0,0.35)" },
  loadingText: { color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center" },

  // AI badge — pinned to bottom of image
  aiBadge: { position: "absolute", bottom: 10, left: 10, right: 10, backgroundColor: "rgba(167,139,250,0.28)", borderWidth: 1, borderColor: "rgba(167,139,250,0.55)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  aiBadgeText: { color: "#d8b4fe", fontSize: 11, fontWeight: "700", textAlign: "center" },

  // AI status strip at very bottom edge
  aiStatusBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(167,139,250,0.18)", paddingVertical: 5, paddingHorizontal: 10, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  aiStatusText: { color: "#d8b4fe", fontSize: 11, textAlign: "center", fontWeight: "600" },

  // AI result (from vision)
  aiResultHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  aiResultIcon: { color: "#a78bfa", fontSize: 14 },
  aiResultLabel: { color: "#a78bfa", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  aiResultText: { color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 20 },

  // Form
  sectionHeader: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 22, marginBottom: 12 },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 5 },
  input: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: "#fff", fontSize: 14, marginBottom: 12 },
  row: { flexDirection: "row", gap: 10, marginBottom: 0 },
  toggleBtn: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12 },
  toggleBtnText: { color: "#fff", fontSize: 14 },

  // Season chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  seasonChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(255,255,255,0.05)" },
  seasonChipActive: { backgroundColor: "rgba(167,139,250,0.25)", borderColor: "rgba(167,139,250,0.6)" },
  seasonEmoji: { fontSize: 15 },
  seasonLabel: { color: "rgba(255,255,255,0.65)", fontSize: 13 },

  // Family chips
  familyChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16, borderWidth: 1, marginBottom: 6 },
  familyChipText: { color: "rgba(255,255,255,0.7)", fontSize: 12 },

  // Tag chip input
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 10, minHeight: 46, marginBottom: 0 },
  tagChip: { backgroundColor: "rgba(167,139,250,0.2)", borderWidth: 1, borderColor: "rgba(167,139,250,0.4)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText: { color: "#d8b4fe", fontSize: 12 },
  tagInput: { color: "#fff", fontSize: 13, minWidth: 80, flex: 1, paddingVertical: 2 },

  // AI panel
  aiPanelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  aiPanelLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiPanelIcon: { color: "#a78bfa", fontSize: 16 },
  aiPanelTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  aiPanelChevron: { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  betaBadge: { backgroundColor: "rgba(167,139,250,0.25)", borderWidth: 1, borderColor: "rgba(167,139,250,0.5)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  betaBadgeText: { color: "#c4b5fd", fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  aiPanelBody: { paddingHorizontal: 16, paddingBottom: 16 },
  aiPanelHint: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 12 },
  aiActionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  aiActionBtn: { flex: 1, minWidth: "45%", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center", minHeight: 60 },
  aiActionLabel: { color: "#a78bfa", fontSize: 12, fontWeight: "700", marginBottom: 3, textAlign: "center" },
  aiActionDesc: { color: "rgba(255,255,255,0.4)", fontSize: 10, textAlign: "center" },
  aiResultBox: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 14 },
});
