import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { SpilsLogo } from "@/components/SpilsLogo";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSignup = async () => {
    setLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    // With email confirmation disabled, signUp returns a live session — go straight in.
    // With confirmation enabled there is no session yet, so show the check-your-email screen.
    if (data.session) router.replace("/(tabs)" as any);
    else setSuccess(true);
  };

  if (success) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.inner}>
          <View style={s.logoWrap}><SpilsLogo height={34} color="#E5F772" /></View>
          <Text style={s.successTitle}>Check your email</Text>
          <Text style={s.successSub}>We sent a confirmation link to {email}</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace("/(auth)/login")}>
            <Text style={s.primaryBtnText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={s.inner} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.logoWrap}><SpilsLogo height={34} color="#E5F772" /></View>

        <TextInput
          style={s.input}
          placeholder="Email Address"
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View style={s.passwordWrap}>
          <TextInput
            style={s.passwordInput}
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={s.eyeBtn}>
            <Text style={s.eyeIcon}>{showPassword ? "🙈" : "👁"}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={[s.primaryBtn, loading && { opacity: 0.7 }]} onPress={handleSignup} disabled={loading}>
          {loading ? <ActivityIndicator color="#13131a" /> : <Text style={s.primaryBtnText}>Sign Up</Text>}
        </TouchableOpacity>

        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>Or</Text>
          <View style={s.dividerLine} />
        </View>

        <View style={s.socialRow}>
          <TouchableOpacity style={s.socialBtn} onPress={() => Alert.alert("Google", "Google sign-in coming soon.")}>
            <Text style={s.socialG}>G</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.socialBtn} onPress={() => Alert.alert("Apple", "Apple sign-in coming soon.")}>
            <Text style={s.socialIcon}></Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.socialBtn, s.socialFB]} onPress={() => Alert.alert("Facebook", "Facebook sign-in coming soon.")}>
            <Text style={[s.socialIcon, { color: "#fff" }]}>f</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.footer} onPress={() => router.back()}>
          <Text style={s.footerText}>
            Already have an account?{"  "}
            <Text style={s.footerLink}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#13131a" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },

  logoWrap: { marginBottom: 40, alignSelf: "flex-start" },

  successTitle: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 10 },
  successSub: { color: "rgba(255,255,255,0.5)", fontSize: 15, marginBottom: 32 },

  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16,
    color: "#fff", fontSize: 15, marginBottom: 12,
  },
  passwordWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14, marginBottom: 12, paddingRight: 14,
  },
  passwordInput: { flex: 1, paddingHorizontal: 18, paddingVertical: 16, color: "#fff", fontSize: 15 },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 16 },

  error: { color: "#f87171", fontSize: 13, marginBottom: 10 },

  primaryBtn: {
    backgroundColor: "#E5F772", borderRadius: 50,
    paddingVertical: 17, alignItems: "center", marginTop: 8, marginBottom: 4,
  },
  primaryBtnText: { color: "#13131a", fontWeight: "700", fontSize: 16 },

  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  dividerText: { color: "rgba(255,255,255,0.4)", fontSize: 13 },

  socialRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginBottom: 36 },
  socialBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  socialFB: { backgroundColor: "#1877F2" },
  socialG: { fontSize: 20, fontWeight: "700", color: "#4285F4" },
  socialIcon: { fontSize: 20, fontWeight: "700", color: "#13131a" },

  footer: { alignItems: "center" },
  footerText: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
  footerLink: { color: "#E5F772", fontWeight: "600" },
});
