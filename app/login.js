import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase/config';
import SahaaraLogo from '../components/SahaaraLogo';
import AuthInput from '../components/AuthInput';
import PrimaryButton from '../components/PrimaryButton';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING } from '../constants/theme';

// Human-friendly Firebase authentication error mapper
const getFriendlyErrorMessage = (errorCode) => {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password.\nPlease check your details and try again.';

    case 'auth/invalid-email':
      return 'Please enter a valid email address.';

    case 'auth/network-request-failed':
      return "We couldn't connect right now.\nPlease check your internet connection and try again.";

    case 'auth/too-many-requests':
      return 'Too many failed attempts.\nPlease wait a few minutes before trying again.';

    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';

    default:
      return 'Unable to sign in right now.\nPlease check your details and try again.';
  }
};

export default function LoginScreen() {
  const router = useRouter();

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Validation error states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Password reset modal states
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');
  const [resetErrorMsg, setResetErrorMsg] = useState('');

  // Client validation
  const validateForm = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setErrorMessage('');

    if (!email.trim()) {
      setEmailError('Enter your email address');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setEmailError('Enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Enter your password');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    return isValid;
  };

  // Firebase Login handler
  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrorMessage('');

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/home');
    } catch (error) {
      console.log('Login error:', error.code, error.message);
      const friendlyMsg = getFriendlyErrorMessage(error.code);
      setErrorMessage(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  // Firebase Password Reset handler
  const handleSendResetEmail = async () => {
    setResetSuccessMsg('');
    setResetErrorMsg('');

    if (!resetEmail.trim()) {
      setResetErrorMsg('Please enter your email address.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(resetEmail.trim())) {
      setResetErrorMsg('Please enter a valid email address.');
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSuccessMsg(
        'Password reset instructions have been sent to your email.'
      );
    } catch (error) {
      console.log('Reset password error:', error.code, error.message);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setResetErrorMsg('No account found with this email address.');
      } else {
        setResetErrorMsg('Could not send reset email. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Branding Area (Compact) */}
          <SahaaraLogo showTagline={true} />

          {/* Floating Warm Login Card */}
          <View style={styles.card}>
            {/* Heading Hierarchy */}
            <View style={styles.headingBox}>
              <Text style={styles.hindiTitle}>स्वागत है</Text>
              <Text style={styles.englishSubheading}>Welcome back</Text>
              <Text style={styles.captionText}>
                अपने खाते में प्रवेश करें • Sign in to continue
              </Text>
            </View>

            {/* Polished Inline Error State */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={22} color={COLORS.error} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Input 1: Email */}
            <AuthInput
              label="Email / ईमेल"
              placeholder="Enter your email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError('');
                if (errorMessage) setErrorMessage('');
              }}
              iconName="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              error={emailError}
            />

            {/* Input 2: Password */}
            <AuthInput
              label="Password / पासवर्ड"
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError('');
                if (errorMessage) setErrorMessage('');
              }}
              iconName="lock-closed-outline"
              isPassword={true}
              error={passwordError}
            />

            {/* Subordinate Forgot Password Link */}
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => {
                setResetEmail(email);
                setResetSuccessMsg('');
                setResetErrorMsg('');
                setForgotModalVisible(true);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.forgotPasswordText}>
                Forgot password? / पासवर्ड भूल गए?
              </Text>
            </TouchableOpacity>

            {/* Primary Action Button */}
            <PrimaryButton
              title="Login / प्रवेश करें"
              onPress={handleLogin}
              loading={loading}
              loadingText="Logging in..."
            />

            {/* Secondary Registration Link */}
            <View style={styles.signupBox}>
              <Text style={styles.signupQuestion}>
                नया खाता बनाना है? (Don't have an account?)
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/signup')}
                activeOpacity={0.7}
                accessibilityRole="button"
                style={styles.createAccountBtn}
              >
                <Text style={styles.createAccountText}>
                  Create an account / खाता बनाएँ
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Subtle Security & Trust Reassurance */}
          <View style={styles.trustBadge}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.positive} />
            <Text style={styles.trustText}>
              आपकी जानकारी सुरक्षित है • Your information is secure
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity
                onPress={() => setForgotModalVisible(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close reset modal"
              >
                <Ionicons name="close" size={26} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Enter your registered email address to receive password reset instructions.
            </Text>

            {resetSuccessMsg ? (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.positive} />
                <Text style={styles.successText}>{resetSuccessMsg}</Text>
              </View>
            ) : null}

            {resetErrorMsg ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={22} color={COLORS.error} />
                <Text style={styles.errorBannerText}>{resetErrorMsg}</Text>
              </View>
            ) : null}

            {!resetSuccessMsg && (
              <>
                <AuthInput
                  label="Email / ईमेल"
                  placeholder="Enter your email"
                  value={resetEmail}
                  onChangeText={(text) => {
                    setResetEmail(text);
                    if (resetErrorMsg) setResetErrorMsg('');
                  }}
                  iconName="mail-outline"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <PrimaryButton
                  title="Send Reset Link"
                  onPress={handleSendResetEmail}
                  loading={resetLoading}
                  loadingText="Sending..."
                />
              </>
            )}

            {resetSuccessMsg ? (
              <PrimaryButton
                title="Back to Login"
                onPress={() => setForgotModalVisible(false)}
                variant="secondary"
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.md + 4,
    paddingTop: SPACING.xs + 2,
    paddingBottom: SPACING.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius + 2,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headingBox: {
    marginBottom: SPACING.md + 4,
    alignItems: 'center',
  },
  hindiTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  englishSubheading: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
    textAlign: 'center',
  },
  captionText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorLight,
    borderWidth: 1.5,
    borderColor: COLORS.errorBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: SPACING.md,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.error,
    marginLeft: 10,
    lineHeight: 20,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 14,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  forgotPasswordText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  signupBox: {
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3EDE4',
  },
  signupQuestion: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textSubtle,
    marginBottom: 4,
  },
  createAccountBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  createAccountText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  trustText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.positive,
    marginLeft: 6,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(44, 29, 17, 0.45)',
    justifyContent: 'center',
    padding: SPACING.md + 4,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 15,
    color: COLORS.textSubtle,
    lineHeight: 21,
    marginBottom: 18,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.positiveLight,
    borderWidth: 1.5,
    borderColor: COLORS.positiveBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  successText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.positive,
    marginLeft: 10,
    lineHeight: 20,
  },
});
