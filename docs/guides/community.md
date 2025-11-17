# Community Resources

This is a non-exhaustive list of community resources available for working with the FAST Security Reference Implementation and UDAP in general.


## Implementations

The FAST identity matching implementation guide has client and server reference implementations that use the FAST Security server RI to (optionally) obtain generated certificates, register clients, and complete both `authorization_code` and `client_credentials` flows.

- [FAST Identity Matching Server](https://github.com/HL7-FAST/identity-matching) (Java HAPI FHIR server)
- [FAST Identity Matching Client](https://github.com/HL7-FAST/identity-matching-ui) (Angular+Express web app)

The identity matching client demostrates a confidential client where no auth tokens are stored in the browser.

## Examples in This Repository

The FAST Security server RI contains an `examples` directory in the root of the project.

### Docker FAST Identity Matching Stack

The Docker compose file located at `examples/docker/compose-identity-matching.yml` sets up the security server along with the [FAST Identity Matching Server](https://github.com/HL7-FAST/identity-matching) and the [FAST Identity Matching Client](https://github.com/HL7-FAST/identity-matching-ui).


### Next.js Example App

The `examples/sandbox` directory contains a simple Next.js application that registers two different clients. One client uses the `authorization_code` flow and stores the access token in the browser. The other client uses the `client_credentials` flow to obtain obtain access tokens for server-to-server communication.


## FhirLabs UdapEd

The [UdapEd tool](https://udaped.fhirlabs.net) is a web-based application that, among many other features, allows users to go step-by-step through the process of registering a UDAP client and obtaining access tokens from a UDAP server.

Joe Shook (author of the UdapEd tool) also has an extensive tutorial for setting up a FHIR and UDAP auth server: <https://github.com/JoeShook/udap-dotnet-tutorial>