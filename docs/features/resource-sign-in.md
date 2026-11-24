# Sign In as a FHIR Resource

A tester can sign in at the server as a `Patient`, `Practitioner`, `RelatedPerson`, or `Person` of a FHIR server. The server stores no account for this sign-in. The `fhirUser` claim of the tokens names that resource. When the session has a patient and the server grants `launch/patient` or a `patient/` scope, the access token and the token response carry `patient`. This claim holds the id of the patient in context.

The server verifies nothing for this sign-in. It does not read the FHIR server, and it does not check that the resource exists. An id that does not exist gives a token for a resource that does not exist. A FHIR server can refuse these tokens by the `amr` value `fhir-persona`.

## The sign-in form

The login page at `/Account/Login` has the section "Sign in as a FHIR resource". The page hides it when the client of the request does not allow local login or the request has the `udap` scope. The password form is on the page too, unless the client does not allow local login.

| Field | Value |
|-------|-------|
| FHIR base URL | A well-formed absolute `http` or `https` URL with no user information, no query, no fragment, and no white space. The server removes trailing slashes. |
| Resource type | `Patient`, `Practitioner`, `RelatedPerson`, or `Person` |
| Resource id | A FHIR id: 1 to 64 ASCII letters, ASCII digits, hyphens, or periods |
| Patient id | The patient in context. The form shows this field when the request has the `launch/patient` scope or a `patient/` scope, and the resource type is not `Patient`. The server reads it only for a type other than `Patient`, and then it must be a FHIR id. |

When the `aud` parameter is a valid base URL, the FHIR base URL field shows that value, and the tester cannot change it. The server signs in with the `aud` value also when a posted form holds a different base URL. Without a valid `aud`, the tester types the base URL.

For a `Patient`, the patient in context is the resource itself. When a value is not valid, the page shows an error, and the server does not sign in.

A direct visit to `/Account/Login`, with no authorize request, also shows the section. After that sign-in, the server shows its home page.

## Request parameters

An app can name the server and the resource in its authorize request.

| Parameter | Effect |
|-----------|--------|
| `aud` | A valid base URL fills the FHIR base URL field, and the tester cannot change it. This also applies to a pushed authorization request. |
| `login_hint` | A value of the form `Type/id`, with one of the four types and a valid id, fills the resource type and the resource id. The type names are case-sensitive. The tester can change them. Each other value has no effect on the resource form. |
| `hl7fast_signin=auto` | Signs the tester in as the resource of `login_hint`, with no click on the form. |

The server signs in automatically only when each of these is true:

1. The client of the request allows local login.
2. The request has no `udap` scope.
3. `acr_values` names no identity provider, or names the local one (`idp:local`).
4. `aud` is a valid base URL.
5. `login_hint` is a valid `Type/id`.
6. The browser has no session on the server, or its session is a resource sign-in.
7. The request needs no patient id. The type is `Patient`, or the request has no `launch/patient` scope and no `patient/` scope.

When the login page handles `hl7fast_signin=auto`, conditions 1 and 2 are true, and one of conditions 3 to 7 is false, it shows a message. The message names the first of these conditions that is false. When condition 1 or 2 is false, the page shows no resource section and no message for the automatic sign-in. A request that uses the session, or that goes first to an external or a tiered provider, shows no login page and no message.

The automatic sign-in skips the sign-in form only, and consent is a property of the client. A client with consent on can get the consent page after the automatic sign-in. A request of such a client with `offline_access` shows that page each time. A client that an admin makes on the admin page has consent off by default.

When the server asks for a sign-in, this request signs the tester in as `Patient/example` of `http://localhost:8080/fhir` with no click. Conditions 1 to 7 must be true. The line breaks are for reading only.

```text
https://localhost:5001/connect/authorize
  ?response_type=code
  &client_id=my-client
  &redirect_uri=https%3A%2F%2Fapp.example.org%2Fcallback
  &scope=openid%20fhirUser%20launch%2Fpatient%20patient%2FPatient.rs
  &state=xyz
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
  &aud=http%3A%2F%2Flocalhost%3A8080%2Ffhir
  &login_hint=Patient%2Fexample
  &hl7fast_signin=auto
```

## Subject and session

The `sub` claim is `fhirp-` followed by the lower-case hex SHA-256 of the base URL, the type, and the id, joined by a line feed. The hash uses the base URL with no trailing slash. So `http://localhost:8080/fhir` and `http://localhost:8080/fhir/` give one subject.

Two testers who sign in as the same resource of the same base URL share one `sub`. Their sessions and tokens are separate. They share remembered consent and the grants of the `sub`. The page `/Grants` lists and revokes grants by `sub` and client, so one tester can revoke the refresh tokens of the other.

The `amr` claim of the access token and of the ID token is `fhir-persona`. The `idp` claim is `local`.

The session holds `fhirUser`, the base URL in the claim `fhir_base`, and `patient` when the patient is known. No token carries `fhir_base`, also when a scope asks for a claim of that name.

## Claims

The tokens of a resource sign-in carry these claims.

| Where | Claim | When |
|-------|-------|------|
| Access token | `fhirUser` = `{base}/{Type}/{id}`, an absolute URL | The server grants a `patient/`, `user/`, or `system/` scope of the seed. The seed lists `fhirUser` as a user claim of each of these scopes. |
| Access token | `patient` = the bare id | The server grants `launch/patient` or a `patient/` scope, and the session has a patient. |
| Token response | `patient` = the bare id | The same condition, on the authorization code grant and on the refresh token grant |
| ID token | `fhirUser` | The server grants `openid` and `fhirUser`. This applies to each client. |
| ID token | `patient` | Never |

For a `Patient`, `patient` is the id of the resource. For each other type, it is the patient id of the form. Only a resource sign-in gets `patient` in the token response. A refresh keeps each claim, in both refresh modes of a client and after a restart of the server.

The resource type does not limit the scopes. This feature adds nothing to the tokens of a password sign-in, a tiered sign-in, or a client credentials request.

## The `launch/patient` scope

A standalone launch asks for a patient in context with the scope `launch/patient`. At each start with seeding on, the seed adds this scope when it is absent. The seed creates the scope enabled and shown in discovery, so it is in `scopes_supported` of `/.well-known/openid-configuration`. `/.well-known/udap` lists it too when the server has UDAP metadata for its own address. With seeding off, an admin adds the scope on the page `/Admin/ApiScopes` and sets it enabled and shown in discovery.

## Sign-in again

When the browser has a session, the server asks for a sign-in again, and does not use the session, when one of these is true:

1. The session is a resource sign-in, `aud` is a valid base URL, and `aud` is not the base URL of the session.
2. `login_hint` is a valid `Type/id`, and the session is not a sign-in as that resource. This includes a password session.
3. The session is a resource sign-in of a type other than `Patient`, it has no patient, and the request has `launch/patient` or a `patient/` scope. The login page then asks for the patient id.
4. The session is a resource sign-in, and the request has the `udap` scope. When the login page shows for such a request, it names this reason in a message and has no resource section.

Rule 2 applies one time for each authorize request. When the server shows the login page for one of these rules, it marks the request before the tester signs in. On the return from the login page, the mark turns off rule 2, and rules 1, 3, and 4 still apply to the session that the tester chooses. That session can be the hinted resource, a different resource, or the password form. The server also marks a request that has `prompt=login`, and a request with a resource hint, no session, and no `udap` scope, unless that request has `prompt=none`. A later request with the same hint has no mark and gets rule 2 again.

With `prompt=none`, a request with no session, or with a session that one of these rules refuses, gets the error `login_required` and no page. With `prompt=login`, the server asks for a sign-in. The automatic sign-in then applies with its conditions.

No rule compares the patient in context. To change the patient, the app sends `prompt=login`, or the tester signs out.

## Requests with the `udap` scope

A request with the `udap` scope belongs to a tiered flow. For such a request, the login page shows no resource section, and `login_hint` and `hl7fast_signin` have no effect on the resource sign-in. The server refuses a post of the resource form. Rules 1 to 3 of the section "Sign-in again" do not apply, and rule 4 asks a resource session for a sign-in again. An app that wants a resource sign-in sends no `udap` scope.
