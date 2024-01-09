using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IdentityServer.Pages.Udap.Communities
{
    public class IndexModel : PageModel
    {

        private readonly CommunityRepository _repository;

        public IndexModel(CommunityRepository repository)
        {
            _repository = repository;
        }

        public IEnumerable<CommunityModel> Communities { get; private set; }
        public string Filter { get; set; }

        public async Task OnGetAsync(string filter)
        {
            Filter = filter;
            Communities = await _repository.GetAllAsync(filter);
        }
    }
}
