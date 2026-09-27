import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { Helpline } from '../../services/recoveryApi';
import { OFFLINE_HELPLINES } from './content';
import { useCachedDashboard, useRecoveryContent } from './hooks';
import { useRecoveryI18n } from './i18n';
import { Button, Card, Icon, InfoCard, Muted, REC, RecoveryPage, SectionHeader, callPhone, openLink, sendSms } from './ui';

type Props = { navigation?: any };

// Works fully offline: bundled helplines are shown until the server copy is cached.
export const RecoveryHelp = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { lang, s, f } = useRecoveryI18n();
  const { content } = useRecoveryContent(lang);
  const dashboard = useCachedDashboard();
  const helplines = content?.helplines?.length ? content.helplines : OFFLINE_HELPLINES[lang];
  const contacts = (dashboard?.profile?.supportContacts || []).filter((contact) => contact.phone);
  const primary = dashboard?.substances?.find((item) => item.primary) || dashboard?.substances?.[0];
  const talk = helplines.filter((line) => line.key !== 'emergency' && line.kind !== 'treatment');
  const treatment = helplines.filter((line) => line.kind === 'treatment');

  const renderLine = (line: Helpline) => (
    <Card key={line.key}>
      <View style={styles.lineHead}>
        <Icon name={line.kind === 'treatment' ? 'hospital-building' : line.kind === 'youth' ? 'human-child' : 'phone-in-talk-outline'} size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.lineName, { color: colors.text.primary }]}>{line.name}</Text>
          {line.display || line.hours ? <Text style={[styles.lineMeta, { color: colors.text.secondary }]}>{[line.display, line.hours].filter(Boolean).join(' · ')}</Text> : null}
        </View>
      </View>
      <Muted style={{ fontSize: 13, marginTop: 6 }}>{line.description}</Muted>
      <View style={styles.actions}>
        {line.phone ? <Button label={s.help.call} icon="phone" onPress={() => callPhone(line.phone, lang)} style={{ flex: 1 }} /> : null}
        {line.url ? <Button label={s.help.website} icon="open-in-new" variant="secondary" onPress={() => openLink(line.url as string)} style={{ flex: 1 }} /> : null}
      </View>
    </Card>
  );

  return (
    <RecoveryPage title={s.help.title} subtitle={s.help.subtitle} navigation={navigation} showSos={false}>
      <View style={[styles.emergency, { backgroundColor: colors.surface.primary }]}>
        <View style={styles.lineHead}>
          <Icon name="alarm-light-outline" size={24} color={REC.sos} />
          <Text style={[styles.emergencyTitle, { color: colors.text.primary }]}>{s.help.emergencyTitle}</Text>
        </View>
        <Text style={[styles.emergencyBody, { color: colors.text.primary }]}>{s.help.emergencyBody}</Text>
        <Button label={s.crisis.call999} icon="phone" variant="danger" onPress={() => callPhone('999', lang)} />
      </View>

      <SectionHeader title={s.help.myPeople} />
      {contacts.length ? (
        contacts.map((contact) => (
          <Card key={`${contact.name}-${contact.phone}`}>
            <View style={styles.lineHead}>
              <Icon name="account-heart-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.lineName, { color: colors.text.primary }]}>{contact.name || contact.phone}</Text>
                <Text style={[styles.lineMeta, { color: colors.text.secondary }]}>{[contact.relation, contact.phone].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <Button label={s.help.call} icon="phone" onPress={() => callPhone(contact.phone, lang)} style={{ flex: 1 }} />
              <Button label={s.help.message} icon="message-text-outline" variant="secondary" onPress={() => sendSms(contact.phone, s.sos.smsText)} style={{ flex: 1 }} />
            </View>
          </Card>
        ))
      ) : dashboard?.profile ? (
        <Button label={s.help.addPerson} icon="account-plus-outline" variant="secondary" onPress={() => navigation.navigate('RecoverySettings')} />
      ) : null}

      <SectionHeader title={s.help.talkTitle} />
      {talk.map(renderLine)}

      <InfoCard icon="message-question-outline" title={s.help.scriptTitle}>
        <Text style={[styles.script, { color: colors.text.primary }]}>{f(s.help.script, { substance: primary?.name || (lang === 'bn' ? 'নেশা' : 'drugs') })}</Text>
      </InfoCard>

      {treatment.length ? <SectionHeader title={s.help.treatmentTitle} /> : null}
      {treatment.map(renderLine)}

      <InfoCard icon="medical-bag" title={s.help.overdoseTitle} tone={REC.sos}>
        {s.help.overdoseSteps.map((step, index) => (
          <View key={step} style={styles.step}>
            <Text style={[styles.stepNumber, { color: REC.sos }]}>{index + 1}.</Text>
            <Text style={[styles.stepText, { color: colors.text.primary }]}>{step}</Text>
          </View>
        ))}
      </InfoCard>

      <Muted style={styles.note}>{s.help.note}</Muted>
    </RecoveryPage>
  );
};

const styles = StyleSheet.create({
  emergency: { borderWidth: 2, borderColor: REC.sos, borderRadius: 18, padding: 16, marginBottom: 12, gap: 8 },
  emergencyTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
  emergencyBody: { fontSize: 15, lineHeight: 22 },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineName: { fontSize: 16, fontWeight: '800' },
  lineMeta: { fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  script: { fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  step: { flexDirection: 'row', gap: 8, marginTop: 6 },
  stepNumber: { fontWeight: '800', fontSize: 15, width: 18 },
  stepText: { flex: 1, fontSize: 15, lineHeight: 21 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 8 },
});
