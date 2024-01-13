using Microsoft.EntityFrameworkCore;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using Udap.Server.DbContexts;
using Udap.Server.Entities;

namespace IdentityServer.Pages.Udap.Anchors
{

    public class AnchorModel
    {
        public int AnchorId { get; set; }
        public bool Enabled { get; set; }
        [Required]
        public string Name { get; set; }
        [Required]
        public string Certificate { get; set; }
        [Required]
        public string Thumbprint { get; set; }
        [Required]
        public DateTime BeginDate { get; set; }
        [Required]
        public DateTime EndDate { get; set; }

        public Community Community { get; set; }
        public int CommunityId { get; set; }
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
            var query = _context.Anchors.Include(a => a.Community).AsQueryable();

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
                Community = x.Community,
                CommunityId = x.Community.Id
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
                CommunityId = anchor.CommunityId
            };
        }

        public async Task CreateAsync(AnchorModel model)
        {
            var anchor = new Anchor
            {
                Name = model.Name,
                Enabled = model.Enabled,
                X509Certificate = model.Certificate,
                Thumbprint = model.Thumbprint,
                BeginDate = model.BeginDate,
                EndDate = model.EndDate,
                CommunityId = model.CommunityId
            };

            _context.Anchors.Add(anchor);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(AnchorModel model)
        {
            var anchor = await _context.Anchors
                .SingleOrDefaultAsync(x => x.Id == model.AnchorId);

            if (anchor is null)
            {
                return;
            }

            anchor.Name = model.Name;
            anchor.Enabled = model.Enabled;
            anchor.X509Certificate = model.Certificate;
            anchor.Thumbprint = model.Thumbprint;
            anchor.BeginDate = model.BeginDate;
            anchor.EndDate = model.EndDate;
            anchor.CommunityId = model.CommunityId;

            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(string id)
        {
            var anchor = await _context.Anchors
                .SingleOrDefaultAsync(x => x.Id.ToString() == id);

            if (anchor is null)
            {
                return;
            }

            _context.Anchors.Remove(anchor);
            await _context.SaveChangesAsync();
        }


    }
}
