import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Impressum – RoutineQuest" };

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-[#050507] px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-[#A855F7] font-semibold hover:underline">
          ← Zurück
        </Link>
        <h1 className="text-2xl font-extrabold text-[#F8F7FC] mt-4 mb-6">Impressum</h1>

        <div className="text-sm text-[#C8C5D2] space-y-2 leading-relaxed">
          <p>Angaben gemäß § 5 TMG:</p>
          <p>[Platzhalter: Name/Firma des Betreibers]</p>
          <p>[Platzhalter: Anschrift]</p>
          <p>[Platzhalter: E-Mail-Adresse]</p>
          <p className="text-xs text-[#8D8998] pt-4">
            Diese Angaben sind Platzhalter und müssen vor einer echten Veröffentlichung durch die tatsächlichen
            Betreiberdaten ersetzt werden.
          </p>
        </div>

        <p className="text-xs text-[#5F5B68] mt-10">
          Siehe auch: <Link href="/datenschutz" className="text-[#A855F7] hover:underline">Datenschutzerklärung</Link>
        </p>
      </div>
    </div>
  );
}
