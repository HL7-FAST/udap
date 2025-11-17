# Integrating with HAPI FHIR Servers

This guide is for implementing UDAP support into an existing HAPI FHIR server. This implementation will demonstrate the bare minimum to support UDAP and will not touch on topics such as checking scopes, claims, or caching strategies.

## Prerequisites

You will need a valid certificate for signing JWTs. Specifically you will need the public and private keys available. This guide assumes you have a PKCS#12 (.pfx/.p12) file available. 

If you do not have a certificate, you can create a self-signed certificate chain for development purposes. If you do this you will need to add the anchor to the security server as a trusted anchor. See [Seeding Data](../../setup/seeding-data.md) for more information.

You can also use the FAST Security RI to generate a certificate as described in [Generating Certificates](../../features/certificate-generation.md).

If you do not have an existing HAPI server, the easiest way to get started is to clone the [HAPI-FHIR Starter Project](https://github.com/hapifhir/hapi-fhir-jpaserver-starter).

## Implementation Steps

The implementation will rely on HAPI FHIR's interceptor framework. Information on server interceptors can be found in the [HAPI FHIR server inteceptor documentation](https://hapifhir.io/hapi-fhir/docs/interceptors/server_interceptors.html).

The following high level steps are required to add UDAP support to a HAPI FHIR server:

1. Add package dependencies for JWT creation and parsing
2. Add interceptor for `.well-known/udap` endpoint for UDAP Discovery
3. Add interceptor to protect all resource endpoints and validate an incoming access token



### Add Package Dependencies

This implementation will use the Auth0 [Java JWT](https://github.com/auth0/java-jwt) and [JWKs-RSA](https://github.com/auth0/jwks-rsa-java) libraries for creating and verifying JWTs. If you are using the HAPI starter project, you can add the following dependencies to your `pom.xml`:

```xml
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


### Create UDAP Discovery Endpoint

This step will create the `.well-known/udap` endpoint required for [UDAP Discovery](https://build.fhir.org/ig/HL7/fhir-udap-security-ig/discovery.html) using your certificate.

#### Create Interceptor

We will need to create a new interceptor class with a hook for the pre-processed incoming request pointcut. This will allow us to intercept requests before they are routed to a resource provider.

```java
@Interceptor
public class DiscoveryInterceptor {

  @Hook(Pointcut.SERVER_INCOMING_REQUEST_PRE_PROCESSED)
  public boolean incomingRequestPreProcessed(HttpServletRequest theRequest, HttpServletResponse theResponse) throws UnrecoverableKeyException, KeyStoreException, NoSuchAlgorithmException, CertificateException, IOException {
    // ... to be implemented
  }
}
```

We will start by checking if the incoming request is for the `.well-known/udap` endpoint. If it is not we will return true to allow normal processing to continue.

```java
if (!theRequest.getRequestURI().equals("/fhir/.well-known/udap")) {
  return true;
}
```

Next we will establish some variables that will be used throughout the rest of the process. These include the various URLs that will be included in the discovery response as well the URL of our FHIR server's FHIR base.  This example has these variables hardcoded, but in practice these should be done through external configuration.  This also assumes a PKCS#12 certificate file exists in your home directory named `cert-localhost8080.pfx` with the password `udap-test`.

```java
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


We now need to load our certificate and extract the public and private keys from it.  These will be used in the next step to sign the JWT.

```java
FileInputStream stream = new FileInputStream(ResourceUtils.getFile(certFile));
KeyStore ks = KeyStore.getInstance("pkcs12");
ks.load(stream, certPass.toCharArray());
String alias = ks.aliases().nextElement();

X509Certificate certificate = (X509Certificate) ks.getCertificate(alias);
RSAPublicKey publicKey = (RSAPublicKey) certificate.getPublicKey();
RSAPrivateKey privateKey = (RSAPrivateKey) ks.getKey(alias, certPass.toCharArray());
```

We can now create and sign the JWT that is needed for the signed metadata property in the discovery response.  The [spec requires](https://build.fhir.org/ig/HL7/fhir-udap-security-ig/discovery.html#signed-metadata-elements) the use of RS256 for signing.

```java
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


We can now create our JSON response body [based on the spec](https://build.fhir.org/ig/HL7/fhir-udap-security-ig/discovery.html#required-udap-metadata) including the signed metadata we just created.  This uses the GSON library to create the JSON response since it is already included in the dependency tree in the HAPI starter project and for simplicity in this example.  In practice, you should probably define your own metadata class in typical [Spring fashion](https://spring.io/guides/gs/rest-service).

```java
Gson gson = new Gson();
JsonObject discoveryResponse = new JsonObject();
discoveryResponse.add("udap_versions_supported", gson.toJsonTree(List.of("1")));
discoveryResponse.add("udap_profiles_supported", gson.toJsonTree(List.of("udap_dcr", "udap_authn", "udap_authz")));
discoveryResponse.add("udap_authorization_extensions_supported", gson.toJsonTree(List.of("hl7-b2b")));
discoveryResponse.add("udap_authorization_extensions_required", gson.toJsonTree(List.of("hl7-b2b")));
discoveryResponse.add("udap_certifications_supported", gson.toJsonTree(List.of("https://www.example.com/udap/profiles/example-certification")));
discoveryResponse.add("udap_certifications_required", gson.toJsonTree(List.of("https://www.example.com/udap/profiles/example-certification")));
discoveryResponse.add("grant_types_supported", gson.toJsonTree(List.of("authorization_code", "refresh_token", "client_credentials")));
discoveryResponse.add("scopes_supported", gson.toJsonTree(List.of("openid", "patient/*.read", "patient/*.rs", "user/*.read", "user/*.rs", "system/*.read", "system/*.rs")));
discoveryResponse.addProperty("authorization_endpoint", authEndpoint);
discoveryResponse.addProperty("token_endpoint", tokenEndpoint);
discoveryResponse.addProperty("userinfo_endpoint", userinfoEndpoint);
discoveryResponse.addProperty("revocation_endpoint", revocationEndpoint);
discoveryResponse.add("token_endpoint_auth_methods_supported", gson.toJsonTree(List.of("private_key_jwt")));
discoveryResponse.add("token_endpoint_auth_signing_alg_values_supported", gson.toJsonTree(List.of("ES256", "ES384", "RS256", "RS384")));
discoveryResponse.addProperty("registration_endpoint", registrationEndpoint);
discoveryResponse.add("registration_endpoint_jwt_signing_alg_values_supported", gson.toJsonTree(List.of("ES256", "ES384", "RS256", "RS384")));
discoveryResponse.addProperty("signed_metadata", signedMetadata);
```

Finally we need to write the response back to the client with the appropriate content type and status code since this is a [manual response](https://hapifhir.io/hapi-fhir/docs/server_plain/rest_operations_operations.html#manually-handing-requestresponse).  Return false to indicate that further processing of this request is not needed.

```java
theResponse.setContentType("application/json");
theResponse.getWriter().write(discoveryResponse.toString());
theResponse.setStatus(200);
theResponse.getWriter().close();

return false;
```


#### Register Inteceptor

Register the interceptor with your server.  If using the HAPI starter one place this can be done is in the main `Application` class inside the `hapiServletRegistration` bean:

```java
public ServletRegistrationBean hapiServletRegistration(RestfulServer restfulServer) {
  // ... existing code ...
  restfulServer.registerInterceptor(new DiscoveryInterceptor());
  // ... existing code ...
}
```

#### Full Source

The finished full implementation of the `DiscoveryInterceptor` that can be used in the HAPI starter project is available in [assets/java/DiscoveryInterceptor.java](../../assets/java/DiscoveryInterceptor.java).

### Protect Resource Endpoints

This step will create an interceptor to protect all resource endpoints and validate incoming access tokens while still allowing public access to `/fhir/metadata` and `/fhir/.well-known/udap`. Every other `/fhir/*` endpoint will require a valid access token.


#### Create Interceptor

We will start by creating a new interceptor class with a hook for the request post-processed incoming request pointcut.

```java
@Interceptor
public class AuthInterceptor {

  @Hook(Pointcut.SERVER_INCOMING_REQUEST_POST_PROCESSED)
  public boolean incomingRequestPostProcessed(RequestDetails details, HttpServletRequest request, HttpServletResponse response) throws Exception {
    // ... to be implemented
  }
}
```

We need to initialize some variables we will use later.  Again, these should be done through external configuration in a real implementation. The `issuer` variable should match the base of the security server we also used in the discovery endpoint. The `jwksUri` variable is used to retrieve the public keys for validating incoming JWTs. The `publicEndpoints` list contains the endpoints that do not require authentication.

```java
String issuer = "https://udap-security.fast.hl7.org";
String jwksUri = issuer + "/.well-known/openid-configuration/jwks";
List<String> publicEndpoints = List.of("/fhir/metadata", "/fhir/.well-known/udap");
```

We will start by checking if the incoming request is for a public endpoint. If it is we will return true to allow normal processing to continue.

```java
if (publicEndpoints.contains(request.getRequestURI())) {
  return true;
}
```

We need to check that an auth header is present in the request and starts with `Bearer `. An auth exception is thrown if these are not present.

```java
String authHeader = request.getHeader(Constants.HEADER_AUTHORIZATION);
if (authHeader == null || authHeader.isEmpty()
    || !authHeader.startsWith(Constants.HEADER_AUTHORIZATION_VALPREFIX_BEARER)) {
  throw new AuthenticationException("Missing or invalid Authorization header");
}
```

Next we will extract the token from the auth header and check that the issuer matches our expected issuer.

```java
String token = authHeader.substring(Constants.HEADER_AUTHORIZATION_VALPREFIX_BEARER.length()).trim();

DecodedJWT decodedJWT = JWT.decode(token);
if (!decodedJWT.getIssuer().equals(issuer)) {
  throw new JWTVerificationException(
      "Invalid issuer: Expected \"" + issuer + "\" but received \"" + decodedJWT.getIssuer() + "\"");
}
```

We now need to get the public keys from the JWKS endpoint so we can verify the token signature.  In practice you should implement caching for the keys to avoid fetching them on every request.

```java
JwkProvider jwkProvider = new UrlJwkProvider(new URL(jwksUri));
Jwk jwk = jwkProvider.get(decodedJWT.getKeyId());
RSAPublicKey rsaPublicKey = (RSAPublicKey) jwk.getPublicKey();

if (rsaPublicKey == null) {
  throw new JWTVerificationException("Could not determine public key");
}
```

Finally we can verify the token using the public key and return true if the token is valid.  An exception is thrown if the token is invalid.

```java
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

#### Register Inteceptor

Register the interceptor with your server.  If using the HAPI starter one place this can be done is in the main `Application` class inside the `hapiServletRegistration` bean:

```java
public ServletRegistrationBean hapiServletRegistration(RestfulServer restfulServer) {
  // ... existing code ...
  restfulServer.registerInterceptor(new AuthInterceptor());
  // ... existing code ...
}
```


#### Full Source

The finished full implementation of the `AuthInterceptor` that can be used in the HAPI starter project is available in [assets/java/AuthInterceptor.java](../../assets/java/AuthInterceptor.java).

