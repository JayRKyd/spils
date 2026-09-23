import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { signInWithApple, signInWithGoogle } from "@/lib/socialAuth";
import { SpilsLogo } from "@/components/SpilsLogo";
import { AppleLogo } from "@/components/AppleLogo";
import { GoogleLogo } from "@/components/GoogleLogo";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleSocial = async (provider: "apple" | "google") => {
    setError("");
    setSocialLoading(true);
    try {
      const session = provider === "apple" ? await signInWithApple() : await signInWithGoogle();
      if (session) router.replace("/(tabs)" as any);
    } catch (e: any) {
      setError(e?.message ?? "Sign-up failed. Please try again.");
    }
    setSocialLoading(false);
  };

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
          <View style={s.logoWrap}><SpilsLogo height={34} color="#E5F772" plain /></View>
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

        {/* Terms + Privacy agreement (required) */}
        <View style={s.agreeRow}>
          <TouchableOpacity style={[s.checkbox, agreed && s.checkboxOn]} onPress={() => setAgreed((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {agreed ? <Text style={s.checkboxTick}>✓</Text> : null}
          </TouchableOpacity>
          <Text style={s.agreeText}>
            I agree to the{" "}
            <Text style={s.agreeLink} onPress={() => Linking.openURL("https://www.spils.app/terms-of-service")}>Terms of Service</Text>
            {" "}and{" "}
            <Text style={s.agreeLink} onPress={() => Linking.openURL("https://www.spils.app/privacy-policy")}>Privacy Policy</Text>
          </Text>
        </View>

        <TouchableOpacity style={[s.primaryBtn, (loading || !agreed) && { opacity: 0.5 }]} onPress={handleSignup} disabled={loading || !agreed}>
          {loading ? <ActivityIndicator color="#13131a" /> : <Text style={s.primaryBtnText}>Sign Up</Text>}
        </TouchableOpacity>

        <View style={s.orRow}>
          <View style={s.orLine} />
          <Text style={s.orText}>Or</Text>
          <View style={s.orLine} />
        </View>

        {/* Same Terms/Privacy gate as email sign-up */}
        <View style={s.socialRow}>
          <TouchableOpacity style={[s.socialBtn, (socialLoading || !agreed) && { opacity: 0.5 }]} onPress={() => handleSocial("apple")} disabled={socialLoading || !agreed}>
            <AppleLogo size={24} color="#13131a" />
          </TouchableOpacity>
          <TouchableOpacity style={[s.socialBtn, (socialLoading || !agreed) && { opacity: 0.5 }]} onPress={() => handleSocial("google")} disabled={socialLoading || !agreed}>
            <GoogleLogo size={22} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.footer, { marginTop: 28 }]} onPress={() => router.back()}>
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

  agreeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 6 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: "#E5F772", borderColor: "#E5F772" },
  checkboxTick: { color: "#13131a", fontSize: 14, fontWeight: "700" },
  agreeText: { color: "rgba(255,255,255,0.6)", fontSize: 13, flex: 1, lineHeight: 19 },
  agreeLink: { color: "#E5F772", fontWeight: "600" },

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
