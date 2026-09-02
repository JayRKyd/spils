import React, { useState, useEffect, useCallback, useRef } from "react";
import { ProfileIcon } from "@/components/ProfileIcon";
import { SpilsLogo } from "../../components/SpilsLogo";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, StyleSheet, Linking, Alert, Share, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { consumeMyPostsIntent } from "@/lib/navIntents";
import { checkModeration } from "@/lib/moderation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { GlassRow } from "@/components/GlassCard";
import { ConfirmModal, ConfirmConfig } from "@/components/ConfirmModal";
import { uploadImageIfNeeded } from "@/lib/uploadImage";

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
  source_url?: string | null; image_url?: string | null; is_draft?: boolean | null;
  profiles?: { username: string | null } | null;
  forum_comments?: { count: number }[] | null;
}

interface ThreadComment {
  id: string; content: string; created_at: string; user_id?: string;
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

const CONTACT_TOPICS = ["General Questions", "App Feedback", "Bug Report", "Account Help", "Feature Request", "Brand Collaborations", "Business Partnerships", "Media", "Press Kit", "Other"];

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
      contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={<Text style={ns.heading}>Industry News</Text>}
      ListEmptyComponent={<Text style={ns.empty}>No news articles yet</Text>}
      renderItem={({ item }) => {
        const open = expanded === item.id;
        return (
          <View style={ns.card}>
            {/* 1. Headline + 2. Date */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={ns.cardTitle} numberOfLines={open ? undefined : 2}>{item.title}</Text>
              <Text style={ns.cardDate}>{fmtDate(item.date)}</Text>
            </View>

            {/* 3. Body (2 lines when collapsed) */}
            <Text style={ns.cardDesc} numberOfLines={open ? undefined : 2}>
              {open ? (item.content ?? item.summary ?? "") : (item.summary ?? "")}
            </Text>

            {/* Bottom row — expanded: SOURCE / SHARE + Close · collapsed: TAB + More */}
            {open ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {item.source_url ? (
                    <TouchableOpacity style={ns.actionBtn} onPress={() => Linking.openURL(item.source_url!)} activeOpacity={0.7}>
                      <Text style={ns.actionBtnText}>SOURCE</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={ns.actionBtn} onPress={() => handleShare(item)} activeOpacity={0.7}>
                    <Text style={ns.actionBtnText}>SHARE</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setExpanded(null)} activeOpacity={0.7}>
                  <Text style={ns.closeTxt}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                {item.category ? (
                  <View style={ns.chip}><Text style={ns.chipText}>{item.category.toUpperCase()}</Text></View>
                ) : <View />}
                <TouchableOpacity onPress={() => setExpanded(item.id)} activeOpacity={0.7}>
                  <Text style={ns.closeTxt}>More</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const ns = StyleSheet.create({
  heading: { color: "#fff", fontSize: 23, fontWeight: "800", letterSpacing: -0.5, marginTop: 8, marginBottom: 18 },
  empty: { color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 40, fontSize: 14 },
  card: { backgroundColor: "transparent", borderRadius: 14, borderWidth: 1, borderColor: "#fff", paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: "700", flex: 1, marginRight: 12, lineHeight: 19 },
  cardDate: { color: "rgba(255,255,255,0.85)", fontSize: 11, paddingTop: 2 },
  chip: { alignSelf: "flex-start", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  chipText: { color: "#fff", fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },
  cardDesc: { color: "rgba(255,255,255,0.8)", fontSize: 12.5, lineHeight: 18 },
  actionBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  actionBtnText: { color: "#fff", fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },
  closeTxt: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
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

function ForumTab({ categoryFilter, title = "General Chat", myPostsOnly, setMyPostsOnly }: {
  categoryFilter?: string; title?: string; myPostsOnly: boolean; setMyPostsOnly: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [newThreadVisible, setNewThreadVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  // Inline expand state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<ThreadComment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const commentInputRef = useRef<any>(null);
  const listRef = useRef<FlatList<any>>(null);
  const [commentFocused, setCommentFocused] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Community image uploads are disabled for V1 (moderation); existing post
  // images still display, and editing an old post keeps its image.

  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (supabase as any).from("user_blocks").select("blocked_id").eq("blocker_id", user.id)
      .then(({ data }: any) => setBlockedIds(new Set((data ?? []).map((b: any) => b.blocked_id))));
    (supabase as any).from("profiles").select("is_admin").eq("id", user.id).single()
      .then(({ data }: any) => setIsAdmin(!!data?.is_admin));
  }, [user?.id]);

  const adminRemovePost = (threadId: string) => {
    setConfirm({
      title: "Remove Post",
      message: "Remove this post and its comments for all users?",
      confirmLabel: "Remove",
      onConfirm: async () => {
        await (supabase as any).from("forum_comments").delete().eq("thread_id", threadId);
        await (supabase as any).from("forum_threads").delete().eq("id", threadId);
        closeExpanded();
        fetchThreads();
      },
    });
  };

  const adminRemoveComment = (threadId: string, commentId: string) => {
    setConfirm({
      title: "Remove Comment",
      message: "Remove this comment for all users?",
      confirmLabel: "Remove",
      onConfirm: async () => {
        await (supabase as any).from("forum_comments").delete().eq("id", commentId);
        const { data } = await (supabase as any)
          .from("forum_comments").select("*, profiles(username)")
          .eq("thread_id", threadId).order("created_at", { ascending: true });
        setExpandedComments(data ?? []);
      },
    });
  };

  const reportContent = (targetType: "post" | "comment", targetId: string) => {
    setConfirm({
      title: targetType === "post" ? "Report Post" : "Report Comment",
      message: "Report this to the SPILS team for review?",
      confirmLabel: "Report",
      onConfirm: async () => {
        const { error } = await (supabase as any).from("community_reports").insert([{
          reporter_id: user?.id, target_type: targetType, target_id: targetId,
        }]);
        if (!error) {
          setTimeout(() => setConfirm({
            title: "Report Received",
            message: "Thank you — our team will review it shortly.",
            infoOnly: true,
          }), 350);
        }
      },
    });
  };

  const blockUser = (targetId: string, username: string) => {
    setConfirm({
      title: "Block User",
      message: `Block ${username}? You won't see their posts or comments anymore.`,
      confirmLabel: "Block",
      onConfirm: async () => {
        const { error } = await (supabase as any).from("user_blocks").insert([{
          blocker_id: user?.id, blocked_id: targetId,
        }]);
        if (!error || error.code === "23505") {
          setBlockedIds((prev) => new Set(prev).add(targetId));
          closeExpanded();
        }
      },
    });
  };

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("forum_threads")
      // image_url intentionally excluded — fetched lazily on expand to keep the feed light
      .select("id,name,description,category,is_pinned,view_count,created_at,user_id,source_url,is_draft, profiles(username), forum_comments(count)")
      .order("created_at", { ascending: false });
    if (categoryFilter) q = q.eq("category", categoryFilter);
    // Hide drafts from the public feed (own drafts still appear under My Posts)
    if (!myPostsOnly) q = q.or("is_draft.is.null,is_draft.eq.false");
    const { data, error } = await q;
    if (error) console.error("fetchThreads error:", error.message);
    setThreads(data ?? []);
    setLoading(false);
  }, [categoryFilter, myPostsOnly]);

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
      setExpandedImage(null);
      setCommentText("");
      setCommentOpen(false);
      return;
    }
    setExpandedId(thread.id);
    setExpandedImage(null);
    setCommentText("");
    setCommentOpen(false);
    setCommentLoading(true);
    // Lazily fetch this thread's image (kept out of the feed query)
    (supabase as any).from("forum_threads").select("image_url").eq("id", thread.id).single()
      .then(({ data }: any) => setExpandedImage(data?.image_url ?? null));
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
    const mod = checkModeration(commentText);
    if (mod.verdict === "block") {
      Alert.alert("Can't post", "Your comment contains content that violates the SPILS community guidelines. Please edit it and try again.");
      return;
    }
    setCommentPosting(true);
    const { data: created, error } = await (supabase as any).from("forum_comments").insert([{
      thread_id: threadId,
      content: commentText.trim(),
      user_id: user?.id,
    }]).select("id").single();
    if (error) { console.error("postComment error:", error.message); setCommentPosting(false); return; }
    if (mod.verdict === "flag" && created?.id) {
      await (supabase as any).from("community_reports").insert([{
        reporter_id: user?.id, target_type: "comment", target_id: created.id, reason: `auto-flag: ${mod.term}`,
      }]);
    }
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
    setNewSource((thread as any).source_url ?? "");
    setNewDesc(thread.description ?? "");
    setNewPhoto((thread as any).image_url ?? null);
    setNewThreadVisible(true);
  };

  const handleDelete = (id: string) => {
    setConfirm({
      title: "Delete Post",
      message: "Are you sure you want to delete this post?",
      onConfirm: async () => {
        await (supabase as any).from("forum_threads").delete().eq("id", id);
        fetchThreads();
      },
    });
  };

  const closeModal = () => {
    setNewThreadVisible(false);
    setEditingId(null);
    setNewName(""); setNewTopic(""); setNewSource(""); setNewDesc(""); setNewPhoto(null);
  };

  const handleCreate = async (isDraft = false) => {
    if (!newName.trim()) return;
    if (!user?.id) {
      Alert.alert("Not signed in", "Your session expired. Please sign in again, then post.");
      return;
    }
    const mod = checkModeration(`${newName} ${newTopic} ${newDesc} ${newSource}`);
    if (mod.verdict === "block") {
      Alert.alert("Can't post", "Your post contains content that violates the SPILS community guidelines. Please edit it and try again.");
      return;
    }
    setSaving(true);
    let uploadedPhoto: string | null = null;
    try {
      uploadedPhoto = await uploadImageIfNeeded(newPhoto, "forum");
    } catch (e: any) {
      setSaving(false);
      Alert.alert("Image upload failed", e?.message ?? "Please try again.");
      return;
    }
    const payload = {
      name: newName.trim(),
      description: newDesc.trim() || "",
      category: newTopic.trim() || categoryFilter || "General",
      source_url: newSource.trim() || null,
      image_url: uploadedPhoto,
      is_draft: isDraft,
    };
    let error = null;
    let targetId: string | null = editingId;
    if (editingId) {
      ({ error } = await (supabase as any).from("forum_threads").update(payload).eq("id", editingId));
    } else {
      const { data: created, error: insErr } = await (supabase as any)
        .from("forum_threads").insert([{ ...payload, user_id: user.id }]).select("id").single();
      error = insErr;
      targetId = created?.id ?? null;
    }
    setSaving(false);
    if (error) {
      console.error("handleCreate error:", error.message);
      // Keep the modal open so the user's post isn't silently lost
      Alert.alert("Post failed", error.message ?? "Could not save your post. Please try again.");
      return;
    }
    if (mod.verdict === "flag" && targetId) {
      // Auto-file for admin review; the post stays up in the meantime
      await (supabase as any).from("community_reports").insert([{
        reporter_id: user.id, target_type: "post", target_id: targetId, reason: `auto-flag: ${mod.term}`,
      }]);
    }
    closeModal();
    fetchThreads();
  };

  const closeExpanded = () => { setExpandedId(null); setExpandedComments([]); setExpandedImage(null); setCommentText(""); setCommentOpen(false); };

  const visible = threads.filter((t) => !t.user_id || !blockedIds.has(t.user_id));
  const filtered = myPostsOnly ? visible.filter((t) => t.user_id === user?.id) : visible;

  // Scroll the expanded card above the keyboard when the comment box gains focus
  const scrollToExpanded = () => {
    const idx = filtered.findIndex((t) => t.id === expandedId);
    if (idx < 0) return;
    setTimeout(() => listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.05, animated: true }), 250);
  };

  return (
    <View style={{ flex: 1 }}>
      {loading ? <ActivityIndicator color="#fff" style={{ marginTop: 48 }} /> : (
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          onScrollToIndexFailed={() => {}}
          ListHeaderComponent={
            myPostsOnly ? (
              <View style={{ marginTop: 8, marginBottom: 14 }}>
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
                {/* 1. Headline + 2. Date / 4. Comments */}
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[ns.cardTitle, { flex: 1, marginRight: 12 }]} numberOfLines={expanded ? undefined : 2}>{item.name}</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={ns.cardDate}>{fmtDate(item.created_at)}</Text>
                    <Text style={ns.cardDate}>{commentCount} Comment{commentCount !== 1 ? "s" : ""}</Text>
                  </View>
                </View>

                {/* 3. Author */}
                <Text style={ft.byLine}>BY {(item.profiles?.username ?? "Anonymous User").toUpperCase()}</Text>

                {/* 5. Body — image on the left when expanded & present */}
                {expanded && expandedImage ? (
                  <View style={{ flexDirection: "row", marginTop: 12, gap: 14 }}>
                    <Image source={{ uri: expandedImage }} style={ft.postImage} resizeMode="cover" />
                    {item.description ? (
                      <Text style={[ns.cardDesc, { flex: 1, lineHeight: 20 }]}>{item.description}</Text>
                    ) : null}
                  </View>
                ) : (
                  item.description ? (
                    <Text style={[ns.cardDesc, { marginTop: 10 }]} numberOfLines={expanded ? undefined : 2}>{item.description}</Text>
                  ) : null
                )}

                {/* 6. Tab (ALL CAPS) + 7. More (collapsed) / Comment (expanded) */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                  {item.category ? (
                    <View style={ns.chip}><Text style={ns.chipText}>{item.category.toUpperCase()}</Text></View>
                  ) : <View />}
                  {expanded ? (
                    <TouchableOpacity
                      style={[ft.commentBtn, commentOpen && ft.commentBtnActive]}
                      onPress={() => { setCommentOpen((o) => !o); setTimeout(() => commentInputRef.current?.focus(), 60); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[ft.commentBtnText, commentOpen && ft.commentBtnTextActive]}>Comment</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => openThread(item)} activeOpacity={0.7}>
                      <Text style={ns.closeTxt}>More</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Expanded: comment input (toggle) + comments + Close */}
                {expanded ? (
                  <View style={{ marginTop: 16 }}>
                    {commentOpen ? (
                      <View style={{ marginBottom: 18, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", padding: 12 }}>
                        <TextInput
                          ref={commentInputRef}
                          style={{ color: "#fff", fontSize: 14, minHeight: 56 }}
                          placeholder="Share your thoughts..."
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          value={commentText}
                          onChangeText={setCommentText}
                          onFocus={scrollToExpanded}
                          multiline
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
                    ) : null}

                    <Text style={ft.commentsLabel}>Comments</Text>
                    {commentLoading ? <ActivityIndicator color="#fff" size="small" style={{ marginTop: 8 }} /> : null}
                    {!commentLoading && expandedComments.length === 0 ? (
                      <Text style={[ns.cardDesc, { marginBottom: 8 }]}>No comments yet.</Text>
                    ) : null}
                    {expandedComments.filter((c) => !c.user_id || !blockedIds.has(c.user_id)).map((c) => (
                      <View key={c.id} style={{ marginBottom: 16 }}>
                        <Text style={[ns.cardDesc, { lineHeight: 20 }]}>{c.content}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Text style={ft.byLineComment}>
                            by <Text style={ft.authorLink}>{c.profiles?.username ?? "Anonymous User"}</Text>
                          </Text>
                          {c.user_id && c.user_id !== user?.id ? (
                            <TouchableOpacity onPress={() => reportContent("comment", c.id)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                              <Text style={ft.modLink}>  ·  Report</Text>
                            </TouchableOpacity>
                          ) : null}
                          {isAdmin ? (
                            <TouchableOpacity onPress={() => adminRemoveComment(item.id, c.id)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                              <Text style={ft.modLink}>  ·  Remove</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    ))}

                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {item.user_id && item.user_id !== user?.id ? (
                          <>
                            <TouchableOpacity onPress={() => reportContent("post", item.id)} hitSlop={{ top: 8, bottom: 8 }}>
                              <Text style={ft.modLink}>Report</Text>
                            </TouchableOpacity>
                            <Text style={ft.modLink}>  |  </Text>
                            <TouchableOpacity onPress={() => blockUser(item.user_id!, item.profiles?.username ?? "this user")} hitSlop={{ top: 8, bottom: 8 }}>
                              <Text style={ft.modLink}>Block User</Text>
                            </TouchableOpacity>
                          </>
                        ) : null}
                        {isAdmin && item.user_id !== user?.id ? <Text style={ft.modLink}>  |  </Text> : null}
                        {isAdmin ? (
                          <TouchableOpacity onPress={() => adminRemovePost(item.id)} hitSlop={{ top: 8, bottom: 8 }}>
                            <Text style={ft.modLink}>Remove</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <TouchableOpacity onPress={closeExpanded} activeOpacity={0.7}>
                        <Text style={ns.closeTxt}>Close</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {/* New Post / Edit Modal */}
      <Modal visible={newThreadVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeModal}>
        <LinearGradient colors={["#000000", "#000000", "#B5501F"]} locations={[0, 0.78, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }}>
            {/* Top nav */}
            <View style={ls.topNav}>
              <SpilsLogo height={22} color="#edff8d" />
              <TouchableOpacity style={[ls.iconBtn, { backgroundColor: "transparent", borderWidth: 0 }]} onPress={() => router.push("/(tabs)/profile" as any)}>
                <ProfileIcon size={34} />
              </TouchableOpacity>
            </View>
            {/* Back carrot */}
            <View style={ls.backRow}>
              <TouchableOpacity onPress={closeModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={ls.backCarrot}>‹</Text>
              </TouchableOpacity>
              <Text style={ls.pageTitle}>Community</Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 30, paddingTop: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={np.title}>{editingId ? "Edit Post" : "New Post"}</Text>

              <TextInput style={np.field} placeholder="Title" placeholderTextColor="rgba(255,255,255,0.4)" value={newName} onChangeText={setNewName} />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TextInput style={[np.field, { flex: 1, marginTop: 0 }]} placeholder="Topic" placeholderTextColor="rgba(255,255,255,0.4)" value={newTopic} onChangeText={setNewTopic} />
                <TextInput style={[np.field, { flex: 1.4, marginTop: 0 }]} placeholder="Source Link (optional)" placeholderTextColor="rgba(255,255,255,0.4)" value={newSource} onChangeText={setNewSource} autoCapitalize="none" />
              </View>

              <TextInput style={[np.field, np.copyField]} placeholder="Copy" placeholderTextColor="rgba(255,255,255,0.4)" value={newDesc} onChangeText={setNewDesc} multiline textAlignVertical="top" />

              {/* Image uploads disabled for V1 (moderation) */}

              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                <TouchableOpacity
                  style={[np.postBtn, (!newName.trim() || saving) && { opacity: 0.4 }]}
                  onPress={() => handleCreate(true)}
                  disabled={!newName.trim() || saving}
                  activeOpacity={0.75}
                >
                  <Text style={np.postBtnText}>Save Draft</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[np.postBtn, (!newName.trim() || saving) && { opacity: 0.4 }]}
                  onPress={() => handleCreate(false)}
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
        </LinearGradient>
      </Modal>

      <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
    </View>
  );
}

const ft = StyleSheet.create({
  btnRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  actionBtn: { flex: 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 50, paddingVertical: 11, alignItems: "center" },
  actionBtnActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  byLine: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "600", letterSpacing: 0.5, marginTop: 4 },
  byLineComment: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 5 },
  authorLink: { color: "#fff", fontSize: 12, textDecorationLine: "underline" },
  editLink: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  editSep: { color: "rgba(255,255,255,0.35)", fontSize: 13 },
  modLink: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
  commentBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.7)", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 7 },
  commentBtnActive: { backgroundColor: "#D9F24E", borderColor: "#D9F24E" },
  commentBtnText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  commentBtnTextActive: { color: "#13131a", fontWeight: "700" },
  postPill: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 7 },
  postPillText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  commentsLabel: { color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: "700", marginBottom: 14 },
  postImage: { width: 130, aspectRatio: 3 / 4, borderRadius: 10, backgroundColor: "#fff" },
});

const np = StyleSheet.create({
  title: { color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: -0.5, marginTop: 6, marginBottom: 18 },
  field: { borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 14, marginTop: 12 },
  copyField: { minHeight: 150, paddingTop: 14 },
  photoBox: { width: "48%", aspectRatio: 3 / 4, backgroundColor: "#ffffff", borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: 16 },
  photoLabel: { color: "rgba(19,19,26,0.4)", fontSize: 11 },
  postBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 22, paddingHorizontal: 22, paddingVertical: 10 },
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
    Linking.openURL(`mailto:info@spils.app?subject=${subject}&body=${body}`);
    setSent(true);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {/* Heading */}
      <Text style={ns.heading}>SPILS Support</Text>

      {/* Intro */}
      <Text style={ct.introText}>
        For questions, feedback, account and{"\n"}tech support, or just to say Aloha...
      </Text>

      {/* Form fields */}
      <View style={{ marginTop: 14 }}>
        {/* Topic — dropdown trigger */}
        <TouchableOpacity style={[ct.field, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }]} onPress={() => setTopicPickerVisible(true)} activeOpacity={0.8}>
          <Text style={topic ? { color: "#fff", fontSize: 15 } : ct.fieldPlaceholder}>{topic || "Topic"}</Text>
          <Text style={ct.fieldChevron}>⌄</Text>
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
        <TouchableOpacity style={ct.pill} onPress={() => setFaqVisible(true)} activeOpacity={0.75}>
          <Text style={ct.pillText}>FAQs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ct.pill, ct.sendPill]} onPress={handleSend} activeOpacity={0.75}>
          <Text style={[ct.pillText, ct.sendPillText]}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Social links */}
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 28, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => Linking.openURL("https://instagram.com/spils.app")}>
          <Text style={ct.socialLink}>INSTAGRAM</Text>
        </TouchableOpacity>
        <Text style={ct.socialSep}> — </Text>
        <Text style={ct.socialLink}>DISCORD</Text>
        <Text style={ct.socialSep}> — </Text>
        <Text style={ct.socialLink}>SPILS.APP</Text>
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
              { q: "What is SPILS?", a: "SPILS is A Digital Playground for Fragrance Lovers, bringing Journal, Collection, Lab, Organ and Community together in one place." },
              { q: "Who is SPILS for?", a: "Fragrance enthusiasts, collectors, aspiring perfumers and creators." },
              { q: "What is Journal?", a: "Capture SOTD, fragrance experiences, notes, impressions, performance, memories and inspiration." },
              { q: "What is Collection?", a: "Your personal space to organize and explore your fragrance collection." },
              { q: "What is Lab?", a: "A workspace for creating, saving and evolving fragrance formulas and experiments." },
              { q: "Are my Lab formulas private?", a: "Your formulas are private to your account and are not publicly shared unless you choose to share them through a supported SPILS feature." },
              { q: "What is Organ?", a: "Your perfumery reference library for organizing and exploring fragrance materials and ingredients." },
              { q: "Can I upload my own materials to Organ?", a: "Yes. You can add materials individually or import multiple materials at once using a .CSV file. Your CSV should include the following column headers: Symbols, Name, Notes, CAS, IFRA, and Stock (g/ml). You can also download the SPILS CSV template directly from the Organ Import window to make setup easy." },
              { q: "Does SPILS include IFRA information?", a: "Not yet. IFRA-related tools are planned for a future update. Always consult current official IFRA standards and applicable safety guidance." },
              { q: "What is Community?", a: "A space to explore, discover and connect around fragrance." },
              { q: "Can I report inappropriate content or block someone?", a: "Yes. Use Report for inappropriate content and Block if you no longer want to interact with another account." },
              { q: "How do I contact SPILS?", a: "info@spils.app" },
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
  introText: { color: "#edff8d", fontSize: 15, fontWeight: "600", lineHeight: 23, marginBottom: 6 },
  field: { borderWidth: 1, borderColor: "rgba(255,255,255,0.55)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 15, backgroundColor: "transparent" },
  fieldPlaceholder: { color: "rgba(255,255,255,0.55)", fontSize: 15 },
  fieldChevron: { color: "rgba(255,255,255,0.75)", fontSize: 15, marginTop: -6 },
  pill: { borderWidth: 1, borderColor: "rgba(255,255,255,0.75)", borderRadius: 20, paddingHorizontal: 26, paddingVertical: 8 },
  pillText: { color: "#fff", fontSize: 14 },
  sendPill: { backgroundColor: "#edff8d", borderColor: "#edff8d" },
  sendPillText: { color: "#13131a", fontWeight: "700" },
  socialLink: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  socialSep: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
  sentCard: { backgroundColor: "#ED3B35", borderRadius: 20, borderWidth: 1.5, borderColor: "#ffffff", padding: 28, alignItems: "center", width: "100%" },
  sentTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 6 },
  sentSub: { color: "#fff", fontSize: 15, fontWeight: "600", textAlign: "center", marginBottom: 16 },
  sentMeta: { color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center", lineHeight: 22 },
});

// ─── Main Community Screen ────────────────────────────────────────────────────

const CORAL_GRAD = ["#F2533A", "#F07D40", "#F5C840"] as const;

const AVAILABLE = [
  { key: "news",    label: "Industry News" },
  { key: "chat",    label: "Fragrance Chat" },
  { key: "support", label: "SPILS Support" },
] as const;

const COMING = [
  { key: "interviews",  label: "Interviews" },
  { key: "events",      label: "Events" },
  { key: "marketplace", label: "Marketplace" },
  { key: "formulas",    label: "Formula Forum" },
  { key: "directory",   label: "Directory" },
] as const;

type SectionKey = typeof AVAILABLE[number]["key"] | typeof COMING[number]["key"];
const AVAILABLE_KEYS = AVAILABLE.map((m) => m.key) as string[];

const AVATARS = [
  { letter: "C", bg: "#4A9BE8" },
  { letter: "L", bg: "#4AE892" },
  { letter: "S", bg: "#E8C84A" },
  { letter: "C", bg: "#9B4AE8" },
];

function CommunityWrapper({ children, onBack, showSub }: { children: React.ReactNode; onBack?: () => void; showSub?: boolean }) {
  return (
    <LinearGradient colors={CORAL_GRAD} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top nav — SP/LS. + profile */}
        <View style={ls.topNav}>
          <SpilsLogo height={22} color="#edff8d" />
          <TouchableOpacity style={[ls.iconBtn, { backgroundColor: "transparent", borderWidth: 0 }]} onPress={() => router.push("/(tabs)/profile" as any)}>
            <ProfileIcon size={34} />
          </TouchableOpacity>
        </View>

        {/* Back carrot (sub-sections) */}
        {onBack ? (
          <View style={ls.backRow}>
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={ls.backCarrot}>‹</Text>
            </TouchableOpacity>
            <Text style={ls.pageTitle}>Community</Text>
          </View>
        ) : (
          <View style={ls.titleRow}>
            <Text style={ls.pageTitle}>Community</Text>
            <View style={ls.betaBadge}><Text style={ls.betaText}>Beta</Text></View>
          </View>
        )}

        {/* Subheadline (landing only) */}
        {showSub ? (
          <Text style={ls.subheadline}>
            EXPLORE, DISCOVER, & CONNECT{"\n"}WITH FRAGRANCE ENTHUSIASTS{"\n"}AROUND THE WORLD
          </Text>
        ) : null}

        {/* Page content */}
        <View style={{ flex: 1 }}>
          {children}
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── My Posts / My Comments (dark) ────────────────────────────────────────────

interface MyComment {
  id: string; content: string; created_at: string; thread_id: string;
  forum_threads?: { name: string | null } | null;
}

function MyPostsScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ForumThread[]>([]);
  const [comments, setComments] = useState<MyComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewThread, setViewThread] = useState<ForumThread | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  // Post edit
  const [editPost, setEditPost] = useState<ForumThread | null>(null);
  const [eName, setEName] = useState("");
  const [eTopic, setETopic] = useState("");
  const [eSource, setESource] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Comment edit
  const [editComment, setEditComment] = useState<MyComment | null>(null);
  const [ecText, setEcText] = useState("");

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      (supabase as any).from("forum_threads")
        .select("id,name,description,category,is_pinned,view_count,created_at,user_id,source_url,is_draft")
        .eq("user_id", user?.id).order("created_at", { ascending: false }),
      (supabase as any).from("forum_comments")
        .select("id,content,created_at,thread_id, forum_threads(name)")
        .eq("user_id", user?.id).order("created_at", { ascending: false }),
    ]);
    setPosts(p ?? []); setComments(c ?? []); setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openView = async (threadId: string) => {
    const { data } = await (supabase as any).from("forum_threads").select("*, profiles(username)").eq("id", threadId).single();
    if (data) setViewThread(data);
  };

  const openEditPost = (t: ForumThread) => {
    setEditPost(t); setEName(t.name); setETopic(t.category ?? ""); setESource((t as any).source_url ?? ""); setEDesc(t.description ?? "");
  };
  const saveEditPost = async (publish = false) => {
    if (!editPost) return;
    const mod = checkModeration(`${eName} ${eTopic} ${eDesc} ${eSource}`);
    if (mod.verdict === "block") {
      Alert.alert("Can't save", "Your post contains content that violates the SPILS community guidelines. Please edit it and try again.");
      return;
    }
    if (mod.verdict === "flag") {
      await (supabase as any).from("community_reports").insert([{
        reporter_id: user?.id, target_type: "post", target_id: editPost.id, reason: `auto-flag: ${mod.term}`,
      }]);
    }
    setSaving(true);
    await (supabase as any).from("forum_threads").update({
      name: eName.trim(), category: eTopic.trim() || "General", source_url: eSource.trim() || null, description: eDesc.trim() || "",
      ...(publish ? { is_draft: false } : {}),
    }).eq("id", editPost.id);
    setSaving(false); setEditPost(null); fetchAll();
  };
  const deletePost = (t: ForumThread) => setConfirm({
    title: "Delete Post",
    message: "Delete this post permanently?",
    onConfirm: async () => { await (supabase as any).from("forum_threads").delete().eq("id", t.id); fetchAll(); },
  });

  const saveEditComment = async () => {
    if (!editComment) return;
    const mod = checkModeration(ecText);
    if (mod.verdict === "block") {
      Alert.alert("Can't save", "Your comment contains content that violates the SPILS community guidelines. Please edit it and try again.");
      return;
    }
    if (mod.verdict === "flag") {
      await (supabase as any).from("community_reports").insert([{
        reporter_id: user?.id, target_type: "comment", target_id: editComment.id, reason: `auto-flag: ${mod.term}`,
      }]);
    }
    await (supabase as any).from("forum_comments").update({ content: ecText.trim() }).eq("id", editComment.id);
    setEditComment(null); fetchAll();
  };
  const deleteComment = (c: MyComment) => setConfirm({
    title: "Delete Comment",
    message: "Delete this comment?",
    onConfirm: async () => { await (supabase as any).from("forum_comments").delete().eq("id", c.id); fetchAll(); },
  });

  const Row = ({ title, draft, onOpen, onEdit, onDelete }: { title: string; draft?: boolean; onOpen: () => void; onEdit: () => void; onDelete: () => void }) => (
    <TouchableOpacity style={mp.row} activeOpacity={0.8} onPress={onOpen}>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", marginRight: 12 }}>
        <Text style={[mp.rowTitle, { flex: 0, marginRight: 8 }]} numberOfLines={1}>{title}</Text>
        {draft ? <View style={mp.draftTag}><Text style={mp.draftTagText}>DRAFT</Text></View> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onEdit(); }} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}><Text style={mp.rowAction}>Edit</Text></TouchableOpacity>
        <Text style={mp.rowSep}> | </Text>
        <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onDelete(); }} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}><Text style={mp.rowAction}>Delete</Text></TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={["#000000", "#000000", "#B5501F"]} locations={[0, 0.78, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={ls.topNav}>
          <SpilsLogo height={22} color="#edff8d" />
          <TouchableOpacity style={[ls.iconBtn, { backgroundColor: "transparent", borderWidth: 0 }]} onPress={() => router.push("/(tabs)/profile" as any)}>
            <ProfileIcon size={34} />
          </TouchableOpacity>
        </View>
        <View style={ls.backRow}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={ls.backCarrot}>‹</Text>
          </TouchableOpacity>
          <Text style={ls.pageTitle}>Community</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 30, paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={mp.heading}>My Posts</Text>
          {loading ? <ActivityIndicator color="#fff" style={{ marginTop: 12 }} /> : (
            posts.length === 0 ? <Text style={mp.empty}>You haven't posted yet.</Text> :
            posts.map((p) => (
              <Row key={p.id} title={p.name} draft={!!p.is_draft} onOpen={() => openView(p.id)} onEdit={() => openEditPost(p)} onDelete={() => deletePost(p)} />
            ))
          )}

          <Text style={[mp.heading, { marginTop: 28 }]}>My Comments</Text>
          {loading ? null : (
            comments.length === 0 ? <Text style={mp.empty}>No comments yet.</Text> :
            comments.map((c) => (
              <Row
                key={c.id}
                title={c.forum_threads?.name || c.content}
                onOpen={() => openView(c.thread_id)}
                onEdit={() => { setEditComment(c); setEcText(c.content); }}
                onDelete={() => deleteComment(c)}
              />
            ))
          )}
        </ScrollView>

        {/* View post/comment */}
        <ThreadDetailModal thread={viewThread} visible={!!viewThread} onClose={() => setViewThread(null)} />

        {/* Edit post */}
        <Modal visible={!!editPost} transparent animationType="fade" onRequestClose={() => setEditPost(null)}>
          <View style={mp.editBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill as any} activeOpacity={1} onPress={() => setEditPost(null)} />
            <View style={mp.editCard}>
              <Text style={mp.editTitle}>Edit Post</Text>
              <TextInput style={np.field} placeholder="Title" placeholderTextColor="rgba(255,255,255,0.4)" value={eName} onChangeText={setEName} />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TextInput style={[np.field, { flex: 1, marginTop: 0 }]} placeholder="Topic" placeholderTextColor="rgba(255,255,255,0.4)" value={eTopic} onChangeText={setETopic} />
                <TextInput style={[np.field, { flex: 1.4, marginTop: 0 }]} placeholder="Source Link (optional)" placeholderTextColor="rgba(255,255,255,0.4)" value={eSource} onChangeText={setESource} autoCapitalize="none" />
              </View>
              <TextInput style={[np.field, np.copyField]} placeholder="Copy" placeholderTextColor="rgba(255,255,255,0.4)" value={eDesc} onChangeText={setEDesc} multiline textAlignVertical="top" />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={np.postBtn} onPress={() => setEditPost(null)}><Text style={np.postBtnText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[np.postBtn, (!eName.trim() || saving) && { opacity: 0.4 }]} onPress={() => saveEditPost()} disabled={!eName.trim() || saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={np.postBtnText}>Save</Text>}
                </TouchableOpacity>
                {editPost?.is_draft ? (
                  <TouchableOpacity style={[np.postBtn, { backgroundColor: "#edff8d", borderColor: "#edff8d" }, (!eName.trim() || saving) && { opacity: 0.4 }]} onPress={() => saveEditPost(true)} disabled={!eName.trim() || saving}>
                    <Text style={[np.postBtnText, { color: "#13131a" }]}>Post</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit comment */}
        <Modal visible={!!editComment} transparent animationType="fade" onRequestClose={() => setEditComment(null)}>
          <View style={mp.editBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill as any} activeOpacity={1} onPress={() => setEditComment(null)} />
            <View style={mp.editCard}>
              <Text style={mp.editTitle}>Edit Comment</Text>
              <TextInput style={[np.field, { minHeight: 100, marginTop: 4 }]} placeholder="Comment" placeholderTextColor="rgba(255,255,255,0.4)" value={ecText} onChangeText={setEcText} multiline textAlignVertical="top" />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={np.postBtn} onPress={() => setEditComment(null)}><Text style={np.postBtnText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[np.postBtn, !ecText.trim() && { opacity: 0.4 }]} onPress={saveEditComment} disabled={!ecText.trim()}><Text style={np.postBtnText}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const mp = StyleSheet.create({
  heading: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: -0.5, marginBottom: 14 },
  empty: { color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  rowTitle: { color: "#fff", fontSize: 14, fontWeight: "600", flex: 1, marginRight: 12 },
  rowAction: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  rowSep: { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  draftTag: { borderWidth: 1, borderColor: "#edff8d", borderRadius: 100, paddingHorizontal: 7, paddingVertical: 1 },
  draftTagText: { color: "#edff8d", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  editBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: 24 },
  editCard: { backgroundColor: "#141414", borderRadius: 16, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.4)", padding: 20 },
  editTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 },
});

// Welcome popup shows once per app session — resets when the app is relaunched
let welcomeShownThisSession = false;

export default function Community() {
  const [section, setSection] = useState<SectionKey | null>(null);
  const [comingSoonVisible, setComingSoonVisible] = useState(false);
  const [myPostsOnly, setMyPostsOnly] = useState(false);

  const dismissWelcome = () => setComingSoonVisible(false);

  useFocusEffect(
    useCallback(() => {
      // One-shot intent from Profile ("Posts"/"Comments") straight into My Posts
      if (consumeMyPostsIntent()) {
        setSection("chat");
        setMyPostsOnly(true);
        setComingSoonVisible(false);
        return;
      }
      setSection(null);
      if (!welcomeShownThisSession) {
        welcomeShownThisSession = true;
        setComingSoonVisible(true);
      }
    }, [])
  );

  const handleMenu = (key: SectionKey) => {
    if (!AVAILABLE_KEYS.includes(key)) {
      setComingSoonVisible(true);
      return;
    }
    setMyPostsOnly(false);
    setSection(key);
  };

  // ── My Posts / My Comments (dark, standalone) ─────────────────────────────
  if (section !== null && myPostsOnly) {
    return <MyPostsScreen onBack={() => setMyPostsOnly(false)} />;
  }

  // ── Sub-section view ──────────────────────────────────────────────────────
  if (section !== null) {
    return (
      <CommunityWrapper onBack={() => setSection(null)}>
        <View style={{ flex: 1 }}>
          {section === "news"        && <NewsTab />}
          {section === "chat"        && <ForumTab title="Fragrance Chat" myPostsOnly={myPostsOnly} setMyPostsOnly={setMyPostsOnly} />}
          {section === "support"     && <SupportTab />}
          {section === "marketplace" && <MarketplaceTab />}
          {section === "formulas"    && <ForumTab categoryFilter="Formula" title="Formula Forum" myPostsOnly={myPostsOnly} setMyPostsOnly={setMyPostsOnly} />}
          {section === "directory"   && <DirectoryTab />}
        </View>
      </CommunityWrapper>
    );
  }

  // ── Landing page ──────────────────────────────────────────────────────────
  return (
    <CommunityWrapper showSub>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 30, paddingTop: 42, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Available Now */}
        <Text style={ls.groupLabel}>AVAILABLE NOW</Text>
        {AVAILABLE.map((item) => (
          <TouchableOpacity key={item.key} onPress={() => handleMenu(item.key)} activeOpacity={0.7} style={ls.availRow}>
            <Text style={ls.availText}>{item.label}</Text>
          </TouchableOpacity>
        ))}

        {/* Coming Soon */}
        <Text style={[ls.groupLabel, { marginTop: 34 }]}>COMING SOON</Text>
        {COMING.map((item) => (
          <TouchableOpacity key={item.key} onPress={() => handleMenu(item.key)} activeOpacity={0.7} style={ls.comingRow}>
            <Text style={ls.comingText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Welcome pop-up */}
      <Modal visible={comingSoonVisible} transparent animationType="fade" onRequestClose={dismissWelcome}>
        <TouchableOpacity
          style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}
          onPress={dismissWelcome}
          activeOpacity={1}
        >
          <BlurView intensity={60} tint="light" style={ls.csCard}>
            <TouchableOpacity style={ls.csClose} onPress={dismissWelcome}>
              <Text style={ls.csCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={ls.csTitle}>Welcome to the{"\n"}SPILS© Community [Beta].</Text>
            <Text style={ls.csSub}>Full Version Coming Soon!</Text>
          </BlurView>
        </TouchableOpacity>
      </Modal>
    </CommunityWrapper>
  );
}

// ─── Landing page styles ──────────────────────────────────────────────────────

const ls = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 12, paddingBottom: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.55)", alignItems: "center", justifyContent: "center" },
  iconBtnText: { color: "#fff", fontSize: 20, fontWeight: "300", lineHeight: 24, marginTop: -1 },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 30, paddingTop: 73, paddingBottom: 0 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 30, paddingTop: 22, paddingBottom: 0 },
  backCarrot: { color: "#fff", fontSize: 30, fontWeight: "300", lineHeight: 30, marginTop: 2 },
  pageTitle: { color: "#fff", fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },
  betaBadge: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#edff8d", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  betaText: { color: "#edff8d", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  subheadline: { color: "#FBE38A", fontSize: 11, fontWeight: "700", letterSpacing: 1, lineHeight: 18, paddingHorizontal: 30, marginTop: 12 },

  groupLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  availRow: { marginBottom: 8 },
  availText: { color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  comingRow: { marginBottom: 6 },
  comingText: { color: "#fff", fontSize: 19, fontWeight: "700", letterSpacing: -0.2 },

  csCard: { width: "100%", borderWidth: 1.5, borderColor: "#ffffff", borderRadius: 20, overflow: "hidden", paddingVertical: 40, paddingHorizontal: 24, alignItems: "center", gap: 16 },
  csClose: { position: "absolute" as const, top: 12, right: 12, width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  csCloseText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  csTitle: { color: "#fff", fontSize: 17, fontWeight: "700", textAlign: "center", lineHeight: 24 },
  csSub: { color: "#fff", fontSize: 14, fontWeight: "600", textAlign: "center" },
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
