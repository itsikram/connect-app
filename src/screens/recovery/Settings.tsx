import React, { useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { RecoveryLang, RecoveryProfile, SupportContact, recoveryApi } from '../../services/recoveryApi';
import { ContactsEditor } from './Onboarding';
import { cleanPhone } from './helpers';
import { useRecoveryDashboard } from './hooks';
import { setRecoveryLanguage, useRecoveryI18n } from './i18n';
import { Banner, Button, Card, Muted, RecoveryPage, SectionHeader, Segmented, errorMessage } from './ui';

type Props = { navigation?: any };

export const RecoverySettings = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { lang, override, s } = useRecoveryI18n();
  const { data, setData } = useRecoveryDashboard(lang, navigation);
  const profile = data?.profile;
  const [settings, setSettings] = useState<RecoveryProfile['settings'] | null>(null);
  const [contacts, setContacts] = useState<SupportContact[] | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!profile) return;
    setSettings((old) => old || profile.settings);
    setContacts((old) => old || (profile.supportContacts.length ? profile.supportContacts : [{ name: '', phone: '', relation: '' }]));
  }, [profile]);

  const toggle = async (key: keyof RecoveryProfile['settings'], value: boolean) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    try {
      await recoveryApi.saveProfile({ settings: next }, lang);
      setMessage(s.settings.saved);
    } catch (saveError: any) {
      setSettings(settings);
      setMessage(errorMessage(saveError, s.common.saveError));
    }
  };

  const changeLanguage = async (value: string) => {
    const choice = value as 'auto' | RecoveryLang;
    await setRecoveryLanguage(choice);
    // The server uses this for AI replies and reminders when the app sends no language.
    if (profile) recoveryApi.saveProfile({ language: choice }, choice === 'auto' ? lang : choice).catch(() => {});
  };

  const savePeople = async () => {
    const cleaned = (contacts || []).map((contact) => ({ ...contact, phone: cleanPhone(contact.phone) })).filter((contact) => contact.name.trim() || contact.phone.trim());
    try {
      await recoveryApi.saveProfile({ supportContacts: cleaned }, lang);
      setMessage(s.settings.saved);
    } catch (saveError: any) {
      setMessage(errorMessage(saveError, s.common.saveError));
    }
  };

  const exportData = async () => {
    try {
      const response = await recoveryApi.exportData();
      await Share.share({ title: s.settings.exportData, message: JSON.stringify(response.data, null, 2) });
    } catch (exportError: any) {
      setMessage(errorMessage(exportError, s.common.saveError));
    }
  };

  const deleteAll = () =>
    Alert.alert(s.home.deleteConfirmTitle, s.home.deleteConfirmBody, [
      { text: s.common.cancel, style: 'cancel' },
      {
        text: s.home.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await recoveryApi.reset();
            await recoveryApi.clearCache();
            setData({ profile: null });
            navigation.navigate('RecoveryHome');
          } catch (resetError: any) {
            setMessage(errorMessage(resetError, s.common.saveError));
          }
        },
      },
    ]);

  const row = (key: keyof RecoveryProfile['settings'], title: string, body: string) => (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text.primary }]}>{title}</Text>
        <Muted style={{ fontSize: 13, marginTop: 2 }}>{body}</Muted>
      </View>
      <Switch
        accessibilityLabel={title}
        value={!!settings?.[key]}
        disabled={!settings}
        onValueChange={(value) => toggle(key, value)}
        trackColor={{ true: colors.primary, false: colors.border.primary }}
      />
    </View>
  );

  return (
    <RecoveryPage title={s.settings.title} navigation={navigation}>
      {message ? <Banner icon={message === s.settings.saved ? 'check' : 'alert-circle-outline'} tone={message === s.settings.saved ? 'good' : 'warn'} text={message} /> : null}

      <SectionHeader title={s.settings.languageTitle} />
      <Segmented
        options={[
          { label: s.settings.langAuto, value: 'auto' },
          { label: 'English', value: 'en' },
          { label: 'বাংলা', value: 'bn' },
        ]}
        value={override}
        onChange={changeLanguage}
      />
      <View style={{ height: 12 }} />

      {profile ? (
        <>
          <Card>
            {row('aiEnabled', s.settings.aiTitle, s.settings.aiBody)}
            {row('discreet', s.settings.discreetTitle, s.settings.discreetBody)}
            {row('riskNudges', s.settings.nudgesTitle, s.settings.nudgesBody)}
          </Card>

          <SectionHeader title={s.settings.peopleTitle} />
          <Muted style={styles.hint}>{s.settings.peopleHint}</Muted>
          {contacts ? <ContactsEditor contacts={contacts} onChange={setContacts} /> : null}
          <Button label={s.settings.savePeople} loadingLabel={s.common.saving} icon="content-save-outline" variant="secondary" onPress={savePeople} />

          <SectionHeader title={s.settings.detailsTitle} />
          <Button label={s.settings.editDetails} icon="pencil-outline" variant="secondary" onPress={() => navigation.navigate('RecoveryOnboarding', { edit: true })} />

          <SectionHeader title={s.settings.dataTitle} />
          <Muted style={styles.hint}>{s.settings.exportHint}</Muted>
          <Button label={s.settings.exportData} loadingLabel={s.common.loading} icon="export-variant" variant="secondary" onPress={exportData} />
          <Button label={s.home.deleteAll} icon="delete-outline" variant="danger" onPress={deleteAll} />
        </>
      ) : null}
    </RecoveryPage>
  );
};

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 13, marginBottom: 10, marginTop: -4 },
});
