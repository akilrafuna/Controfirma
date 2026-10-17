/**
 * The evaluation set.
 *
 * Five fraudulent calls modelled on documented attack patterns, and five that
 * are genuine but awkward: a CFO in a real hurry, a bank that really is calling
 * about a real transaction, a notary on a real closing. Those five are the hard
 * half. A keyword matcher flags all of them. Controfirma must not.
 *
 * `expected` is the ground truth used by `npm run eval`. Nothing in the pipeline
 * reads it.
 */
export const TEST_CALLS = [
  // ───────────────────────────────── fraud ─────────────────────────────────
  {
    id: 'false-lawyer-acquisition',
    title: 'Voice-cloned lawyer, confidential acquisition',
    note: 'The pattern used against Fideuram in September 2026: a cloned voice of external counsel, a secret deal, a fresh escrow account.',
    language: 'it',
    expected: 'fraud',
    lines: [
      { speaker: 'staff', text: 'Amministrazione, buonasera.' },
      { speaker: 'caller', text: "Buonasera, sono l'avvocato Ferrara, studio legale che assiste il presidente." },
      { speaker: 'caller', text: "La chiamo per un'operazione riservata, un'acquisizione che non è ancora pubblica." },
      { speaker: 'staff', text: 'Mi dica.' },
      { speaker: 'caller', text: 'Il presidente mi ha chiesto di contattarla direttamente. Non ne parli con la direzione finanziaria, nemmeno con il CFO.' },
      { speaker: 'caller', text: "Serve un bonifico urgente entro un'ora, prima della chiusura." },
      { speaker: 'caller', text: "L'IBAN è diverso da quello solito, è un conto escrow: IT60 X 0542 8111 0100 0000 1234." },
      { speaker: 'staff', text: 'Dovrei passare dalla doppia firma.' },
      { speaker: 'caller', text: 'Non serve la seconda firma, autorizzo io a nome del presidente.' },
      { speaker: 'caller', text: 'Resti in linea e non mi richiami, questo numero è temporaneo.' },
    ],
  },
  {
    id: 'ceo-fraud-whatsapp',
    title: 'CEO impersonation arriving by WhatsApp',
    note: 'Classic business email compromise moved to voice. Authority plus an unusual channel plus secrecy.',
    language: 'en',
    expected: 'fraud',
    lines: [
      { speaker: 'staff', text: 'Finance, good morning.' },
      { speaker: 'caller', text: 'This is the CEO. I sent you a WhatsApp from my personal mobile a minute ago.' },
      { speaker: 'caller', text: 'I need a payment made immediately, before the board call at noon.' },
      { speaker: 'staff', text: 'Which supplier is it?' },
      { speaker: 'caller', text: 'It goes to a new account, I will send the IBAN on the same number.' },
      { speaker: 'caller', text: 'Keep this strictly between us, do not tell the CFO or legal.' },
      { speaker: 'caller', text: 'There is no time to verify, we lose the deal if this slips.' },
    ],
  },
  {
    id: 'bank-impersonation-otp',
    title: 'Fake bank fraud team asking for a one-time code',
    note: 'The form of fraud EU payment rules now oblige banks to refund. A real bank never asks for the code.',
    language: 'en',
    expected: 'fraud',
    lines: [
      { speaker: 'caller', text: 'Good afternoon, I am calling from the bank, the fraud team.' },
      { speaker: 'caller', text: 'We have detected a suspicious transaction on your account.' },
      { speaker: 'staff', text: 'I did not authorise anything.' },
      { speaker: 'caller', text: 'Correct. To stop it your account will be blocked unless we act right now.' },
      { speaker: 'caller', text: 'I am sending a verification code to your phone. Please read me the code.' },
      { speaker: 'caller', text: 'Do not call back, stay on the line, the window is only a few minutes.' },
    ],
  },
  {
    id: 'supplier-iban-redirection',
    title: 'Supplier bank details redirected',
    note: 'Quiet, patient, no drama. The money simply goes somewhere else.',
    language: 'it',
    expected: 'fraud',
    lines: [
      { speaker: 'staff', text: 'Buongiorno, ufficio fornitori.' },
      { speaker: 'caller', text: 'Buongiorno, chiamo per conto del nostro ufficio amministrativo.' },
      { speaker: 'caller', text: "Abbiamo cambiato banca, l'IBAN è cambiato da questo mese." },
      { speaker: 'caller', text: 'La fattura in scadenza oggi va versata su questo conto nuovo.' },
      { speaker: 'staff', text: 'Mi serve una comunicazione scritta.' },
      { speaker: 'caller', text: 'Gliela mando dopo, intanto proceda, è urgente. Non serve la procedura, autorizzo io.' },
    ],
  },
  {
    id: 'fake-police-safe-account',
    title: 'False police, move the money to a safe account',
    note: 'Authority plus a manufactured investigation plus a threat.',
    language: 'it',
    expected: 'fraud',
    lines: [
      { speaker: 'caller', text: 'Parlo a nome della Guardia di Finanza, nucleo di polizia valutaria.' },
      { speaker: 'caller', text: "C'è un'indagine in corso su movimenti sospetti dal vostro conto." },
      { speaker: 'caller', text: "È un'operazione riservata, non ne parli con nessuno in azienda." },
      { speaker: 'staff', text: 'Posso richiamarvi al centralino?' },
      { speaker: 'caller', text: 'Non mi richiami, la linea è protetta. Non c\'è tempo per verificare.' },
      { speaker: 'caller', text: 'Deve trasferire i fondi subito su un conto di garanzia, altrimenti sarà responsabile penalmente.' },
    ],
  },

  // ───────────────────────── genuine, but difficult ─────────────────────────
  {
    id: 'legit-cfo-in-a-hurry',
    title: 'The real CFO, genuinely in a rush',
    note: 'Fires authority and urgency and nothing else. A keyword tool flags this and destroys its own credibility.',
    language: 'it',
    expected: 'legit',
    lines: [
      { speaker: 'staff', text: 'Ciao, dimmi.' },
      { speaker: 'caller', text: 'Ciao, sono Marco, il CFO.' },
      { speaker: 'caller', text: 'Mi serve un bonifico urgente oggi per il fornitore Ferretti, la fattura scade.' },
      { speaker: 'staff', text: 'Su quale conto?' },
      { speaker: 'caller', text: "L'IBAN è quello che usiamo sempre, lo trovi in anagrafica fornitori." },
      { speaker: 'caller', text: 'Passa pure da Elena per la seconda firma, come sempre.' },
      { speaker: 'caller', text: 'Se vuoi richiamami sul fisso dell\'ufficio per conferma.' },
    ],
  },
  {
    id: 'legit-bank-verifying',
    title: 'The bank really is calling about a real transaction',
    note: 'A genuine bank asks you to call back on the number on your card. It never asks for the code.',
    language: 'en',
    expected: 'legit',
    lines: [
      { speaker: 'caller', text: 'Good morning, I am calling from the bank regarding a transfer authorised this morning.' },
      { speaker: 'caller', text: 'We flagged it for review because the amount is above your usual range.' },
      { speaker: 'staff', text: 'How do I know this is really you?' },
      { speaker: 'caller', text: 'Please hang up and call the number printed on the back of your card, then ask for case 48812.' },
      { speaker: 'caller', text: 'I will not ask you for any code or password. Take your time.' },
    ],
  },
  {
    id: 'legit-notary-closing',
    title: 'Notary on a property closing',
    note: 'Mentions a lawyer, a deadline and an IBAN. All of it checkable, none of it hidden.',
    language: 'it',
    expected: 'legit',
    lines: [
      { speaker: 'caller', text: 'Buongiorno, sono il notaio Bianchi, per il rogito di giovedì.' },
      { speaker: 'caller', text: 'Le confermo che il saldo va versato entro mercoledì, come da atto.' },
      { speaker: 'staff', text: 'Le coordinate sono quelle del preliminare?' },
      { speaker: 'caller', text: "Sì, l'IBAN del conto dedicato è quello già indicato nel preliminare firmato." },
      { speaker: 'caller', text: 'Ne parli tranquillamente con la banca e con il suo commercialista.' },
      { speaker: 'caller', text: 'Può richiamarmi allo studio quando vuole per conferma.' },
    ],
  },
  {
    id: 'legit-supplier-chasing',
    title: 'Supplier chasing a late invoice',
    note: 'Pressure and a mild consequence, but no secrecy, no bypass, no new account.',
    language: 'en',
    expected: 'legit',
    lines: [
      { speaker: 'caller', text: 'Hello, calling about invoice 2291, it is now thirty days overdue.' },
      { speaker: 'caller', text: 'We need it settled urgently or we will have to pause the next delivery.' },
      { speaker: 'staff', text: 'Let me check with accounts.' },
      { speaker: 'caller', text: 'Of course. Same bank details as always, they are on the invoice.' },
      { speaker: 'caller', text: 'Please copy in your purchasing manager so everyone sees where we are.' },
    ],
  },
  {
    id: 'legit-internal-approval',
    title: 'Colleague asking about an approval',
    note: 'Entirely ordinary. Should score near zero.',
    language: 'en',
    expected: 'legit',
    lines: [
      { speaker: 'caller', text: 'Hi, quick one. Did the Ferretti payment go through the approval queue yesterday?' },
      { speaker: 'staff', text: 'I think Elena signed it off.' },
      { speaker: 'caller', text: 'Great, I will check the log and confirm with her.' },
    ],
  },
];
