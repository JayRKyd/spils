import React, { useState, useEffect, useCallback, useRef } from "react";
import { SpilsLogo } from "../../components/SpilsLogo";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, StyleSheet, Linking, Alert, Share, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
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

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}.${String(dt.getFullYear()).slice(2)}`;
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
  is_pinned: boolean; view_count: number; created_at: string; user_id?: string;
  profiles?: { username: string | null } | null;
  forum_comments?: { count: number }[] | null;
}

interface ThreadComment {
  id: string; content: string; created_at: string;
  profiles?: { username: string | null } | null;
}

interface NewsItem {
  id: string; title: string; content: string | null; summary: string | null;
  date: string; category: string | null; source_url: string | null;
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

  const handleShare = async (item: NewsItem) => {
    try {
      await Share.share({ message: `${item.title}\n\n${item.summary ?? ""}${item.source_url ? `\n\nSource: ${item.source_url}` : ""}` });
    } catch {}
  };

  if (loading) return <ActivityIndicator color="#fff" style={{ marginTop: 48 }} />;

  return (
    <FlatList
      data={news}
      keyExtractor={(i) => i.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={<Text style={ns.heading}>Industry News</Text>}
      ListEmptyComponent={<Text style={ns.empty}>No news articles yet</Text>}
      renderItem={({ item }) => {
        const open = expanded === item.id;
        return (
          <View style={ns.card}>
            {/* Title + date */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={ns.cardTitle} numberOfLines={open ? undefined : 2}>{item.title}</Text>
              <Text style={ns.cardDate}>{fmtDate(item.date)}</Text>
            </View>

            {/* Topic chip */}
            {item.category ? (
              <View style={ns.chip}><Text style={ns.chipText}>{item.category}</Text></View>
            ) : null}

            {/* Description */}
            <Text style={ns.cardDesc} numberOfLines={open ? undefined : 2}>
              {open ? (item.content ?? item.summary ?? "") : (item.summary ?? "")}
            </Text>

            {open ? (
              <>
                {/* Source + Share pills */}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  {item.source_url ? (
                    <TouchableOpacity style={ns.actionBtn} onPress={() => Linking.openURL(item.source_url!)} activeOpacity={0.7}>
                      <Text style={ns.actionBtnText}>Source</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={ns.actionBtn} onPress={() => handleShare(item)} activeOpacity={0.7}>
                    <Text style={ns.actionBtnText}>Share</Text>
                  </TouchableOpacity>
                </View>
                {/* Close — plain text, no border */}
                <TouchableOpacity style={{ alignItems: "flex-end", marginTop: 10 }} onPress={() => setExpanded(null)} activeOpacity={0.7}>
                  <Text style={ns.closeTxt}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* More — plain text, no border */
              <TouchableOpacity style={{ alignItems: "flex-end", marginTop: 10 }} onPress={() => setExpanded(item.id)} activeOpacity={0.7}>
                <Text style={ns.closeTxt}>More</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }}
    />
  );
}

const ns = StyleSheet.create({
  heading: { color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: -0.5, marginTop: 8, marginBottom: 16 },
  empty: { color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 40, fontSize: 14 },
  card: { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", padding: 16, marginBottom: 12 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700", flex: 1, marginRight: 12, lineHeight: 20 },
  cardDate: { color: "rgba(255,255,255,0.6)", fontSize: 12, paddingTop: 2 },
  chip: { alignSelf: "flex-start", borderWidth: 1, borderColor: "rgba(255,255,255,0.55)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  chipText: { color: "rgba(255,255,255,0.9)", fontSize: 12 },
  cardDesc: { color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 19 },
  actionBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 7 },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  closeTxt: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
});

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

function ForumTab({ categoryFilter, title = "General Chat" }: { categoryFilter?: string; title?: string }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [myPostsOnly, setMyPostsOnly] = useState(false);
  const [newThreadVisible, setNewThreadVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline expand state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<ThreadComment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const commentInputRef = useRef<any>(null);
  const [commentFocused, setCommentFocused] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow photo library access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7 });
    if (!result.canceled && result.assets[0]) setNewPhoto(result.assets[0].uri);
  };

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("forum_threads")
      .select("*, profiles(username), forum_comments(count)")
      .order("created_at", { ascending: false });
    if (categoryFilter) q = q.eq("category", categoryFilter);
    const { data, error } = await q;
    if (error) console.error("fetchThreads error:", error.message);
    setThreads(data ?? []);
    setLoading(false);
  }, [categoryFilter]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  useEffect(() => {
    const channel = (supabase as any)
      .channel(`forum-threads-live-${categoryFilter ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_threads" }, () => {
        fetchThreads();
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [fetchThreads, categoryFilter]);

  const openThread = async (thread: ForumThread) => {
    if (expandedId === thread.id) {
      setExpandedId(null);
      setExpandedComments([]);
      setCommentText("");
      return;
    }
    setExpandedId(thread.id);
    setCommentText("");
    setCommentLoading(true);
    const { data } = await (supabase as any)
      .from("forum_comments")
      .select("*, profiles(username)")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });
    setExpandedComments(data ?? []);
    setCommentLoading(false);
  };

  const postComment = async (threadId: string) => {
    if (!commentText.trim()) return;
    setCommentPosting(true);
    const { error } = await (supabase as any).from("forum_comments").insert([{
      thread_id: threadId,
      content: commentText.trim(),
      user_id: user?.id,
    }]);
    if (error) { console.error("postComment error:", error.message); setCommentPosting(false); return; }
    setCommentText("");
    const { data } = await (supabase as any)
      .from("forum_comments")
      .select("*, profiles(username)")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    setExpandedComments(data ?? []);
    setCommentPosting(false);
  };

  const openEdit = (thread: ForumThread) => {
    setEditingId(thread.id);
    setNewName(thread.name);
    setNewTopic(thread.category ?? "");
    setNewDate("");
    setNewDesc(thread.description ?? "");
    setNewPhoto(null);
    setNewThreadVisible(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await (supabase as any).from("forum_threads").delete().eq("id", id);
        fetchThreads();
      }},
    ]);
  };

  const closeModal = () => {
    setNewThreadVisible(false);
    setEditingId(null);
    setNewName(""); setNewTopic(""); setNewDate(""); setNewDesc(""); setNewPhoto(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    if (editingId) {
      const { error } = await (supabase as any).from("forum_threads").update({
        name: newName.trim(),
        description: newDesc.trim() || "",
        category: newTopic.trim() || categoryFilter || "General",
      }).eq("id", editingId);
      if (error) console.error("handleCreate update error:", error.message);
    } else {
      const { error } = await (supabase as any).from("forum_threads").insert([{
        name: newName.trim(),
        description: newDesc.trim() || "",
        category: newTopic.trim() || categoryFilter || "General",
        user_id: user?.id,
      }]);
      if (error) console.error("handleCreate insert error:", error.message);
    }
    setSaving(false);
    closeModal();
    fetchThreads();
  };

  const closeExpanded = () => { setExpandedId(null); setExpandedComments([]); setCommentText(""); };

  const filtered = myPostsOnly ? threads.filter((t) => t.user_id === user?.id) : threads;

  return (
    <View style={{ flex: 1 }}>
      {loading ? <ActivityIndicator color="#fff" style={{ marginTop: 48 }} /> : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            myPostsOnly ? (
              <View style={{ marginTop: 8, marginBottom: 14 }}>
                <TouchableOpacity onPress={() => setMyPostsOnly(false)} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: 10 }}>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 16 }}>←</Text>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Back</Text>
                </TouchableOpacity>
                <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>My Posts</Text>
              </View>
            ) : (
              <>
                <Text style={ns.heading}>{title}</Text>
                <View style={ft.btnRow}>
                  <TouchableOpacity style={ft.actionBtn} onPress={() => setNewThreadVisible(true)} activeOpacity={0.75}>
                    <Text style={ft.actionBtnText}>+ New Post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={ft.actionBtn} onPress={() => setMyPostsOnly(true)} activeOpacity={0.75}>
                    <Text style={ft.actionBtnText}>My Posts</Text>
                  </TouchableOpacity>
                </View>
              </>
            )
          }
          ListEmptyComponent={<Text style={ns.empty}>{myPostsOnly ? "You haven't posted yet" : "No posts yet"}</Text>}
          renderItem={({ item }) => {
            if (myPostsOnly) {
              return (
                <View style={[ns.card, { marginBottom: 10 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={[ns.cardTitle, { flex: 1, marginRight: 12 }]} numberOfLines={1}>{item.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <TouchableOpacity onPress={() => openEdit(item)} activeOpacity={0.7}>
                        <Text style={ft.editLink}>Edit</Text>
                      </TouchableOpacity>
                      <Text style={ft.editSep}>{" | "}</Text>
                      <TouchableOpacity onPress={() => handleDelete(item.id)} activeOpacity={0.7}>
                        <Text style={ft.editLink}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }

            const commentCount = item.forum_comments?.[0]?.count ?? 0;
            const expanded = expandedId === item.id;
            return (
              <View style={ns.card}>
                {/* Title + date / comment count */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={[ns.cardTitle, { flex: 1, marginRight: 12 }]} numberOfLines={expanded ? undefined : 2}>{item.name}</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={ns.cardDate}>{fmtDate(item.created_at)}</Text>
                    <Text style={ns.cardDate}>{commentCount} Comment{commentCount !== 1 ? "s" : ""}</Text>
                  </View>
                </View>

                {/* Topic chip */}
                {item.category ? <View style={ns.chip}><Text style={ns.chipText}>{item.category}</Text></View> : null}

                {/* Description */}
                {item.description ? (
                  <Text style={ns.cardDesc} numberOfLines={expanded ? undefined : 2}>{item.description}</Text>
                ) : null}

                {/* Author + More/Close toggle */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <Text style={ft.byLine}>
                    by <Text style={ft.authorLink}>{item.profiles?.username ?? "Anonymous User"}</Text>
                  </Text>
                  {!expanded ? (
                    <TouchableOpacity onPress={() => openThread(item)} activeOpacity={0.7}>
                      <Text style={ns.closeTxt}>More</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Expanded: comment input + comments list */}
                {expanded ? (
                  <View style={{ marginTop: 14 }}>
                    {/* Comment CTA pill */}
                    <TouchableOpacity
                      style={[ft.commentBtn, commentFocused && ft.commentBtnActive]}
                      onPress={() => { setCommentFocused(true); commentInputRef.current?.focus(); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[ft.commentBtnText, commentFocused && ft.commentBtnTextActive]}>Comment</Text>
                    </TouchableOpacity>

                    {/* Comment input */}
                    <View style={{ marginTop: 12, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", padding: 12 }}>
                      <TextInput
                        ref={commentInputRef}
                        style={{ color: "#fff", fontSize: 14, minHeight: 60 }}
                        placeholder="Share your thoughts..."
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={commentText}
                        onChangeText={setCommentText}
                        multiline
                        onFocus={() => setCommentFocused(true)}
                        onBlur={() => setCommentFocused(false)}
                      />
                      <View style={{ alignItems: "flex-end", marginTop: 6 }}>
                        <TouchableOpacity
                          style={[ft.postPill, (!commentText.trim() || commentPosting) && { opacity: 0.4 }]}
                          onPress={() => postComment(item.id)}
                          disabled={!commentText.trim() || commentPosting}
                          activeOpacity={0.75}
                        >
                          {commentPosting
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={ft.postPillText}>Post</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Comments list */}
                    <Text style={ft.commentsLabel}>Comments ({expandedComments.length})</Text>
                    {commentLoading ? <ActivityIndicator color="#fff" size="small" style={{ marginTop: 8 }} /> : null}
                    {expandedComments.map((c, idx) => {
                      const isLast = idx === expandedComments.length - 1;
                      return (
                        <View key={c.id} style={{ marginBottom: 12 }}>
                          <Text style={[ns.cardDesc, { lineHeight: 19 }]}>{c.content}</Text>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                            <Text style={ft.byLine}>
                              by <Text style={ft.authorLink}>{c.profiles?.username ?? "Anonymous User"}</Text>
                            </Text>
                            {isLast ? (
                              <TouchableOpacity onPress={closeExpanded} activeOpacity={0.7}>
                                <Text style={ns.closeTxt}>Close</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}

                    {/* Close when no comments */}
                    {!commentLoading && expandedComments.length === 0 ? (
                      <TouchableOpacity style={{ alignItems: "flex-end", marginTop: 8 }} onPress={closeExpanded} activeOpacity={0.7}>
                        <Text style={ns.closeTxt}>Close</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {/* New Post / Edit Modal */}
      <Modal visible={newThreadVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <SafeAreaView style={np.sheet}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
            <TouchableOpacity onPress={closeModal} activeOpacity={0.7}>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 22, lineHeight: 24 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={np.noteTitle}>{editingId ? "EDIT POST" : "+ NEW POST"}</Text>

            <View style={{ marginTop: 24, gap: 12 }}>
              <TextInput style={np.field} placeholder="Title Entry" placeholderTextColor="rgba(255,255,255,0.35)" value={newName} onChangeText={setNewName} />
              <TextInput style={np.field} placeholder="Topic Entry" placeholderTextColor="rgba(255,255,255,0.35)" value={newTopic} onChangeText={setNewTopic} />
              <TextInput style={np.field} placeholder="Date Entry" placeholderTextColor="rgba(255,255,255,0.35)" value={newDate} onChangeText={setNewDate} />
              <TextInput style={np.field} placeholder="Copy Entry" placeholderTextColor="rgba(255,255,255,0.35)" value={newDesc} onChangeText={setNewDesc} multiline />

              <TouchableOpacity style={np.photoBox} onPress={pickPhoto} activeOpacity={0.8}>
                {newPhoto ? (
                  <Image source={{ uri: newPhoto }} style={{ width: "100%", height: "100%", borderRadius: 12 }} resizeMode="cover" />
                ) : (
                  <Text style={np.photoLabel}>Add Photo (Option)</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: "flex-end", marginTop: 20 }}>
              <TouchableOpacity
                style={[np.postBtn, (!newName.trim() || saving) && { opacity: 0.4 }]}
                onPress={handleCreate}
                disabled={!newName.trim() || saving}
                activeOpacity={0.75}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={np.postBtnText}>{editingId ? "Save" : "Post"}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const ft = StyleSheet.create({
  btnRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 50, paddingVertical: 11, alignItems: "center" },
  actionBtnActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  byLine: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  authorLink: { color: "rgba(255,255,255,0.9)", fontSize: 12, textDecorationLine: "underline" },
  editLink: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  editSep: { color: "rgba(255,255,255,0.35)", fontSize: 13 },
  commentBtn: { alignSelf: "flex-start", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.7)", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 7 },
  commentBtnActive: { backgroundColor: "#C6FF00", borderColor: "#C6FF00" },
  commentBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  commentBtnTextActive: { color: "#1a1a10" },
  postPill: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 7 },
  postPillText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  commentsLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginTop: 16, marginBottom: 10 },
});

const np = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: "#1a1a24" },
  noteTitle: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
  noteSub: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 },
  field: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: "#fff", fontSize: 14 },
  photoBox: { height: 200, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoLabel: { color: "rgba(255,255,255,0.35)", fontSize: 14 },
  postBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 20, paddingHorizontal: 28, paddingVertical: 9 },
  postBtnText: { color: "#fff", fontSize: 14, fontWeight: "500" },
});

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
  const [faqVisible, setFaqVisible] = useState(false);

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

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {/* Heading */}
      <Text style={ns.heading}>Contact + Support</Text>

      {/* Intro card */}
      <View style={ct.introCard}>
        <Text style={ct.introText}>
          Get in touch with questions, feedback,{"\n"}account and tech support,{"\n"}or just to say aloha!
        </Text>
      </View>

      {/* Form fields */}
      <View style={{ marginTop: 14 }}>
        {/* Topic — dropdown trigger */}
        <TouchableOpacity style={[ct.field, { justifyContent: "center", marginBottom: 10 }]} onPress={() => setTopicPickerVisible(true)} activeOpacity={0.8}>
          <Text style={topic ? { color: "#fff", fontSize: 15 } : ct.fieldPlaceholder}>{topic || "Topic"}</Text>
        </TouchableOpacity>

        <TextInput
          style={[ct.field, { marginBottom: 10 }]}
          placeholder="Name" placeholderTextColor="rgba(255,255,255,0.55)"
          value={name} onChangeText={setName}
        />
        <TextInput
          style={[ct.field, { marginBottom: 10 }]}
          placeholder="Email" placeholderTextColor="rgba(255,255,255,0.55)"
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
        />
        <TextInput
          style={[ct.field, { height: 160, textAlignVertical: "top" }]}
          placeholder="Message" placeholderTextColor="rgba(255,255,255,0.55)"
          value={message} onChangeText={setMessage} multiline
        />
      </View>

      {/* FAQs + Send row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 18 }}>
        <TouchableOpacity style={[ct.pill, { opacity: 0.45 }]} activeOpacity={1}>
          <Text style={ct.pillText}>FAQs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ct.pill} onPress={handleSend} activeOpacity={0.75}>
          <Text style={ct.pillText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Social links */}
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 28, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => Linking.openURL("https://instagram.com/aethera.app")}>
          <Text style={ct.socialLink}>INSTAGRAM</Text>
        </TouchableOpacity>
        <Text style={ct.socialSep}> — </Text>
        <TouchableOpacity onPress={() => Linking.openURL("https://discord.gg/aethera")}>
          <Text style={ct.socialLink}>DISCORD</Text>
        </TouchableOpacity>
        <Text style={ct.socialSep}> — </Text>
        <TouchableOpacity onPress={() => Linking.openURL("https://spils.app")}>
          <Text style={ct.socialLink}>SPILS.APP</Text>
        </TouchableOpacity>
      </View>

      {/* Topic picker */}
      <Modal visible={topicPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTopicPickerVisible(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <View style={{ width: 60 }} />
            <Text style={s.modalTitle}>Select Topic</Text>
            <TouchableOpacity onPress={() => setTopicPickerVisible(false)}><Text style={s.accentText}>Done</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {CONTACT_TOPICS.map((t) => (
              <TouchableOpacity key={t}
                style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)", flexDirection: "row", justifyContent: "space-between" }}
                onPress={() => { setTopic(t); setTopicPickerVisible(false); }}>
                <Text style={{ color: "#fff", fontSize: 16 }}>{t}</Text>
                {topic === t ? <Text style={s.accentText}>✓</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Sent confirmation — floating dark card */}
      <Modal visible={sent} transparent animationType="fade" onRequestClose={() => setSent(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 32 }}
          onPress={() => setSent(false)}
          activeOpacity={1}
        >
          <View style={ct.sentCard}>
            <Text style={ct.sentTitle}>Message Sent!</Text>
            <Text style={ct.sentSub}>We will get back to you as soon as possible!</Text>
            <Text style={ct.sentMeta}>
              Response time typically within 24hrs.{"\n"}
              Monday - Friday, 8am - 5pm/pst{"\n"}
              Mahalo for your patience.
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FAQ modal */}
      <Modal visible={faqVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFaqVisible(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <View style={{ width: 60 }} />
            <Text style={s.modalTitle}>FAQs</Text>
            <TouchableOpacity onPress={() => setFaqVisible(false)}><Text style={s.accentText}>Close</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
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
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

const ct = StyleSheet.create({
  introCard: { borderWidth: 1, borderColor: "rgba(255,255,255,0.55)", borderRadius: 14, paddingVertical: 22, paddingHorizontal: 20, alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  introText: { color: "#C6FF00", fontSize: 15, fontWeight: "700", textAlign: "center", lineHeight: 24 },
  field: { borderWidth: 1, borderColor: "rgba(255,255,255,0.55)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 15, backgroundColor: "transparent" },
  fieldPlaceholder: { color: "rgba(255,255,255,0.55)", fontSize: 15 },
  pill: { borderWidth: 1, borderColor: "rgba(255,255,255,0.75)", borderRadius: 20, paddingHorizontal: 26, paddingVertical: 8 },
  pillText: { color: "#fff", fontSize: 14 },
  socialLink: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  socialSep: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
  sentCard: { backgroundColor: "#3a3a42", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", padding: 28, alignItems: "center", width: "100%" },
  sentTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 6 },
  sentSub: { color: "#fff", fontSize: 15, fontWeight: "600", textAlign: "center", marginBottom: 16 },
  sentMeta: { color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center", lineHeight: 22 },
});

// ─── Main Community Screen ────────────────────────────────────────────────────

const CORAL_GRAD = ["#F2533A", "#F07D40", "#F5C840"] as const;

const MENU = [
  { key: "news",        label: "Industry News",    dim: false },
  { key: "chat",        label: "General Chat",     dim: false },
  { key: "support",     label: "Contact + Support",dim: false },
  { key: "interviews",  label: "Interviews",       dim: true  },
  { key: "marketplace", label: "Marketplace",      dim: true  },
  { key: "formulas",    label: "Formula Forum",    dim: true  },
  { key: "directory",   label: "Directory",        dim: true  },
  { key: "glossary",    label: "Glossary",         dim: true  },
] as const;

type SectionKey = typeof MENU[number]["key"];

const AVATARS = [
  { letter: "C", bg: "#4A9BE8" },
  { letter: "L", bg: "#4AE892" },
  { letter: "S", bg: "#E8C84A" },
  { letter: "C", bg: "#9B4AE8" },
];

function CommunityWrapper({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <LinearGradient colors={CORAL_GRAD} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top nav — always SP/LS. + profile */}
        <View style={ls.topNav}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={{ paddingRight: 8 }}>
              <Text style={ls.backBtn}>← Back</Text>
            </TouchableOpacity>
          ) : (
            <SpilsLogo height={22} color="#edff8d" />
          )}
          <TouchableOpacity style={ls.iconBtn} onPress={() => router.push("/(tabs)/profile" as any)}>
            <Text style={ls.iconBtnText}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* COMMUNITY BETA — always visible */}
        <View style={ls.titleRow}>
          <Text style={ls.pageTitle}>COMMUNITY</Text>
          <View style={ls.betaBadge}><Text style={ls.betaText}>BETA</Text></View>
        </View>

        {/* Page content */}
        <View style={{ flex: 1 }}>
          {children}
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

export default function Community() {
  const [section, setSection] = useState<SectionKey | null>(null);
  const [highlighted, setHighlighted] = useState<SectionKey>("news");
  const [comingSoonVisible, setComingSoonVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setSection(null);
      setComingSoonVisible(true);
    }, [])
  );

  const handleMenu = (key: SectionKey) => {
    const item = MENU.find((m) => m.key === key);
    if (item?.dim) {
      setComingSoonVisible(true);
      return;
    }
    setHighlighted(key);
    setTimeout(() => setSection(key), 150);
  };

  // ── Sub-section view ──────────────────────────────────────────────────────
  if (section !== null) {
    return (
      <CommunityWrapper onBack={() => setSection(null)}>
        <View style={{ flex: 1 }}>
          {section === "news"        && <NewsTab />}
          {section === "chat"        && <ForumTab title="General Chat" />}
          {section === "support"     && <SupportTab />}
          {section === "marketplace" && <MarketplaceTab />}
          {section === "formulas"    && <ForumTab categoryFilter="Formula" title="Formula Forum" />}
          {section === "directory"   && <DirectoryTab />}
          {section === "glossary"    && <GlossaryTab />}
        </View>
      </CommunityWrapper>
    );
  }

  // ── Landing page ──────────────────────────────────────────────────────────
  return (
    <CommunityWrapper>
      {/* Menu list — centered */}
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
        {MENU.map((item) => {
          const active = highlighted === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => handleMenu(item.key)}
              activeOpacity={0.7}
              style={[ls.menuItem, active && ls.menuItemActive]}
            >
              <Text style={[ls.menuText, item.dim && ls.menuTextDim]} numberOfLines={1} adjustsFontSizeToFit>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Coming Soon modal — transparent so coral gradient shows through */}
      <Modal visible={comingSoonVisible} transparent animationType="fade" onRequestClose={() => setComingSoonVisible(false)}>
        <TouchableOpacity
          style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}
          onPress={() => setComingSoonVisible(false)}
          activeOpacity={1}
        >
          <BlurView intensity={60} tint="light" style={ls.csCard}>
            <TouchableOpacity style={ls.csClose} onPress={() => setComingSoonVisible(false)}>
              <Text style={ls.csCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={ls.csTitle}>Welcome to the Spils Community</Text>
            <View style={ls.csBetaPill}><Text style={ls.csBetaText}>BETA</Text></View>
            <Text style={ls.csSub}>This is the Beta Version. Full version coming soon!</Text>
          </BlurView>
        </TouchableOpacity>
      </Modal>
    </CommunityWrapper>
  );
}

// ─── Landing page styles ──────────────────────────────────────────────────────

const ls = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  logo: { color: "#C6FF00", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  backBtn: { color: "#fff", fontSize: 15, fontWeight: "600" },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.55)", alignItems: "center", justifyContent: "center" },
  iconBtnText: { color: "#fff", fontSize: 20, fontWeight: "300", lineHeight: 24, marginTop: -1 },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 0 },
  pageTitle: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 2 },
  betaBadge: { borderWidth: 1, borderColor: "rgba(255,255,255,0.65)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  betaText: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  menuItem: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 50, borderWidth: 1.5, borderColor: "transparent", marginBottom: 0, alignSelf: "flex-start" },
  menuItemActive: { borderColor: "rgba(255,255,255,0.95)" },
  menuText: { color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  menuTextDim: { opacity: 0.38 },

  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  circleBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center" },
  circleBtnIcon: { color: "#fff", fontSize: 20, lineHeight: 24 },
  avatarRow: { flexDirection: "row", gap: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#fff", fontSize: 13, fontWeight: "700" },

  csCard: { width: "100%", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", borderRadius: 20, overflow: "hidden", paddingVertical: 36, paddingHorizontal: 24, alignItems: "center", gap: 16 },
  csClose: { position: "absolute" as const, top: 12, right: 12, width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  csCloseText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  csTitle: { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" },
  csBetaPill: { borderWidth: 1, borderColor: "rgba(255,255,255,0.7)", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 5 },
  csBetaText: { color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  csSub: { color: "#fff", fontSize: 15, fontWeight: "700", textAlign: "center" },
});

// ─── Sub-section shared styles ────────────────────────────────────────────────

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
