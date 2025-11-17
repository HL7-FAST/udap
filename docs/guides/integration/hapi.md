# Integrating with HAPI FHIR Servers

Learn how to implement UDAP authentication into an existing HAPI FHIR server using interceptors. This tutorial demonstrates the minimum requirements for UDAP support.

!!! info "Scope of This Tutorial"
    This guide covers the basics of UDAP integration. Topics like scope validation, claims checking, and caching strategies are beyond this tutorial's scope.

## :material-checkbox-marked-circle-outline: Prerequisites

<div class="grid" markdown>

=== "Certificate Requirements"

    You need a **PKCS#12 (.pfx/.p12)** certificate file containing:
    
    - :material-certificate: Public key
    - :material-key: Private key
    
    **Don't have a certificate?**
    
    - :material-test-tube: [Generate a test certificate](../../features/certificate-generation.md) using the FAST Security RI
    - :material-shield-lock: Create a self-signed chain (requires adding anchor to security server - see [Seeding Data](../../setup/seeding-data.md))

=== "HAPI FHIR Server"

    - An existing HAPI FHIR server installation
    - Or clone the [HAPI-FHIR Starter Project](https://github.com/hapifhir/hapi-fhir-jpaserver-starter){:target="_blank"}

=== "Knowledge"

    - Basic understanding of Java and Spring
    - Familiarity with [HAPI FHIR interceptors](https://hapifhir.io/hapi-fhir/docs/interceptors/server_interceptors.html){:target="_blank"}
    - UDAP workflow concepts

</div>

## :material-map-marker-path: Implementation Overview

The implementation uses HAPI FHIR's interceptor framework to add UDAP support:

1. :material-package-down: Add JWT dependencies
2. :material-earth: Implement UDAP Discovery endpoint (`.well-known/udap`)
3. :material-shield-lock: Add authentication interceptor for resource protection

---

## Step 1: Add Package Dependencies

Add the Auth0 JWT libraries to your `pom.xml`:

```xml title="pom.xml"
<dependency>
    <groupId>com.auth0</groupId>
    <artifactId>java-jwt</artifactId>
    <version>4.5.0</version>
</dependency>
<dependency>
    <groupId>com.auth0</groupId>
    <artifactId>jwks-rsa</artifactId>
    <version>0.22.2</version>
</dependency>
```

!!! tip "Library Versions"
    Check [Maven Central](https://search.maven.org/){:target="_blank"} for the latest versions of these libraries.

---

## Step 2: Create UDAP Discovery Endpoint

Implement the `.well-known/udap` endpoint required for [UDAP Discovery](https://build.fhir.org/ig/HL7/fhir-udap-security-ig/discovery.html){:target="_blank"}.

### Create the Interceptor Class

```java title="DiscoveryInterceptor.java"
@Interceptor
public class DiscoveryInterceptor {

  @Hook(Pointcut.SERVER_INCOMING_REQUEST_PRE_PROCESSED)
  public boolean incomingRequestPreProcessed(
      HttpServletRequest theRequest, 
      HttpServletResponse theResponse) 
      throws UnrecoverableKeyException, KeyStoreException, 
             NoSuchAlgorithmException, CertificateException, IOException {
    // Implementation below
  }
}
```

### Check Request Path

Only intercept requests to the UDAP discovery endpoint:

```java title="Filter for UDAP endpoint"
if (!theRequest.getRequestURI().equals("/fhir/.well-known/udap")) {
  return true; // Continue normal processing
}
```

### Configure Endpoints and Certificate

!!! warning "Variable Configuration"
    In a real implementation, use external configuration (environment variables, Spring properties) instead of hardcoded values.

```java title="Configuration variables"
String securityServerBase = "https://udap-security.fast.hl7.org";
String authEndpoint = securityServerBase + "/connect/authorize";
String tokenEndpoint = securityServerBase + "/connect/token";
String userinfoEndpoint = securityServerBase + "/connect/userinfo";
String revocationEndpoint = securityServerBase + "/connect/revocation";
String registrationEndpoint = securityServerBase + "/connect/register";

String certFile = System.getProperty("user.home") + "/cert-localhost8080.pfx";
String certPass = "udap-test";
String fhirBase = "http://localhost:8080/fhir";
```

### Load Certificate and Keys

```java title="Load PKCS#12 certificate"
FileInputStream stream = new FileInputStream(ResourceUtils.getFile(certFile));
KeyStore ks = KeyStore.getInstance("pkcs12");
ks.load(stream, certPass.toCharArray());
String alias = ks.aliases().nextElement();

X509Certificate certificate = (X509Certificate) ks.getCertificate(alias);
RSAPublicKey publicKey = (RSAPublicKey) certificate.getPublicKey();
RSAPrivateKey privateKey = (RSAPrivateKey) ks.getKey(alias, certPass.toCharArray());
```

### Create and Sign JWT Metadata

The [UDAP spec requires RS256](https://build.fhir.org/ig/HL7/fhir-udap-security-ig/discovery.html#signed-metadata-elements){:target="_blank"} for signing discovery metadata:

```java title="Create signed metadata JWT"
Algorithm algorithm = Algorithm.RSA256(publicKey, privateKey);
String signedMetadata = JWT.create()
    .withHeader(Map.of(
        "alg", algorithm.getName(),
        "x5c", new String[] { Base64.getEncoder().encodeToString(certificate.getEncoded()) }))
    .withIssuer(fhirBase)
    .withSubject(fhirBase)
    .withIssuedAt(Date.from(Instant.now()))
    .withExpiresAt(Date.from(Instant.now().plusMillis(86400000)))
    .withJWTId(UUID.randomUUID().toString())
    .withClaim("authorization_endpoint", authEndpoint)
    .withClaim("token_endpoint", tokenEndpoint)
    .withClaim("registration_endpoint", registrationEndpoint)
    .sign(algorithm);
```

### Build Discovery Response

Create the JSON response following the [UDAP metadata specification](https://build.fhir.org/ig/HL7/fhir-udap-security-ig/discovery.html#required-udap-metadata){:target="_blank"}:

```java title="Build discovery metadata"
Gson gson = new Gson();
JsonObject discoveryResponse = new JsonObject();
discoveryResponse.add("udap_versions_supported", gson.toJsonTree(List.of("1")));
discoveryResponse.add("udap_profiles_supported", 
    gson.toJsonTree(List.of("udap_dcr", "udap_authn", "udap_authz")));
discoveryResponse.add("udap_authorization_extensions_supported", 
    gson.toJsonTree(List.of("hl7-b2b")));
discoveryResponse.add("udap_authorization_extensions_required", 
    gson.toJsonTree(List.of("hl7-b2b")));
discoveryResponse.add("udap_certifications_supported", 
    gson.toJsonTree(List.of("https://www.example.com/udap/profiles/example-certification")));
discoveryResponse.add("udap_certifications_required", 
    gson.toJsonTree(List.of("https://www.example.com/udap/profiles/example-certification")));
discoveryResponse.add("grant_types_supported", 
    gson.toJsonTree(List.of("authorization_code", "refresh_token", "client_credentials")));
discoveryResponse.add("scopes_supported", 
    gson.toJsonTree(List.of("openid", "patient/*.read", "patient/*.rs", 
                            "user/*.read", "user/*.rs", "system/*.read", "system/*.rs")));
discoveryResponse.addProperty("authorization_endpoint", authEndpoint);
discoveryResponse.addProperty("token_endpoint", tokenEndpoint);
discoveryResponse.addProperty("userinfo_endpoint", userinfoEndpoint);
discoveryResponse.addProperty("revocation_endpoint", revocationEndpoint);
discoveryResponse.add("token_endpoint_auth_methods_supported", 
    gson.toJsonTree(List.of("private_key_jwt")));
discoveryResponse.add("token_endpoint_auth_signing_alg_values_supported", 
    gson.toJsonTree(List.of("ES256", "ES384", "RS256", "RS384")));
discoveryResponse.addProperty("registration_endpoint", registrationEndpoint);
discoveryResponse.add("registration_endpoint_jwt_signing_alg_values_supported", 
    gson.toJsonTree(List.of("ES256", "ES384", "RS256", "RS384")));
discoveryResponse.addProperty("signed_metadata", signedMetadata);
```

!!! note "Metadata Model Class"
    In practice, you should probably create a dedicated metadata class using [Spring REST patterns](https://spring.io/guides/gs/rest-service){:target="_blank"} instead of building the JSON manually.

### Return Response

Send the JSON response and stop further request processing:

```java title="Send response"
theResponse.setContentType("application/json");
theResponse.getWriter().write(discoveryResponse.toString());
theResponse.setStatus(200);
theResponse.getWriter().close();

return false; // Stop further processing
```

### Register the Interceptor

In your HAPI starter `Application` class:

```java title="Application.java"
public ServletRegistrationBean hapiServletRegistration(RestfulServer restfulServer) {
  // ... existing code ...
  restfulServer.registerInterceptor(new DiscoveryInterceptor());
  // ... existing code ...
}
```

!!! success "Complete Source"
    [:material-file-code: View complete DiscoveryInterceptor.java](../../assets/java/DiscoveryInterceptor.java)

---

## Step 3: Protect Resource Endpoints

Create an interceptor to validate access tokens on all endpoints except public ones.

### Create the Interceptor Class

```java title="AuthInterceptor.java"
@Interceptor
public class AuthInterceptor {

  @Hook(Pointcut.SERVER_INCOMING_REQUEST_POST_PROCESSED)
  public boolean incomingRequestPostProcessed(
      RequestDetails details, 
      HttpServletRequest request, 
      HttpServletResponse response) throws Exception {
    // Implementation below
  }
}
```

### Configure Security Settings

```java title="Security configuration"
String issuer = "https://udap-security.fast.hl7.org";
String jwksUri = issuer + "/.well-known/openid-configuration/jwks";
List<String> publicEndpoints = List.of("/fhir/metadata", "/fhir/.well-known/udap");
```

!!! warning "Variable Configuration"
    Again, in an actual implementation, use external configuration (environment variables, Spring properties) instead of hardcoded values.

### Allow Public Endpoints

```java title="Check for public endpoints"
if (publicEndpoints.contains(request.getRequestURI())) {
  return true; // Allow unauthenticated access
}
```

### Validate Authorization Header

```java title="Check auth header"
String authHeader = request.getHeader(Constants.HEADER_AUTHORIZATION);
if (authHeader == null || authHeader.isEmpty()
    || !authHeader.startsWith(Constants.HEADER_AUTHORIZATION_VALPREFIX_BEARER)) {
  throw new AuthenticationException("Missing or invalid Authorization header");
}
```

### Extract and Verify Issuer

```java title="Verify token issuer"
String token = authHeader.substring(Constants.HEADER_AUTHORIZATION_VALPREFIX_BEARER.length()).trim();

DecodedJWT decodedJWT = JWT.decode(token);
if (!decodedJWT.getIssuer().equals(issuer)) {
  throw new JWTVerificationException(
      "Invalid issuer: Expected \"" + issuer + "\" but received \"" + decodedJWT.getIssuer() + "\"");
}
```

### Retrieve Public Key from JWKS

!!! warning "Implement Caching"
    In production, consider strategies to cache the JWKS keys to avoid fetching them on every request.

```java title="Get public key from JWKS"
JwkProvider jwkProvider = new UrlJwkProvider(new URL(jwksUri));
Jwk jwk = jwkProvider.get(decodedJWT.getKeyId());
RSAPublicKey rsaPublicKey = (RSAPublicKey) jwk.getPublicKey();

if (rsaPublicKey == null) {
  throw new JWTVerificationException("Could not determine public key");
}
```

### Verify Token Signature

```java title="Verify JWT signature"
Algorithm algorithm = Algorithm.RSA256(rsaPublicKey, null);
JWTVerifier verifier = JWT.require(algorithm)
    .withIssuer(issuer)
    .build();
    
DecodedJWT verifiedJwt;
try {
  verifiedJwt = verifier.verify(token);
} catch (JWTVerificationException e) {
  throw new AuthenticationException("Token verification failed: " + e.getMessage());
}

return verifiedJwt != null;
```

### Register the Interceptor

In your HAPI starter `Application` class:

```java title="Application.java"
public ServletRegistrationBean hapiServletRegistration(RestfulServer restfulServer) {
  // ... existing code ...
  restfulServer.registerInterceptor(new AuthInterceptor());
  // ... existing code ...
}
```

!!! success "Complete Source"
    [:material-file-code: View complete AuthInterceptor.java](../../assets/java/AuthInterceptor.java)

---

## :material-check-circle: Testing Your Integration

After implementing both interceptors:

1. **Test Discovery**: `curl http://localhost:8080/fhir/.well-known/udap`
2. **Test Protected Resource**: Try accessing a FHIR resource without a token (should fail)
3. **Test with Token**: Use the FAST Security server to register a client and obtain a token. Consider using the sandbox example app in `examples/sandbox/` for testing as it is already configured to work in a local environment.

!!! tip "Next Steps"
    - Implement scope validation for fine-grained access control
    - Add claims processing for user/patient context
    - Implement JWKS key caching for better performance
    - Add comprehensive error handling and logging

