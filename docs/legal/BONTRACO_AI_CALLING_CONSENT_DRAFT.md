# Bontraco AI Calling and Recording Controls — Counsel Review Draft

**Status:** Operational draft only. It is not legal advice, customer consent language, or authorization to activate calling or recording.

## Launch defaults

| Capability | Required default | Activation evidence |
| --- | --- | --- |
| Inbound AI answering | Off until a workspace number and approved agent are configured | owner/admin configuration and provider acceptance test |
| Outbound artificial-voice marketing calls | Off | counsel approval, documented recipient consent, suppression integration, approved script, and jurisdiction review |
| Owner/admin test calls | Maximum five per workspace per day | verified authorized destination controlled by the tester |
| Call recording | Off | counsel-approved disclosure/consent flow and written workspace choice |
| Transcript retention | 90 days or shorter | approved privacy notice, provider configuration, and deletion test |
| Recording retention | 30 days or shorter | approved notice, storage configuration, and deletion test |
| Emergency advice | Never enabled | transfer/escalation language only; no autonomous diagnosis |

## Required opening behavior

Before collecting substantive information, the approved agent script should:

1. identify the contractor business responsible for the call;
2. clearly disclose that the caller is interacting with an automated or AI assistant;
3. disclose recording or transcription before it begins when applicable;
4. obtain the form of consent approved for the jurisdictions in scope;
5. offer a practical path to a human or voicemail; and
6. stop recording or end the automated interaction when consent is declined, according to the approved fallback.

No single sample sentence should be treated as universally sufficient. Counsel must approve the exact script, states served, call direction, purpose, provider behavior, and evidence retained.

## Consent record requirements

Where consent is required, retain only the evidence needed to demonstrate it:

- workspace and responsible business;
- destination number or channel;
- person or business granting consent;
- date, time, source, scope, and exact disclosure/version;
- call purpose and whether artificial voice, automated dialing, recording, or marketing was covered;
- revocation time and source, if received; and
- suppression status propagated to every connected provider.

Consent must not be inferred merely from a public listing, previous unanswered call, website visit, scraped post, or inclusion in a purchased list.

## Recording controls

- The customer must choose recording explicitly; absence of configuration means no recording.
- The agent must follow the approved disclosure before recording or transcription begins.
- Bontraco must keep provider recording URLs private, short-lived where possible, and inaccessible to roles without call-history permission.
- Export, correction, litigation hold, and deletion handling must be documented before launch.
- Recording and transcript deletion must be tested in both Bontraco and the voice provider.
- Bontraco must not use voiceprints or biometric identification unless separately designed, disclosed, consented, and approved. Ordinary audio storage must not silently become biometric analysis.

## Revocation and suppression

Any reasonable opt-out or revocation received by voice, text, email, form, or staff entry should create a durable suppression record. Connected outreach systems must check suppression before initiating contact. Revocation must not be hidden in notes or left only inside a provider dashboard.

## Acceptance evidence before activation

- exact approved agent version and opening disclosure;
- inbound and outbound purpose classification;
- jurisdictions served and counsel sign-off;
- provider number ownership/forwarding proof;
- authorized test destinations;
- recording/transcription settings screenshots;
- transfer, voicemail, consent-decline, emergency, and provider-failure tests;
- suppression and consent-revocation test;
- provider and Bontraco deletion test; and
- named operator authorized to activate or disable the integration.

## Sources for counsel

- [FCC 2024 ruling addressing AI-generated voices under the TCPA](https://docs.fcc.gov/public/attachments/FCC-24-17A1_Rcd.pdf)
- [FCC declaratory ruling summarizing consent rules for artificial or prerecorded voice calls](https://docs.fcc.gov/public/attachments/DA-21-69A1.pdf)
- [Illinois General Assembly, eavesdropping provisions in 720 ILCS 5 Article 14](https://www.ilga.gov/legislation/ILCS/details?ActID=1876&ActName=Criminal+Code+of+2012.&ChapAct=720+ILCS+5%2F&Chapter=&ChapterID=53&MajorTopic=&SeqEnd=35399999&SeqStart=34200000)
