# Controfirma

**Impersonation markers on live payment calls. Rules decide, the model only explains, a person signs.**

In September 2026 fraudsters used an AI-cloned voice of external counsel to take
**€95 million** from Fideuram, the private banking arm of Intesa Sanpaolo. It started
with a WhatsApp message and a phone call. Around €36 million was never recovered.

Voice cloning has made "it sounded exactly like him" worthless as a control. Controfirma
does not try to detect a synthetic voice. It listens to what the caller is *asking for* —
and the asks that move money fraudulently have a shape that has not changed.

---

## How it works

```
  1. rules score the call          deterministic, no model, same answer every time
  2. the model drafts explanations many at once, on AMD
  3. the verifier throws away any explanation it cannot source
  4. a person decides                            ← not in this codebase, on purpose
```

**1 — Rules decide.** [`src/rules.js`](src/rules.js) scores a transcript against ten
markers published by banks and police about impersonation fraud: a request for a
one-time code, a refusal to let you call back, a demand for secrecy, fresh bank details,
an instruction to skip the second signature. Italian and English.

Individual markers are weak on purpose. *Urgency* alone is ordinary business — the real
CFO is often in a genuine hurry. The signal is in **combinations**: urgency used as the
reason to drop the controls, secrecy wrapped around a new account. Combinations carry
bonus weight, and that is what keeps genuine calls quiet.

**2 — The model explains, in parallel.** For every triggered marker, six short
explanations are generated concurrently on AMD. A finance employee has seconds, so each
is capped at two sentences and must quote the caller.

**3 — The verifier checks every quote.** [`src/verify.js`](src/verify.js) extracts each
quoted span and confirms it appears verbatim in what the caller actually said. A quote
that was tidied up, paraphrased or invented is rejected, and the rejection is shown on
screen rather than hidden. The model is also rejected for stating a verdict: deciding is
not its job.

**4 — A person signs.** Nothing here blocks a payment. The console recommends, a human
holds or releases, and the decision is recorded against their name.

---

## Results

```
node src/eval.js
```

Ten calls: five fraudulent, modelled on documented attacks, and five genuine but
awkward — a CFO in a real hurry, a bank that really is calling, a notary on a real
closing. Those five are the hard half; a keyword matcher flags all of them.

| | |
|---|---|
| fraudulent calls held | **5 of 5** |
| genuine calls disturbed | **0 of 5** |
| fraud score range | 77 – 210 |
| genuine score range | 0 – 12 |

Clean separation, with the `HOLD` threshold at 65 sitting in the gap.

### What the verifier actually catches

Measured on AMD with `Gemma-4-31B-IT`: **0 of 64 explanations rejected.** Properly
instructed, it quotes verbatim every time.

That number is the point, not a disappointment. The gate is what makes the model
*replaceable* — and the console's model picker lets you prove it on the same call:

| model | returned | verified | rejected |
|---|---|---|---|
| `Gemma-4-31B-IT` | 12 | **12** | 0 |
| `MiniCPM5-2B` | 16 | **0** | **16** |

Every `MiniCPM5-2B` response leaked its own reasoning, in English, into what an employee
would have read as evidence — *"We need to respond in Italian, at most two short
sentences…"*. All sixteen were rejected, and the markers fell back to standing on their
own cited evidence.

That is the failure mode that matters. A weak model does not make the product wrong, it
makes it quieter. `node src/benchmark.js` runs the same task across six models served on
AMD, and two of them produced output that would otherwise have been shown to an
employee as evidence during a live call:

| model | ms | outcome |
|---|---|---|
| Gemma-4-31B-IT | 4,906 | verified |
| MiniCPM5-2B | 5,526 | **rejected** — leaked 1,736 characters of its own chain of thought |
| Qwen3.8-27B | 12,195 | verified, but too slow for a live call |
| Qwen3.8-Flash-Next | 24,385 | **rejected** — spent its whole budget reasoning, returned nothing |
| DeepSeek-V4.1-Flash | — | timed out |
| GLM-5.3-Flash | — | timed out |

Without the gate, choosing a model would be an act of faith. With it, a bad model
degrades into "no explanation available" instead of into a fabricated quote.

### Generated calls: a blind test, and what it found

`node src/gentest.js` describes six situations in plain English and Italian, has an open
model on AMD write each call, and scores the result cold.

**The generator is never shown the markers, the weights, or anything about how scoring
works.** If it were, it would write our own keywords back at us and prove nothing. It gets
a scenario the way you would describe one to an actor.

Two of the presets exist to make one point: **the amount is not a signal.** An honest
€1.2 billion bond settlement scores 12 and stays `LOW`. A fraudulent €200 invoice is
flagged. What is being asked for decides, not how much.

The first run scored **4 of 6**, and the two failures were real gaps — our own eval set
had been written by the same person who wrote the patterns, so it matched them. The
generator wrote English and Italian a real caller would use and walked straight past:

| missed | why |
|---|---|
| “I am the manager” | the authority list had ceo/cfo/lawyer, not manager |
| “needs to clear in the next hour” | the time pattern wanted *within* an hour, not *in* |
| “so we don’t have to go through the full approval chain” | a bypass phrased as going *through*, not *around* |
| “prima della chiusura” | the Italian pattern only had `prima di` |
| “un’urgenza concordata” | `urgente` was covered, the noun `urgenza` was not |
| “mantenere la massima riservatezza” | secrecy as a noun, not “non ne parli” |
| “I’ll send the confirmation right after” | pay now, document later |
| “give you the new IBAN over the phone” | bank details with no written record |

All are now covered, and the scripted eval still shows 0 false alarms. Runs since score
**4–5 of 6**: the generator writes a different call every time at temperature 0.85 and
reliably finds the soft end of the distribution, which is the point of it. We stopped
tuning there rather than overfit to generated text.

### Cost and parallelism, measured

| | |
|---|---|
| cost per call analysed | **$0.00002** (~$0.02 per 1,000 calls) |
| batch | 4 concurrent, 7,431 ms wall vs 23,791 ms serial — **3.2x** |
| mean latency | 3.7 s unloaded, ~12 s against the shared endpoint |

The free event endpoint returns `429` above roughly three requests per second, so the
client rate-limits and retries. On a dedicated vLLM server on AMD Developer Cloud that
ceiling is ours to set, and `AMD_CONCURRENCY` is the only thing that changes.

---

## Running it

Node 20 or newer. No dependencies, nothing to install.

```bash
node src/server.js      # operator console on http://localhost:3000
node src/eval.js        # the evaluation table above
```

Pick a call, press **Start call**, and the transcript arrives line by line the way it
would be spoken. Risk climbs as the caller talks, and each marker's explanation is
requested the moment that marker fires rather than at the end — a reason that arrives
after the call is over is of no use to anyone.

**Write your own** takes a transcript you type yourself, so you can try to get a call
past it. One line each, prefixed `caller:` or `staff:`. Only the caller's words are ever
used as evidence. **Live microphone** feeds speech straight in instead of typing.

**Generate a call** describes a situation in plain words and has an open model on AMD
write the transcript, which the rules then score cold. See below — this is a test, not a
toy.

The **model picker** switches which AMD-served model writes the explanations, without
touching the rules. Swapping to a weaker one is the fastest way to see the verifier work.

### AMD configuration

```bash
cp .env.example .env
```

The client speaks the OpenAI-compatible API, which is what both **AMD Token Factory**
and a self-hosted **vLLM server on AMD Developer Cloud** expose — so moving from a hosted
Instinct GPU to our own endpoint is one environment variable.

Without `AMD_API_KEY` everything still runs against a mock. The rules and the verifier are
real in both modes; only the explanation text is a stand-in.

---

## Why this needs a GPU and not an API call in a loop

Generate-many-then-verify only works if generating many is cheap. Each flagged call fans
out to *markers × 6* short completions in flight at once — a batch of short requests on
one GPU costs barely more wall-clock time than a single request, which is what makes it
affordable to throw most of them away.

It also has to stay in the building. Call audio from a bank's finance desk cannot be
shipped to a third-party API, which rules out exactly the hosted assistants that could
otherwise do this work. Running an open model on the institution's own AMD hardware is
what makes the product possible at all.

The operator console shows the live inference figures — model, batch size, latency,
tokens — because an AMD workload nobody can see is not a workload anyone should believe in.

---

## What this does not do

- It does not detect synthetic or cloned audio. It reads intent, not acoustics.
- It does not block payments, freeze accounts or contact anyone.
- It is not a fraud verdict. `HOLD` means *call back on a number you already had*.
- The markers cover impersonation fraud. Investment and romance scams have a different
  shape and are out of scope.
- Live speech uses the browser's own recognition. That proves the pipeline takes live
  speech, but in a bank it would be an open speech model on the same AMD box, because the
  audio cannot leave the building. That part is not built.
- Generated calls score 4–5 of 6 depending on the run. A soft, polite attacker asking for
  a small sum is genuinely close to an honest supplier with new bank details, and we would
  rather land on `REVIEW` than invent certainty.

---

## Layout

| file | what it is |
|---|---|
| `src/rules.js` | the deterministic core — markers, weights, combinations, bands |
| `src/verify.js` | the quote verifier that gates every explanation |
| `src/amd.js` | AMD inference client, parallel batching, telemetry |
| `src/pipeline.js` | score → explain → verify, in that order |
| `src/testcalls.js` | the ten-call evaluation set |
| `src/generate.js` | writes a call from a plain-words scenario, blind to the rules |
| `src/eval.js` | prints the results table |
| `src/gentest.js` | generates the preset scenarios and scores them cold |
| `src/benchmark.js` | the same task across six models served on AMD |
| `src/server.js` | operator console server |
| `public/index.html` | the console |

MIT.
