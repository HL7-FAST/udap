using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IdentityServer.Pages.Udap.Anchors
{
    [SecurityHeaders]
    [Authorize]
    public class IndexModel : PageModel
    {
        private readonly AnchorRepository _repository;

        public IndexModel(AnchorRepository repository)
        {
            _repository = repository;
        }

        public IEnumerable<AnchorModel> Anchors { get; private set; }
        public string Filter { get; set; }

        public async Task OnGetAsync(string filter)
        {
            Filter = filter;
            Anchors = await _repository.GetAllAsync(filter);
        }
    }
}
