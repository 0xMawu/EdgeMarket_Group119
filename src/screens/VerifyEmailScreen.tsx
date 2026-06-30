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

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

export function VerifyEmailScreen({ route }: Props) {
  const { email } = route.params;
  const { verifyEmail, resendCode } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resendMsg, setResendMsg] = useState('');

  const handleVerify = async () => {
    setError('');
    setResendMsg('');
    if (code.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setLoading(true);
    try {
      await verifyEmail(email, code);
      // AuthGuard transitions automatically on authState === 'authenticated'
    } catch (err) {
      setError((err as Error).message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResendMsg('');
    setResending(true);
    try {
      await resendCode(email);
      setResendMsg('A new code has been sent to your email.');
    } catch (err) {
      setError((err as Error).message || 'Resend failed. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const truncatedEmail = email.length > 28
    ? email.slice(0, 14) + '…' + email.slice(-8)
    : email;

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
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.emailHighlight}>{truncatedEmail}</Text>
            </Text>

            <TextInput
              style={styles.input}
              placeholder="000000"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={code}
              onChangeText={t => { setCode(t.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              keyboardType="number-pad"
              maxLength={6}
              editable={!loading}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {resendMsg ? <Text style={styles.success}>{resendMsg}</Text> : null}

            <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={handleVerify} disabled={loading}>
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.btnText}>Verify</Text>}
            </Pressable>

            <Pressable
              style={[styles.secondaryBtn, resending && styles.btnDisabled]}
              onPress={handleResend}
              disabled={resending || loading}
            >
              {resending
                ? <ActivityIndicator color={colors.purple} size="small" />
                : <Text style={styles.secondaryBtnText}>Resend code</Text>}
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
  title: { color: colors.white, fontSize: 28, fontFamily: fonts.bold, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontSize: 15, marginBottom: 32, textAlign: 'center', lineHeight: 22 },
  emailHighlight: { color: colors.purple, fontFamily: fonts.semiBold, fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 18,
    color: colors.white, fontSize: 28, marginBottom: 12,
    letterSpacing: 12, textAlign: 'center', fontFamily: fonts.bold, fontWeight: '700',
  },
  error: { color: colors.red, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  success: { color: colors.green, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btn: {
    backgroundColor: colors.purpleStrong, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 15, fontFamily: fonts.bold, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1, borderColor: colors.purple, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginTop: 12,
  },
  secondaryBtnText: { color: colors.purple, fontSize: 13, fontFamily: fonts.semiBold, fontWeight: '600' },
});
