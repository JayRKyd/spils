import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Image, Modal, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";

type Perfume = {
  id: number;
  name: string;
  brand?: string | null;
  house?: string | null;
  year?: number | null;
  status?: string | null;
  category?: string | null;
  is_favorite?: boolean | null;
  concentration?: string | null;
  size_ml?: number | null;
  rating?: number | null;
  image_url?: string | null;
  notes?: string | null;
  top_notes?: string[] | null;
  heart_notes?: string[] | null;
  base_notes?: string[] | null;
  accords?: string[] | null;
  longevity?: string | null;
  sillage?: string | null;
  retailer?: string | null;
  price?: number | null;
};

const CATEGORY_OPTIONS = ["Designer", "Luxury", "Niche", "Artisan/Indie", "Celebrity", "Mass/Drugstore", "Vintage", "Custom/Bespoke"];
const CONCENTRATION_OPTIONS = ["Parfum/Extrait", "EDP", "EDT", "Cologne", "Oil"];
const STATUS_OPTIONS = ["Owned", "Wishlist", "Sample", "Archived"];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={s.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={{ color: "#fff", fontSize: 15 }}>{String(value)}</Text>
    </View>
  );
}

function TagRow({ label, tags }: { label: string; tags?: string[] | null }) {
  if (!tags?.length) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
        {tags.map((t) => (
          <View key={t} style={s.tag}><Text style={s.tagText}>{t}</Text></View>
        ))}
      </View>
    </View>
  );
}

function EditModal({ visible, perfume, onClose, onSaved }: {
  visible: boolean; perfume: Perfume; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Perfume>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setForm({ ...perfume }); }, [visible, perfume]);

  const set = (key: keyof Perfume, val: any) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    await supabase.from("perfumes").update({
      name: (form.name ?? "").trim(),
      brand: form.brand?.trim() || null,
      house: form.house?.trim() || null,
      concentration: form.concentration || null,
      size_ml: form.size_ml ?? null,
      year: form.year ?? null,
      category: form.category || null,
      notes: form.notes?.trim() || null,
      rating: form.rating ?? null,
      is_favorite: form.is_favorite ?? false,
      status: form.status || null,
      longevity: form.longevity?.trim() || null,
      sillage: form.sillage?.trim() || null,
      retailer: form.retailer?.trim() || null,
      price: form.price ?? null,
    }).eq("id", perfume.id);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Edit Perfume</Text>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
          {([
            { label: "Name *", key: "name" as keyof Perfume, placeholder: "Perfume name" },
            { label: "Brand", key: "brand" as keyof Perfume, placeholder: "Brand" },
            { label: "House", key: "house" as keyof Perfume, placeholder: "House" },
            { label: "Retailer", key: "retailer" as keyof Perfume, placeholder: "Where bought" },
            { label: "Notes", key: "notes" as keyof Perfume, placeholder: "Fragrance notes...", multiline: true },
            { label: "Longevity", key: "longevity" as keyof Perfume, placeholder: "e.g. 8 hours" },
            { label: "Sillage", key: "sillage" as keyof Perfume, placeholder: "e.g. moderate" },
          ] as any[]).map(({ label, key, placeholder, multiline }) => (
            <View key={key}>
              <Text style={s.fieldLabel}>{label}</Text>
              <TextInput
                style={[s.input, multiline && { height: 80, textAlignVertical: "top" }]}
                placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.35)"
                value={String((form as Record<string, any>)[key] ?? "")} onChangeText={(v) => set(key, v)}
                multiline={multiline} numberOfLines={multiline ? 3 : 1}
              />
            </View>
          ))}

          <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Year</Text>
              <TextInput style={s.input} placeholder="2023" placeholderTextColor="rgba(255,255,255,0.35)" value={String(form.year ?? "")} onChangeText={(v) => set("year", v ? parseInt(v) : null)} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Size (ml)</Text>
              <TextInput style={s.input} placeholder="100" placeholderTextColor="rgba(255,255,255,0.35)" value={String(form.size_ml ?? "")} onChangeText={(v) => set("size_ml", v ? parseFloat(v) : null)} keyboardType="decimal-pad" />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Rating (0-10)</Text>
              <TextInput style={s.input} placeholder="8.5" placeholderTextColor="rgba(255,255,255,0.35)" value={String(form.rating ?? "")} onChangeText={(v) => set("rating", v ? parseFloat(v) : null)} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Price</Text>
              <TextInput style={s.input} placeholder="150" placeholderTextColor="rgba(255,255,255,0.35)" value={String(form.price ?? "")} onChangeText={(v) => set("price", v ? parseFloat(v) : null)} keyboardType="decimal-pad" />
            </View>
          </View>

          <Text style={s.fieldLabel}>Concentration</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
            {CONCENTRATION_OPTIONS.map((opt) => (
              <Chip key={opt} label={opt} active={form.concentration === opt} onPress={() => set("concentration", form.concentration === opt ? null : opt)} />
            ))}
          </View>

          <Text style={s.fieldLabel}>Category</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
            {CATEGORY_OPTIONS.map((opt) => (
              <Chip key={opt} label={opt} active={form.category === opt} onPress={() => set("category", form.category === opt ? null : opt)} />
            ))}
          </View>

          <Text style={s.fieldLabel}>Status</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
            {STATUS_OPTIONS.map((opt) => (
              <Chip key={opt} label={opt} active={form.status === opt} onPress={() => set("status", opt)} />
            ))}
          </View>

          <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }} onPress={() => set("is_favorite", !form.is_favorite)}>
            <Text style={{ fontSize: 22 }}>{form.is_favorite ? "❤️" : "🤍"}</Text>
            <Text style={{ color: "#fff", fontSize: 15 }}>Favorite</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function CollectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [perfume, setPerfume] = useState<Perfume | null>(null);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("perfumes").select("*").eq("id", id).single();
    setPerfume(data as Perfume);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = () => {
    Alert.alert("Delete Perfume", `Remove "${perfume?.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await supabase.from("perfumes").delete().eq("id", id);
          router.back();
        },
      },
    ]);
  };

  if (loading) return (
    <GradientScreen gradient="collection">
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#a78bfa" />
      </View>
    </GradientScreen>
  );

  if (!perfume) return (
    <GradientScreen gradient="collection">
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "rgba(255,255,255,0.5)" }}>Perfume not found</Text>
      </View>
    </GradientScreen>
  );

  return (
    <GradientScreen gradient="collection">
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <TouchableOpacity onPress={() => setEditVisible(true)}><Text style={s.back}>Edit</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleDelete}><Text style={s.deleteBtn}>Delete</Text></TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {perfume.image_url ? (
          <Image source={{ uri: perfume.image_url }} style={s.heroImage} resizeMode="cover" />
        ) : (
          <View style={s.heroPlaceholder}><Text style={{ fontSize: 64 }}>🌸</Text></View>
        )}

        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={s.name}>{perfume.name}</Text>
            {perfume.brand ? <Text style={s.brandText}>{perfume.brand}</Text> : null}
          </View>
          <Text style={{ fontSize: 24 }}>{perfume.is_favorite ? "❤️" : "🤍"}</Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {perfume.status ? <View style={s.tagAccent}><Text style={s.tagAccentText}>{perfume.status}</Text></View> : null}
          {perfume.category ? <View style={s.tag}><Text style={s.tagText}>{perfume.category}</Text></View> : null}
          {perfume.concentration ? <View style={s.tag}><Text style={s.tagText}>{perfume.concentration}</Text></View> : null}
        </View>

        <GlassRow style={s.infoBlock}>
          <InfoRow label="Year" value={perfume.year} />
          <InfoRow label="Size" value={perfume.size_ml ? `${perfume.size_ml} ml` : null} />
          <InfoRow label="Rating" value={perfume.rating != null ? `★ ${perfume.rating}/10` : null} />
          <InfoRow label="Longevity" value={perfume.longevity} />
          <InfoRow label="Sillage" value={perfume.sillage} />
          <InfoRow label="Retailer" value={perfume.retailer} />
          <InfoRow label="Price" value={perfume.price != null ? `$${perfume.price}` : null} />
        </GlassRow>

        {perfume.notes ? (
          <GlassRow style={[s.infoBlock, { marginTop: 12 }]}>
            <Text style={s.rowLabel}>Notes</Text>
            <Text style={{ color: "#fff", fontSize: 15, marginTop: 4 }}>{perfume.notes}</Text>
          </GlassRow>
        ) : null}

        <TagRow label="Top Notes" tags={perfume.top_notes} />
        <TagRow label="Heart Notes" tags={perfume.heart_notes} />
        <TagRow label="Base Notes" tags={perfume.base_notes} />
        <TagRow label="Accords" tags={perfume.accords} />
      </ScrollView>

      {perfume && (
        <EditModal
          visible={editVisible}
          perfume={perfume}
          onClose={() => setEditVisible(false)}
          onSaved={() => { setEditVisible(false); fetch(); }}
        />
      )}
    </GradientScreen>
  );
}

const s = StyleSheet.create({
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back: { color: "#a78bfa", fontSize: 16 },
  deleteBtn: { color: "#f87171", fontSize: 16 },
  heroImage: { width: "100%", height: 220, borderRadius: 16, marginBottom: 16 },
  heroPlaceholder: { width: "100%", height: 160, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  name: { color: "#fff", fontSize: 24, fontWeight: "700" },
  brandText: { color: "rgba(255,255,255,0.5)", fontSize: 16, marginTop: 2 },
  tag: { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  tagText: { color: "#fff", fontSize: 12 },
  tagAccent: { backgroundColor: "rgba(167,139,250,0.2)", borderWidth: 1, borderColor: "rgba(167,139,250,0.4)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  tagAccentText: { color: "#a78bfa", fontSize: 12 },
  infoBlock: { padding: 16 },
  rowLabel: { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  chip: { marginRight: 8, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.08)" },
  chipActive: { backgroundColor: "#a78bfa", borderColor: "#a78bfa" },
  chipText: { color: "#fff", fontSize: 12 },
  modal: { flex: 1, backgroundColor: "#160a30" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  modalClose: { color: "rgba(255,255,255,0.5)", fontSize: 18 },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 15, marginBottom: 14 },
  saveBtn: { backgroundColor: "#a78bfa", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
