/**
 * Content script for Job OS Companion.
 * Detects application form inputs on Greenhouse, Lever, Ashby, Workday, and LinkedIn.
 */
(function () {
  console.log("Job OS Companion active on job application portal.");

  function fillField(input, value) {
    if (!input || value === undefined || value === null) return;
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.style.border = "2px solid #10b981"; // Highlight filled fields in green
  }

  window.addEventListener("message", (event) => {
    if (event.data?.type === "JOB_OS_AUTOFILL" && event.data?.profile) {
      const p = event.data.profile;

      // First Name / Last Name / Full Name
      const nameInputs = document.querySelectorAll('input[name*="name" i], input[id*="name" i]');
      nameInputs.forEach((inp) => {
        const id = (inp.id || inp.name || "").toLowerCase();
        if (id.includes("first")) fillField(inp, p.name.split(" ")[0]);
        else if (id.includes("last")) fillField(inp, p.name.split(" ").slice(1).join(" "));
        else fillField(inp, p.name);
      });

      // Email
      const emailInput = document.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]');
      if (emailInput && p.email) fillField(emailInput, p.email);

      // Phone
      const phoneInput = document.querySelector('input[type="tel"], input[name*="phone" i], input[id*="phone" i]');
      if (phoneInput && p.phone) fillField(phoneInput, p.phone);

      // LinkedIn
      const linkedinInput = document.querySelector('input[name*="linkedin" i], input[id*="linkedin" i], input[placeholder*="linkedin" i]');
      if (linkedinInput && p.linkedin) fillField(linkedinInput, p.linkedin);

      // GitHub
      const githubInput = document.querySelector('input[name*="github" i], input[id*="github" i], input[placeholder*="github" i]');
      if (githubInput && p.github) fillField(githubInput, p.github);

      // Portfolio / Website
      const siteInput = document.querySelector('input[name*="website" i], input[name*="portfolio" i], input[id*="website" i]');
      if (siteInput && p.website) fillField(siteInput, p.website);

      // Notice Period
      const noticeInput = document.querySelector('input[name*="notice" i], input[id*="notice" i]');
      if (noticeInput && p.noticePeriod) fillField(noticeInput, p.noticePeriod);

      console.log("Job OS: Autofill completed successfully.");
    }
  });
})();
