document.addEventListener("DOMContentLoaded", function () {
    var root = document.documentElement;

    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
        button.addEventListener("click", function () {
            var next = root.dataset.mdbTheme === "dark" ? "light" : "dark";
            root.dataset.mdbTheme = next;
            try { localStorage.setItem("theme", next); } catch (e) { }
        });
    });

    document.querySelectorAll("[data-confirm]").forEach(function (element) {
        element.addEventListener("click", function (e) {
            if (!confirm(this.getAttribute("data-confirm"))) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        });
    });

    document.querySelectorAll("[data-copy]").forEach(function (button) {
        button.addEventListener("click", function () {
            navigator.clipboard.writeText(this.getAttribute("data-copy"));
        });
    });

    // A Patient is its own patient in context, so the patient id field applies only to the other resource types.
    var personaType = document.querySelector("[data-persona-type]");
    var personaPatient = document.querySelector("[data-persona-patient]");
    if (personaType && personaPatient) {
        var showPersonaPatient = function () {
            personaPatient.hidden = personaType.value === "Patient";
        };
        personaType.addEventListener("change", showPersonaPatient);
        showPersonaPatient();
    }
});
