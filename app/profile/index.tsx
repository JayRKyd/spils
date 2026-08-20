import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, Alert, StyleSheet, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { SpilsLogo } from "@/components/SpilsLogo";
import { ProfileIcon } from "@/components/ProfileIcon";
import { ConfirmModal, ConfirmConfig } from "@/components/ConfirmModal";

const ACCENT = "#a68bfa";
const STAT_COLORS: Record<string, string> = {
  Journal: "#edff8d",
  Collection: "#00AEEF",
  Lab: "#EC008C",
  Organ: "#33FF00",
};

function DarkScreen({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={["#000000", "#000000", ACCENT]}
      locations={[0, 0.82, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>{children}</SafeAreaView>
    </LinearGradient>
  );
}

interface ProfileData {
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

interface Stats {
  listings: number;
  messages: number;
  watchlist: number;
  perfumes: number;
  formulas: number;
  journal: number;
  materials: number;
}

function StatCard({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  return (
    <TouchableOpacity style={s.statCard} onPress={onPress} activeOpacity={0.7}>
      <Text style={[s.statValue, { color: STAT_COLORS[label] ?? "#fff" }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function EditProfileModal({ visible, profile, onClose, onSaved }: {
  visible: boolean; profile: ProfileData; onClose: () => void; onSaved: () => void;
}) {
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (visible) {
      setUsername(profile.username ?? "");
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [visible, profile]);

  const pickAvatar = (source: "camera" | "library") => async () => {
    const perm = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", `Allow ${source === "camera" ? "camera" : "photo library"} access.`); return; }
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]?.base64) {
      setAvatarUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleChangeAvatar = () => {
    Alert.alert("Change Avatar", "Choose an option", [
      { text: "Take Photo", onPress: pickAvatar("camera") },
      { text: "Choose from Library", onPress: pickAvatar("library") },
      ...(avatarUrl ? [{ text: "Remove Photo", style: "destructive" as const, onPress: () => setAvatarUrl("") }] : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await (supabase as any).from("profiles").upsert(
      { id: user.id, username: username.trim() || null, bio: bio.trim() || null, avatar_url: avatarUrl.trim() || null },
      { onConflict: "id" }
    );
    setSaving(false);
    onSaved();
  };

  const initials = (username || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <TouchableOpacity onPress={handleChangeAvatar} activeOpacity={0.8}>
              <View style={s.avatarLarge}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={{ width: "100%", height: "100%", borderRadius: 48 }} />
                ) : (
                  <Text style={s.avatarLargeText}>{initials}</Text>
                )}
              </View>
              <View style={s.avatarEditBadge}><Text style={{ fontSize: 13 }}>✎</Text></View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleChangeAvatar}><Text style={s.avatarChangeText}>Change Photo</Text></TouchableOpacity>
          </View>
          <Text style={s.fieldLabel}>Username</Text>
          <TextInput style={s.input} placeholder="your_username" placeholderTextColor="rgba(255,255,255,0.35)" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <Text style={s.fieldLabel}>Bio</Text>
          <TextInput style={[s.input, { height: 100, textAlignVertical: "top" }]} placeholder="Tell us about yourself..." placeholderTextColor="rgba(255,255,255,0.35)" value={bio} onChangeText={setBio} multiline numberOfLines={4} />
          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Profile</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function ProfileScreen() {
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<Stats>({ listings: 0, messages: 0, watchlist: 0, perfumes: 0, formulas: 0, journal: 0, materials: 0 });
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: p }, listings, messages, watchlist, perfumes, formulas, journal, materials] = await Promise.all([
      (supabase as any).from("profiles").select("username,avatar_url,bio,created_at").eq("id", user.id).maybeSingle(),
      (supabase as any).from("marketplace_listings").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      (supabase as any).from("marketplace_messages").select("*", { count: "exact", head: true }).eq("receiver_id", user.id).is("read_at", null),
      (supabase as any).from("marketplace_watchlist").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("perfumes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("formulas").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      (supabase as any).from("journal_entries").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      (supabase as any).from("materials").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    setProfile(p ?? { username: null, avatar_url: null, bio: null, created_at: new Date().toISOString() });
    setStats({
      listings: listings.count ?? 0,
      messages: messages.count ?? 0,
      watchlist: watchlist.count ?? 0,
      perfumes: perfumes.count ?? 0,
      formulas: formulas.count ?? 0,
      journal: journal.count ?? 0,
      materials: materials.count ?? 0,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const getInitials = () => {
    if (profile?.username) return profile.username.slice(0, 2).toUpperCase();
    return user?.email?.slice(0, 2).toUpperCase() ?? "U";
  };

  const handleSignOut = () => {
    setConfirm({
      title: "Sign Out",
      message: "Are you sure?",
      confirmLabel: "Sign Out",
      onConfirm: async () => {
        await signOut();
        router.replace("/(auth)/login" as any);
      },
    });
  };

  const memberSince = profile?.created_at
    ? (() => { const d = new Date(profile.created_at); return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.${String(d.getFullYear()).slice(-2)}`; })()
    : null;

  if (loading) return (
    <DarkScreen>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={ACCENT} />
      </View>
    </DarkScreen>
  );

  return (
    <DarkScreen>
      {/* Nav */}
      <View style={s.topNav}>
        <SpilsLogo height={22} color="#edff8d" />
        <TouchableOpacity onPress={() => {}} style={{ padding: 2 }}>
          <ProfileIcon size={34} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Heading + Sign Out */}
        <View style={s.headerRow}>
          <Text style={s.pageTitle}>Profile</Text>
          <TouchableOpacity onPress={handleSignOut}><Text style={s.signOut}>Sign Out</Text></TouchableOpacity>
        </View>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={s.avatar}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ width: "100%", height: "100%", borderRadius: 30 }} />
              ) : (
                <Text style={s.avatarText}>{getInitials()}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.displayName} numberOfLines={1}>{profile?.username ?? user?.email?.split("@")[0] ?? "User"}</Text>
              <Text style={s.metaRow} numberOfLines={1}>
                <Text style={s.email}>{user?.email}</Text>
                {memberSince ? <Text style={s.memberSince}>  |  Member since {memberSince}</Text> : null}
              </Text>
            </View>
          </View>
          {profile?.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
          <TouchableOpacity style={s.editProfileBtn} onPress={() => setEditVisible(true)}>
            <Text style={s.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* My Spils */}
        <Text style={s.sectionLabel}>MY SPILS</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 26 }}>
          <StatCard label="Journal" value={stats.journal} onPress={() => router.push("/(tabs)/journal" as any)} />
          <StatCard label="Collection" value={stats.perfumes} onPress={() => router.push("/(tabs)/collection" as any)} />
          <StatCard label="Lab" value={stats.formulas} onPress={() => router.push("/(tabs)/formulas" as any)} />
          <StatCard label="Organ" value={stats.materials} onPress={() => router.push("/(tabs)/materials" as any)} />
        </View>

        {/* My Community */}
        <View style={s.labelRow}>
          <Text style={[s.sectionLabel, { marginBottom: 0 }]}>MY COMMUNITY</Text>
          <View style={s.betaBadge}><Text style={s.betaText}>Beta</Text></View>
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 26 }}>
          <TouchableOpacity style={s.pillBtn} onPress={() => router.push("/(tabs)/community?myPosts=1" as any)}>
            <Text style={s.pillBtnText}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.pillBtn} onPress={() => router.push("/(tabs)/community?myPosts=1" as any)}>
            <Text style={s.pillBtnText}>Comments</Text>
          </TouchableOpacity>
        </View>

        {/* Marketplace (coming soon) */}
        <View style={s.labelRow}>
          <Text style={[s.sectionLabel, s.dimmed, { marginBottom: 0 }]}>MARKETPLACE</Text>
          <Text style={[s.sectionLabel, s.dimmed, { marginBottom: 0, fontWeight: "400" }]}> [COMING]</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          {["My Listings", "Watchlist", "Messages"].map((label) => (
            <TouchableOpacity key={label} style={[s.pillBtn, s.dimmed]} onPress={() => Alert.alert("Coming Soon", "Marketplace isn't available yet.")} activeOpacity={1}>
              <Text style={s.pillBtnText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {profile && (
        <EditProfileModal visible={editVisible} profile={profile} onClose={() => setEditVisible(false)} onSaved={() => { setEditVisible(false); fetchProfile(); }} />
      )}
      <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
    </DarkScreen>
  );
}

const s = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 12, paddingBottom: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 73, marginBottom: 22 },
  pageTitle: { color: "#fff", fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },
  signOut: { color: "#fff", fontSize: 13, fontWeight: "600" },
  profileCard: { borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 20, marginBottom: 32 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText: { color: "#13131a", fontSize: 20, fontWeight: "700" },
  metaRow: { marginTop: 4 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  betaBadge: { backgroundColor: "#edff8d", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  betaText: { color: "#13131a", fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  pillBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.7)", borderRadius: 100, paddingHorizontal: 24, paddingVertical: 10 },
  pillBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  dimmed: { opacity: 0.4 },
  avatarLarge: { width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(167,139,250,0.25)", borderWidth: 2, borderColor: "rgba(167,139,250,0.5)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarLargeText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  avatarEditBadge: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: "#a78bfa", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#000000" },
  avatarChangeText: { color: "#a78bfa", fontSize: 13, fontWeight: "600", marginTop: 10 },
  displayName: { color: "#fff", fontSize: 20, fontWeight: "800" },
  email: { color: ACCENT, fontSize: 12, fontWeight: "600" },
  memberSince: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  bio: { color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 12 },
  editProfileBtn: { borderWidth: 1, borderColor: ACCENT, borderRadius: 100, paddingVertical: 10, alignItems: "center", marginTop: 16 },
  editProfileText: { color: ACCENT, fontSize: 14, fontWeight: "600" },
  sectionLabel: { color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 1.5, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  statValue: { fontSize: 26, fontWeight: "800" },
  statLabel: { color: "#fff", fontSize: 10, marginTop: 4, textAlign: "center" },
  modal: { flex: 1, backgroundColor: "#000000" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  modalClose: { color: "rgba(255,255,255,0.5)", fontSize: 18 },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 15, marginBottom: 14 },
  saveBtn: { backgroundColor: "#a78bfa", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
