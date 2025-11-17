# Generating Certificates

The server features an API endpoint that allows users to dynamically generate client certificates using a configured certificate authority (CA) certificate.  A local CA (intuitively named `LocalCA`) is configured by default for running the server locally.  The [hosted instance of the server](https://udap-security.fast.hl7.org) uses a configured root CA named `FastCA` that is also by default a trusted anchor.

The API endpoint is located at `/api/cert/generate` and accepts a POST request with a JSON body that specifies the certificate parameters.  The following is an example request body:

```
POST https://udap-security.fast.hl7.org/api/cert/generate
```
```json
{
  "altNames": [
    "http://localhost:8080/fhir"
  ],
  "password": "udap-test"
}
```

The `altNames` property is a list of URIs that will be included as Subject Alternative Names (SANs) in the generated certificate.  The `password` property is the password that will be used to protect the private key of the generated certificate.  This endpoint returns a PKCS#12 (PFX) file.

You can also generate a certificate that instead of the `LocalCA` or `FastCA` anchors will use the SureFhirLabs CA.  This functionality is also available on the [UdapEd tool](https://udaped.fhirlabs.net). The request body for generating a certificate with the SureFhirLabs CA is as follows:

```json
{
  "altNames": [
    "http://localhost:8080/fhir"
  ],
  "password": "udap-test",
  "provider": "FhirLabs"
}
```

The `provider` property specifies the CA to use for generating the certificate.  Valid values for this property are `Local` and `FhirLabs`.  If the property is omitted, the default value is `Local`.
