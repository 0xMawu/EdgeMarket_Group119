import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthStackParamList } from '../navigation/AuthNavigator';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);

  const handleLogin = async () => {
    setError('');
    setUnverified(false);
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      // AuthGuard transitions automatically on authState === 'authenticated'
    } catch (err) {
      const msg = (err as Error).message;
      if ((err as any).status === 403) {
        setError(msg);
        setUnverified(true);
      } else {
        setError(msg || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>EdgeMarket</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={email}
              onChangeText={t => { setEmail(t); setError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={password}
              onChangeText={t => { setPassword(t); setError(''); }}
              secureTextEntry
              editable={!loading}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {unverified && (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('VerifyEmail', { email: email.trim().toLowerCase() })}
              >
                <Text style={styles.secondaryBtnText}>Resend verification code</Text>
              </Pressable>
            )}

            <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.btnText}>Sign In</Text>}
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Signup')} style={styles.link}>
              <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Sign up</Text></Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 24, justifyContent: 'center', minHeight: '100%' },
  title: { color: colors.white, fontSize: 32, fontFamily: fonts.bold, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontSize: 15, marginBottom: 32, textAlign: 'center' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: colors.white, fontSize: 15, marginBottom: 12,
  },
  error: { color: colors.red, fontSize: 13, marginBottom: 12 },
  btn: {
    backgroundColor: colors.purpleStrong, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 15, fontFamily: fonts.bold, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1, borderColor: colors.purple, borderRadius: 12,
    paddingVertical: 10, alignItems: 'center', marginBottom: 8,
  },
  secondaryBtnText: { color: colors.purple, fontSize: 13, fontFamily: fonts.semiBold, fontWeight: '600' },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: colors.textMuted, fontSize: 14 },
  linkBold: { color: colors.purple, fontFamily: fonts.semiBold, fontWeight: '600' },
});
