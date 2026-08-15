import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, Alert, StyleSheet, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";
import { ConfirmModal, ConfirmConfig } from "@/components/ConfirmModal";

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

function StatCard({ label, value, onPress, disabled }: { label: string; value: number; onPress?: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[s.statCard, disabled && s.disabled]}
      onPress={disabled ? () => Alert.alert("Coming Soon", "Marketplace isn't available yet.") : onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={s.statValue}>{value}</Text>
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

  if (loading) return (
    <GradientScreen gradient="profile">
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#a78bfa" />
      </View>
    </GradientScreen>
  );

  return (
    <GradientScreen gradient="profile">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <Text style={s.pageTitle}>Profile</Text>
          <TouchableOpacity onPress={handleSignOut}><Text style={s.signOut}>Sign Out</Text></TouchableOpacity>
        </View>

        <GlassRow style={s.profileCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <View style={s.avatar}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ width: "100%", height: "100%", borderRadius: 32 }} />
              ) : (
                <Text style={s.avatarText}>{getInitials()}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.displayName}>{profile?.username ?? user?.email?.split("@")[0] ?? "User"}</Text>
              <Text style={s.email}>{user?.email}</Text>
              {profile?.created_at ? <Text style={s.memberSince}>Member since {new Date(profile.created_at).toLocaleDateString()}</Text> : null}
            </View>
          </View>
          {profile?.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
          <TouchableOpacity style={s.editProfileBtn} onPress={() => setEditVisible(true)}>
            <Text style={s.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </GlassRow>

        <Text style={s.sectionLabel}>YOUR ACTIVITY</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <StatCard label="Journal" value={stats.journal} onPress={() => router.push("/(tabs)/journal" as any)} />
          <StatCard label="Collection" value={stats.perfumes} onPress={() => router.push("/(tabs)/collection" as any)} />
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <StatCard label="Lab" value={stats.formulas} onPress={() => router.push("/(tabs)/formulas" as any)} />
          <StatCard label="Organ" value={stats.materials} onPress={() => router.push("/(tabs)/materials" as any)} />
        </View>

        <Text style={s.sectionLabel}>MARKETPLACE</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <StatCard label="Listings" value={stats.listings} onPress={() => router.push("/profile/listings" as any)} />
          <StatCard label="Unread" value={stats.messages} onPress={() => router.push("/profile/messages" as any)} />
          <StatCard label="Watchlist" value={stats.watchlist} onPress={() => router.push("/profile/watchlist" as any)} />
        </View>

        {[
          { label: "My Listings", path: "/profile/listings", icon: "📦" },
          { label: "Messages", path: "/profile/messages", icon: "💬" },
          { label: "Watchlist", path: "/profile/watchlist", icon: "❤️" },
        ].map(({ label, path, icon }) => (
          <TouchableOpacity key={path} style={s.navRow} onPress={() => router.push(path as any)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 18 }}>{icon}</Text>
              <Text style={s.navLabel}>{label}</Text>
            </View>
            <Text style={s.navChevron}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[s.navRow, s.disabled]}
          onPress={() => Alert.alert("Coming Soon", "Marketplace isn't available yet.")}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 18 }}>🛒</Text>
            <Text style={s.navLabel}>Marketplace</Text>
          </View>
          <Text style={s.navChevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>

      {profile && (
        <EditProfileModal visible={editVisible} profile={profile} onClose={() => setEditVisible(false)} onSaved={() => { setEditVisible(false); fetchProfile(); }} />
      )}
      <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
    </GradientScreen>
  );
}

const s = StyleSheet.create({
  pageTitle: { color: "#fff", fontSize: 24, fontWeight: "700" },
  signOut: { color: "#f87171", fontSize: 14 },
  profileCard: { padding: 20, marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(167,139,250,0.25)", borderWidth: 2, borderColor: "rgba(167,139,250,0.5)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  avatarLarge: { width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(167,139,250,0.25)", borderWidth: 2, borderColor: "rgba(167,139,250,0.5)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarLargeText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  avatarEditBadge: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: "#a78bfa", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#000000" },
  avatarChangeText: { color: "#a78bfa", fontSize: 13, fontWeight: "600", marginTop: 10 },
  displayName: { color: "#fff", fontSize: 18, fontWeight: "700" },
  email: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  memberSince: { color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 },
  bio: { color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 12 },
  editProfileBtn: { borderWidth: 1, borderColor: "rgba(167,139,250,0.5)", borderRadius: 20, paddingVertical: 8, alignItems: "center" },
  editProfileText: { color: "#a78bfa", fontSize: 14, fontWeight: "600" },
  sectionLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 16, padding: 16, alignItems: "center" },
  statValue: { color: "#fff", fontSize: 24, fontWeight: "700" },
  statLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4, textAlign: "center" },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  navLabel: { color: "#fff", fontWeight: "500", fontSize: 15 },
  navChevron: { color: "rgba(255,255,255,0.4)", fontSize: 20 },
  disabled: { opacity: 0.4 },
  modal: { flex: 1, backgroundColor: "#000000" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  modalClose: { color: "rgba(255,255,255,0.5)", fontSize: 18 },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 15, marginBottom: 14 },
  saveBtn: { backgroundColor: "#a78bfa", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
