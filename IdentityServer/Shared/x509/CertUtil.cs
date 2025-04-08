

using System.Security.Cryptography.X509Certificates;
using Serilog;

namespace IdentityServer.Shared.x509
{
    public static class CertUtil
    {
        public static X509Certificate2 LoadFromFileOrEncoded(string file, bool isP12 = false, string password = "udap-test")
        {

            X509Certificate2 cert = null;
            // check if file appears to be base64 encoded
            try
            {
                // Check if the string contains only valid base64 characters
                var buffer = Convert.FromBase64String(file);
                if (buffer.Length == 0)
                {
                    throw new FormatException("The string is not a valid base64 string.");
                }

                if (isP12)
                {
                    // Load the certificate from the byte array
                    cert = X509CertificateLoader.LoadPkcs12(buffer, password, X509KeyStorageFlags.Exportable);
                    return cert;
                }
                cert = X509CertificateLoader.LoadCertificate(buffer);
                return cert;
            }
            catch (Exception e)
            {
                Log.Debug($"File {file} does not appear to be base64 encoded: {e.Message}");
            }

            // otherwise assume it's a file path
            try
            {
                if (isP12)
                {
                    cert = X509CertificateLoader.LoadPkcs12FromFile(file, password, X509KeyStorageFlags.Exportable);
                    return cert;
                }
                cert = X509CertificateLoader.LoadCertificateFromFile(file);
                return cert;
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"Could not load certifile from path: {file}");
            }

            return cert;

        }
    }
}