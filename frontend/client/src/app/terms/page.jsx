import { redirect } from "next/navigation";

export default function TermsPageRedirect() {
  redirect("/policy/terms-and-conditions");
}
