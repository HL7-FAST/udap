using IdentityServer.Pages.Udap.Communities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Security.Cryptography.X509Certificates;
using Udap.Util.Extensions;

namespace IdentityServer.Pages.Udap.Anchors
{
    public class NewModel : PageModel
    {
        private readonly AnchorRepository _repository;
        private readonly CommunityRepository _communityRepository;

        public NewModel(AnchorRepository repository, CommunityRepository communityRepository)
        {
            _repository = repository;
            _communityRepository = communityRepository;
        }

        [BindProperty]
        public AnchorModel InputModel { get; set; }

        [BindProperty]
        public int CommunityId { get; set; }

        [BindProperty]
        public IFormFile AnchorFile { get; set; }
        public string FileMessage { get; set; }

        [BindProperty]
        public string Button { get; set; }


        public IEnumerable<CommunityModel> Communities { get; set; } = new List<CommunityModel>();

        public async Task OnGetAsync()
        {
            FileMessage = "";
            InputModel = new AnchorModel();
            Communities = await _communityRepository.GetAllAsync();
        }

        public async Task<IActionResult> OnPostAsync()
        {
            FileMessage = "";
                
            try
            {
                using (var memoryStream = new MemoryStream())
                {
                    await AnchorFile.CopyToAsync(memoryStream);
                    var bytes = memoryStream.ToArray();
                    var cert = X509CertificateLoader.LoadCertificate(bytes);

                    InputModel.Name = cert.SubjectName.Name;
                    InputModel.Certificate = cert.ToPemFormat();
                    InputModel.Thumbprint = cert.Thumbprint;
                    InputModel.BeginDate = cert.NotBefore;
                    InputModel.EndDate = cert.NotAfter;

                }
            }
            catch (Exception e)
            {
                FileMessage = $"Error parsing X.509 certificate: {e.Message}";
                return Page();
            }

            
            InputModel.Enabled = true;
            await _repository.CreateAsync(InputModel);

            return RedirectToPage("/Udap/Anchors/Index");

        }
    }
}
