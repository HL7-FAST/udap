// Keeps the sample API request body on the scenarios page in step with the form.
document.addEventListener("DOMContentLoaded", function () {
    var form = document.querySelector("form[method=post]");
    var output = document.getElementById("request-json");
    var copy = document.getElementById("request-json-copy");
    if (!form || !output || !copy) {
        return;
    }

    function render() {
        var altNames = form.elements["Input.AltNames"].value
            .split(/\r?\n/)
            .map(function (line) { return line.trim(); })
            .filter(function (line) { return line.length > 0; });
        var body = JSON.stringify({
            altNames: altNames,
            password: form.elements["Input.Password"].value,
            scenario: form.elements["Input.Scenario"].value,
            keyType: form.elements["Input.KeyType"].value
        }, null, 2);
        output.textContent = body;
        copy.setAttribute("data-copy", body);
    }

    form.addEventListener("input", render);
    form.addEventListener("change", render);
    render();
});
