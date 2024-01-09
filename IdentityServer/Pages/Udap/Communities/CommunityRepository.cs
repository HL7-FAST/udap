using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using Udap.Server.DbContexts;
using Udap.Server.Entities;

namespace IdentityServer.Pages.Udap.Communities
{
    public class CommunityModel
    {
        [Required]
        public int CommunityId { get; set; }
        [Required]
        public string Name { get; set; }
        public bool Enabled { get; set; }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            var errors = new List<ValidationResult>();

            if (string.IsNullOrWhiteSpace(Name))
            {
                errors.Add(new ValidationResult("Name is required.", new[] { "Name" }));
            }

            return errors;
        }   
    }


    public class CommunityRepository
    {

        private readonly UdapDbContext _context;

        public CommunityRepository(UdapDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<CommunityModel>> GetAllAsync(string filter = null)
        {
            var query = _context.Communities.AsQueryable();

            if (!string.IsNullOrWhiteSpace(filter))
            {
                query = query.Where(x => x.Name.ToLower().Contains(filter.ToLower()));
            }

            var result = query.Select(x => new CommunityModel
            {
                CommunityId = x.Id,
                Name = x.Name,
                Enabled = x.Enabled
            });

            return await result.ToArrayAsync();
        }

        public async Task<CommunityModel> GetByIdAsync(int id)
        {
            var community = await _context.Communities
                .SingleOrDefaultAsync(x => x.Id == id);

            if (community is null)
            {
                return null;
            }

            return new CommunityModel
            {
                CommunityId = community.Id,
                Name = community.Name,
                Enabled = community.Enabled
            };
        }

        public async Task CreateAsync(CommunityModel model)
        {
            var community = new Community
            {
                Name = model.Name,
                Enabled = model.Enabled
            };

            _context.Communities.Add(community);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(CommunityModel model)
        {
            var community = await _context.Communities
                .SingleOrDefaultAsync(x => x.Id == model.CommunityId);

            if (community is null)
            {
                throw new ArgumentException($"Community with id {model.CommunityId} not found.");
            }

            community.Name = model.Name;
            community.Enabled = model.Enabled;

            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var community = await _context.Communities
                .SingleOrDefaultAsync(x => x.Id == id);

            if (community is null)
            {
                throw new ArgumentException($"Community with id {id} not found.");
            }

            _context.Communities.Remove(community);
            await _context.SaveChangesAsync();
        }

    }
}
