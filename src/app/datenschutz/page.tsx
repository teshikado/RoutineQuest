import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Datenschutzerklärung – RoutineQuest" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-[#F8F7FC] mb-2">{title}</h2>
      <div className="text-sm text-[#C8C5D2] space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-[#050507] px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-[#A855F7] font-semibold hover:underline">
          ← Zurück
        </Link>
        <h1 className="text-2xl font-extrabold text-[#F8F7FC] mt-4 mb-1">Datenschutzerklärung</h1>
        <p className="text-xs text-[#8D8998] mb-8">Stand: August 2026</p>

        <Section title="1. Verantwortlicher">
          <p>
            [Platzhalter: Name/Firma des Betreibers], [Platzhalter: Anschrift], [Platzhalter: E-Mail-Adresse]. Diese
            Angaben müssen vor einer echten Veröffentlichung durch die tatsächlichen Betreiberdaten ersetzt werden.
          </p>
        </Section>

        <Section title="2. Welche Daten wir speichern">
          <p>Kontodaten: E-Mail-Adresse, Passwort (verschlüsselt gespeichert), Anzeigename, Profilfarbe/-symbol.</p>
          <p>
            Nutzungsdaten: Routinen, Erledigungen, XP, Level, Streaks, Tagesplanung, Gruppen- und
            Ranglisten-Fortschritt.
          </p>
          <p>
            Heldensystem: Charaktertyp (männlich/weiblich), Heldenname, Aussehen (Hautfarbe, Haarfarbe, Frisur),
            Inventar und Ausrüstungsgegenstände, gewähltes Haustier samt Entwicklungsstufe, Fleischbestand,
            Fleischtransaktionen, Fütterungsverlauf und Levelbelohnungen.
          </p>
        </Section>

        <Section title="3. Zweck der Verarbeitung">
          <p>
            Die genannten Daten werden ausschließlich verarbeitet, um die Funktionen von RoutineQuest bereitzustellen
            (Anmeldung, Fortschrittsanzeige, Gruppen- und Ranglistenfunktionen, Heldensystem). Es findet keine
            Weitergabe an Werbenetzwerke oder sonstige Dritte statt.
          </p>
        </Section>

        <Section title="4. Sichtbarkeit gegenüber anderen Nutzern">
          <p>
            Routinen-Titel, Tagesplanung und alle Heldendaten (Charakter, Inventar, Ausrüstung, Haustier, Fleisch,
            Belohnungen) sind privat und werden nicht automatisch mit anderen Nutzern oder Gruppenmitgliedern
            geteilt. In Gruppen werden ausschließlich aggregierte Fortschrittswerte (XP, erledigte Aufgaben,
            Erfolgsquote, Streak, Level) sichtbar.
          </p>
        </Section>

        <Section title="5. Speicherdauer">
          <p>
            Deine Daten werden gespeichert, solange dein Konto besteht. Bei einer Kontolöschung werden alle
            zugehörigen Daten, einschließlich der Heldendaten, mitgelöscht.
          </p>
        </Section>

        <Section title="6. Deine Rechte">
          <p>
            Du hast das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung deiner Daten.
            Wende dich dazu an die oben genannte Kontaktadresse.
          </p>
        </Section>

        <p className="text-xs text-[#5F5B68] mt-10">
          Siehe auch: <Link href="/impressum" className="text-[#A855F7] hover:underline">Impressum</Link>
        </p>
      </div>
    </div>
  );
}
