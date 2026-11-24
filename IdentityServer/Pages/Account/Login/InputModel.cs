// Copyright (c) Duende Software. All rights reserved.
// See LICENSE in the project root for license information.


using System.ComponentModel.DataAnnotations;

namespace IdentityServer.Pages.Login
{
    public class InputModel
    {
        [Required]
        public string Username { get; set; }

        [Required]
        public string Password { get; set; }

        public bool RememberLogin { get; set; }

        public string ReturnUrl { get; set; }

        public string Button { get; set; }
    }

    /// <summary>The form "Sign in as a FHIR resource". The tester names the resource, and the server looks nothing up.</summary>
    public class PersonaInputModel
    {
        public string? FhirBase { get; set; }
        public string? ResourceType { get; set; }
        public string? ResourceId { get; set; }
        // The patient in context of a type other than Patient, for a request that asks for one.
        public string? PatientId { get; set; }
        public string? ReturnUrl { get; set; }
    }
}