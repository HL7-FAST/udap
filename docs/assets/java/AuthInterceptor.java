package ca.uhn.fhir.jpa.starter.udap;

import java.net.URL;
import java.security.interfaces.RSAPublicKey;
import java.util.List;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.UrlJwkProvider;
import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;

import ca.uhn.fhir.interceptor.api.Hook;
import ca.uhn.fhir.interceptor.api.Interceptor;
import ca.uhn.fhir.interceptor.api.Pointcut;
import ca.uhn.fhir.rest.api.Constants;
import ca.uhn.fhir.rest.api.server.RequestDetails;
import ca.uhn.fhir.rest.server.exceptions.AuthenticationException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Interceptor
public class AuthInterceptor {

  @Hook(Pointcut.SERVER_INCOMING_REQUEST_POST_PROCESSED)
  public boolean incomingRequestPostProcessed(RequestDetails details, HttpServletRequest request, HttpServletResponse response) throws Exception {

    // Variables that should be in external configuration
    String issuer = "https://udap-security.fast.hl7.org";
    String jwksUri = issuer + "/.well-known/openid-configuration/jwks";
    List<String> publicEndpoints = List.of("/fhir/metadata", "/fhir/.well-known/udap");

    // Don't need to check auth for public endpoints
    if (publicEndpoints.contains(request.getRequestURI())) {
      return true;
    }

    // Auth bearer header must be present
    String authHeader = request.getHeader(Constants.HEADER_AUTHORIZATION);
    if (authHeader == null || authHeader.isEmpty()
        || !authHeader.startsWith(Constants.HEADER_AUTHORIZATION_VALPREFIX_BEARER)) {
      throw new AuthenticationException("Missing or invalid Authorization header");
    }

    // Get token from header
    String token = authHeader.substring(Constants.HEADER_AUTHORIZATION_VALPREFIX_BEARER.length()).trim();

    // Decode JWT token
    DecodedJWT decodedJWT = JWT.decode(token);
    if (!decodedJWT.getIssuer().equals(issuer)) {
      throw new JWTVerificationException(
          "Invalid issuer: Expected \"" + issuer + "\" but received \"" + decodedJWT.getIssuer() + "\"");
    }

    // Get public key from JWKS endpoint
    JwkProvider jwkProvider = new UrlJwkProvider(new URL(jwksUri));
    Jwk jwk = jwkProvider.get(decodedJWT.getKeyId());
    RSAPublicKey rsaPublicKey = (RSAPublicKey) jwk.getPublicKey();

    if (rsaPublicKey == null) {
      throw new JWTVerificationException("Could not determine public key");
    }

    // Verify token
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
  }

}
