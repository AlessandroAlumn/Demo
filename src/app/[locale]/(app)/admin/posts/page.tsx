import { getTranslations, setRequestLocale } from "next-intl/server";
import ConfirmButton from "@/components/admin/ConfirmButton";
import PostComposer from "@/components/admin/PostComposer";
import { getPosts } from "@/lib/admin-queries";
import { getToday } from "@/lib/clock";
import { makeFormatters } from "@/lib/format";
import { deletePostAction } from "./actions";

export default async function PostsPage({ params }: PageProps<"/[locale]/admin/posts">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin.posts");
  const f = makeFormatters(locale);
  const [posts, today] = await Promise.all([getPosts(), getToday()]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
        <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
      </header>

      <PostComposer today={today} />

      <section>
        <h2 className="text-2xl text-brand-black">{t("existing")}</h2>
        {posts.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">{t("none")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200 bg-brand-white shadow-sm">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 font-accent text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  {(["date", "type", "title", "campaign"] as const).map((c) => (
                    <th key={c} scope="col" className="px-4 py-3">
                      {t(`columns.${c}`)}
                    </th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-4 py-2.5">{f.date(p.publishedAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-0.5 font-accent text-xs font-semibold ${p.kind === "campaign" ? "bg-brand-yellow" : "bg-gray-100 text-gray-600"}`}>
                        {t(`kinds.${p.kind === "campaign" ? "campaign" : "news"}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="block font-medium">{locale === "es" ? p.titleEs : p.titleEn}</span>
                      <span className="block text-xs text-gray-400">{locale === "es" ? p.titleEn : p.titleEs}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                      {p.campaign ? `${p.campaign}${p.goalAmount ? ` · ${f.money(p.goalAmount)}` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <form action={deletePostAction}>
                        <input type="hidden" name="postId" value={p.id} />
                        <ConfirmButton message={t("deleteConfirm")} className="text-xs font-semibold text-red-700 hover:underline">
                          {t("delete")}
                        </ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
