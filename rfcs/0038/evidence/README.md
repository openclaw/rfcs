# Prototype evidence exports

These files are inspectable, redacted exports of live Sigil/OpenClaw dogfood
records. They retain only observations needed to motivate and test RFC 0038.

The exports omit wallet addresses, signatures, account and channel identifiers,
local paths, request/job/run identifiers, raw commands and output, proof values,
and private endpoints. Each file names the source commit and path from which it
was derived.

This evidence exercises an automation-specific broad-resolver prototype. It is
not after-change proof of the host-owned adapter proposed by RFC 0038. In
particular, the prototype used a separate proof ledger and a non-secret proof
reference in host receipts; RFC 0038 deliberately does not carry those choices
forward. Adapter implementation still requires its own conformance and live
proof.
