# Connect a custom `.com` domain for Dimted

Goal: Replace the current `dimted.lovable.app` URL with `dimted.com` so the school network does not block it.

## Current state
- Project is published at `https://dimted.lovable.app`.
- No custom domain is connected yet.
- `dimted.com` is available for registration at **$11.10/yr**.

## Plan

1. **Purchase `dimted.com` through Lovable**
   - Register the domain and connect it directly to this project.
   - Lovable will handle DNS and SSL automatically for domains bought through the platform.

2. **Set `dimted.com` as the primary domain**
   - After purchase, make `dimted.com` the primary domain so visitors land there.
   - Optionally add `www.dimted.com` as a redirect alias to the primary.

3. **Verify and publish**
   - Confirm DNS propagation and SSL issuance.
   - Re-publish the project so the new primary domain serves the latest build.

4. **Communicate the new URL**
   - Share `https://dimted.com` as the new public link.
   - The old `.lovable.app` URL can remain as a fallback but will redirect to the `.com`.

## Technical details
- Custom domains on Lovable require the project to be published.
- Domains bought through Lovable are auto-connected; manual DNS record entry is only needed for externally-owned domains.
- SSL certificates are provisioned automatically once DNS resolves.
