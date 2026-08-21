import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase/config';
import SahaaraLogo from '../components/SahaaraLogo';
import AuthInput from '../components/AuthInput';
import PrimaryButton from '../components/PrimaryButton';
import { Ionicons } from '@expo/vector-icons';

const getFriendlySignupError = (errorCode) => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'An account already exists with this email.\n(इस ईमेल से खाता पहले से मौजूद है)';

    case 'auth/invalid-email':
      return 'Please enter a valid email address.\n(कृपया सही ईमेल दर्ज करें)';

    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.\n(पासवर्ड कम से कम 6 अक्षरों का होना चाहिए)';

    case 'auth/network-request-failed':
      return 'Internet connection error. Please try again.\n(इंटरनेट कनेक्शन की जाँच करें)';

    default:
      return 'Could not create account. Please check your details and try again.\n(खाता नहीं बन सका, पुनः प्रयास करें)';
  }
};

export default function SignupScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Field validation errors
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const validateForm = () => {
    let isValid = true;
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmError('');
    setErrorMessage('');

    if (!name.trim()) {
      setNameError('Please enter your name (अपना नाम दर्ज करें)');
      isValid = false;
    }

    if (!email.trim()) {
      setEmailError('Please enter your email address (ईमेल दर्ज करें)');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setEmailError('Please enter a valid email (सही ईमेल दर्ज करें)');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Please enter a password (पासवर्ड दर्ज करें)');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters (कम से कम 6 अक्षर)');
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmError('Please confirm your password (पासवर्ड की पुष्टि करें)');
      isValid = false;
    } else if (confirmPassword !== password) {
      setConfirmError('Passwords do not match (पासवर्ड मेल नहीं खाते)');
      isValid = false;
    }

    return isValid;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // Update profile display name if provided
      if (userCredential.user && name.trim()) {
        try {
          await updateProfile(userCredential.user, {
            displayName: name.trim(),
          });
        } catch (profileErr) {
          console.log('Profile update error:', profileErr);
        }
      }

      // Success -> Index auth listener or manual navigation to /home
      router.replace('/home');
    } catch (error) {
      console.log('Signup error:', error.code, error.message);
      const friendlyMsg = getFriendlySignupError(error.code);
      setErrorMessage(friendlyMsg);
    } finally {
      setLoading(false);
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
          {/* Branding Header */}
          <SahaaraLogo size="normal" showTagline={true} />

          {/* Card Container */}
          <View style={styles.card}>
            {/* Title */}
            <View style={styles.header}>
              <Text style={styles.headingTitle}>Create Account (नया खाता)</Text>
              <Text style={styles.headingSubtitle}>
                Join the Sahaara family (सहारा परिवार से जुड़ें)
              </Text>
            </View>

            {/* Error Banner */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={24} color="#C94A4A" />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Name Input */}
            <AuthInput
              label="Full Name / आपका पूरा नाम"
              placeholder="e.g. Ramesh Sharma"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError('');
              }}
              iconName="person-outline"
              autoCapitalize="words"
              error={nameError}
            />

            {/* Email Input */}
            <AuthInput
              label="Email / ईमेल"
              placeholder="Enter your email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError('');
              }}
              iconName="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              error={emailError}
            />

            {/* Password Input */}
            <AuthInput
              label="Password / पासवर्ड"
              placeholder="At least 6 characters"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError('');
              }}
              iconName="lock-closed-outline"
              isPassword={true}
              error={passwordError}
            />

            {/* Confirm Password Input */}
            <AuthInput
              label="Confirm Password / पासवर्ड की पुष्टि करें"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (confirmError) setConfirmError('');
              }}
              iconName="checkmark-circle-outline"
              isPassword={true}
              error={confirmError}
            />

            {/* Submit Button */}
            <PrimaryButton
              title="Create Account / खाता बनाएँ"
              onPress={handleSignup}
              loading={loading}
              loadingText="Creating account... (खाता बन रहा है)"
            />
          </View>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginQuestion}>
              Already have an account? (पहले से खाता है?)
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/login')}
              style={styles.loginBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.loginText}>Log In (प्रवेश करें)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F4EC',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginVertical: 12,
    borderWidth: 1.5,
    borderColor: '#EFE5D8',
    shadowColor: '#3E2723',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  headingTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#3E2723',
    textAlign: 'center',
  },
  headingSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7C685B',
    marginTop: 6,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    borderWidth: 1.5,
    borderColor: '#F5C6C6',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#C94A4A',
    marginLeft: 10,
    lineHeight: 21,
  },
  loginContainer: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 10,
  },
  loginQuestion: {
    fontSize: 17,
    fontWeight: '500',
    color: '#6E5A4D',
    marginBottom: 6,
  },
  loginBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  loginText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#C85A32',
    textDecorationLine: 'underline',
  },
});
