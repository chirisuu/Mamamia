import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { getRecipesPageContext } from "@/features/recipes/server/page-context";
import { ShoppingListView } from "@/features/shopping/components/shopping-list-view";
import { getShoppingList } from "@/features/shopping/queries";

export const metadata: Metadata = { title: "Lista de compras" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ver y usar una lista propia no exige Premium (son datos de la persona); crearla sí. */
export default async function ShoppingListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await getRecipesPageContext(`/app/compras/${id}`);
  const list = await getShoppingList(ctx.supabase, ctx.user.id, id);
  if (!list) notFound();
  return (
    <>
      <AppHeader title="Lista de compras" subtitle={list.name} backHref="/app/compras" backLabel="Volver a mis listas" />
      <div className="pt-2">
        <ShoppingListView key={list.id} list={list} />
      </div>
    </>
  );
}
