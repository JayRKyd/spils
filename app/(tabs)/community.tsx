import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, StyleSheet, Linking, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Chip({ label, active, color, onPress }: { label: string; active: boolean; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, active && (color ? { backgroundColor: color + "33", borderColor: color } : s.chipActive)]}
    >
      <Text style={[s.chipText, active && { color: color ?? "#fff", fontWeight: "600" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForumThread {
  id: string; name: string; description: string | null; category: string | null;
  is_pinned: boolean; view_count: number; created_at: string;
  profiles?: { username: string | null } | null;
}

interface ThreadComment {
  id: string; content: string; created_at: string;
  profiles?: { username: string | null } | null;
}

interface NewsItem {
  id: string; title: string; content: string | null; summary: string | null;
  date: string; category: string | null;
}

interface MarketplaceListing {
  id: number; user_id: string; type: string; title: string;
  description: string; price?: string | null; location?: string | null;
  image_urls: string[]; status: string; view_count: number; created_at: string;
  profiles?: { username?: string } | null;
}

interface MarketplaceComment {
  id: number; content: string; created_at: string;
  profiles?: { username?: string } | null;
}

interface DirectoryEntry {
  id: string; name: string; category: string | null;
  description: string | null; website: string | null; country: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FORUM_CATEGORIES = ["General", "Discussion", "Beginner Help", "Tips & Tricks", "Equipment", "Events", "Formula"];
const CATEGORY_COLORS: Record<string, string> = {
  Events: "#f87171", "Beginner Help": "#60a5fa", "Tips & Tricks": "#4ade80",
  Equipment: "#c084fc", Discussion: "#facc15", General: "rgba(255,255,255,0.6)", Formula: "#a78bfa",
};

const LISTING_TYPES = ["For Sale", "Trade", "Wanted", "Free"] as const;
const LISTING_TYPE_COLORS: Record<string, string> = {
  "For Sale": "#4ade80", Trade: "#60a5fa", Wanted: "#f87171", Free: "#c084fc",
};

const CONTACT_TOPICS = ["General Questions", "App Feedback", "Bug Report", "Account Help", "Feature Request", "Other"];

// ─── ① NEWS TAB ───────────────────────────────────────────────────────────────

function NewsTab() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("industry_news").select("*").order("date", { ascending: false });
      setNews(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <ActivityIndicator color="#a78bfa" style={{ marginTop: 48 }} />;

  return (
    <FlatList
      data={news}
      keyExtractor={(i) => i.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      ListEmptyComponent={<Text style={s.empty}>No news articles yet</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => setExpanded(expanded === item.id ? null : item.id)} activeOpacity={0.75}>
          <GlassRow style={s.card}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={[s.cardTitle, { flex: 1, marginRight: 8 }]} numberOfLines={expanded === item.id ? undefined : 2}>{item.title}</Text>
              <Text style={s.cardMeta}>{new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
            </View>
            {item.category ? <Text style={[s.accentText, { marginBottom: 6 }]}>{item.category}</Text> : null}
            {expanded === item.id && item.content
              ? <Text style={[s.cardDesc, { lineHeight: 20, marginTop: 4 }]}>{item.content}</Text>
              : item.summary
              ? <Text style={s.cardDesc} numberOfLines={2}>{item.summary}</Text>
              : null}
            <Text style={[s.cardMeta, { marginTop: 6 }]}>{expanded === item.id ? "Tap to collapse ▲" : "Tap to read more ▼"}</Text>
          </GlassRow>
        </TouchableOpacity>
      )}
    />
  );
}

// ─── ② FORUM TAB ─────────────────────────────────────────────────────────────

function ThreadDetailModal({ thread, visible, onClose }: { thread: ForumThread | null; visible: boolean; onClose: () => void }) {
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (visible && thread) {
      setLoading(true);
      (supabase as any).from("forum_comments").select("*, profiles(username)").eq("thread_id", thread.id).order("created_at", { ascending: true })
        .then(({ data }: any) => { setComments(data ?? []); setLoading(false); });
    }
  }, [visible, thread]);

  const postComment = async () => {
    if (!newComment.trim() || !thread) return;
    setPosting(true);
    await (supabase as any).from("forum_comments").insert([{ thread_id: thread.id, content: newComment.trim() }]);
    setNewComment("");
    const { data } = await (supabase as any).from("forum_comments").select("*, profiles(username)").eq("thread_id", thread.id).order("created_at", { ascending: true });
    setComments(data ?? []);
    setPosting(false);
  };

  if (!thread) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>← Back</Text></TouchableOpacity>
          <Text style={[s.modalTitle, { flex: 1, marginHorizontal: 12 }]} numberOfLines={1}>{thread.name}</Text>
          <View style={{ width: 48 }} />
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
          {thread.description ? <Text style={[s.cardDesc, { marginBottom: 12, lineHeight: 20 }]}>{thread.description}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {thread.category ? <Text style={{ fontSize: 12, color: CATEGORY_COLORS[thread.category] ?? "rgba(255,255,255,0.5)" }}>⬤ {thread.category}</Text> : null}
            <Text style={s.cardMeta}>{timeAgo(thread.created_at)}</Text>
            <Text style={s.cardMeta}>· {thread.view_count} views</Text>
            <Text style={s.cardMeta}>· {comments.length} {comments.length === 1 ? "reply" : "replies"}</Text>
          </View>
          {loading ? <ActivityIndicator color="#a78bfa" /> : null}
          {comments.map((c) => (
            <GlassRow key={c.id} style={s.commentCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={s.commentUser}>{c.profiles?.username ?? "Anonymous"}</Text>
                <Text style={s.cardMeta}>{timeAgo(c.created_at)}</Text>
              </View>
              <Text style={{ color: "#fff", fontSize: 14, lineHeight: 20 }}>{c.content}</Text>
            </GlassRow>
          ))}
          <View style={{ height: 16 }} />
        </ScrollView>
        <View style={s.replyBar}>
          <TextInput
            style={s.replyInput} placeholder="Write a reply..." placeholderTextColor="rgba(255,255,255,0.35)"
            value={newComment} onChangeText={setNewComment}
          />
          <TouchableOpacity style={[s.postBtn, (!newComment.trim() || posting) && { opacity: 0.5 }]} onPress={postComment} disabled={posting || !newComment.trim()}>
            {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.postBtnText}>Post</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function ForumTab({ categoryFilter }: { categoryFilter?: string }) {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>(categoryFilter ?? "All");
  const [loading, setLoading] = useState(true);
  const [newThreadVisible, setNewThreadVisible] = useState(false);
  const [selected, setSelected] = useState<ForumThread | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState(categoryFilter ?? "General");
  const [saving, setSaving] = useState(false);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("forum_threads").select("*, profiles(username)").order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
    setThreads(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await (supabase as any).from("forum_threads").insert([{ name: newName.trim(), description: newDesc.trim() || null, category: newCat }]);
    setSaving(false);
    setNewThreadVisible(false);
    setNewName(""); setNewDesc("");
    fetchThreads();
  };

  const allCats = ["All", ...FORUM_CATEGORIES];
  const filtered = threads.filter((t) => {
    if (catFilter !== "All" && t.category !== catFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <TextInput style={s.searchBar} placeholder="Search threads..." placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {allCats.map((cat) => (
            <Chip key={cat} label={cat} active={catFilter === cat}
              color={cat !== "All" ? CATEGORY_COLORS[cat] : undefined}
              onPress={() => setCatFilter(cat)} />
          ))}
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator color="#a78bfa" style={{ marginTop: 32 }} /> : (
        <FlatList
          data={filtered} keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={s.empty}>No threads yet</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.75}>
              <GlassRow style={s.card}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                    {item.is_pinned ? <Text style={{ fontSize: 12 }}>📌</Text> : null}
                    <Text style={[s.cardTitle, { flex: 1 }]} numberOfLines={1}>{item.name}</Text>
                  </View>
                  <Text style={s.cardMeta}>{timeAgo(item.created_at)}</Text>
                </View>
                {item.description ? <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                  {item.category ? <Text style={{ fontSize: 12, color: CATEGORY_COLORS[item.category] ?? "rgba(255,255,255,0.5)" }}>⬤ {item.category}</Text> : null}
                  <Text style={s.cardMeta}>{item.view_count} views</Text>
                  <Text style={s.cardMeta}>· {item.profiles?.username ?? "Anonymous"}</Text>
                </View>
              </GlassRow>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => setNewThreadVisible(true)}>
        <Text style={s.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* New Thread Modal */}
      <Modal visible={newThreadVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setNewThreadVisible(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setNewThreadVisible(false)}><Text style={s.modalClose}>Cancel</Text></TouchableOpacity>
            <Text style={s.modalTitle}>New Thread</Text>
            <TouchableOpacity onPress={handleCreate} disabled={!newName.trim() || saving}>
              <Text style={[s.accentText, { fontSize: 16 }, (!newName.trim() || saving) && { opacity: 0.4 }]}>Post</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>Title *</Text>
            <TextInput style={s.input} placeholder="Thread title" placeholderTextColor="rgba(255,255,255,0.35)" value={newName} onChangeText={setNewName} />
            <Text style={s.fieldLabel}>Description</Text>
            <TextInput style={[s.input, { height: 100, textAlignVertical: "top" }]} placeholder="What's this about?" placeholderTextColor="rgba(255,255,255,0.35)" value={newDesc} onChangeText={setNewDesc} multiline />
            <Text style={s.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              {FORUM_CATEGORIES.map((cat) => <Chip key={cat} label={cat} active={newCat === cat} color={CATEGORY_COLORS[cat]} onPress={() => setNewCat(cat)} />)}
            </ScrollView>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <ThreadDetailModal thread={selected} visible={!!selected} onClose={() => setSelected(null)} />
    </View>
  );
}

// ─── ③ MARKETPLACE TAB ───────────────────────────────────────────────────────

function MarketplaceDetailModal({ listing, visible, onClose }: { listing: MarketplaceListing | null; visible: boolean; onClose: () => void }) {
  const [comments, setComments] = useState<MarketplaceComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (visible && listing) {
      setLoading(true);
      (supabase as any).from("marketplace_comments").select("*, profiles(username)").eq("listing_id", listing.id).order("created_at", { ascending: true })
        .then(({ data }: any) => { setComments(data ?? []); setLoading(false); });
    }
  }, [visible, listing]);

  const postComment = async () => {
    if (!newComment.trim() || !listing) return;
    setPosting(true);
    await (supabase as any).from("marketplace_comments").insert([{ listing_id: listing.id, content: newComment.trim() }]);
    setNewComment("");
    const { data } = await (supabase as any).from("marketplace_comments").select("*, profiles(username)").eq("listing_id", listing.id).order("created_at", { ascending: true });
    setComments(data ?? []);
    setPosting(false);
  };

  if (!listing) return null;
  const typeColor = LISTING_TYPE_COLORS[listing.type] ?? "#a78bfa";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>← Back</Text></TouchableOpacity>
          <Text style={[s.modalTitle, { flex: 1, marginHorizontal: 12 }]} numberOfLines={1}>{listing.title}</Text>
          <View style={{ width: 48 }} />
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <View style={[s.typeBadge, { backgroundColor: typeColor + "22", borderColor: typeColor }]}>
              <Text style={[s.typeBadgeText, { color: typeColor }]}>{listing.type}</Text>
            </View>
            {listing.price ? <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{listing.price}</Text> : null}
          </View>
          <Text style={[s.cardDesc, { lineHeight: 20, marginBottom: 12 }]}>{listing.description}</Text>
          <View style={{ flexDirection: "row", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {listing.location ? <Text style={s.cardMeta}>📍 {listing.location}</Text> : null}
            <Text style={s.cardMeta}>👤 {listing.profiles?.username ?? "Anonymous"}</Text>
            <Text style={s.cardMeta}>🕐 {timeAgo(listing.created_at)}</Text>
          </View>

          <Text style={[s.sectionLabel, { marginBottom: 10 }]}>Comments ({comments.length})</Text>
          {loading ? <ActivityIndicator color="#a78bfa" /> : null}
          {comments.map((c) => (
            <GlassRow key={c.id} style={s.commentCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={s.commentUser}>{c.profiles?.username ?? "Anonymous"}</Text>
                <Text style={s.cardMeta}>{timeAgo(c.created_at)}</Text>
              </View>
              <Text style={{ color: "#fff", fontSize: 14 }}>{c.content}</Text>
            </GlassRow>
          ))}
          <View style={{ height: 16 }} />
        </ScrollView>
        <View style={s.replyBar}>
          <TextInput style={s.replyInput} placeholder="Ask about this listing..." placeholderTextColor="rgba(255,255,255,0.35)" value={newComment} onChangeText={setNewComment} />
          <TouchableOpacity style={[s.postBtn, (!newComment.trim() || posting) && { opacity: 0.5 }]} onPress={postComment} disabled={posting || !newComment.trim()}>
            {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.postBtnText}>Send</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function MarketplaceTab() {
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MarketplaceListing | null>(null);
  const [createVisible, setCreateVisible] = useState(false);

  // Create form state
  const [newType, setNewType] = useState<string>("For Sale");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("marketplace_listings").select("*, profiles:user_id(username)").eq("status", "active").order("created_at", { ascending: false });
    setListings(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from("marketplace_listings").insert([{
      user_id: user?.id, type: newType, title: newTitle.trim(),
      description: newDesc.trim(), price: newPrice.trim() || null,
      location: newLocation.trim() || null, image_urls: [], status: "active",
    }]);
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setCreateVisible(false);
    setNewTitle(""); setNewDesc(""); setNewPrice(""); setNewLocation("");
    fetchListings();
  };

  const filtered = listings.filter((l) => {
    if (typeFilter !== "All" && l.type !== typeFilter) return false;
    if (search && !l.title.toLowerCase().includes(search.toLowerCase()) && !l.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <TextInput style={s.searchBar} placeholder="Search listings..." placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {["All", ...LISTING_TYPES].map((t) => (
            <Chip key={t} label={t} active={typeFilter === t} color={t !== "All" ? LISTING_TYPE_COLORS[t] : undefined} onPress={() => setTypeFilter(t)} />
          ))}
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator color="#a78bfa" style={{ marginTop: 32 }} /> : (
        <FlatList
          data={filtered} keyExtractor={(i) => i.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={s.empty}>No listings yet. Be the first!</Text>}
          renderItem={({ item }) => {
            const typeColor = LISTING_TYPE_COLORS[item.type] ?? "#a78bfa";
            return (
              <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.75}>
                <GlassRow style={s.card}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={[s.cardTitle, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{item.title}</Text>
                    <View style={[s.typeBadge, { backgroundColor: typeColor + "22", borderColor: typeColor }]}>
                      <Text style={[s.typeBadgeText, { color: typeColor }]}>{item.type}</Text>
                    </View>
                  </View>
                  <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                    {item.price ? <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{item.price}</Text> : null}
                    {item.location ? <Text style={s.cardMeta}>📍 {item.location}</Text> : null}
                    <Text style={s.cardMeta}>👤 {item.profiles?.username ?? "Anonymous"}</Text>
                    <Text style={[s.cardMeta, { marginLeft: "auto" }]}>{timeAgo(item.created_at)}</Text>
                  </View>
                </GlassRow>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => setCreateVisible(true)}>
        <Text style={s.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Create Listing Modal */}
      <Modal visible={createVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateVisible(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setCreateVisible(false)}><Text style={s.modalClose}>Cancel</Text></TouchableOpacity>
            <Text style={s.modalTitle}>New Listing</Text>
            <TouchableOpacity onPress={handleCreate} disabled={!newTitle.trim() || saving}>
              <Text style={[s.accentText, { fontSize: 16 }, (!newTitle.trim() || saving) && { opacity: 0.4 }]}>Post</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>Listing Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {LISTING_TYPES.map((t) => <Chip key={t} label={t} active={newType === t} color={LISTING_TYPE_COLORS[t]} onPress={() => setNewType(t)} />)}
            </ScrollView>
            <Text style={s.fieldLabel}>Title *</Text>
            <TextInput style={s.input} placeholder="What are you listing?" placeholderTextColor="rgba(255,255,255,0.35)" value={newTitle} onChangeText={setNewTitle} />
            <Text style={s.fieldLabel}>Description</Text>
            <TextInput style={[s.input, { height: 100, textAlignVertical: "top" }]} placeholder="Condition, details, batch code, fill level..." placeholderTextColor="rgba(255,255,255,0.35)" value={newDesc} onChangeText={setNewDesc} multiline />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Price</Text>
                <TextInput style={s.input} placeholder="$0.00" placeholderTextColor="rgba(255,255,255,0.35)" value={newPrice} onChangeText={setNewPrice} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Location</Text>
                <TextInput style={s.input} placeholder="City, Country" placeholderTextColor="rgba(255,255,255,0.35)" value={newLocation} onChangeText={setNewLocation} />
              </View>
            </View>
            {saving && <ActivityIndicator color="#a78bfa" style={{ marginTop: 8 }} />}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <MarketplaceDetailModal listing={selected} visible={!!selected} onClose={() => setSelected(null)} />
    </View>
  );
}

// ─── ④ DIRECTORY TAB ─────────────────────────────────────────────────────────

function DirectoryTab() {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("directory_entries").select("*").order("name", { ascending: true });
      setEntries(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = entries.filter((e) =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const grouped: Record<string, DirectoryEntry[]> = {};
  filtered.forEach((e) => {
    const cat = e.category ?? "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(e);
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <TextInput style={s.searchBar} placeholder="Search directory..." placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} />
      </View>
      {loading ? <ActivityIndicator color="#a78bfa" style={{ marginTop: 32 }} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
          {filtered.length === 0 ? (
            <Text style={s.empty}>{search ? "No matches" : "No directory entries yet"}</Text>
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <View key={cat} style={{ marginBottom: 20 }}>
                <Text style={s.sectionLabel}>{cat}</Text>
                {items.map((item) => (
                  <TouchableOpacity key={item.id} onPress={() => setExpanded(expanded === item.id ? null : item.id)} activeOpacity={0.75}>
                    <GlassRow style={s.card}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Text style={[s.cardTitle, { flex: 1 }]}>{item.name}</Text>
                        {item.country ? <Text style={s.cardMeta}>{item.country}</Text> : null}
                      </View>
                      {expanded === item.id && item.description ? (
                        <Text style={[s.cardDesc, { marginTop: 6, lineHeight: 20 }]}>{item.description}</Text>
                      ) : item.description ? (
                        <Text style={s.cardDesc} numberOfLines={1}>{item.description}</Text>
                      ) : null}
                      {expanded === item.id && item.website ? (
                        <TouchableOpacity onPress={() => Linking.openURL(item.website!)} style={{ marginTop: 8 }}>
                          <Text style={[s.accentText, { fontSize: 13 }]}>🌐 Visit website</Text>
                        </TouchableOpacity>
                      ) : null}
                    </GlassRow>
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── ⑤ GLOSSARY TAB ──────────────────────────────────────────────────────────

function GlossaryTab() {
  const [terms, setTerms] = useState<{ id: string; term: string; definition: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("glossary_terms").select("id,term,definition").order("term", { ascending: true });
      setTerms(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = terms.filter((t) =>
    t.term.toLowerCase().includes(search.toLowerCase()) ||
    (t.definition ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <TextInput style={s.searchBar} placeholder="Search glossary..." placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} />
      </View>
      {loading ? <ActivityIndicator color="#a78bfa" style={{ marginTop: 32 }} /> : (
        <FlatList
          data={filtered} keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={s.empty}>{search ? "No matches" : "No glossary terms yet"}</Text>}
          renderItem={({ item }) => (
            <GlassRow style={s.card}>
              <Text style={[s.cardTitle, { marginBottom: 4 }]}>{item.term}</Text>
              <Text style={s.cardDesc}>{item.definition}</Text>
            </GlassRow>
          )}
        />
      )}
    </View>
  );
}

// ─── ⑥ SUPPORT TAB ───────────────────────────────────────────────────────────

function SupportTab() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [topicPickerVisible, setTopicPickerVisible] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      Alert.alert("Missing fields", "Please fill in name, email, and message.");
      return;
    }
    const subject = encodeURIComponent(`[Spils] ${topic || "Support Request"} - ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nTopic: ${topic || "General"}\n\n${message}`);
    Linking.openURL(`mailto:support@aethera.app?subject=${subject}&body=${body}`);
    setSent(true);
  };

  if (sent) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>✉️</Text>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 8 }}>Message Sent!</Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center", marginBottom: 24 }}>
          Your mail app should have opened. We'll get back to you shortly.
        </Text>
        <TouchableOpacity onPress={() => setSent(false)} style={[s.postBtn, { paddingHorizontal: 32 }]}>
          <Text style={s.postBtnText}>Send Another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
      {/* Intro */}
      <GlassRow style={{ padding: 16, marginBottom: 20 }}>
        <Text style={[s.cardTitle, { marginBottom: 6 }]}>Contact + Support</Text>
        <Text style={s.cardDesc}>Questions, feedback, account help, or just to say hi — we're here.</Text>
        <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
          <TouchableOpacity onPress={() => Linking.openURL("https://instagram.com/aethera.app")}>
            <Text style={s.accentText}>📸 Instagram</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL("https://twitter.com/aethera_app")}>
            <Text style={s.accentText}>🐦 Twitter / X</Text>
          </TouchableOpacity>
        </View>
      </GlassRow>

      {/* FAQ */}
      <Text style={s.sectionLabel}>Common Questions</Text>
      {[
        { q: "How do I add materials to my Organ?", a: "Go to the Organ tab and tap the + button. Fill in the material details and tap Save." },
        { q: "Can I import materials from a CSV?", a: "CSV import is available on the web app at aethera.app. Your data syncs automatically to mobile." },
        { q: "How does the AI label scanner work?", a: "In New Journal Entry, tap the bottle photo card. The AI reads the label and prefills your entry automatically." },
        { q: "Is my data private by default?", a: "Yes. Journal entries and formulas are private. You control visibility — toggle Public to share with the community." },
      ].map(({ q, a }, i) => (
        <GlassRow key={i} style={[s.card, { marginBottom: 10 }]}>
          <Text style={[s.cardTitle, { fontSize: 13, marginBottom: 4 }]}>{q}</Text>
          <Text style={[s.cardDesc, { lineHeight: 19 }]}>{a}</Text>
        </GlassRow>
      ))}

      {/* Contact Form */}
      <Text style={[s.sectionLabel, { marginTop: 8 }]}>Send a Message</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>Name</Text>
          <TextInput style={s.input} placeholder="Your name" placeholderTextColor="rgba(255,255,255,0.35)" value={name} onChangeText={setName} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>Email</Text>
          <TextInput style={s.input} placeholder="you@email.com" placeholderTextColor="rgba(255,255,255,0.35)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </View>
      </View>

      <Text style={s.fieldLabel}>Topic</Text>
      <TouchableOpacity style={[s.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]} onPress={() => setTopicPickerVisible(true)}>
        <Text style={{ color: topic ? "#fff" : "rgba(255,255,255,0.35)", fontSize: 15 }}>{topic || "Select a topic..."}</Text>
        <Text style={{ color: "rgba(255,255,255,0.4)" }}>▾</Text>
      </TouchableOpacity>

      <Text style={s.fieldLabel}>Message</Text>
      <TextInput style={[s.input, { height: 120, textAlignVertical: "top" }]} placeholder="How can we help you?" placeholderTextColor="rgba(255,255,255,0.35)" value={message} onChangeText={setMessage} multiline />

      <TouchableOpacity style={[s.postBtn, { borderRadius: 14, paddingVertical: 14, alignItems: "center" }]} onPress={handleSend}>
        <Text style={[s.postBtnText, { fontSize: 15 }]}>Send Message</Text>
      </TouchableOpacity>

      {/* Topic Picker Modal */}
      <Modal visible={topicPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTopicPickerVisible(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <View style={{ width: 60 }} />
            <Text style={s.modalTitle}>Select Topic</Text>
            <TouchableOpacity onPress={() => setTopicPickerVisible(false)}><Text style={s.accentText}>Done</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {CONTACT_TOPICS.map((t) => (
              <TouchableOpacity key={t} style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)", flexDirection: "row", justifyContent: "space-between" }}
                onPress={() => { setTopic(t); setTopicPickerVisible(false); }}>
                <Text style={{ color: "#fff", fontSize: 16 }}>{t}</Text>
                {topic === t ? <Text style={s.accentText}>✓</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

// ─── Main Community Screen ────────────────────────────────────────────────────

const TABS = [
  { key: "news",        label: "📰 News"        },
  { key: "forum",       label: "💬 Forum"       },
  { key: "formulas",    label: "⚗️ Formula Forum" },
  { key: "marketplace", label: "🛍 Market"       },
  { key: "directory",   label: "🏛 Directory"    },
  { key: "glossary",    label: "📖 Glossary"     },
  { key: "support",     label: "🛟 Support"      },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function Community() {
  const [activeTab, setActiveTab] = useState<TabKey>("news");

  return (
    <GradientScreen gradient="community">
      <View style={s.header}>
        <Text style={s.pageTitle}>Community</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TABS.map((tab) => (
            <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[s.tabChip, activeTab === tab.key && s.tabChipActive]}>
              <Text style={[s.tabChipText, activeTab === tab.key && { color: "#fff" }]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === "news"        && <NewsTab />}
        {activeTab === "forum"       && <ForumTab />}
        {activeTab === "formulas"    && <ForumTab categoryFilter="Formula" />}
        {activeTab === "marketplace" && <MarketplaceTab />}
        {activeTab === "directory"   && <DirectoryTab />}
        {activeTab === "glossary"    && <GlossaryTab />}
        {activeTab === "support"     && <SupportTab />}
      </View>
    </GradientScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 10 },
  pageTitle: { color: "#fff", fontSize: 24, fontWeight: "700" },
  tabChip: { marginRight: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", backgroundColor: "rgba(255,255,255,0.07)" },
  tabChipActive: { backgroundColor: "#a78bfa", borderColor: "#a78bfa" },
  tabChipText: { color: "rgba(255,255,255,0.65)", fontWeight: "500", fontSize: 13 },
  chip: { marginRight: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", backgroundColor: "rgba(255,255,255,0.07)" },
  chipActive: { backgroundColor: "#a78bfa", borderColor: "#a78bfa" },
  chipText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  searchBar: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: "#fff" },
  card: { paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  cardTitle: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cardDesc: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  cardMeta: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  accentText: { color: "#a78bfa", fontSize: 13, fontWeight: "600" },
  sectionLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  typeBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 11, fontWeight: "700" },
  commentCard: { paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  commentUser: { color: "#a78bfa", fontSize: 12, fontWeight: "600" },
  empty: { color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 48, fontSize: 14 },
  fab: { position: "absolute", bottom: 24, right: 24, backgroundColor: "#a78bfa", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32 },
  modal: { flex: 1, backgroundColor: "#081820" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  modalClose: { color: "#a78bfa", fontSize: 15 },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 6, marginTop: 2 },
  input: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 15, marginBottom: 14 },
  replyBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", gap: 10 },
  replyInput: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: "#fff", fontSize: 14 },
  postBtn: { backgroundColor: "#a78bfa", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  postBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
