import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { getApiBaseUrl } from '../services/saathiService'; // Reusing base url logic
import { Platform } from 'react-native';

const STATES = {
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
};

export default function SaathiVoiceScreen() {
  const router = useRouter();
  const [callState, setCallState] = useState(STATES.PROCESSING); // Start by fetching greeting
  const [transcript, setTranscript] = useState('');
  const [saathiReply, setSaathiReply] = useState('');
  
  const recordingRef = useRef(null);
  const soundRef = useRef(null);
  const hasGreeted = useRef(false);

  useEffect(() => {
    // Request permissions on mount
    (async () => {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        // Start the call by fetching the greeting
        if (!hasGreeted.current) {
          hasGreeted.current = true;
          fetchGreeting();
        }
      } catch (err) {
        console.error('Failed to init audio', err);
      }
    })();

    return () => {
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {}
      recordingRef.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
  };

  const getHeaders = async () => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : '';
    return {
      'Authorization': `Bearer ${token}`
    };
  };

  const saveToHistory = async (role, content) => {
    if (!auth.currentUser || !content) return;
    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'saathiMessages'), {
        role,
        content,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.log('Error saving to history', e);
    }
  };

  const playBase64Audio = async (base64String) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      const uri = base64String.startsWith('data:') 
        ? base64String 
        : `data:audio/mp3;base64,${base64String}`;
        
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setCallState(STATES.IDLE);
        }
      });
    } catch (err) {
      console.error('Error playing audio:', err);
      setCallState(STATES.IDLE);
    }
  };

  const fetchGreeting = async () => {
    setCallState(STATES.PROCESSING);
    setSaathiReply('');
    setTranscript('');
    try {
      const headers = await getHeaders();
      const res = await fetch(`${getApiBaseUrl()}/api/saathi/greet`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      
      setSaathiReply(data.reply);
      setCallState(STATES.SPEAKING);
      await saveToHistory('saathi', data.reply);
      if (data.audioBase64) {
        await playBase64Audio(data.audioBase64);
      } else {
        setCallState(STATES.IDLE);
      }
    } catch (e) {
      console.log('Greeting error:', e);
      setCallState(STATES.IDLE);
    }
  };

  const startRecording = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
      }
      setTranscript('');
      setSaathiReply('');
      setCallState(STATES.RECORDING);
      
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
    } catch (err) {
      console.error('Failed to start recording', err);
      setCallState(STATES.IDLE);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setCallState(STATES.PROCESSING);
    
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      await uploadAudio(uri);
    } catch (err) {
      console.error('Failed to stop recording', err);
      setCallState(STATES.IDLE);
    }
  };

  const uploadAudio = async (uri) => {
    try {
      const headers = await getHeaders();
      
      // Fetch recent history
      let historyJSON = "[]";
      try {
        if (auth.currentUser && db) {
          const { query, collection, orderBy, limit, getDocs } = require('firebase/firestore');
          const q = query(
            collection(db, 'users', auth.currentUser.uid, 'saathiMessages'), 
            orderBy('timestamp', 'desc'), 
            limit(12)
          );
          const snap = await getDocs(q);
          const historyArr = [];
          snap.forEach(doc => {
             const data = doc.data();
             historyArr.push({ role: data.role, content: data.content });
          });
          historyJSON = JSON.stringify(historyArr.reverse());
        }
      } catch (err) {
        console.log('Error fetching history:', err);
      }
      
      // Using FormData to send the audio file
      const formData = new FormData();
      formData.append('audio', {
        uri,
        name: 'audio.m4a',
        type: 'audio/m4a'
      });
      formData.append('history', historyJSON);

      const res = await fetch(`${getApiBaseUrl()}/api/saathi/voice`, {
        method: 'POST',
        headers: {
          ...headers,
          // Do not manually set Content-Type for FormData, fetch does it with boundary
        },
        body: formData
      });

      if (!res.ok) throw new Error('API Error');
      
      const data = await res.json();
      
      if (data.transcript) {
        setTranscript(data.transcript);
        await saveToHistory('user', data.transcript);
      }
      if (data.reply) {
        setSaathiReply(data.reply);
        await saveToHistory('saathi', data.reply);
      }

      if (data.audioBase64) {
        setCallState(STATES.SPEAKING);
        await playBase64Audio(data.audioBase64);
      } else {
        setCallState(STATES.IDLE);
      }

    } catch (e) {
      console.error('Upload error:', e);
      setSaathiReply('Mujhe sunne mein dikkat hui. Kripya phirse koshish karein.');
      setCallState(STATES.IDLE);
    }
  };

  const handleMicTap = () => {
    if (callState === STATES.IDLE) {
      startRecording();
    } else if (callState === STATES.RECORDING) {
      stopRecording();
    }
  };

  const handleEndCall = () => {
    cleanupAudio();
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1E1E" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SAATHI Voice Call</Text>
      </View>

      <View style={styles.mainArea}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatarGlow, callState === STATES.SPEAKING && styles.avatarGlowActive]}>
            <Ionicons name="person" size={80} color="#FFF" />
          </View>
        </View>

        <View style={styles.transcriptArea}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
             {transcript ? <Text style={styles.userText}>{transcript}</Text> : null}
             {saathiReply ? <Text style={styles.saathiText}>{saathiReply}</Text> : null}
          </ScrollView>
        </View>
        
        <Text style={styles.stateLabel}>
          {callState === STATES.IDLE && 'Tap to speak'}
          {callState === STATES.RECORDING && 'Listening...'}
          {callState === STATES.PROCESSING && 'Thinking...'}
          {callState === STATES.SPEAKING && 'Saathi is speaking'}
        </Text>

        <View style={styles.controlsRow}>
          <View style={styles.controlsPlaceholder} />

          <TouchableOpacity
            style={[
              styles.micButton,
              callState === STATES.RECORDING && styles.micButtonRecording,
              (callState === STATES.PROCESSING || callState === STATES.SPEAKING) && styles.micButtonDisabled
            ]}
            onPress={handleMicTap}
            disabled={callState === STATES.PROCESSING || callState === STATES.SPEAKING}
          >
            {callState === STATES.PROCESSING ? (
              <ActivityIndicator color="#FFF" size="large" />
            ) : (
              <Ionicons 
                name={callState === STATES.RECORDING ? "stop" : "mic"} 
                size={40} 
                color="#FFF" 
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
            <Ionicons name="call" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  mainArea: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  avatarContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  avatarGlow: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#444',
  },
  avatarGlowActive: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  transcriptArea: {
    flex: 1,
    width: '100%',
    marginVertical: 30,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  userText: {
    fontSize: 18,
    color: '#DDD',
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  saathiText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
  },
  stateLabel: {
    fontSize: 18,
    color: '#AAA',
    marginBottom: 20,
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingBottom: 20,
  },
  controlsPlaceholder: {
    width: 60, // Match endCallButton width for center alignment
  },
  micButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  micButtonRecording: {
    backgroundColor: '#FF3B30',
  },
  micButtonDisabled: {
    backgroundColor: '#555',
  },
  endCallButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
  },
});
