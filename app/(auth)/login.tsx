import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { signInWithApple, signInWithGoogle } from "@/lib/socialAuth";
import { SpilsLogo } from "@/components/SpilsLogo";
import { AppleLogo } from "@/components/AppleLogo";
import { GoogleLogo } from "@/components/GoogleLogo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSocial = async (provider: "apple" | "google") => {
    setError("");
    setSocialLoading(true);
    try {
      const session = provider === "apple" ? await signInWithApple() : await signInWithGoogle();
      if (session) router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message ?? "Sign-in failed. Please try again.");
    }
    setSocialLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.replace("/(tabs)");
    setLoading(false);
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={s.inner} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.logoWrap}><SpilsLogo height={34} color="#E5F772" plain /></View>

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

        <TouchableOpacity style={[s.primaryBtn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#13131a" /> : <Text style={s.primaryBtnText}>Sign In</Text>}
        </TouchableOpacity>

        <View style={s.orRow}>
          <View style={s.orLine} />
          <Text style={s.orText}>Or</Text>
          <View style={s.orLine} />
        </View>

        <View style={s.socialRow}>
          <TouchableOpacity style={[s.socialBtn, socialLoading && { opacity: 0.5 }]} onPress={() => handleSocial("apple")} disabled={socialLoading}>
            <AppleLogo size={24} color="#13131a" />
          </TouchableOpacity>
          <TouchableOpacity style={[s.socialBtn, socialLoading && { opacity: 0.5 }]} onPress={() => handleSocial("google")} disabled={socialLoading}>
            <GoogleLogo size={22} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.footer, { marginTop: 28 }]} onPress={() => router.push("/(auth)/signup")}>
          <Text style={s.footerText}>
            You don't have an account?{"  "}
            <Text style={s.footerLink}>Sign Up</Text>
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

  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 22 },
  orLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.15)" },
  orText: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
  socialRow: { flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 18 },
  socialBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },

  footer: { alignItems: "center" },
  footerText: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
  footerLink: { color: "#E5F772", fontWeight: "600" },
});
