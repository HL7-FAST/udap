using Duende.IdentityServer.EntityFramework.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace IdentityServer.Pages.Portal
{
    public class ThirdPartyInitiatedLoginLink
    {
        public string LinkText { get; set; }
        public string InitiateLoginUri { get; set; }
    }


    public class ClientRepository
    {
        private readonly IConfigurationDbContext _context;

        public ClientRepository(IConfigurationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<ThirdPartyInitiatedLoginLink>> GetClientsWithLoginUris(string filter = null)
        {
            var query = _context.Clients
                .Where(c => c.InitiateLoginUri != null);

            if (!String.IsNullOrWhiteSpace(filter))
            {
                query = query.Where(x => x.ClientId.Contains(filter) || x.ClientName.Contains(filter));
            }

            var result = query.Select(c => new ThirdPartyInitiatedLoginLink
            {
                LinkText = string.IsNullOrWhiteSpace(c.ClientName) ? c.ClientId : c.ClientName,
                InitiateLoginUri = c.InitiateLoginUri
            });

            return await result.ToArrayAsync();
        }
    }
}