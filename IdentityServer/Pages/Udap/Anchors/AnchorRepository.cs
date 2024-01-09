using Microsoft.EntityFrameworkCore;
using Udap.Server.DbContexts;
using Udap.Server.Entities;

namespace IdentityServer.Pages.Udap.Anchors
{

    public class AnchorModel
    {
        public int AnchorId { get; set; }
        public string Name { get; set; }
        public string Certificate { get; set; }
        public string Thumbprint { get; set; }
        public DateTime BeginDate { get; set; }
        public DateTime EndDate { get; set; }
        public Community Community { get; set; }
    }


    public class AnchorRepository
    {
        private readonly UdapDbContext _context;

        public AnchorRepository(UdapDbContext context)
        {
            _context = context;
        }


        public async Task<IEnumerable<AnchorModel>> GetAllAsync(string filter = null)
        {
            var query = _context.Anchors.AsQueryable();

            if (!string.IsNullOrWhiteSpace(filter))
            {
                filter = filter.ToLower();
                query = query.Where(x => x.Name.ToLower().Contains(filter) || x.Community.Name.ToLower().Contains(filter));
            }

            var result = query.Select(x => new AnchorModel
            {
                AnchorId = x.Id,
                Name = x.Name,
                Certificate = x.X509Certificate,
                Thumbprint = x.Thumbprint,
                BeginDate = x.BeginDate,
                EndDate = x.EndDate,
                Community = x.Community
            });

            return await result.ToArrayAsync();
        }


        public async Task<AnchorModel> GetByIdAsync(string id)
        {
            var anchor = await _context.Anchors
                .Include(x => x.Community)
                .SingleOrDefaultAsync(x => x.Id.ToString() == id);

            if (anchor is null)
                return null;

            return new AnchorModel
            {
                AnchorId = anchor.Id,
                Name = anchor.Name,
                Certificate = anchor.X509Certificate,
                Thumbprint = anchor.Thumbprint,
                BeginDate = anchor.BeginDate,
                EndDate = anchor.EndDate,
                Community = anchor.Community
            };
        }


    }
}
