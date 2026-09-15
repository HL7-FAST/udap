export const CERT_STORE_SERVER_ID: string = "server";
export const AUTHORIZATION_CODE_CLIENT_ID: string = "authorization-code-client";
export const CLIENT_CREDENTIALS_CLIENT_ID: string = "client-credentials-client";
export const COOKIE_CURRENT_FHIR_SERVER = "currentFhirServer";
export const TEST_SESSION_STORE_ID: string = "test-session-store";
export const TEST_IS_RUNNING_STORE_ID: string = "test-is-running";
export const CURRENT_TEST_SESSION_ID_STORE_ID: string = "current-test-session-id";
export const CURRENT_TEST_KEY_STORE_ID: string = "current-test-key";
export const CURRENT_TEST_STEP_KEY_STORE_ID: string = "current-test-step-key";
export const LAST_TEST_RESULT_ID_STORE_ID: string = "last-test-result-id";

/** Path prefix when the app is served under a sub-path, for example /sandbox inside the security server image. Inlined at build time. */
export const BASE_PATH: string = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
