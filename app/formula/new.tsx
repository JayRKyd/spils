import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal, StyleSheet, Alert, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const DILUENTS = [
  "Ethanol (SDA 40B)",
  "DPG (Dipropylene Glycol)",
  "TEC (Triethyl Citrate)",
  "IPM (Isopropyl Myristate)",
  "MCT Oil",
  "Perfumers Alcohol",
];

const SYMBOL_ICONS: Record<string, string> = {
  Top: "▲", Mid: "■", Base: "●", Solvent: "★", Other: "✴",
};

type Material = { id: number; name: string; type: string | null; };
type PendingLine = { tempId: string; material: Material | null; name: string; amount: string; };

type PendingMoodItem =
  | { id: string; type: "note"; text: string }
  | { id: string; type: "image"; uri: string; mimeType: string }
  | { id: string; type: "audio"; uri: string; name: string };

type MoodTab = "image" | "note" | "audio";
const MOOD_TABS: { key: MoodTab; label: string }[] = [
  { key: "image", label: "Image / Video" },
  { key: "note", label: "Note" },
  { key: "audio", label: "Audio" },
];

function LocalAddMoodModal({ visible, onClose, onAdd }: {
  visible: boolean; onClose: () => void; onAdd: (item: PendingMoodItem) => void;
}) {
  const [tab, setTab] = useState<MoodTab>("image");
  const [noteText, setNoteText] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState("image/jpeg");
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setTab("image"); setNoteText(""); setImageUri(null); setImageMimeType("image/jpeg"); setAudioUri(null); setAudioName(null); }
  }, [visible]);

  const pickImage = async (source: "camera" | "library") => {
    const opts = { mediaTypes: ["images", "videos"] as any, allowsEditing: false, quality: 0.75 };
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageMimeType(asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg"));
    }
  };

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/aac", "audio/x-m4a", "audio/*"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setAudioUri(result.assets[0].uri);
      setAudioName(result.assets[0].name);
    }
  };

  const handleAdd = () => {
    const id = `${Date.now()}-${Math.random()}`;
    if (tab === "note" && noteText.trim()) onAdd({ id, type: "note", text: noteText.trim() });
    else if (tab === "image" && imageUri) onAdd({ id, type: "image", uri: imageUri, mimeType: imageMimeType });
    else if (tab === "audio" && audioUri && audioName) onAdd({ id, type: "audio", uri: audioUri, name: audioName });
    onClose();
  };

  const canAdd = tab === "note" ? noteText.trim().length > 0 : tab === "image" ? !!imageUri : !!audioUri;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient colors={["#FFD4E6", "#F5AEC8", "#EC8FB5"]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
            <Text style={{ color: "#13131a", fontSize: 16, fontWeight: "700" }}>ADD TO MOOD BOARD</Text>
            <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.08)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#13131a", fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", marginHorizontal: 20, marginBottom: 16, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 12, padding: 4 }}>
            {MOOD_TABS.map(({ key, label }) => (
              <TouchableOpacity key={key} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: tab === key ? "#fff" : "transparent" }} onPress={() => setTab(key)}>
                <Text style={{ color: tab === key ? "#13131a" : "rgba(0,0,0,0.4)", fontSize: 13, fontWeight: "600" }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
            {tab === "image" && (
              <>
                <TouchableOpacity
                  style={{ height: 220, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.06)", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", alignItems: "center", justifyContent: "center", marginBottom: 12, overflow: "hidden" }}
                  onPress={() => Alert.alert("Upload", "Choose source", [
                    { text: "Take Photo", onPress: () => pickImage("camera") },
                    { text: "Choose from Library", onPress: () => pickImage("library") },
                    { text: "Cancel", style: "cancel" },
                  ])}
                  activeOpacity={0.85}
                >
                  {imageUri
                    ? <Image source={{ uri: imageUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    : <Text style={{ color: "rgba(0,0,0,0.35)", fontSize: 14 }}>Tap to select image or video</Text>}
                </TouchableOpacity>
              </>
            )}
            {tab === "note" && (
              <TextInput
                style={{ backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 14, padding: 16, color: "#13131a", fontSize: 15, minHeight: 120, textAlignVertical: "top" }}
                placeholder="Write your note..."
                placeholderTextColor="rgba(0,0,0,0.3)"
                value={noteText}
                onChangeText={setNoteText}
                multiline
                autoFocus
              />
            )}
            {tab === "audio" && (
              <TouchableOpacity
                style={{ backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 14, padding: 20, alignItems: "center" }}
                onPress={pickAudio}
              >
                <Text style={{ color: "#13131a", fontSize: 14, fontWeight: "600" }}>{audioName ?? "Select Audio File"}</Text>
                {!audioName && <Text style={{ color: "rgba(0,0,0,0.35)", fontSize: 12, marginTop: 4 }}>mp3, m4a, wav, aac</Text>}
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={{ paddingHorizontal: 20, paddingVertical: 16, flexDirection: "row", justifyContent: "space-between" }}>
            <TouchableOpacity style={{ borderWidth: 1, borderColor: "rgba(0,0,0,0.2)", borderRadius: 100, paddingHorizontal: 24, paddingVertical: 13 }} onPress={onClose}>
              <Text style={{ color: "#13131a", fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ backgroundColor: canAdd ? "#C6FF00" : "rgba(0,0,0,0.1)", borderRadius: 100, paddingHorizontal: 32, paddingVertical: 13 }} onPress={handleAdd} disabled={!canAdd}>
              <Text style={{ color: "#13131a", fontSize: 14, fontWeight: "700" }}>Add</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

export default function NewFormula() {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bottleSizeMl, setBottleSizeMl] = useState(15);
  const [concPercent, setConcPercent] = useState(20);
  const [diluent, setDiluent] = useState("Ethanol (SDA 40B)");
  const [diluentPickerVisible, setDiluentPickerVisible] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingMoodItems, setPendingMoodItems] = useState<PendingMoodItem[]>([]);
  const [addMoodVisible, setAddMoodVisible] = useState(false);

  // Material inline add
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Material[]>([]);
  const [selected, setSelected] = useState<Material | null>(null);
  const [amount, setAmount] = useState("0.000");
  const [lines, setLines] = useState<PendingLine[]>([]);

  const totalG = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const targetConcentrateG = (bottleSizeMl * concPercent) / 100;
  const diluentMl = Math.max(0, bottleSizeMl - totalG).toFixed(1);
  const atTarget = Math.abs(totalG - targetConcentrateG) < 0.001;

  // Debounced search — user's Organ only
  useEffect(() => {
    if (!search.trim() || selected) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("materials")
        .select("id,name,type")
        .eq("user_id", user?.id)
        .ilike("name", `%${search}%`)
        .limit(10);
      setSearchResults((data as Material[]) ?? []);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selected, user?.id]);

  const handleAddLine = () => {
    const matName = selected?.name ?? search.trim();
    if (!matName) return;
    setLines((prev) => [
      ...prev,
      { tempId: `${Date.now()}-${Math.random()}`, material: selected, name: matName, amount },
    ]);
    setSearch(""); setSelected(null); setAmount("0.000"); setSearchResults([]);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      // Store params in notes field (matches how [id].tsx reads them)
      const notesStr = `Bottle: ${bottleSizeMl}mL, Concentration: ${concPercent}%, Diluent: ${diluent}`;
      const { data: formula, error: fErr } = await supabase
        .from("formulas")
        .insert([{
          name: name.trim(),
          description: description.trim() || null,
          user_id: user?.id,
          notes: notesStr,
        }])
        .select()
        .single();
      if (fErr || !formula) throw fErr ?? new Error("Failed to create formula");

      for (const line of lines) {
        let materialId = line.material?.id ?? null;
        if (!materialId) {
          // New material — auto-add to Organ
          const { data: mat, error: matErr } = await supabase
            .from("materials")
            .insert([{ name: line.name, user_id: user?.id }])
            .select("id")
            .single();
          if (matErr || !mat) continue;
          materialId = mat.id;
        }
        await supabase.from("formula_lines").insert([{
          formula_id: formula.id,
          material_id: materialId,
          amount_g: parseFloat(line.amount) || 0,
        }]);
      }

      // Upload pending moodboard items
      for (const item of pendingMoodItems) {
        try {
          if (item.type === "note") {
            await supabase.from("formula_moodboard_assets").insert({
              formula_id: formula.id, file_url: "EMPTY", media_type: "note", caption: item.text,
            });
          } else if (item.type === "image") {
            const isVideo = item.mimeType.startsWith("video/");
            const ext = item.mimeType.split("/")[1] || (isVideo ? "mp4" : "jpg");
            const fileName = `formula_${formula.id}/${Date.now()}-${isVideo ? "video" : "photo"}.${ext}`;
            const base64 = await FileSystem.readAsStringAsync(item.uri, { encoding: "base64" });
            await supabase.storage.from("moodboard").upload(fileName, decode(base64), { contentType: item.mimeType });
            await supabase.from("formula_moodboard_assets").insert({
              formula_id: formula.id, file_url: fileName, media_type: isVideo ? "video" : "image", caption: null,
            });
          } else if (item.type === "audio") {
            const ext = item.name.split(".").pop() ?? "mp3";
            const fileName = `formula_${formula.id}/${Date.now()}-audio.${ext}`;
            const base64 = await FileSystem.readAsStringAsync(item.uri, { encoding: "base64" });
            await supabase.storage.from("moodboard").upload(fileName, decode(base64), { contentType: `audio/${ext}` });
            await supabase.from("formula_moodboard_assets").insert({
              formula_id: formula.id, file_url: fileName, media_type: "audio", caption: item.name,
            });
          }
        } catch {}
      }

      router.replace("/(tabs)/formulas" as any);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to create formula");
    } finally {
      setSaving(false);
    }
  };

  const showDropdown = search.trim().length > 0 && !selected;
  const exactMatch = searchResults.some((r) => r.name.toLowerCase() === search.toLowerCase());
  const canAdd = !!(selected || search.trim());

  return (
    <LinearGradient colors={["#FFD4E6", "#F5AEC8", "#EC8FB5"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Nav */}
        <View style={s.navBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.back}>← Lab</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <TextInput
              style={s.formulaName}
              placeholder="Formula Name"
              placeholderTextColor="rgba(0,0,0,0.25)"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <Text style={s.formulaDate}>
              {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </Text>
            <TextInput
              style={s.formulaDesc}
              placeholder="Tap to add notes..."
              placeholderTextColor="rgba(0,0,0,0.25)"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          {/* ① Mood Board */}
          <View style={[s.panel, { marginHorizontal: 16, marginBottom: 16 }]}>
            <View style={[s.sectionHeader, { marginBottom: 14 }]}>
              <Text style={s.sectionTitle}>Mood Board</Text>
              <TouchableOpacity style={s.addBtn} onPress={() => setAddMoodVisible(true)}>
                <Text style={s.addBtnText}>+ Add Item</Text>
              </TouchableOpacity>
            </View>
            {pendingMoodItems.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <Text style={s.emptyHint}>No mood board items yet. Add images, notes or audio.</Text>
              </View>
            ) : (
              <>
                {/* Notes — full width */}
                {pendingMoodItems.filter((i) => i.type === "note").map((item) => (
                  <View key={item.id} style={s.noteCard}>
                    <Text style={s.noteText}>{(item as any).text}</Text>
                    <TouchableOpacity style={s.noteDeleteBtn} onPress={() => setPendingMoodItems((p) => p.filter((i) => i.id !== item.id))}>
                      <Text style={{ color: "#f87171", fontSize: 16 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Images & audio — 2 per row */}
                {pendingMoodItems.filter((i) => i.type === "image" || i.type === "audio").length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                    {pendingMoodItems.filter((i) => i.type === "image" || i.type === "audio").map((item) => (
                      <View key={item.id} style={{ width: "47%", aspectRatio: 4 / 3, borderRadius: 12, overflow: "hidden", position: "relative", backgroundColor: "rgba(0,0,0,0.08)" }}>
                        {item.type === "image"
                          ? <Image source={{ uri: (item as any).uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                          : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 28 }}>🎵</Text><Text style={{ fontSize: 10, color: "#13131a", marginTop: 4, paddingHorizontal: 4, textAlign: "center" }} numberOfLines={2}>{(item as any).name}</Text></View>
                        }
                        <TouchableOpacity
                          style={{ position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}
                          onPress={() => setPendingMoodItems((p) => p.filter((i) => i.id !== item.id))}
                        >
                          <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "700" }}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* ② Formula Parameters */}
          <View style={[s.panel, { marginHorizontal: 16, marginBottom: 16 }]}>
            <Text style={[s.sectionTitle, { marginBottom: 14 }]}>Formula Parameters</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.paramLabel}>Bottle Size (mL)</Text>
                <TextInput
                  style={s.paramInput}
                  value={String(bottleSizeMl)}
                  onChangeText={(v) => setBottleSizeMl(parseFloat(v) || 0)}
                  keyboardType="decimal-pad"
                  placeholderTextColor="rgba(0,0,0,0.3)"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.paramLabel}>Concentration (%)</Text>
                <TextInput
                  style={s.paramInput}
                  value={String(concPercent)}
                  onChangeText={(v) => setConcPercent(parseFloat(v) || 0)}
                  keyboardType="decimal-pad"
                  placeholderTextColor="rgba(0,0,0,0.3)"
                />
              </View>
            </View>
            <Text style={s.paramLabel}>Diluent</Text>
            <TouchableOpacity style={s.diluentRow} onPress={() => setDiluentPickerVisible(true)}>
              <Text style={{ color: "#13131a", fontSize: 14 }}>{diluent}</Text>
              <Text style={{ color: "rgba(0,0,0,0.4)", fontSize: 15 }}>▾</Text>
            </TouchableOpacity>
            <Text style={s.paramCalc}>
              Current concentrate: {totalG.toFixed(3)}g · Target: {targetConcentrateG.toFixed(3)}g · Diluent to add: {diluentMl} mL
            </Text>
          </View>

          {/* ③ Inline material add */}
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={s.searchBarInline}
                  placeholder="Search or type material name..."
                  placeholderTextColor="rgba(0,0,0,0.3)"
                  value={search}
                  onChangeText={(v) => { setSearch(v); setSelected(null); }}
                />
                {/* Dropdown */}
                {showDropdown && (
                  <View style={s.dropdown}>
                    {searchResults.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={s.dropdownRow}
                        onPress={() => { setSelected(item); setSearch(item.name); setSearchResults([]); }}
                      >
                        <Text style={s.dropdownName}>{item.name}</Text>
                        {item.type ? (
                          <Text style={s.dropdownType}>{SYMBOL_ICONS[item.type] ?? ""} {item.type}</Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                    {!exactMatch && (
                      <TouchableOpacity
                        style={[s.dropdownRow, { borderTopWidth: searchResults.length > 0 ? 1 : 0, borderTopColor: "rgba(0,0,0,0.08)" }]}
                        onPress={() => { setSearchResults([]); }}
                      >
                        <Text style={s.dropdownNew}>+ Add "{search}" as new material</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {selected && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, paddingHorizontal: 2 }}>
                    <Text style={{ color: "#0d9488", fontSize: 13 }}>✓ {selected.name} (from Organ)</Text>
                    <TouchableOpacity onPress={() => { setSelected(null); setSearch(""); }} style={{ marginLeft: 10 }}>
                      <Text style={{ color: "rgba(0,0,0,0.4)", fontSize: 13 }}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!selected && search.trim() && !showDropdown && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, paddingHorizontal: 2 }}>
                    <Text style={{ color: "#c27a00", fontSize: 13 }}>★ "{search}" will be added to your Organ</Text>
                  </View>
                )}
              </View>
              <TextInput
                style={s.amountInline}
                placeholder="0.000"
                placeholderTextColor="rgba(0,0,0,0.3)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={[s.addBtn, !canAdd && { opacity: 0.4 }]}
                onPress={handleAddLine}
                disabled={!canAdd}
              >
                <Text style={s.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ④ Materials Table */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <View style={[s.panel, { paddingHorizontal: 16 }]}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderText, { flex: 1 }]}>Material</Text>
                <Text style={[s.tableHeaderText, { width: 52 }]}>Type</Text>
                <Text style={[s.tableHeaderText, { width: 68, textAlign: "right" }]}>Amount (g)</Text>
                <View style={{ width: 30 }} />
              </View>
              {lines.length === 0 ? (
                <View style={{ paddingVertical: 24, alignItems: "center" }}>
                  <Text style={s.emptyHint}>No ingredients yet. Add some to get started.</Text>
                </View>
              ) : (
                lines.map((line) => (
                  <View key={line.tempId} style={s.tableRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.tableRowName} numberOfLines={1}>{line.name}</Text>
                      {!line.material && (
                        <Text style={{ color: "#c27a00", fontSize: 10 }}>New → Organ</Text>
                      )}
                    </View>
                    <Text style={[s.tableRowType, { width: 52 }]}>
                      {line.material?.type ? SYMBOL_ICONS[line.material.type] ?? "—" : "—"}
                    </Text>
                    <Text style={[s.tableRowAmount, { width: 68 }]}>
                      {parseFloat(line.amount).toFixed(3)}
                    </Text>
                    <TouchableOpacity style={{ width: 30, alignItems: "center" }} onPress={() => setLines((p) => p.filter((l) => l.tempId !== line.tempId))}>
                      <Text style={{ color: "#e05555", fontSize: 18, lineHeight: 22 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
              <View style={s.tableTotalRow}>
                <Text style={[s.tableTotalLabel, { flex: 1 }]}>Total</Text>
                <Text style={s.tableTotalVal}>{totalG.toFixed(3)}</Text>
                {lines.length > 0 && !atTarget && (
                  <Text style={{ color: "rgba(0,0,0,0.4)", fontSize: 12, marginLeft: 6 }}>
                    (under by {Math.abs(targetConcentrateG - totalG).toFixed(3)}g)
                  </Text>
                )}
                <Text style={[s.tableTotalVal, { width: 68, textAlign: "right" }]}>
                  {totalG > 0 ? "100.000%" : "—"}
                </Text>
                <View style={{ width: 30 }} />
              </View>
            </View>
          </View>

          {/* ⑤ Formula Summary */}
          <View style={[s.panel, { marginHorizontal: 16, marginBottom: 16 }]}>
            <Text style={[s.sectionTitle, { marginBottom: 16 }]}>Formula Summary</Text>
            <View style={{ flexDirection: "row" }}>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={s.statVal}>{totalG.toFixed(3)}g</Text>
                <Text style={s.statLabel}>Current Total</Text>
              </View>
              <View style={s.statDivider} />
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={s.statVal}>{targetConcentrateG.toFixed(3)}g</Text>
                <Text style={s.statLabel}>Target Concentrate</Text>
              </View>
              <View style={s.statDivider} />
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={s.statVal}>{diluentMl} mL</Text>
                <Text style={s.statLabel}>Base/Diluent Needed</Text>
              </View>
            </View>
          </View>

          {/* ⑥ Notes (collapsible) */}
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <TouchableOpacity
              style={[s.notesHeader, notesExpanded && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 }]}
              onPress={() => setNotesExpanded((v) => !v)}
              activeOpacity={0.8}
            >
              <Text style={s.sectionTitle}>Notes</Text>
              <Text style={{ color: "rgba(0,0,0,0.45)", fontSize: 18, lineHeight: 22 }}>
                {notesExpanded ? "∧" : "∨"}
              </Text>
            </TouchableOpacity>
            {notesExpanded && (
              <View style={s.notesBody}>
                <TextInput
                  style={{ color: "#13131a", fontSize: 14, minHeight: 80, textAlignVertical: "top" }}
                  placeholder="Add formula notes..."
                  placeholderTextColor="rgba(0,0,0,0.3)"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />
              </View>
            )}
          </View>

        </ScrollView>

        {/* Bottom buttons */}
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "transparent" }}>
          <View style={s.bottomRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, !name.trim() && { opacity: 0.4 }]}
              onPress={handleCreate}
              disabled={saving || !name.trim()}
            >
              {saving
                ? <ActivityIndicator color="#13131a" size="small" />
                : <Text style={s.saveBtnText}>Create</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <LocalAddMoodModal
          visible={addMoodVisible}
          onClose={() => setAddMoodVisible(false)}
          onAdd={(item) => setPendingMoodItems((p) => [...p, item])}
        />

        {/* Diluent Picker */}
        <Modal visible={diluentPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDiluentPickerVisible(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#0e1828" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
              <View style={{ width: 60 }} />
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Select Diluent</Text>
              <TouchableOpacity onPress={() => setDiluentPickerVisible(false)}>
                <Text style={{ color: "#a78bfa", fontSize: 16, fontWeight: "600" }}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {DILUENTS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                  onPress={() => { setDiluent(d); setDiluentPickerVisible(false); }}
                >
                  <Text style={{ color: "#fff", fontSize: 16 }}>{d}</Text>
                  {diluent === d ? <Text style={{ color: "#a78bfa", fontSize: 18 }}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  navBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back: { color: "#13131a", fontSize: 16, fontWeight: "600" },

  formulaName: { color: "#13131a", fontSize: 26, fontWeight: "700", marginBottom: 4 },
  formulaDate: { color: "rgba(0,0,0,0.4)", fontSize: 13, marginBottom: 8 },
  formulaDesc: { color: "rgba(0,0,0,0.55)", fontSize: 14, lineHeight: 20 },

  panel: { backgroundColor: "rgba(255,255,255,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: "#13131a", fontWeight: "600", fontSize: 16 },
  addBtn: { backgroundColor: "#13131a", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  emptyHint: { color: "rgba(0,0,0,0.3)", fontSize: 14, textAlign: "center" },
  noteCard: { width: "100%", backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.7)", borderRadius: 12, padding: 16, paddingBottom: 20, position: "relative", minHeight: 90, marginTop: 10 },
  noteText: { color: "#13131a", fontSize: 14, lineHeight: 22, paddingRight: 24 },
  noteDeleteBtn: { position: "absolute", top: 10, right: 12 },

  paramLabel: { color: "rgba(0,0,0,0.5)", fontSize: 12, marginBottom: 6 },
  paramInput: { backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: "#13131a", fontSize: 15 },
  diluentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  paramCalc: { color: "rgba(0,0,0,0.4)", fontSize: 12, lineHeight: 18 },

  searchBarInline: { backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, color: "#13131a", fontSize: 14 },
  amountInline: { backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11, color: "#13131a", fontSize: 14, width: 72, textAlign: "center" },

  dropdown: { position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", zIndex: 99, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6, marginTop: 4 },
  dropdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  dropdownName: { color: "#13131a", fontSize: 14, flex: 1 },
  dropdownType: { color: "rgba(0,0,0,0.4)", fontSize: 12 },
  dropdownNew: { color: "#0d9488", fontSize: 14, fontWeight: "600" },

  tableHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.1)" },
  tableHeaderText: { color: "rgba(0,0,0,0.4)", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  tableRowName: { color: "#13131a", fontSize: 14, flex: 1 },
  tableRowType: { color: "rgba(0,0,0,0.4)", fontSize: 13 },
  tableRowAmount: { color: "#13131a", fontSize: 14, textAlign: "right" },
  tableTotalRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.1)", marginTop: 2 },
  tableTotalLabel: { color: "#13131a", fontWeight: "700", fontSize: 14 },
  tableTotalVal: { color: "#13131a", fontWeight: "700", fontSize: 14 },

  statVal: { color: "#13131a", fontWeight: "700", fontSize: 17, marginBottom: 4, textAlign: "center" },
  statLabel: { color: "rgba(0,0,0,0.4)", fontSize: 11, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(0,0,0,0.1)", marginVertical: 4 },

  notesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "rgba(255,255,255,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 12 },
  notesBody: { backgroundColor: "rgba(255,255,255,0.25)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 16 },

  bottomRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16 },
  cancelBtn: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(0,0,0,0.15)", borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12 },
  cancelBtnText: { color: "#13131a", fontSize: 14 },
  saveBtn: { backgroundColor: "#C6FF00", borderRadius: 24, paddingHorizontal: 28, paddingVertical: 13 },
  saveBtnText: { color: "#13131a", fontSize: 15, fontWeight: "700" },
});
