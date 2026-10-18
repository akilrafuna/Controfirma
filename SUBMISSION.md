# lablab.ai submission — copy and paste

## Short description  (50–255 characters)

An AI-cloned voice took €95M from an Italian bank. Controfirma reads what a caller asks for, not how they sound: rules decide, the model only explains, a person signs. 5/5 frauds held, 0/5 genuine calls disturbed.

## Long description  (600–2000 characters)

In September 2026, fraudsters used an AI-cloned voice of an external lawyer to take €95 million from Fideuram, the private banking arm of Intesa Sanpaolo. It began with a WhatsApp message and a phone call. Around €36 million was never recovered.

Voice cloning has made "it sounded exactly like him" worthless as a control. Controfirma does not try to detect synthetic audio. It reads what the caller is asking for, and the asks that move money fraudulently have not changed: secrecy, a new account, a reason to skip the second signature, no time to check, don't call me back.

Ten markers drawn from the fraud patterns banks and police publish score the call in plain deterministic code, with no model involved. Single markers are weak on purpose, because the real CFO genuinely is in a hurry; the signal lives in combinations. An open model on AMD then writes the explanation, several candidates at once, and a verifier rejects any explanation whose quotes do not appear word for word in what the caller actually said. Nothing here blocks a payment: a person holds or releases, and that decision is recorded against their name.

Measured on AMD: 5 of 5 fraudulent calls held, 0 of 5 genuine calls disturbed, $0.03 per 1,000 calls analysed, 2.8x from batching four candidates at once. Swapping in a weaker model rejected 16 of 16 explanations rather than show an operator a fabricated quote. The gate is what makes the model replaceable.

A call generator, blind to the markers, writes fresh test calls from a plain-words scenario. It found eight real gaps in our own patterns on its first run. It also shows that the amount is not a signal: an honest EUR 1.2 billion settlement stays LOW, a fraudulent EUR 200 invoice is flagged.

Honest limits: we do not detect cloned audio, ten scripted calls is a harness not a validation, and live speech uses the browser's recogniser, not an open model on the AMD box.

## Participation mode

Onsite  (SmartCityLab Milano)

## Event track

Reinvent Commerce

## Technologies used

AMD Developer Cloud
Gemma
rest api
Node.js
