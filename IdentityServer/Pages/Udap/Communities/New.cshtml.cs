using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IdentityServer.Pages.Udap.Communities
{
    public class NewModel : PageModel
    {
        private readonly CommunityRepository _repository;

        public NewModel(CommunityRepository repository)
        {
            _repository = repository;
        }

        [BindProperty]
        public CommunityModel InputModel { get; set; }


        public void OnGet()
        {
            InputModel = new CommunityModel();
        }

        public async Task<IActionResult> OnPostAsync()
        {
            if (ModelState.IsValid)
            {
                InputModel.Enabled = true;
                await _repository.CreateAsync(InputModel);
                return RedirectToPage("/Udap/Communities/Index");
            }

            return Page();
        }
    }
}
