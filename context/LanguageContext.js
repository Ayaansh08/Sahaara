import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../i18n/translations';

const LANGUAGE_STORAGE_KEY = '@sahaara_app_language';

const LanguageContext = createContext({
  language: 'hi',
  setLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState('hi');

  useEffect(() => {
    // Load stored language preference
    const loadLanguage = async () => {
      try {
        const storedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (storedLang === 'hi' || storedLang === 'en') {
          setLanguageState(storedLang);
        }
      } catch (e) {
        console.log('Error loading language preference:', e);
      }
    };
    loadLanguage();
  }, []);

  const setLanguage = async (newLang) => {
    if (newLang === 'hi' || newLang === 'en') {
      setLanguageState(newLang);
      try {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      } catch (e) {
        console.log('Error storing language preference:', e);
      }
    }
  };

  const t = (key) => {
    if (translations[language] && translations[language][key]) {
      return translations[language][key];
    }
    // Fallback to English if Hindi key missing
    if (translations.en && translations.en[key]) {
      return translations.en[key];
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
export const useTranslation = () => {
  const { t, language, setLanguage } = useContext(LanguageContext);
  return { t, language, setLanguage };
};
