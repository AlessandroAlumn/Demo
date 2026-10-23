import { notFound } from "next/navigation";

// Any unknown address under a language ends here, so it gets the localized 404 page instead of a bare one.
export default function UnknownPage() {
  notFound();
}
