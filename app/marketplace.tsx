import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";

type ListingType = "For Sale" | "Trade" | "Wanted" | "Free";

interface Listing {
  id: string;
  title: string;
  description: string | null;
  type: ListingType;
  price: number | null;
  condition: string | null;
  location: string | null;
  created_at: string;
  image_urls: string[] | null;
  user_id: string;
  profiles?: { username: string | null; avatar_url: string | null } | null;
}

interface ListingComment {
  id: string;
  content: string;
  created_at: string;
  profiles?: { username: string | null } | null;
}

const TYPE_OPTIONS: ListingType[] = ["For Sale", "Trade", "Wanted", "Free"];
const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Poor"];

const TYPE_STYLE: Record<ListingType, { bg: string; border: string; text: string }> = {
  "For Sale": { bg: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.3)",  text: "#4ade80" },
  Trade:      { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.3)", text: "#60a5fa" },
  Wanted:     { bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.3)",  text: "#f87171" },
  Free:       { bg: "rgba(168,85,247,0.15)", border: "rgba(168,85,247,0.3)", text: "#c084fc" },
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString("en-GB").replace(/\//g, ".");
}

function TypeBadge({ type }: { type: ListingType }) {
  const c = TYPE_STYLE[type];
  return (
    <View style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>{type}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={s.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

function CreateListingModal({ visible, userId, onClose, onCreated }: {
  visible: boolean; userId?: string; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ListingType>("For Sale");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setTitle(""); setDescription(""); setType("For Sale"); setPrice(""); setCondition(""); setLocation(""); }
  }, [visible]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await (supabase as any).from("marketplace_listings").insert([{
      title: title.trim(), description: description.trim() || null,
      type, price: price ? parseFloat(price) : null,
      condition: condition || null, location: location.trim() || null,
      user_id: userId,
    }]);
    setSaving(false);
    onCreated();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>New Listing</Text>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.fieldLabel}>Title *</Text>
          <TextInput style={s.input} placeholder="What are you listing?" placeholderTextColor="rgba(255,255,255,0.35)" value={title} onChangeText={setTitle} />

          <Text style={s.fieldLabel}>Description</Text>
          <TextInput style={[s.input, { height: 100, textAlignVertical: "top" }]} placeholder="Details about the item..." placeholderTextColor="rgba(255,255,255,0.35)" value={description} onChangeText={setDescription} multiline numberOfLines={4} />

          <Text style={s.fieldLabel}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {TYPE_OPTIONS.map((t) => <Chip key={t} label={t} active={type === t} onPress={() => setType(t)} />)}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Price ($)</Text>
              <TextInput style={s.input} placeholder="0.00" placeholderTextColor="rgba(255,255,255,0.35)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Location</Text>
              <TextInput style={s.input} placeholder="City, Country" placeholderTextColor="rgba(255,255,255,0.35)" value={location} onChangeText={setLocation} />
            </View>
          </View>

          <Text style={s.fieldLabel}>Condition</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
            {CONDITION_OPTIONS.map((c) => <Chip key={c} label={c} active={condition === c} onPress={() => setCondition(condition === c ? "" : c)} />)}
          </ScrollView>

          <TouchableOpacity style={[s.saveBtn, (!title.trim() || saving) && { opacity: 0.5 }]} onPress={handleCreate} disabled={saving || !title.trim()}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Post Listing</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ListingDetailModal({ listing, visible, onClose, currentUserId }: {
  listing: Listing | null; visible: boolean; onClose: () => void; currentUserId?: string;
}) {
  const [comments, setComments] = useState<ListingComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [watchlisted, setWatchlisted] = useState(false);

  useEffect(() => {
    if (visible && listing) {
      (supabase as any).from("marketplace_comments").select("*, profiles(username)").eq("listing_id", listing.id).order("created_at", { ascending: true })
        .then(({ data }: any) => setComments(data ?? []));
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

  const toggleWatchlist = async () => {
    if (!listing || !currentUserId) return;
    if (watchlisted) {
      await (supabase as any).from("marketplace_watchlist").delete().eq("listing_id", listing.id).eq("user_id", currentUserId);
    } else {
      await (supabase as any).from("marketplace_watchlist").insert([{ listing_id: listing.id, user_id: currentUserId }]);
    }
    setWatchlisted((v) => !v);
  };

  if (!listing) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHeader}>
          <Text style={[s.modalTitle, { flex: 1, marginRight: 16 }]} numberOfLines={2}>{listing.title}</Text>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <TypeBadge type={listing.type} />
            {listing.condition ? <View style={s.pill}><Text style={s.pillText}>{listing.condition}</Text></View> : null}
            {listing.price != null ? <View style={s.pill}><Text style={[s.pillText, { fontWeight: "700" }]}>${listing.price}</Text></View> : null}
          </View>

          {listing.location ? <Text style={[s.cardMeta, { marginBottom: 8 }]}>📍 {listing.location}</Text> : null}
          <Text style={[s.cardMeta, { marginBottom: 16 }]}>by {listing.profiles?.username ?? "Anonymous"} · {timeAgo(listing.created_at)}</Text>

          {listing.description ? (
            <GlassRow style={{ padding: 16, marginBottom: 12 }}>
              <Text style={{ color: "#fff", lineHeight: 20 }}>{listing.description}</Text>
            </GlassRow>
          ) : null}

          <TouchableOpacity
            style={[s.watchlistBtn, watchlisted && s.watchlistBtnActive]}
            onPress={toggleWatchlist}
          >
            <Text style={{ fontSize: 18 }}>{watchlisted ? "❤️" : "🤍"}</Text>
            <Text style={s.watchlistText}>{watchlisted ? "Saved to Watchlist" : "Save to Watchlist"}</Text>
          </TouchableOpacity>

          <Text style={[s.cardMeta, { marginBottom: 10 }]}>{comments.length} {comments.length === 1 ? "comment" : "comments"}</Text>

          {comments.map((c) => (
            <GlassRow key={c.id} style={s.commentCard}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={s.commentUser}>{c.profiles?.username ?? "Anonymous"}</Text>
                <Text style={s.cardMeta}>{timeAgo(c.created_at)}</Text>
              </View>
              <Text style={{ color: "#fff", fontSize: 14 }}>{c.content}</Text>
            </GlassRow>
          ))}
          <View style={{ height: 16 }} />
        </ScrollView>
        <View style={s.replyBar}>
          <TextInput
            style={s.replyInput}
            placeholder="Ask a question..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={newComment}
            onChangeText={setNewComment}
          />
          <TouchableOpacity style={[s.postBtn, (!newComment.trim() || posting) && { opacity: 0.5 }]} onPress={postComment} disabled={posting || !newComment.trim()}>
            {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.postBtnText}>Send</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function Marketplace() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [createVisible, setCreateVisible] = useState(false);
  const [selected, setSelected] = useState<Listing | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("marketplace_listings").select("*, profiles(username,avatar_url)").order("created_at", { ascending: false });
    if (typeFilter !== "all") q = q.eq("type", typeFilter);
    const { data } = await q;
    setListings(data ?? []);
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const filtered = listings.filter((l) =>
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    (l.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <GradientScreen gradient="marketplace">
      <View style={s.header}>
        <Text style={s.pageTitle}>Marketplace</Text>
        <TextInput style={s.searchBar} placeholder="Search listings..." placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <Chip label="All" active={typeFilter === "all"} onPress={() => setTypeFilter("all")} />
          {TYPE_OPTIONS.map((t) => <Chip key={t} label={t} active={typeFilter === t} onPress={() => setTypeFilter(t)} />)}
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator color="#a78bfa" style={{ marginTop: 48 }} /> : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={s.empty}>{search ? "No listings match your search" : "No listings yet"}</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.75}>
              <GlassRow style={s.card}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={[s.cardTitle, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{item.title}</Text>
                  {item.price != null ? <Text style={s.cardPrice}>${item.price}</Text> : null}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <TypeBadge type={item.type} />
                  {item.condition ? <Text style={s.cardMeta}>{item.condition}</Text> : null}
                </View>
                {item.description ? <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                  <Text style={s.cardMeta}>{item.profiles?.username ?? "Anonymous"}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {item.location ? <Text style={s.cardMeta}>📍 {item.location}</Text> : null}
                    <Text style={s.cardMeta}>{timeAgo(item.created_at)}</Text>
                  </View>
                </View>
              </GlassRow>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => setCreateVisible(true)}>
        <Text style={s.fabIcon}>+</Text>
      </TouchableOpacity>

      <CreateListingModal visible={createVisible} userId={user?.id} onClose={() => setCreateVisible(false)} onCreated={() => { setCreateVisible(false); fetchListings(); }} />
      <ListingDetailModal listing={selected} visible={!!selected} onClose={() => setSelected(null)} currentUserId={user?.id} />
    </GradientScreen>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 12 },
  searchBar: { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: "#fff", marginBottom: 10 },
  chip: { marginRight: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.08)" },
  chipActive: { backgroundColor: "#a78bfa", borderColor: "#a78bfa" },
  chipText: { color: "#fff", fontSize: 12 },
  card: { paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  cardTitle: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cardPrice: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cardDesc: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  cardMeta: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  pill: { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  watchlistBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 16 },
  watchlistBtnActive: { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.4)" },
  watchlistText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  commentCard: { paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  commentUser: { color: "#a78bfa", fontSize: 12, fontWeight: "600" },
  empty: { color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 48, fontSize: 14 },
  fab: { position: "absolute", bottom: 24, right: 24, backgroundColor: "#a78bfa", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32 },
  modal: { flex: 1, backgroundColor: "#1a140a" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  modalClose: { color: "rgba(255,255,255,0.5)", fontSize: 18 },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 15, marginBottom: 14 },
  saveBtn: { backgroundColor: "#a78bfa", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  replyBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", gap: 10 },
  replyInput: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: "#fff", fontSize: 14 },
  postBtn: { backgroundColor: "#a78bfa", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  postBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
