# Tomorrow

Everything here is built and measured. You do not need to write code. Read this, run the
demo twice, record the video, pitch it.

---

## 1. What it is, in one sentence

> Someone phones your finance office sounding exactly like your CEO or your lawyer and
> asks for an urgent transfer. Controfirma reads what they're *asking for*, not what they
> sound like, and tells the employee to stop and call back on a known number.

If you only remember one line on stage, make it this one:

> **The AI never decides. Rules decide, the model only explains, and a person signs.**

---

## 2. Why it exists

September 2026. Fraudsters used an **AI-cloned voice** of an external lawyer to take
**€95 million** from Fideuram, the private banking arm of Intesa Sanpaolo. It began with a
WhatsApp message, then a phone call. Roughly **€36 million** was never recovered.

Voice cloning has made "it sounded exactly like him" worthless as a control. But the
*asks* that move money fraudulently have not changed: secrecy, a new account, a reason to
skip the second signature, no time to check, don't call me back.

We don't detect fake audio. We read intent.

---

## 3. How it works — four steps

1. **Rules score the call.** Ten markers published by banks and police. Plain code, no
   model. Same transcript in, same answer out, every time.
2. **The model explains, several versions at once, on AMD.**
3. **The verifier throws away any explanation it can't source.** Every quoted span must
   appear word-for-word in what the caller actually said.
4. **A person decides.** Nothing in the product blocks a payment.

### The bit that makes it work

Single markers are weak *on purpose*. Urgency alone is ordinary business — the real CFO
genuinely is in a hurry. The signal lives in **combinations**: urgency used as the reason
to drop the controls; secrecy wrapped around a new bank account.

That is why genuine calls stay quiet. A keyword matcher flags the real CFO and gets
switched off by Tuesday.

---

## 4. Your numbers — all measured, none invented

**Detection** (`node src/eval.js`, ten calls: five fraud, five genuine-but-awkward)

- **5 of 5** fraudulent calls held
- **0 of 5** genuine calls disturbed
- fraud scored 77–210, genuine scored 0–12 — the HOLD line at 65 sits in the gap

**The verifier** — same call, two models, switched live in the console

| model | returned | verified | rejected |
|---|---|---|---|
| Gemma-4-31B-IT | 12 | **12** | 0 |
| MiniCPM5-2B | 16 | **0** | **16** |

Every MiniCPM answer leaked its own reasoning, in English, into what an employee would
have read as evidence. All sixteen rejected.

**AMD**

- 16 models served; we benchmarked 6 on the real task
- Gemma-4-31B-IT chosen: fastest that passed verification, 4.9 s
- **$0.02–0.03 per 1,000 calls analysed**
- batch of 4: 6.8 s wall vs 19.3 s serial — **2.8x**

---

## 5. The demo — exact clicks

Run `node --env-file-if-exists=.env src/server.js`, open `localhost:3000`.

**Part one — it works (40 s)**
1. Leave the first call selected: *Voice-cloned lawyer, confidential acquisition*.
2. Press **Start call**. Say nothing for a few seconds. Let them watch the score climb
   and the caller's own words light up red in the transcript.
3. At the end: **210, HOLD**. Read the recommendation aloud.

**Part two — the verifier (40 s)**
4. Top right, switch the model to **MiniCPM5-2B**. Go to **Write your own** → **Analyse
   this call**.
5. Verification goes **0 verified, 16 rejected**. Scroll to "Thrown away before anyone saw
   it." Let them read one.
6. Say: *"A weak model doesn't make us wrong. It makes us quieter."*

**Part three — hand it over (30 s)**
7. Give the laptop to a judge. *"Write me a scam call that gets past it."*

That third one is the whole pitch. Don't skip it.

---

## 6. Three minutes, roughly

**0:00** "Three weeks ago an AI-cloned voice took ninety-five million euros from Intesa
Sanpaolo's private bank. One WhatsApp message and one phone call. Thirty-six million was
never recovered."

**0:20** "Voice cloning killed the only control these offices had — it sounded like him.
But what the attacker *asks for* hasn't changed. Secrecy. A new account. Skip the second
signature. Don't call me back."

**0:40** Demo, parts one and two.

**2:00** "Five of five frauds held. Zero of five genuine calls disturbed — including a
real CFO in a genuine hurry, because that's the call that gets a tool uninstalled. Two
cents per thousand calls on AMD."

**2:20** "The model never decides. Code decides, the model explains, every quote is
checked against what was actually said, and a person signs. When we swapped in a weak
model, sixteen out of sixteen explanations were rejected instead of shown."

**2:40** "Banks, law firms, any finance office that authorises money by phone. Intesa just
lost ninety-five million to one call. And under the new EU payment rules banks have to
refund customers when a fraudster impersonates their own bank — so every call we stop
comes straight off their losses."

**3:00** Stop talking.

---

## 7. Questions they will ask

**"Can't ChatGPT or Claude just do this?"**
Not during the call — it has to warn you in seconds. And bank call audio can't be shipped
to a third-party API, which rules out exactly those tools. That's why an open model on the
institution's own AMD hardware is the only shape this can take.

**"Does it detect the cloned voice?"**
No, and we say so. We read intent, not acoustics. Deepfake detection is an arms race we'd
lose; the asks are stable.

**"What if the attacker avoids your keywords?"**
Then the score drops and we say less. We'd rather miss than flag the real CFO. The scoring
is combination-based, so paraphrasing one marker doesn't clear the call — and the
markers are the asks themselves, which the attacker can't drop without dropping the
attack.

**"Where's the speech-to-text?"**
Not wired in. The console replays transcripts. That's the next piece of work and we're not
going to pretend otherwise.

**"Is 10 calls a real evaluation?"**
No. It's a starting harness with the hard half included on purpose. Say that plainly.

---

## 8. Submission fields

**Title:** Controfirma

**Track:** Reinvent Commerce

**Short description:**
Impersonation markers on live payment calls. Rules decide, the model only explains, a
person signs. 5 of 5 frauds held, 0 of 5 genuine calls disturbed.

**Long description:** first three sections of the [README](README.md).

**Tags:** AMD Developer Cloud, AMD ROCm, Gemma

**Needed from you:** public GitHub repo, demo video, pitch deck, cover image, live app URL.

---

## 9. Honest limits — say these before a judge finds them

- No speech-to-text yet; transcripts are replayed.
- Ten calls is a harness, not a validation.
- Marker lists are drawn from published fraud patterns, not from a bank's real call data.
- Covers impersonation fraud only. Investment and romance scams have a different shape.
- The free endpoint rate-limits at ~3 requests/sec; about 15% of calls get retried or lost.
  On a dedicated vLLM server on AMD Developer Cloud that ceiling is ours to set.

Saying these out loud makes everything else you claim believable.
