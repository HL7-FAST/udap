using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IdentityServer.Pages.Udap.Anchors
{
    public class DeleteModel : PageModel
    {
        private readonly AnchorRepository _repository;

        [BindProperty]
        public AnchorModel InputModel { get; private set; }

        public DeleteModel(AnchorRepository repository)
        {
            _repository = repository;

        }

        public async Task<IActionResult> OnGetAsync(int id)
        {
            InputModel = await _repository.GetByIdAsync(id);

            if (InputModel == null || InputModel.Community.Name == "EmrDirect" || InputModel.Community.Name == "FastCA")
            {
                return RedirectToPage("/Udap/Anchors/Index");
            }

            return Page();
        }

        public async Task<IActionResult> OnPostAsync(int id)
        {
            await _repository.DeleteAsync(id);
            return RedirectToPage("/Udap/Anchors/Index");
        }
    }
}
