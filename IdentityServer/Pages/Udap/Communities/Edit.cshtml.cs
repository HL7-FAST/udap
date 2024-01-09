using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IdentityServer.Pages.Udap.Communities
{
    [SecurityHeaders]
    [Authorize]
    public class EditModel : PageModel
    {
        private readonly CommunityRepository _repository;

        public EditModel(CommunityRepository repository)
        {
            _repository = repository;
        }

        [BindProperty]
        public CommunityModel InputModel { get; set; }
        [BindProperty]
        public string Button { get; set; }

        public async Task<IActionResult> OnGetAsync(int id)
        {
            InputModel = await _repository.GetByIdAsync(id);
            if (InputModel == null)
            {
                return RedirectToPage("/Udap/Communities/Index");
            }

            return Page();
        }


        public async Task<IActionResult> OnPostAsync(int id)
        {
            if (Button == "delete")
            {
                await _repository.DeleteAsync(id);
                return RedirectToPage("/Udap/Communities/Index");
            }

            if (ModelState.IsValid)
            {
                await _repository.UpdateAsync(InputModel);
                return RedirectToPage("/Udap/Communities/Edit");
            }

            return Page();
        }


    }
}
