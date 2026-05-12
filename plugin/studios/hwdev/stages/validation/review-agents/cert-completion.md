---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify every regulatory framework named in the requirements stage has a formal, scope-correct certification before manufacturing ramp. Cert completion is the lens — products that ramp without a final cert document on file become customs holds, retailer pulls, and FCC / CE / FDA enforcement actions.

## Check

The agent **MUST** verify, filing feedback for any violation:

1. The agent **MUST** verify that every regulatory framework named in the requirements artifact (FCC, CE, IC, RCM, KC, JATE, MIC, UL, ETL, FDA, regional safety regimes) has a formal cert document on file — preliminary findings, draft reports, and "expected to pass" notes are not certs.
2. The agent **MUST** verify that the cert document's product description, model number, and configuration match the unit going into manufacturing — cert for variant A does not cover variant B.
3. The agent **MUST** verify that test methods and operating frequencies / power levels declared in the cert match the firmware / hardware as it ships — late-stage RF parameter changes invalidate the cert.
4. The agent **MUST** verify that cert labs are accredited for the regime tested, and the cert document carries the lab's accreditation reference / signature.
5. The agent **MUST** verify expiration dates: any cert expiring within the planned product lifecycle has a re-cert plan with budgeted timing.
6. The agent **MUST** verify that any cert deemed "self-declaration" or "supplier's declaration of conformity" has the supporting test evidence on file — the declaration alone is not the evidence.
7. The agent **MUST** verify that mandatory labeling (FCC ID, CE mark, regulatory IDs, energy-efficiency labels) is present on the as-built unit and on packaging.

## Common failure modes to look for

- A "cert" that is actually a preliminary lab finding before final emissions sweep
- A cert that names a different model number or covers a hardware revision that was changed during validation
- A firmware change that bumped RF transmit power post-cert, silently invalidating the FCC ID
- A non-accredited lab's report being accepted as a regulatory cert
- A cert expiring inside the product's planned sales window with no re-cert budgeted
- Energy / efficiency labels stamped on the unit but with values that no longer match the final hardware
