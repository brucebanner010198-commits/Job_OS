import { buildRejectionReply } from "../lib/track/rejection-reply";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("PASS:", msg);
}

async function testRejectionReply() {
  console.log("Testing Rejection Reply Drafting...\n");

  const reply = buildRejectionReply({
    candidateName: "Jordan Hayes",
    company: "Stripe",
    jobTitle: "Staff Infrastructure Engineer",
    recruiterName: "Sarah Jenkins",
    originalSubject: "Update on your application at Stripe",
  });

  assert(reply.subject.includes("Update on your application at Stripe"), "Subject keeps context");
  assert(reply.body.includes("Dear Sarah Jenkins,"), "Addresses recruiter by name");
  assert(reply.body.includes("Staff Infrastructure Engineer"), "Cites specific role");
  assert(reply.body.includes("Stripe"), "Cites company name");
  assert(reply.body.includes("Jordan Hayes"), "Signs candidate name");
  assert(reply.body.includes("would welcome the opportunity to stay in touch"), "Maintains relationship");

  console.log("\nRejection reply tests passed successfully!");
}

testRejectionReply().catch((e) => {
  console.error(e);
  process.exit(1);
});
